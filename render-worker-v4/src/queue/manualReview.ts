// render-worker-v4/src/queue/manualReview.ts
//
// "Permanent failure" terminal handler for the print queue.
//
// When `attempts >= max_attempts`, processJob.ts asks this module to:
//   1. Mark the job 'failed' with the last error message.
//   2. Mark the order 'manual_review' so a human can resolve it.
//   3. Emit an `alert=manual_review` log line so Railway/Logflare can
//      page the on-call rotation. (Plan v4 §16: manual_review_count is
//      a tracked metric — log on every transition into the state, not
//      a periodic count, so the alerting rule is simply "any line".)
//
// All DB writes use the same pg client the consumer is already holding.
// We deliberately do NOT update the legacy `orders.status` column to
// any cancelled/failed value here — leaving it as 'paid' / 'in_production'
// matches what the dashboard already understands; ops will adjust it
// after they investigate.

import type { PoolClient } from 'pg'

import { log } from '../log.js'

export interface ManualReviewInput {
  client: PoolClient
  jobId: string
  orderId: string | null
  errorMessage: string
}

export async function markManualReview(input: ManualReviewInput): Promise<void> {
  const { client, jobId, orderId, errorMessage } = input

  // Truncate the message so a runaway stack trace can't bloat the row.
  const trimmed = errorMessage.length > 4000 ? errorMessage.slice(0, 4000) + '…' : errorMessage

  await client.query(
    `UPDATE print_render_jobs
        SET status = 'failed',
            last_error = $1,
            completed_at = now()
      WHERE id = $2`,
    [trimmed, jobId],
  )

  if (orderId) {
    // Update the v4 fulfillment_status. The legacy `orders.status` column
    // is intentionally not touched here — leave it where it was so the
    // existing dashboard / order-tracking UI keeps showing the order in
    // its last legitimate state until ops reviews.
    await client.query(
      `UPDATE orders SET fulfillment_status = 'manual_review' WHERE id = $1`,
      [orderId],
    )
  }

  // Single-line alert event. The plan v4 §16 metric `manual_review_count`
  // is the count of these per window; alerting picks them up by name.
  log.error('manual_review', {
    alert: 'manual_review',
    job_id: jobId,
    order_id: orderId,
    error: trimmed,
  })
}
