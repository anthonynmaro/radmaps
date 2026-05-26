/**
 * POST /api/orders/lookup
 * Public order lookup by email + order ID fragment.
 * Returns order status, tracking info, and product details.
 * No auth required — uses email + order ID as verification.
 */
import { createClient } from '@supabase/supabase-js'
import { assertRateLimit } from '~/server/utils/rateLimit'

function publicOrderStatus(order: Record<string, unknown>): string {
  const status = String(order.status || '')
  const fulfillmentStatus = String(order.fulfillment_status || '')
  const refundStatus = String(order.refund_status || '')
  const disputeStatus = String(order.dispute_status || '')

  if (refundStatus === 'full' || status === 'refunded') return 'refunded'
  if (status === 'delivered') return 'delivered'
  if (status === 'shipped') return 'shipped'
  if (status === 'in_production' || fulfillmentStatus === 'submitted_to_gelato') return 'in_production'
  if (status === 'manual_review' || fulfillmentStatus === 'manual_review' || fulfillmentStatus === 'fraud_review') return 'manual_review'
  if (
    status === 'failed'
    || status === 'fulfillment_failed'
    || fulfillmentStatus === 'failed'
    || fulfillmentStatus === 'render_queue_failed'
    || fulfillmentStatus === 'snapshot_missing'
    || fulfillmentStatus === 'quote_mismatch'
    || (disputeStatus && disputeStatus !== 'none' && disputeStatus !== 'won')
  ) return 'issue_detected'
  if (fulfillmentStatus === 'rendering_print' || fulfillmentStatus === 'print_ready') return 'preparing_print'
  if (status === 'paid' || fulfillmentStatus === 'paid') return 'paid'
  return 'preparing_print'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  assertRateLimit(event, { key: 'order-lookup', limit: 10, windowMs: 15 * 60_000 })
  const body = await readBody(event)

  const email = (body.email ?? '').toLowerCase().trim()
  const orderId = (body.order_id ?? '').trim()

  if (!email || !orderId) {
    throw createError({ statusCode: 400, message: 'Email and order ID are required' })
  }

  // Use service key to bypass RLS (guest orders have no user_id)
  const supabase = createClient(config.public.supabaseUrl as string, config.supabaseServiceKey as string) as any

  // Search for orders matching the email in shipping_address and the order ID.
  // We support partial order ID matching (first 8 chars) for convenience.
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, fulfillment_status, refund_status, dispute_status, product_uid, print_size, tracking_code, carrier, digital_url, created_at, shipping_address, premade_title')
    .or(`guest_email.eq.${email},shipping_address->>email.eq.${email}`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Order lookup error:', error)
    throw createError({ statusCode: 500, message: 'Failed to look up orders' })
  }

  // Filter by order ID (exact or partial match)
  const matched = (orders ?? []).filter((o: { id: string }) =>
    o.id === orderId || o.id.startsWith(orderId)
  )

  if (matched.length === 0) {
    throw createError({ statusCode: 404, message: 'No order found with that email and order ID' })
  }

  // Return sanitized order info (strip sensitive fields)
  return matched.map((o: Record<string, unknown>) => ({
    id: o.id,
    status: publicOrderStatus(o),
    product: o.print_size,
    tracking_code: o.tracking_code,
    carrier: o.carrier,
    has_digital: !!o.digital_url,
    created_at: o.created_at,
    title: o.premade_title,
  }))
})
