'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Edit3, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/ToastProvider'
import { useUserSession } from '@/components/UserSessionProvider'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import type { CalendarioColor, CalendarioEvento, CalendarioTipoEvento } from '@/lib/types'

type CalendarForm = {
  id?: string
  titulo: string
  descripcion: string
  tipo_evento: CalendarioTipoEvento
  fecha_inicio: string
  fecha_fin: string
  es_festivo: boolean
  color: CalendarioColor
}

const EMPTY_FORM: CalendarForm = {
  titulo: '',
  descripcion: '',
  tipo_evento: 'evento',
  fecha_inicio: todayDateOnly(),
  fecha_fin: '',
  es_festivo: false,
  color: 'teal',
}

const TIPO_LABELS: Record<CalendarioTipoEvento, string> = {
  festivo: 'Festivo',
  evento: 'Evento',
  actividad: 'Actividad',
  aviso: 'Aviso',
  fecha_limite: 'Fecha limite',
}

const COLOR_LABELS: Record<CalendarioColor, string> = {
  teal: 'Verde',
  sky: 'Azul',
  amber: 'Ambar',
  rose: 'Rojo',
  violet: 'Violeta',
  slate: 'Gris',
}

const EVENT_COLOR_CLASSES: Record<CalendarioColor, string> = {
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
}

const DOT_COLOR_CLASSES: Record<CalendarioColor, string> = {
  teal: 'bg-teal-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-500',
}

function todayDateOnly() {
  const now = new Date()
  return toDateOnly(now)
}

function toDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatLongDate(value: string) {
  return parseDateOnly(value).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function eventCoversDate(evento: CalendarioEvento, dateOnly: string) {
  const end = evento.fecha_fin || evento.fecha_inicio
  return evento.fecha_inicio <= dateOnly && end >= dateOnly
}

function eventRangeLabel(evento: CalendarioEvento) {
  if (!evento.fecha_fin || evento.fecha_fin === evento.fecha_inicio) return formatLongDate(evento.fecha_inicio)
  return `${formatLongDate(evento.fecha_inicio)} - ${formatLongDate(evento.fecha_fin)}`
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      dateOnly: toDateOnly(date),
      inMonth: date.getMonth() === month,
      isToday: toDateOnly(date) === todayDateOnly(),
    }
  })
}

export default function CalendarioPage() {
  const toast = useToast()
  const { rolEnOrganismo, organismoActivo } = useUserSession()
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayDateOnly())
  const [eventos, setEventos] = useState<CalendarioEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CalendarForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  const canManageCalendar = !!rolEnOrganismo && ADMIN_ROLE_CODES.includes(rolEnOrganismo as (typeof ADMIN_ROLE_CODES)[number])
  const monthKey = toMonthKey(monthDate)

  const loadEventos = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/calendario?month=${monthKey}`, { cache: 'no-store' })
      const result = (await response.json()) as { ok?: boolean; eventos?: CalendarioEvento[]; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo cargar el calendario.')
      setEventos(result.eventos ?? [])
    } catch (loadError: unknown) {
      toast.error(loadError instanceof Error ? loadError.message : 'No se pudo cargar el calendario.')
    } finally {
      setLoading(false)
    }
  }, [monthKey, toast])

  useEffect(() => {
    void loadEventos()
  }, [loadEventos])

  const days = useMemo(() => buildCalendarDays(monthDate), [monthDate])
  const selectedEvents = useMemo(
    () => eventos.filter((evento) => eventCoversDate(evento, selectedDate)),
    [eventos, selectedDate]
  )
  const festivos = useMemo(() => eventos.filter((evento) => evento.es_festivo || evento.tipo_evento === 'festivo'), [eventos])

  const resetForm = (date = selectedDate) => {
    setForm({ ...EMPTY_FORM, fecha_inicio: date, fecha_fin: '' })
    setError('')
  }

  const openCreate = (date = selectedDate) => {
    resetForm(date)
    setShowForm(true)
  }

  const openEdit = (evento: CalendarioEvento) => {
    setForm({
      id: evento.id,
      titulo: evento.titulo,
      descripcion: evento.descripcion ?? '',
      tipo_evento: evento.tipo_evento,
      fecha_inicio: evento.fecha_inicio,
      fecha_fin: evento.fecha_fin ?? '',
      es_festivo: evento.es_festivo,
      color: evento.color,
    })
    setError('')
    setShowForm(true)
  }

  const changeMonth = (offset: number) => {
    setMonthDate((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1)
      setSelectedDate(toDateOnly(new Date(next.getFullYear(), next.getMonth(), 1)))
      return next
    })
  }

  const submitEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/calendario', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fecha_fin: form.fecha_fin || null,
        }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo guardar el evento.')

      toast.success(form.id ? 'Evento actualizado.' : 'Evento creado.')
      setShowForm(false)
      resetForm()
      await loadEventos()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el evento.')
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async (evento: CalendarioEvento) => {
    if (!window.confirm(`Eliminar "${evento.titulo}" del calendario?`)) return
    try {
      const response = await fetch(`/api/calendario?id=${evento.id}`, { method: 'DELETE' })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo eliminar el evento.')
      toast.success('Evento eliminado.')
      await loadEventos()
    } catch (deleteError: unknown) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el evento.')
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Calendario"
        subtitle={`Festivos y eventos institucionales${organismoActivo?.nombre ? ` de ${organismoActivo.nombre}` : ''}.`}
        icon={<CalendarDays size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void loadEventos()} className="action-btn icon-action-btn h-12 w-12 rounded-2xl" aria-label="Actualizar calendario">
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManageCalendar && (
              <button type="button" onClick={() => openCreate()} className="action-btn-primary">
                <Plus size={15} />
                Nuevo evento
              </button>
            )}
          </div>
        }
      />

      <section className="surface-panel-strong p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-white/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vista mensual</p>
            <h2 className="mt-1 text-xl font-semibold capitalize text-slate-900">
              {monthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} className="action-btn icon-action-btn h-10 w-10 rounded-2xl" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => { const now = new Date(); setMonthDate(now); setSelectedDate(todayDateOnly()) }} className="action-btn h-10 rounded-2xl px-4 text-sm">
              Hoy
            </button>
            <button type="button" onClick={() => changeMonth(1)} className="action-btn icon-action-btn h-10 w-10 rounded-2xl" aria-label="Mes siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const dayEvents = eventos.filter((evento) => eventCoversDate(evento, day.dateOnly))
            const selected = selectedDate === day.dateOnly
            return (
              <button
                key={day.dateOnly}
                type="button"
                onClick={() => setSelectedDate(day.dateOnly)}
                onDoubleClick={() => canManageCalendar && openCreate(day.dateOnly)}
                className={`min-h-[5.75rem] rounded-[18px] border p-2 text-left transition-colors sm:min-h-[7rem] ${
                  selected
                    ? 'border-teal-300 bg-teal-50/90'
                    : day.inMonth
                      ? 'border-white/80 bg-white/55 hover:bg-white/80'
                      : 'border-white/50 bg-white/25 opacity-60 hover:bg-white/55'
                }`}
              >
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold sm:h-10 sm:w-10 sm:text-lg ${
                  day.isToday ? 'bg-slate-900 text-white' : selected ? 'text-teal-800' : 'text-slate-700'
                }`}>
                  {day.date.getDate()}
                </span>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 3).map((evento) => (
                    <span key={evento.id} className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_COLOR_CLASSES[evento.color]}`} />
                      <span className="truncate">{evento.titulo}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="block text-[10px] font-semibold text-slate-400">+{dayEvents.length - 3} mas</span>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
        <section className="surface-panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dia seleccionado</p>
              <h3 className="mt-1 text-lg font-semibold capitalize text-slate-900">{formatLongDate(selectedDate)}</h3>
            </div>
            {canManageCalendar && (
              <button type="button" onClick={() => openCreate(selectedDate)} className="action-btn-primary">
                <Plus size={15} />
                Agregar
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="rounded-[22px] border border-white/80 bg-white/55 px-4 py-8 text-center">
                <CalendarDays size={26} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No hay eventos para este dia.</p>
              </div>
            ) : (
              selectedEvents.map((evento) => (
                <article key={evento.id} className="rounded-[22px] border border-white/80 bg-white/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge ${EVENT_COLOR_CLASSES[evento.color]}`}>{TIPO_LABELS[evento.tipo_evento]}</span>
                        {evento.es_festivo && <span className="badge border-rose-200 bg-rose-50 text-rose-700">Festivo</span>}
                        {evento.origen === 'festivos_guinea_ecuatorial' && (
                          <span className="badge border-sky-200 bg-sky-50 text-sky-700">Oficial GQ</span>
                        )}
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-slate-900">{evento.titulo}</h4>
                      <p className="mt-1 text-xs font-medium text-slate-500">{eventRangeLabel(evento)}</p>
                      {evento.descripcion && <p className="mt-3 text-sm leading-6 text-slate-600">{evento.descripcion}</p>}
                    </div>
                    {canManageCalendar && (
                      <div className="flex flex-shrink-0 gap-2">
                        <button type="button" onClick={() => openEdit(evento)} className="action-btn icon-action-btn h-10 w-10 rounded-2xl" aria-label="Editar evento">
                          <Edit3 size={15} />
                        </button>
                        <button type="button" onClick={() => void deleteEvent(evento)} className="action-btn-ghost icon-action-btn h-10 w-10 rounded-2xl text-rose-600" aria-label="Eliminar evento">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="surface-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Festivos del mes</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{festivos.length} registrados</h3>
          <div className="mt-4 space-y-3">
            {festivos.length === 0 ? (
              <p className="rounded-[22px] border border-white/80 bg-white/55 px-4 py-5 text-sm text-slate-500">
                No hay dias festivos fijados para este mes.
              </p>
            ) : (
              festivos.map((evento) => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => setSelectedDate(evento.fecha_inicio)}
                  className="flex w-full items-start gap-3 rounded-[22px] border border-white/80 bg-white/55 px-4 py-3 text-left transition-colors hover:bg-white/80"
                >
                  <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT_COLOR_CLASSES[evento.color]}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{evento.titulo}</span>
                    <span className="mt-1 block text-xs text-slate-500">{eventRangeLabel(evento)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {showForm && canManageCalendar && (
        <div className="agenda-modal-overlay">
          <div className="agenda-modal-shell max-w-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Calendario institucional</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{form.id ? 'Editar evento' : 'Nuevo evento'}</h2>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="agenda-modal-close" aria-label="Cerrar formulario">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitEvent} className="space-y-5">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="label-field">Titulo</label>
                  <input value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} className="input-shell" placeholder="Festivo nacional, actividad interna..." />
                </div>
                <div>
                  <label className="label-field">Tipo</label>
                  <select
                    value={form.tipo_evento}
                    onChange={(event) => {
                      const tipo = event.target.value as CalendarioTipoEvento
                      setForm((current) => ({
                        ...current,
                        tipo_evento: tipo,
                        es_festivo: tipo === 'festivo' ? true : current.es_festivo,
                        color: tipo === 'festivo' ? 'rose' : current.color,
                      }))
                    }}
                    className="input-shell"
                  >
                    {Object.entries(TIPO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Color</label>
                  <select value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value as CalendarioColor }))} className="input-shell">
                    {Object.entries(COLOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Fecha inicio</label>
                  <input type="date" value={form.fecha_inicio} onChange={(event) => setForm((current) => ({ ...current, fecha_inicio: event.target.value }))} className="input-shell" />
                </div>
                <div>
                  <label className="label-field">Fecha fin</label>
                  <input type="date" value={form.fecha_fin} onChange={(event) => setForm((current) => ({ ...current, fecha_fin: event.target.value }))} className="input-shell" />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/80 bg-white/60 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.es_festivo}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    es_festivo: event.target.checked,
                    tipo_evento: event.target.checked ? 'festivo' : current.tipo_evento,
                    color: event.target.checked ? 'rose' : current.color,
                  }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Marcar como dia festivo</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">Los festivos quedan destacados para todos los usuarios del organismo.</span>
                </span>
              </label>

              <div>
                <label className="label-field">Descripcion</label>
                <textarea value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} className="input-shell min-h-28 resize-y py-3" placeholder="Detalles, motivo o instrucciones del evento" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setShowForm(false)} className="action-btn-ghost flex-1 justify-center">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="action-btn-primary flex-1 justify-center disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Guardando...' : 'Guardar evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
