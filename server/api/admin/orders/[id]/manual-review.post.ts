import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'

const Body = z.object({
  status: z.enum(['manual_review', 'paid', 'in_production', 'fulfillment_failed']).default('manual_review'),
  message: z.string().trim().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event, 'support:write')
  await requireOrderSupportActionsFlag(event, staff)
  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, message: 'Order id is required' })
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  if (parsed.data.status === 'paid' || parsed.data.status === 'in_production') {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_status, status')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw createError({ statusCode: 500, message: orderError.message })
    if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
    if (order.payment_status !== 'paid' && order.status !== 'paid' && order.status !== 'in_production') {
      throw createError({ statusCode: 409, message: 'Unpaid orders cannot be released from manual review.' })
    }
  }
  const fulfillmentStatus = parsed.data.status === 'manual_review'
    ? 'manual_review'
    : parsed.data.status === 'fulfillment_failed'
      ? 'failed'
      : 'paid'
  const { error } = await supabase.from('orders').update({
    status: parsed.data.status,
    fulfillment_status: fulfillmentStatus,
  }).eq('id', orderId)
  if (error) throw createError({ statusCode: 500, message: error.message })
  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'manual_review_updated',
    actorType: 'staff',
    actorId: staff.user!.id,
    message: parsed.data.message,
    metadata: { status: parsed.data.status },
  })
  return { ok: true }
})
