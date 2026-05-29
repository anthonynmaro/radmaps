import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'
import { attachStripeSessionToCouponReservation, releaseCouponReservation, reserveCouponForCheckout } from '~/server/utils/coupons'
import { freezeOrderSnapshot } from '~/server/utils/snapshot'
import { getStripeClient, stripeMetadata } from '~/server/utils/stripe'
import {
  CheckoutShippingAddress,
  canonicalPrintSize,
  checkoutAttemptMismatchReasons,
  currentOptionalUser,
  normalizeShippingAddress,
  productOrThrow,
  shippingAddressHash,
  stripeCustomerAddress,
} from '~/server/utils/checkoutHardened'
import {
  GELATO_PRICING_DEFAULT_COUNTRY,
  pricingDbColumns,
  pricingFromRecord,
  pricingMetadata,
  resolveProductPricing,
  type ResolvedProductPricing,
} from '~/server/utils/gelatoPricing'
import { assertRateLimit } from '~/server/utils/rateLimit'

const Body = z.object({
  cart_source: z.enum(['custom', 'premade']),
  checkout_attempt_id: z.string().uuid().optional(),
  quote_id: z.string().uuid().nullable().optional(),
  map_id: z.string().uuid().optional(),
  premade_slug: z.string().min(1).optional(),
  product_uid: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
  shipping_address: CheckoutShippingAddress,
  digital_only: z.boolean().default(false),
  coupon_slug: z.string().max(80).optional(),
})

function baseUrl(config: ReturnType<typeof useRuntimeConfig>) {
  const configuredSiteUrl = typeof config.public.siteUrl === 'string' ? config.public.siteUrl : ''
  return configuredSiteUrl || (process.env.NODE_ENV === 'production' ? 'https://radmaps.studio' : 'http://localhost:3001')
}

export default defineEventHandler(async (event) => {
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const address = normalizeShippingAddress(body.shipping_address)
  assertRateLimit(event, { key: 'checkout-session', limit: 20, windowMs: 15 * 60_000, userId: address.email })

  const config = useRuntimeConfig()
  const adminClient = await serverSupabaseServiceRole(event)
  const stripe = getStripeClient(config)
  const user = body.cart_source === 'custom'
    ? await serverSupabaseUser(event)
    : await currentOptionalUser(event)
  const product = productOrThrow(body.product_uid, body.digital_only)
  const isDigital = body.digital_only || product.type === 'digital'
  const quantity = body.quantity
  const addressHash = shippingAddressHash(address)
  const guestEmail = user?.id ? null : address.email

  let mapId: string | null = null
  let premadeSlug: string | null = null
  let title = product.name
  let previewImageUrl: string | undefined
  let quote: any = null
  let checkoutAttemptId = body.checkout_attempt_id || null
  let productPricing: ResolvedProductPricing | null = null

  if (body.cart_source === 'custom') {
    if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
    if (!body.map_id) throw createError({ statusCode: 400, message: 'map_id is required' })
    const supabase = await serverSupabaseClient(event)
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, user_id, status, title')
      .eq('id', body.map_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!map) throw createError({ statusCode: 404, message: 'Map not found' })
    if (!isDigital && map.status !== 'rendered') {
      throw createError({ statusCode: 422, message: 'Map must be rendered before ordering a print' })
    }
    mapId = body.map_id
    title = isDigital ? `${map.title} - Digital Download` : `${map.title} - ${product.name}`
  } else {
    if (!body.premade_slug) throw createError({ statusCode: 400, message: 'premade_slug is required' })
    const premade = await getPublishedPremadeBySlug(adminClient, body.premade_slug, {
      staticFallbackWhenNoPublished: process.env.NODE_ENV !== 'production',
    })
    if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })
    premadeSlug = premade.slug
    title = isDigital ? `${premade.title} - Digital Download` : `${premade.title} - ${product.name}`
    previewImageUrl = premade.preview_image_url || undefined
  }

  if (!isDigital) {
    if (!body.quote_id) throw createError({ statusCode: 400, message: 'Shipping quote is required' })
    const { data, error } = await adminClient
      .from('shipping_quotes')
      .select('*')
      .eq('id', body.quote_id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) throw createError({ statusCode: 404, message: 'Shipping quote not found' })
    if (data.status === 'expired' || data.status === 'failed' || new Date(data.expires_at).getTime() <= Date.now()) {
      throw createError({ statusCode: 409, message: 'Shipping quote expired. Please refresh shipping.' })
    }
    if (data.status === 'used' && body.checkout_attempt_id !== data.checkout_attempt_id) {
      throw createError({ statusCode: 409, message: 'Shipping quote is already attached to another checkout session.' })
    }
    if (!['quoted', 'selected', 'used'].includes(String(data.status))) {
      throw createError({ statusCode: 409, message: 'Shipping quote is not available.' })
    }
    if (body.checkout_attempt_id && data.checkout_attempt_id !== body.checkout_attempt_id) {
      throw createError({ statusCode: 409, message: 'Shipping quote does not match this checkout attempt.' })
    }
    if (
      data.product_uid !== product.product_uid
      || Number(data.quantity) !== quantity
      || data.address_hash !== addressHash
      || data.cart_source !== body.cart_source
      || data.map_id !== mapId
      || data.premade_slug !== premadeSlug
      || (body.cart_source === 'custom' && data.user_id !== user?.id)
      || (body.cart_source === 'premade' && user?.id && data.user_id !== user.id)
      || (body.cart_source === 'premade' && !user?.id && data.guest_email !== address.email)
    ) {
      throw createError({ statusCode: 409, message: 'Shipping quote no longer matches this cart.' })
    }
    quote = data
    checkoutAttemptId = checkoutAttemptId || data.checkout_attempt_id
  }

  if (checkoutAttemptId) {
    const { data: attempt, error: attemptError } = await adminClient
      .from('checkout_attempts')
      .select('cart_source, user_id, guest_email, map_id, premade_slug, product_uid, quantity, address_hash, quote_id, status, pricing_snapshot_id, pricing_country_code, gelato_product_cost_cents, retail_unit_price_cents, pricing_markup_bps, pricing_rounding_rule, pricing_synced_at')
      .eq('id', checkoutAttemptId)
      .maybeSingle()
    if (attemptError) throw createError({ statusCode: 500, message: attemptError.message })
    const mismatches = checkoutAttemptMismatchReasons(attempt, {
      cartSource: body.cart_source,
      userId: user?.id ?? null,
      guestEmail,
      mapId,
      premadeSlug,
      productUid: product.product_uid,
      quantity,
      addressHash,
      quoteId: quote?.id ?? null,
    })
    if (mismatches.length) {
      throw createError({
        statusCode: 409,
        message: 'Checkout attempt no longer matches this cart. Please refresh the quote.',
      })
    }
    productPricing = pricingFromRecord(attempt, product.product_uid)
    if (productPricing && !isDigital && productPricing.country_code !== address.country_code) {
      throw createError({ statusCode: 409, message: 'Locked product price no longer matches this shipping address.' })
    }
  }

  if (!productPricing) {
    productPricing = await resolveProductPricing(adminClient, {
      productUid: product.product_uid,
      countryCode: isDigital ? GELATO_PRICING_DEFAULT_COUNTRY : address.country_code,
    })
  }

  const subtotalCents = productPricing.retail_unit_price_cents * quantity

  if (!checkoutAttemptId) {
    const { data: attempt, error: attemptError } = await adminClient
      .from('checkout_attempts')
      .insert({
        cart_source: body.cart_source,
        user_id: user?.id ?? null,
        guest_email: guestEmail,
        map_id: mapId,
        premade_slug: premadeSlug,
        product_uid: product.product_uid,
        print_size: canonicalPrintSize(product, isDigital),
        quantity,
        shipping_address: address,
        address_hash: addressHash,
        quote_id: quote?.id || null,
        ...pricingDbColumns(productPricing),
        status: 'started',
      })
      .select('id')
      .single()
    if (attemptError || !attempt) {
      throw createError({ statusCode: 500, message: attemptError?.message || 'Could not create checkout attempt' })
    }
    checkoutAttemptId = attempt.id
  }

  const couponReservation = body.coupon_slug
    ? await reserveCouponForCheckout(adminClient, {
        slug: body.coupon_slug,
        buyerEmail: address.email,
        cartSource: body.cart_source,
        productUid: isDigital ? 'digital' : product.product_uid,
        subtotalCents,
        mapId,
        premadeSlug,
      })
    : null

  let stripeCustomerId: string | undefined
  try {
    if (user?.id) {
      const { data: profile } = await adminClient.from('profiles').select('stripe_customer_id, email').eq('id', user.id).maybeSingle()
      if (profile?.stripe_customer_id) {
        const customer = await stripe.customers.update(profile.stripe_customer_id, {
          email: address.email,
          name: address.name,
          phone: address.phone || undefined,
          shipping: isDigital ? undefined : {
            name: address.name,
            phone: address.phone || undefined,
            address: stripeCustomerAddress(address),
          },
          metadata: stripeMetadata({ user_id: user.id }),
        })
        stripeCustomerId = customer.id
      } else {
        const customer = await stripe.customers.create({
          email: address.email,
          name: address.name,
          phone: address.phone || undefined,
          shipping: isDigital ? undefined : {
            name: address.name,
            phone: address.phone || undefined,
            address: stripeCustomerAddress(address),
          },
          metadata: stripeMetadata({ user_id: user.id }),
        })
        stripeCustomerId = customer.id
        await adminClient.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id)
      }
    } else {
      const customer = await stripe.customers.create({
        email: address.email,
        name: address.name,
        phone: address.phone || undefined,
        shipping: isDigital ? undefined : {
          name: address.name,
          phone: address.phone || undefined,
          address: stripeCustomerAddress(address),
        },
        metadata: stripeMetadata({ guest_email: address.email, cart_source: body.cart_source }),
      })
      stripeCustomerId = customer.id
    }

    const origin = baseUrl(config)
    const successUrl = body.cart_source === 'custom'
      ? `${origin}/create/${mapId}/success?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/shop/${premadeSlug}/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = body.cart_source === 'custom'
      ? `${origin}/create/${mapId}/checkout`
      : `${origin}/shop/${premadeSlug}/checkout`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: productPricing.retail_unit_price_cents,
          product_data: {
            name: title,
            images: previewImageUrl ? [previewImageUrl] : undefined,
          },
        },
        quantity,
      }],
      discounts: couponReservation ? [{ coupon: couponReservation.stripe_coupon_id }] : undefined,
      automatic_tax: { enabled: !isDigital },
      shipping_options: quote
        ? [{
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: Number(quote.amount_cents), currency: String(quote.currency || 'usd') },
              display_name: quote.shipment_method_name || 'Standard shipping',
            },
          }]
        : undefined,
      metadata: stripeMetadata({
        cart_source: body.cart_source,
        checkout_attempt_id: checkoutAttemptId,
        quote_id: quote?.id,
        map_id: mapId,
        premade_slug: premadeSlug,
        product_uid: isDigital ? 'digital' : product.product_uid,
        print_size: canonicalPrintSize(product, isDigital),
        quantity,
        digital_only: isDigital,
        address_hash: addressHash,
        coupon_id: couponReservation?.coupon_id,
        coupon_slug: couponReservation?.slug,
        coupon_redemption_id: couponReservation?.redemption_id,
        ...pricingMetadata(productPricing),
      }),
      success_url: successUrl,
      cancel_url: cancelUrl,
    }, {
      idempotencyKey: `checkout:${checkoutAttemptId}:${quote?.id || 'digital'}:${couponReservation?.redemption_id || 'none'}`,
    })

    if (couponReservation) {
      await attachStripeSessionToCouponReservation(adminClient, couponReservation.redemption_id, session.id)
    }

    await adminClient.from('checkout_attempts').update({
      quote_id: quote?.id || null,
      stripe_session_id: session.id,
      stripe_customer_id: stripeCustomerId || null,
      ...pricingDbColumns(productPricing),
      status: 'session_created',
    }).eq('id', checkoutAttemptId)
    if (quote) {
      await adminClient.from('shipping_quotes').update({ status: 'used' }).eq('id', quote.id)
    }

    if (body.cart_source === 'custom' && !isDigital && mapId) {
      try {
        await freezeOrderSnapshot(adminClient, {
          stripeSessionId: session.id,
          mapId,
          productUid: product.product_uid,
          userId: user!.id,
        })
      } catch (err) {
        await stripe.checkout.sessions.expire(session.id).catch(() => {})
        await releaseCouponReservation(adminClient, couponReservation?.redemption_id).catch(() => {})
        await adminClient.from('checkout_attempts').update({
          status: 'failed',
          error_message: `snapshot freeze failed: ${(err as Error).message}`,
        }).eq('id', checkoutAttemptId)
        throw createError({ statusCode: 500, message: 'Unable to prepare print checkout. Please try again.' })
      }
    }

    return { url: session.url, session_id: session.id }
  } catch (err) {
    await releaseCouponReservation(adminClient, couponReservation?.redemption_id).catch(() => {})
    if (checkoutAttemptId) {
      await adminClient.from('checkout_attempts').update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
      }).eq('id', checkoutAttemptId)
    }
    throw err
  }
})
