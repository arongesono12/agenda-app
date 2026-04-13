'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { normalizarTareas, supabase } from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { PRIORIDADES, TIPOS_TAREA } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import ProgressBar from '@/components/ui/ProgressBar'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts'

export default function EstadisticasPage() {
  const [tasks, setTasks] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tareas').select('*')
    setTasks(normalizarTareas(data as Tarea[] | null))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  const priStats = PRIORIDADES.map((p) => ({
    prioridad: p,
    total: tasks.filter((t) => t.prioridad === p).length,
    completadas: tasks.filter((t) => t.prioridad === p && t.estado === 'Completado').length,
    en_proceso: tasks.filter((t) => t.prioridad === p && t.estado === 'En Proceso').length,
    pendientes: tasks.filter((t) => t.prioridad === p && t.estado === 'Pendiente').length,
  }))

  const tipoStats = TIPOS_TAREA.map((tipo) => ({
    tipo,
    total: tasks.filter((t) => t.tipo_tarea === tipo).length,
    completadas: tasks.filter((t) => t.tipo_tarea === tipo && t.estado === 'Completado').length,
    en_proceso: tasks.filter((t) => t.tipo_tarea === tipo && t.estado === 'En Proceso').length,
    pendientes: tasks.filter((t) => t.tipo_tarea === tipo && t.estado === 'Pendiente').length,
    pct:
      tasks.filter((t) => t.tipo_tarea === tipo).length > 0
        ? Math.round(
            (tasks.filter((t) => t.tipo_tarea === tipo && t.estado === 'Completado').length /
              tasks.filter((t) => t.tipo_tarea === tipo).length) *
              100
          )
        : 0,
  }))

  const deptMap: Record<string, { completadas: number; en_proceso: number; pendientes: number; avance: number[] }> = {}
  tasks.forEach((t) => {
    const d = t.departamento ?? 'Sin asignar'
    if (!deptMap[d]) deptMap[d] = { completadas: 0, en_proceso: 0, pendientes: 0, avance: [] }
    if (t.estado === 'Completado') deptMap[d].completadas++
    else if (t.estado === 'En Proceso') deptMap[d].en_proceso++
    else deptMap[d].pendientes++
    deptMap[d].avance.push(t.porcentaje_avance ?? 0)
  })

  const deptStats = Object.entries(deptMap)
    .map(([dpto, v]) => ({
      dpto: dpto.length > 14 ? `${dpto.slice(0, 14)}...` : dpto,
      ...v,
      total: v.completadas + v.en_proceso + v.pendientes,
      avance_prom: v.avance.length ? Math.round(v.avance.reduce((a, b) => a + b, 0) / v.avance.length) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const radarData = deptStats.slice(0, 6).map((d) => ({
    dept: d.dpto,
    completadas: d.completadas,
    en_proceso: d.en_proceso,
    pendientes: d.pendientes,
  }))

  const StatRow = ({
    label,
    total,
    completadas,
    en_proceso,
    pendientes,
  }: {
    label: string
    total: number
    completadas: number
    en_proceso: number
    pendientes: number
  }) => (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 flex-shrink-0 text-sm font-medium text-slate-700">{label}</span>
      <div className="grid flex-1 grid-cols-3 gap-2 text-center">
        <span className="text-xs font-semibold text-teal-600">{completadas}</span>
        <span className="text-xs font-semibold text-blue-600">{en_proceso}</span>
        <span className="text-xs font-semibold text-slate-500">{pendientes}</span>
      </div>
      <span className="w-8 text-right text-xs text-slate-400">{total}</span>
    </div>
  )

  return (
    <div className="page-stack">
      <PageHeader
        title="Estadisticas"
        subtitle="Analisis e indicadores avanzados de gestion"
        icon={<BarChart3 size={20} />}
        actions={
          <button onClick={fetch} className="action-btn h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {loading ? (
        <div className="surface-panel py-20 text-center">
          <RefreshCw size={24} className="mx-auto animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="surface-panel p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Analisis por prioridad</h3>
              <div className="mb-2 flex justify-end gap-4 text-xs font-semibold">
                <span className="text-teal-600">Completadas</span>
                <span className="text-blue-600">En proceso</span>
                <span className="text-slate-400">Pendientes</span>
              </div>
              <div className="divide-y divide-slate-50">
                {priStats.map((s) => (
                  <StatRow key={s.prioridad} label={s.prioridad} {...s} />
                ))}
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={priStats} margin={{ left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="prioridad" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    <Bar dataKey="completadas" name="Completadas" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="en_proceso" name="En Proceso" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pendientes" name="Pendientes" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-panel p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Analisis por tipo de tarea</h3>
              <div className="space-y-3">
                {tipoStats.map((s) => (
                  <div key={s.tipo} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 text-xs font-medium text-slate-600">{s.tipo}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-400">
                        <span>{s.total} tareas</span>
                        <span className="font-semibold text-teal-600">{s.pct}%</span>
                      </div>
                      <ProgressBar value={s.pct} size="md" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={tipoStats} margin={{ left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="tipo" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    <Bar dataKey="completadas" name="Completadas" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="en_proceso" name="En Proceso" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pendientes" name="Pendientes" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="surface-panel p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Avance por departamento</h3>
              <div className="space-y-3">
                {deptStats.map((d) => (
                  <div key={d.dpto}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">{d.dpto}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-teal-600">{d.avance_prom}%</span>
                        <span className="text-slate-400">{d.total} tareas</span>
                      </div>
                    </div>
                    <ProgressBar value={d.avance_prom} size="md" />
                  </div>
                ))}
              </div>
            </div>

            {radarData.length > 0 && (
              <div className="surface-panel p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Radar por departamento</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="dept" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar name="Completadas" dataKey="completadas" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.25} />
                    <Radar name="En Proceso" dataKey="en_proceso" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
