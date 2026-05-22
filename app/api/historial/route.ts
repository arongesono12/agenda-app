import { NextResponse } from 'next/server'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile, getOrganismoIdFromRequest, getRoleCodeFromRequest } from '@/lib/server-access'
import { buildTaskScope, isTaskScopeColumnError } from '@/lib/task-scope'
import type { Estado, TipoOrden } from '@/lib/types'

export const dynamic = 'force-dynamic'

type HistorialPayload = {
  id?: number
  tarea_id?: number
  tipo_cambio?: TipoOrden
  valor_nuevo?: string | null
  observaciones?: string | null
  finalizar?: boolean
  motivo_eliminacion?: string | null
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
  organismo_id?: string | null
}

type AssignmentRow = {
  id: number
  tarea_id: number
  responsable_usuario_id: string | null
  responsable_nombre: string
  estado?: Estado | null
  porcentaje_avance?: number | null
  activo?: boolean | null
}

type AdminRecipient = {
  id: string
  email: string
  nombre_completo: string | null
}

type HistoryRow = {
  id: number
  tarea_id: number | null
  actor_usuario_id?: string | null
  eliminado_at?: string | null
  organismo_id?: string | null
}

const EDITABLE_HISTORY_TYPES = new Set<TipoOrden>(['Orden', 'Nota', 'Avance', 'Cambio de Estado', 'Incidencia', 'Recordatorio'])

function canUseHistory(activeRoleCode: string) {
  return [...MANAGER_ROLE_CODES, 'responsable'].includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number] | 'responsable')
}

function isManagerRole(activeRoleCode: string) {
  return MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])
}

function isAdminRole(activeRoleCode: string) {
  return ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])
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

async function loadTaskAssignments(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number
) {
  const result = await admin
    .from('tarea_asignaciones')
    .select('id, tarea_id, responsable_usuario_id, responsable_nombre, estado, porcentaje_avance, activo')
    .eq('tarea_id', taskId)
    .eq('activo', true)

  if (!result.error) return (result.data ?? []) as unknown as AssignmentRow[]
  if (isMissingTaskAssignmentsTable(result.error)) return []
  if (!isMissingAssignmentProgressColumn(result.error)) throw result.error

  const fallback = await admin
    .from('tarea_asignaciones')
    .select('id, tarea_id, responsable_usuario_id, responsable_nombre, activo')
    .eq('tarea_id', taskId)
    .eq('activo', true)

  if (fallback.error) {
    if (isMissingTaskAssignmentsTable(fallback.error)) return []
    throw fallback.error
  }

  return ((fallback.data ?? []) as unknown as AssignmentRow[]).map((assignment) => ({
    ...assignment,
    estado: 'Pendiente',
    porcentaje_avance: 0,
  }))
}

async function updateAssignmentProgress(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  assignmentId: number,
  progress: number,
  completed: boolean
) {
  const payload = {
    porcentaje_avance: progress,
    estado: completed ? 'Completado' : progress > 0 ? 'En Proceso' : 'Pendiente',
    completado_at: completed ? new Date().toISOString() : null,
  }

  const { error } = await admin
    .from('tarea_asignaciones')
    .update(payload)
    .eq('id', assignmentId)

  if (error) {
    if (isMissingAssignmentProgressColumn(error)) return false
    throw error
  }

  return true
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

async function loadAdminRecipients(admin: ReturnType<typeof createAdminSupabaseClient>, organismoId: string | null) {
  if (!organismoId) return []

  const { data: miembros, error: miembrosError } = await admin
    .from('organismo_miembros')
    .select('usuario_id, rol_codigo')
    .eq('organismo_id', organismoId)
    .eq('activo', true)

  if (miembrosError) throw miembrosError

  const adminIds = (miembros ?? [])
    .filter((miembro) =>
      ADMIN_ROLE_CODES.includes((miembro.rol_codigo ?? '').toLowerCase() as (typeof ADMIN_ROLE_CODES)[number])
    )
    .map((miembro) => miembro.usuario_id)
    .filter((id): id is string => !!id)

  if (adminIds.length === 0) return []

  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, email, nombre_completo')
    .in('id', adminIds)

  if (error) throw error

  return ((data ?? []) as AdminRecipient[]).map((profile) => ({
    id: profile.id,
    email: profile.email,
    nombre_completo: profile.nombre_completo,
  }))
}

function isMissingAssignmentProgressColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /estado|porcentaje_avance|completado_at|column .* does not exist|schema cache/i.test(message)
  )
}

function isAlertTypeConstraintError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return error?.code === '23514' && /alertas_tipo_alerta_check|tipo_alerta/i.test(message)
}

async function loadHistoryRows({
  admin,
  organismoId,
  taskId,
  taskIds,
  from,
  to,
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  organismoId: string
  taskId?: number
  taskIds?: number[]
  from: number
  to: number
}) {
  let query = admin
    .from('historial')
    .select('*', { count: 'exact' })

  if (taskId) query = query.eq('tarea_id', taskId)
  if (taskIds?.length) query = query.in('tarea_id', taskIds)

  return query
    .is('eliminado_at', null)
    .eq('organismo_id', organismoId)
    .order('fecha', { ascending: false })
    .range(from, to)
}

async function notifyAdminsTaskCompleted(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  task: TaskRow,
  userLabel: string
) {
  const recipients = await loadAdminRecipients(admin, task.organismo_id ?? null)

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
          organismo_id: task.organismo_id ?? null,
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
      .eq('organismo_id', task.organismo_id ?? '')
  }
}

async function markCurrentUserAssignmentHandled(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number,
  userId: string,
  organismoId?: string | null
) {
  let query = admin
    .from('alertas')
    .update({ leida: true })
    .eq('tarea_id', taskId)
    .eq('destinatario_usuario_id', userId)
    .eq('tipo_alerta', 'Asignada')
    .eq('leida', false)
  if (organismoId) {
    query = query.eq('organismo_id', organismoId)
  }
  const { error } = await query

  if (error) throw error
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !canUseHistory(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar historial.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const organismoId = getOrganismoIdFromRequest(request)
    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'No hay organismo activo.' }, { status: 400 })
    }
    const taskId = Number(url.searchParams.get('tarea_id'))
    const page = toPositiveInt(url.searchParams.get('page'), 0)
    const pageSize = toPositiveInt(url.searchParams.get('pageSize'), 25, 100)
    const from = page * pageSize
    const to = from + pageSize - 1
    const admin = createAdminSupabaseClient()
    const isManager = isManagerRole(activeRoleCode)

    if (Number.isInteger(taskId) && taskId > 0) {
      if (!isManager) {
        const taskResult = await admin
          .from('tareas')
          .select('id, responsable, responsable_usuario_id, organismo_id')
          .eq('id', taskId)
          .eq('organismo_id', organismoId)
          .maybeSingle()
        const fallbackTask =
          taskResult.error && isTaskScopeColumnError(taskResult.error)
            ? await admin.from('tareas').select('id, responsable, organismo_id').eq('id', taskId).eq('organismo_id', organismoId).maybeSingle()
            : taskResult
        const { data: task, error: taskError } = fallbackTask

        if (taskError) throw taskError
        if (!task) return NextResponse.json({ ok: false, error: 'La tarea no existe.' }, { status: 404 })

        const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)
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

      const { data, count, error } = await loadHistoryRows({
        admin,
        organismoId,
        taskId,
        from,
        to,
      })

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
      const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)
      const assignedIds = new Set(await loadAssignedTaskIds(admin, user.id))
      let primaryTaskQuery = admin.from('tareas').select('id').eq('responsable_usuario_id', user.id)
      if (organismoId) primaryTaskQuery = primaryTaskQuery.eq('organismo_id', organismoId)
      const primaryTasks = await primaryTaskQuery
      const fallbackTasks =
        primaryTasks.error && isTaskScopeColumnError(primaryTasks.error) && scope.assignedNames.length
          ? await (organismoId
              ? admin.from('tareas').select('id').in('responsable', scope.assignedNames).eq('organismo_id', organismoId)
              : admin.from('tareas').select('id').in('responsable', scope.assignedNames))
          : primaryTasks

      if (fallbackTasks.error) throw fallbackTasks.error

      for (const task of fallbackTasks.data ?? []) assignedIds.add(Number(task.id))

      const taskIds = Array.from(assignedIds)
      if (taskIds.length === 0) {
        return NextResponse.json({ ok: true, rows: [], total: 0, page, pageSize, totalPages: 0 })
      }

      const { data, count, error } = await loadHistoryRows({
        admin,
        organismoId,
        taskIds,
        from,
        to,
      })

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

    const { data, count, error } = await loadHistoryRows({
      admin,
      organismoId,
      from,
      to,
    })

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
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !canUseHistory(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para registrar historial.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'No hay organismo activo.' }, { status: 400 })
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
    let primaryTaskQuery = admin
      .from('tareas')
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, responsable_usuario_id, asignado_por_usuario_id, asignado_por_nombre, fecha_fin, organismo_id')
      .eq('id', payload.tarea_id)
    if (organismoId) primaryTaskQuery = primaryTaskQuery.eq('organismo_id', organismoId)
    const primaryTask = await primaryTaskQuery.maybeSingle()
    const fallbackTask =
      primaryTask.error && (isTaskScopeColumnError(primaryTask.error) || isMissingAssignmentOwnerColumn(primaryTask.error))
        ? await (organismoId
            ? admin
                .from('tareas')
                .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin, organismo_id')
                .eq('id', payload.tarea_id)
                .eq('organismo_id', organismoId)
                .maybeSingle()
            : admin
                .from('tareas')
                .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin, organismo_id')
                .eq('id', payload.tarea_id)
                .maybeSingle())
        : primaryTask
    const { data: taskData, error: taskError } = fallbackTask

    if (taskError) throw taskError
    if (!taskData) {
      return NextResponse.json({ ok: false, error: 'La tarea no existe.' }, { status: 404 })
    }

    const task = taskData as TaskRow
    const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)
    const isManager = isManagerRole(activeRoleCode)
    const isAssignedByUserId = !!task.responsable_usuario_id && task.responsable_usuario_id === user.id
    const isAssignedByName = !!task.responsable && scope.assignedNames.includes(task.responsable)
    const assignments = await loadTaskAssignments(admin, task.id)
    const currentAssignment = assignments.find((assignment) => assignment.responsable_usuario_id === user.id) ?? null
    const isAssignedByAssignment = !!currentAssignment

    if (!isManager && !isAssignedByUserId && !isAssignedByName && !isAssignedByAssignment) {
      return NextResponse.json({ ok: false, error: 'Solo puedes actualizar tareas asignadas a tu usuario.' }, { status: 403 })
    }

    if (task.estado === 'Completado' || task.estado === 'Cancelado') {
      return NextResponse.json({ ok: false, error: 'La tarea ya esta cerrada y no acepta nuevas entradas.' }, { status: 409 })
    }

    const userLabel = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Usuario'
    const progressFromValue = parseProgress(valorNuevo)
    const shouldComplete = isFinalization(payload)
    const hasAssignments = assignments.length > 0

    if (hasAssignments && !currentAssignment && shouldComplete) {
      return NextResponse.json(
        { ok: false, error: 'Solo cada responsable asignado puede completar su propia parte de la tarea.' },
        { status: 403 }
      )
    }

    const currentAssignmentProgress = Number(currentAssignment?.porcentaje_avance ?? task.porcentaje_avance ?? 0)
    const nextOwnProgress = shouldComplete ? 100 : progressFromValue ?? Math.min(currentAssignmentProgress + 10, 95)

    const nextAssignmentStates = assignments.map((assignment) => {
      if (currentAssignment && assignment.id === currentAssignment.id) {
        return {
          ...assignment,
          porcentaje_avance: nextOwnProgress,
          estado: shouldComplete ? 'Completado' : nextOwnProgress > 0 ? 'En Proceso' : 'Pendiente',
        }
      }
      return assignment
    })
    const nextProgress = hasAssignments
      ? Math.round(
          nextAssignmentStates.reduce((acc, assignment) => acc + Number(assignment.porcentaje_avance ?? 0), 0) /
            nextAssignmentStates.length
        )
      : shouldComplete
        ? 100
        : progressFromValue ?? Math.min(Number(task.porcentaje_avance ?? 0) + 10, 95)
    const allAssignmentsCompleted =
      hasAssignments &&
      nextAssignmentStates.every((assignment) => assignment.estado === 'Completado' || Number(assignment.porcentaje_avance ?? 0) >= 100)
    const shouldCloseTask = hasAssignments ? allAssignmentsCompleted : shouldComplete
    const nextTaskState = shouldCloseTask ? 'Completado' : nextProgress > 0 && task.estado === 'Pendiente' ? 'En Proceso' : task.estado

    const historyInsert = {
      fecha: new Date().toISOString(),
      usuario: userLabel,
      actor_usuario_id: user.id,
      actor_rol_codigo: activeRoleCode,
      tarea_id: task.id,
      tarea_nombre: task.tarea,
      modulo: 'Agenda de Control',
      tipo_cambio: payload.tipo_cambio,
      valor_anterior: shouldComplete ? (hasAssignments ? `${currentAssignmentProgress}%` : task.estado) : `${currentAssignmentProgress}%`,
      valor_nuevo: shouldComplete
        ? hasAssignments
          ? `Parte completada por ${userLabel}`
          : 'Completado'
        : valorNuevo || `${nextOwnProgress}%`,
      observaciones: observaciones || null,
      ...(organismoId ? { organismo_id: organismoId } : {}),
    }

    const { error: insertError } = await admin.from('historial').insert(historyInsert)

    if (insertError) throw insertError

    if (currentAssignment) {
      await updateAssignmentProgress(admin, currentAssignment.id, nextOwnProgress, shouldComplete)
    }

    const updatePayload = {
      porcentaje_avance: nextProgress,
      estado: nextTaskState,
      ultima_actualizacion: new Date().toISOString(),
    }

    const updateResult = await admin
      .from('tareas')
      .update(updatePayload)
      .eq('id', task.id)
      .eq('organismo_id', organismoId)
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, responsable_usuario_id, asignado_por_usuario_id, asignado_por_nombre, fecha_fin, organismo_id')
      .single()
    const fallbackUpdate =
      updateResult.error && isMissingAssignmentOwnerColumn(updateResult.error)
        ? await admin
            .from('tareas')
            .update(updatePayload)
            .eq('id', task.id)
            .eq('organismo_id', organismoId)
            .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin, organismo_id')
            .single()
        : updateResult
    const { data: updatedTask, error: updateError } = fallbackUpdate

    if (updateError) throw updateError

    if (isAssignedByUserId || isAssignedByName || isAssignedByAssignment) {
      await markCurrentUserAssignmentHandled(admin, task.id, user.id, organismoId)
    }

    if (shouldCloseTask) {
      try {
        await notifyAdminsTaskCompleted(admin, updatedTask as TaskRow, userLabel)
      } catch (notificationError) {
        console.error('No se pudo notificar la finalizacion de la tarea', notificationError)
      }
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

export async function PATCH(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || activeRoleCode !== 'supervisor') {
      return NextResponse.json({ ok: false, error: 'Solo los supervisores pueden editar sus propias entradas de historial.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'No hay organismo activo.' }, { status: 400 })
    }

    const payload = (await request.json()) as HistorialPayload
    if (!Number.isInteger(payload.id) || Number(payload.id) <= 0) {
      return NextResponse.json({ ok: false, error: 'ID de historial invalido.' }, { status: 400 })
    }

    const updates: Partial<Pick<HistorialPayload, 'tipo_cambio' | 'valor_nuevo' | 'observaciones'>> & {
      editado_at: string
      editado_por_usuario_id: string
    } = {
      editado_at: new Date().toISOString(),
      editado_por_usuario_id: user.id,
    }

    if (typeof payload.tipo_cambio === 'string') {
      if (!EDITABLE_HISTORY_TYPES.has(payload.tipo_cambio)) {
        return NextResponse.json({ ok: false, error: 'Tipo de cambio invalido.' }, { status: 400 })
      }
      updates.tipo_cambio = payload.tipo_cambio
    }
    if ('valor_nuevo' in payload) updates.valor_nuevo = payload.valor_nuevo?.trim() || null
    if ('observaciones' in payload) updates.observaciones = payload.observaciones?.trim() || null

    const hasEditableChange =
      'tipo_cambio' in updates || 'valor_nuevo' in updates || 'observaciones' in updates
    if (!hasEditableChange) {
      return NextResponse.json({ ok: false, error: 'No hay cambios para guardar.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: row, error: rowError } = await admin
      .from('historial')
      .select('id, tarea_id, actor_usuario_id, eliminado_at, organismo_id')
      .eq('id', Number(payload.id))
      .maybeSingle()

    if (rowError) throw rowError
    const history = row as HistoryRow | null
    if (!history || history.eliminado_at) {
      return NextResponse.json({ ok: false, error: 'Entrada de historial no encontrada.' }, { status: 404 })
    }

    if (history.actor_usuario_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Solo puedes editar las entradas que agregaste.' }, { status: 403 })
    }

    if (history.organismo_id && history.organismo_id !== organismoId) {
      return NextResponse.json({ ok: false, error: 'La entrada no pertenece al organismo activo.' }, { status: 403 })
    }

    if (!history.organismo_id && history.tarea_id) {
      const { data: task, error: taskError } = await admin
        .from('tareas')
        .select('id')
        .eq('id', history.tarea_id)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (taskError) throw taskError
      if (!task) return NextResponse.json({ ok: false, error: 'La entrada no pertenece al organismo activo.' }, { status: 403 })
    }

    const { data, error } = await admin
      .from('historial')
      .update(updates)
      .eq('id', Number(payload.id))
      .select('*')
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ ok: true, row: data })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo editar el historial.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !isAdminRole(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'Solo los administradores pueden eliminar entradas de historial.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'No hay organismo activo.' }, { status: 400 })
    }

    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'ID de historial invalido.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: row, error: rowError } = await admin
      .from('historial')
      .select('id, tarea_id, eliminado_at, organismo_id')
      .eq('id', id)
      .maybeSingle()

    if (rowError) throw rowError
    const history = row as HistoryRow | null
    if (!history || history.eliminado_at) {
      return NextResponse.json({ ok: false, error: 'Entrada de historial no encontrada.' }, { status: 404 })
    }

    if (history.organismo_id && history.organismo_id !== organismoId) {
      return NextResponse.json({ ok: false, error: 'La entrada no pertenece al organismo activo.' }, { status: 403 })
    }

    if (!history.organismo_id && history.tarea_id) {
      const { data: task, error: taskError } = await admin
        .from('tareas')
        .select('id')
        .eq('id', history.tarea_id)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (taskError) throw taskError
      if (!task) return NextResponse.json({ ok: false, error: 'La entrada no pertenece al organismo activo.' }, { status: 403 })
    }

    const motivo = url.searchParams.get('motivo')?.trim() || null
    const { error } = await admin
      .from('historial')
      .update({
        eliminado_at: new Date().toISOString(),
        eliminado_por_usuario_id: user.id,
        motivo_eliminacion: motivo,
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo eliminar el historial.',
      },
      { status: 500 }
    )
  }
}
