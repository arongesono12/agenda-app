import { NextResponse } from 'next/server'
import { getServerSessionProfile } from '@/lib/server-access'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { crearPortalSession } from '@/lib/billing/portal'
import { esOrganismoSegesa, resolverRolActivo } from '@/lib/organismo-access'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as { organismoId?: string }
    const { organismoId } = body

    if (!organismoId) return NextResponse.json({ ok: false, error: 'organismoId requerido.' }, { status: 400 })

    if (esOrganismoSegesa(organismoId)) {
      return NextResponse.json({ ok: false, error: 'El organo Segesa esta exento de pagos y no tiene portal de facturacion.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    const rol = await resolverRolActivo(admin, user.id, organismoId)
    if (!rol || !ADMIN_ROLE_CODES.includes(rol as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden acceder a facturación.' }, { status: 403 })
    }

    const { data: suscripcion } = await admin
      .from('organismo_suscripciones')
      .select('stripe_customer_id, organismo:organismos(slug)')
      .eq('organismo_id', organismoId)
      .maybeSingle()

    if (!suscripcion?.stripe_customer_id) {
      return NextResponse.json({ ok: false, error: 'No hay suscripción de pago activa.' }, { status: 404 })
    }

    const slug = Array.isArray(suscripcion.organismo)
      ? suscripcion.organismo[0]?.slug
      : (suscripcion.organismo as { slug?: string } | null)?.slug

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`
    const returnUrl = `${baseUrl}/organismos/${slug}/facturacion`

    const portalUrl = await crearPortalSession(suscripcion.stripe_customer_id, returnUrl)

    return NextResponse.json({ ok: true, url: portalUrl })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo abrir el portal.' },
      { status: 500 }
    )
  }
}
