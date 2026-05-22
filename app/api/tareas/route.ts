import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getServerSessionProfile, getOrganismoIdFromRequest, getRoleCodeFromRequest } from '@/lib/server-access'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES, READER_ROLE_CODES } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'
import { applyTaskScope, buildTaskScope, isTaskScopeColumnError, type TaskScope } from '@/lib/task-scope'

export const dynamic = 'force-dynamic'

const TASK_LIST_COLUMNS = [
  'id',
  'codigo_id',
  'tarea',
  'prioridad',
  'departamento',
  'seccion',
  'responsable',
  'responsable_id',
  'responsable_usuario_id',
  'asignado_por_usuario_id',
  'asignado_por_nombre',
  'fecha_inicio',
  'fecha_fin',
  'dias_totales',
  'porcentaje_avance',
  'dias_restantes',
  'semaforo',
  'estado',
  'tipo_tarea',
  'ultima_actualizacion',
  'notas',
  'created_at',
  'updated_at',
].join(',')

const LEGACY_TASK_LIST_COLUMNS = [
  'id',
  'codigo_id',
  'tarea',
  'prioridad',
  'departamento',
  'seccion',
  'responsable',
  'fecha_inicio',
  'fecha_fin',
  'dias_totales',
  'porcentaje_avance',
  'dias_restantes',
  'semaforo',
  'estado',
  'tipo_tarea',
  'ultima_actualizacion',
  'notas',
  'created_at',
  'updated_at',
].join(',')

const MAX_PAGE_SIZE = 100
const TASK_ORDER_COLUMNS = new Set(['created_at', 'updated_at', 'fecha_fin', 'fecha_inicio', 'prioridad', 'estado', 'codigo_id'])

type TaskPayload = {
  id?: number
  codigo_id?: number | null
  tarea?: string
  prioridad?: string
  estado?: string
  departamento?: string | null
  departamentos?: string[]
  seccion?: string | null
  responsable?: string | null
  responsable_id?: number | null
  responsable_ids?: number[]
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
  departamento: string | null
  rol_codigo?: string | null
}

type TaskAssignmentRow = {
  id?: number
  tarea_id: number
  responsable_id: number | null
  responsable_usuario_id: string | null
  responsable_nombre: string
  responsable_email: string | null
  departamento: string | null
  rol_codigo: string | null
  asignado_por_usuario_id?: string | null
  asignado_por_nombre?: string | null
  estado?: string | null
  porcentaje_avance?: number | null
  completado_at?: string | null
  activo?: boolean | null
  created_at?: string | null
}

type TaskDepartmentRow = {
  id?: number
  tarea_id: number
  departamento: string
  created_at?: string | null
}

type TaskRow = TaskPayload & {
  id: number
  responsable_usuario_id?: string | null
  asignado_por_usuario_id?: string | null
  asignado_por_nombre?: string | null
}

type PreviousTaskAssignment = {
  responsable_usuario_id?: string | null
  responsable?: string | null
  departamento?: string | null
  asignado_por_usuario_id?: string | null
  asignado_por_nombre?: string | null
}

type TaskFilters = {
  q?: string
  prioridad?: string
  departamento?: string
  estado?: string
  tipo?: string
  responsable?: string
  responsableExact?: string
  fechaDesde?: string
  fechaHasta?: string
  conFechas?: boolean
  alertas?: boolean
  cronogramaDesde?: string
  cronogramaHasta?: string
}

type SupabaseFilterQuery = {
  eq(column: string, value: unknown): SupabaseFilterQuery
  in(column: string, values: unknown[]): SupabaseFilterQuery
  ilike(column: string, pattern: string): SupabaseFilterQuery
  not(column: string, operator: string, value: unknown): SupabaseFilterQuery
  lte(column: string, value: unknown): SupabaseFilterQuery
  gte(column: string, value: unknown): SupabaseFilterQuery
  lt(column: string, value: unknown): SupabaseFilterQuery
  or(filters: string): SupabaseFilterQuery
}

function toPositiveInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ')
}

function todayIso(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function readFilters(searchParams: URLSearchParams): TaskFilters {
  return {
    q: searchParams.get('q')?.trim() || undefined,
    prioridad: searchParams.get('prioridad') || undefined,
    departamento: searchParams.get('departamento') || undefined,
    estado: searchParams.get('estado') || undefined,
    tipo: searchParams.get('tipo') || undefined,
    responsable: searchParams.get('responsable') || undefined,
    responsableExact: searchParams.get('responsable_exact') || undefined,
    fechaDesde: searchParams.get('fecha_desde') || undefined,
    fechaHasta: searchParams.get('fecha_hasta') || undefined,
    conFechas: searchParams.get('con_fechas') === 'true',
    alertas: searchParams.get('alertas') === 'true',
    cronogramaDesde: searchParams.get('cronograma_desde') || undefined,
    cronogramaHasta: searchParams.get('cronograma_hasta') || undefined,
  }
}

function applyTaskFilters(
  query: SupabaseFilterQuery,
  filters: TaskFilters,
  options: { departmentTaskIds?: number[] | null } = {}
) {
  let next: SupabaseFilterQuery = query

  if (filters.prioridad) next = next.eq('prioridad', filters.prioridad)
  if (filters.departamento) {
    if (options.departmentTaskIds) {
      next = options.departmentTaskIds.length > 0 ? next.in('id', options.departmentTaskIds) : next.eq('id', -1)
    } else {
      next = next.eq('departamento', filters.departamento)
    }
  }
  if (filters.estado) next = next.eq('estado', filters.estado)
  if (filters.tipo) next = next.eq('tipo_tarea', filters.tipo)
  if (filters.responsableExact) next = next.eq('responsable', filters.responsableExact)
  else if (filters.responsable) next = next.ilike('responsable', `%${sanitizeSearchTerm(filters.responsable)}%`)
  if (filters.fechaDesde) next = next.gte('fecha_fin', filters.fechaDesde)
  if (filters.fechaHasta) next = next.lte('fecha_fin', filters.fechaHasta)
  if (filters.conFechas) {
    next = next.not('fecha_inicio', 'is', null).not('fecha_fin', 'is', null)
  }
  if (filters.alertas) {
    next = next
      .not('estado', 'in', '("Completado","Cancelado")')
      .not('fecha_fin', 'is', null)
      .lte('fecha_fin', todayIso(5))
  }
  if (filters.cronogramaDesde && filters.cronogramaHasta) {
    next = next
      .not('fecha_inicio', 'is', null)
      .not('fecha_fin', 'is', null)
      .lte('fecha_inicio', filters.cronogramaHasta)
      .gte('fecha_fin', filters.cronogramaDesde)
  }

  if (filters.q) {
    const term = sanitizeSearchTerm(filters.q)
    const numericId = Number(term)
    if (Number.isInteger(numericId)) {
      next = next.or(`tarea.ilike.%${term}%,responsable.ilike.%${term}%,id.eq.${numericId},codigo_id.eq.${numericId}`)
    } else {
      next = next.or(`tarea.ilike.%${term}%,responsable.ilike.%${term}%`)
    }
  }

  return next
}

async function countTasks(
  filters: TaskFilters & { estado?: string; prioridad?: string; fechaFinLt?: string; fechaFinGte?: string; fechaFinLte?: string },
  scope: TaskScope
) {
  const supabase = await createServerSupabaseClient()
  const admin = createAdminSupabaseClient()
  const departmentTaskIds = await loadTaskIdsForDepartment(admin, filters.departamento)

  if (!scope.unrestricted) {
    const scopedTaskIds = await loadScopedTaskIds(admin, scope)

    if (!scopedTaskIds || scopedTaskIds.length === 0) return 0

    let baseQuery = admin.from('tareas').select('id', { count: 'exact', head: true }).in('id', scopedTaskIds)
    if (scope.organismoId) baseQuery = baseQuery.eq('organismo_id', scope.organismoId)
    let query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters, { departmentTaskIds }) as unknown as typeof baseQuery

    if (filters.fechaFinLt) query = query.lt('fecha_fin', filters.fechaFinLt)
    if (filters.fechaFinGte) query = query.gte('fecha_fin', filters.fechaFinGte)
    if (filters.fechaFinLte) query = query.lte('fecha_fin', filters.fechaFinLte)

    const result = await query
    if (result.error) throw result.error
    return result.count ?? 0
  }

  const runCount = async (includeUserColumn: boolean) => {
    const baseQuery = supabase.from('tareas').select('id', { count: 'exact', head: true })
    let query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters, { departmentTaskIds }) as unknown as typeof baseQuery
    query = applyTaskScope(query as unknown as SupabaseFilterQuery, scope, { includeUserColumn }) as unknown as typeof baseQuery

    if (filters.fechaFinLt) query = query.lt('fecha_fin', filters.fechaFinLt)
    if (filters.fechaFinGte) query = query.gte('fecha_fin', filters.fechaFinGte)
    if (filters.fechaFinLte) query = query.lte('fecha_fin', filters.fechaFinLte)

    return query
  }

  const primary = await runCount(true)

  if (!primary.error || scope.unrestricted || !isTaskScopeColumnError(primary.error)) {
    if (primary.error) throw primary.error
    return primary.count ?? 0
  }

  const fallback = await runCount(false)
  if (fallback.error) throw fallback.error
  return fallback.count ?? 0
}

async function buildTaskSummary(filters: TaskFilters, scope: TaskScope) {
  const baseFilters = { ...filters }
  const today = todayIso()
  const urgentLimit = todayIso(2)
  const nextLimit = todayIso(5)

  const [total, pendientes, enProceso, completadas, altaPrioridad, vencidas, urgentes, proximas] = await Promise.all([
    countTasks(baseFilters, scope),
    countTasks({ ...baseFilters, estado: 'Pendiente' }, scope),
    countTasks({ ...baseFilters, estado: 'En Proceso' }, scope),
    countTasks({ ...baseFilters, estado: 'Completado' }, scope),
    countTasks({ ...baseFilters, prioridad: 'Alta' }, scope),
    countTasks({ ...baseFilters, fechaFinLt: today }, scope),
    countTasks({ ...baseFilters, fechaFinGte: today, fechaFinLte: urgentLimit }, scope),
    countTasks({ ...baseFilters, fechaFinGte: todayIso(3), fechaFinLte: nextLimit }, scope),
  ])

  return {
    total,
    pendientes,
    enProceso,
    completadas,
    altaPrioridad,
    vencidas,
    urgentes,
    proximas,
  }
}

async function loadTaskPage({
  filters,
  from,
  to,
  orderBy,
  ascending,
  scope,
}: {
  filters: TaskFilters
  from: number
  to: number
  orderBy: string
  ascending: boolean
  scope: TaskScope
}) {
  const supabase = await createServerSupabaseClient()
  const admin = createAdminSupabaseClient()
  const departmentTaskIds = await loadTaskIdsForDepartment(admin, filters.departamento)

  if (!scope.unrestricted) {
    const scopedTaskIds = await loadScopedTaskIds(admin, scope)

    if (!scopedTaskIds || scopedTaskIds.length === 0) {
      return { data: [], count: 0, error: null }
    }

    const baseQuery = admin
      .from('tareas')
      .select(TASK_LIST_COLUMNS, { count: 'exact' })
      .in('id', scopedTaskIds)
      .order(orderBy, { ascending })
      .range(from, to)
    const query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters, { departmentTaskIds }) as unknown as typeof baseQuery
    const result = await query

    if (result.error) return result

    return {
      ...result,
      data: await attachTaskAssignments((result.data ?? []) as unknown as Array<Record<string, unknown>>),
    }
  }

  const runQuery = async (columns: string, includeUserColumn: boolean) => {
    const baseQuery = supabase
      .from('tareas')
      .select(columns, { count: 'exact' })
      .order(orderBy, { ascending })
      .range(from, to)
    let query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters, { departmentTaskIds }) as unknown as typeof baseQuery
    query = applyTaskScope(query as unknown as SupabaseFilterQuery, scope, { includeUserColumn }) as unknown as typeof baseQuery
    return query
  }

  const primary = await runQuery(TASK_LIST_COLUMNS, true)

  if (!primary.error) {
    return {
      ...primary,
      data: await attachTaskAssignments((primary.data ?? []) as unknown as Array<Record<string, unknown>>),
    }
  }

  const missingColumn =
    primary.error.code === '42703' ||
    primary.error.code === 'PGRST204' ||
    /responsable_(id|usuario_id)|asignado_por_(usuario_id|nombre)|column .* does not exist/i.test(primary.error.message)

  if (!missingColumn) {
    return primary
  }

  const fallback = await runQuery(LEGACY_TASK_LIST_COLUMNS, false)

  return {
    ...fallback,
    data: await attachTaskAssignments(
      ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>).map((task) => ({
        ...task,
        responsable_id: null,
        responsable_usuario_id: null,
      }))
    ),
  }
}

async function loadTaskAssignments(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskIds: number[]
) {
  const ids = Array.from(new Set(taskIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return []

  const { data, error } = await admin
    .from('tarea_asignaciones')
    .select('*')
    .in('tarea_id', ids)
    .eq('activo', true)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTaskAssignmentsTable(error)) return []
    throw error
  }

  return (data ?? []) as TaskAssignmentRow[]
}

async function loadTaskDepartments(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskIds: number[]
) {
  const ids = Array.from(new Set(taskIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return []

  const { data, error } = await admin
    .from('tarea_departamentos')
    .select('*')
    .in('tarea_id', ids)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingTaskDepartmentsTable(error)) return []
    throw error
  }

  return (data ?? []) as TaskDepartmentRow[]
}

async function loadTaskIdsForDepartment(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  departamento?: string
) {
  const target = departamento?.trim()
  if (!target) return null

  const { data, error } = await admin
    .from('tarea_departamentos')
    .select('tarea_id')
    .eq('departamento', target)

  if (error) {
    if (isMissingTaskDepartmentsTable(error)) return null
    throw error
  }

  return Array.from(new Set((data ?? []).map((row) => Number(row.tarea_id)).filter((id) => Number.isInteger(id) && id > 0)))
}

async function attachTaskAssignments(
  tasks: Array<Record<string, unknown>>
) {
  const admin = createAdminSupabaseClient()
  const taskIds = tasks.map((task) => Number(task.id))
  const [assignments, departments] = await Promise.all([
    loadTaskAssignments(admin, taskIds),
    loadTaskDepartments(admin, taskIds),
  ])

  const byTask = new Map<number, TaskAssignmentRow[]>()
  for (const assignment of assignments) {
    const rows = byTask.get(assignment.tarea_id) ?? []
    rows.push(assignment)
    byTask.set(assignment.tarea_id, rows)
  }

  const departmentsByTask = new Map<number, TaskDepartmentRow[]>()
  for (const department of departments) {
    const rows = departmentsByTask.get(department.tarea_id) ?? []
    rows.push(department)
    departmentsByTask.set(department.tarea_id, rows)
  }

  return tasks.map((task) => ({
    ...task,
    asignaciones: byTask.get(Number(task.id)) ?? [],
    departamentos: departmentsByTask.get(Number(task.id)) ?? (
      typeof task.departamento === 'string' && task.departamento.trim()
        ? [{ tarea_id: Number(task.id), departamento: task.departamento.trim() }]
        : []
    ),
  }))
}

async function loadScopedTaskIds(admin: ReturnType<typeof createAdminSupabaseClient>, scope: TaskScope) {
  if (scope.unrestricted) return null

  const taskIds = new Set<number>()

  if (scope.userId) {
    const assignmentResult = await admin
      .from('tarea_asignaciones')
      .select('tarea_id')
      .eq('responsable_usuario_id', scope.userId)
      .eq('activo', true)

    if (assignmentResult.error && !isMissingTaskAssignmentsTable(assignmentResult.error)) {
      throw assignmentResult.error
    }

    for (const assignment of assignmentResult.data ?? []) {
      taskIds.add(Number(assignment.tarea_id))
    }

    const legacyResult = await admin.from('tareas').select('id').eq('responsable_usuario_id', scope.userId)
    if (!legacyResult.error) {
      for (const task of legacyResult.data ?? []) taskIds.add(Number(task.id))
    }
  }

  if (taskIds.size === 0 && scope.assignedNames.length > 0) {
    const nameResult = await admin.from('tareas').select('id').in('responsable', scope.assignedNames)
    if (!nameResult.error) {
      for (const task of nameResult.data ?? []) taskIds.add(Number(task.id))
    }
  }

  return Array.from(taskIds)
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

function isMissingRelationTable(error: { code?: string; message?: string } | null | undefined, tableName: string) {
  const message = error?.message ?? ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    new RegExp(`${tableName}|schema cache|relation .* does not exist`, 'i').test(message)
  )
}

function isMissingTaskAssignmentsTable(error: { code?: string; message?: string } | null | undefined) {
  return isMissingRelationTable(error, 'tarea_asignaciones')
}

function isMissingTaskDepartmentsTable(error: { code?: string; message?: string } | null | undefined) {
  return isMissingRelationTable(error, 'tarea_departamentos')
}

function uniquePositiveIds(values?: number[] | null) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
    )
  )
}

function uniqueDepartmentNames(values?: Array<string | null | undefined> | null) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value?.trim())
        .filter((value): value is string => !!value)
    )
  )
}

function payloadDepartmentNames(payload: TaskPayload) {
  return uniqueDepartmentNames(
    payload.departamentos?.length ? payload.departamentos : [payload.departamento]
  )
}

async function resolveResponsable(admin: ReturnType<typeof createAdminSupabaseClient>, payload: TaskPayload) {
  if (!payload.responsable_id && !payload.responsable?.trim()) {
    return null
  }

  let responsable: ResponsableRow | null = null

  if (payload.responsable_id) {
    const { data, error } = await admin
      .from('responsables')
      .select('id, nombre, email, usuario_id, departamento')
      .eq('id', payload.responsable_id)
      .maybeSingle()

    if (error) throw error
    responsable = data as ResponsableRow | null
  } else if (payload.responsable?.trim()) {
    const { data, error } = await admin
      .from('responsables')
      .select('id, nombre, email, usuario_id, departamento')
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

async function attachResponsableRoleCodes(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  responsables: ResponsableRow[]
) {
  const userIds = Array.from(new Set(responsables.map((item) => item.usuario_id).filter((value): value is string => !!value)))
  if (userIds.length === 0) return responsables

  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, tipo_usuario:tipos_usuario(codigo)')
    .in('id', userIds)

  if (error) throw error

  const roles = new Map(
    ((data ?? []) as Array<{ id: string; tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null }>).map((profile) => {
      const role = Array.isArray(profile.tipo_usuario) ? profile.tipo_usuario[0] : profile.tipo_usuario
      return [profile.id, role?.codigo?.trim().toLowerCase() ?? '']
    })
  )

  return responsables.map((responsable) => ({
    ...responsable,
    rol_codigo: responsable.usuario_id ? roles.get(responsable.usuario_id) ?? null : null,
  }))
}

async function resolveResponsables(admin: ReturnType<typeof createAdminSupabaseClient>, payload: TaskPayload) {
  const ids = uniquePositiveIds(payload.responsable_ids)

  if (ids.length === 0) {
    const single = await resolveResponsable(admin, payload)
    return single ? attachResponsableRoleCodes(admin, [single]) : []
  }

  const { data, error } = await admin
    .from('responsables')
    .select('id, nombre, email, usuario_id, departamento')
    .in('id', ids)

  if (error) throw error

  const rows = (data ?? []) as ResponsableRow[]
  if (rows.length !== ids.length) {
    throw new Error('Uno o mas responsables seleccionados no existen en Catalogos.')
  }

  const orderedRows = ids
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is ResponsableRow => !!row)

  for (const responsable of orderedRows) {
    const email = normalizeEmail(responsable.email)

    if (!responsable.usuario_id && email) {
      const { data: profile, error: profileError } = await admin
        .from('perfiles_usuario')
        .select('id')
        .ilike('email', email)
        .maybeSingle()

      if (profileError) throw profileError

      if (profile?.id) {
        responsable.usuario_id = profile.id
        await admin.from('responsables').update({ usuario_id: profile.id }).eq('id', responsable.id)
      }
    }

    if (!responsable.usuario_id) {
      throw new Error(`El responsable ${responsable.nombre} debe tener un usuario de la aplicacion asociado a su correo.`)
    }
  }

  const uniqueByUser = new Map<string, ResponsableRow>()
  for (const responsable of orderedRows) {
    if (responsable.usuario_id && !uniqueByUser.has(responsable.usuario_id)) {
      uniqueByUser.set(responsable.usuario_id, responsable)
    }
  }

  return attachResponsableRoleCodes(admin, Array.from(uniqueByUser.values()))
}

function buildTaskPayload(
  payload: TaskPayload,
  responsable: ResponsableRow | null,
  assignmentOwner: { userId: string | null; userName: string | null },
  organismoId?: string
) {
  const [primaryDepartment] = payloadDepartmentNames(payload)

  return {
    ...(organismoId ? { organismo_id: organismoId } : {}),
    codigo_id:
      payload.codigo_id !== undefined && payload.codigo_id !== null && `${payload.codigo_id}` !== ''
        ? Number(payload.codigo_id)
        : null,
    tarea: payload.tarea?.trim() ?? '',
    prioridad: payload.prioridad ?? 'Media',
    estado: payload.estado ?? 'Pendiente',
    departamento: primaryDepartment ?? null,
    seccion: payload.seccion || null,
    responsable: responsable?.nombre ?? null,
    responsable_id: responsable?.id ?? null,
    responsable_usuario_id: responsable?.usuario_id ?? null,
    asignado_por_usuario_id: assignmentOwner.userId,
    asignado_por_nombre: assignmentOwner.userName,
    fecha_inicio: payload.fecha_inicio || null,
    fecha_fin: payload.fecha_fin || null,
    porcentaje_avance: Number(payload.porcentaje_avance ?? 0),
    tipo_tarea: payload.tipo_tarea || null,
    notas: payload.notas || null,
    ultima_actualizacion: new Date().toISOString(),
  }
}

function buildLegacyTaskPayload(payload: TaskPayload, responsable: ResponsableRow | null) {
  const [primaryDepartment] = payloadDepartmentNames(payload)

  return {
    codigo_id:
      payload.codigo_id !== undefined && payload.codigo_id !== null && `${payload.codigo_id}` !== ''
        ? Number(payload.codigo_id)
        : null,
    tarea: payload.tarea?.trim() ?? '',
    prioridad: payload.prioridad ?? 'Media',
    estado: payload.estado ?? 'Pendiente',
    departamento: primaryDepartment ?? null,
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

function isMissingAssignmentOwnerColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /asignado_por_(usuario_id|nombre)|column .* does not exist/i.test(message)
  )
}

async function loadUserRoleCode(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string | null | undefined) {
  if (!userId) return ''

  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('tipo_usuario:tipos_usuario(codigo)')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const row = data as { tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null } | null
  const role = Array.isArray(row?.tipo_usuario) ? row?.tipo_usuario[0] : row?.tipo_usuario
  return role?.codigo?.trim().toLowerCase() ?? ''
}

async function loadUserDepartments(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string) {
  const { data, error } = await admin
    .from('responsables')
    .select('departamento')
    .eq('usuario_id', userId)
    .eq('activo', true)

  if (error) throw error

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.departamento?.trim())
        .filter((value): value is string => !!value)
    )
  )
}

async function validateSupervisorAssignment({
  admin,
  userId,
  mode,
  responsable,
  previous,
  previousAssignments = [],
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  userId: string
  mode: 'create' | 'update'
  responsable: ResponsableRow | null
  previous: PreviousTaskAssignment | null
  previousAssignments?: TaskAssignmentRow[]
}) {
  const targetRole = await loadUserRoleCode(admin, responsable?.usuario_id)

  if (targetRole !== 'responsable') {
    throw new Error('Los supervisores solo pueden asignar tareas a usuarios con rol Responsable.')
  }

  const supervisorDepartments = await loadUserDepartments(admin, userId)
  const targetDepartment = responsable?.departamento?.trim()

  if (!targetDepartment || !supervisorDepartments.includes(targetDepartment)) {
    throw new Error('Solo puedes asignar tareas a responsables de tu mismo departamento.')
  }

  const wasAssignedToSupervisor =
    previous?.responsable_usuario_id === userId ||
    previousAssignments.some((assignment) => assignment.responsable_usuario_id === userId)

  if (mode === 'update' && !wasAssignedToSupervisor) {
    throw new Error('Solo puedes reasignar tareas que un administrador te haya asignado previamente.')
  }
}

function validateAdminAssignments(responsables: ResponsableRow[]) {
  for (const responsable of responsables) {
    const roleCode = responsable.rol_codigo?.trim().toLowerCase()

    if (!roleCode || ADMIN_ROLE_CODES.includes(roleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      throw new Error('Los administradores no pueden asignar tareas a usuarios administradores.')
    }
  }
}

function assignmentUserIds(assignments: Array<{ responsable_usuario_id?: string | null }>) {
  return new Set(assignments.map((assignment) => assignment.responsable_usuario_id).filter((value): value is string => !!value))
}

async function recordTaskReassignment({
  admin,
  taskId,
  taskName,
  userId,
  userLabel,
  roleCode,
  previousResponsible,
  nextResponsible,
  organismoId,
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  taskId: number
  taskName: string
  userId: string | null
  userLabel: string | null
  roleCode: string | null
  previousResponsible?: string | null
  nextResponsible?: string | null
  organismoId?: string | null
}) {
  const { error } = await admin.from('historial').insert({
    fecha: new Date().toISOString(),
    usuario: userLabel || 'Sistema',
    actor_usuario_id: userId,
    actor_rol_codigo: roleCode,
    tarea_id: taskId,
    tarea_nombre: taskName,
    modulo: 'Agenda de Control',
    tipo_cambio: 'Asignacion',
    valor_anterior: previousResponsible || 'Sin responsable',
    valor_nuevo: nextResponsible || 'Sin responsable',
    observaciones: `Tarea reasignada por ${userLabel || 'Sistema'}.`,
    ...(organismoId ? { organismo_id: organismoId } : {}),
  })

  if (error) throw error
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

async function syncTaskAssignments({
  admin,
  task,
  responsables,
  assignmentOwner,
  previousAssignments,
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  task: TaskRow
  responsables: ResponsableRow[]
  assignmentOwner: { userId: string | null; userName: string | null }
  previousAssignments: TaskAssignmentRow[]
}) {
  const previousUserIds = assignmentUserIds(previousAssignments)
  const nextUserIds = assignmentUserIds(
    responsables.map((responsable) => ({ responsable_usuario_id: responsable.usuario_id }))
  )

  const deleteResult = await admin.from('tarea_asignaciones').delete().eq('tarea_id', task.id)
  if (deleteResult.error) {
    if (isMissingTaskAssignmentsTable(deleteResult.error)) return false
    throw deleteResult.error
  }

  if (responsables.length > 0) {
    const previousByUserId = new Map(
      previousAssignments
        .filter((assignment) => assignment.responsable_usuario_id)
        .map((assignment) => [assignment.responsable_usuario_id as string, assignment])
    )
    const rows = responsables.map((responsable) => {
      const previous = responsable.usuario_id ? previousByUserId.get(responsable.usuario_id) : null

      return {
        tarea_id: task.id,
        responsable_id: responsable.id,
        responsable_usuario_id: responsable.usuario_id,
        responsable_nombre: responsable.nombre,
        responsable_email: normalizeEmail(responsable.email),
        departamento: responsable.departamento,
        rol_codigo: responsable.rol_codigo ?? null,
        asignado_por_usuario_id: previous?.asignado_por_usuario_id ?? assignmentOwner.userId,
        asignado_por_nombre: previous?.asignado_por_nombre ?? assignmentOwner.userName,
        estado: previous?.estado ?? 'Pendiente',
        porcentaje_avance: previous?.porcentaje_avance ?? 0,
        completado_at: previous?.completado_at ?? null,
        activo: true,
      }
    })
    const insertResult = await admin.from('tarea_asignaciones').insert(rows as unknown as never[])
    if (insertResult.error) {
      const message = insertResult.error.message ?? ''
      const missingProgressColumns =
        insertResult.error.code === 'PGRST204' ||
        insertResult.error.code === '42703' ||
        /estado|porcentaje_avance|completado_at|schema cache|column .* does not exist/i.test(message)

      if (!missingProgressColumns) throw insertResult.error

      const legacyRows = rows.map(({ estado, porcentaje_avance, completado_at, ...row }) => {
        void estado
        void porcentaje_avance
        void completado_at
        return row
      })
      const legacyInsert = await admin.from('tarea_asignaciones').insert(legacyRows)
      if (legacyInsert.error) throw legacyInsert.error
    }
  }

  for (const responsable of responsables) {
    if (responsable.usuario_id && !previousUserIds.has(responsable.usuario_id)) {
      await notifyAssignment(admin, task, responsable)
    }
  }

  for (const previousUserId of previousUserIds) {
    if (!nextUserIds.has(previousUserId)) {
      await markAssignmentAlertsRead(admin, task.id, previousUserId)
    }
  }

  return true
}

async function syncTaskDepartments(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number,
  departments: string[]
) {
  const deleteResult = await admin.from('tarea_departamentos').delete().eq('tarea_id', taskId)
  if (deleteResult.error) {
    if (isMissingTaskDepartmentsTable(deleteResult.error)) return false
    throw deleteResult.error
  }

  if (departments.length > 0) {
    const insertResult = await admin.from('tarea_departamentos').insert(
      departments.map((departamento) => ({
        tarea_id: taskId,
        departamento,
      }))
    )

    if (insertResult.error) throw insertResult.error
  }

  return true
}

async function markAssignmentAlertsRead(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskId: number,
  userId: string | null | undefined
) {
  if (!userId) return

  const { error } = await admin
    .from('alertas')
    .update({ leida: true })
    .eq('tarea_id', taskId)
    .eq('destinatario_usuario_id', userId)
    .eq('tipo_alerta', 'Asignada')
    .eq('leida', false)

  if (error) throw error
}

async function saveTask(request: Request, mode: 'create' | 'update') {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para guardar tareas.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    const payload = (await request.json()) as TaskPayload

    if (!payload.tarea?.trim()) {
      return NextResponse.json({ ok: false, error: 'La tarea es obligatoria.' }, { status: 400 })
    }

    if (mode === 'update' && !payload.id) {
      return NextResponse.json({ ok: false, error: 'Falta el identificador de la tarea.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const responsables = await resolveResponsables(admin, payload)
    const responsable = responsables[0] ?? null
    const userLabel = profile?.nombre_completo?.trim() || profile?.email || user.email || null
    const roleCode = activeRoleCode
    let previousResponsibleUserId: string | null = null
    let previousResponsibleName: string | null = null
    let previousAssignments: TaskAssignmentRow[] = []
    let previousAssignmentOwner: { userId: string | null; userName: string | null } = {
      userId: null,
      userName: null,
    }
    let task: TaskRow

    if (mode === 'update') {
      const taskId = Number(payload.id)
      const previousResult = await admin
        .from('tareas')
        .select('responsable, departamento, responsable_usuario_id, asignado_por_usuario_id, asignado_por_nombre')
        .eq('id', taskId)
        .maybeSingle()
      const fallbackPrevious =
        previousResult.error && isMissingAssignmentOwnerColumn(previousResult.error)
          ? await admin.from('tareas').select('responsable, departamento, responsable_usuario_id').eq('id', taskId).maybeSingle()
          : previousResult
      const { data: previous, error: previousError } = fallbackPrevious

      if (previousError) throw previousError
      const previousAssignment = previous as PreviousTaskAssignment | null
      previousResponsibleUserId = previousAssignment?.responsable_usuario_id ?? null
      previousResponsibleName = previousAssignment?.responsable ?? null
      previousAssignmentOwner = {
        userId: previousAssignment?.asignado_por_usuario_id ?? null,
        userName: previousAssignment?.asignado_por_nombre ?? null,
      }
      previousAssignments = await loadTaskAssignments(admin, [taskId])
      if (previousAssignments.length === 0 && previousResponsibleUserId) {
        previousAssignments = [{
          tarea_id: taskId,
          responsable_id: null,
          responsable_usuario_id: previousResponsibleUserId,
          responsable_nombre: previousResponsibleName ?? 'Responsable',
          responsable_email: null,
          departamento: previousAssignment?.departamento ?? null,
          rol_codigo: null,
          activo: true,
        }]
      }

      const previousUserIds = assignmentUserIds(previousAssignments)
      const nextUserIds = assignmentUserIds(responsables.map((item) => ({ responsable_usuario_id: item.usuario_id })))
      const assignmentChanged =
        previousUserIds.size !== nextUserIds.size ||
        Array.from(nextUserIds).some((userId) => !previousUserIds.has(userId))

      if (roleCode === 'supervisor') {
        if (responsables.length > 1) {
          throw new Error('Los supervisores solo pueden reasignar una tarea a un responsable a la vez.')
        }
        await validateSupervisorAssignment({
          admin,
          userId: user.id,
          mode,
          responsable,
          previous: previousAssignment,
          previousAssignments,
        })
      } else {
        validateAdminAssignments(responsables)
      }

      const taskPayload = buildTaskPayload(payload, responsable, {
        userId: assignmentChanged ? user.id : previousAssignmentOwner.userId ?? user.id,
        userName: assignmentChanged ? userLabel : previousAssignmentOwner.userName ?? userLabel,
      }, organismoId || undefined)
      const legacyTaskPayload = buildLegacyTaskPayload(payload, responsable)

      const updateQuery = admin.from('tareas').update(taskPayload).eq('id', taskId)
      const updateResult = await (organismoId ? updateQuery.eq('organismo_id', organismoId) : updateQuery)
        .select('*')
        .single()
      const fallbackUpdate =
        updateResult.error && isMissingAssignmentOwnerColumn(updateResult.error)
          ? await admin.from('tareas').update(legacyTaskPayload).eq('id', taskId).select('*').single()
          : updateResult
      const { data, error } = fallbackUpdate

      if (error) throw error
      task = data as TaskRow

      if (assignmentChanged) {
        await recordTaskReassignment({
          admin,
          taskId: task.id,
          taskName: task.tarea ?? payload.tarea ?? 'Tarea',
          userId: user.id,
          userLabel,
          roleCode,
          previousResponsible: previousResponsibleName,
          nextResponsible: responsable?.nombre,
          organismoId,
        })
      }
    } else {
      if (roleCode === 'supervisor') {
        if (responsables.length > 1) {
          throw new Error('Los supervisores solo pueden asignar una tarea a un responsable a la vez.')
        }
        await validateSupervisorAssignment({
          admin,
          userId: user.id,
          mode,
          responsable,
          previous: null,
        })
      } else {
        validateAdminAssignments(responsables)
      }

      const taskPayload = buildTaskPayload(payload, responsable, {
        userId: user.id,
        userName: userLabel,
      }, organismoId || undefined)
      const legacyTaskPayload = buildLegacyTaskPayload(payload, responsable)
      const insertResult = await admin.from('tareas').insert(taskPayload).select('*').single()
      const fallbackInsert =
        insertResult.error && isMissingAssignmentOwnerColumn(insertResult.error)
          ? await admin.from('tareas').insert(legacyTaskPayload).select('*').single()
          : insertResult
      const { data, error } = fallbackInsert

      if (error) throw error
      task = data as TaskRow
    }

    const syncedAssignments = await syncTaskAssignments({
      admin,
      task,
      responsables,
      assignmentOwner: {
        userId: mode === 'update' ? task.asignado_por_usuario_id ?? user.id : user.id,
        userName: mode === 'update' ? task.asignado_por_nombre ?? userLabel : userLabel,
      },
      previousAssignments,
    })

    if (!syncedAssignments && responsable && (mode === 'create' || previousResponsibleUserId !== responsable.usuario_id)) {
      await notifyAssignment(admin, task, responsable)
    }

    if (!syncedAssignments && mode === 'update' && previousResponsibleUserId && previousResponsibleUserId !== responsable?.usuario_id) {
      await markAssignmentAlertsRead(admin, task.id, previousResponsibleUserId)
    }

    await syncTaskDepartments(admin, task.id, payloadDepartmentNames(payload))

    const [taskWithAssignments] = await attachTaskAssignments([task as unknown as Record<string, unknown>])

    return NextResponse.json({ ok: true, task: taskWithAssignments ?? task })
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


export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !READER_ROLE_CODES.includes(activeRoleCode as (typeof READER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar tareas.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    const url = new URL(request.url)
    const filters = readFilters(url.searchParams)
    const page = toPositiveInt(url.searchParams.get('page'), 0)
    const pageSize = toPositiveInt(url.searchParams.get('pageSize'), 25, MAX_PAGE_SIZE)
    const from = page * pageSize
    const to = from + pageSize - 1
    const includeSummary = url.searchParams.get('summary') !== 'false'
    const requestedOrderBy = url.searchParams.get('orderBy') || 'created_at'
    const orderBy = TASK_ORDER_COLUMNS.has(requestedOrderBy) ? requestedOrderBy : 'created_at'
    const ascending = url.searchParams.get('ascending') === 'true'
    const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)

    const { data, count, error } = await loadTaskPage({
      filters,
      from,
      to,
      orderBy,
      ascending,
      scope,
    })

    if (error) throw error

    let summary = null

    if (includeSummary) {
      try {
        summary = await buildTaskSummary(filters, scope)
      } catch {
        summary = {
          total: count ?? 0,
          pendientes: 0,
          enProceso: 0,
          completadas: 0,
          altaPrioridad: 0,
          vencidas: 0,
          urgentes: 0,
          proximas: 0,
        }
      }
    }

    return NextResponse.json({
      ok: true,
      tasks: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      summary,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron consultar las tareas.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para eliminar tareas.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    const url = new URL(request.url)
    let id = Number(url.searchParams.get('id'))

    if (!Number.isInteger(id)) {
      const payload = (await request.json().catch(() => ({}))) as { id?: number }
      id = Number(payload.id)
    }

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Falta el identificador de la tarea.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const deleteQuery = admin.from('tareas').delete().eq('id', id)
    const { error } = await (organismoId ? deleteQuery.eq('organismo_id', organismoId) : deleteQuery)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo eliminar la tarea.',
      },
      { status: 500 }
    )
  }
}
