import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getOrganismoIdFromRequest, getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

function toPositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export async function GET(request: Request) {
  try {
    const { user } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = toPositiveInt(url.searchParams.get('limit'), 8, 50)
    const onlyUnread = url.searchParams.get('unread') === 'true'
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    let query = admin
      .from('alertas')
      .select('id, tarea_id, tipo_alerta, titulo, mensaje, leida, created_at')
      .eq('destinatario_usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (organismoId) {
      query = query.eq('organismo_id', organismoId)
    }

    if (onlyUnread) {
      query = query.eq('leida', false)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ ok: true, alertas: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudieron consultar las alertas.' },
      { status: 500 }
    )
  }
}
