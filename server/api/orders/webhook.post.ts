import type Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getProduct } from '~/utils/products'
import { computePrintHash } from '~/utils/render/hash'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'
import { getStripeClient } from '~/server/utils/stripe'
import { normalizeShippingAddress, recordOrderEvent, shippingAddressHash, type CheckoutShippingAddress } from '~/server/utils/checkoutHardened'
import { paidCheckoutIntegrityIssues } from '~/server/utils/checkoutIntegrity'
import { pricingDbColumns, pricingFromMetadata, pricingFromRecord } from '~/server/utils/gelatoPricing'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = getStripeClient(config)

  const rawBody = await readRawBody(event)
  const signature = getHeader(event, 'stripe-signature')
  if (!rawBody || !signature) {
    throw createError({ statusCode: 400, message: 'Missing body or signature' })
  }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret)
  } catch (err) {
    throw createError({ statusCode: 400, message: `Webhook signature error: ${(err as Error).message}` })
  }

  const supabase = createClient(config.public.supabaseUrl as string, config.supabaseServiceKey as string) as any
  const resend = new Resend(config.resendApiKey)

  await supabase.from('stripe_events').upsert({
    event_id: stripeEvent.id,
    event_type: stripeEvent.type,
    object_id: (stripeEvent.data.object as any)?.id ?? null,
    object_type: (stripeEvent.data.object as any)?.object ?? null,
    api_version: stripeEvent.api_version ?? null,
    livemode: stripeEvent.livemode,
    payload: stripeEvent as any,
    status: 'received',
  }, { onConflict: 'event_id', ignoreDuplicates: true })

  const { error: dedupError } = await supabase.from('processed_stripe_events').insert({ event_id: stripeEvent.id })
  if (dedupError) {
    if (dedupError.code === '23505') return { received: true, duplicate: true }
    throw createError({ statusCode: 500, message: 'Could not record Stripe event' })
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted({ stripe, supabase, resend, session: stripeEvent.data.object as Stripe.Checkout.Session })
        break
      case 'checkout.session.expired':
        await handleCheckoutExpired({ supabase, session: stripeEvent.data.object as Stripe.Checkout.Session })
        break
      case 'checkout.session.async_payment_succeeded':
        await recordGenericPaymentEvent({ supabase, session: stripeEvent.data.object as Stripe.Checkout.Session, status: 'succeeded' })
        break
      case 'checkout.session.async_payment_failed':
        await recordGenericPaymentEvent({ supabase, session: stripeEvent.data.object as Stripe.Checkout.Session, status: 'failed' })
        break
      case 'payment_intent.payment_failed':
        await handlePaymentFailed({ supabase, paymentIntent: stripeEvent.data.object as Stripe.PaymentIntent })
        break
      case 'charge.refunded':
      case 'refund.updated':
        await handleRefundEvent({ supabase, object: stripeEvent.data.object as any })
        break
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
        await handleDisputeEvent({ supabase, dispute: stripeEvent.data.object as Stripe.Dispute })
        break
      case 'review.opened':
      case 'review.closed':
      case 'radar.early_fraud_warning.created':
        await handleRiskEvent({ supabase, object: stripeEvent.data.object as any, eventType: stripeEvent.type })
        break
      default:
        await supabase.from('stripe_events').update({ status: 'ignored', processed_at: new Date().toISOString() }).eq('event_id', stripeEvent.id)
        return { received: true, ignored: true }
    }

    await supabase.from('stripe_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', stripeEvent.id)
    return { received: true }
  } catch (err) {
    await releaseProcessedStripeEvent(supabase, stripeEvent.id, err instanceof Error ? err.message : String(err))
    await supabase.from('stripe_events').update({
      status: 'failed',
      last_error: err instanceof Error ? err.message : String(err),
    }).eq('event_id', stripeEvent.id)
    throw err
  }
})

async function handleCheckoutCompleted(input: {
  stripe: Stripe
  supabase: any
  resend: Resend
  session: Stripe.Checkout.Session
}) {
  const { stripe, supabase, resend, session } = input
  const meta = session.metadata || {}
  const cartSource = meta.cart_source || meta.kind || (meta.premade_slug ? 'premade' : 'custom')
  const productUid = meta.product_uid || 'digital'
  const isDigital = productUid === 'digital' || meta.digital_only === 'true'
  const isPremade = cartSource === 'premade'
  const quantity = Math.max(1, parseInt(String(meta.quantity || '1'), 10) || 1)
  const catalogProduct = getProduct(isDigital ? 'digital' : productUid)

  const quote = meta.quote_id
    ? (await supabase.from('shipping_quotes').select('*').eq('id', meta.quote_id).maybeSingle()).data
    : null
  const checkoutAttempt = meta.checkout_attempt_id
    ? (await supabase
        .from('checkout_attempts')
        .select('pricing_snapshot_id, pricing_country_code, gelato_product_cost_cents, retail_unit_price_cents, pricing_markup_bps, pricing_rounding_rule, pricing_synced_at')
        .eq('id', meta.checkout_attempt_id)
        .maybeSingle()).data
    : null
  const lockedPricing = pricingFromRecord(checkoutAttempt, productUid)
    ?? pricingFromMetadata(meta as Record<string, string | undefined>, productUid)
  const shippingAddress = normalizeShippingAddress(resolveShippingAddress(session, meta, quote, isDigital))
  const addressHash = shippingAddressHash(shippingAddress)
  const expectedSubtotalCents = lockedPricing
    ? lockedPricing.retail_unit_price_cents * quantity
    : null
  const paymentIntent = typeof session.payment_intent === 'string'
    ? await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge', 'payment_method'] })
    : session.payment_intent as Stripe.PaymentIntent | null
  const charge = paymentIntent?.latest_charge && typeof paymentIntent.latest_charge !== 'string'
    ? paymentIntent.latest_charge as Stripe.Charge
    : null
  const paymentMethodType = charge?.payment_method_details?.type
  const receiptUrl = charge?.receipt_url || null

  const { data: snapshot, error: snapshotError } = await supabase
    .from('order_snapshots')
    .select('*')
    .eq('stripe_session_id', session.id)
    .maybeSingle()
  if (snapshotError) throw createError({ statusCode: 500, message: snapshotError.message })

  const premade = isPremade && meta.premade_slug
    ? await getPublishedPremadeBySlug(supabase, meta.premade_slug, {
        staticFallbackWhenNoPublished: process.env.NODE_ENV !== 'production',
      })
    : undefined

  const productTitle = isPremade
    ? premade?.title || meta.premade_title || 'RadMaps Print'
    : meta.map_title || 'RadMaps Print'

  const orderPayload: Record<string, unknown> = {
    stripe_pi_id: paymentIntent?.id || String(session.payment_intent || session.id),
    stripe_session_id: session.id,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    stripe_charge_id: charge?.id ?? null,
    payment_status: session.payment_status,
    payment_method_type: paymentMethodType ?? null,
    receipt_url: receiptUrl,
    ...(lockedPricing ? pricingDbColumns(lockedPricing) : {}),
    product_uid: productUid,
    print_size: isDigital ? 'digital' : (catalogProduct?.size_label ?? meta.print_size ?? null),
    quantity,
    shipping_address: shippingAddress,
    subtotal_cents: session.amount_subtotal ?? session.amount_total ?? 0,
    discount_cents: session.total_details?.amount_discount ?? 0,
    total_cents: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    amount_subtotal_cents: session.amount_subtotal ?? session.amount_total ?? 0,
    amount_shipping_cents: session.total_details?.amount_shipping ?? quote?.amount_cents ?? 0,
    amount_tax_cents: session.total_details?.amount_tax ?? 0,
    amount_discount_cents: session.total_details?.amount_discount ?? 0,
    amount_total_cents: session.amount_total ?? 0,
    shipping_quote_id: quote?.id ?? null,
    shipment_method_uid: quote?.shipment_method_uid ?? null,
    quote_expires_at: quote?.expires_at ?? null,
    refund_status: 'none',
    dispute_status: 'none',
    risk_level: charge?.outcome?.risk_level ?? null,
    status: session.payment_status === 'paid' ? 'paid' : 'pending',
    fulfillment_status: session.payment_status === 'paid' ? 'paid' : 'pending_payment',
    user_id: meta.user_id || null,
    guest_email: meta.guest_email || (!meta.user_id ? shippingAddress.email : null),
    map_id: isPremade ? null : (meta.map_id || null),
    coupon_id: meta.coupon_id || null,
    coupon_slug: meta.coupon_slug || null,
    active_stripe_session_id: snapshot ? session.id : null,
  }
  if (isPremade) {
    orderPayload.premade_slug = meta.premade_slug
    orderPayload.premade_title = meta.premade_title || premade?.title
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select()
    .single()
  let order = insertedOrder
  if (orderError) {
    if (orderError.code !== '23505') {
      throw createError({ statusCode: 500, message: orderError.message })
    }
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select()
      .eq('stripe_session_id', session.id)
      .maybeSingle()
    if (existingOrderError) throw createError({ statusCode: 500, message: existingOrderError.message })
    if (!existingOrder) throw createError({ statusCode: 409, message: 'Stripe session already processed but order could not be loaded' })
    order = existingOrder
  }

  await supabase.from('checkout_attempts').update({ status: 'completed' }).eq('stripe_session_id', session.id)
  if (quote) await supabase.from('shipping_quotes').update({ status: 'used' }).eq('id', quote.id)

  await recordPaymentAttempt(supabase, {
    order,
    session,
    paymentIntent,
    charge,
    status: session.payment_status,
  })
  await markCouponRedeemed(supabase, meta, order.id, session)

  if (snapshot) {
    await supabase.from('order_snapshots').update({ order_id: order.id }).eq('stripe_session_id', session.id)
  }

  if (session.payment_status !== 'paid') {
    await recordOrderEvent(supabase, { orderId: order.id, eventType: 'payment_pending', actorType: 'stripe', metadata: { session_id: session.id } })
    return
  }

  const checkoutIntegrityIssues = paidCheckoutIntegrityIssues({
    isDigital,
    hasCatalogProduct: !!catalogProduct,
    hasLockedPricing: !!lockedPricing,
    requirePricingSnapshot: process.env.NODE_ENV === 'production',
    hasPricingSnapshot: !!lockedPricing?.pricing_snapshot_id,
    expectedSubtotalCents,
    paidSubtotalCents: session.amount_subtotal ?? 0,
    paidShippingCents: session.total_details?.amount_shipping ?? null,
    quoteId: meta.quote_id,
    checkoutAttemptId: meta.checkout_attempt_id,
    quote,
    productUid,
    quantity,
    addressHash,
    cartSource,
  })

  if (checkoutIntegrityIssues.length) {
    await supabase.from('orders').update({
      status: 'manual_review',
      fulfillment_status: 'quote_mismatch',
    }).eq('id', order.id)
    await recordOrderEvent(supabase, {
      orderId: order.id,
      eventType: 'checkout_integrity_mismatch',
      actorType: 'system',
      message: 'Paid order held because the locked checkout data did not match the paid cart.',
      metadata: { issues: checkoutIntegrityIssues, quote_id: meta.quote_id, address_hash: addressHash },
    })
    await sendConfirmation(resend, shippingAddress.email, order, productTitle, undefined, isDigital, !meta.user_id)
    return
  }

  if (!isPremade && !isDigital) {
    if (!snapshot) {
      await supabase.from('orders').update({ status: 'manual_review', fulfillment_status: 'snapshot_missing' }).eq('id', order.id)
      await recordOrderEvent(supabase, { orderId: order.id, eventType: 'snapshot_missing', actorType: 'system' })
      await sendConfirmation(resend, shippingAddress.email, order, productTitle, undefined, false, !meta.user_id)
      return
    }
    await enqueuePrintRender(supabase, order.id, session.id, productUid, snapshot)
    await sendConfirmation(resend, shippingAddress.email, order, productTitle, undefined, false, !meta.user_id)
    return
  }

  if (isPremade && !isDigital) {
    if (!premade?.render_url) {
      await supabase.from('orders').update({ status: 'manual_review', fulfillment_status: 'failed' }).eq('id', order.id)
      await recordOrderEvent(supabase, { orderId: order.id, eventType: 'premade_render_missing', actorType: 'system' })
    } else {
      await supabase.from('orders').update({
        print_file_url: premade.render_url,
        fulfillment_status: 'print_ready',
      }).eq('id', order.id)
      await enqueuePremadeFulfillment(supabase, order.id, session.id)
      await recordOrderEvent(supabase, { orderId: order.id, eventType: 'fulfillment_queued', actorType: 'system' })
    }
    await sendConfirmation(resend, shippingAddress.email, order, productTitle, undefined, false, !meta.user_id)
    return
  }

  const digitalUrl = await resolveDigitalUrl(supabase, meta, premade)
  await supabase.from('orders').update({
    digital_url: digitalUrl,
    status: 'delivered',
    fulfillment_status: 'paid',
  }).eq('id', order.id)
  await sendConfirmation(resend, shippingAddress.email, order, productTitle, digitalUrl, true, !meta.user_id)
}

async function enqueuePremadeFulfillment(supabase: any, orderId: string, stripeSessionId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('fulfillment_jobs')
    .select('id')
    .eq('order_id', orderId)
    .eq('job_type', 'gelato_submit')
    .limit(1)
  if (existingError) throw createError({ statusCode: 500, message: existingError.message })
  if (existing?.length) return

  const { error } = await supabase.from('fulfillment_jobs').insert({
    order_id: orderId,
    job_type: 'gelato_submit',
    metadata: { source: 'stripe_webhook', stripe_session_id: stripeSessionId },
  })
  if (error) throw createError({ statusCode: 500, message: error.message })
}

function resolveShippingAddress(
  session: Stripe.Checkout.Session,
  meta: Stripe.Metadata | null,
  quote: any,
  isDigital = false,
): CheckoutShippingAddress {
  if (quote?.shipping_address) return quote.shipping_address
  if (meta?.shipping_address) return JSON.parse(meta.shipping_address)
  const details = session.customer_details
  if (isDigital) {
    return {
      name: details?.name || 'Digital Customer',
      address1: '-',
      address2: '',
      city: '-',
      state_code: '--',
      country_code: 'US',
      zip: '-',
      email: details?.email || 'support@radmaps.studio',
      phone: details?.phone || '',
    }
  }
  const addr = details?.address
  if (addr) {
    return {
      name: details.name || 'Customer',
      address1: addr.line1 || '',
      address2: addr.line2 || '',
      city: addr.city || '',
      state_code: addr.state || '',
      country_code: addr.country || 'US',
      zip: addr.postal_code || '',
      email: details.email || 'support@radmaps.studio',
      phone: details.phone || '',
    }
  }
  throw createError({ statusCode: 422, message: 'Checkout session is missing shipping address' })
}

async function enqueuePrintRender(supabase: any, orderId: string, stripeSessionId: string, productUid: string, snapshot: any) {
  const printHash = computePrintHash({
    mapContentHash: snapshot.map_content_hash,
    chromeHash: snapshot.chrome_hash,
    productUid,
    dpi: snapshot.provider_profile?.maxDpi ?? 300,
    bleedMm: snapshot.provider_profile?.bleedMm ?? 3,
  })
  const { error } = await supabase.from('print_render_jobs').upsert({
    stripe_session_id: stripeSessionId,
    print_hash: printHash,
    status: 'queued',
  }, { onConflict: 'stripe_session_id,print_hash', ignoreDuplicates: true })
  if (error) {
    await supabase.from('orders').update({ status: 'fulfillment_failed', fulfillment_status: 'render_queue_failed' }).eq('id', orderId)
    throw createError({ statusCode: 500, message: error.message })
  }
  await supabase.from('orders').update({ fulfillment_status: 'rendering_print' }).eq('id', orderId)
  await recordOrderEvent(supabase, { orderId, eventType: 'print_render_queued', actorType: 'system', metadata: { print_hash: printHash } })
}

async function resolveDigitalUrl(supabase: any, meta: Stripe.Metadata, premade: any): Promise<string | undefined> {
  if (premade) return premade.render_url ?? premade.preview_image_url ?? undefined
  if (!meta.map_id) return undefined
  const { data: map } = await supabase.from('maps').select('render_url').eq('id', meta.map_id).maybeSingle()
  const filePath = map?.render_url?.split('/storage/v1/object/public/maps/')[1]
  if (!filePath) return map?.render_url
  const { data } = await supabase.storage.from('maps').createSignedUrl(filePath, 60 * 60 * 48)
  return data?.signedUrl
}

async function handleCheckoutExpired(input: { supabase: any; session: Stripe.Checkout.Session }) {
  const { supabase, session } = input
  const meta = session.metadata || {}
  await supabase.from('checkout_attempts').update({ status: 'expired' }).eq('stripe_session_id', session.id)
  if (meta.quote_id) {
    await supabase.from('shipping_quotes').update({ status: 'expired' }).eq('id', meta.quote_id)
  }
  const query = supabase
    .from('coupon_redemptions')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('status', 'reserved')
  if (meta.coupon_redemption_id) await query.eq('id', meta.coupon_redemption_id)
  else await query.eq('stripe_session_id', session.id)
}

async function recordGenericPaymentEvent(input: { supabase: any; session: Stripe.Checkout.Session; status: string }) {
  const { supabase, session, status } = input
  await supabase.from('payment_attempts').insert({
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    status,
    raw_payment: session as any,
  })
}

async function handlePaymentFailed(input: { supabase: any; paymentIntent: Stripe.PaymentIntent }) {
  const { supabase, paymentIntent } = input
  await supabase.from('payment_attempts').insert({
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: paymentIntent.amount ?? 0,
    currency: paymentIntent.currency ?? 'usd',
    status: 'failed',
    failure_code: paymentIntent.last_payment_error?.code ?? null,
    failure_message: paymentIntent.last_payment_error?.message ?? null,
    payment_method_type: paymentIntent.last_payment_error?.payment_method?.type ?? null,
    raw_payment: paymentIntent as any,
  })
  await supabase.from('orders').update({
    status: 'failed',
    fulfillment_status: 'failed',
    payment_status: 'failed',
  }).eq('stripe_pi_id', paymentIntent.id)
}

async function handleRefundEvent(input: { supabase: any; object: Stripe.Refund | Stripe.Charge }) {
  const { supabase, object } = input
  const refund = (object.object === 'refund' ? object : null) as Stripe.Refund | null
  const charge = (object.object === 'charge' ? object : null) as Stripe.Charge | null
  const chargeId = refund?.charge && typeof refund.charge === 'string' ? refund.charge : charge?.id
  if (!chargeId) return
  const { data: order } = await supabase.from('orders').select('id, amount_total_cents, amount_refunded_cents').eq('stripe_charge_id', chargeId).maybeSingle()
  if (!order) return
  const amount = refund?.amount ?? charge?.amount_refunded ?? 0
  if (refund) {
    await supabase.from('order_refunds').upsert({
      order_id: order.id,
      stripe_refund_id: refund.id,
      amount_cents: amount,
      currency: refund.currency ?? 'usd',
      reason: refund.reason ?? null,
      status: refund.status ?? 'pending',
      raw_refund: refund as any,
    }, { onConflict: 'stripe_refund_id' })
  }
  const refundedTotal = charge?.amount_refunded ?? Math.max(Number(order.amount_refunded_cents || 0), amount)
  const full = refundedTotal >= Number(order.amount_total_cents || 0)
  await supabase.from('orders').update({
    amount_refunded_cents: refundedTotal,
    refund_status: full ? 'full' : 'partial',
    status: full ? 'refunded' : 'partially_refunded',
  }).eq('id', order.id)
  await recordOrderEvent(supabase, { orderId: order.id, eventType: full ? 'refund_full' : 'refund_partial', actorType: 'stripe', metadata: { amount_cents: amount } })
}

async function handleDisputeEvent(input: { supabase: any; dispute: Stripe.Dispute }) {
  const { supabase, dispute } = input
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
  const { data: order } = chargeId
    ? await supabase.from('orders').select('id').eq('stripe_charge_id', chargeId).maybeSingle()
    : { data: null }
  await supabase.from('order_disputes').upsert({
    order_id: order?.id ?? null,
    stripe_dispute_id: dispute.id,
    amount_cents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
    evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    raw_dispute: dispute as any,
  }, { onConflict: 'stripe_dispute_id' })
  if (order?.id) {
    await supabase.from('orders').update({
      dispute_status: dispute.status === 'won' || dispute.status === 'lost' ? dispute.status : 'needs_response',
      fulfillment_status: dispute.status === 'needs_response' ? 'manual_review' : undefined,
    }).eq('id', order.id)
    await recordOrderEvent(supabase, { orderId: order.id, eventType: `dispute_${dispute.status}`, actorType: 'stripe', metadata: { dispute_id: dispute.id } })
  }
}

async function handleRiskEvent(input: { supabase: any; object: any; eventType: string }) {
  const { supabase, object, eventType } = input
  const paymentIntentId = object.payment_intent || object.payment_intent_id
  const chargeId = object.charge || object.charge_id
  const query = supabase.from('orders').select('id')
  const { data: order } = chargeId
    ? await query.eq('stripe_charge_id', chargeId).maybeSingle()
    : paymentIntentId
      ? await query.eq('stripe_pi_id', paymentIntentId).maybeSingle()
      : { data: null }
  if (!order?.id) return
  await supabase.from('orders').update({
    risk_level: eventType,
    status: 'manual_review',
    fulfillment_status: 'fraud_review',
  }).eq('id', order.id)
  await recordOrderEvent(supabase, { orderId: order.id, eventType, actorType: 'stripe', message: 'Stripe risk signal requires review.' })
}

async function recordPaymentAttempt(supabase: any, input: {
  order: any
  session: Stripe.Checkout.Session
  paymentIntent: Stripe.PaymentIntent | null
  charge: Stripe.Charge | null
  status: string
}) {
  await supabase.from('payment_attempts').insert({
    order_id: input.order.id,
    checkout_attempt_id: input.session.metadata?.checkout_attempt_id || null,
    user_id: input.order.user_id,
    guest_email: input.order.guest_email,
    stripe_session_id: input.session.id,
    stripe_payment_intent_id: input.paymentIntent?.id ?? null,
    stripe_charge_id: input.charge?.id ?? null,
    amount_cents: input.session.amount_total ?? 0,
    currency: input.session.currency ?? 'usd',
    status: input.status,
    payment_method_type: input.charge?.payment_method_details?.type ?? null,
    raw_payment: input.paymentIntent || input.session,
  })
}

async function markCouponRedeemed(supabase: any, meta: Stripe.Metadata, orderId: string, session: Stripe.Checkout.Session) {
  if (!meta.coupon_redemption_id) return
  await supabase.from('coupon_redemptions').update({
    order_id: orderId,
    stripe_session_id: session.id,
    status: 'redeemed',
    redeemed_at: new Date().toISOString(),
    subtotal_cents: session.amount_subtotal ?? session.amount_total ?? 0,
    discount_cents: session.total_details?.amount_discount ?? 0,
  }).eq('id', meta.coupon_redemption_id).eq('status', 'reserved')
}

async function releaseProcessedStripeEvent(supabase: any, eventId: string, reason: string) {
  const { error } = await supabase.from('processed_stripe_events').delete().eq('event_id', eventId)
  if (error) console.error('[stripe/webhook] Failed to release event marker:', { eventId, reason, error })
}

async function sendConfirmation(
  resend: Resend,
  to: string,
  order: Record<string, unknown>,
  productTitle: string,
  digitalUrl: string | undefined,
  isDigital: boolean,
  isGuest: boolean,
) {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
    to,
    subject: 'Your RadMaps order is confirmed',
    html: buildConfirmationEmail({ order, productTitle, digitalUrl, isDigital, isGuest }),
  })
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}

function buildConfirmationEmail({
  order,
  productTitle,
  digitalUrl,
  isDigital,
  isGuest,
}: {
  order: Record<string, unknown>
  productTitle: string
  digitalUrl?: string
  isDigital: boolean
  isGuest: boolean
}) {
  const productInfo = getProduct(String(order.product_uid))
  const productName = productInfo ? productInfo.name : 'Print'
  const safeProductTitle = escapeHtml(productTitle)
  const safeProductName = escapeHtml(productName)
  const safeOrderId = escapeHtml(order.id)
  const safeDigitalUrl = escapeHtml(digitalUrl)

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #2D6A4F;">Your order is confirmed</h1>
      <p>Thanks for ordering <strong>${safeProductTitle}</strong> from RadMaps.</p>
      <div style="background:#F7F4EF;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">Order details</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#1C1917;">${safeProductName}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999;">Order ID: ${safeOrderId}</p>
      </div>
      ${isDigital
        ? `<p>Your digital download is ready:</p>
           <p><a href="${safeDigitalUrl}" style="background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Download Your Map</a></p>`
        : `<p>Your map is being prepared for printing. You will receive tracking details once it ships.</p>`
      }
      ${isGuest ? `<p style="margin-top:24px;padding:16px;background:#F7F4EF;border-radius:8px;font-size:14px;">Create a free account to design your own custom trail poster next time.</p>` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#999;">
        <a href="https://radmaps.studio/support" style="color:#2D6A4F;">Track your order</a> &nbsp;|&nbsp;
        <a href="mailto:support@radmaps.studio" style="color:#2D6A4F;">Get help</a>
      </p>
    </div>
  `
}
