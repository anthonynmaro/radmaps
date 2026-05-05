// render-worker-v4/src/queue/processJob.ts
//
// Pure-ish async function that drives a single print_render_jobs row through
// its lifecycle. The polling loop in consumer.ts is responsible for
// claiming the row (FOR UPDATE SKIP LOCKED) and bumping attempts/status to
// 'rendering'; this function takes over from there.
//
// Lifecycle (matches plan v4 §"Render flows" — Final Print, and the spec
// in this Phase 8 work-order):
//
//   1. Load order_snapshots row by stripe_session_id.       (else throw)
//   2. Load orders row joined via active_stripe_session_id. (else throw)
//   3. Idempotency check: if product_renders has a valid row for this
//      print_hash AND orders.gelato_order_id is set, jump to 'submitted'.
//   4. Set status='validating', capture the dedicated Nuxt render page via
//      Browserless/Chromium.
//   5. If response.status === 'invalid', throw ValidationFailedError.
//   6. status='ready', orders.{print_file_url, fulfillment_status}.
//   7. Submit to Gelato; on success status='submitted', orders.{gelato_order_id,
//      fulfillment_status='submitted_to_gelato', status='in_production'}.
//
// Errors in steps 1-7 land in the catch arm:
//   • attempts < max_attempts → status='queued' (retry next poll)
//   • attempts >= max_attempts → manualReview.markManualReview() → 'failed'

import type { PoolClient } from 'pg'

import { log } from '../log.js'

import { placeGelatoOrder, type GelatoShippingAddress } from './gelato.js'
import { markManualReview } from './manualReview.js'

// ─── Public types ────────────────────────────────────────────────────────────

export interface PrintRenderJobRow {
  id: string
  stripe_session_id: string
  print_hash: string
  status: string
  attempts: number
  max_attempts: number
  last_error: string | null
  worker_id: string | null
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProcessJobResult {
  status: 'submitted' | 'retried' | 'manual_review' | 'noop'
  jobId: string
  orderId: string | null
  durationMs: number
  error?: string
}

// Browserless final render response.
export interface RenderFinalSuccess {
  status: 'rendered'
  artifact_path: string
  render_url: string
  validation_result: {
    passed: boolean
    errors: Array<{ check: string; severity: string; message: string }>
    warnings: Array<{ check: string; severity: string; message: string }>
  }
  render_ms: number
}

export interface RenderFinalInvalid {
  status: 'invalid'
  validation_result: RenderFinalSuccess['validation_result']
  render_ms: number
}

export type RenderFinalResponse = RenderFinalSuccess | RenderFinalInvalid

// ─── Custom error classes ───────────────────────────────────────────────────

export class ValidationFailedError extends Error {
  readonly validationResult: RenderFinalInvalid['validation_result']
  constructor(validationResult: RenderFinalInvalid['validation_result']) {
    const issues = validationResult.errors.map((e) => `${e.check}: ${e.message}`).join('; ')
    super(`Print validation failed: ${issues || 'no detail'}`)
    this.name = 'ValidationFailedError'
    this.validationResult = validationResult
  }
}

// ─── Dependency-injection shape for tests ───────────────────────────────────

export interface ProcessJobDeps {
  /** Render final print artifact for { stripe_session_id, print_hash }. */
  renderFinal: (input: {
    stripeSessionId: string
    printHash: string
  }) => Promise<RenderFinalResponse>
  /** Submit to Gelato; returns { gelato_order_id }. */
  gelatoPlace: typeof placeGelatoOrder
  /** Optional clock for deterministic tests. */
  now?: () => Date
}

// ─── Browser screenshot renderFinal default impl ────────────────────────────

/**
 * Default renderFinal: capture the real Nuxt/MapPreview render page in
 * Browserless. Tests can still inject a fake renderFinal.
 */
function defaultRenderFinal(): ProcessJobDeps['renderFinal'] {
  return async ({ stripeSessionId, printHash }) => {
    const { renderFinalWithScreenshot } = await import('./renderFinalScreenshot.js')
    return await renderFinalWithScreenshot({ stripeSessionId, printHash })
  }
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export interface ProcessJobInput {
  client: PoolClient
  job: PrintRenderJobRow
  deps?: Partial<ProcessJobDeps>
  workerId: string
}

export async function processJob(input: ProcessJobInput): Promise<ProcessJobResult> {
  const { client, job, workerId } = input
  const t0 = Date.now()

  const deps: ProcessJobDeps = {
    renderFinal: input.deps?.renderFinal ?? defaultRenderFinal(),
    gelatoPlace: input.deps?.gelatoPlace ?? placeGelatoOrder,
    now: input.deps?.now ?? (() => new Date()),
  }

  // Captured for the catch arm.
  let orderId: string | null = null

  try {
    // ── 1. Load snapshot ───────────────────────────────────────────────────
    const snapshotRes = await client.query(
      `SELECT stripe_session_id, order_id, user_id, map_id, product_uid,
              style_config, geojson, stats, bbox,
              proof_render_hash, proof_render_url,
              map_content_hash, chrome_hash, hash_version, provider_profile,
              frozen_at
         FROM order_snapshots
        WHERE stripe_session_id = $1
        LIMIT 1`,
      [job.stripe_session_id],
    )
    if (snapshotRes.rows.length === 0) {
      throw new Error(`order_snapshots row missing for stripe_session_id=${job.stripe_session_id}`)
    }
    const snapshot = snapshotRes.rows[0] as {
      stripe_session_id: string
      product_uid: string
      [k: string]: unknown
    }

    // ── 2. Load order ──────────────────────────────────────────────────────
    const orderRes = await client.query(
      `SELECT id, user_id, quantity, shipping_address,
              gelato_order_id, fulfillment_status, status,
              active_stripe_session_id
         FROM orders
        WHERE active_stripe_session_id = $1
        LIMIT 1`,
      [job.stripe_session_id],
    )
    if (orderRes.rows.length === 0) {
      throw new Error(`orders row missing for active_stripe_session_id=${job.stripe_session_id}`)
    }
    const order = orderRes.rows[0] as {
      id: string
      user_id: string | null
      quantity: number | string | null
      shipping_address: GelatoShippingAddress | null
      gelato_order_id: string | null
      fulfillment_status: string | null
      status: string | null
    }
    orderId = order.id

    // ── 3. Idempotency: already-rendered + already-submitted ───────────────
    const existingRenderRes = await client.query(
      `SELECT id, artifact_path, validation_result
         FROM product_renders
        WHERE stripe_session_id = $1 AND print_hash = $2
        LIMIT 1`,
      [job.stripe_session_id, job.print_hash],
    )
    const existingRender = existingRenderRes.rows[0] as
      | {
          id: string
          artifact_path: string
          validation_result: { passed?: boolean } | null
        }
      | undefined
    const existingValid = !!existingRender?.validation_result?.passed
    if (existingRender && existingValid && order.gelato_order_id) {
      // Already done end-to-end. Just bring the job to terminal state.
      await client.query(
        `UPDATE print_render_jobs
            SET status = 'submitted', completed_at = now()
          WHERE id = $1`,
        [job.id],
      )
      log.info('print_job_idempotent_skip', {
        job_id: job.id,
        order_id: order.id,
        stripe_session_id: job.stripe_session_id,
      })
      return {
        status: 'noop',
        jobId: job.id,
        orderId: order.id,
        durationMs: Date.now() - t0,
      }
    }

    // ── 4. Render the print artifact via browser screenshot ────────────────
    await client.query(
      `UPDATE print_render_jobs SET status = 'validating' WHERE id = $1`,
      [job.id],
    )
    const renderResp = await deps.renderFinal({
      stripeSessionId: job.stripe_session_id,
      printHash: job.print_hash,
    })

    if (renderResp.status === 'invalid') {
      throw new ValidationFailedError(renderResp.validation_result)
    }

    // ── 5. Persist artifact URL on the order, mark print_ready ─────────────
    await client.query(
      `UPDATE print_render_jobs
          SET status = 'ready', completed_at = now()
        WHERE id = $1`,
      [job.id],
    )
    await client.query(
      `UPDATE orders
          SET print_file_url = $1,
              fulfillment_status = 'print_ready'
        WHERE id = $2`,
      [renderResp.render_url, order.id],
    )

    // ── 6. Submit to Gelato ────────────────────────────────────────────────
    if (!order.shipping_address) {
      throw new Error(`orders.shipping_address is null for order_id=${order.id}`)
    }
    const gelatoApiKey = process.env.GELATO_API_KEY ?? ''
    const gelatoOrderType = process.env.GELATO_ORDER_TYPE === 'draft' ? 'draft' : 'order'
    const gelato = await deps.gelatoPlace({
      order: {
        id: order.id,
        quantity: order.quantity,
        user_id: order.user_id,
      },
      shippingAddress: order.shipping_address,
      printFileUrl: renderResp.render_url,
      productUid: snapshot.product_uid,
      gelatoApiKey,
      orderType: gelatoOrderType,
    })

    // ── 7. Terminal success ────────────────────────────────────────────────
    // Update v4 fulfillment_status AND legacy orders.status — see comment
    // at the top of file. Dashboards still consult `status`.
    await client.query(
      `UPDATE orders
          SET gelato_order_id = $1,
              fulfillment_status = 'submitted_to_gelato',
              status = 'in_production'
        WHERE id = $2`,
      [gelato.gelato_order_id, order.id],
    )
    await client.query(
      `UPDATE print_render_jobs SET status = 'submitted' WHERE id = $1`,
      [job.id],
    )

    log.info('print_job_submitted', {
      job_id: job.id,
      order_id: order.id,
      stripe_session_id: job.stripe_session_id,
      gelato_order_id: gelato.gelato_order_id,
      worker_id: workerId,
      duration_ms: Date.now() - t0,
    })
    return {
      status: 'submitted',
      jobId: job.id,
      orderId: order.id,
      durationMs: Date.now() - t0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // attempts on the row was already incremented at claim time, so this
    // value is the post-claim count.
    const attemptsAfter = job.attempts
    const maxAttempts = job.max_attempts
    if (attemptsAfter < maxAttempts) {
      // Retry: requeue with last_error captured.
      await client.query(
        `UPDATE print_render_jobs
            SET status = 'queued',
                last_error = $1,
                worker_id = NULL,
                claimed_at = NULL
          WHERE id = $2`,
        [message.slice(0, 4000), job.id],
      )
      log.warn('print_job_retry', {
        job_id: job.id,
        order_id: orderId,
        attempts: attemptsAfter,
        max_attempts: maxAttempts,
        error: message,
      })
      return {
        status: 'retried',
        jobId: job.id,
        orderId,
        durationMs: Date.now() - t0,
        error: message,
      }
    }

    // Permanent failure → manual review.
    await markManualReview({
      client,
      jobId: job.id,
      orderId,
      errorMessage: message,
    })
    return {
      status: 'manual_review',
      jobId: job.id,
      orderId,
      durationMs: Date.now() - t0,
      error: message,
    }
  }
}
