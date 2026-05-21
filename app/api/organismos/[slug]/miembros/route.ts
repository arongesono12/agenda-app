import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { resolverRolActivo } from '@/lib/organismo-access'
import type { RolCodigo } from '@/lib/types'

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
      .select('id, nombre')
      .eq('slug', slug)
      .maybeSingle()

    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol) return NextResponse.json({ ok: false, error: 'Sin acceso a este organismo.' }, { status: 403 })

    const { data: miembros, error } = await admin
      .from('organismo_miembros')
      .select('id, organismo_id, usuario_id, rol_codigo, activo, invitado_por, created_at, perfil:perfiles_usuario(nombre_completo, email, avatar_url)')
      .eq('organismo_id', organismo.id)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    if (error) throw error

    const miembrosNormalized = (miembros ?? []).map((m) => ({
      ...m,
      perfil: Array.isArray(m.perfil) ? (m.perfil[0] ?? null) : m.perfil,
    }))

    return NextResponse.json({ ok: true, miembros: miembrosNormalized })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al obtener miembros.' },
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
    const body = (await request.json()) as { usuarioId?: string; rolCodigo?: RolCodigo }

    if (!body.usuarioId || !body.rolCodigo) {
      return NextResponse.json({ ok: false, error: 'usuarioId y rolCodigo son obligatorios.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: organismo } = await admin.from('organismos').select('id').eq('slug', slug).maybeSingle()
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol || !['administrador', 'administradora'].includes(rol)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden cambiar roles.' }, { status: 403 })
    }

    // No puede modificar su propio rol
    if (body.usuarioId === user.id) {
      return NextResponse.json({ ok: false, error: 'No puedes modificar tu propio rol.' }, { status: 400 })
    }

    const { error } = await admin
      .from('organismo_miembros')
      .update({ rol_codigo: body.rolCodigo })
      .eq('organismo_id', organismo.id)
      .eq('usuario_id', body.usuarioId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al actualizar rol.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const { slug } = await params
    const url = new URL(request.url)
    const usuarioId = url.searchParams.get('usuarioId')

    if (!usuarioId) return NextResponse.json({ ok: false, error: 'usuarioId es obligatorio.' }, { status: 400 })

    const admin = createAdminSupabaseClient()
    const { data: organismo } = await admin.from('organismos').select('id').eq('slug', slug).maybeSingle()
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol || !['administrador', 'administradora'].includes(rol)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden eliminar miembros.' }, { status: 403 })
    }

    // No puede eliminarse a sí mismo
    if (usuarioId === user.id) {
      return NextResponse.json({ ok: false, error: 'No puedes eliminarte del organismo.' }, { status: 400 })
    }

    const { error } = await admin
      .from('organismo_miembros')
      .update({ activo: false })
      .eq('organismo_id', organismo.id)
      .eq('usuario_id', usuarioId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al eliminar miembro.' },
      { status: 500 }
    )
  }
}
