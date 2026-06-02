import { createHash } from 'node:crypto'
import { z } from 'zod'
import type Stripe from 'stripe'
import { serverSupabaseUser } from '#supabase/server'
import { getProduct } from '~/utils/products'
import { normalizeCouponEmail } from '~/utils/coupons'
import type { PrintProduct } from '~/types'

export type CheckoutCartSource = 'custom' | 'premade'

export const CheckoutShippingAddress = z.object({
  name: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional().default(''),
  city: z.string().min(1),
  state_code: z.string().min(1).max(64),
  country_code: z.string().length(2),
  zip: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
})

export type CheckoutShippingAddress = z.infer<typeof CheckoutShippingAddress>

export function normalizeShippingAddress(input: CheckoutShippingAddress): CheckoutShippingAddress {
  return {
    name: input.name.trim(),
    address1: input.address1.trim(),
    address2: (input.address2 || '').trim(),
    city: input.city.trim(),
    state_code: input.state_code.trim().toUpperCase(),
    country_code: input.country_code.trim().toUpperCase(),
    zip: input.zip.trim(),
    email: normalizeCouponEmail(input.email) || input.email.trim().toLowerCase(),
    phone: (input.phone || '').trim(),
  }
}

export function shippingAddressHash(address: CheckoutShippingAddress): string {
  const normalized = normalizeShippingAddress(address)
  return createHash('sha256')
    .update(JSON.stringify({
      name: normalized.name.toLowerCase(),
      address1: normalized.address1.toLowerCase(),
      address2: normalized.address2.toLowerCase(),
      city: normalized.city.toLowerCase(),
      state_code: normalized.state_code.toLowerCase(),
      country_code: normalized.country_code.toLowerCase(),
      zip: normalized.zip.toLowerCase(),
      email: normalized.email.toLowerCase(),
      phone: normalized.phone.replace(/\D/g, ''),
    }))
    .digest('hex')
}

export function stripeCustomerAddress(address: CheckoutShippingAddress): Stripe.AddressParam {
  return {
    line1: address.address1,
    line2: address.address2 || undefined,
    city: address.city,
    state: address.state_code,
    country: address.country_code,
    postal_code: address.zip,
  }
}

export function checkoutIdentityMetadata(input: {
  userId?: string | null
  guestEmail?: string | null
}): Record<string, string> {
  if (input.userId) return { user_id: input.userId }
  const guestEmail = normalizeCouponEmail(input.guestEmail || '')
  return guestEmail ? { guest_email: guestEmail } : {}
}

export function gelatoShippingAddress(address: CheckoutShippingAddress) {
  const parts = address.name.split(/\s+/).filter(Boolean)
  const firstName = parts[0] || address.name
  const lastName = parts.slice(1).join(' ') || firstName
  return {
    firstName,
    lastName,
    addressLine1: address.address1,
    addressLine2: address.address2 || '',
    city: address.city,
    state: address.state_code,
    postCode: address.zip,
    country: address.country_code,
    email: address.email,
    phone: address.phone || '',
  }
}

function moneyToCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) && value > 1000 ? value : Math.round(value * 100)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return moneyToCents(parsed)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const centValue = obj.centAmount ?? obj.amount_cents ?? obj.amountCents ?? obj.cents
    if (typeof centValue === 'number' && Number.isFinite(centValue)) return Math.round(centValue)
    if (typeof centValue === 'string' && centValue.trim() && Number.isFinite(Number(centValue))) return Math.round(Number(centValue))
    return moneyToCents(obj.amount ?? obj.value ?? obj.price)
  }
  return null
}

function findQuoteArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.quotes)) {
    return obj.quotes.flatMap((quote) => {
      if (!quote || typeof quote !== 'object') return []
      const quoteObj = quote as Record<string, unknown>
      if (!Array.isArray(quoteObj.shipmentMethods)) return [quote]
      return quoteObj.shipmentMethods.map((shipmentMethod) => ({
        ...(shipmentMethod && typeof shipmentMethod === 'object' ? shipmentMethod as Record<string, unknown> : {}),
        quoteId: quoteObj.id,
        itemReferenceIds: quoteObj.itemReferenceIds,
        fulfillmentCountry: quoteObj.fulfillmentCountry,
        products: quoteObj.products,
        rawQuote: quoteObj,
      }))
    })
  }
  for (const key of ['quotes', 'shippingOptions', 'shipmentMethods', 'methods', 'shippingMethods']) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[]
  }
  if (Array.isArray(obj.data)) return obj.data
  return []
}

export interface GelatoQuoteOption {
  shipment_method_uid: string
  shipment_method_name: string
  amount_cents: number
  currency: string
  min_delivery_date?: string
  max_delivery_date?: string
  raw_quote: Record<string, unknown>
}

export function parseGelatoShippingQuotePayload(payload: unknown, currency: string): GelatoQuoteOption[] {
  return findQuoteArray(payload)
    .map((item): GelatoQuoteOption | null => {
      if (!item || typeof item !== 'object') return null
      const quote = item as Record<string, unknown>
      const uid = String(
        quote.shipmentMethodUid
        ?? quote.shipment_method_uid
        ?? quote.promiseUid
        ?? quote.uid
        ?? quote.id
        ?? quote.name
        ?? '',
      )
      const amount = moneyToCents(
        quote.price
        ?? quote.amount
        ?? quote.total
        ?? quote.totalAmount
        ?? quote.shippingPrice
        ?? quote.shippingPriceInclVat,
      )
      if (!uid || amount == null || amount < 0) return null
      return {
        shipment_method_uid: uid,
        shipment_method_name: String(quote.name ?? quote.displayName ?? quote.shipmentMethodName ?? uid),
        amount_cents: amount,
        currency: String(quote.currency ?? currency).toLowerCase(),
        min_delivery_date: typeof quote.minDeliveryDate === 'string' ? quote.minDeliveryDate : undefined,
        max_delivery_date: typeof quote.maxDeliveryDate === 'string' ? quote.maxDeliveryDate : undefined,
        raw_quote: {
          ...(quote.rawQuote && typeof quote.rawQuote === 'object' ? quote.rawQuote as Record<string, unknown> : {}),
          shipmentMethod: quote,
        },
      }
    })
    .filter((item): item is GelatoQuoteOption => !!item)
    .sort((a, b) => a.amount_cents - b.amount_cents)
}

export async function fetchGelatoShippingQuotes(input: {
  gelatoApiKey: string
  orderType?: 'order' | 'draft'
  productUid: string
  quantity: number
  currency?: string
  shippingAddress: CheckoutShippingAddress
}): Promise<GelatoQuoteOption[]> {
  const currency = (input.currency || 'usd').toUpperCase()
  if (!input.gelatoApiKey) {
    if (process.env.NODE_ENV !== 'production') {
      return [{
        shipment_method_uid: 'standard',
        shipment_method_name: 'Standard shipping',
        amount_cents: 795,
        currency: currency.toLowerCase(),
        raw_quote: { fallback: true },
      }]
    }
    throw createError({ statusCode: 500, message: 'Gelato is not configured' })
  }

  const body = {
    orderReferenceId: `radmaps-quote-${Date.now()}`,
    customerReferenceId: input.shippingAddress.email,
    currency,
    allowMultipleQuotes: false,
    recipient: gelatoShippingAddress(input.shippingAddress),
    products: [{
      itemReferenceId: 'item-1',
      productUid: input.productUid,
      quantity: input.quantity,
    }],
  }

  const payload = await $fetch<unknown>('https://order.gelatoapis.com/v4/orders:quote', {
    method: 'POST',
    headers: {
      'X-API-KEY': input.gelatoApiKey,
      'Content-Type': 'application/json',
    },
    body,
  })

  const options = parseGelatoShippingQuotePayload(payload, currency)

  if (options.length === 0) {
    throw createError({ statusCode: 422, message: 'No shipping options are available for this address.' })
  }

  return options
}

export function productOrThrow(productUid: string, digitalOnly = false): PrintProduct {
  const product = getProduct(digitalOnly ? 'digital' : productUid)
  if (!product) throw createError({ statusCode: 400, message: 'Invalid product UID' })
  return product
}

export interface CheckoutAttemptCartLock {
  cart_source?: string | null
  user_id?: string | null
  guest_email?: string | null
  map_id?: string | null
  premade_slug?: string | null
  product_uid?: string | null
  quantity?: number | string | null
  address_hash?: string | null
  quote_id?: string | null
  status?: string | null
}

export interface ExpectedCheckoutAttemptCart {
  cartSource: CheckoutCartSource
  userId?: string | null
  guestEmail?: string | null
  mapId?: string | null
  premadeSlug?: string | null
  productUid: string
  quantity: number
  addressHash: string
  quoteId?: string | null
}

const REUSABLE_ATTEMPT_STATUSES = new Set(['started', 'quoted', 'session_created'])

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function checkoutAttemptMismatchReasons(
  attempt: CheckoutAttemptCartLock | null | undefined,
  expected: ExpectedCheckoutAttemptCart,
): string[] {
  if (!attempt) return ['missing_attempt']

  const reasons: string[] = []
  if (!REUSABLE_ATTEMPT_STATUSES.has(String(attempt.status || ''))) reasons.push('status')
  if (attempt.cart_source !== expected.cartSource) reasons.push('cart_source')
  if (attempt.product_uid !== expected.productUid) reasons.push('product_uid')
  if (Number(attempt.quantity) !== expected.quantity) reasons.push('quantity')
  if (attempt.address_hash !== expected.addressHash) reasons.push('address_hash')
  if (nullableString(attempt.map_id) !== nullableString(expected.mapId)) reasons.push('map_id')
  if (nullableString(attempt.premade_slug) !== nullableString(expected.premadeSlug)) reasons.push('premade_slug')
  if (nullableString(attempt.user_id) !== nullableString(expected.userId)) reasons.push('user_id')
  if (nullableString(attempt.guest_email) !== nullableString(expected.guestEmail)) reasons.push('guest_email')
  if (nullableString(attempt.quote_id) !== nullableString(expected.quoteId)) reasons.push('quote_id')

  return reasons
}

export function canonicalPrintSize(product: PrintProduct, digitalOnly = false): string {
  return digitalOnly || product.type === 'digital' ? 'digital' : product.size_label
}

export function shouldExpireCreatedCheckoutSessionOnSetupFailure(input: {
  initialAttemptStatus?: string | null
  initialQuoteStatus?: string | null
}): boolean {
  return input.initialAttemptStatus !== 'session_created' && input.initialQuoteStatus !== 'used'
}

export async function currentOptionalUser(event: Parameters<typeof serverSupabaseUser>[0]) {
  return await serverSupabaseUser(event).catch(() => null)
}

export async function recordOrderEvent(supabase: any, input: {
  orderId: string
  eventType: string
  actorType?: 'system' | 'staff' | 'stripe' | 'gelato' | 'customer'
  actorId?: string | null
  message?: string
  metadata?: Record<string, unknown>
}) {
  const { error } = await supabase.from('order_events').insert({
    order_id: input.orderId,
    event_type: input.eventType,
    actor_type: input.actorType || 'system',
    actor_id: input.actorId || null,
    message: input.message || null,
    metadata: input.metadata || {},
  })
  if (error) {
    console.error('[order_events] insert failed:', error.message)
  }
}
