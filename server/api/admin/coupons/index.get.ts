import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'coupon:manage')
  const supabase = await serverSupabaseServiceRole(event)

  const { data, error } = await supabase.rpc('admin_coupon_summaries')
  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data || []).map((coupon: any) => ({
    ...coupon,
    percent_off: Number(coupon.percent_off),
    redeemed_count: Number(coupon.redeemed_count ?? 0),
    reserved_count: Number(coupon.reserved_count ?? 0),
  }))
})
