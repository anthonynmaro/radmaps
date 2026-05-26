import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'

const Body = z.object({ reason: z.string().trim().max(1000).optional() })

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event, 'support:write')
  await requireOrderSupportActionsFlag(event, staff)
  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, message: 'Order id is required' })
  const body = Body.parse(await readBody(event).catch(() => ({})))

  const supabase = await serverSupabaseServiceRole(event)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, gelato_order_id, status')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw createError({ statusCode: 500, message: orderError.message })
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  if (order.gelato_order_id) {
    throw createError({ statusCode: 409, message: 'Order was already submitted to Gelato. Use manual review or refund instead.' })
  }

  const { error } = await supabase.from('orders').update({
    status: 'cancelled',
    fulfillment_status: 'cancelled',
  }).eq('id', orderId)
  if (error) throw createError({ statusCode: 500, message: error.message })
  await supabase.from('fulfillment_jobs').update({ status: 'cancelled' }).eq('order_id', orderId).eq('status', 'queued')
  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'order_cancelled',
    actorType: 'staff',
    actorId: staff.user!.id,
    message: body.reason,
  })
  return { ok: true }
})
