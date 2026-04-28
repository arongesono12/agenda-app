import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user } = await getServerSessionProfile()

    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const admin = createAdminSupabaseClient()
    const { count, error } = await admin
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_usuario_id', user.id)
      .eq('leida', false)

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
