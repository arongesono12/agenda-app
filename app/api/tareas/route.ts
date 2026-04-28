import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { EDITOR_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

type TaskPayload = {
  id?: number
  codigo_id?: number | null
  tarea?: string
  prioridad?: string
  estado?: string
  departamento?: string | null
  seccion?: string | null
  responsable?: string | null
  responsable_id?: number | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  porcentaje_avance?: number
  tipo_tarea?: string | null
  notas?: string | null
  ultima_actualizacion?: string
}

type ResponsableRow = {
  id: number
  nombre: string
  email: string | null
  usuario_id: string | null
}

type TaskRow = TaskPayload & {
  id: number
  responsable_usuario_id?: string | null
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

async function resolveResponsable(admin: ReturnType<typeof createAdminSupabaseClient>, payload: TaskPayload) {
  if (!payload.responsable_id && !payload.responsable?.trim()) {
    return null
  }

  let responsable: ResponsableRow | null = null

  if (payload.responsable_id) {
    const { data, error } = await admin
      .from('responsables')
      .select('id, nombre, email, usuario_id')
      .eq('id', payload.responsable_id)
      .maybeSingle()

    if (error) throw error
    responsable = data as ResponsableRow | null
  } else if (payload.responsable?.trim()) {
    const { data, error } = await admin
      .from('responsables')
      .select('id, nombre, email, usuario_id')
      .eq('nombre', payload.responsable.trim())
      .maybeSingle()

    if (error) throw error
    responsable = data as ResponsableRow | null
  }

  if (!responsable) {
    throw new Error('Selecciona un responsable registrado en Catalogos.')
  }

  const email = normalizeEmail(responsable.email)

  if (!responsable.usuario_id && email) {
    const { data: profile, error } = await admin
      .from('perfiles_usuario')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (error) throw error

    if (profile?.id) {
      responsable.usuario_id = profile.id
      await admin.from('responsables').update({ usuario_id: profile.id }).eq('id', responsable.id)
    }
  }

  if (!responsable.usuario_id) {
    throw new Error('El responsable seleccionado debe tener un usuario de la aplicacion asociado a su correo.')
  }

  return responsable
}

function buildTaskPayload(payload: TaskPayload, responsable: ResponsableRow | null) {
  return {
    codigo_id:
      payload.codigo_id !== undefined && payload.codigo_id !== null && `${payload.codigo_id}` !== ''
        ? Number(payload.codigo_id)
        : null,
    tarea: payload.tarea?.trim(),
    prioridad: payload.prioridad,
    estado: payload.estado,
    departamento: payload.departamento || null,
    seccion: payload.seccion || null,
    responsable: responsable?.nombre ?? null,
    responsable_id: responsable?.id ?? null,
    responsable_usuario_id: responsable?.usuario_id ?? null,
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    porcentaje_avance: Number(payload.porcentaje_avance ?? 0),
    tipo_tarea: payload.tipo_tarea || null,
    notas: payload.notas || null,
    ultima_actualizacion: new Date().toISOString(),
  }
}

function assignmentEmailHtml(task: TaskRow, responsable: ResponsableRow) {
  const fechaFin = task.fecha_fin ? escapeHtml(task.fecha_fin) : 'Sin fecha fin'

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 12px">Nueva tarea asignada</h2>
      <p>Hola ${escapeHtml(responsable.nombre)}, tienes una nueva tarea en la agenda.</p>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:18px 0;background:#f8fafc">
        <p style="margin:0 0 8px"><strong>Tarea:</strong> ${escapeHtml(task.tarea)}</p>
        <p style="margin:0 0 8px"><strong>Prioridad:</strong> ${escapeHtml(task.prioridad)}</p>
        <p style="margin:0"><strong>Fecha fin:</strong> ${fechaFin}</p>
      </div>
      <p>Entra en la aplicacion para revisar detalles y actualizar el avance.</p>
    </div>
  `
}

async function notifyAssignment(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  task: TaskRow,
  responsable: ResponsableRow | null
) {
  if (!responsable?.usuario_id) return

  const title = 'Nueva tarea asignada'
  const message = `Se te asigno la tarea "${task.tarea}".`
  const { data: alert, error } = await admin
    .from('alertas')
    .insert({
      tarea_id: task.id,
      tipo_alerta: 'Asignada',
      destinatario_usuario_id: responsable.usuario_id,
      destinatario_email: normalizeEmail(responsable.email),
      titulo: title,
      mensaje: message,
      alerta_key: `asignada:${task.id}:${responsable.usuario_id}:${Date.now()}`,
    })
    .select('id')
    .single()

  if (error) throw error

  const email = normalizeEmail(responsable.email)
  if (!email) return

  const emailResult = await sendAgendaEmail({
    to: email,
    subject: `Nueva tarea asignada: ${task.tarea}`,
    html: assignmentEmailHtml(task, responsable),
    text: `${message} Fecha fin: ${task.fecha_fin ?? 'Sin fecha fin'}`,
  })

  await admin
    .from('alertas')
    .update({
      enviada_email_at: emailResult.ok ? new Date().toISOString() : null,
      email_error: emailResult.ok ? null : emailResult.error,
    })
    .eq('id', alert.id)
}

async function saveTask(request: Request, mode: 'create' | 'update') {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, EDITOR_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para guardar tareas.' }, { status: 403 })
    }

    const payload = (await request.json()) as TaskPayload

    if (!payload.tarea?.trim()) {
      return NextResponse.json({ ok: false, error: 'La tarea es obligatoria.' }, { status: 400 })
    }

    if (mode === 'update' && !payload.id) {
      return NextResponse.json({ ok: false, error: 'Falta el identificador de la tarea.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const responsable = await resolveResponsable(admin, payload)
    const taskPayload = buildTaskPayload(payload, responsable)
    let previousResponsibleUserId: string | null = null
    let task: TaskRow

    if (mode === 'update') {
      const { data: previous, error: previousError } = await admin
        .from('tareas')
        .select('responsable_usuario_id')
        .eq('id', payload.id)
        .maybeSingle()

      if (previousError) throw previousError
      previousResponsibleUserId = previous?.responsable_usuario_id ?? null

      const { data, error } = await admin
        .from('tareas')
        .update(taskPayload)
        .eq('id', payload.id)
        .select('*')
        .single()

      if (error) throw error
      task = data as TaskRow
    } else {
      const { data, error } = await admin.from('tareas').insert(taskPayload).select('*').single()

      if (error) throw error
      task = data as TaskRow
    }

    if (responsable && (mode === 'create' || previousResponsibleUserId !== responsable.usuario_id)) {
      await notifyAssignment(admin, task, responsable)
    }

    return NextResponse.json({ ok: true, task })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo guardar la tarea.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return saveTask(request, 'create')
}

export async function PATCH(request: Request) {
  return saveTask(request, 'update')
}
