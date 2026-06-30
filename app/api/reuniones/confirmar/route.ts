import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { rejectRateLimited } from '@/lib/request-security'
import type { ReunionRespuesta } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_RESPONSES: ReunionRespuesta[] = ['confirmado', 'rechazado', 'tentativo']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function loadPublicInvitation(token: string) {
  const admin = createAdminSupabaseClient()
  const { data: invitation, error: invitationError } = await admin
    .from('reunion_invitados')
    .select('id, reunion_id, nombre, estado_respuesta, respondido_at')
    .eq('token_confirmacion', token)
    .maybeSingle()

  if (invitationError) throw invitationError
  if (!invitation) return null

  const { data: meeting, error: meetingError } = await admin
    .from('reuniones')
    .select('id, organismo_id, titulo, descripcion, fecha_inicio, fecha_fin, modalidad, ubicacion, enlace_reunion, estado')
    .eq('id', invitation.reunion_id)
    .maybeSingle()

  if (meetingError) throw meetingError
  if (!meeting) return null

  const { data: organismo, error: organismoError } = await admin
    .from('organismos')
    .select('nombre')
    .eq('id', meeting.organismo_id)
    .maybeSingle()

  if (organismoError) throw organismoError
  return { admin, invitation, meeting, organismoNombre: organismo?.nombre ?? 'Organismo' }
}

function publicPayload(data: NonNullable<Awaited<ReturnType<typeof loadPublicInvitation>>>) {
  return {
    invitacion: {
      nombre: data.invitation.nombre,
      estado_respuesta: data.invitation.estado_respuesta,
      respondido_at: data.invitation.respondido_at,
    },
    reunion: {
      titulo: data.meeting.titulo,
      descripcion: data.meeting.descripcion,
      fecha_inicio: data.meeting.fecha_inicio,
      fecha_fin: data.meeting.fecha_fin,
      modalidad: data.meeting.modalidad,
      ubicacion: data.meeting.ubicacion,
      estado: data.meeting.estado,
      enlace_reunion: data.invitation.estado_respuesta === 'confirmado'
        ? data.meeting.enlace_reunion
        : null,
      organismo_nombre: data.organismoNombre,
    },
  }
}

export async function GET(request: Request) {
  const rateLimited = rejectRateLimited(request, 'meeting-confirmation-read', {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  })
  if (rateLimited) return rateLimited

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''
  if (!UUID_PATTERN.test(token)) {
    return NextResponse.json({ ok: false, error: 'Enlace de confirmacion no valido.' }, { status: 400 })
  }

  try {
    const data = await loadPublicInvitation(token)
    if (!data) return NextResponse.json({ ok: false, error: 'Invitacion no encontrada.' }, { status: 404 })
    return NextResponse.json({ ok: true, ...publicPayload(data) })
  } catch (error) {
    console.error('Public meeting invitation read failed:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar la invitacion.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const rateLimited = rejectRateLimited(request, 'meeting-confirmation-write', {
    limit: 12,
    windowMs: 15 * 60 * 1000,
  })
  if (rateLimited) return rateLimited

  let body: { token?: string; respuesta?: ReunionRespuesta }
  try {
    body = (await request.json()) as { token?: string; respuesta?: ReunionRespuesta }
  } catch {
    return NextResponse.json({ ok: false, error: 'Peticion no valida.' }, { status: 400 })
  }

  const token = body.token?.trim() ?? ''
  if (!UUID_PATTERN.test(token) || !body.respuesta || !VALID_RESPONSES.includes(body.respuesta)) {
    return NextResponse.json({ ok: false, error: 'Respuesta de invitacion no valida.' }, { status: 400 })
  }

  try {
    const data = await loadPublicInvitation(token)
    if (!data) return NextResponse.json({ ok: false, error: 'Invitacion no encontrada.' }, { status: 404 })
    if (data.meeting.estado !== 'programada') {
      return NextResponse.json({ ok: false, error: 'Esta reunion ya no admite confirmaciones.' }, { status: 409 })
    }

    const { data: updated, error: updateError } = await data.admin
      .from('reunion_invitados')
      .update({ estado_respuesta: body.respuesta, respondido_at: new Date().toISOString() })
      .eq('id', data.invitation.id)
      .eq('token_confirmacion', token)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updated) return NextResponse.json({ ok: false, error: 'No se pudo actualizar la invitacion.' }, { status: 409 })

    data.invitation.estado_respuesta = body.respuesta
    data.invitation.respondido_at = new Date().toISOString()
    return NextResponse.json({ ok: true, ...publicPayload(data) })
  } catch (error) {
    console.error('Public meeting confirmation failed:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la confirmacion.' }, { status: 500 })
  }
}
