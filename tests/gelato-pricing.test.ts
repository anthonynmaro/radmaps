import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DIGITAL_PRICE_CENTS,
  GELATO_PRICING_MARKUP_BPS,
  GELATO_PRICING_MULTIPLIER_BPS,
  GELATO_PRICING_ROUNDING_RULE,
  computeGelatoRetailPriceCents,
  isPricingSnapshotFresh,
  moneyToCents,
  parseGelatoProductPricePayload,
  pricingDbColumns,
  pricingFromMetadata,
  pricingFromRecord,
  pricingMetadata,
  publicPricingPayload,
  resolveProductPricing,
  syncGelatoProductPrices,
} from '~/server/utils/gelatoPricing'
import { PRODUCTS } from '~/utils/products'

function fakeSupabase(result: { data: unknown; error: null | { message: string } }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  }
  return {
    from: () => chain,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Gelato pricing helpers', () => {
  it('converts money payload variants to cents', () => {
    expect(moneyToCents('12.34')).toBe(1234)
    expect(moneyToCents({ centAmount: 1299 })).toBe(1299)
    expect(moneyToCents({ amount: 8.25 })).toBe(825)
  })

  it('parses Gelato product price payloads by country and quantity', () => {
    const parsed = parseGelatoProductPricePayload({
      currency: 'USD',
      prices: [
        { country: 'CA', quantity: 1, price: '18.00' },
        { country: 'US', quantity: 2, price: '20.00' },
        { country: 'US', quantity: 1, price: '12.50' },
      ],
    }, 'US', 'usd')

    expect(parsed?.gelato_cost_cents).toBe(1250)
  })

  it('parses Gelato product price payloads when the API returns a root array', () => {
    const parsed = parseGelatoProductPricePayload([
      {
        country: 'US',
        currency: 'USD',
        productUid: 'metallic_16x24-inch-400x600-mm_3-mm_4-0_ver',
        quantity: 1,
        price: 28.10000038146973,
      },
    ], 'US', 'usd')

    expect(parsed?.gelato_cost_cents).toBe(2810)
  })

  it('applies a 50% markup and rounds to the nearest dollar', () => {
    expect(GELATO_PRICING_MARKUP_BPS).toBe(5000)
    expect(GELATO_PRICING_MULTIPLIER_BPS).toBe(15000)
    expect(computeGelatoRetailPriceCents(1250)).toBe(1900)
    expect(computeGelatoRetailPriceCents(1000)).toBe(1500)
  })

  it('keeps digital pricing fixed at $9.99 outside Gelato cost pricing', async () => {
    const pricing = await resolveProductPricing(fakeSupabase({
      data: null,
      error: { message: 'should not be called for digital' },
    }), {
      productUid: 'digital',
      countryCode: 'CA',
    })

    expect(DIGITAL_PRICE_CENTS).toBe(999)
    expect(pricing).toMatchObject({
      product_uid: 'digital',
      country_code: 'US',
      gelato_product_cost_cents: null,
      retail_unit_price_cents: 999,
      source: 'static',
    })
  })

  it('recognizes stale and fresh snapshots', () => {
    const now = Date.parse('2026-05-28T12:00:00Z')
    expect(isPricingSnapshotFresh('2026-05-27T12:00:00Z', now)).toBe(true)
    expect(isPricingSnapshotFresh('2026-05-01T12:00:00Z', now)).toBe(false)
  })

  it('falls back to static catalog pricing outside production when snapshots are missing', async () => {
    const product = PRODUCTS.find((item) => item.type === 'poster')!
    const pricing = await resolveProductPricing(fakeSupabase({
      data: null,
      error: { message: 'relation "gelato_product_prices" does not exist' },
    }), {
      productUid: product.product_uid,
      countryCode: 'US',
    })

    expect(pricing).toMatchObject({
      product_uid: product.product_uid,
      retail_unit_price_cents: product.price_cents,
      source: 'static',
    })
  })

  it('fails closed in production when a snapshot is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('createError', (input: { statusCode: number; message: string }) =>
      Object.assign(new Error(input.message), input),
    )
    const product = PRODUCTS.find((item) => item.type === 'poster')!

    await expect(resolveProductPricing(fakeSupabase({
      data: null,
      error: null,
    }), {
      productUid: product.product_uid,
      countryCode: 'US',
    })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('fails closed in production when a snapshot is stale', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('createError', (input: { statusCode: number; message: string }) =>
      Object.assign(new Error(input.message), input),
    )
    const product = PRODUCTS.find((item) => item.type === 'poster')!

    await expect(resolveProductPricing(fakeSupabase({
      data: {
        id: 'price-1',
        product_uid: product.product_uid,
        country_code: 'US',
        currency: 'usd',
        quantity: 1,
        gelato_cost_cents: 1000,
        retail_price_cents: 1500,
        markup_bps: GELATO_PRICING_MARKUP_BPS,
        rounding_rule: GELATO_PRICING_ROUNDING_RULE,
        synced_at: '2026-05-01T12:00:00Z',
      },
      error: null,
    }), {
      productUid: product.product_uid,
      countryCode: 'US',
    })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('serializes pricing locks for checkout attempts and Stripe metadata', () => {
    const pricing = {
      product_uid: 'poster',
      country_code: 'US',
      currency: 'usd',
      pricing_snapshot_id: 'price-1',
      gelato_product_cost_cents: 1000,
      retail_unit_price_cents: 1500,
      pricing_markup_bps: GELATO_PRICING_MARKUP_BPS,
      pricing_rounding_rule: GELATO_PRICING_ROUNDING_RULE,
      pricing_synced_at: '2026-05-28T12:00:00Z',
      source: 'snapshot' as const,
    }

    expect(pricingDbColumns(pricing)).toMatchObject({
      pricing_snapshot_id: 'price-1',
      retail_unit_price_cents: 1500,
    })
    expect(pricingMetadata(pricing)).toMatchObject({
      pricing_snapshot_id: 'price-1',
      retail_unit_price_cents: '1500',
    })
  })

  it('exposes only public retail pricing fields', () => {
    const payload = publicPricingPayload({
      product_uid: 'poster',
      country_code: 'US',
      currency: 'usd',
      pricing_snapshot_id: 'price-1',
      gelato_product_cost_cents: 1000,
      retail_unit_price_cents: 1500,
      pricing_markup_bps: GELATO_PRICING_MARKUP_BPS,
      pricing_rounding_rule: GELATO_PRICING_ROUNDING_RULE,
      pricing_synced_at: '2026-05-28T12:00:00Z',
      source: 'snapshot',
    })

    expect(payload).toEqual({
      product_uid: 'poster',
      country_code: 'US',
      currency: 'usd',
      retail_price_cents: 1500,
      pricing_updated_at: '2026-05-28T12:00:00Z',
      estimated: false,
    })
    expect(payload).not.toHaveProperty('pricing_snapshot_id')
    expect(payload).not.toHaveProperty('gelato_product_cost_cents')
    expect(payload).not.toHaveProperty('pricing_markup_bps')
    expect(payload).not.toHaveProperty('raw_payload')
  })

  it('does not coerce missing Gelato cost locks to zero', () => {
    expect(pricingFromRecord({
      pricing_country_code: 'US',
      gelato_product_cost_cents: null,
      retail_unit_price_cents: 1500,
      pricing_markup_bps: GELATO_PRICING_MARKUP_BPS,
      pricing_rounding_rule: GELATO_PRICING_ROUNDING_RULE,
      pricing_synced_at: null,
    }, 'poster')).toMatchObject({
      gelato_product_cost_cents: null,
      retail_unit_price_cents: 1500,
      source: 'static',
    })

    expect(pricingFromMetadata({
      pricing_country_code: 'US',
      gelato_product_cost_cents: '',
      retail_unit_price_cents: '1500',
      pricing_markup_bps: String(GELATO_PRICING_MARKUP_BPS),
      pricing_rounding_rule: GELATO_PRICING_ROUNDING_RULE,
    }, 'poster')).toMatchObject({
      gelato_product_cost_cents: null,
      retail_unit_price_cents: 1500,
    })
  })

  it('syncs aluminum products through the non-digital Gelato pricing path', async () => {
    const product = PRODUCTS.find((item) => item.type === 'aluminum' && item.material_key === 'aluminum_white_matte')!
    const upserts: Array<Record<string, unknown>> = []
    vi.stubGlobal('$fetch', vi.fn(async () => ([
      {
        country: 'US',
        currency: 'USD',
        productUid: product.product_uid,
        quantity: 1,
        price: 28.1,
      },
    ])))

    const chain = {
      upsert: (payload: Record<string, unknown>) => {
        upserts.push(payload)
        return chain
      },
      select: () => chain,
      single: async () => ({
        data: {
          id: 'price-aluminum',
          ...upserts[0],
        },
        error: null,
      }),
    }

    const result = await syncGelatoProductPrices({
      from: () => chain,
    }, {
      gelatoApiKey: 'gelato-key',
      countries: ['US'],
      productUids: [product.product_uid],
    })

    expect(result).toMatchObject({
      product_count: 1,
      country_count: 1,
      synced_count: 1,
      error_count: 0,
    })
    expect(upserts[0]).toMatchObject({
      product_uid: product.product_uid,
      country_code: 'US',
      gelato_cost_cents: 2810,
      retail_price_cents: 4200,
    })
  })
})
