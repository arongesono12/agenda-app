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
      .select('id, tarea_id, tipo_alerta, titulo, mensaje, leida, created_at, destinatario_usuario_id, modulo, referencia_id')
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

    return NextResponse.json({ ok: true, alertas: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudieron consultar las alertas.' },
      { status: 500 }
    )
  }
}
