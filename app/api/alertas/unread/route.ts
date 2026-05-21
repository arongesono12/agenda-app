import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getOrganismoIdFromRequest, getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ count: 0 }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    let query = admin
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_usuario_id', user.id)
      .eq('leida', false)
    if (organismoId) query = query.eq('organismo_id', organismoId)
    const { count, error } = await query

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ count: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
