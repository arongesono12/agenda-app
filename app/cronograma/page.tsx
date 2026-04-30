'use client'
import { useState, useEffect, useCallback } from 'react'
import { GanttChartSquare, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizarTareas } from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import { format, getDaysInMonth, isWeekend, isToday, parseISO, isBefore, isAfter } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_COLOR: Record<string, string> = {
  Completado: 'bg-teal-500',
  'En Proceso': 'bg-blue-500',
  Pendiente: 'bg-slate-300',
  Cancelado: 'bg-gray-300',
}

export default function CronogramaPage() {
  const [tasks, setTasks] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [ref, setRef] = useState(new Date())
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const daysCount = getDaysInMonth(ref)

  const fetch = useCallback(async () => {
    setLoading(true)
    const monthStart = format(new Date(year, month, 1), 'yyyy-MM-dd')
    const monthEnd = format(new Date(year, month, daysCount), 'yyyy-MM-dd')
    const params = new URLSearchParams({
      page: '0',
      pageSize: '100',
      orderBy: 'fecha_inicio',
      ascending: 'true',
      summary: 'false',
      cronograma_desde: monthStart,
      cronograma_hasta: monthEnd,
    })
    const response = await window.fetch(`/api/tareas?${params.toString()}`)
    const result = (await response.json()) as { ok?: boolean; tasks?: Tarea[] }
    setTasks(response.ok && result.ok ? normalizarTareas(result.tasks ?? []) : [])
    setLoading(false)
  }, [daysCount, month, year])

  useEffect(() => {
    fetch()
  }, [fetch])

  const days = Array.from({ length: daysCount }, (_, i) => new Date(year, month, i + 1))
  const monthLabel = format(ref, 'MMMM yyyy', { locale: es })

  const prevMonth = () => setRef((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setRef((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  const getBar = (task: Tarea): { start: number; span: number } | null => {
    if (!task.fecha_inicio || !task.fecha_fin) return null

    const fi = parseISO(task.fecha_inicio)
    const ff = parseISO(task.fecha_fin)
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month, daysCount)

    if (isAfter(fi, monthEnd) || isBefore(ff, monthStart)) return null

    const start = Math.max(fi.getDate() - 1, 0)
    const end = Math.min(ff.getDate() - 1, daysCount - 1)

    if (fi.getMonth() !== month || fi.getFullYear() !== year) {
      return { start: 0, span: end + 1 }
    }

    return { start, span: end - start + 1 }
  }

  const colW = 32
  const visibleTasks = tasks.filter((task) => getBar(task))

  return (
    <div className="page-stack">
      <PageHeader
        title="Cronograma "
        subtitle={`Visualizacion de tareas por fechas · ${monthLabel}`}
        icon={<GanttChartSquare size={20} />}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="action-btn h-10 w-10 rounded-2xl p-0">
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[140px] px-2 text-center text-sm font-semibold capitalize text-slate-700">
              {monthLabel}
            </span>
            <button onClick={nextMonth} className="action-btn h-10 w-10 rounded-2xl p-0">
              <ChevronRight size={14} />
            </button>
            <button onClick={fetch} className="action-btn h-10 w-10 rounded-2xl p-0">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      <div className="surface-panel flex flex-wrap gap-4 p-4">
        {[
          { label: 'Completado', color: 'bg-teal-500' },
          { label: 'En Proceso', color: 'bg-blue-500' },
          { label: 'Pendiente', color: 'bg-slate-300' },
          { label: 'Hoy', color: 'border border-teal-400 bg-teal-200' },
          { label: 'Fin de semana', color: 'bg-slate-100' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className={`h-3 w-3 rounded-sm ${color}`} />
            {label}
          </div>
        ))}
      </div>

      <div className="surface-panel table-shell overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-teal-500" />
          </div>
        ) : (
          <>
          <div className="mobile-card-list p-4 md:hidden">
            {visibleTasks.length === 0 ? (
              <div className="mobile-card text-center text-sm text-slate-500">
                No hay tareas con fechas asignadas para este mes.
              </div>
            ) : (
              visibleTasks.map((task) => (
                <article key={task.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{task.tarea}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.responsable ?? 'Sin responsable'}</p>
                    </div>
                    <span className={`badge text-white ${STATUS_COLOR[task.estado] ?? 'bg-slate-300 text-slate-700'}`}>
                      {task.estado}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-700">Inicio</p>
                      <p className="mt-1">{task.fecha_inicio ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Fin</p>
                      <p className="mt-1">{task.fecha_fin ?? '-'}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Avance programado: <span className="font-semibold text-slate-800">{task.porcentaje_avance}%</span>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <div style={{ minWidth: 240 + daysCount * colW }}>
              <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50">
                <div className="w-60 flex-shrink-0 border-r border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
                  TAREA
                </div>
                <div className="flex">
                  {days.map((d) => {
                    const weekend = isWeekend(d)
                    const today = isToday(d)
                    return (
                      <div
                        key={d.toISOString()}
                        style={{ width: colW }}
                        className={`flex flex-shrink-0 flex-col items-center justify-center border-r border-slate-100 py-1.5 text-xs ${
                          today ? 'bg-teal-100 font-bold text-teal-700' : weekend ? 'bg-slate-100 text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        <span className="font-semibold">{d.getDate()}</span>
                        <span className="text-xs opacity-60">
                          {format(d, 'EEE', { locale: es }).slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  No hay tareas con fechas asignadas para este mes
                </div>
              ) : (
                tasks.map((task, idx) => {
                  const bar = getBar(task)
                  return (
                    <div
                      key={task.id}
                      className={`flex border-b border-slate-50 transition-colors hover:bg-slate-50/80 ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      <div className="w-60 flex-shrink-0 border-r border-slate-100 px-4 py-2.5">
                        <p className="line-clamp-1 text-xs font-semibold text-slate-700">{task.tarea}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{task.responsable ?? '-'}</p>
                      </div>

                      <div className="relative flex" style={{ width: daysCount * colW }}>
                        {days.map((d) => (
                          <div
                            key={d.toISOString()}
                            style={{ width: colW }}
                            className={`h-full min-h-[52px] flex-shrink-0 border-r border-slate-50 ${
                              isWeekend(d) ? 'bg-slate-50/60' : ''
                            } ${isToday(d) ? 'bg-teal-50/40' : ''}`}
                          />
                        ))}

                        {bar && (
                          <div
                            className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white ${
                              STATUS_COLOR[task.estado] ?? 'bg-slate-300'
                            }`}
                            style={{ left: bar.start * colW + 2, width: Math.max(bar.span * colW - 4, 20) }}
                            title={`${task.tarea} · ${task.porcentaje_avance}%`}
                          >
                            <span className="truncate">{task.porcentaje_avance}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
