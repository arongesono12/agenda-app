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
  fecha_fin: string | null
}

type AdminRecipient = {
  id: string
  email: string
  nombre_completo: string | null
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
  const admins = await loadAdminRecipients(admin)

  for (const recipient of admins) {
    const email = normalizeEmail(recipient.email)
    const { data: alert, error } = await admin
      .from('alertas')
      .upsert(
        {
          tarea_id: task.id,
          tipo_alerta: 'Completada',
          destinatario_usuario_id: recipient.id,
          destinatario_email: email,
          titulo: 'Tarea finalizada',
          mensaje: `${userLabel} finalizo la tarea "${task.tarea}".`,
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
      text: `${userLabel} finalizo la tarea "${task.tarea}". Revisa el historial de la agenda.`,
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
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, responsable_usuario_id, fecha_fin')
      .eq('id', payload.tarea_id)
      .maybeSingle()
    const fallbackTask =
      primaryTask.error && isTaskScopeColumnError(primaryTask.error)
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

    if (!isManager && !isAssignedByUserId && !isAssignedByName) {
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

    const { data: updatedTask, error: updateError } = await admin
      .from('tareas')
      .update(updatePayload)
      .eq('id', task.id)
      .select('id, codigo_id, tarea, estado, porcentaje_avance, responsable, fecha_fin')
      .single()

    if (updateError) throw updateError

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
