'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Ban, History, Loader2, NotebookPen, Plus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { TIPOS_ORDEN } from '@/lib/types'
import type { Historial, Tarea, TipoOrden } from '@/lib/types'
import { useUserSession } from '@/components/UserSessionProvider'
import { useToast } from '@/components/ToastProvider'

interface TaskHistorialModalProps {
  task: Tarea
  onClose: () => void
  onUpdate?: () => void
}

const CHANGE_COLOR: Record<string, string> = {
  Orden: 'bg-slate-100 text-slate-700 border-slate-200',
  Nota: 'bg-violet-50 text-violet-700 border-violet-200',
  Avance: 'bg-amber-50 text-amber-700 border-amber-200',
  'Cambio de Estado': 'bg-sky-50 text-sky-700 border-sky-200',
  Incidencia: 'bg-rose-50 text-rose-700 border-rose-200',
  Recordatorio: 'bg-teal-50 text-teal-700 border-teal-200',
  Creacion: 'bg-teal-50 text-teal-700 border-teal-200',
  'Creación': 'bg-teal-50 text-teal-700 border-teal-200',
  'Actualizacion % Avance': 'bg-amber-50 text-amber-700 border-amber-200',
  'Actualización % Avance': 'bg-amber-50 text-amber-700 border-amber-200',
  Eliminacion: 'bg-rose-50 text-rose-700 border-rose-200',
  'Eliminación': 'bg-rose-50 text-rose-700 border-rose-200',
}

const BLOCKED_STATES = new Set<Tarea['estado']>(['Completado', 'Cancelado'])

const EMPTY_FORM: { tipo_cambio: TipoOrden; observaciones: string; valor_nuevo: string } = {
  tipo_cambio: 'Orden',
  observaciones: '',
  valor_nuevo: '',
}

export default function TaskHistorialModal({ task, onClose, onUpdate }: TaskHistorialModalProps) {
  const { canEditAgenda } = useUserSession()
  const toast = useToast()
  const [rows, setRows] = useState<Historial[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [finalizar, setFinalizar] = useState(false)

  const canAdd = useMemo(() => canEditAgenda && !BLOCKED_STATES.has(task.estado), [canEditAgenda, task.estado])

  const fetchHistorial = useCallback(async () => {
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('historial')
      .select('*')
      .eq('tarea_id', task.id)
      .order('fecha', { ascending: false })

    if (fetchError) {
      setRows([])
      toast.error('No se pudo cargar el historial: ' + fetchError.message)
    } else {
      setRows(data ?? [])
    }

    setLoading(false)
  }, [task.id, toast])

  useEffect(() => {
    void fetchHistorial()
  }, [fetchHistorial])

  useEffect(() => {
    setForm(EMPTY_FORM)
    setFinalizar(false)
  }, [task.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-'

    try {
      return format(parseISO(value), "dd MMM yyyy '·' HH:mm", { locale: es })
    } catch {
      return value
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canAdd) return

    const observaciones = form.observaciones.trim()
    const valorNuevo = form.valor_nuevo.trim()

    if (!observaciones && !valorNuevo) {
      toast.error('Escribe una observación o un valor nuevo antes de registrar la entrada.')
      return
    }

    setSubmitting(true)

    const response = await fetch('/api/historial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      tarea_id: task.id,
      tipo_cambio: form.tipo_cambio,
      observaciones: observaciones || null,
        valor_nuevo: valorNuevo || null,
        finalizar,
      }),
    })
    const result = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !result.ok) {
      toast.error(result.error ?? 'No se pudo registrar la entrada.')
      setSubmitting(false)
      return
    }

    toast.success(finalizar ? 'Tarea marcada como finalizada.' : 'Entrada registrada correctamente.')
    setForm(EMPTY_FORM)
    setFinalizar(false)
    await fetchHistorial()
    if (onUpdate) onUpdate()
    setSubmitting(false)
  }

  return (
    <div className="agenda-modal-overlay">
      <div className="agenda-modal-shell agenda-modal-shell-xl flex h-[92vh]">
        <div className="grid h-full w-full grid-cols-1 xl:grid-cols-[0.95fr_1.3fr]">
          <aside className="relative overflow-hidden border-b border-white/50 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white xl:border-b-0 xl:border-r xl:border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_40%)]" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/90">
                <History size={14} />
                Historial de tarea
              </span>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tarea</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{task.tarea}</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Identificador</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">#{task.codigo_id ?? task.id}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Estado actual</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{task.estado}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Responsable</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{task.responsable ?? 'Sin asignar'}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-teal-100">
                      {canAdd ? <NotebookPen size={18} /> : <Ban size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {canAdd ? 'Puedes registrar nuevas entradas manuales' : 'Edición bloqueada por estado final'}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {canAdd
                          ? 'Este panel reúne trazabilidad automática y órdenes o notas operativas asociadas a la tarea.'
                          : 'Las tareas completadas o canceladas mantienen su historial visible, pero no aceptan nuevas órdenes.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-white/70 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Bitácora</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Órdenes, avances y anotaciones</p>
              </div>
              <button
                onClick={onClose}
                className="agenda-modal-close"
                aria-label="Cerrar historial"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1.05fr_1.2fr]">
              <div className="border-b border-white/70 p-5 xl:border-b-0 xl:border-r xl:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Registrar nueva entrada</p>
                    <p className="mt-1 text-xs text-slate-500">Se guarda directamente en `historial` para esta tarea.</p>
                  </div>
                  {!canAdd && (
                    <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                      Formulario bloqueado
                    </span>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  <div>
                    <label className="label-field">Tipo de cambio</label>
                    <select
                      value={form.tipo_cambio}
                      onChange={(event) => setForm((current) => ({ ...current, tipo_cambio: event.target.value as TipoOrden }))}
                      className="input-shell"
                      disabled={!canAdd || submitting}
                    >
                      {TIPOS_ORDEN.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-field">Observaciones</label>
                    <textarea
                      value={form.observaciones}
                      onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
                      rows={5}
                      className="input-shell resize-none"
                      placeholder="Describe la orden, el avance o la nota de seguimiento..."
                      disabled={!canAdd || submitting}
                    />
                  </div>

                  <div>
                    <label className="label-field">Valor nuevo</label>
                    <input
                      type="text"
                      value={form.valor_nuevo}
                      onChange={(event) => setForm((current) => ({ ...current, valor_nuevo: event.target.value }))}
                      className="input-shell"
                      placeholder="Opcional. Ej: En revisión, 80%, Pendiente de firma..."
                      disabled={!canAdd || submitting}
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/80 bg-slate-50/80 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={finalizar}
                      onChange={(event) => {
                        const checked = event.target.checked
                        setFinalizar(checked)
                        if (checked) {
                          setForm((current) => ({
                            ...current,
                            tipo_cambio: 'Cambio de Estado',
                            valor_nuevo: 'Completado',
                          }))
                        }
                      }}
                      disabled={!canAdd || submitting}
                      className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Marcar tarea como finalizada</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Cambia el estado a Completado, fija el avance en 100% y notifica a los administradores.
                      </span>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!canAdd || submitting}
                    className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {submitting ? 'Registrando...' : 'Registrar entrada'}
                  </button>
                </form>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="border-b border-white/70 px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold text-slate-900">{rows.length} registro{rows.length !== 1 ? 's' : ''}</p>
                  <p className="mt-1 text-xs text-slate-500">Se muestran primero las entradas más recientes.</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {loading ? (
                    <div className="py-16 text-center">
                      <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
                      <p className="mt-3 text-sm text-slate-500">Cargando historial...</p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
                      <History size={28} className="mx-auto text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay entradas para esta tarea</p>
                      <p className="mt-1 text-xs text-slate-500">Las acciones automáticas y manuales aparecerán aquí.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rows.map((row) => (
                        <article key={row.id} className="rounded-[26px] border border-white/80 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`badge ${CHANGE_COLOR[row.tipo_cambio] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {row.tipo_cambio}
                            </span>
                            <span className="text-xs font-medium text-slate-500">{formatDateTime(row.fecha)}</span>
                          </div>

                          {(row.valor_anterior || row.valor_nuevo) && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-500">
                                {row.valor_anterior ?? 'Sin valor anterior'}
                              </span>
                              <ArrowRight size={14} className="text-slate-400" />
                              <span className="rounded-full bg-teal-50 px-3 py-1 font-semibold text-teal-700">
                                {row.valor_nuevo ?? 'Sin valor nuevo'}
                              </span>
                            </div>
                          )}

                          <p className="mt-3 text-sm leading-6 text-slate-600">{row.observaciones ?? 'Sin observaciones registradas.'}</p>

                          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <span className="text-xs text-slate-500">Módulo: {row.modulo}</span>
                            <span className="text-xs font-semibold text-slate-600">{row.usuario ?? 'Sistema'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
