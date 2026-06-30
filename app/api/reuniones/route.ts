import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { MANAGER_ROLE_CODES } from '@/lib/access-control'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'
import { sendAgendaEmail, escapeHtml } from '@/lib/email/resend'
import type { ReunionModalidad, ReunionRespuesta } from '@/lib/types'
import { createGoogleMeetSpace, endActiveGoogleMeetConference, GoogleMeetIntegrationError, type CreatedGoogleMeetSpace } from '@/lib/google-meet'
import { loadActiveOrganismoDirectory } from '@/lib/organismo-member-directory'
import { getPublicAppOrigin } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

type CreateMeetingBody = {
  titulo?: string
  descripcion?: string
  fecha_inicio?: string
  fecha_fin?: string | null
  modalidad?: ReunionModalidad
  enlace_reunion?: string | null
  ubicacion?: string | null
  invitado_usuario_ids?: string[]
  invitado_emails?: string[]
  crear_google_meet?: boolean
}

type UpdateMeetingBody = {
  reunionId?: string
  invitadoId?: number
  respuesta?: ReunionRespuesta
  estado?: 'programada' | 'cancelada' | 'finalizada'
  action?: 'add_invites' | 'resend_invites'
  invitado_usuario_ids?: string[]
  invitado_emails?: string[]
}

type MeetingInviteTarget = {
  usuario_id?: string | null
  email: string | null
  nombre: string
}

type MeetingNotificationTarget = MeetingInviteTarget & {
  token_confirmacion: string
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function formatMeetingDate(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Malabo',
  })
}

function isMissingGoogleMeetColumnsError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /proveedor_reunion|google_meet_(space_name|code)|column .* does not exist|schema cache/i.test(message)
  )
}

function meetingEmailHtml(params: {
  organismoNombre: string
  inviterName: string
  titulo: string
  descripcion?: string | null
  fechaInicio: string
  fechaFin?: string | null
  modalidad: string
  enlace?: string | null
  ubicacion?: string | null
  confirmationUrl: string
}) {
  const locationLine = params.modalidad === 'virtual'
    ? 'El enlace de acceso estara disponible despues de confirmar.'
    : params.modalidad === 'presencial'
      ? params.ubicacion
      : [params.ubicacion, 'El enlace virtual estara disponible despues de confirmar.'].filter(Boolean).join(' | ')

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 12px">Invitacion a reunion</h2>
      <p>${escapeHtml(params.inviterName)} te ha invitado a una reunion de <strong>${escapeHtml(params.organismoNombre)}</strong>.</p>
      <div style="margin:18px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
        <p style="margin:0 0 8px;font-size:16px;font-weight:700">${escapeHtml(params.titulo)}</p>
        <p style="margin:0;color:#475569">${escapeHtml(params.descripcion || 'Sin descripcion adicional.')}</p>
        <p style="margin:12px 0 0"><strong>Inicio:</strong> ${escapeHtml(formatMeetingDate(params.fechaInicio))}</p>
        ${params.fechaFin ? `<p style="margin:4px 0 0"><strong>Fin:</strong> ${escapeHtml(formatMeetingDate(params.fechaFin))}</p>` : ''}
        <p style="margin:4px 0 0"><strong>Modalidad:</strong> ${escapeHtml(params.modalidad)}</p>
        ${locationLine ? `<p style="margin:4px 0 0"><strong>Acceso:</strong> ${escapeHtml(locationLine)}</p>` : ''}
      </div>
      <div style="margin:24px 0">
        <a href="${escapeHtml(params.confirmationUrl)}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmar participacion
        </a>
      </div>
    </div>
  `
}

async function loadOrganismo(admin: ReturnType<typeof createAdminSupabaseClient>, organismoId: string) {
  const { data: organismo, error } = await admin
    .from('organismos')
    .select('id, nombre, slug')
    .eq('id', organismoId)
    .maybeSingle()

  if (error) throw error
  return organismo
}

async function loadInvitedMembers(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  organismoId: string,
  invitadoIds: string[]
) {
  if (invitadoIds.length === 0) return []

  const members = await loadActiveOrganismoDirectory(admin, organismoId, invitadoIds)

  return members.map((member) => {
    return {
      usuario_id: member.usuario_id,
      email: member.perfil.email || null,
      nombre: member.perfil.nombre_completo?.trim() || member.perfil.email.split('@')[0] || 'Usuario',
    }
  }).filter((member) => member.email)
}

async function resolveInviteTargets(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  organismoId: string,
  invitadoIds: string[],
  invitadoEmails: string[]
): Promise<MeetingInviteTarget[]> {
  const members = await loadInvitedMembers(admin, organismoId, invitadoIds)
  const memberEmails = new Set(members.map((member) => normalizeEmail(member.email)).filter(Boolean))
  const externalEmails = Array.from(new Set(invitadoEmails.map(normalizeEmail).filter(Boolean)))
    .filter((email) => !memberEmails.has(email))
    .map((email) => ({
      usuario_id: null,
      email,
      nombre: email.split('@')[0] || 'Invitado',
    }))

  return [...members, ...externalEmails]
}

async function notifyMeetingInvites(params: {
  admin: ReturnType<typeof createAdminSupabaseClient>
  organismoId: string
  reunion: {
    id: string
    titulo: string
    descripcion?: string | null
    fecha_inicio: string
    fecha_fin?: string | null
    modalidad: string
    enlace_reunion?: string | null
    ubicacion?: string | null
  }
  organismoNombre: string
  inviterName: string
  appUrl: string
  invitados: MeetingNotificationTarget[]
}) {
  for (const invitado of params.invitados) {
    const email = invitado.email ?? ''
    const recipientKey = invitado.usuario_id ?? email
    if (!recipientKey) continue

    const confirmationUrl = new URL('/reuniones/confirmar', params.appUrl)
    confirmationUrl.searchParams.set('token', invitado.token_confirmacion)
    const emailHtml = meetingEmailHtml({
      organismoNombre: params.organismoNombre,
      inviterName: params.inviterName,
      titulo: params.reunion.titulo,
      descripcion: params.reunion.descripcion,
      fechaInicio: params.reunion.fecha_inicio,
      fechaFin: params.reunion.fecha_fin ?? null,
      modalidad: params.reunion.modalidad,
      enlace: params.reunion.enlace_reunion,
      ubicacion: params.reunion.ubicacion,
      confirmationUrl: confirmationUrl.toString(),
    })

    const emailResult = email
      ? await sendAgendaEmail({
          to: email,
          subject: `Reunion: ${params.reunion.titulo}`,
          html: emailHtml,
          text: `${params.inviterName} te invita a la reunion "${params.reunion.titulo}" de ${params.organismoNombre}. Confirma tu participacion en ${confirmationUrl.toString()}.`,
        })
      : { ok: false as const, error: 'El invitado no tiene email.' }

    await params.admin.from('alertas').upsert(
      {
        organismo_id: params.organismoId,
        modulo: 'reuniones',
        referencia_id: params.reunion.id,
        tarea_id: null,
        tipo_alerta: 'Reunion',
        titulo: `Invitacion a reunion: ${params.reunion.titulo}`,
        mensaje: params.reunion.enlace_reunion
          ? `Confirma tu participacion. Enlace: ${params.reunion.enlace_reunion}`
          : 'Confirma tu participacion en el modulo de reuniones.',
        destinatario_usuario_id: invitado.usuario_id ?? null,
        destinatario_email: email || null,
        alerta_key: `reunion:${params.reunion.id}:${recipientKey}`,
        enviada_email_at: emailResult.ok ? new Date().toISOString() : null,
        email_error: emailResult.ok ? null : emailResult.error,
        leida: false,
      },
      { onConflict: 'alerta_key' }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    const isManager = MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])

    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    }

    const query = admin
      .from('reuniones')
      .select('*, invitados:reunion_invitados(id, reunion_id, usuario_id, email, nombre, estado_respuesta, respondido_at, invitado_at)')
      .eq('organismo_id', organismoId)
      .order('fecha_inicio', { ascending: true })

    const { data, error } = await query
    if (error) throw error

    const reuniones = ((data ?? []) as Array<Record<string, unknown>>).filter((reunion) => {
      if (isManager) return true
      const invitados = Array.isArray(reunion.invitados) ? reunion.invitados as Array<{ usuario_id?: string | null }> : []
      return invitados.some((invitado) => invitado.usuario_id === user.id)
    })

    return NextResponse.json({ ok: true, reuniones })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudieron cargar las reuniones.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    }

    if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Sin permiso para programar reuniones.' }, { status: 403 })
    }

    const body = (await request.json()) as CreateMeetingBody
    const titulo = body.titulo?.trim()
    const fechaInicio = body.fecha_inicio ? new Date(body.fecha_inicio) : null
    const fechaFin = body.fecha_fin ? new Date(body.fecha_fin) : null
    const modalidad = body.modalidad ?? 'virtual'
    const invitadoIds = Array.from(new Set((body.invitado_usuario_ids ?? []).filter(Boolean)))
    const invitadoEmails = Array.from(new Set((body.invitado_emails ?? []).map(normalizeEmail).filter(Boolean)))
    const shouldCreateGoogleMeet = !!body.crear_google_meet && (modalidad === 'virtual' || modalidad === 'hibrida')

    if (!titulo) return NextResponse.json({ ok: false, error: 'El titulo es obligatorio.' }, { status: 400 })
    if (!fechaInicio || Number.isNaN(fechaInicio.getTime())) {
      return NextResponse.json({ ok: false, error: 'La fecha de inicio es obligatoria.' }, { status: 400 })
    }
    if (fechaFin && fechaFin <= fechaInicio) {
      return NextResponse.json({ ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }, { status: 400 })
    }
    if ((modalidad === 'virtual' || modalidad === 'hibrida') && !body.enlace_reunion?.trim() && !shouldCreateGoogleMeet) {
      return NextResponse.json({ ok: false, error: 'Escribe un enlace o activa la creacion automatica con Google Meet.' }, { status: 400 })
    }
    if (invitadoIds.length === 0 && invitadoEmails.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecciona al menos un invitado.' }, { status: 400 })
    }

    const organismo = await loadOrganismo(admin, organismoId)
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const invitedTargets = await resolveInviteTargets(admin, organismoId, invitadoIds, invitadoEmails)

    if (invitedTargets.length === 0) {
      return NextResponse.json({ ok: false, error: 'No se encontraron invitados validos.' }, { status: 400 })
    }

    let googleMeetSpace: CreatedGoogleMeetSpace | null = null
    if (shouldCreateGoogleMeet) {
      googleMeetSpace = await createGoogleMeetSpace()
    }

    const meetingLink = googleMeetSpace?.meetingUri ?? body.enlace_reunion?.trim() ?? null
    const baseMeetingInsert = {
      organismo_id: organismoId,
      titulo,
      descripcion: body.descripcion?.trim() || null,
      fecha_inicio: fechaInicio.toISOString(),
      fecha_fin: fechaFin?.toISOString() ?? null,
      modalidad,
      enlace_reunion: meetingLink,
      ubicacion: body.ubicacion?.trim() || null,
      creada_por_usuario_id: user.id,
    }
    const googleMeetInsert = {
      ...baseMeetingInsert,
      proveedor_reunion: googleMeetSpace ? 'google_meet' : meetingLink ? 'manual' : null,
      google_meet_space_name: googleMeetSpace?.name ?? null,
      google_meet_code: googleMeetSpace?.meetingCode ?? null,
    }

    const insertResult = await admin
      .from('reuniones')
      .insert(googleMeetInsert as never)
      .select('id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, enlace_reunion, ubicacion')
      .single()
    const fallbackInsert = insertResult.error && isMissingGoogleMeetColumnsError(insertResult.error)
      ? await admin
          .from('reuniones')
          .insert(baseMeetingInsert)
          .select('id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, enlace_reunion, ubicacion')
          .single()
      : insertResult
    const { data: reunion, error: reunionError } = fallbackInsert

    if (reunionError) throw reunionError

    const { data: invitados, error: invitadosError } = await admin
      .from('reunion_invitados')
      .insert(invitedTargets.map((member) => ({
        reunion_id: reunion.id,
        usuario_id: member.usuario_id ?? null,
        email: member.email,
        nombre: member.nombre,
      })))
      .select('id, usuario_id, email, nombre, token_confirmacion')

    if (invitadosError) throw invitadosError

    const appUrl = getPublicAppOrigin(request)
    const inviterName = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Un usuario'
    await notifyMeetingInvites({
      admin,
      organismoId,
      reunion: {
        id: reunion.id,
        titulo,
        descripcion: body.descripcion?.trim() || null,
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin?.toISOString() ?? null,
        modalidad,
        enlace_reunion: meetingLink,
        ubicacion: body.ubicacion?.trim() || null,
      },
      organismoNombre: organismo.nombre,
      inviterName,
      appUrl,
      invitados: (invitados ?? []).map((invitado) => ({
        usuario_id: invitado.usuario_id as string | null,
        email: invitado.email ?? null,
        nombre: invitado.nombre ?? 'Usuario',
        token_confirmacion: invitado.token_confirmacion,
      })),
    })

    return NextResponse.json({ ok: true, reunionId: reunion.id })
  } catch (error: unknown) {
    if (error instanceof GoogleMeetIntegrationError) {
      console.error(`[${error.code}] ${error.message}`)
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status }
      )
    }

    console.error('Meeting creation failed:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo crear la reunion.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    const body = (await request.json()) as UpdateMeetingBody

    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    }

    if (body.invitadoId && body.respuesta) {
      if (!['pendiente', 'confirmado', 'rechazado', 'tentativo'].includes(body.respuesta)) {
        return NextResponse.json({ ok: false, error: 'Respuesta invalida.' }, { status: 400 })
      }

      const { data: invitation, error: invitationError } = await admin
        .from('reunion_invitados')
        .select('id, reunion_id')
        .eq('id', body.invitadoId)
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (invitationError) throw invitationError
      if (!invitation) {
        return NextResponse.json({ ok: false, error: 'La invitacion no pertenece a este usuario.' }, { status: 404 })
      }

      const { data: invitationMeeting, error: invitationMeetingError } = await admin
        .from('reuniones')
        .select('id, estado')
        .eq('id', invitation.reunion_id)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (invitationMeetingError) throw invitationMeetingError
      if (!invitationMeeting) {
        return NextResponse.json({ ok: false, error: 'La invitacion no pertenece al organismo activo.' }, { status: 403 })
      }
      if (invitationMeeting.estado !== 'programada') {
        return NextResponse.json({ ok: false, error: 'Esta reunion ya no admite confirmaciones.' }, { status: 409 })
      }

      const { data: updated, error } = await admin
        .from('reunion_invitados')
        .update({ estado_respuesta: body.respuesta, respondido_at: new Date().toISOString() })
        .eq('id', body.invitadoId)
        .eq('usuario_id', user.id)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!updated) return NextResponse.json({ ok: false, error: 'No se pudo actualizar la invitacion.' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    if (body.reunionId && body.action === 'resend_invites') {
      if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
        return NextResponse.json({ ok: false, error: 'Sin permiso para reenviar invitaciones.' }, { status: 403 })
      }

      const { data: reunion, error: reunionError } = await admin
        .from('reuniones')
        .select('id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, enlace_reunion, ubicacion, estado')
        .eq('id', body.reunionId)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (reunionError) throw reunionError
      if (!reunion) return NextResponse.json({ ok: false, error: 'Reunion no encontrada.' }, { status: 404 })
      if (reunion.estado !== 'programada') {
        return NextResponse.json({ ok: false, error: 'Solo se pueden reenviar invitaciones de reuniones programadas.' }, { status: 409 })
      }

      const { data: invitados, error: invitadosError } = await admin
        .from('reunion_invitados')
        .select('usuario_id, email, nombre, token_confirmacion')
        .eq('reunion_id', reunion.id)

      if (invitadosError) throw invitadosError
      if (!invitados?.length) {
        return NextResponse.json({ ok: false, error: 'La reunion no tiene invitados.' }, { status: 400 })
      }

      const organismo = await loadOrganismo(admin, organismoId)
      await notifyMeetingInvites({
        admin,
        organismoId,
        reunion,
        organismoNombre: organismo?.nombre ?? 'el organismo',
        inviterName: profile?.nombre_completo?.trim() || profile?.email || user.email || 'Un usuario',
        appUrl: getPublicAppOrigin(request),
        invitados: invitados.map((invitado) => ({
          usuario_id: invitado.usuario_id,
          email: invitado.email,
          nombre: invitado.nombre ?? 'Usuario',
          token_confirmacion: invitado.token_confirmacion,
        })),
      })

      return NextResponse.json({ ok: true, sent: invitados.length })
    }

    if (body.reunionId && body.action === 'add_invites') {
      if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
        return NextResponse.json({ ok: false, error: 'Sin permiso para modificar participantes de la reunion.' }, { status: 403 })
      }

      const invitadoIds = Array.from(new Set((body.invitado_usuario_ids ?? []).filter(Boolean)))
      const invitadoEmails = Array.from(new Set((body.invitado_emails ?? []).map(normalizeEmail).filter(Boolean)))
      if (invitadoIds.length === 0 && invitadoEmails.length === 0) {
        return NextResponse.json({ ok: false, error: 'Selecciona al menos un participante nuevo.' }, { status: 400 })
      }

      const { data: reunion, error: reunionError } = await admin
        .from('reuniones')
        .select('id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, enlace_reunion, ubicacion, estado')
        .eq('id', body.reunionId)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (reunionError) throw reunionError
      if (!reunion) return NextResponse.json({ ok: false, error: 'Reunion no encontrada.' }, { status: 404 })
      if (reunion.estado !== 'programada') {
        return NextResponse.json({ ok: false, error: 'Solo se pueden agregar participantes a reuniones programadas.' }, { status: 409 })
      }

      const { data: existing, error: existingError } = await admin
        .from('reunion_invitados')
        .select('usuario_id, email')
        .eq('reunion_id', reunion.id)

      if (existingError) throw existingError

      const existingIds = new Set((existing ?? []).map((row) => row.usuario_id).filter(Boolean))
      const existingEmails = new Set((existing ?? []).map((row) => normalizeEmail(row.email)).filter(Boolean))
      const newIds = invitadoIds.filter((id) => !existingIds.has(id))
      const newEmails = invitadoEmails.filter((email) => !existingEmails.has(email))

      const invitedTargets = await resolveInviteTargets(admin, organismoId, newIds, newEmails)
      if (invitedTargets.length === 0) {
        return NextResponse.json({ ok: false, error: 'Los participantes seleccionados ya estan invitados o no son validos.' }, { status: 400 })
      }

      const { data: nuevosInvitados, error: insertError } = await admin
        .from('reunion_invitados')
        .insert(invitedTargets.map((member) => ({
          reunion_id: reunion.id,
          usuario_id: member.usuario_id ?? null,
          email: member.email,
          nombre: member.nombre,
        })))
        .select('id, usuario_id, email, nombre, token_confirmacion')

      if (insertError) throw insertError

      const organismo = await loadOrganismo(admin, organismoId)
      const inviterName = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Un usuario'
      await notifyMeetingInvites({
        admin,
        organismoId,
        reunion: {
          id: reunion.id,
          titulo: reunion.titulo,
          descripcion: reunion.descripcion,
          fecha_inicio: reunion.fecha_inicio,
          fecha_fin: reunion.fecha_fin,
          modalidad: reunion.modalidad,
          enlace_reunion: reunion.enlace_reunion,
          ubicacion: reunion.ubicacion,
        },
        organismoNombre: organismo?.nombre ?? 'el organismo',
        inviterName,
        appUrl: getPublicAppOrigin(request),
        invitados: (nuevosInvitados ?? []).map((invitado) => ({
          usuario_id: invitado.usuario_id as string | null,
          email: invitado.email ?? null,
          nombre: invitado.nombre ?? 'Usuario',
          token_confirmacion: invitado.token_confirmacion,
        })),
      })

      return NextResponse.json({ ok: true, added: nuevosInvitados?.length ?? 0 })
    }

    if (body.reunionId && body.estado) {
      if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
        return NextResponse.json({ ok: false, error: 'Sin permiso para actualizar la reunion.' }, { status: 403 })
      }

      const { data: existingMeeting, error: existingMeetingError } = await admin
        .from('reuniones')
        .select('id, proveedor_reunion, google_meet_space_name')
        .eq('id', body.reunionId)
        .eq('organismo_id', organismoId)
        .maybeSingle()

      if (existingMeetingError) throw existingMeetingError
      if (!existingMeeting) return NextResponse.json({ ok: false, error: 'Reunion no encontrada.' }, { status: 404 })

      if (
        (body.estado === 'cancelada' || body.estado === 'finalizada') &&
        existingMeeting.proveedor_reunion === 'google_meet' &&
        existingMeeting.google_meet_space_name
      ) {
        await endActiveGoogleMeetConference(existingMeeting.google_meet_space_name)
      }

      const { data: updated, error } = await admin
        .from('reuniones')
        .update({ estado: body.estado })
        .eq('id', body.reunionId)
        .eq('organismo_id', organismoId)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!updated) return NextResponse.json({ ok: false, error: 'No se pudo actualizar la reunion.' }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Solicitud invalida.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar la reunion.' },
      { status: 500 }
    )
  }
}
