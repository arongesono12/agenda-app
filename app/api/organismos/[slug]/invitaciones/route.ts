import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { resolverRolActivo, obtenerSuscripcion } from '@/lib/organismo-access'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES } from '@/lib/access-control'
import { verificarLimiteUsuarios } from '@/lib/plan-limits'
import { sendAgendaEmail, escapeHtml } from '@/lib/email/resend'
import type { RolCodigo } from '@/lib/types'

export const dynamic = 'force-dynamic'

function invitacionEmailHtml(organismoNombre: string, invitadoPorNombre: string, token: string, baseUrl: string) {
  const link = `${baseUrl}/api/organismos/aceptar-invitacion?token=${token}`
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 12px">Invitación a ${escapeHtml(organismoNombre)}</h2>
      <p>${escapeHtml(invitadoPorNombre)} te ha invitado a unirte a <strong>${escapeHtml(organismoNombre)}</strong>.</p>
      <div style="margin:24px 0">
        <a href="${link}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Aceptar invitación
        </a>
      </div>
      <p style="color:#64748b;font-size:13px">El enlace expira en 48 horas.</p>
    </div>
  `
}

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
    if (!rol || !MANAGER_ROLE_CODES.includes(rol as (typeof MANAGER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Sin permiso.' }, { status: 403 })
    }

    const { data: invitaciones } = await admin
      .from('organismo_invitaciones')
      .select('id, email, rol_codigo, usado, expira_at, created_at')
      .eq('organismo_id', organismo.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ ok: true, invitaciones: invitaciones ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const { slug } = await params
    const body = (await request.json()) as { email?: string; rolCodigo?: RolCodigo }
    const email = body.email?.trim().toLowerCase()
    const rolCodigo = body.rolCodigo ?? 'responsable'

    if (!email) return NextResponse.json({ ok: false, error: 'El email es obligatorio.' }, { status: 400 })

    const admin = createAdminSupabaseClient()
    const { data: organismo } = await admin
      .from('organismos')
      .select('id, nombre')
      .eq('slug', slug)
      .maybeSingle()

    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol || !MANAGER_ROLE_CODES.includes(rol as (typeof MANAGER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Sin permiso para invitar.' }, { status: 403 })
    }

    // Verificar límite de usuarios del plan
    const suscripcion = await obtenerSuscripcion(admin, organismo.id)
    const limiteOk = await verificarLimiteUsuarios(admin, organismo.id, suscripcion)
    if (!limiteOk.permitido) {
      return NextResponse.json({ ok: false, error: limiteOk.motivo }, { status: 403 })
    }

    // Verificar que el usuario no sea ya miembro
    const { data: miembroExistente } = await admin
      .from('organismo_miembros')
      .select('id')
      .eq('organismo_id', organismo.id)
      .in('usuario_id',
        (await admin.from('perfiles_usuario').select('id').ilike('email', email)).data?.map((p) => p.id) ?? []
      )
      .maybeSingle()

    if (miembroExistente) {
      return NextResponse.json({ ok: false, error: 'Este usuario ya es miembro del organismo.' }, { status: 409 })
    }

    // Crear invitación
    const { data: invitacion, error: invError } = await admin
      .from('organismo_invitaciones')
      .insert({
        organismo_id: organismo.id,
        email,
        rol_codigo: rolCodigo,
        invitado_por: user.id,
      })
      .select('token')
      .single()

    if (invError) throw invError

    // Enviar email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`
    const invitadoPorNombre = profile?.nombre_completo?.trim() || profile?.email || 'Un administrador'

    await sendAgendaEmail({
      to: email,
      subject: `Invitación a ${organismo.nombre}`,
      html: invitacionEmailHtml(organismo.nombre, invitadoPorNombre, invitacion.token, baseUrl),
      text: `${invitadoPorNombre} te invita a unirte a ${organismo.nombre}. Acepta en: ${baseUrl}/api/organismos/aceptar-invitacion?token=${invitacion.token}`,
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo enviar la invitación.' },
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
    const id = Number(url.searchParams.get('id'))

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'ID inválido.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data: organismo } = await admin.from('organismos').select('id').eq('slug', slug).maybeSingle()
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const rol = await resolverRolActivo(admin, user.id, organismo.id)
    if (!rol || !ADMIN_ROLE_CODES.includes(rol as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden revocar invitaciones.' }, { status: 403 })
    }

    await admin.from('organismo_invitaciones').delete().eq('id', id).eq('organismo_id', organismo.id)

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error.' },
      { status: 500 }
    )
  }
}
