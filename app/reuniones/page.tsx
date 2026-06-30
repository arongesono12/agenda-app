'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Link as LinkIcon, Loader2, Mail, MapPin, Plus, RefreshCw, Send, Users, Video, XCircle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import UserAvatar from '@/components/ui/UserAvatar'
import { useToast } from '@/components/ToastProvider'
import { useUserSession } from '@/components/UserSessionProvider'
import { MANAGER_ROLE_CODES } from '@/lib/access-control'
import type { MiembroConPerfil, Reunion, ReunionModalidad, ReunionRespuesta } from '@/lib/types'

type MeetingForm = {
  titulo: string
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  modalidad: ReunionModalidad
  enlace_reunion: string
  ubicacion: string
  crear_google_meet: boolean
}

const EMPTY_FORM: MeetingForm = {
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  modalidad: 'virtual',
  enlace_reunion: '',
  ubicacion: '',
  crear_google_meet: true,
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

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function getMemberName(miembro: MiembroConPerfil) {
  return miembro.perfil?.nombre_completo?.trim() || miembro.perfil?.email?.split('@')[0] || 'Usuario'
}

function getMemberEmail(miembro: MiembroConPerfil) {
  return miembro.perfil?.email?.trim().toLowerCase() ?? ''
}

export default function ReunionesPage() {
  const toast = useToast()
  const { profile, organismoActivo, rolEnOrganismo } = useUserSession()
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [miembros, setMiembros] = useState<MiembroConPerfil[]>([])
  const [selectedInvites, setSelectedInvites] = useState<string[]>([])
  const [selectedInviteEmails, setSelectedInviteEmails] = useState<string[]>([])
  const [createInviteQuery, setCreateInviteQuery] = useState('')
  const [createInviteOpen, setCreateInviteOpen] = useState(false)
  const [form, setForm] = useState<MeetingForm>(() => {
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    return { ...EMPTY_FORM, fecha_inicio: toDateTimeLocal(start), fecha_fin: toDateTimeLocal(end) }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteSaving, setInviteSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')
  const [inviteMeeting, setInviteMeeting] = useState<Reunion | null>(null)
  const [selectedInviteMembers, setSelectedInviteMembers] = useState<string[]>([])
  const [selectedExistingInviteEmails, setSelectedExistingInviteEmails] = useState<string[]>([])
  const [existingInviteQuery, setExistingInviteQuery] = useState('')

  const canManageMeetings = !!rolEnOrganismo && MANAGER_ROLE_CODES.includes(rolEnOrganismo as (typeof MANAGER_ROLE_CODES)[number])

  const loadReuniones = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch('/api/reuniones', { cache: 'no-store' })
      const result = (await response.json()) as { ok?: boolean; reuniones?: Reunion[]; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron cargar las reuniones.')
      setReuniones(result.reuniones ?? [])
    } catch (loadError: unknown) {
      toast.error(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las reuniones.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [toast])

  const loadMiembros = useCallback(async () => {
    if (!organismoActivo?.slug || !canManageMeetings) {
      setMiembros([])
      return
    }
    try {
      const response = await fetch(`/api/organismos/${organismoActivo.slug}/miembros`, { cache: 'no-store' })
      const result = (await response.json()) as { ok?: boolean; miembros?: MiembroConPerfil[]; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron cargar los miembros.')
      setMiembros(result.miembros ?? [])
    } catch (loadError: unknown) {
      setMiembros([])
      toast.error(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los miembros.')
    }
  }, [canManageMeetings, organismoActivo?.slug, toast])

  useEffect(() => {
    void loadReuniones()
  }, [loadReuniones])

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void loadReuniones(true)
    }
    const intervalId = window.setInterval(refreshIfVisible, 30_000)
    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [loadReuniones])

  useEffect(() => {
    void loadMiembros()
  }, [loadMiembros])

  useEffect(() => {
    setSelectedInvites([])
    setSelectedInviteEmails([])
    setCreateInviteQuery('')
    setCreateInviteOpen(false)
    setSelectedInviteMembers([])
    setSelectedExistingInviteEmails([])
    setExistingInviteQuery('')
  }, [organismoActivo?.id])

  const myInvitations = useMemo(
    () => reuniones.flatMap((reunion) => (reunion.invitados ?? [])
      .filter((invitado) => invitado.usuario_id === profile?.id)
      .map((invitado) => ({ reunion, invitado }))
    ),
    [profile?.id, reuniones]
  )

  const selectedCreateMembers = useMemo(
    () => miembros
      .filter((miembro) => miembro.activo && miembro.organismo_id === organismoActivo?.id && normalizeEmail(getMemberEmail(miembro)))
      .filter((miembro) => selectedInvites.includes(miembro.usuario_id)),
    [miembros, organismoActivo?.id, selectedInvites]
  )

  const miembrosOrganismoActivo = useMemo(
    () => miembros
      .filter((miembro) => miembro.activo && miembro.organismo_id === organismoActivo?.id)
      .filter((miembro) => normalizeEmail(getMemberEmail(miembro)))
      .sort((left, right) => getMemberName(left).localeCompare(getMemberName(right), 'es')),
    [miembros, organismoActivo?.id]
  )

  const selectedCreateInviteEmails = useMemo(
    () => Array.from(new Set([
      ...selectedCreateMembers.map(getMemberEmail).filter(Boolean),
      ...selectedInviteEmails,
    ])),
    [selectedCreateMembers, selectedInviteEmails]
  )

  const createInviteMatches = useMemo(() => {
    const query = createInviteQuery.trim().toLowerCase()
    return miembrosOrganismoActivo
      .filter((miembro) => !selectedInvites.includes(miembro.usuario_id))
      .filter((miembro) => {
        if (!query) return true
        const nombre = getMemberName(miembro).toLowerCase()
        const email = getMemberEmail(miembro)
        return nombre.includes(query) || email.includes(query)
      })
  }, [createInviteQuery, miembrosOrganismoActivo, selectedInvites])

  const selectedExistingMembers = useMemo(
    () => miembrosOrganismoActivo.filter((miembro) => selectedInviteMembers.includes(miembro.usuario_id)),
    [miembrosOrganismoActivo, selectedInviteMembers]
  )

  const existingInviteMatches = useMemo(() => {
    const query = existingInviteQuery.trim().toLowerCase()
    if (!query) return []
    const alreadyInvitedIds = new Set((inviteMeeting?.invitados ?? []).map((invitado) => invitado.usuario_id).filter(Boolean))
    return miembrosOrganismoActivo
      .filter((miembro) => !selectedInviteMembers.includes(miembro.usuario_id) && !alreadyInvitedIds.has(miembro.usuario_id))
      .filter((miembro) => {
        const nombre = getMemberName(miembro).toLowerCase()
        const email = getMemberEmail(miembro)
        return nombre.includes(query) || email.includes(query)
      })
      .slice(0, 8)
  }, [existingInviteQuery, inviteMeeting?.invitados, miembrosOrganismoActivo, selectedInviteMembers])

  const toggleInvite = (usuarioId: string) => {
    setSelectedInvites((current) => current.includes(usuarioId)
      ? current.filter((id) => id !== usuarioId)
      : [...current, usuarioId]
    )
  }

  const selectCreateMemberInvite = (miembro: MiembroConPerfil) => {
    setSelectedInvites((current) => current.includes(miembro.usuario_id) ? current : [...current, miembro.usuario_id])
    const email = getMemberEmail(miembro)
    if (email) setSelectedInviteEmails((current) => current.filter((item) => item !== email))
    setCreateInviteQuery('')
    setCreateInviteOpen(false)
  }

  const addCreateEmailInvite = () => {
    const email = normalizeEmail(createInviteQuery)
    if (!email) {
      toast.error('Escribe un correo valido para invitar.')
      return
    }
    const matchingMember = miembrosOrganismoActivo.find((miembro) => getMemberEmail(miembro) === email)
    if (matchingMember) {
      selectCreateMemberInvite(matchingMember)
      return
    }
    setSelectedInviteEmails((current) => current.includes(email) ? current : [...current, email])
    setCreateInviteQuery('')
    setCreateInviteOpen(false)
  }

  const selectExistingMeetingMemberInvite = (miembro: MiembroConPerfil) => {
    setSelectedInviteMembers((current) => current.includes(miembro.usuario_id) ? current : [...current, miembro.usuario_id])
    const email = getMemberEmail(miembro)
    if (email) setSelectedExistingInviteEmails((current) => current.filter((item) => item !== email))
    setExistingInviteQuery('')
  }

  const addExistingMeetingEmailInvite = () => {
    const email = normalizeEmail(existingInviteQuery)
    if (!email) {
      toast.error('Escribe un correo valido para invitar.')
      return
    }
    const alreadyInvited = inviteMeeting?.invitados?.some((invitado) => normalizeEmail(invitado.email ?? '') === email)
    if (alreadyInvited) {
      toast.error('Ese correo ya esta invitado a la reunion.')
      return
    }
    const matchingMember = miembrosOrganismoActivo.find((miembro) => getMemberEmail(miembro) === email)
    if (matchingMember) {
      selectExistingMeetingMemberInvite(matchingMember)
      return
    }
    setSelectedExistingInviteEmails((current) => current.includes(email) ? current : [...current, email])
    setExistingInviteQuery('')
  }

  const openInviteManager = (reunion: Reunion) => {
    setInviteMeeting(reunion)
    setSelectedInviteMembers([])
    setSelectedExistingInviteEmails([])
    setExistingInviteQuery('')
    setError('')
    if (miembros.length === 0) void loadMiembros()
  }

  const toggleExistingMeetingInvite = (usuarioId: string) => {
    setSelectedInviteMembers((current) => current.includes(usuarioId)
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
    setSelectedInviteEmails([])
    setCreateInviteQuery('')
    setCreateInviteOpen(false)
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
          enlace_reunion: form.crear_google_meet ? null : form.enlace_reunion,
          invitado_usuario_ids: selectedInvites,
          invitado_emails: selectedCreateInviteEmails,
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

  const resendMeetingInvites = async (reunionId: string) => {
    try {
      const response = await fetch('/api/reuniones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reunionId, action: 'resend_invites' }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string; sent?: number }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron reenviar las invitaciones.')
      toast.success(`Invitaciones reenviadas: ${result.sent ?? 0}.`)
    } catch (resendError) {
      toast.error(resendError instanceof Error ? resendError.message : 'No se pudieron reenviar las invitaciones.')
    }
  }

  const addParticipantsToMeeting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteMeeting) return
    setInviteSaving(true)
    setError('')

    try {
      const response = await fetch('/api/reuniones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reunionId: inviteMeeting.id,
          action: 'add_invites',
          invitado_usuario_ids: selectedInviteMembers,
          invitado_emails: selectedExistingInviteEmails,
        }),
      })
      const result = (await response.json()) as { ok?: boolean; added?: number; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'No se pudieron agregar participantes.')

      toast.success(`${result.added ?? selectedInviteMembers.length + selectedExistingInviteEmails.length} participante(s) agregado(s) a la convocatoria.`)
      setInviteMeeting(null)
      setSelectedInviteMembers([])
      setSelectedExistingInviteEmails([])
      setExistingInviteQuery('')
      await loadReuniones()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudieron agregar participantes.')
    } finally {
      setInviteSaving(false)
    }
  }

  const MeetingCard = ({ reunion }: { reunion: Reunion }) => {
    const invitados = reunion.invitados ?? []
    const myInvitation = invitados.find((invitado) => invitado.usuario_id === profile?.id)
    const confirmados = invitados.filter((invitado) => invitado.estado_respuesta === 'confirmado').length
    const canOpenGoogleMeet = reunion.estado === 'programada' && !!reunion.enlace_reunion && (reunion.modalidad === 'virtual' || reunion.modalidad === 'hibrida')

    return (
      <article className="surface-panel overflow-hidden p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${reunion.estado === 'cancelada' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-700'}`}>
                {reunion.estado}
              </span>
              <span className="badge border-slate-200 bg-slate-100 text-slate-600">{reunion.modalidad}</span>
              {reunion.proveedor_reunion === 'google_meet' && (
                <span className="badge border-sky-200 bg-sky-50 text-sky-700">
                  Google Meet
                </span>
              )}
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

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {canOpenGoogleMeet && (
              <a
                href={reunion.enlace_reunion ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="action-btn-primary justify-center"
              >
                <Video size={15} />
                Entrar en Google Meet
              </a>
            )}
            {canManageMeetings && reunion.estado === 'programada' && (
              <>
                <button
                  type="button"
                  onClick={() => openInviteManager(reunion)}
                  className="action-btn justify-center"
                >
                  <Users size={15} />
                  Participantes
                </button>
                <button
                  type="button"
                  onClick={() => void resendMeetingInvites(reunion.id)}
                  className="action-btn justify-center"
                >
                  <Mail size={15} />
                  Reenviar invitaciones
                </button>
                <button
                  type="button"
                  onClick={() => void actualizarEstado(reunion.id, 'cancelada')}
                  className="action-btn-ghost justify-center text-rose-600 hover:text-rose-700"
                >
                  <XCircle size={15} />
                  Cancelar
                </button>
              </>
            )}
          </div>
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
                <input
                  value={form.enlace_reunion}
                  onChange={(event) => setForm((current) => ({ ...current, enlace_reunion: event.target.value }))}
                  className="input-shell"
                  placeholder={form.crear_google_meet ? 'Se generara automaticamente con Google Meet' : 'https://meet.google.com/...'}
                  disabled={form.crear_google_meet && (form.modalidad === 'virtual' || form.modalidad === 'hibrida')}
                />
              </div>
              <div>
                <label className="label-field">Ubicacion</label>
                <input value={form.ubicacion} onChange={(event) => setForm((current) => ({ ...current, ubicacion: event.target.value }))} className="input-shell" placeholder="Sala de reuniones" />
              </div>
            </div>

            <div>
              {(form.modalidad === 'virtual' || form.modalidad === 'hibrida') && (
                <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/80 bg-white/60 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.crear_google_meet}
                    onChange={(event) => setForm((current) => ({ ...current, crear_google_meet: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Video size={15} className="text-teal-700" />
                      Crear enlace automaticamente con Google Meet
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      La agenda creara un espacio en Google Meet y usara el enlace generado para invitados, alertas y correos.
                    </span>
                  </span>
                </label>
              )}

              <label className="label-field">Descripcion</label>
              <textarea value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} className="input-shell min-h-24 resize-y py-3" placeholder="Objetivo y puntos a tratar" />
            </div>

            <div>
              <label className="label-field">Invitados</label>
              <div className="relative">
                <div className="input-shell flex items-center gap-2 py-2">
                  <Mail size={16} className="text-teal-700" />
                  <input
                    value={createInviteQuery}
                    onChange={(event) => setCreateInviteQuery(event.target.value)}
                    onFocus={() => setCreateInviteOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCreateEmailInvite()
                      } else if (event.key === 'Escape') {
                        setCreateInviteOpen(false)
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder="Buscar miembro o escribir correo"
                  />
                  <button type="button" onClick={() => setCreateInviteOpen((current) => !current)} className="action-btn h-9 rounded-2xl px-3 text-xs">
                    Miembros
                  </button>
                  <button type="button" onClick={addCreateEmailInvite} className="action-btn h-9 rounded-2xl px-3 text-xs">
                    Agregar
                  </button>
                </div>

                {createInviteOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border p-2 shadow-xl" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                    <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Miembros del organismo</p>
                    {createInviteMatches.map((miembro) => {
                      const nombre = getMemberName(miembro)
                      const email = getMemberEmail(miembro)
                      return (
                        <button
                          key={miembro.usuario_id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCreateMemberInvite(miembro)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-teal-50 dark:hover:bg-white/5"
                        >
                          <UserAvatar name={nombre} avatarUrl={miembro.perfil?.avatar_url} size="sm" className="h-9 w-9" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{nombre}</span>
                            <span className="block truncate text-xs text-slate-500">{email || 'Sin correo'}</span>
                          </span>
                        </button>
                      )
                    })}
                    {normalizeEmail(createInviteQuery) && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={addCreateEmailInvite}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/5"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                          <Mail size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">Invitar correo</span>
                          <span className="block truncate text-xs">{normalizeEmail(createInviteQuery)}</span>
                        </span>
                      </button>
                    )}
                    {createInviteMatches.length === 0 && !normalizeEmail(createInviteQuery) && miembros.length > 0 && (
                      <p className="px-3 py-4 text-sm text-slate-500">No hay coincidencias. Escribe un correo valido para invitar.</p>
                    )}
                    {miembrosOrganismoActivo.length === 0 && (
                      <p className="px-3 py-4 text-sm text-slate-500">No hay miembros cargados en este organismo. Tambien puedes escribir un correo para invitar.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCreateMembers.map((miembro) => {
                  const nombre = getMemberName(miembro)
                  const email = getMemberEmail(miembro)
                  return (
                    <button
                      key={miembro.usuario_id}
                      type="button"
                      onClick={() => toggleInvite(miembro.usuario_id)}
                      className="flex max-w-full items-center gap-2 rounded-2xl border border-teal-100 bg-teal-50 px-3 py-2 text-left text-teal-800"
                    >
                      <UserAvatar name={nombre} avatarUrl={miembro.perfil?.avatar_url} size="sm" className="h-9 w-9" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{nombre}</span>
                        <span className="block truncate text-xs opacity-75">{email || 'Sin correo'}</span>
                      </span>
                      <XCircle size={15} className="flex-shrink-0" />
                    </button>
                  )
                })}
                {selectedInviteEmails.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => setSelectedInviteEmails((current) => current.filter((item) => item !== email))}
                    className="flex max-w-full items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-left text-sky-800"
                  >
                    <Mail size={15} className="flex-shrink-0" />
                    <span className="truncate text-sm font-semibold">{email}</span>
                    <XCircle size={15} className="flex-shrink-0" />
                  </button>
                ))}
                {selectedCreateMembers.length === 0 && selectedInviteEmails.length === 0 && (
                  <p className="text-sm text-slate-500">Selecciona miembros del organismo o escribe un correo y pulsa Enter.</p>
                )}
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

      {inviteMeeting && canManageMeetings && (
        <div className="agenda-modal-overlay">
          <div className="agenda-modal-shell max-w-4xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Convocatoria de reunion</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">Participantes</h2>
                <p className="mt-1 text-sm text-slate-500">{inviteMeeting.titulo}</p>
              </div>
              <button type="button" onClick={() => { setInviteMeeting(null); setSelectedInviteMembers([]); setSelectedExistingInviteEmails([]); setExistingInviteQuery(''); setError('') }} className="agenda-modal-close" aria-label="Cerrar participantes">
                <XCircle size={16} />
              </button>
            </div>

            <form onSubmit={addParticipantsToMeeting} className="space-y-5">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

              <div className="rounded-[24px] border border-white/80 bg-white/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Invitar participantes</p>
                    <p className="mt-1 text-xs text-slate-500">Busca miembros del organismo o escribe correos nuevos para agregarlos.</p>
                  </div>
                  <span className="section-label self-start sm:self-auto">{selectedInviteMembers.length + selectedExistingInviteEmails.length} nuevos</span>
                </div>

                <div className="relative mt-4">
                  <div className="input-shell flex items-center gap-2 py-2">
                    <Mail size={16} className="text-teal-700" />
                    <input
                      value={existingInviteQuery}
                      onChange={(event) => setExistingInviteQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addExistingMeetingEmailInvite()
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder="Buscar miembro o escribir correo"
                    />
                    <button type="button" onClick={addExistingMeetingEmailInvite} className="action-btn h-9 rounded-2xl px-3 text-xs">
                      Agregar
                    </button>
                  </div>

                  {existingInviteQuery.trim() && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border p-2 shadow-xl" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                      {existingInviteMatches.map((miembro) => {
                        const nombre = getMemberName(miembro)
                        const email = getMemberEmail(miembro)
                        return (
                          <button
                            key={miembro.usuario_id}
                            type="button"
                            onClick={() => selectExistingMeetingMemberInvite(miembro)}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-teal-50 dark:hover:bg-white/5"
                          >
                            <UserAvatar name={nombre} avatarUrl={miembro.perfil?.avatar_url} size="sm" className="h-9 w-9" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{nombre}</span>
                              <span className="block truncate text-xs text-slate-500">{email || 'Sin correo'}</span>
                            </span>
                          </button>
                        )
                      })}
                      {normalizeEmail(existingInviteQuery) && (
                        <button
                          type="button"
                          onClick={addExistingMeetingEmailInvite}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-white/5"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                            <Mail size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">Invitar correo</span>
                            <span className="block truncate text-xs">{normalizeEmail(existingInviteQuery)}</span>
                          </span>
                        </button>
                      )}
                      {existingInviteMatches.length === 0 && !normalizeEmail(existingInviteQuery) && (
                        <p className="px-3 py-4 text-sm text-slate-500">No hay coincidencias. Escribe un correo valido para invitar.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedExistingMembers.map((miembro) => {
                    const nombre = getMemberName(miembro)
                    const email = getMemberEmail(miembro)
                    return (
                      <button
                        key={miembro.usuario_id}
                        type="button"
                        onClick={() => toggleExistingMeetingInvite(miembro.usuario_id)}
                        className="flex max-w-full items-center gap-2 rounded-2xl border border-teal-100 bg-teal-50 px-3 py-2 text-left text-teal-800"
                      >
                        <UserAvatar name={nombre} avatarUrl={miembro.perfil?.avatar_url} size="sm" className="h-9 w-9" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{nombre}</span>
                          <span className="block truncate text-xs opacity-75">{email || 'Sin correo'}</span>
                        </span>
                        <XCircle size={15} className="flex-shrink-0" />
                      </button>
                    )
                  })}
                  {selectedExistingInviteEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setSelectedExistingInviteEmails((current) => current.filter((item) => item !== email))}
                      className="flex max-w-full items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-left text-sky-800"
                    >
                      <Mail size={15} className="flex-shrink-0" />
                      <span className="truncate text-sm font-semibold">{email}</span>
                      <XCircle size={15} className="flex-shrink-0" />
                    </button>
                  ))}
                  {selectedExistingMembers.length === 0 && selectedExistingInviteEmails.length === 0 && (
                    <p className="text-sm text-slate-500">Los participantes ya invitados se omiten automaticamente.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setInviteMeeting(null); setSelectedInviteMembers([]); setSelectedExistingInviteEmails([]); setExistingInviteQuery(''); setError('') }}
                  className="action-btn-ghost flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={inviteSaving || (selectedInviteMembers.length === 0 && selectedExistingInviteEmails.length === 0)} className="action-btn-primary flex-1 justify-center disabled:opacity-60">
                  {inviteSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {inviteSaving ? 'Agregando...' : 'Agregar participantes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
