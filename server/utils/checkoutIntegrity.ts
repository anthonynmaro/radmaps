export interface CheckoutQuoteLock {
  id?: string | null
  checkout_attempt_id?: string | null
  product_uid?: string | null
  quantity?: number | string | null
  address_hash?: string | null
  cart_source?: string | null
  amount_cents?: number | string | null
}

export interface PaidCheckoutIntegrityInput {
  isDigital: boolean
  hasCatalogProduct: boolean
  hasLockedPricing: boolean
  requirePricingSnapshot: boolean
  hasPricingSnapshot: boolean
  expectedSubtotalCents?: number | null
  paidSubtotalCents?: number | null
  paidShippingCents?: number | null
  quoteId?: string | null
  checkoutAttemptId?: string | null
  quote?: CheckoutQuoteLock | null
  productUid: string
  quantity: number
  addressHash: string
  cartSource: string
}

export function paidCheckoutIntegrityIssues(input: PaidCheckoutIntegrityInput): string[] {
  const issues: string[] = []

  if (!input.hasCatalogProduct) issues.push('invalid_product_uid')
  if (!input.hasLockedPricing) issues.push('missing_locked_pricing')
  if (input.requirePricingSnapshot && !input.hasPricingSnapshot && !input.isDigital) {
    issues.push('missing_pricing_snapshot')
  }
  if (
    input.expectedSubtotalCents != null &&
    input.paidSubtotalCents != null &&
    input.paidSubtotalCents !== input.expectedSubtotalCents
  ) {
    issues.push('subtotal_mismatch')
  }

  if (!input.isDigital && !physicalQuoteMatchesPaidCart(input)) {
    issues.push('quote_mismatch')
  }

  return issues
}

function physicalQuoteMatchesPaidCart(input: PaidCheckoutIntegrityInput): boolean {
  const quote = input.quote
  if (!input.quoteId || !quote) return false

  const quoteAmountCents = Number(quote.amount_cents)
  const shippingMatches = input.paidShippingCents == null ||
    input.paidShippingCents === quoteAmountCents

  return (
    quote.checkout_attempt_id === input.checkoutAttemptId &&
    quote.product_uid === input.productUid &&
    Number(quote.quantity) === input.quantity &&
    quote.address_hash === input.addressHash &&
    quote.cart_source === input.cartSource &&
    shippingMatches
  )
}
