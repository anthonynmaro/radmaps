import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { getStripeClient } from '~/server/utils/stripe'
import { isValidCouponSlug, normalizeCouponEmail, normalizeCouponSlug } from '~/utils/coupons'

const Body = z.object({
  slug: z.string().min(1).max(80),
  percent_off: z.number().positive().max(100),
  expires_at: z.string().datetime().nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  email: z.string().email().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'coupon:manage')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const slug = normalizeCouponSlug(body.slug)
  if (!isValidCouponSlug(slug)) {
    throw createError({ statusCode: 400, message: 'Coupon slug may only contain letters, numbers, and dashes.' })
  }

  const email = normalizeCouponEmail(body.email)
  const config = useRuntimeConfig()
  const stripe = getStripeClient(config)
  const supabase = await serverSupabaseServiceRole(event)

  const coupon = await stripe.coupons.create({
    duration: 'once',
    percent_off: body.percent_off,
    name: slug,
    metadata: {
      radmaps_slug: slug,
      email: email || '',
    },
  })

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      slug,
      percent_off: body.percent_off,
      expires_at: body.expires_at || null,
      max_redemptions: body.max_redemptions || null,
      email,
      stripe_coupon_id: coupon.id,
      created_by: session.user!.id,
      updated_by: session.user!.id,
    })
    .select('id, slug, percent_off, expires_at, max_redemptions, email, active, created_at, updated_at')
    .single()

  if (error) {
    await stripe.coupons.del(coupon.id).catch((err) => {
      console.error('[admin/coupons] Failed to delete Stripe coupon after DB insert error:', (err as Error).message)
    })
    const message = error.code === '23505' ? 'A coupon with that slug already exists.' : error.message
    throw createError({ statusCode: error.code === '23505' ? 409 : 500, message })
  }

  return {
    ...data,
    percent_off: Number(data.percent_off),
    redeemed_count: 0,
    reserved_count: 0,
  }
})
