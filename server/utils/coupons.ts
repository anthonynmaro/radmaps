import { calculateCouponDiscountCents, isCouponExpired, isCouponLimitReached, normalizeCouponEmail, normalizeCouponSlug } from '~/utils/coupons'

export type CouponCartSource = 'custom' | 'premade'

export interface CouponPreview {
  coupon_id: string
  slug: string
  percent_off: number
  discount_cents: number
  subtotal_cents: number
  total_cents: number
}

export interface CouponReservation extends CouponPreview {
  redemption_id: string
  stripe_coupon_id: string
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_slug: 'Enter a valid coupon code.',
  invalid_email: 'Enter your email before applying this coupon.',
  invalid_cart_source: 'This coupon cannot be applied to this checkout.',
  invalid_subtotal: 'This coupon cannot be applied to this total.',
  not_found: 'Coupon not found.',
  inactive: 'This coupon is no longer active.',
  expired: 'This coupon has expired.',
  email_mismatch: 'This coupon is reserved for a different email address.',
  limit_reached: 'This coupon has reached its use limit.',
}

export function couponErrorMessage(code: string | null | undefined): string {
  return ERROR_MESSAGES[code || ''] || 'This coupon cannot be applied.'
}

export async function validateCouponForCheckout(
  supabase: any,
  input: {
    slug: string
    buyerEmail: string
    subtotalCents: number
  },
): Promise<CouponPreview> {
  const slug = normalizeCouponSlug(input.slug)
  const buyerEmail = normalizeCouponEmail(input.buyerEmail)
  if (!slug) throw createError({ statusCode: 400, message: couponErrorMessage('invalid_slug') })
  if (!buyerEmail) throw createError({ statusCode: 400, message: couponErrorMessage('invalid_email') })
  if (!Number.isInteger(input.subtotalCents) || input.subtotalCents <= 0) {
    throw createError({ statusCode: 400, message: couponErrorMessage('invalid_subtotal') })
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('id, slug, percent_off, expires_at, max_redemptions, email, active')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!coupon) throw createError({ statusCode: 404, message: couponErrorMessage('not_found') })
  if (!coupon.active) throw createError({ statusCode: 422, message: couponErrorMessage('inactive') })
  if (isCouponExpired(coupon.expires_at)) throw createError({ statusCode: 422, message: couponErrorMessage('expired') })
  if (coupon.email && coupon.email !== buyerEmail) {
    throw createError({ statusCode: 422, message: couponErrorMessage('email_mismatch') })
  }

  const [{ count: redeemedCount, error: redeemedError }, { count: reservedCount, error: reservedError }] = await Promise.all([
    supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('status', 'redeemed'),
    supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('status', 'reserved')
      .gt('expires_at', new Date().toISOString()),
  ])
  if (redeemedError) throw createError({ statusCode: 500, message: redeemedError.message })
  if (reservedError) throw createError({ statusCode: 500, message: reservedError.message })
  if (isCouponLimitReached(coupon.max_redemptions, redeemedCount ?? 0, reservedCount ?? 0)) {
    throw createError({ statusCode: 422, message: couponErrorMessage('limit_reached') })
  }

  const percentOff = Number(coupon.percent_off)
  const discountCents = calculateCouponDiscountCents(input.subtotalCents, percentOff)
  return {
    coupon_id: coupon.id,
    slug: coupon.slug,
    percent_off: percentOff,
    discount_cents: discountCents,
    subtotal_cents: input.subtotalCents,
    total_cents: Math.max(0, input.subtotalCents - discountCents),
  }
}

export async function reserveCouponForCheckout(
  supabase: any,
  input: {
    slug: string
    buyerEmail: string
    cartSource: CouponCartSource
    productUid: string
    subtotalCents: number
    currency?: string
    mapId?: string | null
    premadeSlug?: string | null
  },
): Promise<CouponReservation | null> {
  const slug = normalizeCouponSlug(input.slug)
  if (!slug) return null

  const { data, error } = await supabase.rpc('reserve_coupon_redemption', {
    p_slug: slug,
    p_buyer_email: normalizeCouponEmail(input.buyerEmail) || '',
    p_cart_source: input.cartSource,
    p_product_uid: input.productUid,
    p_subtotal_cents: input.subtotalCents,
    p_currency: input.currency || 'usd',
    p_map_id: input.mapId || null,
    p_premade_slug: input.premadeSlug || null,
  })

  if (error) throw createError({ statusCode: 500, message: error.message })
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.ok) {
    throw createError({ statusCode: 422, message: couponErrorMessage(result?.error_code) })
  }

  const percentOff = Number(result.percent_off)
  const discountCents = Number(result.discount_cents || 0)
  return {
    coupon_id: result.coupon_id,
    redemption_id: result.redemption_id,
    stripe_coupon_id: result.stripe_coupon_id,
    slug,
    percent_off: percentOff,
    discount_cents: discountCents,
    subtotal_cents: input.subtotalCents,
    total_cents: Math.max(0, input.subtotalCents - discountCents),
  }
}

export async function attachStripeSessionToCouponReservation(supabase: any, redemptionId: string, stripeSessionId: string) {
  const { error } = await supabase
    .from('coupon_redemptions')
    .update({ stripe_session_id: stripeSessionId })
    .eq('id', redemptionId)
    .eq('status', 'reserved')
  if (error) throw new Error(error.message)
}

export async function releaseCouponReservation(supabase: any, redemptionId: string | null | undefined) {
  if (!redemptionId) return
  const { error } = await supabase
    .from('coupon_redemptions')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('id', redemptionId)
    .eq('status', 'reserved')
  if (error) throw new Error(error.message)
}

