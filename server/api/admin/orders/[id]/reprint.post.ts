import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'

const Body = z.object({ reason: z.string().trim().min(1).max(1000) })

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
    .select('id, print_file_url')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError) throw createError({ statusCode: 500, message: orderError.message })
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  if (!order.print_file_url) throw createError({ statusCode: 409, message: 'No print file is available for reprint.' })

  const { data: job, error } = await supabase
    .from('fulfillment_jobs')
    .insert({
      order_id: orderId,
      job_type: 'reprint',
      metadata: { reason: parsed.data.reason, actor_id: staff.user!.id },
    })
    .select()
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })
  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'reprint_queued',
    actorType: 'staff',
    actorId: staff.user!.id,
    message: parsed.data.reason,
    metadata: { fulfillment_job_id: job.id },
  })
  return job
})
