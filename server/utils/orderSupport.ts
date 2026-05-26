import type { H3Event } from 'h3'
import { FLAGS } from '~/utils/knownFlags'
import { isFeatureEnabled } from '~/server/utils/featureFlags'
import type { StaffSession } from '~/server/utils/adminAuth'

export async function requireOrderSupportActionsFlag(event: H3Event, staff: StaffSession) {
  const enabled = await isFeatureEnabled(event, FLAGS.ORDER_SUPPORT_ACTIONS, { staffSession: staff })
  if (!enabled) {
    throw createError({ statusCode: 404, message: 'Order support actions are not enabled.' })
  }
}
