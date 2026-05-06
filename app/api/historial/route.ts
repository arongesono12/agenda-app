import { NextResponse } from 'next/server'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { buildTaskScope, isTaskScopeColumnError } from '@/lib/task-scope'
import type { Estado, TipoOrden } from '@/lib/types'

export const dynamic = 'force-dynamic'

type HistorialPayload = {
  tarea_id?: number
  tipo_cambio?: TipoOrden
  valor_nuevo?: string | null
  observaciones?: string | null
  finalizar?: boolean
}

type TaskRow = {
  id: number
  codigo_id: number | null
  tarea: string
  estado: Estado
  porcentaje_avance: number
  responsable: string | null
  responsable_usuario_id?: string | null
  asignado_por_usuario_id?: string | null
  asignado_por_nombre?: string | null
  fecha_fin: string | null
}

type AdminRecipient = {
  id: string
  email: string
  nombre_completo: string | null
}

function toPositiveInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

function parseProgress(value?: string | null) {
  if (!value) return null
  const cleanValue = value.replace('%', '').trim()
  const parsed = Number.parseInt(cleanValue, 10)

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return null
  return parsed
}

function isFinalization(payload: HistorialPayload) {
  const value = payload.valor_nuevo?.toLowerCase() ?? ''
  const observation = payload.observaciones?.toLowerCase() ?? ''

  return (
    payload.finalizar === true ||
    value.includes('completado') ||
    value.includes('finalizado') ||
    observation.includes('completado') ||
    observation.includes('finalizado') ||
    parseProgress(payload.valor_nuevo) === 100
  )
}

function isMissingAssignmentOwnerColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /asignado_por_(usuario_id|nombre)|column .* does not exist/i.test(message)
  )
}

function isMissingTaskAssignmentsTable(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    /tarea_asignaciones|schema cache|relation .* does not exist/i.test(message)
  )
}

async function isUserAssignedToTask(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number,
  userId: string
) {
  const { data, error } = await admin
    .from('tarea_asignaciones')
    .select('id')
    .eq('tarea_id', taskId)
    .eq('responsable_usuario_id', userId)
    .eq('activo', true)
    .maybeSingle()

  if (error) {
    if (isMissingTaskAssignmentsTable(error)) return false
    throw error
  }

  return !!data?.id
}

async function loadAssignedTaskIds(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string
) {
  const ids = new Set<number>()
  const { data, error } = await admin
    .from('tarea_asignaciones')
    .select('tarea_id')
    .eq('responsable_usuario_id', userId)
    .eq('activo', true)

  if (error) {
    if (!isMissingTaskAssignmentsTable(error)) throw error
  } else {
    for (const assignment of data ?? []) ids.add(Number(assignment.tarea_id))
  }

  return Array.from(ids)
}

function completionEmailHtml(task: TaskRow, userLabel: string) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 12px">Tarea finalizada</h2>
      <p>${escapeHtml(userLabel)} marco una tarea como finalizada en la agenda.</p>
      <div style="border:1px solid #99f6e4;border-radius:12px;padding:16px;margin:18px 0;background:#f0fdfa">
        <p style="margin:0 0 8px"><strong>Tarea:</strong> ${escapeHtml(task.tarea)}</p>
        <p style="margin:0 0 8px"><strong>Responsable:</strong> ${escapeHtml(task.responsable ?? 'Sin responsable')}</p>
        <p style="margin:0"><strong>Fecha fin:</strong> ${escapeHtml(task.fecha_fin ?? 'Sin fecha')}</p>
      </div>
      <p>Revisa el historial para ver el recorrido completo de la tarea.</p>
    </div>
  `
}

async function loadAdminRecipients(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, email, nombre_completo, tipo_usuario:tipos_usuario(codigo)')

  if (error) throw error

  return ((data ?? []) as Array<AdminRecipient & { tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null }>)
    .filter((profile) => {
      const role = Array.isArray(profile.tipo_usuario) ? profile.tipo_usuario[0]?.codigo : profile.tipo_usuario?.codigo
      return ADMIN_ROLE_CODES.includes((role ?? '').toLowerCase() as (typeof ADMIN_ROLE_CODES)[number])
    })
    .map((profile) => ({
      id: profile.id,
      email: profile.email,
      nombre_completo: profile.nombre_completo,
    }))
}

async function notifyAdminsTaskCompleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  task: TaskRow,
  userLabel: string
) {
  const recipients = await loadAdminRecipients(admin)

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email)
    const title = 'Tarea asignada finalizada'
    const message = `${userLabel} finalizo la tarea "${task.tarea}". Revisa el historial para validar lo realizado.`
    const { data: alert, error } = await admin
      .from('alertas')
      .upsert(
        {
          tarea_id: task.id,
          tipo_alerta: 'Completada',
          destinatario_usuario_id: recipient.id,
          destinatario_email: email,
          titulo: title,
          mensaje: message,
          alerta_key: `completada:${task.id}:${recipient.id}`,
        },
        { onConflict: 'alerta_key' }
      )
      .select('id')
      .maybeSingle()

    if (error) throw error

    if (!email || !alert?.id) continue

    const result = await sendAgendaEmail({
      to: email,
      subject: `Tarea finalizada: ${task.tarea}`,
      html: completionEmailHtml(task, userLabel),
      text: message,
    })

    await admin
      .from('alertas')
      .update({
        enviada_email_at: result.ok ? new Date().toISOString() : null,
        email_error: result.ok ? null : result.error,
      })
      .eq('id', alert.id)
  }
}

async function markCurrentUserAssignmentHandled(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number,
  userId: string
) {
  const { error } = await admin
    .from('alertas')
    .update({ leida: true })
    .eq('tarea_id', taskId)
    .eq('destinatario_usuario_id', userId)
    .eq('tipo_alerta', 'Asignada')
    .eq('leida', false)

  if (error) throw error
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, [...MANAGER_ROLE_CODES, 'responsable'])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar historial.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const taskId = Number(url.searchParams.get('tarea_id'))
    const page = toPositiveInt(url.searchParams.get('page'), 0)
    const pageSize = toPositiveInt(url.searchParams.get('pageSize'), 25, 100)
    const from = page * pageSize
    const to = from + pageSize - 1
    const admin = createAdminSupabaseClient()
    const isManager = hasAnyRole(profile, MANAGER_ROLE_CODES)

    if (Number.isInteger(taskId) && taskId > 0) {
      if (!isManager) {
        const taskResult = await admin
          .from('tareas')
          .select('id, responsable, responsable_usuario_id')
          .eq('id', taskId)
          .maybeSingle()
        const fallbackTask =
          taskResult.error && isTaskScopeColumnError(taskResult.error)
            ? await admin.from('tareas').select('id, responsable').eq('id', taskId).maybeSingle()
            : taskResult
        const { data: task, error: taskError } = fallbackTask

        if (taskError) throw taskError
        if (!task) return NextResponse.json({ ok: false, error: 'La tarea no existe.' }, { status: 404 })

        const scope = buildTaskScope(user, profile)
        const scopedTask = task as { responsable?: string | null; responsable_usuario_id?: string | null }
        const isAssignedByAssignment = await isUserAssignedToTask(admin, taskId, user.id)
        const isAssigned =
          isAssignedByAssignment ||
          scopedTask.responsable_usuario_id === user.id ||
          (!!scopedTask.responsable && scope.assignedNames.includes(scopedTask.responsable))

        if (!isAssigned) {
          return NextResponse.json({ ok: false, error: 'Solo puedes consultar historial de tus tareas asignadas.' }, { status: 403 })
        }
      }

      const { data, count, error } = await admin
        .from('historial')
        .select('*', { count: 'exact' })
        .eq('tarea_id', taskId)
        .order('fecha', { ascending: false })
        .range(from, to)

      if (error) throw error

      return NextResponse.json({
        ok: true,
        rows: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      })
    }

    if (!isManager) {
      const scope = buildTaskScope(user, profile)
      const assignedIds = new Set(await loadAssignedTaskIds(admin, user.id))
      const primaryTasks = await admin.from('tareas').select('id').eq('responsable_usuario_id', user.id)
      const fallbackTasks =
        primaryTasks.error && isTaskScopeColumnError(primaryTasks.error) && scope.assignedNames.length
          ? await admin.from('tareas').select('id').in('responsable', scope.assignedNames)
          : primaryTasks

      if (fallbackTasks.error) throw fallbackTasks.error

      for (const task of fallbackTasks.data ?? []) assignedIds.add(Number(task.id))

      const taskIds = Array.from(assignedIds)
      if (taskIds.length === 0) {
        return NextResponse.json({ ok: true, rows: [], total: 0, page, pageSize, totalPages: 0 })
      }

      const { data, count, error } = await admin
        .from('historial')
        .select('*', { count: 'exact' })
        .in('tarea_id', taskIds)
        .order('fecha', { ascending: false })
        .range(from, to)

      if (error) throw error

      return NextResponse.json({
        ok: true,
        rows: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      })
    }

    const { data, count, error } = await admin
      .from('historial')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(from, to)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo consultar el historial.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, [...MANAGER_ROLE_CODES, 'responsable'])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para registrar historial.' }, { status: 403 })
    }

    const payload = (await request.json()) as HistorialPayload
    const observaciones = payload.observaciones?.trim() ?? ''
    const valorNuevo = payload.valor_nuevo?.trim() ?? ''

    if (!payload.tarea_id || !payload.tipo_cambio) {
      return NextResponse.json({ ok: false, error: 'Faltan datos de la tarea o del tipo de cambio.' }, { status: 400 })
    }

    if (!observaciones && !valorNuevo) {
      return NextResponse.json({ ok: false, error: 'Escribe una observacion o un valor nuevo.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const primaryTask = await admin
      .from('tareas')
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, responsable_usuario_id, asignado_por_usuario_id, asignado_por_nombre, fecha_fin')
      .eq('id', payload.tarea_id)
      .maybeSingle()
    const fallbackTask =
      primaryTask.error && (isTaskScopeColumnError(primaryTask.error) || isMissingAssignmentOwnerColumn(primaryTask.error))
        ? await admin
            .from('tareas')
            .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin')
            .eq('id', payload.tarea_id)
            .maybeSingle()
        : primaryTask
    const { data: taskData, error: taskError } = fallbackTask

    if (taskError) throw taskError
    if (!taskData) {
      return NextResponse.json({ ok: false, error: 'La tarea no existe.' }, { status: 404 })
    }

    const task = taskData as TaskRow
    const scope = buildTaskScope(user, profile)
    const isManager = hasAnyRole(profile, MANAGER_ROLE_CODES)
    const isAssignedByUserId = !!task.responsable_usuario_id && task.responsable_usuario_id === user.id
    const isAssignedByName = !!task.responsable && scope.assignedNames.includes(task.responsable)
    const isAssignedByAssignment = await isUserAssignedToTask(admin, task.id, user.id)

    if (!isManager && !isAssignedByUserId && !isAssignedByName && !isAssignedByAssignment) {
      return NextResponse.json({ ok: false, error: 'Solo puedes actualizar tareas asignadas a tu usuario.' }, { status: 403 })
    }

    if (task.estado === 'Completado' || task.estado === 'Cancelado') {
      return NextResponse.json({ ok: false, error: 'La tarea ya esta cerrada y no acepta nuevas entradas.' }, { status: 409 })
    }

    const userLabel = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Usuario'
    const progressFromValue = parseProgress(valorNuevo)
    const shouldComplete = isFinalization(payload)
    const nextProgress = shouldComplete ? 100 : progressFromValue ?? Math.min(Number(task.porcentaje_avance ?? 0) + 10, 95)

    const { error: insertError } = await admin.from('historial').insert({
      fecha: new Date().toISOString(),
      usuario: userLabel,
      tarea_id: task.id,
      tarea_nombre: task.tarea,
      modulo: 'Agenda de Control',
      tipo_cambio: payload.tipo_cambio,
      valor_anterior: shouldComplete ? task.estado : `${task.porcentaje_avance ?? 0}%`,
      valor_nuevo: shouldComplete ? 'Completado' : valorNuevo || `${nextProgress}%`,
      observaciones: observaciones || null,
    })

    if (insertError) throw insertError

    const updatePayload = {
      porcentaje_avance: nextProgress,
      estado: shouldComplete ? 'Completado' : task.estado,
      ultima_actualizacion: new Date().toISOString(),
    }

    const updateResult = await admin
      .from('tareas')
      .update(updatePayload)
      .eq('id', task.id)
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, responsable_usuario_id, asignado_por_usuario_id, asignado_por_nombre, fecha_fin')
      .single()
    const fallbackUpdate =
      updateResult.error && isMissingAssignmentOwnerColumn(updateResult.error)
        ? await admin
            .from('tareas')
            .update(updatePayload)
            .eq('id', task.id)
            .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin')
            .single()
        : updateResult
    const { data: updatedTask, error: updateError } = fallbackUpdate

    if (updateError) throw updateError

    if (isAssignedByUserId || isAssignedByName || isAssignedByAssignment) {
      await markCurrentUserAssignmentHandled(admin, task.id, user.id)
    }

    if (shouldComplete) {
      await notifyAdminsTaskCompleted(admin, updatedTask as TaskRow, userLabel)
    }

    return NextResponse.json({ ok: true, task: updatedTask })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo registrar el historial.',
      },
      { status: 500 }
    )
  }
}
