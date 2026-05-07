/**
 * POST /api/orders/webhook
 * Stripe webhook handler — raw body required (no JSON parsing).
 * Handles: checkout.session.completed, checkout.session.expired, payment_intent.payment_failed
 *
 * On payment success:
 *   1. Create Order record in Supabase
 *   2. Queue custom print renders, or place premade/digital orders
 *   3. Generate signed digital download URL when needed
 *   4. Send confirmation email via Resend
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getProduct } from '~/utils/products'
import { computePrintHash } from '~/utils/render/hash'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey)

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

  // Use service key to bypass RLS for webhook operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(config.public.supabaseUrl as string, config.supabaseServiceKey as string) as any
  const resend = new Resend(config.resendApiKey)

  // Idempotency guard — Stripe retries webhooks on transient failures.
  // Record each event_id so duplicate deliveries are no-ops.
  const { error: dedupError } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: stripeEvent.id })
  if (dedupError) {
    if (dedupError.code === '23505') {
      // Duplicate key — already processed, acknowledge and return.
      return { received: true }
    }
    // Unexpected DB error — surface it so Stripe retries later.
    console.error('[stripe/webhook] Failed to record event dedup:', dedupError)
    throw createError({ statusCode: 500, message: 'Internal error' })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const meta = session.metadata!
    const shippingAddress = JSON.parse(meta.shipping_address)
    const productUid = meta.product_uid       // Gelato productUid (or 'digital')
    const printSize = meta.print_size
    const isDigital = productUid === 'digital'
    const isPremade = meta.kind === 'premade'
    const subtotalCents = session.amount_subtotal ?? session.amount_total ?? 0
    const discountCents = session.total_details?.amount_discount ?? 0

    // Immutable design snapshot frozen at checkout. For custom physical
    // orders this is required; final print renders never re-read the live map.
    const { data: snapshot } = await supabase
      .from('order_snapshots')
      .select('*')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    const shouldQueueFinalRender = !!snapshot && !isPremade && !isDigital

    let premade: Awaited<ReturnType<typeof getPublishedPremadeBySlug>> = undefined
    if (isPremade && meta.premade_slug) {
      premade = await getPublishedPremadeBySlug(supabase, meta.premade_slug)
    }

    // Build the order row. Keep custom print orders compatible with older
    // production schemas that have not yet applied the guest/premade columns.
    // Premade/guest checkout still requires the guest-orders migration.
    const orderPayload: Record<string, unknown> = {
      stripe_pi_id: session.payment_intent as string,
      product_uid: productUid,
      print_size: printSize,
      quantity: parseInt(meta.quantity),
      shipping_address: shippingAddress,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      total_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'paid',
      user_id: meta.user_id || null,
      map_id: isPremade ? null : (meta.map_id || null),
      coupon_id: meta.coupon_id || null,
      coupon_slug: meta.coupon_slug || null,
    }

    if (meta.guest_email) orderPayload.guest_email = meta.guest_email
    if (isPremade) {
      orderPayload.premade_slug = meta.premade_slug
      orderPayload.premade_title = meta.premade_title
    }

    if (snapshot) {
      orderPayload.active_stripe_session_id = session.id
      orderPayload.fulfillment_status = shouldQueueFinalRender ? 'rendering_print' : 'paid'
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderError || !order) {
      console.error('Failed to create order:', orderError)
      throw createError({ statusCode: 500, message: 'Order creation failed' })
    }

    if (meta.coupon_redemption_id) {
      const { error: redemptionError } = await supabase
        .from('coupon_redemptions')
        .update({
          order_id: order.id,
          stripe_session_id: session.id,
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          subtotal_cents: subtotalCents,
          discount_cents: discountCents,
        })
        .eq('id', meta.coupon_redemption_id)
        .eq('status', 'reserved')
      if (redemptionError) {
        console.error('[stripe/webhook] Failed to mark coupon redemption:', redemptionError)
      }
    }

    // v4: link the snapshot to the newly-created order.  This is the
    // ONE allowed mutation of order_snapshots after freeze — and it
    // only writes order_id, never the design fields.
    if (snapshot) {
      const { error: linkError } = await supabase
        .from('order_snapshots')
        .update({ order_id: order.id })
        .eq('stripe_session_id', session.id)
      if (linkError) {
        console.error('[stripe/webhook] Failed to link snapshot.order_id:', linkError)
        // Non-fatal — snapshot is still queryable by stripe_session_id.
      }
    }

    // Custom physical orders must go through the final print queue. The old
    // fallback of sending map.render_url directly to Gelato is intentionally
    // gone: map.render_url is a proof, not the final print artifact.
    if (shouldQueueFinalRender && snapshot) {
      const printHash = computePrintHash({
        mapContentHash: snapshot.map_content_hash,
        chromeHash: snapshot.chrome_hash,
        productUid,
        dpi: snapshot.provider_profile?.maxDpi ?? 300,
        bleedMm: snapshot.provider_profile?.bleedMm ?? 3,
      })
      const { error: jobError } = await supabase
        .from('print_render_jobs')
        .upsert(
          {
            stripe_session_id: session.id,
            print_hash: printHash,
            status: 'queued',
          },
          { onConflict: 'stripe_session_id,print_hash', ignoreDuplicates: true },
        )
      if (jobError) {
        console.error('[stripe/webhook] Failed to enqueue print_render_jobs:', jobError)
        await supabase.from('orders').update({
          fulfillment_status: 'render_queue_failed',
          status: 'fulfillment_failed',
        }).eq('id', order.id)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
          to: shippingAddress.email,
          subject: `Your RadMaps order is confirmed! 🗺️`,
          html: buildConfirmationEmail({
            order,
            productTitle: meta.map_title || 'RadMaps Print',
            digitalUrl: undefined,
            isDigital: false,
            isGuest: !meta.user_id,
          }),
        })
        return { received: true, queued: false, error: 'render_queue_failed' }
      } else {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
          to: shippingAddress.email,
          subject: `Your RadMaps order is confirmed! 🗺️`,
          html: buildConfirmationEmail({
            order,
            productTitle: meta.map_title || 'RadMaps Print',
            digitalUrl: undefined,
            isDigital: false,
            isGuest: !meta.user_id,
          }),
        })
        return { received: true, queued: true }
      }
    }

    if (!isPremade && !isDigital && !snapshot) {
      console.error('[stripe/webhook] Missing order snapshot for custom print order:', {
        stripe_session_id: session.id,
        map_id: meta.map_id,
      })
      await supabase.from('orders').update({
        fulfillment_status: 'snapshot_missing',
        status: 'fulfillment_failed',
      }).eq('id', order.id)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
        to: shippingAddress.email,
        subject: `Your RadMaps order is confirmed! 🗺️`,
        html: buildConfirmationEmail({
          order,
          productTitle: meta.map_title || 'RadMaps Print',
          digitalUrl: undefined,
          isDigital: false,
          isGuest: !meta.user_id,
        }),
      })
      return { received: true, queued: false, error: 'snapshot_missing' }
    }

    // Resolve the print file URL.
    //   Custom: map.render_url
    //   Premade: premade.render_url (pre-generated, stored in catalog)
    let printFileUrl: string | undefined
    let digitalUrl: string | undefined
    let productTitle = 'RadMaps Print'

    if (isPremade && premade) {
      printFileUrl = premade.render_url
      productTitle = premade.title
      // For digital downloads on premade, use the public preview as the
      // delivery URL (replace with a signed storage URL in production).
      if (isDigital) digitalUrl = premade.render_url ?? premade.preview_image_url
    } else if (meta.map_id) {
      const { data: map } = await supabase
        .from('maps')
        .select('render_url, title, pdf_url')
        .eq('id', meta.map_id)
        .single()
      if (map?.render_url) {
        printFileUrl = map.render_url
        productTitle = map.title
        // Create a 48h signed URL for the digital download
        const filePath = map.render_url.split('/storage/v1/object/public/maps/')[1]
        if (filePath) {
          const { data: signedData } = await supabase.storage
            .from('maps')
            .createSignedUrl(filePath, 60 * 60 * 48)
          digitalUrl = signedData?.signedUrl
        }
      }
    }

    let gelatoOrderId: string | undefined
    let finalStatus: string
    if (isDigital) {
      finalStatus = 'delivered'
    } else {
      try {
        gelatoOrderId = await placeGelatoOrder({
          order,
          shippingAddress,
          printFileUrl,
          productUid,
          gelatoApiKey: config.gelatoApiKey,
          orderType: config.gelatoOrderType as 'order' | 'draft',
        })
        finalStatus = 'in_production'
      } catch (err) {
        console.error('[stripe/webhook] Gelato order placement failed:', (err as Error).message)
        // Mark the order so ops can see it needs manual fulfillment.
        // The customer's payment was captured — the print just wasn't queued.
        finalStatus = 'fulfillment_failed'
      }
    }

    await supabase.from('orders').update({
      gelato_order_id: gelatoOrderId ?? null,
      digital_url: digitalUrl,
      status: finalStatus,
    }).eq('id', order.id)

    // Send confirmation email (guest or user — always have an email)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
      to: shippingAddress.email,
      subject: `Your RadMaps order is confirmed! 🗺️`,
      html: buildConfirmationEmail({ order, productTitle, digitalUrl, isDigital, isGuest: !meta.user_id }),
    })
  }

  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    const query = supabase
      .from('coupon_redemptions')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('status', 'reserved')

    const { error } = meta.coupon_redemption_id
      ? await query.eq('id', meta.coupon_redemption_id)
      : await query.eq('stripe_session_id', session.id)

    if (error) {
      console.error('[stripe/webhook] Failed to release expired coupon reservation:', error)
    }
  }

  if (stripeEvent.type === 'payment_intent.payment_failed') {
    const pi = stripeEvent.data.object as Stripe.PaymentIntent
    await supabase.from('orders').update({ status: 'failed' }).eq('stripe_pi_id', pi.id)
  }

  return { received: true }
})

// ─── Gelato: Place print order ────────────────────────────────────────────────

async function placeGelatoOrder({
  order,
  shippingAddress,
  printFileUrl,
  productUid,
  gelatoApiKey,
  orderType = 'order',
}: {
  order: Record<string, unknown>
  shippingAddress: Record<string, string>
  printFileUrl: string | undefined
  productUid: string
  gelatoApiKey: string
  orderType?: 'order' | 'draft'
}): Promise<string> {
  if (!printFileUrl) {
    throw createError({ statusCode: 422, message: 'Print file URL is not available for this order.' })
  }

  const product = getProduct(productUid)
  if (!product) throw createError({ statusCode: 400, message: 'Invalid product UID' })

  // Split name into first/last for Gelato's address schema
  const nameParts = (shippingAddress.name ?? '').split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') || firstName

  const gelatoOrder = {
    orderType,
    orderReferenceId: String(order.id),
    customerReferenceId: String(order.user_id ?? order.guest_email ?? order.id),
    currency: 'USD',
    items: [
      {
        itemReferenceId: 'item-1',
        productUid,
        files: [
          {
            type: 'default',
            url: printFileUrl,
          },
        ],
        quantity: Number(order.quantity) ?? 1,
      },
    ],
    shipmentMethodUid: 'standard',
    shippingAddress: {
      firstName,
      lastName,
      addressLine1: shippingAddress.address1,
      addressLine2: shippingAddress.address2 ?? '',
      city: shippingAddress.city,
      state: shippingAddress.state_code,
      postCode: shippingAddress.zip,
      country: shippingAddress.country_code ?? 'US',
      email: shippingAddress.email,
      phone: shippingAddress.phone ?? '',
    },
  }

  const response = await $fetch<{ id: string }>('https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    headers: {
      'X-API-KEY': gelatoApiKey,
      'Content-Type': 'application/json',
    },
    body: gelatoOrder,
  })

  return response.id
}

// ─── Email template ───────────────────────────────────────────────────────────

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

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #2D6A4F;">Your order is confirmed! 🗺️</h1>
      <p>Thanks for ordering <strong>${productTitle}</strong> from RadMaps.</p>

      <div style="background:#F7F4EF;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">Order details</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#1C1917;">${productName}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999;">Order ID: ${order.id}</p>
      </div>

      ${isDigital
        ? `<p>Your <strong>digital download</strong> is ready:</p>
           <p><a href="${digitalUrl}" style="background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Download Your Map</a></p>
           <p><em>This link expires in 48 hours. Save the files to your device.</em></p>`
        : `<p>Your map is being printed and shipped by our global print partner. Estimated delivery is 5–10 business days depending on your location.</p>
           <p>You'll receive a shipping notification with tracking details once your order is dispatched.</p>
           ${digitalUrl ? `<p>Your digital copy is also ready: <a href="${digitalUrl}" style="color:#2D6A4F;font-weight:600;">Download</a></p>` : ''}`
      }

      ${isGuest ? `<p style="margin-top:24px;padding:16px;background:#F7F4EF;border-radius:8px;font-size:14px;">Want to design your own custom trail poster next time? <a href="https://radmaps.studio/auth/login" style="color:#2D6A4F;font-weight:600;">Create a free account</a> to bring in routes from Strava, your watch, or any trail app.</p>` : ''}

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#999;">
        <a href="https://radmaps.studio/support" style="color:#2D6A4F;">Track your order</a> &nbsp;|&nbsp;
        <a href="mailto:support@radmaps.studio" style="color:#2D6A4F;">Get help</a> &nbsp;|&nbsp;
        RadMaps &mdash; Beautiful maps from your trails.
      </p>
    </div>
  `
}
