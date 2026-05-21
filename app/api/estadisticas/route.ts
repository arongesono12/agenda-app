import { NextResponse } from 'next/server'
import { READER_ROLE_CODES } from '@/lib/access-control'
import { getServerSessionProfile, getOrganismoIdFromRequest, getRoleCodeFromRequest } from '@/lib/server-access'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { applyTaskScope, buildTaskScope, isTaskScopeColumnError } from '@/lib/task-scope'
import { PRIORIDADES, TIPOS_TAREA, type Tarea } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATS_COLUMNS = 'id,prioridad,tipo_tarea,departamento,estado,porcentaje_avance,responsable,responsable_usuario_id'
const LEGACY_STATS_COLUMNS = 'id,prioridad,tipo_tarea,departamento,estado,porcentaje_avance,responsable'

type StatsTask = Pick<Tarea, 'prioridad' | 'tipo_tarea' | 'departamento' | 'estado' | 'porcentaje_avance'>
type StatsTaskWithDepartments = StatsTask & { id?: number; departamentos?: Array<{ tarea_id: number; departamento: string }> }

type EstadisticasRpcData = {
  prioridadStats: unknown[]
  tipoStats: unknown[]
  departamentoStats: unknown[]
  radarData: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isEstadisticasRpcData(value: unknown): value is EstadisticasRpcData {
  return (
    isRecord(value) &&
    Array.isArray(value.prioridadStats) &&
    Array.isArray(value.tipoStats) &&
    Array.isArray(value.departamentoStats) &&
    Array.isArray(value.radarData)
  )
}

async function attachDepartments(tasks: StatsTaskWithDepartments[]) {
  const taskIds = tasks.map((task) => Number(task.id)).filter((id) => Number.isInteger(id) && id > 0)
  if (taskIds.length === 0) return tasks

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('tarea_departamentos')
    .select('tarea_id, departamento')
    .in('tarea_id', taskIds)

  if (error) return tasks

  const byTask = new Map<number, Array<{ tarea_id: number; departamento: string }>>()
  for (const row of (data ?? []) as Array<{ tarea_id: number; departamento: string }>) {
    const rows = byTask.get(row.tarea_id) ?? []
    rows.push(row)
    byTask.set(row.tarea_id, rows)
  }

  return tasks.map((task) => ({
    ...task,
    departamentos: task.id ? byTask.get(Number(task.id)) ?? (task.departamento ? [{ tarea_id: Number(task.id), departamento: task.departamento }] : []) : [],
  }))
}

function getTaskDepartments(task: StatsTaskWithDepartments) {
  const departments = task.departamentos?.map((item) => item.departamento?.trim()).filter(Boolean)
  return departments?.length ? Array.from(new Set(departments)) : [task.departamento ?? 'Sin asignar']
}

function shouldUseEstadisticasRpc() {
  return false
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !READER_ROLE_CODES.includes(activeRoleCode as (typeof READER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar estadisticas.' }, { status: 403 })
    }

    const organismoId = getOrganismoIdFromRequest(request)
    const supabase = await createServerSupabaseClient()
    const scope = buildTaskScope(user, profile, organismoId, activeRoleCode)
    const { data: rpcData, error: rpcError }: { data: unknown; error: Error | null } =
      scope.unrestricted && shouldUseEstadisticasRpc()
        ? await supabase.rpc('api_estadisticas_data')
        : { data: null, error: new Error('Statistics uses relation-aware fallback') }

    if (!rpcError && isEstadisticasRpcData(rpcData)) {
      return NextResponse.json({
        ok: true,
        prioridadStats: rpcData.prioridadStats,
        tipoStats: rpcData.tipoStats,
        departamentoStats: rpcData.departamentoStats,
        radarData: rpcData.radarData,
      })
    }

    const runQuery = async (columns: string, includeUserColumn: boolean) => {
      const baseQuery = supabase.from('tareas').select(columns)
      const query = applyTaskScope(baseQuery, scope, { includeUserColumn })
      return query
    }

    const primary = await runQuery(STATS_COLUMNS, true)
    const fallback =
      primary.error && !scope.unrestricted && isTaskScopeColumnError(primary.error)
        ? await runQuery(LEGACY_STATS_COLUMNS, false)
        : primary
    const { data, error } = fallback

    if (error) throw error

    const tasks = await attachDepartments((data ?? []) as unknown as StatsTaskWithDepartments[])

    const prioridadStats = PRIORIDADES.map((prioridad) => ({
      prioridad,
      total: tasks.filter((task) => task.prioridad === prioridad).length,
      completadas: tasks.filter((task) => task.prioridad === prioridad && task.estado === 'Completado').length,
      en_proceso: tasks.filter((task) => task.prioridad === prioridad && task.estado === 'En Proceso').length,
      pendientes: tasks.filter((task) => task.prioridad === prioridad && task.estado === 'Pendiente').length,
    }))

    const tipoStats = TIPOS_TAREA.map((tipo) => {
      const total = tasks.filter((task) => task.tipo_tarea === tipo).length
      const completadas = tasks.filter((task) => task.tipo_tarea === tipo && task.estado === 'Completado').length

      return {
        tipo,
        total,
        completadas,
        en_proceso: tasks.filter((task) => task.tipo_tarea === tipo && task.estado === 'En Proceso').length,
        pendientes: tasks.filter((task) => task.tipo_tarea === tipo && task.estado === 'Pendiente').length,
        pct: total > 0 ? Math.round((completadas / total) * 100) : 0,
      }
    })

    const deptMap: Record<string, { completadas: number; en_proceso: number; pendientes: number; avance: number[] }> = {}

    tasks.forEach((task) => {
      const departamentos = getTaskDepartments(task)

      for (const departamento of departamentos) {
        if (!deptMap[departamento]) deptMap[departamento] = { completadas: 0, en_proceso: 0, pendientes: 0, avance: [] }

        if (task.estado === 'Completado') deptMap[departamento].completadas += 1
        else if (task.estado === 'En Proceso') deptMap[departamento].en_proceso += 1
        else deptMap[departamento].pendientes += 1

        deptMap[departamento].avance.push(Number(task.porcentaje_avance ?? 0))
      }
    })

    const departamentoStats = Object.entries(deptMap)
      .map(([dpto, value]) => ({
        dpto: dpto.length > 14 ? `${dpto.slice(0, 14)}...` : dpto,
        ...value,
        total: value.completadas + value.en_proceso + value.pendientes,
        avance_prom: value.avance.length
          ? Math.round(value.avance.reduce((acc, item) => acc + item, 0) / value.avance.length)
          : 0,
      }))
      .sort((a, b) => b.total - a.total)

    const radarData = departamentoStats.slice(0, 6).map((departamento) => ({
      dept: departamento.dpto,
      completadas: departamento.completadas,
      en_proceso: departamento.en_proceso,
      pendientes: departamento.pendientes,
    }))

    return NextResponse.json({
      ok: true,
      prioridadStats,
      tipoStats,
      departamentoStats,
      radarData,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar las estadisticas.',
      },
      { status: 500 }
    )
  }
}
