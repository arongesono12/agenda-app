import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { agregarMiembro } from '@/lib/organismo-access'
import type { RolCodigo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=token_invalido', url))
  }

  const admin = createAdminSupabaseClient()
  const { data: invitacion } = await admin
    .from('organismo_invitaciones')
    .select('id, organismo_id, email, rol_codigo, usado, expira_at, organismo:organismos(slug)')
    .eq('token', token)
    .maybeSingle()

  if (!invitacion || invitacion.usado) {
    return NextResponse.redirect(new URL('/login?error=invitacion_usada', url))
  }

  if (invitacion.expira_at && new Date(invitacion.expira_at) < new Date()) {
    return NextResponse.redirect(new URL('/login?error=invitacion_expirada', url))
  }

  // Redirigir a registro/login con el token para que el usuario lo acepte tras autenticarse
  const { user } = await getServerSessionProfile()

  if (!user) {
    return NextResponse.redirect(new URL(`/registro?invitacion=${token}`, url))
  }

  // Usuario ya autenticado: aceptar directamente
  const slug = Array.isArray(invitacion.organismo)
    ? invitacion.organismo[0]?.slug
    : (invitacion.organismo as { slug?: string } | null)?.slug

  await agregarMiembro(admin, invitacion.organismo_id, user.id, invitacion.rol_codigo as RolCodigo, invitacion.organismo_id)

  await admin
    .from('organismo_invitaciones')
    .update({ usado: true })
    .eq('id', invitacion.id)

  return NextResponse.redirect(new URL(`/organismos/${slug}/dashboard`, url))
}

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as { token?: string }
    const token = body.token?.trim()
    if (!token) return NextResponse.json({ ok: false, error: 'Token requerido.' }, { status: 400 })

    const admin = createAdminSupabaseClient()
    const { data: invitacion } = await admin
      .from('organismo_invitaciones')
      .select('id, organismo_id, email, rol_codigo, usado, expira_at, organismo:organismos(slug)')
      .eq('token', token)
      .maybeSingle()

    if (!invitacion || invitacion.usado) {
      return NextResponse.json({ ok: false, error: 'Invitación no válida o ya usada.' }, { status: 400 })
    }

    if (invitacion.expira_at && new Date(invitacion.expira_at) < new Date()) {
      return NextResponse.json({ ok: false, error: 'La invitación ha expirado.' }, { status: 400 })
    }

    await agregarMiembro(admin, invitacion.organismo_id, user.id, invitacion.rol_codigo as RolCodigo)

    await admin
      .from('organismo_invitaciones')
      .update({ usado: true })
      .eq('id', invitacion.id)

    const slug = Array.isArray(invitacion.organismo)
      ? invitacion.organismo[0]?.slug
      : (invitacion.organismo as { slug?: string } | null)?.slug

    return NextResponse.json({ ok: true, slug })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 }
    )
  }
}
