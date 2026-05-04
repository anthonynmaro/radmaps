// tests/processJob.test.ts
//
// Unit tests for the print queue's per-job state machine. We don't run a
// real Postgres — instead we wrap a fake `PoolClient` whose `query()`
// method routes by SQL substring to scripted responses. That's enough to
// drive the lifecycle deterministically.
//
// HTTP calls (/render-final and Gelato) are dependency-injected via
// `processJob({ deps })` so neither is reached over the wire.

import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'

import {
  processJob,
  type PrintRenderJobRow,
  type RenderFinalResponse,
} from '../src/queue/processJob.js'

// ─── Fake PoolClient ────────────────────────────────────────────────────────

interface FakeRowState {
  job: PrintRenderJobRow
  snapshot:
    | {
        stripe_session_id: string
        product_uid: string
        order_id: string | null
      }
    | null
  order:
    | {
        id: string
        user_id: string | null
        guest_email: string | null
        quantity: number
        shipping_address: Record<string, string> | null
        gelato_order_id: string | null
        fulfillment_status: string | null
        status: string | null
        active_stripe_session_id: string
        print_file_url?: string
        print_render_id?: string | null
      }
    | null
  /** product_renders rows keyed by (session, print_hash). */
  productRenders: Array<{
    id: string
    stripe_session_id: string
    product_uid: string
    print_hash: string
    artifact_path: string
    validation_result: { passed: boolean }
  }>
}

interface QueryLogEntry {
  text: string
  values?: unknown[]
}

function createFakeClient(state: FakeRowState): {
  client: PoolClient
  log: QueryLogEntry[]
} {
  const log: QueryLogEntry[] = []

  const fake = {
    async query(text: string, values?: unknown[]): Promise<QueryResult<QueryResultRow>> {
      log.push({ text, values })
      const sql = text.replace(/\s+/g, ' ').trim()

      // Snapshot lookup
      if (/FROM order_snapshots/i.test(sql) && /SELECT/i.test(sql)) {
        const rows = state.snapshot ? [state.snapshot] : []
        return mockResult(rows)
      }
      // Order lookup by active_stripe_session_id
      if (/FROM orders/i.test(sql) && /active_stripe_session_id/i.test(sql) && /SELECT/i.test(sql)) {
        const rows = state.order ? [state.order] : []
        return mockResult(rows)
      }
      // product_renders existing-row lookup OR id lookup after render
      if (/FROM product_renders/i.test(sql) && /SELECT/i.test(sql)) {
        const sessionId = (values?.[0] as string | undefined) ?? ''
        const printHash = (values?.[1] as string | undefined) ?? ''
        const productUid = (values?.[2] as string | undefined) ?? null
        const found = state.productRenders.find(
          (r) =>
            r.stripe_session_id === sessionId &&
            r.print_hash === printHash &&
            (productUid === null || r.product_uid === productUid),
        )
        return mockResult(found ? [found] : [])
      }
      // UPDATE print_render_jobs
      if (/UPDATE print_render_jobs/i.test(sql)) {
        if (/status = 'validating'/i.test(sql)) {
          state.job = { ...state.job, status: 'validating' }
        } else if (/status = 'ready'/i.test(sql)) {
          state.job = { ...state.job, status: 'ready' }
        } else if (/status = 'submitted'/i.test(sql)) {
          state.job = { ...state.job, status: 'submitted' }
        } else if (/status = 'queued'/i.test(sql)) {
          state.job = {
            ...state.job,
            status: 'queued',
            last_error: (values?.[0] as string) ?? state.job.last_error,
          }
        } else if (/status = 'failed'/i.test(sql)) {
          state.job = {
            ...state.job,
            status: 'failed',
            last_error: (values?.[0] as string) ?? state.job.last_error,
          }
        }
        return mockResult([])
      }
      // UPDATE orders
      if (/UPDATE orders/i.test(sql)) {
        if (!state.order) return mockResult([])
        if (/fulfillment_status = 'manual_review'/i.test(sql)) {
          state.order = { ...state.order, fulfillment_status: 'manual_review' }
        } else if (/fulfillment_status = 'print_ready'/i.test(sql)) {
          state.order = {
            ...state.order,
            fulfillment_status: 'print_ready',
            print_file_url: values?.[0] as string,
            print_render_id: (values?.[1] as string | null) ?? null,
          }
        } else if (/fulfillment_status = 'submitted_to_gelato'/i.test(sql)) {
          state.order = {
            ...state.order,
            fulfillment_status: 'submitted_to_gelato',
            status: 'in_production',
            gelato_order_id: values?.[0] as string,
          }
        }
        return mockResult([])
      }
      throw new Error(`unexpected SQL in test: ${sql.slice(0, 120)}`)
    },
    release() {
      /* noop */
    },
  }
  return { client: fake as unknown as PoolClient, log }
}

function mockResult<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function baseJob(overrides: Partial<PrintRenderJobRow> = {}): PrintRenderJobRow {
  return {
    id: 'job-1',
    stripe_session_id: 'cs_test_1',
    print_hash: 'PH1',
    status: 'rendering',
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    worker_id: 'host/123',
    claimed_at: '2026-04-29T00:00:00Z',
    completed_at: null,
    created_at: '2026-04-29T00:00:00Z',
    updated_at: '2026-04-29T00:00:00Z',
    ...overrides,
  }
}

function baseState(overrides: Partial<FakeRowState> = {}): FakeRowState {
  return {
    job: baseJob(),
    snapshot: {
      stripe_session_id: 'cs_test_1',
      product_uid: 'poster_18x24',
      order_id: 'order-1',
    },
    order: {
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
      gelato_order_id: null,
      fulfillment_status: 'rendering_print',
      status: 'paid',
      active_stripe_session_id: 'cs_test_1',
    },
    productRenders: [],
    ...overrides,
  }
}

const SUCCESS_RESPONSE: RenderFinalResponse = {
  status: 'rendered',
  artifact_path: 'final/cs_test_1/poster_18x24/PH1.jpg',
  render_url: 'https://example.com/final.jpg',
  validation_result: {
    passed: true,
    errors: [],
    warnings: [],
  },
  render_ms: 1234,
}

beforeEach(() => {
  // Make sure fetch isn't accidentally reachable through default impl.
  vi.restoreAllMocks()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('processJob: happy path', () => {
  it('renders, persists, and submits to Gelato', async () => {
    const state = baseState({
      // After /render-final the worker would have inserted a product_renders
      // row; the lookup-by-id step needs to find it.
      productRenders: [
        {
          id: 'pr-1',
          stripe_session_id: 'cs_test_1',
          product_uid: 'poster_18x24',
          print_hash: 'PH1',
          artifact_path: 'final/cs_test_1/poster_18x24/PH1.jpg',
          validation_result: { passed: true },
        },
      ],
    })
    // Don't expose this row to the *initial* idempotency check — the test
    // wants to walk the render+submit path. We strip it for the first
    // product_renders SELECT and re-inject for the post-render lookup.
    let rendersCallCount = 0
    const stripState = baseState() // empty productRenders, used initially
    stripState.productRenders = []
    const stateWithToggling = stripState as FakeRowState

    const { client, log } = createFakeClient(stateWithToggling)

    // Wrap query to swap in the post-render product_renders row on the
    // second product_renders SELECT (the id lookup).
    const origQuery = client.query.bind(client)
    ;(client as unknown as { query: typeof client.query }).query = (async (
      text: string,
      values?: unknown[],
    ) => {
      const sql = text.replace(/\s+/g, ' ').trim()
      if (/FROM product_renders/i.test(sql) && /SELECT/i.test(sql)) {
        rendersCallCount += 1
        if (rendersCallCount >= 2) {
          stateWithToggling.productRenders = state.productRenders
        }
      }
      return origQuery(text, values)
    }) as PoolClient['query']

    const renderFinal = vi.fn().mockResolvedValue(SUCCESS_RESPONSE)
    const gelatoPlace = vi.fn().mockResolvedValue({ gelato_order_id: 'gelato-xyz' })

    const result = await processJob({
      client,
      job: stateWithToggling.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('submitted')
    expect(result.orderId).toBe('order-1')
    expect(renderFinal).toHaveBeenCalledWith({
      stripeSessionId: 'cs_test_1',
      printHash: 'PH1',
    })
    expect(gelatoPlace).toHaveBeenCalledTimes(1)
    expect(gelatoPlace.mock.calls[0][0]).toMatchObject({
      productUid: 'poster_18x24',
      printFileUrl: 'https://example.com/final.jpg',
    })
    expect(stateWithToggling.job.status).toBe('submitted')
    expect(stateWithToggling.order?.status).toBe('in_production')
    expect(stateWithToggling.order?.fulfillment_status).toBe('submitted_to_gelato')
    expect(stateWithToggling.order?.gelato_order_id).toBe('gelato-xyz')
    // Sanity: at least one orders update happened.
    expect(log.some((q) => /UPDATE orders/i.test(q.text))).toBe(true)
  })
})

describe('processJob: render failure with retries available', () => {
  it('requeues the job and stores last_error', async () => {
    const state = baseState({ job: baseJob({ attempts: 1, max_attempts: 3 }) })
    const { client } = createFakeClient(state)

    const renderFinal = vi.fn().mockRejectedValue(new Error('chromium crashed'))
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('retried')
    expect(state.job.status).toBe('queued')
    expect(state.job.last_error).toContain('chromium crashed')
    expect(gelatoPlace).not.toHaveBeenCalled()
    // Order must NOT have been flipped to manual_review.
    expect(state.order?.fulfillment_status).toBe('rendering_print')
  })
})

describe('processJob: render failure exhausting retries', () => {
  it('fails the job and flips the order to manual_review', async () => {
    const state = baseState({ job: baseJob({ attempts: 3, max_attempts: 3 }) })
    const { client } = createFakeClient(state)

    const renderFinal = vi.fn().mockRejectedValue(new Error('persistent OOM'))
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('manual_review')
    expect(state.job.status).toBe('failed')
    expect(state.job.last_error).toContain('persistent OOM')
    expect(state.order?.fulfillment_status).toBe('manual_review')
    expect(gelatoPlace).not.toHaveBeenCalled()
  })
})

describe('processJob: validation failure (errors > 0)', () => {
  it('treats invalid render as a failed render and retries when attempts remain', async () => {
    const state = baseState({ job: baseJob({ attempts: 1, max_attempts: 3 }) })
    const { client } = createFakeClient(state)

    const invalid: RenderFinalResponse = {
      status: 'invalid',
      validation_result: {
        passed: false,
        errors: [{ check: 'tile_completeness', severity: 'error', message: 'blank tiles' }],
        warnings: [],
      },
      render_ms: 555,
    }
    const renderFinal = vi.fn().mockResolvedValue(invalid)
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('retried')
    expect(state.job.status).toBe('queued')
    expect(state.job.last_error).toContain('tile_completeness')
    expect(gelatoPlace).not.toHaveBeenCalled()
  })

  it('escalates to manual_review when validation fails on the last attempt', async () => {
    const state = baseState({ job: baseJob({ attempts: 3, max_attempts: 3 }) })
    const { client } = createFakeClient(state)

    const invalid: RenderFinalResponse = {
      status: 'invalid',
      validation_result: {
        passed: false,
        errors: [{ check: 'dimensions', severity: 'error', message: 'wrong size' }],
        warnings: [],
      },
      render_ms: 100,
    }
    const renderFinal = vi.fn().mockResolvedValue(invalid)
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('manual_review')
    expect(state.order?.fulfillment_status).toBe('manual_review')
  })
})

describe('processJob: Gelato submission failure', () => {
  it('routes a permanent Gelato failure to manual_review', async () => {
    const state = baseState({ job: baseJob({ attempts: 3, max_attempts: 3 }) })
    state.productRenders = [
      {
        id: 'pr-1',
        stripe_session_id: 'cs_test_1',
        product_uid: 'poster_18x24',
        print_hash: 'PH1',
        artifact_path: 'final/cs_test_1/poster_18x24/PH1.jpg',
        validation_result: { passed: true },
      },
    ]
    // First product_renders SELECT (idempotency check) must miss because
    // order.gelato_order_id is null.
    const { client } = createFakeClient(state)

    const renderFinal = vi.fn().mockResolvedValue(SUCCESS_RESPONSE)
    const gelatoPlace = vi.fn().mockRejectedValue(new Error('Gelato 500'))

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('manual_review')
    expect(state.job.status).toBe('failed')
    expect(state.order?.fulfillment_status).toBe('manual_review')
    // Render did happen — just submission failed. We expect print_file_url
    // to have been persisted before the Gelato call.
    expect(state.order?.print_file_url).toBe('https://example.com/final.jpg')
  })

  it('retries Gelato failure when attempts remain', async () => {
    const state = baseState({ job: baseJob({ attempts: 1, max_attempts: 3 }) })
    state.productRenders = [
      {
        id: 'pr-1',
        stripe_session_id: 'cs_test_1',
        product_uid: 'poster_18x24',
        print_hash: 'PH1',
        artifact_path: 'final/cs_test_1/poster_18x24/PH1.jpg',
        validation_result: { passed: true },
      },
    ]
    const { client } = createFakeClient(state)

    const renderFinal = vi.fn().mockResolvedValue(SUCCESS_RESPONSE)
    const gelatoPlace = vi.fn().mockRejectedValue(new Error('Gelato 502'))

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('retried')
    expect(state.job.status).toBe('queued')
    expect(state.order?.fulfillment_status).not.toBe('manual_review')
  })
})

describe('processJob: idempotency', () => {
  it('is a no-op when print is already submitted', async () => {
    const state = baseState({
      productRenders: [
        {
          id: 'pr-1',
          stripe_session_id: 'cs_test_1',
          product_uid: 'poster_18x24',
          print_hash: 'PH1',
          artifact_path: 'final/cs_test_1/poster_18x24/PH1.jpg',
          validation_result: { passed: true },
        },
      ],
    })
    state.order!.gelato_order_id = 'gelato-already-submitted'

    const { client } = createFakeClient(state)
    const renderFinal = vi.fn()
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('noop')
    expect(state.job.status).toBe('submitted')
    expect(renderFinal).not.toHaveBeenCalled()
    expect(gelatoPlace).not.toHaveBeenCalled()
  })
})

describe('processJob: missing snapshot', () => {
  it('fails the job (manual_review on last attempt)', async () => {
    const state = baseState({
      job: baseJob({ attempts: 3, max_attempts: 3 }),
      snapshot: null,
    })
    const { client } = createFakeClient(state)
    const renderFinal = vi.fn()
    const gelatoPlace = vi.fn()

    const result = await processJob({
      client,
      job: state.job,
      workerId: 'test/1',
      deps: { renderFinal, gelatoPlace },
    })

    expect(result.status).toBe('manual_review')
    expect(state.job.status).toBe('failed')
    expect(result.error).toContain('order_snapshots row missing')
  })
})
