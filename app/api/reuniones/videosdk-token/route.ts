import { NextResponse } from 'next/server'
import { MANAGER_ROLE_CODES } from '@/lib/access-control'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'
import { buildAgendaVideoSessionName, createZoomVideoSdkJwt, getVideoSdkPasscode } from '@/lib/zoom-video-sdk'

export const dynamic = 'force-dynamic'

type VideoSdkTokenBody = {
  reunionId?: string
}

type ReunionRow = {
  id: string
  organismo_id: string
  titulo: string
  modalidad: string
  estado: string
  creada_por_usuario_id?: string | null
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    if (!organismoId) {
      return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    }

    const body = (await request.json()) as VideoSdkTokenBody
    const reunionId = body.reunionId?.trim()
    if (!reunionId) {
      return NextResponse.json({ ok: false, error: 'Falta el identificador de la reunion.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: reunion, error: reunionError } = await admin
      .from('reuniones')
      .select('id, organismo_id, titulo, modalidad, estado, creada_por_usuario_id')
      .eq('id', reunionId)
      .eq('organismo_id', organismoId)
      .maybeSingle()

    if (reunionError) throw reunionError
    if (!reunion) return NextResponse.json({ ok: false, error: 'La reunion no existe.' }, { status: 404 })

    const meeting = reunion as ReunionRow
    if (meeting.estado === 'cancelada') {
      return NextResponse.json({ ok: false, error: 'La reunion esta cancelada.' }, { status: 409 })
    }
    if (meeting.modalidad === 'presencial') {
      return NextResponse.json({ ok: false, error: 'El Video SDK solo aplica a reuniones virtuales o hibridas.' }, { status: 400 })
    }

    const isManager = MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])
    let isInvited = false
    if (!isManager) {
      const { data: invitation, error: invitationError } = await admin
        .from('reunion_invitados')
        .select('id')
        .eq('reunion_id', meeting.id)
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (invitationError) throw invitationError
      isInvited = !!invitation?.id
    }

    if (!isManager && !isInvited) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para entrar en esta reunion.' }, { status: 403 })
    }

    const sessionName = buildAgendaVideoSessionName(organismoId, meeting.id)
    const userName = profile?.nombre_completo?.trim() || profile?.email || user.email || 'Usuario'
    const roleType: 0 | 1 = isManager || meeting.creada_por_usuario_id === user.id ? 1 : 0
    const videoSDKJWT = createZoomVideoSdkJwt({
      sessionName,
      roleType,
      userIdentity: user.id,
    })

    return NextResponse.json({
      ok: true,
      config: {
        videoSDKJWT,
        sessionName,
        sessionPasscode: getVideoSdkPasscode(),
        userName,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo preparar la sala de video.' },
      { status: 500 }
    )
  }
}
