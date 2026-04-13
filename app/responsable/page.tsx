'use client'
import { useState, useEffect, useCallback } from 'react'
import { User, RefreshCw, ChevronDown, CheckCircle2, Clock, AlertTriangle, Target } from 'lucide-react'
import { normalizarTareas, supabase } from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { formatDateShort } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import KPICard from '@/components/ui/KPICard'
import { PrioridadBadge, EstadoBadge, SemaforoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'

export default function ResponsablePage() {
  const [allTasks, setAllTasks] = useState<Tarea[]>([])
  const [responsables, setResponsables] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tareas').select('*').order('fecha_fin')
    const tasks = normalizarTareas(data as Tarea[] | null)
    setAllTasks(tasks)
    const unique = [...new Set(tasks.map((t) => t.responsable).filter(Boolean))] as string[]
    setResponsables(unique.sort())
    if (unique.length > 0 && !selected) setSelected(unique[0])
    setLoading(false)
  }, [selected])

  useEffect(() => {
    fetch()
  }, [fetch])

  const myTasks = allTasks.filter((t) => t.responsable === selected)
  const kpis = {
    total: myTasks.length,
    enProceso: myTasks.filter((t) => t.estado === 'En Proceso').length,
    completadas: myTasks.filter((t) => t.estado === 'Completado').length,
    pendientes: myTasks.filter((t) => t.estado === 'Pendiente').length,
    avance: myTasks.length ? Math.round(myTasks.reduce((a, t) => a + (t.porcentaje_avance ?? 0), 0) / myTasks.length) : 0,
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Vista por responsable"
        subtitle="Consulta la carga individual, el avance promedio y el backlog asignado por persona."
        icon={<User size={22} />}
        actions={
          <button onClick={fetch} className="action-btn h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="surface-panel p-5">
        <label className="label-field">Seleccionar responsable</label>
        <div className="relative max-w-md">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="input-shell appearance-none pr-10"
          >
            <option value="">Seleccionar</option>
            {responsables.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {selected && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <KPICard label="Total tareas" value={kpis.total} icon={<Target size={18} />} color="slate" />
            <KPICard label="En proceso" value={kpis.enProceso} icon={<Clock size={18} />} color="blue" />
            <KPICard label="Completadas" value={kpis.completadas} icon={<CheckCircle2 size={18} />} color="teal" />
            <KPICard label="Pendientes" value={kpis.pendientes} icon={<AlertTriangle size={18} />} color="amber" />
            <KPICard label="Avance" value={`${kpis.avance}%`} icon={<Target size={18} />} color="teal" />
          </div>

          <div className="surface-panel table-shell overflow-hidden">
            <div className="border-b border-white/70 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">{selected}</p>
              <p className="text-xs text-slate-500">{myTasks.length} tarea{myTasks.length !== 1 ? 's' : ''} asignada{myTasks.length !== 1 ? 's' : ''}</p>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-500">Sin tareas asignadas.</div>
            ) : (
              <div className="table-container">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-white/70 bg-white/40">
                      {['Tarea', 'Prioridad', 'Departamento', 'Fecha fin', 'Avance', 'Semaforo', 'Estado'].map((h) => (
                        <th key={h} className="table-header-cell whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {myTasks.map((t, index) => (
                      <tr key={t.id} className={index % 2 === 0 ? 'bg-white/10 hover:bg-white/50' : 'bg-white/30 hover:bg-white/60'}>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-800">{t.tarea}</p>
                          {t.notas && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{t.notas}</p>}
                        </td>
                        <td className="px-4 py-3"><PrioridadBadge value={t.prioridad} /></td>
                        <td className="px-4 py-3 text-xs text-slate-600">{t.departamento ?? '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateShort(t.fecha_fin)}</td>
                        <td className="px-4 py-3 min-w-[130px]"><ProgressBar value={t.porcentaje_avance} showLabel size="md" /></td>
                        <td className="px-4 py-3"><SemaforoBadge value={t.semaforo} /></td>
                        <td className="px-4 py-3"><EstadoBadge value={t.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!selected && !loading && responsables.length === 0 && (
        <div className="surface-panel py-20 text-center">
          <User size={32} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">No hay responsables asignados en las tareas.</p>
        </div>
      )}
    </div>
  )
}
