/**
 * POST /api/orders/lookup
 * Public order lookup by email + order ID fragment.
 * Returns order status, tracking info, and product details.
 * No auth required — uses email + order ID as verification.
 */
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const email = (body.email ?? '').toLowerCase().trim()
  const orderId = (body.order_id ?? '').trim()

  if (!email || !orderId) {
    throw createError({ statusCode: 400, message: 'Email and order ID are required' })
  }

  // Use service key to bypass RLS (guest orders have no user_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(config.public.supabaseUrl as string, config.supabaseServiceKey as string) as any

  // Search for orders matching the email in shipping_address and the order ID.
  // We support partial order ID matching (first 8 chars) for convenience.
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, product_uid, print_size, tracking_code, carrier, digital_url, created_at, shipping_address, premade_title')
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
    status: o.status,
    product: o.print_size,
    tracking_code: o.tracking_code,
    carrier: o.carrier,
    has_digital: !!o.digital_url,
    created_at: o.created_at,
    title: o.premade_title,
  }))
})
