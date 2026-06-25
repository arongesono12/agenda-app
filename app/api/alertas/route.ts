import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

function toPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

async function loadAssignedTaskIds(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  organismoId: string
) {
  const taskIds = new Set<number>()

  const { data: assignments, error: assignmentError } = await admin
    .from('tarea_asignaciones')
    .select('tarea_id')
    .eq('responsable_usuario_id', userId)
    .eq('activo', true)

  if (assignmentError && !/tarea_asignaciones|schema cache|relation .* does not exist/i.test(assignmentError.message ?? '')) {
    throw assignmentError
  }

  for (const assignment of assignments ?? []) {
    const id = Number(assignment.tarea_id)
    if (Number.isInteger(id) && id > 0) taskIds.add(id)
  }

  let legacyQuery = admin.from('tareas').select('id').eq('responsable_usuario_id', userId)
  if (organismoId) legacyQuery = legacyQuery.eq('organismo_id', organismoId)
  const { data: legacyTasks, error: legacyError } = await legacyQuery

  if (!legacyError) {
    for (const task of legacyTasks ?? []) {
      const id = Number(task.id)
      if (Number.isInteger(id) && id > 0) taskIds.add(id)
    }
  }

  return Array.from(taskIds)
}

async function enrichAssignmentAlerts(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  alertas: Array<Record<string, unknown>>
) {
  const assignmentAlerts = alertas.filter((alerta) => alerta.tipo_alerta === 'Asignada' && alerta.tarea_id)
  const taskIds = Array.from(new Set(assignmentAlerts.map((alerta) => Number(alerta.tarea_id)).filter(Number.isInteger)))
  const assignmentMap = new Map<string, { asignado_a?: string | null; asignado_a_email?: string | null; asignado_por?: string | null }>()

  if (taskIds.length === 0) return alertas

  const { data: assignments } = await admin
    .from('tarea_asignaciones')
    .select('tarea_id, responsable_usuario_id, responsable_nombre, responsable_email, asignado_por_nombre')
    .in('tarea_id', taskIds)

  for (const assignment of assignments ?? []) {
    const row = assignment as {
      tarea_id?: number | null
      responsable_usuario_id?: string | null
      responsable_nombre?: string | null
      responsable_email?: string | null
      asignado_por_nombre?: string | null
    }
    if (!row.tarea_id || !row.responsable_usuario_id) continue
    assignmentMap.set(`${row.tarea_id}:${row.responsable_usuario_id}`, {
      asignado_a: row.responsable_nombre ?? null,
      asignado_a_email: row.responsable_email ?? null,
      asignado_por: row.asignado_por_nombre ?? null,
    })
  }

  const missingTaskIds = assignmentAlerts
    .filter((alerta) => !assignmentMap.has(`${alerta.tarea_id}:${alerta.destinatario_usuario_id}`))
    .map((alerta) => Number(alerta.tarea_id))
    .filter(Number.isInteger)

  if (missingTaskIds.length > 0) {
    const { data: tasks } = await admin
      .from('tareas')
      .select('id, responsable, responsable_usuario_id, asignado_por_nombre')
      .in('id', Array.from(new Set(missingTaskIds)))

    for (const task of tasks ?? []) {
      const row = task as {
        id?: number | null
        responsable?: string | null
        responsable_usuario_id?: string | null
        asignado_por_nombre?: string | null
      }
      if (!row.id || !row.responsable_usuario_id) continue
      assignmentMap.set(`${row.id}:${row.responsable_usuario_id}`, {
        asignado_a: row.responsable ?? null,
        asignado_a_email: null,
        asignado_por: row.asignado_por_nombre ?? null,
      })
    }
  }

  return alertas.map((alerta) => {
    const info = alerta.tarea_id && alerta.destinatario_usuario_id
      ? assignmentMap.get(`${alerta.tarea_id}:${alerta.destinatario_usuario_id}`)
      : null
    return {
      ...alerta,
      asignado_a: info?.asignado_a ?? alerta.destinatario_email ?? null,
      asignado_a_email: info?.asignado_a_email ?? alerta.destinatario_email ?? null,
      asignado_por: info?.asignado_por ?? null,
    }
  })
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = toPositiveInt(url.searchParams.get('limit'), 8, 50)
    const onlyUnread = url.searchParams.get('unread') === 'true'
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    const isAdmin = ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])
    let query = admin
      .from('alertas')
      .select('id, tarea_id, tipo_alerta, titulo, mensaje, leida, created_at, destinatario_usuario_id, destinatario_email, modulo, referencia_id')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (organismoId) {
      query = query.eq('organismo_id', organismoId)
    }

    if (!isAdmin) {
      query = query.eq('destinatario_usuario_id', user.id)
      const assignedTaskIds = await loadAssignedTaskIds(admin, user.id, organismoId)
      query = assignedTaskIds.length > 0
        ? query.or(`modulo.neq.tareas,tarea_id.in.(${assignedTaskIds.join(',')})`)
        : query.neq('modulo', 'tareas')
    }

    if (onlyUnread) {
      query = query.eq('leida', false)
    }

    const { data, error } = await query

    if (error) throw error

    const alertas = await enrichAssignmentAlerts(admin, (data ?? []) as Array<Record<string, unknown>>)
    return NextResponse.json({ ok: true, alertas })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudieron consultar las alertas.' },
      { status: 500 }
    )
  }
}
