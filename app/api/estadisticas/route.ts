import { NextResponse } from 'next/server'
import { READER_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { getServerSessionProfile } from '@/lib/server-access'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PRIORIDADES, TIPOS_TAREA, type Tarea } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATS_COLUMNS = 'prioridad,tipo_tarea,departamento,estado,porcentaje_avance'

type StatsTask = Pick<Tarea, 'prioridad' | 'tipo_tarea' | 'departamento' | 'estado' | 'porcentaje_avance'>

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

export async function GET() {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, READER_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar estadisticas.' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: rpcData, error: rpcError } = await supabase.rpc('api_estadisticas_data')

    if (!rpcError && isEstadisticasRpcData(rpcData)) {
      return NextResponse.json({
        ok: true,
        prioridadStats: rpcData.prioridadStats,
        tipoStats: rpcData.tipoStats,
        departamentoStats: rpcData.departamentoStats,
        radarData: rpcData.radarData,
      })
    }

    const { data, error } = await supabase.from('tareas').select(STATS_COLUMNS)

    if (error) throw error

    const tasks = (data ?? []) as unknown as StatsTask[]

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
      const departamento = task.departamento ?? 'Sin asignar'
      if (!deptMap[departamento]) deptMap[departamento] = { completadas: 0, en_proceso: 0, pendientes: 0, avance: [] }

      if (task.estado === 'Completado') deptMap[departamento].completadas += 1
      else if (task.estado === 'En Proceso') deptMap[departamento].en_proceso += 1
      else deptMap[departamento].pendientes += 1

      deptMap[departamento].avance.push(Number(task.porcentaje_avance ?? 0))
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
