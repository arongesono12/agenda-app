import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getServerSessionProfile } from '@/lib/server-access'
import { EDITOR_ROLE_CODES, READER_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { escapeHtml, sendAgendaEmail } from '@/lib/email/resend'

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
  filters: TaskFilters
) {
  let next: SupabaseFilterQuery = query

  if (filters.prioridad) next = next.eq('prioridad', filters.prioridad)
  if (filters.departamento) next = next.eq('departamento', filters.departamento)
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

async function countTasks(filters: TaskFilters & { estado?: string; prioridad?: string; fechaFinLt?: string; fechaFinGte?: string; fechaFinLte?: string }) {
  const supabase = await createServerSupabaseClient()
  const baseQuery = supabase.from('tareas').select('id', { count: 'exact', head: true })
  let query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters) as unknown as typeof baseQuery

  if (filters.fechaFinLt) query = query.lt('fecha_fin', filters.fechaFinLt)
  if (filters.fechaFinGte) query = query.gte('fecha_fin', filters.fechaFinGte)
  if (filters.fechaFinLte) query = query.lte('fecha_fin', filters.fechaFinLte)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function buildTaskSummary(filters: TaskFilters) {
  const baseFilters = { ...filters }
  const today = todayIso()
  const urgentLimit = todayIso(2)
  const nextLimit = todayIso(5)

  const [total, pendientes, enProceso, completadas, altaPrioridad, vencidas, urgentes, proximas] = await Promise.all([
    countTasks(baseFilters),
    countTasks({ ...baseFilters, estado: 'Pendiente' }),
    countTasks({ ...baseFilters, estado: 'En Proceso' }),
    countTasks({ ...baseFilters, estado: 'Completado' }),
    countTasks({ ...baseFilters, prioridad: 'Alta' }),
    countTasks({ ...baseFilters, fechaFinLt: today }),
    countTasks({ ...baseFilters, fechaFinGte: today, fechaFinLte: urgentLimit }),
    countTasks({ ...baseFilters, fechaFinGte: todayIso(3), fechaFinLte: nextLimit }),
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
}: {
  filters: TaskFilters
  from: number
  to: number
  orderBy: string
  ascending: boolean
}) {
  const supabase = await createServerSupabaseClient()

  const runQuery = async (columns: string) => {
    const baseQuery = supabase
      .from('tareas')
      .select(columns, { count: 'exact' })
      .order(orderBy, { ascending })
      .range(from, to)
    const query = applyTaskFilters(baseQuery as unknown as SupabaseFilterQuery, filters) as unknown as typeof baseQuery
    return query
  }

  const primary = await runQuery(TASK_LIST_COLUMNS)

  if (!primary.error) {
    return primary
  }

  const missingColumn =
    primary.error.code === '42703' ||
    primary.error.code === 'PGRST204' ||
    /responsable_(id|usuario_id)|column .* does not exist/i.test(primary.error.message)

  if (!missingColumn) {
    return primary
  }

  const fallback = await runQuery(LEGACY_TASK_LIST_COLUMNS)

  return {
    ...fallback,
    data: ((fallback.data ?? []) as unknown as Array<Record<string, unknown>>).map((task) => ({
      ...task,
      responsable_id: null,
      responsable_usuario_id: null,
    })),
  }
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
    tarea: payload.tarea?.trim() ?? '',
    prioridad: payload.prioridad ?? 'Media',
    estado: payload.estado ?? 'Pendiente',
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
      const taskId = Number(payload.id)
      const { data: previous, error: previousError } = await admin
        .from('tareas')
        .select('responsable_usuario_id')
        .eq('id', taskId)
        .maybeSingle()

      if (previousError) throw previousError
      previousResponsibleUserId = previous?.responsable_usuario_id ?? null

      const { data, error } = await admin
        .from('tareas')
        .update(taskPayload)
        .eq('id', taskId)
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

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, READER_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar tareas.' }, { status: 403 })
    }

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

    const { data, count, error } = await loadTaskPage({
      filters,
      from,
      to,
      orderBy,
      ascending,
    })

    if (error) throw error

    let summary = null

    if (includeSummary) {
      try {
        summary = await buildTaskSummary(filters)
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

    if (!user || !hasAnyRole(profile, EDITOR_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para eliminar tareas.' }, { status: 403 })
    }

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
    const { error } = await admin.from('tareas').delete().eq('id', id)

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
