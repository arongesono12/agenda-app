'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  History,
  ChevronDown,
  Search,
  Filter,
  X,
  AlertCircle,
  Target,
  Clock3,
  CheckCircle2,
  Siren,
} from 'lucide-react'
import {
  normalizarTareas,
  SEMAFORO_URGENTE,
  SEMAFORO_VENCIDA,
  supabase,
} from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { DEPARTAMENTOS, PRIORIDADES, ESTADOS, TIPOS_TAREA } from '@/lib/types'
import { formatDateShort } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import { PrioridadBadge, EstadoBadge, TipoBadge, SemaforoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import KPICard from '@/components/ui/KPICard'
import TaskModal from '@/components/TaskModal'
import TaskHistorialModal from '@/components/TaskHistorialModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import { useUserSession } from '@/components/UserSessionProvider'

const INIT_FILTERS = { q: '', prioridad: '', departamento: '', estado: '', tipo: '' }

export default function AgendaDiariaPage() {
  const { profile, canEditAgenda } = useUserSession()
  const [tasks, setTasks] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(INIT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [showKpis, setShowKpis] = useState(true)
  const [modalTask, setModalTask] = useState<Tarea | null | undefined>(undefined)
  const [historialTask, setHistorialTask] = useState<Tarea | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Tarea | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const today = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tareas').select('*').order('created_at', { ascending: false })
    setTasks(normalizarTareas(data as Tarea[] | null))
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    const preferencias = normalizarPreferenciasUsuario(profile?.preferencias)
    setShowKpis(preferencias.mostrar_kpis_agenda)
    setShowFilters(preferencias.abrir_filtros_agenda)
  }, [profile?.preferencias])

  const filtered = tasks.filter((t) => {
    if (
      filters.q &&
      !t.tarea.toLowerCase().includes(filters.q.toLowerCase()) &&
      !(t.responsable ?? '').toLowerCase().includes(filters.q.toLowerCase())
    ) return false
    if (filters.prioridad && t.prioridad !== filters.prioridad) return false
    if (filters.departamento && t.departamento !== filters.departamento) return false
    if (filters.estado && t.estado !== filters.estado) return false
    if (filters.tipo && t.tipo_tarea !== filters.tipo) return false
    return true
  })

  const kpis = {
    total: tasks.length,
    pendientes: tasks.filter((t) => t.estado === 'Pendiente').length,
    enProceso: tasks.filter((t) => t.estado === 'En Proceso').length,
    completadas: tasks.filter((t) => t.estado === 'Completado').length,
    alta: tasks.filter((t) => t.prioridad === 'Alta').length,
    vencidas: tasks.filter((t) => t.semaforo === SEMAFORO_VENCIDA).length,
    urgentes: tasks.filter((t) => t.semaforo === SEMAFORO_URGENTE).length,
  }

  const requestDelete = (task: Tarea) => {
    setDeleteError('')
    setTaskToDelete(task)
  }

  const handleDelete = async () => {
    if (!taskToDelete || !canEditAgenda) return

    setDeletingId(taskToDelete.id)
    setDeleteError('')

    const { error } = await supabase.from('tareas').delete().eq('id', taskToDelete.id)

    if (error) {
      setDeleteError(error.message)
      setDeletingId(null)
      return
    }

    setTaskToDelete(null)
    setDeletingId(null)
    await fetchTasks()
  }

  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div className="page-stack">
      <PageHeader
        title="Agenda de control"
        subtitle={`Vista diaria del equipo. Hoy es ${today}. Gestiona prioridades, vencimientos y responsables desde un panel central.`}
        icon={<CalendarDays size={22} />}
        actions={
          <>
            <button onClick={() => void fetchTasks()} className="action-btn h-12 w-12 rounded-2xl p-0">
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            {canEditAgenda && (
              <button onClick={() => setModalTask(null)} className="action-btn-primary">
                <Plus size={16} /> Nueva tarea
              </button>
            )}
          </>
        }
      />

      {showKpis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <KPICard label="Total" value={kpis.total} icon={<Target size={18} />} color="slate" />
          <KPICard label="Pendientes" value={kpis.pendientes} icon={<Clock3 size={18} />} color="slate" />
          <KPICard label="En proceso" value={kpis.enProceso} icon={<RefreshCw size={18} />} color="blue" />
          <KPICard label="Completadas" value={kpis.completadas} icon={<CheckCircle2 size={18} />} color="teal" />
          <KPICard label="Alta prioridad" value={kpis.alta} icon={<Siren size={18} />} color="red" />
          <KPICard label="Urgentes" value={kpis.urgentes} icon={<Clock3 size={18} />} color="amber" />
          <KPICard label="Vencidas" value={kpis.vencidas} icon={<AlertCircle size={18} />} color="red" />
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por tarea o responsable..."
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              className="input-shell pl-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={showFilters || activeFilters > 0 ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700' : 'action-btn'}
            >
              <Filter size={15} />
              Filtros
              {activeFilters > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] text-white">
                  {activeFilters}
                </span>
              )}
              <ChevronDown size={14} className={showFilters ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {activeFilters > 0 && (
              <button onClick={() => setFilters(INIT_FILTERS)} className="action-btn-ghost">
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-white/70 px-4 pb-4 pt-1 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { key: 'prioridad', label: 'Prioridad', options: PRIORIDADES },
              { key: 'departamento', label: 'Departamento', options: DEPARTAMENTOS },
              { key: 'estado', label: 'Estado', options: ESTADOS },
              { key: 'tipo', label: 'Tipo de tarea', options: TIPOS_TAREA },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="label-field">{label}</label>
                <select
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                  className="input-shell"
                >
                  <option value="">Todos</option>
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="surface-panel table-shell overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{filtered.length} tareas visibles</p>
            <p className="text-xs text-slate-500">Actualizado en tiempo real para seguimiento diario</p>
          </div>
          <span className="section-label self-start sm:self-auto">Panel diario</span>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-teal-600" />
            <p className="mt-3 text-sm text-slate-500">Cargando tareas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <AlertCircle size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No se encontraron tareas</p>
            <p className="mt-1 text-xs text-slate-500">Prueba con otros filtros o crea una nueva tarea.</p>
          </div>
        ) : (
          <>
            <div className="mobile-card-list p-4 md:hidden">
              {filtered.map((t) => (
                <article key={t.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mobile-card-meta">ID #{t.codigo_id ?? t.id}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{t.tarea}</p>
                      {t.seccion && <p className="mt-1 text-xs text-slate-500">{t.seccion}</p>}
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

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setHistorialTask(t)} className="action-btn flex-1 justify-center" title="Historial">
                      <History size={14} />
                      Historial
                    </button>
                    {canEditAgenda && (
                      <>
                        <button onClick={() => setModalTask(t)} className="action-btn flex-1 justify-center" title="Editar">
                          <Pencil size={14} />
                          Editar
                        </button>
                        <button
                          onClick={() => requestDelete(t)}
                          disabled={deletingId === t.id}
                          className="action-btn flex-1 justify-center text-rose-600 disabled:opacity-40"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden md:block">
              <div className="table-container">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-white/70 bg-white/40">
                      {['ID', 'Tarea', 'Prioridad', 'Departamento', 'Responsable', 'Fecha fin', 'Avance', 'Semaforo', 'Estado', 'Tipo', 'Acciones'].map((h) => (
                        <th key={h} className="table-header-cell whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filtered.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? 'bg-white/10 transition-colors hover:bg-white/50' : 'bg-white/30 transition-colors hover:bg-white/60'}>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-400">{t.codigo_id ?? t.id}</td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-800">{t.tarea}</p>
                          {t.seccion && <p className="mt-1 text-xs text-slate-500">{t.seccion}</p>}
                        </td>
                        <td className="px-4 py-3"><PrioridadBadge value={t.prioridad} /></td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600">{t.departamento ?? '-'}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{t.responsable ?? '-'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {formatDateShort(t.fecha_fin)}
                          {t.dias_restantes !== null && t.dias_restantes !== undefined && (
                            <p className={t.dias_restantes < 0 ? 'mt-1 font-semibold text-rose-500' : t.dias_restantes <= 2 ? 'mt-1 font-semibold text-amber-500' : 'mt-1 text-slate-500'}>
                              {t.dias_restantes < 0 ? `${Math.abs(t.dias_restantes)}d vencida` : `${t.dias_restantes}d restantes`}
                            </p>
                          )}
                        </td>
                        <td className="min-w-[140px] px-4 py-3">
                          <ProgressBar value={t.porcentaje_avance} showLabel size="md" />
                        </td>
                        <td className="px-4 py-3"><SemaforoBadge value={t.semaforo} /></td>
                        <td className="px-4 py-3"><EstadoBadge value={t.estado} /></td>
                        <td className="px-4 py-3"><TipoBadge value={t.tipo_tarea} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHistorialTask(t)}
                              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-teal-600"
                              title="Historial"
                            >
                              <History size={14} />
                            </button>
                        <button
                          onClick={() => setModalTask(t)}
                          disabled={!canEditAgenda}
                          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-sky-600"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => requestDelete(t)}
                          disabled={!canEditAgenda || deletingId === t.id}
                          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-rose-600 disabled:opacity-40"
                          title="Eliminar"
                        >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {modalTask !== undefined && canEditAgenda && (
        <TaskModal task={modalTask} onClose={() => setModalTask(undefined)} onSave={fetchTasks} />
      )}
      {historialTask && (
        <TaskHistorialModal task={historialTask} onClose={() => setHistorialTask(null)} />
      )}
      <ConfirmDialog
        open={!!taskToDelete}
        title="Eliminar tarea"
        description="Confirma si deseas eliminar esta tarea antes de continuar."
        confirmLabel="Si, eliminar tarea"
        loading={deletingId === taskToDelete?.id}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (deletingId === taskToDelete?.id) return
          setDeleteError('')
          setTaskToDelete(null)
        }}
      >
        {taskToDelete && (
          <div className="rounded-[24px] border border-white/80 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Tarea seleccionada
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              #{taskToDelete.codigo_id ?? taskToDelete.id} · {taskToDelete.tarea}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Responsable: {taskToDelete.responsable ?? 'Sin asignar'}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
