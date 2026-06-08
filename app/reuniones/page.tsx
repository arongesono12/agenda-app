'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Link as LinkIcon, Loader2, MapPin, Plus, RefreshCw, Send, Users, XCircle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import UserAvatar from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ToastProvider'
import { useUserSession } from '@/components/UserSessionProvider'
import { MANAGER_ROLE_CODES } from '@/lib/access-control'
import type { MiembroConPerfil, Reunion, ReunionInvitado, ReunionModalidad, ReunionRespuesta } from '@/lib/types'

type MeetingForm = {
  titulo: string
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  modalidad: ReunionModalidad
  enlace_reunion: string
  ubicacion: string
}

const EMPTY_FORM: MeetingForm = {
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  modalidad: 'virtual',
  enlace_reunion: '',
  ubicacion: '',
}

const RESPONSE_LABELS: Record<ReunionRespuesta, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  rechazado: 'Rechazado',
  tentativo: 'Tentativo',
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset()
  const local = new Date(value.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatMeetingDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function responseClass(value: string) {
  if (value === 'confirmado') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'rechazado') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (value === 'tentativo') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-100 text-slate-600'
}

export default function ReunionesPage() {
  const toast = useToast()
  const { profile, organismoActivo, rolEnOrganismo } = useUserSession()
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [miembros, setMiembros] = useState<MiembroConPerfil[]>([])
  const [selectedInvites, setSelectedInvites] = useState<string[]>([])
  const [form, setForm] = useState<MeetingForm>(() => {
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    return { ...EMPTY_FORM, fecha_inicio: toDateTimeLocal(start), fecha_fin: toDateTimeLocal(end) }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const canManageMeetings = !!rolEnOrganismo && MANAGER_ROLE_CODES.includes(rolEnOrganismo as (typeof MANAGER_ROLE_CODES)[number])

  const loadReuniones = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reuniones', { cache: 'no-store' })
      const result = (await response.json()) as { ok?: boolean; reuniones?: Reunion[]; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron cargar las reuniones.')
      setReuniones(result.reuniones ?? [])
    } catch (loadError: unknown) {
      toast.error(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las reuniones.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadMiembros = useCallback(async () => {
    if (!organismoActivo?.slug || !canManageMeetings) return
    const response = await fetch(`/api/organismos/${organismoActivo.slug}/miembros`, { cache: 'no-store' })
    const result = (await response.json()) as { ok?: boolean; miembros?: MiembroConPerfil[] }
    if (response.ok && result.ok) setMiembros(result.miembros ?? [])
  }, [canManageMeetings, organismoActivo?.slug])

  useEffect(() => {
    void loadReuniones()
  }, [loadReuniones])

  useEffect(() => {
    void loadMiembros()
  }, [loadMiembros])

  const myInvitations = useMemo(
    () => reuniones.flatMap((reunion) => (reunion.invitados ?? [])
      .filter((invitado) => invitado.usuario_id === profile?.id)
      .map((invitado) => ({ reunion, invitado }))
    ),
    [profile?.id, reuniones]
  )

  const toggleInvite = (usuarioId: string) => {
    setSelectedInvites((current) => current.includes(usuarioId)
      ? current.filter((id) => id !== usuarioId)
      : [...current, usuarioId]
    )
  }

  const resetForm = () => {
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    setForm({ ...EMPTY_FORM, fecha_inicio: toDateTimeLocal(start), fecha_fin: toDateTimeLocal(end) })
    setSelectedInvites([])
    setError('')
  }

  const createMeeting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/reuniones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fecha_inicio: new Date(form.fecha_inicio).toISOString(),
          fecha_fin: form.fecha_fin ? new Date(form.fecha_fin).toISOString() : null,
          invitado_usuario_ids: selectedInvites,
        }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo crear la reunion.')

      toast.success('Reunion programada e invitaciones enviadas.')
      resetForm()
      setShowCreate(false)
      await loadReuniones()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear la reunion.')
    } finally {
      setSaving(false)
    }
  }

  const responderInvitacion = async (invitadoId: number, respuesta: ReunionRespuesta) => {
    try {
      const response = await fetch('/api/reuniones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitadoId, respuesta }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo guardar la respuesta.')
      toast.success('Respuesta guardada.')
      await loadReuniones()
    } catch (responseError: unknown) {
      toast.error(responseError instanceof Error ? responseError.message : 'No se pudo guardar la respuesta.')
    }
  }

  const actualizarEstado = async (reunionId: string, estado: Reunion['estado']) => {
    try {
      const response = await fetch('/api/reuniones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reunionId, estado }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudo actualizar la reunion.')
      toast.success('Reunion actualizada.')
      await loadReuniones()
    } catch (updateError: unknown) {
      toast.error(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la reunion.')
    }
  }

  const MeetingCard = ({ reunion }: { reunion: Reunion }) => {
    const invitados = reunion.invitados ?? []
    const myInvitation = invitados.find((invitado) => invitado.usuario_id === profile?.id)
    const confirmados = invitados.filter((invitado) => invitado.estado_respuesta === 'confirmado').length

    return (
      <article className="surface-panel overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${reunion.estado === 'cancelada' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-700'}`}>
                {reunion.estado}
              </span>
              <span className="badge border-slate-200 bg-slate-100 text-slate-600">{reunion.modalidad}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{reunion.titulo}</h3>
            {reunion.descripcion && <p className="mt-2 text-sm leading-6 text-slate-500">{reunion.descripcion}</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <span className="flex items-center gap-2"><CalendarClock size={15} className="text-teal-600" />{formatMeetingDate(reunion.fecha_inicio)}</span>
              {reunion.enlace_reunion && (
                <a href={reunion.enlace_reunion} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold text-teal-700 hover:text-teal-800">
                  <LinkIcon size={15} className="flex-shrink-0" />
                  <span className="truncate">Abrir enlace</span>
                </a>
              )}
              {reunion.ubicacion && <span className="flex items-center gap-2"><MapPin size={15} className="text-teal-600" />{reunion.ubicacion}</span>}
              <span className="flex items-center gap-2"><Users size={15} className="text-teal-600" />{confirmados}/{invitados.length} confirmados</span>
            </div>
          </div>

          {canManageMeetings && reunion.estado === 'programada' && (
            <button
              type="button"
              onClick={() => void actualizarEstado(reunion.id, 'cancelada')}
              className="action-btn-ghost justify-center text-rose-600 hover:text-rose-700"
            >
              <XCircle size={15} />
              Cancelar
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-white/70 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invitados</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {invitados.map((invitado) => (
              <div key={invitado.id} className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-3 py-2">
                <UserAvatar name={invitado.nombre ?? invitado.email ?? 'Usuario'} size="sm" className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{invitado.nombre ?? 'Usuario'}</p>
                  <p className="truncate text-xs text-slate-500">{invitado.email}</p>
                </div>
                <span className={`badge ${responseClass(invitado.estado_respuesta)}`}>
                  {RESPONSE_LABELS[invitado.estado_respuesta]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {myInvitation && reunion.estado === 'programada' && (
          <div className="mt-5 flex flex-col gap-2 border-t border-white/70 pt-4 sm:flex-row">
            <button type="button" onClick={() => void responderInvitacion(myInvitation.id, 'confirmado')} className="action-btn-primary flex-1 justify-center">
              <CheckCircle2 size={15} />
              Confirmar
            </button>
            <button type="button" onClick={() => void responderInvitacion(myInvitation.id, 'tentativo')} className="action-btn flex-1 justify-center">
              Tentativo
            </button>
            <button type="button" onClick={() => void responderInvitacion(myInvitation.id, 'rechazado')} className="action-btn-ghost flex-1 justify-center text-rose-600">
              Rechazar
            </button>
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Reuniones"
        subtitle="Programa reuniones del organismo, invita miembros y confirma participaciones."
        icon={<CalendarClock size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => void loadReuniones()} className="action-btn icon-action-btn h-12 w-12 rounded-2xl" aria-label="Actualizar reuniones">
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManageMeetings && (
              <button type="button" onClick={() => setShowCreate((current) => !current)} className="action-btn-primary">
                <Plus size={15} />
                Nueva reunion
              </button>
            )}
          </div>
        }
      />

      {myInvitations.length > 0 && (
        <section className="surface-panel p-5">
          <p className="text-sm font-semibold text-slate-900">Mis invitaciones</p>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {myInvitations.map(({ reunion, invitado }) => (
              <div key={invitado.id} className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/55 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{reunion.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatMeetingDate(reunion.fecha_inicio)}</p>
                </div>
                <span className={`badge ${responseClass(invitado.estado_respuesta)}`}>{RESPONSE_LABELS[invitado.estado_respuesta]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showCreate && canManageMeetings && (
        <section className="surface-panel-strong p-5">
          <form onSubmit={createMeeting} className="space-y-5">
            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="label-field">Titulo</label>
                <input value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} className="input-shell" placeholder="Reunion de seguimiento" />
              </div>
              <div>
                <label className="label-field">Modalidad</label>
                <select value={form.modalidad} onChange={(event) => setForm((current) => ({ ...current, modalidad: event.target.value as ReunionModalidad }))} className="input-shell">
                  <option value="virtual">Virtual</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrida">Hibrida</option>
                </select>
              </div>
              <div>
                <label className="label-field">Inicio</label>
                <input type="datetime-local" value={form.fecha_inicio} onChange={(event) => setForm((current) => ({ ...current, fecha_inicio: event.target.value }))} className="input-shell" />
              </div>
              <div>
                <label className="label-field">Fin</label>
                <input type="datetime-local" value={form.fecha_fin} onChange={(event) => setForm((current) => ({ ...current, fecha_fin: event.target.value }))} className="input-shell" />
              </div>
              <div>
                <label className="label-field">Enlace</label>
                <input value={form.enlace_reunion} onChange={(event) => setForm((current) => ({ ...current, enlace_reunion: event.target.value }))} className="input-shell" placeholder="https://meet.google.com/..." />
              </div>
              <div>
                <label className="label-field">Ubicacion</label>
                <input value={form.ubicacion} onChange={(event) => setForm((current) => ({ ...current, ubicacion: event.target.value }))} className="input-shell" placeholder="Sala de reuniones" />
              </div>
            </div>

            <div>
              <label className="label-field">Descripcion</label>
              <textarea value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} className="input-shell min-h-24 resize-y py-3" placeholder="Objetivo y puntos a tratar" />
            </div>

            <div>
              <label className="label-field">Invitados</label>
              <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {miembros.map((miembro) => {
                  const nombre = miembro.perfil?.nombre_completo?.trim() || miembro.perfil?.email?.split('@')[0] || 'Usuario'
                  const email = miembro.perfil?.email ?? ''
                  const selected = selectedInvites.includes(miembro.usuario_id)
                  return (
                    <button
                      key={miembro.usuario_id}
                      type="button"
                      onClick={() => toggleInvite(miembro.usuario_id)}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors ${selected ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-white/80 bg-white/55 text-slate-700 hover:bg-white/80'}`}
                    >
                      <UserAvatar name={nombre} avatarUrl={miembro.perfil?.avatar_url} size="sm" className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{nombre}</span>
                        <span className="block truncate text-xs opacity-70">{email}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => { resetForm(); setShowCreate(false) }} className="action-btn-ghost flex-1 justify-center">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="action-btn-primary flex-1 justify-center disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {saving ? 'Programando...' : 'Programar y enviar'}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="surface-panel py-24 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-teal-600" />
        </div>
      ) : reuniones.length === 0 ? (
        <div className="surface-panel py-20 text-center">
          <CalendarClock size={30} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No hay reuniones programadas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reuniones.map((reunion) => <MeetingCard key={reunion.id} reunion={reunion} />)}
        </div>
      )}
    </div>
  )
}
