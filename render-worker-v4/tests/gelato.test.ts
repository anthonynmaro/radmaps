import { describe, expect, it } from 'vitest'

import { placeGelatoOrder } from '../src/queue/gelato.js'

const baseInput = {
  order: {
    id: 'order-1',
    quantity: 2,
    user_id: 'user-1',
    guest_email: null,
  },
  shippingAddress: {
    name: 'Trail Tester',
    email: 'tester@example.com',
    address1: '1 Summit Way',
    city: 'Boulder',
    state_code: 'CO',
    zip: '80301',
    country_code: 'US',
  },
  printFileUrl: 'https://example.com/final.jpg',
  productUid: 'poster_16x24',
  gelatoApiKey: 'gelato-key',
} as const

describe('placeGelatoOrder', () => {
  it('sends draft orderType for faux E2E orders', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify({ id: 'gelato-draft-1' }), { status: 200 })
    }) as typeof fetch

    const result = await placeGelatoOrder(
      {
        ...baseInput,
        orderType: 'draft',
      },
      fakeFetch,
    )

    expect(result.gelato_order_id).toBe('gelato-draft-1')
    expect(bodies[0]?.orderType).toBe('draft')
  })

  it('defaults to production orderType when not overridden', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify({ id: 'gelato-order-1' }), { status: 200 })
    }) as typeof fetch

    await placeGelatoOrder(baseInput, fakeFetch)

    expect(bodies[0]?.orderType).toBe('order')
  })
})
