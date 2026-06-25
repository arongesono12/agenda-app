'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Ban, History, Loader2, NotebookPen, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { TIPOS_ORDEN } from '@/lib/types'
import type { Historial, Responsable, Tarea, TipoOrden } from '@/lib/types'
import { useUserSession } from '@/components/UserSessionProvider'
import { useToast } from '@/components/ToastProvider'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'

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
  Asignacion: 'bg-teal-50 text-teal-700 border-teal-200',
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
  const { capabilities, profile } = useUserSession()
  const toast = useToast()
  const [rows, setRows] = useState<Historial[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [reassignmentDone, setReassignmentDone] = useState(false)
  const [assignableResponsables, setAssignableResponsables] = useState<Responsable[]>([])
  const [nextResponsableId, setNextResponsableId] = useState('')
  const [reassignmentObservation, setReassignmentObservation] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [finalizar, setFinalizar] = useState(false)
  const currentAssignment = useMemo(
    () => task.asignaciones?.find((assignment) => assignment.responsable_usuario_id === profile?.id) ?? null,
    [profile?.id, task.asignaciones]
  )
  const currentAssignmentCompleted =
    currentAssignment?.estado === 'Completado' || Number(currentAssignment?.porcentaje_avance ?? 0) >= 100
  const canDeleteHistory = ADMIN_ROLE_CODES.includes(capabilities.roleCode as (typeof ADMIN_ROLE_CODES)[number])

  const canAdd = useMemo(
    () =>
      (capabilities.canUpdateAssignedTasks || capabilities.canEditTasks) &&
      !BLOCKED_STATES.has(task.estado) &&
      !(capabilities.canUpdateAssignedTasks && !capabilities.canEditTasks && currentAssignmentCompleted),
    [capabilities.canEditTasks, capabilities.canUpdateAssignedTasks, currentAssignmentCompleted, task.estado]
  )
  const canReassign = useMemo(
    () =>
      capabilities.roleCode === 'supervisor' &&
      !reassignmentDone &&
      !BLOCKED_STATES.has(task.estado) &&
      !!profile?.id &&
      (task.responsable_usuario_id === profile.id ||
        task.asignado_por_usuario_id === profile.id ||
        !!task.asignaciones?.some((assignment) =>
          assignment.responsable_usuario_id === profile.id ||
          assignment.asignado_por_usuario_id === profile.id
        )),
    [capabilities.roleCode, profile, reassignmentDone, task.asignaciones, task.asignado_por_usuario_id, task.estado, task.responsable_usuario_id]
  )

  const fetchHistorial = useCallback(async () => {
    setLoading(true)

    const response = await window.fetch(`/api/historial?tarea_id=${task.id}&page=0&pageSize=100`)
    const result = (await response.json()) as { ok?: boolean; rows?: Historial[]; error?: string }

    if (!response.ok || !result.ok) {
      setRows([])
      toast.error('No se pudo cargar el historial: ' + (result.error ?? 'Error desconocido.'))
    } else {
      setRows((result.rows ?? []) as Historial[])
    }

    setLoading(false)
  }, [task.id, toast])

  useEffect(() => {
    void fetchHistorial()
  }, [fetchHistorial])

  useEffect(() => {
    if (!canReassign) {
      setAssignableResponsables([])
      setNextResponsableId('')
      return
    }

    const loadAssignableResponsables = async () => {
      const params = new URLSearchParams({
        resource: 'responsables',
        assignable: 'true',
        role: 'responsable',
      })
      if (task.departamento) params.set('departamento', task.departamento)

      const response = await window.fetch(`/api/catalogos?${params.toString()}`)
      const result = (await response.json()) as { ok?: boolean; responsables?: Responsable[] }
      const responsables = response.ok && result.ok ? result.responsables ?? [] : []

      setAssignableResponsables(responsables.filter((responsable) => responsable.usuario_id !== profile?.id))
      setNextResponsableId('')
    }

    void loadAssignableResponsables()
  }, [canReassign, profile?.id, task.departamento])

  useEffect(() => {
    setForm(EMPTY_FORM)
    setFinalizar(false)
    setReassignmentDone(false)
    setEditingHistoryId(null)
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

  const handleReassign = async () => {
    if (!canReassign || !nextResponsableId) return

    const responsable = assignableResponsables.find((item) => item.id === Number(nextResponsableId))
    if (!responsable) {
      toast.error('Selecciona un responsable valido.')
      return
    }

    setAssigning(true)

    const response = await fetch('/api/tareas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: task.id,
        codigo_id: task.codigo_id ?? null,
        tarea: task.tarea,
        prioridad: task.prioridad,
        estado: task.estado,
        departamento: task.departamento || null,
        seccion: task.seccion || null,
        responsable: responsable.nombre,
        responsable_id: responsable.id,
        responsable_ids: [responsable.id],
        fecha_inicio: task.fecha_inicio || null,
        fecha_fin: task.fecha_fin || null,
        porcentaje_avance: Number(task.porcentaje_avance ?? 0),
        tipo_tarea: task.tipo_tarea || null,
        notas: task.notas || null,
        asignacion_observacion: reassignmentObservation.trim() || task.notas || null,
      }),
    })
    const result = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !result.ok) {
      toast.error(result.error ?? 'No se pudo reasignar la tarea.')
      setAssigning(false)
      return
    }

    toast.success(`Tarea reasignada a ${responsable.nombre}.`)
    setNextResponsableId('')
    setReassignmentObservation('')
    setReassignmentDone(true)
    await fetchHistorial()
    if (onUpdate) onUpdate()
    setAssigning(false)
  }

  const canEditHistoryRow = (row: Historial) =>
    capabilities.roleCode === 'supervisor' && row.actor_usuario_id === profile?.id

  const startEditHistory = (row: Historial) => {
    setEditingHistoryId(row.id)
    setEditForm({
      tipo_cambio: TIPOS_ORDEN.includes(row.tipo_cambio as TipoOrden) ? row.tipo_cambio as TipoOrden : 'Nota',
      observaciones: row.observaciones ?? '',
      valor_nuevo: row.valor_nuevo ?? '',
    })
  }

  const cancelEditHistory = () => {
    setEditingHistoryId(null)
    setEditForm(EMPTY_FORM)
  }

  const submitHistoryEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingHistoryId) return

    const response = await fetch('/api/historial', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingHistoryId,
        tipo_cambio: editForm.tipo_cambio,
        observaciones: editForm.observaciones || null,
        valor_nuevo: editForm.valor_nuevo || null,
      }),
    })
    const result = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !result.ok) {
      toast.error(result.error ?? 'No se pudo editar la entrada.')
      return
    }

    toast.success('Entrada actualizada correctamente.')
    cancelEditHistory()
    await fetchHistorial()
  }

  const deleteHistory = async (row: Historial) => {
    if (!canDeleteHistory || !confirm('Eliminar esta entrada del historial?')) return

    setDeletingHistoryId(row.id)
    const response = await fetch(`/api/historial?id=${row.id}`, { method: 'DELETE' })
    const result = (await response.json()) as { ok?: boolean; error?: string }

    if (!response.ok || !result.ok) {
      toast.error(result.error ?? 'No se pudo eliminar la entrada.')
      setDeletingHistoryId(null)
      return
    }

    toast.success('Entrada eliminada del historial visible.')
    setRows((current) => current.filter((item) => item.id !== row.id))
    setDeletingHistoryId(null)
  }

  return (
    <div className="agenda-modal-overlay">
      <div className="agenda-modal-shell agenda-modal-shell-xl flex h-[94dvh] md:h-[92vh]">
        <div className="h-full w-full overflow-y-auto xl:grid xl:grid-cols-[0.95fr_1.3fr] xl:overflow-hidden">
          <aside className="relative max-h-80 overflow-hidden border-b border-white/50 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-4 text-white sm:p-6 md:max-h-none xl:border-b-0 xl:border-r xl:border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_40%)]" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/90">
                <History size={14} />
                Historial de tarea
              </span>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tarea</p>
                  <h2 className="mt-2 line-clamp-3 text-xl font-semibold tracking-[-0.04em] sm:text-2xl">{task.tarea}</h2>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Asignada por</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{task.asignado_por_nombre ?? 'Sin dato'}</p>
                  </div>
                </div>

                <div className="hidden rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 sm:block">
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

          <section className="min-h-0 xl:flex xl:flex-col">
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
              <div className="order-2 border-t border-white/70 p-4 sm:p-5 xl:order-1 xl:border-r xl:border-t-0 xl:p-6">
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
                      title="Tipo de cambio"
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
                      <span className="block text-sm font-semibold text-slate-800">
                        {task.asignaciones && task.asignaciones.length > 1
                          ? 'Marcar mi parte como finalizada'
                          : 'Marcar tarea como finalizada'}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {task.asignaciones && task.asignaciones.length > 1
                          ? 'La tarea se completara solo cuando todos los responsables finalicen su parte.'
                          : 'Cambia el estado a Completado, fija el avance en 100% y notifica a los administradores.'}
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

                {canReassign && (
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-teal-700">
                        <UserPlus size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">Asignar a responsable</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Puedes transferir esta tarea a un responsable de tu mismo departamento.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <select
                        value={nextResponsableId}
                        onChange={(event) => setNextResponsableId(event.target.value)}
                        aria-label="Seleccionar responsable"
                        className="input-shell"
                        disabled={assigning || assignableResponsables.length === 0}
                      >
                        <option value="">Seleccionar responsable</option>
                        {assignableResponsables.map((responsable) => (
                          <option key={responsable.id} value={responsable.id}>
                            {responsable.nombre}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={reassignmentObservation}
                        onChange={(event) => setReassignmentObservation(event.target.value)}
                        rows={4}
                        className="input-shell resize-none"
                        placeholder="Observacion para el responsable. Ej: pasos a seguir, prioridad interna o contexto de la asignacion."
                        disabled={assigning || assignableResponsables.length === 0}
                      />
                      <button
                        type="button"
                        onClick={() => void handleReassign()}
                        disabled={assigning || !nextResponsableId}
                        className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
                      >
                        {assigning ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        {assigning ? 'Asignando...' : 'Asignar tarea'}
                      </button>
                      {assignableResponsables.length === 0 && (
                        <p className="text-xs text-amber-700">
                          No hay responsables disponibles en el departamento de esta tarea.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="order-1 flex min-h-0 flex-col xl:order-2">
                <div className="border-b border-white/70 px-5 py-4 sm:px-6">
                  <p className="text-sm font-semibold text-slate-900">{rows.length} registro{rows.length !== 1 ? 's' : ''}</p>
                  <p className="mt-1 text-xs text-slate-500">Se muestran primero las entradas más recientes.</p>
                </div>

                <div className="min-h-0 flex-1 overflow-visible px-4 py-4 sm:px-6 sm:py-5 xl:overflow-y-auto">
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
                      {rows.map((row) => {
                        const isEditing = editingHistoryId === row.id
                        const canEditRow = canEditHistoryRow(row)

                        return (
                          <article key={row.id} className="rounded-[26px] border border-slate-100 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`badge ${CHANGE_COLOR[row.tipo_cambio] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {row.tipo_cambio}
                              </span>
                              <span className="text-xs font-medium text-slate-400">{formatDateTime(row.fecha)}</span>
                              {row.editado_at && (
                                <span className="badge border-amber-200 bg-amber-50 text-amber-700">Editado</span>
                              )}
                            </div>

                            {(canEditRow || canDeleteHistory) && (
                              <div className="flex items-center gap-2">
                                {canEditRow && (
                                  <button
                                    type="button"
                                    onClick={() => isEditing ? cancelEditHistory() : startEditHistory(row)}
                                    className="action-btn icon-action-btn h-9 w-9 rounded-2xl"
                                    aria-label={isEditing ? 'Cancelar edicion de historial' : 'Editar historial'}
                                  >
                                    {isEditing ? <X size={14} /> : <Pencil size={14} />}
                                  </button>
                                )}
                                {canDeleteHistory && (
                                  <button
                                    type="button"
                                    onClick={() => void deleteHistory(row)}
                                    disabled={deletingHistoryId === row.id}
                                    className="action-btn icon-action-btn h-9 w-9 rounded-2xl text-rose-600 disabled:opacity-60"
                                    aria-label="Eliminar historial"
                                  >
                                    {deletingHistoryId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <form onSubmit={(event) => void submitHistoryEdit(event)} className="mt-4 space-y-3">
                              <select
                                value={editForm.tipo_cambio}
                                onChange={(event) => setEditForm((current) => ({ ...current, tipo_cambio: event.target.value as TipoOrden }))}
                                className="input-shell"
                                aria-label="Tipo de cambio del historial"
                              >
                                {TIPOS_ORDEN.map((tipo) => (
                                  <option key={tipo} value={tipo}>
                                    {tipo}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                value={editForm.observaciones}
                                onChange={(event) => setEditForm((current) => ({ ...current, observaciones: event.target.value }))}
                                rows={4}
                                className="input-shell resize-none"
                                placeholder="Observaciones"
                              />
                              <input
                                type="text"
                                value={editForm.valor_nuevo}
                                onChange={(event) => setEditForm((current) => ({ ...current, valor_nuevo: event.target.value }))}
                                className="input-shell"
                                placeholder="Valor nuevo"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button type="submit" className="action-btn-primary flex-1 justify-center">
                                  <Plus size={14} />
                                  Guardar cambios
                                </button>
                                <button type="button" onClick={cancelEditHistory} className="action-btn flex-1 justify-center">
                                  <X size={14} />
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              {(row.valor_anterior || row.valor_nuevo) && (
                                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="max-w-[40%] break-all rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                    {row.valor_anterior ?? 'Sin valor anterior'}
                                  </span>
                                  <ArrowRight size={12} className="flex-shrink-0 text-slate-400" />
                                  <span className="max-w-[40%] break-all rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                                    {row.valor_nuevo ?? 'Sin valor nuevo'}
                                  </span>
                                </div>
                              )}

                              {row.observaciones ? (
                                <p className="mt-3 break-words text-sm leading-6 text-slate-800">{row.observaciones}</p>
                              ) : (
                                <p className="mt-3 text-xs italic text-slate-400">Sin observaciones registradas.</p>
                              )}
                            </>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <span className="text-[11px] text-slate-400">Módulo: {row.modulo}</span>
                            <span className="text-[11px] font-semibold text-slate-500">{row.usuario ?? 'Sistema'}</span>
                          </div>
                          </article>
                        )
                      })}
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
