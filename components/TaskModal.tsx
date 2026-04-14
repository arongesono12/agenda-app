'use client'
import { useState, useEffect } from 'react'
import { X, Save, Loader2, CalendarDays, FileText, Flag, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEPARTAMENTOS, PRIORIDADES, ESTADOS, TIPOS_TAREA } from '@/lib/types'
import type { Tarea } from '@/lib/types'

interface TaskModalProps {
  task?: Tarea | null
  onClose: () => void
  onSave: () => void
}

const empty: Partial<Tarea> = {
  codigo_id: undefined,
  tarea: '',
  prioridad: 'Media',
  estado: 'Pendiente',
  porcentaje_avance: 0,
  departamento: '',
  responsable: '',
  tipo_tarea: undefined,
  seccion: '',
  notas: '',
}

export default function TaskModal({ task, onClose, onSave }: TaskModalProps) {
  const [form, setForm] = useState<Partial<Tarea>>(task ?? empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!task

  useEffect(() => {
    setForm(task ?? empty)
  }, [task])

  const set = (k: keyof Tarea, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tarea?.trim()) {
      setError('La tarea es obligatoria.')
      return
    }

    if (form.codigo_id !== undefined && form.codigo_id !== null && !Number.isInteger(Number(form.codigo_id))) {
      setError('El ID manual debe ser un numero entero.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        codigo_id: form.codigo_id !== undefined && form.codigo_id !== null && `${form.codigo_id}` !== ''
          ? Number(form.codigo_id)
          : null,
        tarea: form.tarea,
        prioridad: form.prioridad,
        estado: form.estado,
        departamento: form.departamento || null,
        seccion: form.seccion || null,
        responsable: form.responsable || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        porcentaje_avance: Number(form.porcentaje_avance ?? 0),
        tipo_tarea: form.tipo_tarea || null,
        notas: form.notas || null,
        ultima_actualizacion: new Date().toISOString(),
      }

      if (isEdit) {
        const { error: e } = await supabase.from('tareas').update(payload).eq('id', task!.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('tareas').insert(payload)
        if (e) throw e
      }

      onSave()
      onClose()
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-md sm:items-center sm:p-6">
      <div className="surface-panel-strong h-[100dvh] max-h-[100dvh] w-full max-w-4xl overflow-hidden rounded-none sm:h-auto sm:max-h-[92vh] sm:rounded-[32px]">
        <div className="grid max-h-[100dvh] grid-cols-1 lg:grid-cols-[1.05fr_1.3fr] sm:max-h-[92vh]">
          <div className="relative overflow-hidden border-b border-white/50 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white lg:border-b-0 lg:border-r lg:border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_40%)]" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/90">
                {isEdit ? 'Modo edicion' : 'Nueva entrada'}
              </span>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em]">
                {isEdit ? 'Editar tarea' : 'Crear tarea'}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                Registra responsables, prioridad, fechas y avance para mantener el tablero siempre claro y accionable.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  { icon: <FileText size={16} />, label: 'Descripcion ejecutiva' },
                  { icon: <Flag size={16} />, label: 'Prioridad y estado' },
                  { icon: <CalendarDays size={16} />, label: 'Ventana de ejecucion' },
                  { icon: <UserRound size={16} />, label: 'Responsable y seguimiento' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-teal-100">
                      {item.icon}
                    </div>
                    <span className="text-sm text-slate-200">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Formulario</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {isEdit ? 'Actualiza la informacion clave' : 'Completa los datos principales'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="action-btn h-11 w-11 rounded-2xl p-0"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label-field">
                  Tarea <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={form.tarea ?? ''}
                  onChange={(e) => set('tarea', e.target.value)}
                  rows={3}
                  className="input-shell min-h-[96px] resize-none"
                  placeholder="Describe el objetivo o entregable esperado..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">ID de tarea manual</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.codigo_id ?? ''}
                  onChange={(e) => set('codigo_id', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="input-shell"
                  placeholder="Ej. 101"
                />
              </div>
              <div>
                <label className="label-field">Prioridad</label>
                <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)} className="input-shell">
                  {PRIORIDADES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Estado</label>
                  <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className="input-shell">
                    {ESTADOS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">Departamento</label>
                  <select value={form.departamento ?? ''} onChange={(e) => set('departamento', e.target.value)} className="input-shell">
                    <option value="">Seleccionar</option>
                    {DEPARTAMENTOS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Seccion</label>
                  <input
                    type="text"
                    value={form.seccion ?? ''}
                    onChange={(e) => set('seccion', e.target.value)}
                    className="input-shell"
                    placeholder="Area o frente de trabajo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">Responsable</label>
                  <input
                    type="text"
                    value={form.responsable ?? ''}
                    onChange={(e) => set('responsable', e.target.value)}
                    className="input-shell"
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div>
                  <label className="label-field">Tipo de tarea</label>
                  <input
                    list="tipos-tarea-sugeridos"
                    value={form.tipo_tarea ?? ''}
                    onChange={(e) => set('tipo_tarea', e.target.value || undefined)}
                    className="input-shell"
                    placeholder="Escribe un tipo o elige uno sugerido"
                  />
                  <datalist id="tipos-tarea-sugeridos">
                    {TIPOS_TAREA.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <p className="mt-2 text-xs text-slate-500">
                    Puedes escribir un tipo personalizado si no aparece en la lista.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fecha_inicio ?? ''}
                    onChange={(e) => set('fecha_inicio', e.target.value || undefined)}
                    className="input-shell"
                  />
                </div>
                <div>
                  <label className="label-field">Fecha fin</label>
                  <input
                    type="date"
                    value={form.fecha_fin ?? ''}
                    onChange={(e) => set('fecha_fin', e.target.value || undefined)}
                    className="input-shell"
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="label-field mb-0">Avance</label>
                  <span className="text-sm font-semibold text-teal-700">{form.porcentaje_avance ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.porcentaje_avance ?? 0}
                  onChange={(e) => set('porcentaje_avance', Number(e.target.value))}
                  className="mt-3 w-full cursor-pointer accent-teal-600"
                />
              </div>

              <div>
                <label className="label-field">Notas</label>
                <textarea
                  value={form.notas ?? ''}
                  onChange={(e) => set('notas', e.target.value)}
                  rows={3}
                  className="input-shell resize-none"
                  placeholder="Observaciones, dependencias o contexto adicional..."
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button type="button" onClick={onClose} className="action-btn-ghost flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="action-btn-primary flex-1 disabled:translate-y-0 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Guardando...' : 'Guardar tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
