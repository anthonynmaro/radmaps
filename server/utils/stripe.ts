import Stripe from 'stripe'

export const STRIPE_API_VERSION = '2026-04-22.dahlia'

export function getStripeClient(config = useRuntimeConfig()) {
  const key = config.stripeSecretKey
  if (!key) {
    throw createError({ statusCode: 500, message: 'Stripe is not configured' })
  }
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    maxNetworkRetries: 2,
  })
}

export function stripeMetadata(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value).slice(0, 500)
  }
  return out
}
