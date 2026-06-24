import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { MANAGER_ROLE_CODES } from '@/lib/access-control'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'
import { sendAgendaEmail, escapeHtml } from '@/lib/email/resend'
import type { ReunionModalidad, ReunionRespuesta } from '@/lib/types'
import { createZoomMeeting, type CreatedZoomMeeting } from '@/lib/zoom'

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
  crear_zoom?: boolean
}

type UpdateMeetingBody = {
  reunionId?: string
  invitadoId?: number
  respuesta?: ReunionRespuesta
  estado?: 'programada' | 'cancelada' | 'finalizada'
}

type MemberRow = {
  usuario_id: string
  perfil?: { nombre_completo?: string | null; email?: string | null } | Array<{ nombre_completo?: string | null; email?: string | null }> | null
}

function normalizeProfile(value: MemberRow['perfil']) {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function getBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return `${new URL(request.url).protocol}//${request.headers.get('host')}`
}

function formatMeetingDate(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Malabo',
  })
}

function minutesBetween(start: Date, end: Date | null) {
  if (!end || end <= start) return 60
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000))
}

function isMissingZoomColumnsError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /proveedor_reunion|zoom_(meeting_id|meeting_uuid|start_url|password|host_id)|column .* does not exist|schema cache/i.test(message)
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
  appUrl: string
}) {
  const locationLine = params.modalidad === 'virtual'
    ? params.enlace
    : params.modalidad === 'presencial'
      ? params.ubicacion
      : [params.enlace, params.ubicacion].filter(Boolean).join(' | ')

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
        <a href="${params.appUrl}/reuniones" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Confirmar participacion
        </a>
      </div>
      ${params.enlace ? `<p style="font-size:13px;color:#64748b">Enlace de reunion: ${escapeHtml(params.enlace)}</p>` : ''}
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

    let query = admin
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
    const shouldCreateZoom = !!body.crear_zoom && (modalidad === 'virtual' || modalidad === 'hibrida')

    if (!titulo) return NextResponse.json({ ok: false, error: 'El titulo es obligatorio.' }, { status: 400 })
    if (!fechaInicio || Number.isNaN(fechaInicio.getTime())) {
      return NextResponse.json({ ok: false, error: 'La fecha de inicio es obligatoria.' }, { status: 400 })
    }
    if (fechaFin && fechaFin <= fechaInicio) {
      return NextResponse.json({ ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }, { status: 400 })
    }
    if ((modalidad === 'virtual' || modalidad === 'hibrida') && !body.enlace_reunion?.trim() && !shouldCreateZoom) {
      return NextResponse.json({ ok: false, error: 'Escribe un enlace o activa la creacion automatica con Zoom.' }, { status: 400 })
    }
    if (invitadoIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecciona al menos un invitado.' }, { status: 400 })
    }

    const organismo = await loadOrganismo(admin, organismoId)
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const { data: members, error: membersError } = await admin
      .from('organismo_miembros')
      .select('usuario_id, perfil:perfiles_usuario(nombre_completo, email)')
      .eq('organismo_id', organismoId)
      .eq('activo', true)
      .in('usuario_id', invitadoIds)

    if (membersError) throw membersError

    const invitedMembers = ((members ?? []) as MemberRow[]).map((member) => {
      const memberProfile = normalizeProfile(member.perfil)
      return {
        usuario_id: member.usuario_id,
        email: memberProfile?.email?.trim().toLowerCase() ?? null,
        nombre: memberProfile?.nombre_completo?.trim() || memberProfile?.email?.split('@')[0] || 'Usuario',
      }
    }).filter((member) => member.email)

    if (invitedMembers.length === 0) {
      return NextResponse.json({ ok: false, error: 'No se encontraron miembros validos para invitar.' }, { status: 400 })
    }

    let zoomMeeting: CreatedZoomMeeting | null = null
    if (shouldCreateZoom) {
      zoomMeeting = await createZoomMeeting({
        topic: titulo,
        agenda: body.descripcion?.trim() || null,
        startTime: fechaInicio.toISOString(),
        durationMinutes: minutesBetween(fechaInicio, fechaFin),
      })
    }

    const meetingLink = zoomMeeting?.joinUrl ?? body.enlace_reunion?.trim() ?? null
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
    const zoomMeetingInsert = {
      ...baseMeetingInsert,
      proveedor_reunion: zoomMeeting ? 'zoom' : meetingLink ? 'manual' : null,
      zoom_meeting_id: zoomMeeting?.id ?? null,
      zoom_meeting_uuid: zoomMeeting?.uuid ?? null,
      zoom_start_url: zoomMeeting?.startUrl ?? null,
      zoom_password: zoomMeeting?.password ?? null,
      zoom_host_id: zoomMeeting?.hostId ?? null,
    }

    const insertResult = await admin
      .from('reuniones')
      .insert(zoomMeetingInsert as never)
      .select('id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, enlace_reunion, ubicacion')
      .single()
    const fallbackInsert = insertResult.error && isMissingZoomColumnsError(insertResult.error)
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
      .insert(invitedMembers.map((member) => ({
        reunion_id: reunion.id,
        usuario_id: member.usuario_id,
        email: member.email,
        nombre: member.nombre,
      })))
      .select('id, usuario_id, email, nombre')

    if (invitadosError) throw invitadosError

    const appUrl = getBaseUrl(request)
    const inviterName = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Un usuario'
    const emailHtml = meetingEmailHtml({
      organismoNombre: organismo.nombre,
      inviterName,
      titulo,
      descripcion: body.descripcion,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin?.toISOString() ?? null,
      modalidad,
      enlace: meetingLink,
      ubicacion: body.ubicacion,
      appUrl,
    })

    for (const invitado of invitados ?? []) {
      const email = invitado.email ?? ''
      const emailResult = email
        ? await sendAgendaEmail({
            to: email,
            subject: `Reunion: ${titulo}`,
            html: emailHtml,
            text: `${inviterName} te invita a la reunion "${titulo}" de ${organismo.nombre}. Confirma tu participacion en ${appUrl}/reuniones. Enlace: ${meetingLink ?? 'sin enlace'}`,
          })
        : { ok: false as const, error: 'El invitado no tiene email.' }

      await admin.from('alertas').insert({
        organismo_id: organismoId,
        modulo: 'reuniones',
        referencia_id: reunion.id,
        tarea_id: null,
        tipo_alerta: 'Reunion',
        titulo: `Invitacion a reunion: ${titulo}`,
        mensaje: meetingLink
          ? `Confirma tu participacion. Enlace: ${meetingLink}`
          : 'Confirma tu participacion en el modulo de reuniones.',
        destinatario_usuario_id: invitado.usuario_id,
        destinatario_email: email || null,
        alerta_key: `reunion:${reunion.id}:${invitado.usuario_id ?? email}`,
        enviada_email_at: emailResult.ok ? new Date().toISOString() : null,
        email_error: emailResult.ok ? null : emailResult.error,
        leida: false,
      })
    }

    return NextResponse.json({ ok: true, reunionId: reunion.id })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear la reunion.' },
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

      const { error } = await admin
        .from('reunion_invitados')
        .update({ estado_respuesta: body.respuesta, respondido_at: new Date().toISOString() })
        .eq('id', body.invitadoId)
        .eq('usuario_id', user.id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.reunionId && body.estado) {
      if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
        return NextResponse.json({ ok: false, error: 'Sin permiso para actualizar la reunion.' }, { status: 403 })
      }

      const { error } = await admin
        .from('reuniones')
        .update({ estado: body.estado })
        .eq('id', body.reunionId)
        .eq('organismo_id', organismoId)

      if (error) throw error
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
