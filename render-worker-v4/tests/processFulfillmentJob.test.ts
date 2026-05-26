import { describe, expect, it, vi } from 'vitest'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'
import { processFulfillmentJob, type FulfillmentJobRow } from '../src/queue/processFulfillmentJob.js'

function mockResult<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { command: 'SELECT', rowCount: rows.length, oid: 0, fields: [], rows }
}

function baseJob(overrides: Partial<FulfillmentJobRow> = {}): FulfillmentJobRow {
  return {
    id: 'fulfillment-job-1',
    order_id: 'order-1',
    job_type: 'gelato_submit',
    status: 'submitting',
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    worker_id: 'test/1',
    claimed_at: '2026-05-22T00:00:00Z',
    completed_at: null,
    metadata: {},
    created_at: '2026-05-22T00:00:00Z',
    updated_at: '2026-05-22T00:00:00Z',
    ...overrides,
  }
}

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    user_id: 'user-1',
    guest_email: null,
    quantity: 1,
    shipping_address: {
      name: 'Trail Tester',
      email: 'tester@example.com',
      address1: '1 Summit Way',
      city: 'Boulder',
      state_code: 'CO',
      zip: '80301',
      country_code: 'US',
    },
    product_uid: 'poster_16x24',
    print_file_url: 'https://example.com/final.jpg',
    gelato_order_id: null,
    shipment_method_uid: 'express-quote-123',
    status: 'paid',
    fulfillment_status: 'print_ready',
    payment_status: 'paid',
    dispute_status: 'none',
    refund_status: 'none',
    risk_level: null,
    ...overrides,
  }
}

function fakeClient(order: Record<string, unknown>) {
  const queries: string[] = []
  const client = {
    async query(text: string): Promise<QueryResult<QueryResultRow>> {
      queries.push(text.replace(/\s+/g, ' ').trim())
      if (/FROM orders/i.test(text)) return mockResult([order])
      return mockResult([])
    },
  } as unknown as PoolClient
  return { client, queries }
}

describe('processFulfillmentJob', () => {
  it('passes the locked shipment method to Gelato', async () => {
    const { client } = fakeClient(baseOrder())
    const gelatoPlace = vi.fn(async () => ({ gelato_order_id: 'gelato-1' }))

    const result = await processFulfillmentJob({
      client,
      job: baseJob(),
      workerId: 'test/1',
      gelatoPlace,
    })

    expect(result.status).toBe('submitted')
    expect(gelatoPlace).toHaveBeenCalledWith(expect.objectContaining({
      order: expect.objectContaining({ shipment_method_uid: 'express-quote-123' }),
    }))
  })

  it('holds orders with an active dispute instead of submitting to Gelato', async () => {
    const { client } = fakeClient(baseOrder({ dispute_status: 'needs_response' }))
    const gelatoPlace = vi.fn(async () => ({ gelato_order_id: 'gelato-1' }))

    const result = await processFulfillmentJob({
      client,
      job: baseJob({ attempts: 3, max_attempts: 3 }),
      workerId: 'test/1',
      gelatoPlace,
    })

    expect(result.status).toBe('manual_review')
    expect(result.error).toContain('active dispute')
    expect(gelatoPlace).not.toHaveBeenCalled()
  })
})
