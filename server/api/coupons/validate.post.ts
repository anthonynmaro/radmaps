import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeCouponSlug } from '~/utils/coupons'
import { validateCouponForCheckout } from '~/server/utils/coupons'

const Body = z.object({
  coupon_slug: z.string().min(1).max(80),
  email: z.string().email(),
  subtotal_cents: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  return validateCouponForCheckout(supabase, {
    slug: normalizeCouponSlug(parsed.data.coupon_slug),
    buyerEmail: parsed.data.email,
    subtotalCents: parsed.data.subtotal_cents,
  })
})

