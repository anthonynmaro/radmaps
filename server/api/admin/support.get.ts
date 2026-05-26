import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'

const PROFILE_SELECT = 'id, email, full_name, created_at'
const ORDER_SELECT = 'id, user_id, guest_email, premade_slug, premade_title, status, fulfillment_status, refund_status, dispute_status, product_uid, print_size, total_cents, amount_total_cents, amount_shipping_cents, amount_tax_cents, currency, stripe_session_id, stripe_pi_id, stripe_customer_id, stripe_charge_id, gelato_order_id, tracking_code, carrier, created_at'

function dedupeById(rows: any[][], limit: number): any[] {
  const byId = new Map<string, any>()
  for (const group of rows) {
    for (const row of group || []) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'support:read')
  const supabase = await serverSupabaseServiceRole(event)
  const q = String(getQuery(event).q || '').trim().slice(0, 160)
  if (!q) return { profiles: [], orders: [] }

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
  const orderQueries = [
    supabase.from('orders').select(ORDER_SELECT).ilike('guest_email', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('premade_slug', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('premade_title', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('stripe_session_id', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('stripe_pi_id', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('stripe_customer_id', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('gelato_order_id', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('orders').select(ORDER_SELECT).ilike('tracking_code', `%${q}%`).order('created_at', { ascending: false }).limit(20),
  ]
  if (uuidLike) {
    orderQueries.push(supabase.from('orders').select(ORDER_SELECT).eq('id', q).order('created_at', { ascending: false }).limit(1))
  }

  const [profileResults, orderResults] = await Promise.all([
    Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT).ilike('email', `%${q}%`).order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles').select(PROFILE_SELECT).ilike('full_name', `%${q}%`).order('created_at', { ascending: false }).limit(20),
    ]),
    Promise.all(orderQueries),
  ])

  const profilesError = profileResults.find((result: any) => result.error)?.error
  const ordersError = orderResults.find((result: any) => result.error)?.error
  if (profilesError) throw createError({ statusCode: 500, message: profilesError.message })
  if (ordersError) throw createError({ statusCode: 500, message: ordersError.message })

  return {
    profiles: dedupeById(profileResults.map((result: any) => result.data || []), 20),
    orders: dedupeById(orderResults.map((result: any) => result.data || []), 20),
  }
})
