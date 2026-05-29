import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalPrintSize,
  checkoutAttemptMismatchReasons,
  fetchGelatoShippingQuotes,
  normalizeShippingAddress,
  parseGelatoShippingQuotePayload,
  shippingAddressHash,
  stripeCustomerAddress,
} from '~/server/utils/checkoutHardened'
import { paidCheckoutIntegrityIssues } from '~/server/utils/checkoutIntegrity'

vi.mock('#supabase/server', () => ({
  serverSupabaseUser: vi.fn(),
}))

const address = {
  name: ' Trail Tester ',
  address1: ' 1 Summit Way ',
  address2: ' Apt 2 ',
  city: ' Boulder ',
  state_code: ' co ',
  country_code: ' us ',
  zip: ' 80301 ',
  email: ' Rider@Example.COM ',
  phone: ' (303) 555-0100 ',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hardened checkout helpers', () => {
  it('normalizes shipping addresses before hashing and Stripe customer updates', () => {
    const normalized = normalizeShippingAddress(address)

    expect(normalized).toMatchObject({
      name: 'Trail Tester',
      address1: '1 Summit Way',
      state_code: 'CO',
      country_code: 'US',
      email: 'rider@example.com',
    })
    expect(stripeCustomerAddress(normalized)).toMatchObject({
      line1: '1 Summit Way',
      line2: 'Apt 2',
      city: 'Boulder',
      state: 'CO',
      country: 'US',
      postal_code: '80301',
    })
  })

  it('produces stable address hashes across casing and whitespace changes', () => {
    const hashA = shippingAddressHash(address)
    const hashB = shippingAddressHash({
      ...address,
      name: 'trail tester',
      address1: '1 summit way',
      state_code: 'CO',
      country_code: 'US',
      email: 'rider@example.com',
      phone: '3035550100',
    })

    expect(hashA).toBe(hashB)
    expect(hashA).toHaveLength(64)
  })

  it('falls back to a local standard quote outside production when Gelato is not configured', async () => {
    const quotes = await fetchGelatoShippingQuotes({
      gelatoApiKey: '',
      productUid: 'poster_16x24',
      quantity: 1,
      shippingAddress: normalizeShippingAddress(address),
    })

    expect(quotes).toEqual([
      expect.objectContaining({
        shipment_method_uid: 'standard',
        amount_cents: 795,
        currency: 'usd',
      }),
    ])
  })

  it('parses Gelato quote response variants and chooses cheapest first', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({
      shippingOptions: [
        { shipmentMethodUid: 'express', name: 'Express', price: { amount: 19.5 }, currency: 'USD' },
        { shipmentMethodUid: 'standard', name: 'Standard', shippingPrice: 8.25, currency: 'USD' },
      ],
    })))

    const quotes = await fetchGelatoShippingQuotes({
      gelatoApiKey: 'gelato-key',
      productUid: 'poster_16x24',
      quantity: 2,
      shippingAddress: normalizeShippingAddress(address),
    })

    expect(quotes.map(quote => quote.shipment_method_uid)).toEqual(['standard', 'express'])
    expect(quotes.map(quote => quote.amount_cents)).toEqual([825, 1950])
  })

  it('preserves explicit cent values from quote payloads', () => {
    const quotes = parseGelatoShippingQuotePayload({
      shippingOptions: [
        { shipmentMethodUid: 'standard', price: { centAmount: 795 }, currency: 'USD' },
      ],
    }, 'USD')

    expect(quotes[0]?.amount_cents).toBe(795)
  })

  it('detects checkout attempt tampering before Stripe session creation', () => {
    const expected = {
      cartSource: 'premade' as const,
      userId: null,
      guestEmail: 'rider@example.com',
      mapId: null,
      premadeSlug: 'chicago-bike-network',
      productUid: 'flat_300x450-mm-12x18-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
      quantity: 1,
      addressHash: 'hash-a',
      quoteId: 'quote-a',
    }

    expect(checkoutAttemptMismatchReasons({
      cart_source: 'premade',
      user_id: null,
      guest_email: 'rider@example.com',
      map_id: null,
      premade_slug: 'chicago-bike-network',
      product_uid: expected.productUid,
      quantity: 1,
      address_hash: 'hash-a',
      quote_id: 'quote-a',
      status: 'quoted',
    }, expected)).toEqual([])

    expect(checkoutAttemptMismatchReasons({
      cart_source: 'premade',
      user_id: null,
      guest_email: 'rider@example.com',
      map_id: null,
      premade_slug: 'chicago-bike-network',
      product_uid: 'canvas_12x18-inch-300x450-mm_canvas_wood-fsc-slim_4-0_ver',
      quantity: 2,
      address_hash: 'hash-b',
      quote_id: 'quote-a',
      status: 'completed',
    }, expected)).toEqual(expect.arrayContaining(['status', 'product_uid', 'quantity', 'address_hash']))
  })

  it('checks every checkout attempt lock field before Stripe session creation', () => {
    const expected = {
      cartSource: 'custom' as const,
      userId: 'user-a',
      guestEmail: null,
      mapId: 'map-a',
      premadeSlug: null,
      productUid: 'poster-a',
      quantity: 1,
      addressHash: 'hash-a',
      quoteId: 'quote-a',
    }
    const validAttempt = {
      cart_source: 'custom',
      user_id: 'user-a',
      guest_email: null,
      map_id: 'map-a',
      premade_slug: null,
      product_uid: 'poster-a',
      quantity: 1,
      address_hash: 'hash-a',
      quote_id: 'quote-a',
      status: 'quoted',
    }

    expect(checkoutAttemptMismatchReasons(validAttempt, expected)).toEqual([])

    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['cart_source', { cart_source: 'premade' }, 'cart_source'],
      ['user_id', { user_id: 'user-b' }, 'user_id'],
      ['guest_email', { guest_email: 'guest@example.com' }, 'guest_email'],
      ['map_id', { map_id: 'map-b' }, 'map_id'],
      ['premade_slug', { premade_slug: 'chicago-bike-network' }, 'premade_slug'],
      ['product_uid', { product_uid: 'poster-b' }, 'product_uid'],
      ['quantity', { quantity: 2 }, 'quantity'],
      ['address_hash', { address_hash: 'hash-b' }, 'address_hash'],
      ['quote_id', { quote_id: 'quote-b' }, 'quote_id'],
      ['status', { status: 'completed' }, 'status'],
    ]

    for (const [label, mutation, reason] of cases) {
      expect(
        checkoutAttemptMismatchReasons({ ...validAttempt, ...mutation }, expected),
        label,
      ).toContain(reason)
    }
  })

  it('flags paid checkout integrity mismatches that must hold fulfillment for manual review', () => {
    const valid = {
      isDigital: false,
      hasCatalogProduct: true,
      hasLockedPricing: true,
      requirePricingSnapshot: true,
      hasPricingSnapshot: true,
      expectedSubtotalCents: 4200,
      paidSubtotalCents: 4200,
      paidShippingCents: 795,
      quoteId: 'quote-a',
      checkoutAttemptId: 'attempt-a',
      quote: {
        checkout_attempt_id: 'attempt-a',
        product_uid: 'poster-a',
        quantity: 1,
        address_hash: 'hash-a',
        cart_source: 'premade',
        amount_cents: 795,
      },
      productUid: 'poster-a',
      quantity: 1,
      addressHash: 'hash-a',
      cartSource: 'premade',
    }

    expect(paidCheckoutIntegrityIssues(valid)).toEqual([])
    expect(paidCheckoutIntegrityIssues({
      ...valid,
      paidSubtotalCents: 4100,
      paidShippingCents: 0,
      hasPricingSnapshot: false,
      quote: { ...valid.quote, product_uid: 'poster-b' },
    })).toEqual(expect.arrayContaining([
      'missing_pricing_snapshot',
      'subtotal_mismatch',
      'quote_mismatch',
    ]))
  })

  it('uses catalog-derived print size instead of client text', () => {
    expect(canonicalPrintSize({
      product_uid: 'digital',
      name: 'Digital Download',
      type: 'digital',
      size_label: 'Digital',
      width_in: 0,
      height_in: 0,
      aspect_ratio: 2 / 3,
      price_cents: 999,
      recommended_px_w: 7200,
      recommended_px_h: 10800,
    }, true)).toBe('digital')
  })
})

describe('checkout architecture guardrails', () => {
  it('does not reintroduce legacy direct Stripe checkout routes or callers', () => {
    const root = process.cwd()
    expect(existsSync(join(root, 'server/api/orders/checkout.post.ts'))).toBe(false)
    expect(existsSync(join(root, 'server/api/shop/checkout.post.ts'))).toBe(false)

    const sourceFiles = collectSourceFiles([
      join(root, 'components'),
      join(root, 'composables'),
      join(root, 'pages'),
      join(root, 'server'),
      join(root, 'utils'),
    ])
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('/api/orders/checkout')
      expect(source, file).not.toContain('/api/shop/checkout')
    }
  })
})

function collectSourceFiles(paths: string[]): string[] {
  const files: string[] = []
  for (const path of paths) {
    if (!existsSync(path)) continue
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(readdirSync(path).map(name => join(path, name))))
    } else if (/\.(ts|vue)$/.test(path)) {
      files.push(path)
    }
  }
  return files
}
