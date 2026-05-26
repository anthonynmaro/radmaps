import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'

const Body = z.object({ body: z.string().trim().min(1).max(4000) })

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event, 'support:write')
  await requireOrderSupportActionsFlag(event, staff)
  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, message: 'Order id is required' })
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('support_notes')
    .insert({ order_id: orderId, actor_id: staff.user!.id, body: parsed.data.body })
    .select()
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })
  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'support_note_added',
    actorType: 'staff',
    actorId: staff.user!.id,
  })
  return data
})
