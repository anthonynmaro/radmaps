import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchGelatoShippingQuotes,
  normalizeShippingAddress,
  parseGelatoShippingQuotePayload,
  shippingAddressHash,
  stripeCustomerAddress,
} from '~/server/utils/checkoutHardened'

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
})
