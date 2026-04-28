import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'

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

    if (payload.all === true) {
      const { error } = await admin
        .from('alertas')
        .update({ leida: true })
        .eq('destinatario_usuario_id', user.id)
        .eq('leida', false)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (payload.id) {
      const { error } = await admin
        .from('alertas')
        .update({ leida: true })
        .eq('id', payload.id)
        .eq('destinatario_usuario_id', user.id)

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
