import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { EDITOR_ROLE_CODES, ADMIN_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

type TaskDueRow = {
  id: number
  codigo_id: number | null
  tarea: string
  prioridad: string
  departamento: string | null
  responsable: string | null
  fecha_fin: string | null
  estado: string
  responsable_usuario_id: string | null
}

type Recipient = {
  id: string
  email: string
  nombre_completo: string | null
}

type AlertRow = {
  id: number
  tarea_id: number
  destinatario_usuario_id: string
  destinatario_email: string | null
  titulo: string | null
  mensaje: string | null
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

function startOfTodayIso() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString().slice(0, 10)
}

function isCronRequest(request: Request) {
  const token = process.env.AGENDA_ALERTS_CRON_TOKEN
  const header = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!token && !!header && token === header
}

async function isAuthorized(request: Request) {
  if (isCronRequest(request)) return true

  const { user, profile } = await getServerSessionProfile()
  return !!user && hasAnyRole(profile, EDITOR_ROLE_CODES)
}

function vencimientoEmailHtml(task: TaskDueRow, recipient: Recipient) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 12px">Periodo de tarea finalizado</h2>
      <p>Hola ${escapeHtml(recipient.nombre_completo ?? recipient.email)}, el tiempo fijado para esta tarea ha terminado.</p>
      <div style="border:1px solid #fecdd3;border-radius:12px;padding:16px;margin:18px 0;background:#fff1f2">
        <p style="margin:0 0 8px"><strong>Tarea:</strong> ${escapeHtml(task.tarea)}</p>
        <p style="margin:0 0 8px"><strong>Responsable:</strong> ${escapeHtml(task.responsable ?? 'Sin responsable')}</p>
        <p style="margin:0 0 8px"><strong>Prioridad:</strong> ${escapeHtml(task.prioridad)}</p>
        <p style="margin:0"><strong>Fecha fin:</strong> ${escapeHtml(task.fecha_fin ?? 'Sin fecha')}</p>
      </div>
      <p>Revisa la agenda para cerrar, actualizar o reprogramar la tarea.</p>
    </div>
  `
}

async function loadAdminRecipients(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, email, nombre_completo, tipo_usuario:tipos_usuario(codigo)')

  if (error) throw error

  return ((data ?? []) as Array<Recipient & { tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null }>)
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

async function loadResponsibleRecipient(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string | null
) {
  if (!userId) return null

  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, email, nombre_completo')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Recipient | null
}

async function createAlertsForTask(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  task: TaskDueRow,
  adminRecipients: Recipient[]
) {
  const responsible = await loadResponsibleRecipient(admin, task.responsable_usuario_id)
  const recipients = new Map<string, Recipient>()

  if (responsible) recipients.set(responsible.id, responsible)
  adminRecipients.forEach((adminRecipient) => recipients.set(adminRecipient.id, adminRecipient))

  const rows = [...recipients.values()].map((recipient) => ({
    tarea_id: task.id,
    tipo_alerta: 'Vencida',
    fecha_alerta: startOfTodayIso(),
    destinatario_usuario_id: recipient.id,
    destinatario_email: normalizeEmail(recipient.email),
    titulo: 'Periodo de tarea finalizado',
    mensaje: `Finalizo el tiempo fijado para la tarea "${task.tarea}".`,
    alerta_key: `vencimiento:${task.id}:${recipient.id}`,
  }))

  if (rows.length === 0) return []

  const { data, error } = await admin
    .from('alertas')
    .upsert(rows, { onConflict: 'alerta_key', ignoreDuplicates: true })
    .select('id, tarea_id, destinatario_usuario_id, destinatario_email, titulo, mensaje')

  if (error) throw error
  return (data ?? []) as AlertRow[]
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para procesar vencimientos.' }, { status: 403 })
    }

    const admin = createAdminSupabaseClient()
    const today = startOfTodayIso()
    const { data: tasks, error } = await admin
      .from('tareas')
      .select('id, codigo_id, tarea, prioridad, departamento, responsable, fecha_fin, estado, responsable_usuario_id')
      .lte('fecha_fin', today)
      .not('estado', 'in', '("Completado","Cancelado")')

    if (error) throw error

    const adminRecipients = await loadAdminRecipients(admin)
    let createdAlerts = 0
    let sentEmails = 0
    let emailErrors = 0

    for (const task of (tasks ?? []) as TaskDueRow[]) {
      const alerts = await createAlertsForTask(admin, task, adminRecipients)
      createdAlerts += alerts.length

      for (const alert of alerts) {
        const email = normalizeEmail(alert.destinatario_email)

        if (!email) continue

        const result = await sendAgendaEmail({
          to: email,
          subject: `Tarea vencida: ${task.tarea}`,
          html: vencimientoEmailHtml(task, {
            id: alert.destinatario_usuario_id,
            email,
            nombre_completo: null,
          }),
          text: `Finalizo el tiempo fijado para la tarea "${task.tarea}". Fecha fin: ${task.fecha_fin ?? 'Sin fecha'}`,
        })

        await admin
          .from('alertas')
          .update({
            enviada_email_at: result.ok ? new Date().toISOString() : null,
            email_error: result.ok ? null : result.error,
          })
          .eq('id', alert.id)

        if (result.ok) sentEmails += 1
        else emailErrors += 1
      }
    }

    return NextResponse.json({
      ok: true,
      processedTasks: tasks?.length ?? 0,
      createdAlerts,
      sentEmails,
      emailErrors,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron procesar los vencimientos.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}
