import { NextResponse } from 'next/server'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES, READER_ROLE_CODES } from '@/lib/access-control'
import { getServerSessionProfile, getOrganismoIdFromRequest, getRoleCodeFromRequest } from '@/lib/server-access'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { applyTaskScope, buildTaskScope, isTaskScopeColumnError } from '@/lib/task-scope'
import type { Tarea } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DASHBOARD_COLUMNS = [
  'id',
  'codigo_id',
  'tarea',
  'prioridad',
  'departamento',
  'responsable',
  'fecha_fin',
  'porcentaje_avance',
  'estado',
  'responsable_usuario_id',
  'created_at',
  'updated_at',
].join(',')

const LEGACY_DASHBOARD_COLUMNS = [
  'id',
  'codigo_id',
  'tarea',
  'prioridad',
  'departamento',
  'responsable',
  'fecha_fin',
  'porcentaje_avance',
  'estado',
  'created_at',
  'updated_at',
].join(',')

const SEMAFORO_SIN_FECHA = '\u26AA Sin fecha'
const SEMAFORO_VENCIDA = '\u{1F534} Vencida'
const SEMAFORO_URGENTE = '\u{1F7E0} Urgente'
const SEMAFORO_PROXIMA = '\u{1F7E1} Pr\u00F3xima'
const SEMAFORO_A_TIEMPO = '\u{1F7E2} A tiempo'

type DashboardTask = Pick<
  Tarea,
  | 'id'
  | 'codigo_id'
  | 'tarea'
  | 'prioridad'
  | 'departamento'
  | 'responsable'
  | 'fecha_fin'
  | 'porcentaje_avance'
  | 'estado'
  | 'created_at'
  | 'updated_at'
>

type DashboardRpcData = {
  kpis: unknown
  deptData: unknown[]
  respData: unknown[]
  pieData: unknown[]
  priData: unknown[]
  recientes: unknown[]
}

type TaskDepartmentRow = {
  tarea_id: number
  departamento: string
}

type DashboardAlert = {
  id: number
  tarea_id?: number | null
  tipo_alerta?: string | null
  titulo: string | null
  mensaje: string | null
  modulo: string
  leida: boolean | null
  created_at: string | null
  asignado_a?: string | null
  asignado_a_email?: string | null
  asignado_por?: string | null
}

type DashboardMeeting = {
  id: string
  titulo: string
  fecha_inicio: string
  modalidad: string
  estado: string
}

type DashboardCalendarEvent = {
  id: string
  titulo: string
  fecha_inicio: string
  fecha_fin: string | null
  tipo_evento: string
  es_festivo: boolean
  color: string
}

type DashboardHistory = {
  id: number
  fecha: string | null
  usuario: string | null
  tarea_id: number | null
  tarea_nombre: string | null
  tipo_cambio: string
  observaciones: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isDashboardRpcData(value: unknown): value is DashboardRpcData {
  return (
    isRecord(value) &&
    isRecord(value.kpis) &&
    Array.isArray(value.deptData) &&
    Array.isArray(value.respData) &&
    Array.isArray(value.pieData) &&
    Array.isArray(value.priData) &&
    Array.isArray(value.recientes)
  )
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function calcularSemaforo(fechaFin?: string | null) {
  if (!fechaFin) return SEMAFORO_SIN_FECHA

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fin = parseDateOnly(fechaFin)
  const diff = Math.ceil((fin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return SEMAFORO_VENCIDA
  if (diff <= 2) return SEMAFORO_URGENTE
  if (diff <= 5) return SEMAFORO_PROXIMA
  return SEMAFORO_A_TIEMPO
}

async function attachDepartments(tasks: DashboardTask[]) {
  if (tasks.length === 0) return tasks

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('tarea_departamentos')
    .select('tarea_id, departamento')
    .in('tarea_id', tasks.map((task) => task.id))

  if (error) return tasks

  const byTask = new Map<number, TaskDepartmentRow[]>()
  for (const row of (data ?? []) as TaskDepartmentRow[]) {
    const rows = byTask.get(row.tarea_id) ?? []
    rows.push(row)
    byTask.set(row.tarea_id, rows)
  }

  return tasks.map((task) => ({
    ...task,
    departamentos: byTask.get(task.id) ?? (task.departamento ? [{ tarea_id: task.id, departamento: task.departamento }] : []),
  }))
}

function getTaskDepartments(task: DashboardTask & { departamentos?: TaskDepartmentRow[] }) {
  const departments = task.departamentos?.map((item) => item.departamento?.trim()).filter(Boolean)
  return departments?.length ? Array.from(new Set(departments)) : [task.departamento ?? 'Sin asignar']
}

function shouldUseDashboardRpc() {
  return false
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function loadAlertSummary(params: {
  organismoId: string
  userId: string
  email: string
  isAdmin: boolean
}) {
  const admin = createAdminSupabaseClient()
  let query = admin
    .from('alertas')
    .select('id, tarea_id, tipo_alerta, titulo, mensaje, modulo, leida, created_at, destinatario_usuario_id, destinatario_email')
    .eq('organismo_id', params.organismoId)
    .order('created_at', { ascending: false })
    .limit(8)

  if (!params.isAdmin) {
    const email = params.email.replace(/'/g, "''")
    query = query.or(`destinatario_usuario_id.eq.${params.userId},destinatario_email.eq.${email}`)
  }

  const { data, error } = await query
  if (error) return { total: 0, noLeidas: 0, recientes: [] as DashboardAlert[] }

  const rows = (data ?? []) as Array<DashboardAlert & { destinatario_usuario_id?: string | null; destinatario_email?: string | null }>
  const assignmentAlerts = rows.filter((alerta) => alerta.tipo_alerta === 'Asignada' && alerta.tarea_id)
  const taskIds = Array.from(new Set(assignmentAlerts.map((alerta) => Number(alerta.tarea_id)).filter(Number.isInteger)))
  const assignmentMap = new Map<string, { asignado_a?: string | null; asignado_a_email?: string | null; asignado_por?: string | null }>()

  if (taskIds.length > 0) {
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
  }

  return {
    total: rows.length,
    noLeidas: rows.filter((alerta) => !alerta.leida).length,
    recientes: rows.map(({ id, tarea_id, tipo_alerta, titulo, mensaje, modulo, leida, created_at, destinatario_usuario_id, destinatario_email }) => {
      const assignmentInfo = tarea_id && destinatario_usuario_id ? assignmentMap.get(`${tarea_id}:${destinatario_usuario_id}`) : null
      return {
        id,
        tarea_id,
        tipo_alerta,
        titulo,
        mensaje,
        modulo,
        leida,
        created_at,
        asignado_a: assignmentInfo?.asignado_a ?? destinatario_email ?? null,
        asignado_a_email: assignmentInfo?.asignado_a_email ?? destinatario_email ?? null,
        asignado_por: assignmentInfo?.asignado_por ?? null,
      }
    }),
  }
}

async function loadMeetingSummary(params: {
  organismoId: string
  userId: string
  isManager: boolean
}) {
  const admin = createAdminSupabaseClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const to = addDays(today, 30).toISOString()

  let query = admin
    .from('reuniones')
    .select('id, titulo, fecha_inicio, modalidad, estado, invitados:reunion_invitados(id, usuario_id, estado_respuesta)')
    .eq('organismo_id', params.organismoId)
    .gte('fecha_inicio', today.toISOString())
    .lte('fecha_inicio', to)
    .order('fecha_inicio', { ascending: true })
    .limit(12)

  const { data, error } = await query
  if (error) return { proximas: 0, programadas: 0, pendientesRespuesta: 0, recientes: [] as DashboardMeeting[] }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((reunion) => {
    if (params.isManager) return true
    const invitados = Array.isArray(reunion.invitados) ? reunion.invitados as Array<{ usuario_id?: string | null }> : []
    return invitados.some((invitado) => invitado.usuario_id === params.userId)
  })

  return {
    proximas: rows.length,
    programadas: rows.filter((reunion) => reunion.estado === 'programada').length,
    pendientesRespuesta: rows.reduce((total, reunion) => {
      const invitados = Array.isArray(reunion.invitados) ? reunion.invitados as Array<{ usuario_id?: string | null; estado_respuesta?: string | null }> : []
      return total + invitados.filter((invitado) => {
        if (params.isManager) return invitado.estado_respuesta === 'pendiente'
        return invitado.usuario_id === params.userId && invitado.estado_respuesta === 'pendiente'
      }).length
    }, 0),
    recientes: rows.slice(0, 5).map((reunion) => ({
      id: reunion.id as string,
      titulo: reunion.titulo as string,
      fecha_inicio: reunion.fecha_inicio as string,
      modalidad: reunion.modalidad as string,
      estado: reunion.estado as string,
    })),
  }
}

async function loadCalendarSummary(organismoId: string) {
  const admin = createAdminSupabaseClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const next30 = addDays(today, 30)

  const { data, error } = await admin
    .from('calendario_eventos')
    .select('id, titulo, fecha_inicio, fecha_fin, tipo_evento, es_festivo, color')
    .eq('organismo_id', organismoId)
    .lte('fecha_inicio', toDateOnly(next30))
    .or(`fecha_fin.is.null,fecha_fin.gte.${toDateOnly(today)}`)
    .order('fecha_inicio', { ascending: true })
    .limit(20)

  if (error) return { eventosMes: 0, festivosMes: 0, eventosHoy: 0, proximos: [] as DashboardCalendarEvent[] }

  const rows = (data ?? []) as DashboardCalendarEvent[]
  return {
    eventosMes: rows.filter((evento) => evento.fecha_inicio <= toDateOnly(monthEnd) && (evento.fecha_fin ?? evento.fecha_inicio) >= toDateOnly(monthStart)).length,
    festivosMes: rows.filter((evento) => (evento.es_festivo || evento.tipo_evento === 'festivo') && evento.fecha_inicio <= toDateOnly(monthEnd) && (evento.fecha_fin ?? evento.fecha_inicio) >= toDateOnly(monthStart)).length,
    eventosHoy: rows.filter((evento) => evento.fecha_inicio <= toDateOnly(today) && (evento.fecha_fin ?? evento.fecha_inicio) >= toDateOnly(today)).length,
    proximos: rows.slice(0, 6),
  }
}

async function loadHistorySummary(params: {
  organismoId: string
  visibleTaskIds: number[]
  isAdmin: boolean
}) {
  const admin = createAdminSupabaseClient()
  let query = admin
    .from('historial')
    .select('id, fecha, usuario, tarea_id, tarea_nombre, tipo_cambio, observaciones')
    .eq('organismo_id', params.organismoId)
    .is('eliminado_at', null)
    .order('fecha', { ascending: false })
    .limit(8)

  if (!params.isAdmin) {
    if (params.visibleTaskIds.length === 0) return { recientes: [] as DashboardHistory[], totalReciente: 0 }
    query = query.in('tarea_id', params.visibleTaskIds)
  }

  const { data, error } = await query
  if (error) return { recientes: [] as DashboardHistory[], totalReciente: 0 }
  return {
    recientes: (data ?? []) as DashboardHistory[],
    totalReciente: data?.length ?? 0,
  }
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !READER_ROLE_CODES.includes(activeRoleCode as (typeof READER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar indicadores.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    const supabase = await createServerSupabaseClient()
    const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)
    const { data: rpcData, error: rpcError }: { data: unknown; error: Error | null } =
      scope.unrestricted && shouldUseDashboardRpc()
        ? await supabase.rpc('api_dashboard_data')
        : { data: null, error: new Error('Dashboard uses relation-aware fallback') }

    if (!rpcError && isDashboardRpcData(rpcData)) {
      return NextResponse.json({
        ok: true,
        kpis: rpcData.kpis,
        deptData: rpcData.deptData,
        respData: rpcData.respData,
        pieData: rpcData.pieData,
        priData: rpcData.priData,
        recientes: rpcData.recientes,
      })
    }

    const runQuery = async (columns: string, includeUserColumn: boolean) => {
      const baseQuery = supabase.from('tareas').select(columns)
      const query = applyTaskScope(baseQuery, scope, { includeUserColumn })
      return query
    }

    const primary = await runQuery(DASHBOARD_COLUMNS, true)
    const fallback =
      primary.error && !scope.unrestricted && isTaskScopeColumnError(primary.error)
        ? await runQuery(LEGACY_DASHBOARD_COLUMNS, false)
        : primary
    const { data, error } = fallback

    if (error) throw error

    const tasks = await attachDepartments((data ?? []) as unknown as DashboardTask[])
    const withSemaforo = tasks.map((task) => ({
      ...task,
      semaforo: calcularSemaforo(task.fecha_fin),
    }))
    const nonFinalTasks = withSemaforo.filter((task) => task.estado !== 'Completado' && task.estado !== 'Cancelado')

    const kpis = {
      total: withSemaforo.length,
      completadas: withSemaforo.filter((task) => task.estado === 'Completado').length,
      enProceso: withSemaforo.filter((task) => task.estado === 'En Proceso').length,
      pendientes: withSemaforo.filter((task) => task.estado === 'Pendiente').length,
      canceladas: withSemaforo.filter((task) => task.estado === 'Cancelado').length,
      activas: nonFinalTasks.length,
      alta: withSemaforo.filter((task) => task.prioridad === 'Alta').length,
      vencidas: nonFinalTasks.filter((task) => task.semaforo === SEMAFORO_VENCIDA).length,
      urgentes: nonFinalTasks.filter((task) => task.semaforo === SEMAFORO_URGENTE).length,
      proximas: nonFinalTasks.filter((task) => task.semaforo === SEMAFORO_PROXIMA).length,
      sinResponsable: withSemaforo.filter((task) => !task.responsable?.trim()).length,
      avance: withSemaforo.length
        ? Math.round(withSemaforo.reduce((acc, task) => acc + Number(task.porcentaje_avance ?? 0), 0) / withSemaforo.length)
        : 0,
    }

    const deptMap: Record<string, { total: number; completadas: number; enProceso: number; pendientes: number }> = {}
    const respMap: Record<string, { total: number; completadas: number; enProceso: number; pendientes: number }> = {}

    withSemaforo.forEach((task) => {
      const responsable = task.responsable ?? 'Sin asignar'
      const departamentos = getTaskDepartments(task)

      if (!respMap[responsable]) respMap[responsable] = { total: 0, completadas: 0, enProceso: 0, pendientes: 0 }

      for (const departamento of departamentos) {
        if (!deptMap[departamento]) deptMap[departamento] = { total: 0, completadas: 0, enProceso: 0, pendientes: 0 }
        deptMap[departamento].total += 1

        if (task.estado === 'Completado') {
          deptMap[departamento].completadas += 1
        } else if (task.estado === 'En Proceso') {
          deptMap[departamento].enProceso += 1
        } else {
          deptMap[departamento].pendientes += 1
        }
      }
      respMap[responsable].total += 1

      if (task.estado === 'Completado') {
        respMap[responsable].completadas += 1
      } else if (task.estado === 'En Proceso') {
        respMap[responsable].enProceso += 1
      } else {
        respMap[responsable].pendientes += 1
      }
    })

    const deptData = Object.entries(deptMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, value]) => ({
        name: name.length > 16 ? `${name.slice(0, 16)}...` : name,
        ...value,
      }))

    const respData = Object.entries(respMap).sort((a, b) => b[1].total - a[1].total).slice(0, 6)

    const pieData = [
      { name: 'Completado', value: kpis.completadas },
      { name: 'En proceso', value: kpis.enProceso },
      { name: 'Pendiente', value: kpis.pendientes },
      { name: 'Cancelado', value: withSemaforo.filter((task) => task.estado === 'Cancelado').length },
    ].filter((item) => item.value > 0)

    const priData = [
      { name: 'Alta', value: withSemaforo.filter((task) => task.prioridad === 'Alta').length },
      { name: 'Media', value: withSemaforo.filter((task) => task.prioridad === 'Media').length },
      { name: 'Baja', value: withSemaforo.filter((task) => task.prioridad === 'Baja').length },
    ].filter((item) => item.value > 0)

    const recientes = [...withSemaforo]
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime()
      )
      .slice(0, 5)

    const isAdmin = ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])
    const isManager = MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])
    const [alertSummary, meetingSummary, calendarSummary, historySummary] = organismoId
      ? await Promise.all([
          loadAlertSummary({
            organismoId,
            userId: user.id,
            email: profile?.email ?? user.email ?? '',
            isAdmin,
          }),
          loadMeetingSummary({
            organismoId,
            userId: user.id,
            isManager,
          }),
          loadCalendarSummary(organismoId),
          loadHistorySummary({
            organismoId,
            visibleTaskIds: withSemaforo.map((task) => task.id),
            isAdmin,
          }),
        ])
      : [
          { total: 0, noLeidas: 0, recientes: [] },
          { proximas: 0, programadas: 0, pendientesRespuesta: 0, recientes: [] },
          { eventosMes: 0, festivosMes: 0, eventosHoy: 0, proximos: [] },
          { recientes: [], totalReciente: 0 },
        ]

    return NextResponse.json({
      ok: true,
      kpis,
      deptData,
      respData,
      pieData,
      priData,
      recientes,
      alertSummary,
      meetingSummary,
      calendarSummary,
      historySummary,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar los indicadores.',
      },
      { status: 500 }
    )
  }
}
