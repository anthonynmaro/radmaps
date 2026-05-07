import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { normalizeCouponEmail } from '~/utils/coupons'

const Body = z.object({
  active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  email: z.string().email().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'coupon:manage')
  const id = String(getRouterParam(event, 'id') || '')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })
  if (!id) throw createError({ statusCode: 400, message: 'Coupon id is required.' })

  const body = parsed.data
  const updates: Record<string, unknown> = {
    updated_by: session.user!.id,
  }
  if (Object.prototype.hasOwnProperty.call(body, 'active')) updates.active = body.active
  if (Object.prototype.hasOwnProperty.call(body, 'expires_at')) updates.expires_at = body.expires_at || null
  if (Object.prototype.hasOwnProperty.call(body, 'max_redemptions')) updates.max_redemptions = body.max_redemptions || null
  if (Object.prototype.hasOwnProperty.call(body, 'email')) updates.email = normalizeCouponEmail(body.email)

  const supabase = await serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', id)
    .select('id, slug, percent_off, expires_at, max_redemptions, email, active, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return {
    ...data,
    percent_off: Number(data.percent_off),
  }
})

