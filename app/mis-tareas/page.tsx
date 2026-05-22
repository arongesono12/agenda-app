'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckSquare,
  Circle,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import KPICard from '@/components/ui/KPICard'
import { cn } from '@/lib/utils'

type MiTarea = {
  id: number
  titulo: string
  descripcion?: string | null
  fecha?: string | null
  completada: boolean
  completada_at?: string | null
  created_at?: string
  updated_at?: string
}

type ApiResponse = {
  ok?: boolean
  error?: string
  tareas?: MiTarea[]
  tarea?: MiTarea
}

const ESTADOS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'completadas', label: 'Completadas' },
] as const

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isOverdue(task: MiTarea) {
  if (!task.fecha || task.completada) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(`${task.fecha}T00:00:00`)
  return date < today
}

export default function MisTareasPage() {
  const [tasks, setTasks] = useState<MiTarea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]['value']>('pendientes')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha: '' })

  const stats = useMemo(() => {
    const total = tasks.length
    const completadas = tasks.filter((task) => task.completada).length
    const vencidas = tasks.filter(isOverdue).length
    return { total, pendientes: total - completadas, completadas, vencidas }
  }, [tasks])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (estado !== 'todas') params.set('estado', estado)
      if (query.trim()) params.set('q', query.trim())

      const response = await fetch(`/api/mis-tareas?${params.toString()}`, { cache: 'no-store' })
      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron cargar tus tareas.')
      setTasks(result.tareas ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [estado, query])

  useEffect(() => {
    const timer = setTimeout(() => void loadTasks(), 180)
    return () => clearTimeout(timer)
  }, [loadTasks])

  const resetForm = () => {
    setEditingId(null)
    setForm({ titulo: '', descripcion: '', fecha: '' })
  }

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.titulo.trim()) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/mis-tareas', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          fecha: form.fecha || null,
        }),
      })
      const result = (await response.json()) as ApiResponse
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo guardar la tarea.')

      resetForm()
      await loadTasks()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setSaving(false)
    }
  }

  const toggleTask = async (task: MiTarea) => {
    const nextCompleted = !task.completada
    const previous = tasks

    setTasks((current) => {
      const updated = current.map((item) => item.id === task.id ? { ...item, completada: nextCompleted } : item)
      if (estado === 'pendientes' && nextCompleted) return updated.filter((item) => item.id !== task.id)
      if (estado === 'completadas' && !nextCompleted) return updated.filter((item) => item.id !== task.id)
      return updated
    })

    const response = await fetch('/api/mis-tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, completada: nextCompleted }),
    })
    const result = (await response.json()) as ApiResponse

    if (!response.ok || !result.ok) {
      setTasks(previous)
      setError(result.error ?? 'No se pudo actualizar la tarea.')
      await loadTasks()
    }
  }

  const startEdit = (task: MiTarea) => {
    setEditingId(task.id)
    setForm({
      titulo: task.titulo,
      descripcion: task.descripcion ?? '',
      fecha: task.fecha ?? '',
    })
  }

  const deleteTask = async (task: MiTarea) => {
    if (!confirm('¿Eliminar esta tarea personal?')) return

    const previous = tasks
    setTasks((current) => current.filter((item) => item.id !== task.id))

    const response = await fetch(`/api/mis-tareas?id=${task.id}`, { method: 'DELETE' })
    const result = (await response.json()) as ApiResponse

    if (!response.ok || !result.ok) {
      setTasks(previous)
      setError(result.error ?? 'No se pudo eliminar la tarea.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Mis tareas"
        subtitle="Organiza tus pendientes personales sin mezclarlos con las tareas oficiales del organismo."
        icon={<CheckSquare size={22} />}
        actions={
          <button onClick={() => void loadTasks()} className="action-btn h-12 w-12 rounded-2xl p-0" aria-label="Recargar mis tareas">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Total" value={stats.total} icon={<Target size={18} />} color="slate" layout="compact" />
        <KPICard label="Pendientes" value={stats.pendientes} icon={<Clock3 size={18} />} color="amber" layout="compact" />
        <KPICard label="Completadas" value={stats.completadas} icon={<CheckSquare size={18} />} color="teal" layout="compact" />
        <KPICard label="Vencidas" value={stats.vencidas} icon={<AlertCircle size={18} />} color="red" layout="compact" />
      </div>

      <section className="surface-panel-strong p-5 sm:p-6">
        <form onSubmit={(event) => void submitTask(event)} className="grid gap-3 lg:grid-cols-[1.2fr_1fr_12rem_auto]">
          <div>
            <label className="label-field">Tarea</label>
            <input
              value={form.titulo}
              onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))}
              className="input-shell"
              placeholder="Ej. Revisar mis notas de la reunion"
              maxLength={180}
            />
          </div>
          <div>
            <label className="label-field">Detalle</label>
            <input
              value={form.descripcion}
              onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))}
              className="input-shell"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="label-field">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
              className="input-shell"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving || !form.titulo.trim()}
              className="action-btn-primary h-12 justify-center disabled:translate-y-0 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Check size={15} /> : <Plus size={15} />}
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="action-btn h-12 w-12 rounded-2xl p-0" aria-label="Cancelar edicion">
                <X size={16} />
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/70 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-shell pl-11"
              placeholder="Buscar en mis tareas..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setEstado(item.value)}
                className={estado === item.value ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700' : 'action-btn'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
            <p className="mt-3 text-sm text-slate-500">Cargando tus tareas...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-24 text-center">
            <CheckSquare size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No hay tareas personales</p>
            <p className="mt-1 text-xs text-slate-500">Agrega tu primer pendiente para organizar tu jornada.</p>
          </div>
        ) : (
          <div className="mobile-card-list p-4">
            {tasks.map((task) => (
              <article
                key={task.id}
                className={cn(
                  'mobile-card transition-all duration-200',
                  task.completada && 'opacity-70'
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void toggleTask(task)}
                    className={cn(
                      'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl border transition-colors',
                      task.completada
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white/80 text-slate-400 hover:border-teal-200 hover:text-teal-700'
                    )}
                    aria-label={task.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                  >
                    {task.completada ? <Check size={15} /> : <Circle size={15} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold text-slate-800', task.completada && 'text-slate-400 line-through')}>
                      {task.titulo}
                    </p>
                    {task.descripcion && (
                      <p className={cn('mt-1 text-xs text-slate-500', task.completada && 'text-slate-400')}>
                        {task.descripcion}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'badge',
                    isOverdue(task)
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white/70 text-slate-500'
                  )}>
                    <CalendarDays size={12} />
                    {formatDate(task.fecha)}
                  </span>
                  {task.completada && (
                    <span className="badge border-teal-200 bg-teal-50 text-teal-700">
                      <Check size={12} />
                      Completada
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editingId === task.id ? resetForm() : startEdit(task)}
                    className={cn(
                      'action-btn flex-1 justify-center',
                      editingId === task.id && 'border-amber-200 bg-amber-50/90 text-amber-700'
                    )}
                  >
                    {editingId === task.id ? <X size={14} /> : <Pencil size={14} />}
                    {editingId === task.id ? 'Cancelar' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTask(task)}
                    className="action-btn flex-1 justify-center text-rose-600"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
