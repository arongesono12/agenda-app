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
      .select('id, nombre, slug, tipo, sector, website, pais')
      .eq('slug', slug)
      .maybeSingle()

    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol) return NextResponse.json({ ok: false, error: 'Sin acceso.' }, { status: 403 })

    return NextResponse.json({ ok: true, organismo })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const { slug } = await params
    const body = (await request.json()) as { nombre?: string; sector?: string | null; website?: string | null }

    const nombre = body.nombre?.trim()
    if (!nombre || nombre.length < 2) {
      return NextResponse.json({ ok: false, error: 'El nombre es obligatorio.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: organismo } = await admin.from('organismos').select('id').eq('slug', slug).maybeSingle()
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol || !['administrador', 'administradora'].includes(rol)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden modificar los ajustes.' }, { status: 403 })
    }

    const { error } = await admin
      .from('organismos')
      .update({
        nombre,
        sector: body.sector ?? null,
        website: body.website ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organismo.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al guardar ajustes.' },
      { status: 500 }
    )
  }
}
