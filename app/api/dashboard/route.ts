import { NextResponse } from 'next/server'
import { READER_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { getServerSessionProfile } from '@/lib/server-access'
import { createServerSupabaseClient } from '@/lib/supabase-server'
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

export async function GET() {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, READER_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar indicadores.' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: rpcData, error: rpcError } = await supabase.rpc('api_dashboard_data')

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

    const { data, error } = await supabase.from('tareas').select(DASHBOARD_COLUMNS)

    if (error) throw error

    const tasks = (data ?? []) as unknown as DashboardTask[]
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
      const departamento = task.departamento ?? 'Sin asignar'
      const responsable = task.responsable ?? 'Sin asignar'

      if (!deptMap[departamento]) deptMap[departamento] = { total: 0, completadas: 0, enProceso: 0, pendientes: 0 }
      if (!respMap[responsable]) respMap[responsable] = { total: 0, completadas: 0, enProceso: 0, pendientes: 0 }

      deptMap[departamento].total += 1
      respMap[responsable].total += 1

      if (task.estado === 'Completado') {
        deptMap[departamento].completadas += 1
        respMap[responsable].completadas += 1
      } else if (task.estado === 'En Proceso') {
        deptMap[departamento].enProceso += 1
        respMap[responsable].enProceso += 1
      } else {
        deptMap[departamento].pendientes += 1
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
