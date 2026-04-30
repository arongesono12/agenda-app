'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  History,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Siren,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { normalizarTareas } from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { DEPARTAMENTOS, ESTADOS, PRIORIDADES, TIPOS_TAREA } from '@/lib/types'
import { cn, formatDateShort } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import { EstadoBadge, PrioridadBadge, SemaforoBadge, TipoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import KPICard from '@/components/ui/KPICard'
import TaskModal from '@/components/TaskModal'
import TaskHistorialModal from '@/components/TaskHistorialModal'
import TaskDetailModal from '@/components/TaskDetailModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import { useUserSession } from '@/components/UserSessionProvider'

const INIT_FILTERS = { q: '', prioridad: '', departamento: '', estado: '', tipo: '' }
const PAGE_SIZE = 25

type TaskSummary = {
  total: number
  pendientes: number
  enProceso: number
  completadas: number
  altaPrioridad: number
  vencidas: number
  urgentes: number
}

type TasksResponse = {
  ok?: boolean
  error?: string
  tasks?: Tarea[]
  total?: number
  totalPages?: number
  summary?: TaskSummary | null
}

export default function AgendaDiariaPage() {
  const { profile, canEditAgenda } = useUserSession()
  const [tasks, setTasks] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(INIT_FILTERS)
  const [page, setPage] = useState(0)
  const [totalTasks, setTotalTasks] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [summary, setSummary] = useState<TaskSummary>({
    total: 0,
    pendientes: 0,
    enProceso: 0,
    completadas: 0,
    altaPrioridad: 0,
    vencidas: 0,
    urgentes: 0,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showKpis, setShowKpis] = useState(true)
  const [modalTask, setModalTask] = useState<Tarea | null | undefined>(undefined)
  const [historialTask, setHistorialTask] = useState<Tarea | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailClosing, setDetailClosing] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Tarea | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const detailCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const today = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      orderBy: 'created_at',
    })

    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    const response = await window.fetch(`/api/tareas?${params.toString()}`)
    const result = (await response.json()) as TasksResponse

    if (response.ok && result.ok) {
      setTasks(normalizarTareas(result.tasks ?? []))
      setTotalTasks(result.total ?? 0)
      setTotalPages(result.totalPages ?? 0)
      if (result.summary) {
        setSummary(result.summary)
      }
    } else {
      setTasks([])
      setTotalTasks(0)
      setTotalPages(0)
    }
    setLoading(false)
  }, [filters, page])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    setPage(0)
  }, [filters])

  useEffect(() => {
    return () => {
      if (detailCloseTimerRef.current) {
        clearTimeout(detailCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const preferencias = normalizarPreferenciasUsuario(profile?.preferencias)
    setShowKpis(preferencias.mostrar_kpis_agenda)
    setShowFilters(preferencias.abrir_filtros_agenda)
  }, [profile?.preferencias])

  const filtered = tasks
  const selectedTask = selectedTaskId === null ? null : filtered.find((task) => task.id === selectedTaskId) ?? null
  const selectedTaskIndex = selectedTask ? filtered.findIndex((task) => task.id === selectedTask.id) : -1

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedTaskId(null)
      setDetailOpen(false)
      setDetailClosing(false)
      return
    }

    setSelectedTaskId((current) => {
      if (current !== null && filtered.some((task) => task.id === current)) return current
      return filtered[0].id
    })
  }, [filtered])

  const kpis = {
    total: summary.total,
    pendientes: summary.pendientes,
    enProceso: summary.enProceso,
    completadas: summary.completadas,
    alta: summary.altaPrioridad,
    vencidas: summary.vencidas,
    urgentes: summary.urgentes,
  }

  const requestDelete = (task: Tarea) => {
    setDeleteError('')
    setTaskToDelete(task)
  }

  const handleDelete = async () => {
    if (!taskToDelete || !canEditAgenda) return

    setDeletingId(taskToDelete.id)
    setDeleteError('')

    const response = await fetch('/api/tareas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskToDelete.id }),
    })
    const result = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !result.ok) {
      setDeleteError(result.error ?? 'No se pudo eliminar la tarea.')
      setDeletingId(null)
      return
    }

    if (selectedTaskId === taskToDelete.id) {
      setDetailOpen(false)
    }

    setTaskToDelete(null)
    setDeletingId(null)
    await fetchTasks()
  }

  const openTaskDetail = (task: Tarea) => {
    if (detailCloseTimerRef.current) {
      clearTimeout(detailCloseTimerRef.current)
      detailCloseTimerRef.current = null
    }
    setSelectedTaskId(task.id)
    setDetailClosing(false)
    setDetailOpen(true)
  }

  const closeTaskDetail = () => {
    if (!detailOpen || detailClosing) return
    setDetailClosing(true)
    detailCloseTimerRef.current = setTimeout(() => {
      setDetailOpen(false)
      setDetailClosing(false)
      detailCloseTimerRef.current = null
    }, 220)
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
          <KPICard label="Total" value={kpis.total} icon={<Target size={18} />} color="slate" layout="compact" />
          <KPICard label="Pendientes" value={kpis.pendientes} icon={<Clock3 size={18} />} color="slate" layout="compact" />
          <KPICard label="En proceso" value={kpis.enProceso} icon={<RefreshCw size={18} />} color="blue" layout="compact" />
          <KPICard label="Completadas" value={kpis.completadas} icon={<CheckCircle2 size={18} />} color="teal" layout="compact" />
          <KPICard label="Alta prioridad" value={kpis.alta} icon={<Siren size={18} />} color="red" layout="compact" />
          <KPICard label="Urgentes" value={kpis.urgentes} icon={<Clock3 size={18} />} color="amber" layout="compact" />
          <KPICard label="Vencidas" value={kpis.vencidas} icon={<AlertCircle size={18} />} color="red" layout="compact" />
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
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              className="input-shell pl-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilters((current) => !current)}
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
                  onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
                  className="input-shell"
                >
                  <option value="">Todos</option>
                  {options.map((option) => (
                    <option key={option}>{option}</option>
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
            <p className="text-sm font-semibold text-slate-800">{totalTasks} tareas encontradas</p>
            <p className="text-xs text-slate-500">
              Mostrando {filtered.length} en esta pagina. Activa una tarea para abrir su detalle.
            </p>
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
              {filtered.map((task) => (
                <article
                  key={task.id}
                  className={cn(
                    'mobile-card transition-all duration-200',
                    detailOpen && selectedTaskId === task.id && 'border-teal-200 bg-teal-50/80 shadow-[0_18px_40px_rgba(13,148,136,0.14)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mobile-card-meta">ID #{task.codigo_id ?? task.id}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{task.tarea}</p>
                      {task.seccion && <p className="mt-1 text-xs text-slate-500">{task.seccion}</p>}
                    </div>
                    <PrioridadBadge value={task.prioridad} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EstadoBadge value={task.estado} />
                    <TipoBadge value={task.tipo_tarea} />
                    <SemaforoBadge value={task.semaforo} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-700">Responsable</p>
                      <p className="mt-1">{task.responsable ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Fecha fin</p>
                      <p className="mt-1">{formatDateShort(task.fecha_fin)}</p>
                    </div>
                  </div>

                  <ProgressBar value={task.porcentaje_avance} showLabel className="mt-4" size="md" />

                  <button
                    onClick={() => openTaskDetail(task)}
                    className="mt-4 flex w-full items-center justify-between rounded-[20px] border border-white/80 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-200 hover:bg-teal-50/90 hover:text-teal-700"
                  >
                    <span>Ver detalle completo</span>
                    <ChevronDown size={16} className="-rotate-90 transition-transform" />
                  </button>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setHistorialTask(task)} className="action-btn flex-1 justify-center" title="Historial">
                      <History size={14} />
                      Historial
                    </button>
                    {canEditAgenda && (
                      <>
                        <button onClick={() => setModalTask(task)} className="action-btn flex-1 justify-center" title="Editar">
                          <Pencil size={14} />
                          Editar
                        </button>
                        <button
                          onClick={() => requestDelete(task)}
                          disabled={deletingId === task.id}
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
                <table className="w-full min-w-[1040px] text-sm">
                  <thead>
                    <tr className="border-b border-white/70 bg-white/40">
                      {['ID', 'Tarea', 'Prioridad', 'Departamento', 'Responsable', 'Fecha fin', 'Avance', 'Semaforo', 'Estado', 'Tipo', 'Acciones'].map((header) => (
                        <th key={header} className="table-header-cell whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filtered.map((task, index) => (
                      <tr
                        key={task.id}
                        onClick={() => openTaskDetail(task)}
                        aria-selected={selectedTaskId === task.id}
                        className={cn(
                          'cursor-pointer transition-colors',
                          index % 2 === 0 ? 'bg-white/10 hover:bg-white/50' : 'bg-white/30 hover:bg-white/60',
                          detailOpen && selectedTaskId === task.id && 'bg-teal-50/90 hover:bg-teal-50/90',
                        )}
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-400">{task.codigo_id ?? task.id}</td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-800">{task.tarea}</p>
                          {task.seccion && <p className="mt-1 text-xs text-slate-500">{task.seccion}</p>}
                        </td>
                        <td className="px-4 py-3"><PrioridadBadge value={task.prioridad} /></td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600">{task.departamento ?? '-'}</td>
                        <td className="max-w-[150px] px-4 py-3 text-xs font-medium text-slate-700">
                          <span className="block truncate">{task.responsable ?? '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {formatDateShort(task.fecha_fin)}
                          {task.dias_restantes !== null && task.dias_restantes !== undefined && (
                            <p className={task.dias_restantes < 0 ? 'mt-1 font-semibold text-rose-500' : task.dias_restantes <= 2 ? 'mt-1 font-semibold text-amber-500' : 'mt-1 text-slate-500'}>
                              {task.dias_restantes < 0 ? `${Math.abs(task.dias_restantes)}d vencida` : `${task.dias_restantes}d restantes`}
                            </p>
                          )}
                        </td>
                        <td className="min-w-[120px] px-4 py-3">
                          <ProgressBar value={task.porcentaje_avance} showLabel size="md" />
                        </td>
                        <td className="px-4 py-3"><SemaforoBadge value={task.semaforo} /></td>
                        <td className="px-4 py-3"><EstadoBadge value={task.estado} /></td>
                        <td className="px-4 py-3"><TipoBadge value={task.tipo_tarea} /></td>
                        <td className="pl-2 pr-3 py-3">
                          <div className="flex items-center justify-start gap-1.5">
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                setHistorialTask(task)
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-teal-600"
                              title="Historial"
                            >
                              <History size={14} />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                setModalTask(task)
                              }}
                              disabled={!canEditAgenda}
                              className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-sky-600"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                requestDelete(task)
                              }}
                              disabled={!canEditAgenda || deletingId === task.id}
                              className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-rose-600 disabled:opacity-40"
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

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Pagina {page + 1} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0 || loading}
                    className="action-btn h-10 w-10 rounded-2xl p-0 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Pagina anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
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

      {modalTask !== undefined && canEditAgenda && (
        <TaskModal task={modalTask} onClose={() => setModalTask(undefined)} onSave={fetchTasks} />
      )}

      {historialTask && (
        <TaskHistorialModal task={historialTask} onClose={() => setHistorialTask(null)} onUpdate={fetchTasks} />
      )}

      <TaskDetailModal
        task={detailOpen || detailClosing ? selectedTask : null}
        isClosing={detailClosing}
        currentIndex={selectedTaskIndex}
        totalTasks={filtered.length}
        canGoPrev={selectedTaskIndex > 0}
        canGoNext={selectedTaskIndex >= 0 && selectedTaskIndex < filtered.length - 1}
        canEditAgenda={canEditAgenda}
        onClose={closeTaskDetail}
        onPrev={() => {
          if (selectedTaskIndex > 0) {
            setSelectedTaskId(filtered[selectedTaskIndex - 1].id)
          }
        }}
        onNext={() => {
          if (selectedTaskIndex >= 0 && selectedTaskIndex < filtered.length - 1) {
            setSelectedTaskId(filtered[selectedTaskIndex + 1].id)
          }
        }}
        onEdit={(task) => {
          setDetailOpen(false)
          setDetailClosing(false)
          setModalTask(task)
        }}
        onDelete={(task) => {
          setDetailOpen(false)
          setDetailClosing(false)
          requestDelete(task)
        }}
        onOpenHistory={(task) => {
          setDetailOpen(false)
          setDetailClosing(false)
          setHistorialTask(task)
        }}
      />

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
