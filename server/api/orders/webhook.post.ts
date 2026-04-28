/**
 * POST /api/orders/webhook
 * Stripe webhook handler — raw body required (no JSON parsing).
 * Handles: checkout.session.completed, payment_intent.payment_failed
 *
 * On payment success:
 *   1. Create Order record in Supabase
 *   2. Place print order via Gelato POST /v4/orders
 *   3. Generate signed digital download URL
 *   4. Send confirmation email via Resend
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getProduct } from '~/utils/products'

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

    // Import premade catalog lazily to keep custom-order hot path small
    let premade: Awaited<ReturnType<typeof import('~/data/premade-maps').getPremadeBySlug>> = undefined
    if (isPremade && meta.premade_slug) {
      const { getPremadeBySlug } = await import('~/data/premade-maps')
      premade = getPremadeBySlug(meta.premade_slug)
    }

    // Build the order row. For premade orders, `map_id` is null and
    // `premade_slug` / `premade_title` identify the product. For guests,
    // `user_id` is null and `guest_email` identifies the customer.
    const orderPayload: Record<string, unknown> = {
      stripe_pi_id: session.payment_intent as string,
      product_uid: productUid,
      print_size: printSize,
      quantity: parseInt(meta.quantity),
      shipping_address: shippingAddress,
      total_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'paid',
      user_id: meta.user_id || null,
      map_id: isPremade ? null : (meta.map_id || null),
      guest_email: meta.guest_email || null,
      premade_slug: isPremade ? meta.premade_slug : null,
      premade_title: isPremade ? meta.premade_title : null,
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
}: {
  order: Record<string, unknown>
  shippingAddress: Record<string, string>
  printFileUrl: string | undefined
  productUid: string
  gelatoApiKey: string
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
