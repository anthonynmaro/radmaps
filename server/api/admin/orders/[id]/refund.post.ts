import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { getStripeClient } from '~/server/utils/stripe'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'

const Body = z.object({
  amount_cents: z.number().int().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).default('requested_by_customer'),
  note: z.string().trim().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event, 'support:write')
  await requireOrderSupportActionsFlag(event, staff)
  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, message: 'Order id is required' })
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, stripe_pi_id, amount_total_cents, amount_refunded_cents, currency')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw createError({ statusCode: 500, message: orderError.message })
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  if (!order.stripe_pi_id) throw createError({ statusCode: 409, message: 'Order has no Stripe payment intent.' })

  const remaining = Number(order.amount_total_cents || 0) - Number(order.amount_refunded_cents || 0)
  const amount = parsed.data.amount_cents ?? remaining
  if (amount <= 0 || amount > remaining) {
    throw createError({ statusCode: 400, message: 'Refund amount exceeds remaining paid amount.' })
  }

  const stripe = getStripeClient()
  const refund = await stripe.refunds.create({
    payment_intent: order.stripe_pi_id,
    amount,
    reason: parsed.data.reason,
    metadata: {
      order_id: orderId,
      actor_id: staff.user!.id,
      note: parsed.data.note || '',
    },
  }, {
    idempotencyKey: `refund:${orderId}:${amount}:${remaining}`,
  })

  await supabase.from('order_refunds').upsert({
    order_id: orderId,
    stripe_refund_id: refund.id,
    amount_cents: amount,
    currency: refund.currency || order.currency || 'usd',
    reason: parsed.data.reason,
    status: refund.status || 'pending',
    actor_id: staff.user!.id,
    raw_refund: refund as any,
  }, { onConflict: 'stripe_refund_id' })
  await supabase.from('orders').update({ refund_status: 'pending' }).eq('id', orderId)
  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'refund_requested',
    actorType: 'staff',
    actorId: staff.user!.id,
    message: parsed.data.note,
    metadata: { amount_cents: amount, stripe_refund_id: refund.id },
  })

  return { refund_id: refund.id, status: refund.status }
})
