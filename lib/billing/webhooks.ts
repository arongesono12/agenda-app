import type Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

async function activarSuscripcion(
  admin: AdminClient,
  organismoId: string,
  planCodigo: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  periodStart: number,
  periodEnd: number
) {
  const { error } = await admin
    .from('organismo_suscripciones')
    .upsert(
      {
        organismo_id: organismoId,
        plan_codigo: planCodigo,
        estado: 'activa',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        periodo_inicio: new Date(periodStart * 1000).toISOString(),
        periodo_fin: new Date(periodEnd * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organismo_id' }
    )

  if (error) throw error
}

async function registrarFactura(
  admin: AdminClient,
  organismoId: string,
  invoice: Stripe.Invoice
) {
  const { error } = await admin.from('organismo_facturas').upsert(
    {
      organismo_id: organismoId,
      stripe_invoice_id: invoice.id,
      importe_centimos: invoice.amount_paid,
      moneda: invoice.currency,
      estado: invoice.status === 'paid' ? 'pagada' : 'pendiente',
      pdf_url: invoice.invoice_pdf,
      fecha_emision: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
      fecha_vencimiento: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    },
    { onConflict: 'stripe_invoice_id' }
  )

  if (error) throw error
}

async function pausarSuscripcion(admin: AdminClient, stripeSubscriptionId: string) {
  const { error } = await admin
    .from('organismo_suscripciones')
    .update({ estado: 'pausada', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) throw error
}

async function cancelarSuscripcion(admin: AdminClient, stripeSubscriptionId: string) {
  const { error } = await admin
    .from('organismo_suscripciones')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) throw error
}

async function actualizarPlan(
  admin: AdminClient,
  stripeSubscriptionId: string,
  nuevoPlan: string
) {
  const { error } = await admin
    .from('organismo_suscripciones')
    .update({ plan_codigo: nuevoPlan, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) throw error
}

function getOrganismoIdFromMetadata(metadata?: Stripe.Metadata | null): string | null {
  return metadata?.organismoId ?? null
}

function getSubscriptionDetails(invoice: Stripe.Invoice) {
  return invoice.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details
    : null
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = getSubscriptionDetails(invoice)?.subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : subscription.id
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const admin = createAdminSupabaseClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const organismoId = getOrganismoIdFromMetadata(session.metadata)
      if (!organismoId || session.mode !== 'subscription') break

      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id

      if (!subscriptionId) break

      const stripe = (await import('@/lib/stripe')).getStripe()
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const subscriptionItem = subscription.items.data[0]
      const priceId = subscriptionItem?.price?.id ?? ''

      // Detectar plan desde el price ID
      const planCodigo = detectarPlanDesdePriceId(priceId)

      if (!subscriptionItem) break

      await activarSuscripcion(
        admin,
        organismoId,
        planCodigo,
        session.customer as string,
        subscriptionId,
        subscriptionItem.current_period_start,
        subscriptionItem.current_period_end
      )
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const organismoId = getOrganismoIdFromMetadata(
        getSubscriptionDetails(invoice)?.metadata ?? invoice.metadata
      )
      if (!organismoId) break
      await registrarFactura(admin, organismoId, invoice)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getInvoiceSubscriptionId(invoice)
      if (subscriptionId) await pausarSuscripcion(admin, subscriptionId)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await cancelarSuscripcion(admin, subscription.id)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const priceId = subscription.items.data[0]?.price?.id ?? ''
      const planCodigo = detectarPlanDesdePriceId(priceId)
      await actualizarPlan(admin, subscription.id, planCodigo)
      break
    }

    default:
      break
  }
}

function detectarPlanDesdePriceId(priceId: string): string {
  const env = process.env

  if (priceId === env.STRIPE_PRICE_EMPRESA_MENSUAL || priceId === env.STRIPE_PRICE_EMPRESA_ANUAL) return 'empresa'
  if (priceId === env.STRIPE_PRICE_PRO_MENSUAL || priceId === env.STRIPE_PRICE_PRO_ANUAL) return 'pro'
  if (priceId === env.STRIPE_PRICE_BASICO_MENSUAL || priceId === env.STRIPE_PRICE_BASICO_ANUAL) return 'basico'
  return 'basico'
}
