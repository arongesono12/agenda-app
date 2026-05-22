import { NextResponse } from 'next/server'
import { getServerSessionProfile } from '@/lib/server-access'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { crearCheckoutSession } from '@/lib/billing/checkout'
import { esOrganismoSegesa, resolverRolActivo } from '@/lib/organismo-access'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import type { PlanCodigo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as {
      organismoId?: string
      planCodigo?: PlanCodigo
      intervalo?: 'mensual' | 'anual'
    }

    const { organismoId, planCodigo, intervalo = 'mensual' } = body

    if (!organismoId || !planCodigo) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros.' }, { status: 400 })
    }

    if (esOrganismoSegesa(organismoId)) {
      return NextResponse.json({ ok: false, error: 'El organo Segesa esta exento de pagos y no requiere checkout.' }, { status: 400 })
    }

    if (planCodigo === 'individual') {
      return NextResponse.json({ ok: false, error: 'El plan individual no requiere pago.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    // Verificar que el usuario sea admin del organismo
    const rol = await resolverRolActivo(admin, user.id, organismoId)
    if (!rol || !ADMIN_ROLE_CODES.includes(rol as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden gestionar la suscripción.' }, { status: 403 })
    }

    // Obtener datos del organismo
    const { data: organismo } = await admin
      .from('organismos')
      .select('id, slug, nombre')
      .eq('id', organismoId)
      .maybeSingle()

    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    // Obtener stripe_customer_id existente si hay
    const { data: suscripcion } = await admin
      .from('organismo_suscripciones')
      .select('stripe_customer_id')
      .eq('organismo_id', organismoId)
      .maybeSingle()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get('host')}`

    const checkoutUrl = await crearCheckoutSession({
      organismoId,
      organismoSlug: organismo.slug,
      planCodigo,
      intervalo,
      stripeCustomerId: suscripcion?.stripe_customer_id,
      baseUrl,
    })

    return NextResponse.json({ ok: true, url: checkoutUrl })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo iniciar el pago.' },
      { status: 500 }
    )
  }
}
