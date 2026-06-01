import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

type Payload = {
  id?: number
  all?: boolean
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

export async function PATCH(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })
    }

    const payload = (await request.json()) as Payload
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    const isAdmin = ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])
    const assignedTaskIds = isAdmin ? [] : await loadAssignedTaskIds(admin, user.id, organismoId)

    if (payload.all === true) {
      let query = admin
        .from('alertas')
        .update({ leida: true })
        .eq('leida', false)
      if (!isAdmin) {
        query = query.eq('destinatario_usuario_id', user.id)
        query = assignedTaskIds.length > 0 ? query.in('tarea_id', assignedTaskIds) : query.eq('id', -1)
      }
      if (organismoId) query = query.eq('organismo_id', organismoId)
      const { error } = await query

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (payload.id) {
      let query = admin
        .from('alertas')
        .update({ leida: true })
        .eq('id', payload.id)
      if (!isAdmin) {
        query = query.eq('destinatario_usuario_id', user.id)
        query = assignedTaskIds.length > 0 ? query.in('tarea_id', assignedTaskIds) : query.eq('id', -1)
      }
      if (organismoId) query = query.eq('organismo_id', organismoId)
      const { error } = await query

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { ok: false, error: 'Debes indicar un id o all:true.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al marcar alerta.' },
      { status: 500 }
    )
  }
}
