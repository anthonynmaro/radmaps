import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'support:read')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Order id is required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })
  const stripeSessionId = order.active_stripe_session_id || order.stripe_session_id

  const [
    events,
    refunds,
    disputes,
    notes,
    payments,
    fulfillmentJobs,
    printJobs,
    snapshots,
  ] = await Promise.all([
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('order_refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('order_disputes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('support_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_attempts').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('fulfillment_jobs').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    stripeSessionId
      ? supabase.from('print_render_jobs').select('*').eq('stripe_session_id', stripeSessionId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    stripeSessionId
      ? supabase.from('order_snapshots').select('stripe_session_id, map_id, product_uid, proof_render_url, frozen_at').eq('stripe_session_id', stripeSessionId)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [events, refunds, disputes, notes, payments, fulfillmentJobs, printJobs, snapshots]) {
    if (result.error) throw createError({ statusCode: 500, message: result.error.message })
  }

  return {
    order,
    events: events.data || [],
    refunds: refunds.data || [],
    disputes: disputes.data || [],
    notes: notes.data || [],
    payments: payments.data || [],
    fulfillment_jobs: fulfillmentJobs.data || [],
    print_jobs: printJobs.data || [],
    snapshots: snapshots.data || [],
  }
})
