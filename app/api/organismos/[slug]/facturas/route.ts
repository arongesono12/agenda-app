import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { resolverRolActivo } from '@/lib/organismo-access'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const { slug } = await params
    const admin = createAdminSupabaseClient()

    const { data: organismo } = await admin
      .from('organismos')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol) return NextResponse.json({ ok: false, error: 'Sin acceso.' }, { status: 403 })

    const { data: facturas } = await admin
      .from('organismo_facturas')
      .select('id, importe_centimos, moneda, estado, pdf_url, fecha_emision, fecha_vencimiento, created_at')
      .eq('organismo_id', organismo.id)
      .order('fecha_emision', { ascending: false })

    return NextResponse.json({ ok: true, facturas: facturas ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 }
    )
  }
}
