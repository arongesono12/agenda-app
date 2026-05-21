import { NextResponse } from 'next/server'
import { READER_ROLE_CODES } from '@/lib/access-control'
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

    const kpis = {
      total: withSemaforo.length,
      completadas: withSemaforo.filter((task) => task.estado === 'Completado').length,
      enProceso: withSemaforo.filter((task) => task.estado === 'En Proceso').length,
      pendientes: withSemaforo.filter((task) => task.estado === 'Pendiente').length,
      alta: withSemaforo.filter((task) => task.prioridad === 'Alta').length,
      vencidas: withSemaforo.filter((task) => task.semaforo === SEMAFORO_VENCIDA).length,
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

    return NextResponse.json({
      ok: true,
      kpis,
      deptData,
      respData,
      pieData,
      priData,
      recientes,
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
