import type { PoolClient } from 'pg'
import { log } from '../log.js'
import { placeGelatoOrder, type GelatoShippingAddress } from './gelato.js'

export interface FulfillmentJobRow {
  id: string
  order_id: string
  job_type: 'gelato_submit' | 'reprint'
  status: string
  attempts: number
  max_attempts: number
  last_error: string | null
  worker_id: string | null
  claimed_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ProcessFulfillmentJobResult {
  status: 'submitted' | 'retried' | 'manual_review' | 'noop'
  jobId: string
  orderId: string
  error?: string
}

class FulfillmentHoldError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FulfillmentHoldError'
  }
}

export async function processFulfillmentJob(input: {
  client: PoolClient
  job: FulfillmentJobRow
  workerId: string
  gelatoPlace?: typeof placeGelatoOrder
}): Promise<ProcessFulfillmentJobResult> {
  const { client, job, workerId } = input
  const gelatoPlace = input.gelatoPlace ?? placeGelatoOrder

  try {
    const { rows } = await client.query(
      `SELECT id, user_id, guest_email, quantity, shipping_address, product_uid,
              print_file_url, gelato_order_id, shipment_method_uid,
              status, fulfillment_status, payment_status, dispute_status,
              refund_status, risk_level
         FROM orders
        WHERE id = $1
        LIMIT 1`,
      [job.order_id],
    )
    const order = rows[0] as {
      id: string
      user_id: string | null
      guest_email: string | null
      quantity: number | string | null
      shipping_address: GelatoShippingAddress | null
      product_uid: string
      print_file_url: string | null
      gelato_order_id: string | null
      shipment_method_uid: string | null
      status: string | null
      fulfillment_status: string | null
      payment_status: string | null
      dispute_status: string | null
      refund_status: string | null
      risk_level: string | null
    } | undefined
    if (!order) throw new Error(`orders row missing for fulfillment job ${job.id}`)

    assertFulfillmentAllowed(order, job.job_type)

    if (job.job_type === 'gelato_submit' && order.gelato_order_id) {
      await client.query(
        `UPDATE fulfillment_jobs
            SET status = 'submitted', completed_at = now()
          WHERE id = $1`,
        [job.id],
      )
      return { status: 'noop', jobId: job.id, orderId: order.id }
    }
    if (!order.shipping_address) throw new Error(`orders.shipping_address is null for order_id=${order.id}`)
    if (!order.print_file_url) throw new Error(`orders.print_file_url is null for order_id=${order.id}`)

    const gelato = await gelatoPlace({
      order: {
        id: order.id,
        order_reference_id: job.job_type === 'reprint' ? `${order.id}-reprint-${job.id}` : order.id,
        quantity: order.quantity,
        user_id: order.user_id,
        guest_email: order.guest_email,
        shipment_method_uid: order.shipment_method_uid,
      },
      shippingAddress: order.shipping_address,
      printFileUrl: order.print_file_url,
      productUid: order.product_uid,
      gelatoApiKey: process.env.GELATO_API_KEY ?? '',
      orderType: process.env.GELATO_ORDER_TYPE === 'draft' ? 'draft' : 'order',
    })

    await client.query(
      `UPDATE orders
          SET gelato_order_id = COALESCE(gelato_order_id, $1),
              fulfillment_status = 'submitted_to_gelato',
              status = 'in_production'
        WHERE id = $2`,
      [gelato.gelato_order_id, order.id],
    )
    await client.query(
      `UPDATE fulfillment_jobs
          SET status = 'submitted',
              completed_at = now(),
              last_error = NULL
        WHERE id = $1`,
      [job.id],
    )
    await client.query(
      `INSERT INTO order_events (order_id, event_type, actor_type, message, metadata)
       VALUES ($1, $2, 'system', $3, $4)`,
      [
        order.id,
        job.job_type === 'reprint' ? 'reprint_submitted_to_gelato' : 'submitted_to_gelato',
        'Gelato fulfillment job submitted.',
        JSON.stringify({ gelato_order_id: gelato.gelato_order_id, job_id: job.id, worker_id: workerId }),
      ],
    )

    log.info('fulfillment_job_submitted', {
      job_id: job.id,
      order_id: order.id,
      gelato_order_id: gelato.gelato_order_id,
      worker_id: workerId,
    })
    return { status: 'submitted', jobId: job.id, orderId: order.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (err instanceof FulfillmentHoldError) {
      await moveFulfillmentJobToManualReview(client, job, workerId, message)
      return { status: 'manual_review', jobId: job.id, orderId: job.order_id, error: message }
    }
    if (job.attempts < job.max_attempts) {
      await client.query(
        `UPDATE fulfillment_jobs
            SET status = 'queued',
                last_error = $1,
                worker_id = NULL,
                claimed_at = NULL
          WHERE id = $2`,
        [message.slice(0, 4000), job.id],
      )
      return { status: 'retried', jobId: job.id, orderId: job.order_id, error: message }
    }

    await moveFulfillmentJobToManualReview(client, job, workerId, message)
    return { status: 'manual_review', jobId: job.id, orderId: job.order_id, error: message }
  }
}

async function moveFulfillmentJobToManualReview(
  client: PoolClient,
  job: FulfillmentJobRow,
  workerId: string,
  message: string,
) {
  await client.query(
    `UPDATE fulfillment_jobs
        SET status = 'manual_review',
            last_error = $1,
            completed_at = now()
      WHERE id = $2`,
    [message.slice(0, 4000), job.id],
  )
  await client.query(
    `UPDATE orders SET fulfillment_status = 'manual_review', status = 'manual_review' WHERE id = $1`,
    [job.order_id],
  )
  await client.query(
    `INSERT INTO order_events (order_id, event_type, actor_type, message, metadata)
     VALUES ($1, 'fulfillment_manual_review', 'system', $2, $3)`,
    [job.order_id, message.slice(0, 4000), JSON.stringify({ job_id: job.id, worker_id: workerId })],
  )
  log.error('fulfillment_manual_review', {
    alert: 'manual_review',
    job_id: job.id,
    order_id: job.order_id,
    error: message,
  })
}

function assertFulfillmentAllowed(order: {
  id: string
  status: string | null
  fulfillment_status: string | null
  payment_status: string | null
  dispute_status: string | null
  refund_status: string | null
  risk_level: string | null
}, jobType: 'gelato_submit' | 'reprint') {
  if (jobType === 'reprint') {
    if (order.status === 'cancelled' || order.status === 'refunded' || order.refund_status === 'full') {
      throw new FulfillmentHoldError(`order_id=${order.id} is not eligible for reprint after cancellation or full refund`)
    }
    return
  }

  const paymentSettled = order.payment_status === 'paid' || order.status === 'paid'
  if (!paymentSettled) throw new FulfillmentHoldError(`order_id=${order.id} is not paid`)
  if (order.status === 'manual_review' || order.fulfillment_status === 'manual_review') {
    throw new FulfillmentHoldError(`order_id=${order.id} is in manual review`)
  }
  if (order.fulfillment_status === 'fraud_review' || order.risk_level === 'review.opened' || order.risk_level === 'radar.early_fraud_warning.created') {
    throw new FulfillmentHoldError(`order_id=${order.id} is held by Stripe risk review`)
  }
  if (order.dispute_status && order.dispute_status !== 'none' && order.dispute_status !== 'won') {
    throw new FulfillmentHoldError(`order_id=${order.id} has an active dispute`)
  }
  if (order.status === 'cancelled' || order.refund_status === 'full') {
    throw new FulfillmentHoldError(`order_id=${order.id} is cancelled or fully refunded`)
  }
}
