import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getOrganismoIdFromRequest, getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

type Payload = {
  id?: number
  all?: boolean
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })
    }

    const payload = (await request.json()) as Payload
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)

    if (payload.all === true) {
      let query = admin
        .from('alertas')
        .update({ leida: true })
        .eq('destinatario_usuario_id', user.id)
        .eq('leida', false)
      if (organismoId) query = query.eq('organismo_id', organismoId)
      const { error } = await query

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (payload.id) {
      let query = admin
        .from('alertas')
        .update({ leida: true })
        .eq('id', payload.id)
        .eq('destinatario_usuario_id', user.id)
      if (organismoId) query = query.eq('organismo_id', organismoId)
      const { error } = await query

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { ok: false, error: 'Debes indicar un id o all:true.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al marcar alerta.' },
      { status: 500 }
    )
  }
}
