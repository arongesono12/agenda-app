import Stripe from 'stripe'

// Singleton server-only Stripe client
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY no está configurado.')
    stripeInstance = new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
  }
  return stripeInstance
}
