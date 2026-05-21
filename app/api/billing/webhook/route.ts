import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { handleWebhookEvent } from '@/lib/billing/webhooks'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// No usar autenticación de sesión — la seguridad es la firma criptográfica de Stripe
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 })
  }

  try {
    await handleWebhookEvent(event)
  } catch (error: unknown) {
    console.error('[webhook] Error procesando evento', event.type, error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
