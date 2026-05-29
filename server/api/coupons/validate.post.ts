import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeCouponSlug } from '~/utils/coupons'
import { validateCouponForCheckout } from '~/server/utils/coupons'
import { assertRateLimit } from '~/server/utils/rateLimit'

const Body = z.object({
  coupon_slug: z.string().min(1).max(80),
  email: z.string().email(),
  subtotal_cents: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  assertRateLimit(event, { key: 'coupon-validate-ip', limit: 60, windowMs: 15 * 60_000 })
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })
  assertRateLimit(event, { key: 'coupon-validate-email', limit: 20, windowMs: 15 * 60_000, userId: parsed.data.email.toLowerCase().trim() })

  const supabase = await serverSupabaseServiceRole(event)
  return validateCouponForCheckout(supabase, {
    slug: normalizeCouponSlug(parsed.data.coupon_slug),
    buyerEmail: parsed.data.email,
    subtotalCents: parsed.data.subtotal_cents,
  })
})
