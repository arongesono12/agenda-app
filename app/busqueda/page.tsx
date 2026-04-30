'use client'
import { useState, useCallback } from 'react'
import { Search, SlidersHorizontal, X, Loader2, History, ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizarTareas } from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { DEPARTAMENTOS, PRIORIDADES, ESTADOS, TIPOS_TAREA } from '@/lib/types'
import { formatDateShort } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import TaskHistorialModal from '@/components/TaskHistorialModal'
import { PrioridadBadge, EstadoBadge, TipoBadge, SemaforoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'

const INIT = { q: '', prioridad: '', departamento: '', responsable: '', estado: '', tipo: '', fecha_desde: '', fecha_hasta: '' }
const PAGE_SIZE = 50

type SearchResponse = {
  ok?: boolean
  error?: string
  tasks?: Tarea[]
  total?: number
  totalPages?: number
}

export default function BusquedaPage() {
  const [filters, setFilters] = useState(INIT)
  const [results, setResults] = useState<Tarea[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [historialTask, setHistorialTask] = useState<Tarea | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }))

  const search = useCallback(async (nextPage = page) => {
    setLoading(true)
    setSearched(true)

    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
      orderBy: 'created_at',
      summary: 'false',
    })

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    const response = await window.fetch(`/api/tareas?${params.toString()}`)
    const result = (await response.json()) as SearchResponse

    if (response.ok && result.ok) {
      setResults(normalizarTareas(result.tasks ?? []))
      setTotal(result.total ?? 0)
      setTotalPages(result.totalPages ?? 0)
      setPage(nextPage)
    } else {
      setResults([])
      setTotal(0)
      setTotalPages(0)
    }

    setLoading(false)
  }, [filters, page])

  const clear = () => {
    setFilters(INIT)
    setResults([])
    setSearched(false)
    setPage(0)
    setTotal(0)
    setTotalPages(0)
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="page-stack">
      <PageHeader
        title="Busqueda avanzada"
        subtitle="Cruza criterios y encuentra rapidamente tareas por responsable, fechas, estado o prioridad."
        icon={<Search size={22} />}
      />

      <div className="surface-panel p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-teal-600" />
              <p className="text-sm font-semibold text-slate-900">Criterios de busqueda</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Combina filtros para afinar el resultado.</p>
          </div>
          {activeCount > 0 && (
            <button onClick={clear} className="action-btn-ghost sm:ml-auto">
              <X size={14} />
              Limpiar {activeCount} filtro{activeCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label-field">Buscar por descripcion, ID o codigo</label>
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => set('q', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search(0)}
                placeholder="Descripcion de la tarea, ID (#42) o codigo manual..."
                className="input-shell pl-11"
              />
            </div>
          </div>
          <div>
            <label className="label-field">Responsable</label>
            <input type="text" value={filters.responsable} onChange={(e) => set('responsable', e.target.value)} placeholder="Nombre del responsable" className="input-shell" />
          </div>
          <div>
            <label className="label-field">Prioridad</label>
            <select value={filters.prioridad} onChange={(e) => set('prioridad', e.target.value)} className="input-shell">
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Departamento</label>
            <select value={filters.departamento} onChange={(e) => set('departamento', e.target.value)} className="input-shell">
              <option value="">Todos</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Estado</label>
            <select value={filters.estado} onChange={(e) => set('estado', e.target.value)} className="input-shell">
              <option value="">Todos</option>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Tipo de tarea</label>
            <select value={filters.tipo} onChange={(e) => set('tipo', e.target.value)} className="input-shell">
              <option value="">Todos</option>
              {TIPOS_TAREA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Fecha fin desde</label>
            <input type="date" value={filters.fecha_desde} onChange={(e) => set('fecha_desde', e.target.value)} className="input-shell" />
          </div>
          <div>
            <label className="label-field">Fecha fin hasta</label>
            <input type="date" value={filters.fecha_hasta} onChange={(e) => set('fecha_hasta', e.target.value)} className="input-shell" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => search(0)} className="action-btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Buscar
          </button>
          <button onClick={clear} className="action-btn-ghost">Restablecer</button>
        </div>
      </div>

      {searched && (
        <div className="surface-panel table-shell overflow-hidden">
          <div className="border-b border-white/70 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">
              {loading ? 'Buscando...' : `${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
            </p>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 size={24} className="mx-auto animate-spin text-teal-600" /></div>
          ) : results.length === 0 ? (
            <div className="py-20 text-center">
              <Search size={28} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-600">No se encontraron tareas con esos criterios.</p>
            </div>
          ) : (
            <>
            <div className="mobile-card-list p-4 md:hidden">
              {results.map((t) => (
                <article key={t.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mobile-card-meta">ID #{t.codigo_id ?? t.id}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{t.tarea}</p>
                    </div>
                    <PrioridadBadge value={t.prioridad} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EstadoBadge value={t.estado} />
                    <TipoBadge value={t.tipo_tarea} />
                    <SemaforoBadge value={t.semaforo} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-700">Responsable</p>
                      <p className="mt-1">{t.responsable ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Fecha fin</p>
                      <p className="mt-1">{formatDateShort(t.fecha_fin)}</p>
                    </div>
                  </div>

                  <ProgressBar value={t.porcentaje_avance} showLabel className="mt-4" size="md" />

                  <button onClick={() => setHistorialTask(t)} className="action-btn mt-4 w-full justify-center" title="Historial">
                    <History size={14} />
                    Historial
                  </button>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
            <div className="table-container">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-white/70 bg-white/40">
                    {['ID', 'Tarea', 'Prioridad', 'Departamento', 'Responsable', 'Fecha fin', 'Avance', 'Semaforo', 'Estado', 'Tipo', 'Acciones'].map((h) => (
                      <th key={h} className="table-header-cell whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {results.map((t, index) => (
                    <tr key={t.id} className={index % 2 === 0 ? 'bg-white/10 hover:bg-white/50' : 'bg-white/30 hover:bg-white/60'}>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-400">{t.codigo_id ?? t.id}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">{t.tarea}</p>
                      </td>
                      <td className="px-4 py-3"><PrioridadBadge value={t.prioridad} /></td>
                      <td className="px-4 py-3 text-xs text-slate-600">{t.departamento ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{t.responsable ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateShort(t.fecha_fin)}</td>
                      <td className="px-4 py-3 min-w-[120px]"><ProgressBar value={t.porcentaje_avance} showLabel /></td>
                      <td className="px-4 py-3"><SemaforoBadge value={t.semaforo} /></td>
                      <td className="px-4 py-3"><EstadoBadge value={t.estado} /></td>
                      <td className="px-4 py-3"><TipoBadge value={t.tipo_tarea} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setHistorialTask(t)}
                          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-teal-600"
                          title="Historial"
                        >
                          <History size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/70 px-5 py-4">
                <p className="text-xs text-slate-500">
                  Pagina {page + 1} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => search(Math.max(0, page - 1))}
                    disabled={page === 0 || loading}
                    className="action-btn h-10 w-10 rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Pagina anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => search(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    className="action-btn h-10 w-10 rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Pagina siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {historialTask && (
        <TaskHistorialModal task={historialTask} onClose={() => setHistorialTask(null)} />
      )}
    </div>
  )
}
