import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getPlan } from '@/lib/billing/plans'
import type { PlanCodigo } from '@/lib/types'

interface CheckoutParams {
  organismoId: string
  organismoSlug: string
  planCodigo: PlanCodigo
  intervalo: 'mensual' | 'anual'
  stripeCustomerId?: string | null
  baseUrl: string
}

export async function crearCheckoutSession(params: CheckoutParams): Promise<string> {
  const stripe = getStripe()
  const plan = getPlan(params.planCodigo)

  const priceId =
    params.intervalo === 'anual' ? plan.stripePriceIdAnual : plan.stripePriceIdMensual

  if (!priceId) {
    throw new Error(`No hay precio de Stripe configurado para el plan ${params.planCodigo} (${params.intervalo}).`)
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${params.baseUrl}/organismos/${params.organismoSlug}/dashboard?checkout=success`,
    cancel_url: `${params.baseUrl}/planes`,
    metadata: { organismoId: params.organismoId, organismoSlug: params.organismoSlug },
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,
      metadata: { organismoId: params.organismoId },
    },
  }

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  if (!session.url) throw new Error('No se pudo crear la sesión de pago.')
  return session.url
}
