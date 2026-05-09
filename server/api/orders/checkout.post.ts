/**
 * POST /api/orders/checkout
 * Create a Stripe Checkout session for a map order.
 * Returns { url } — redirect the user to this URL.
 */
import Stripe from 'stripe'
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getProduct } from '~/utils/products'
import { freezeOrderSnapshot } from '~/server/utils/snapshot'
import { attachStripeSessionToCouponReservation, releaseCouponReservation, reserveCouponForCheckout } from '~/server/utils/coupons'

const CheckoutBody = z.object({
  map_id: z.string().uuid(),
  product_uid: z.string(),   // Gelato productUid (or 'digital')
  print_size: z.string(),
  quantity: z.number().int().min(1).max(10).default(1),
  shipping_address: z.object({
    name: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state_code: z.string().min(2).max(3),
    country_code: z.string().length(2),
    zip: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  digital_only: z.boolean().default(false),
  coupon_slug: z.string().max(80).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const parsed = CheckoutBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { map_id, product_uid, print_size, quantity, shipping_address, digital_only, coupon_slug } = parsed.data

  const config = useRuntimeConfig()
  const supabase = await serverSupabaseClient(event)
  const adminClient = await serverSupabaseServiceRole(event)

  // Verify map ownership and that it has been rendered
  const { data: map } = await supabase
    .from('maps')
    .select('id, user_id, status, render_url, title')
    .eq('id', map_id)
    .eq('user_id', user.id)
    .single()

  if (!map) throw createError({ statusCode: 404, message: 'Map not found' })
  if (!digital_only && map.status !== 'rendered') {
    throw createError({ statusCode: 422, message: 'Map must be rendered before ordering a print' })
  }

  // Look up product + price from Gelato catalogue
  const product = digital_only ? null : getProduct(product_uid)
  const DIGITAL_PRICE = 999 // $9.99
  const unitPrice = digital_only ? DIGITAL_PRICE : product?.price_cents ?? 0

  if (!unitPrice) {
    throw createError({ statusCode: 400, message: 'Invalid product UID' })
  }

  const subtotalCents = unitPrice * quantity
  const couponReservation = coupon_slug
    ? await reserveCouponForCheckout(adminClient, {
        slug: coupon_slug,
        buyerEmail: shipping_address.email,
        cartSource: 'custom',
        productUid: digital_only ? 'digital' : product_uid,
        subtotalCents,
        mapId: map_id,
      })
    : null
  const stripe = new Stripe(config.stripeSecretKey)
  const configuredSiteUrl = typeof config.public.siteUrl === 'string'
    ? config.public.siteUrl
    : ''
  const baseUrl = configuredSiteUrl || (process.env.NODE_ENV === 'production'
    ? 'https://radmaps.studio'
    : 'http://localhost:3001')

  // Create Stripe Checkout session
  let session: Stripe.Checkout.Session | null = null
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: shipping_address.email,
      discounts: couponReservation ? [{ coupon: couponReservation.stripe_coupon_id }] : undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: digital_only
                ? `${map.title} — Digital Download`
                : `${map.title} — ${product?.name ?? print_size}`,
              // Custom route previews can contain sensitive location data. Do
              // not copy private map render URLs into Stripe-hosted product
              // metadata; show the preview only inside the authenticated app.
            },
            unit_amount: unitPrice,
          },
          quantity,
        },
      ],
      metadata: {
        user_id: user.id,
        map_id,
        map_title: map.title,
        product_uid: digital_only ? 'digital' : product_uid,
        print_size: digital_only ? 'digital' : print_size,
        quantity: String(quantity),
        shipping_address: JSON.stringify(shipping_address),
        digital_only: String(digital_only),
        coupon_id: couponReservation?.coupon_id || '',
        coupon_slug: couponReservation?.slug || '',
        coupon_redemption_id: couponReservation?.redemption_id || '',
      },
      shipping_address_collection: digital_only
        ? undefined
        : { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO'] },
      success_url: `${baseUrl}/create/${map_id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/create/${map_id}/checkout`,
    })
    if (couponReservation) {
      await attachStripeSessionToCouponReservation(adminClient, couponReservation.redemption_id, session.id)
    }
  } catch (err) {
    if (session?.id) {
      await stripe.checkout.sessions.expire(session.id).catch((expireErr) => {
        console.error('[orders/checkout] failed to expire checkout session after coupon error:', (expireErr as Error).message)
      })
    }
    await releaseCouponReservation(adminClient, couponReservation?.redemption_id).catch((releaseErr) => {
      console.error('[orders/checkout] failed to release coupon reservation:', (releaseErr as Error).message)
    })
    throw err
  }
  if (!session) throw createError({ statusCode: 500, message: 'Unable to create checkout session' })

  // Freeze the design at session creation. The webhook reads this immutable
  // snapshot by stripe_session_id instead of the mutable maps row. If freezing
  // fails, fail closed and expire the open Stripe session; physical orders have
  // no legacy proof-render fallback.
  if (!digital_only) {
    try {
      await freezeOrderSnapshot(supabase, {
        stripeSessionId: session.id,
        mapId: map_id,
        productUid: product_uid,
        userId: user.id,
      })
    } catch (err) {
      console.error('[orders/checkout] snapshot freeze failed:', (err as Error).message)
      await stripe.checkout.sessions.expire(session.id).catch((expireErr) => {
        console.error(
          '[orders/checkout] failed to expire checkout session after snapshot error:',
          (expireErr as Error).message,
        )
      })
      await releaseCouponReservation(adminClient, couponReservation?.redemption_id).catch((releaseErr) => {
        console.error('[orders/checkout] failed to release coupon reservation after snapshot error:', (releaseErr as Error).message)
      })
      throw createError({
        statusCode: 500,
        message: 'Unable to prepare print checkout. Please try again.',
      })
    }
  }

  return { url: session.url, session_id: session.id }
})
