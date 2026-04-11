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

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const meta = session.metadata!
    const shippingAddress = JSON.parse(meta.shipping_address)
    const productUid = meta.product_uid       // Gelato productUid (or 'digital')
    const printSize = meta.print_size
    const isDigital = productUid === 'digital'

    // Create the Order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: meta.user_id,
        map_id: meta.map_id,
        stripe_pi_id: session.payment_intent as string,
        product_uid: productUid,
        print_size: printSize,
        quantity: parseInt(meta.quantity),
        shipping_address: shippingAddress,
        total_cents: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'paid',
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('Failed to create order:', orderError)
      throw createError({ statusCode: 500, message: 'Order creation failed' })
    }

    let gelatoOrderId: string | undefined

    if (!isDigital) {
      // Place Gelato print order
      gelatoOrderId = await placeGelatoOrder({
        order,
        shippingAddress,
        mapId: meta.map_id,
        productUid,
        supabase,
        gelatoApiKey: config.gelatoApiKey,
      })
    }

    // Generate digital download URL (signed, 48hr expiry)
    const { data: map } = await supabase
      .from('maps')
      .select('render_url, title, pdf_url')
      .eq('id', meta.map_id)
      .single()

    let digitalUrl: string | undefined
    if (map?.render_url) {
      const filePath = map.render_url.split('/storage/v1/object/public/maps/')[1]
      const { data: signedData } = await supabase.storage
        .from('maps')
        .createSignedUrl(filePath, 60 * 60 * 48)
      digitalUrl = signedData?.signedUrl
    }

    // Update order with Gelato ID and digital URL
    await supabase.from('orders').update({
      gelato_order_id: gelatoOrderId,
      digital_url: digitalUrl,
      status: isDigital ? 'delivered' : 'in_production',
    }).eq('id', order.id)

    // Send confirmation email
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
      to: shippingAddress.email,
      subject: `Your RadMaps order is confirmed! 🗺️`,
      html: buildConfirmationEmail({ order, map, digitalUrl, isDigital }),
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
  mapId,
  productUid,
  supabase,
  gelatoApiKey,
}: {
  order: Record<string, unknown>
  shippingAddress: Record<string, string>
  mapId: string
  productUid: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  gelatoApiKey: string
}): Promise<string> {
  const { data: map } = await supabase
    .from('maps')
    .select('render_url, title')
    .eq('id', mapId)
    .single()

  if (!map?.render_url) {
    throw createError({ statusCode: 422, message: 'Map render not yet available. Please render the map before ordering.' })
  }

  const product = getProduct(productUid)
  if (!product) throw createError({ statusCode: 400, message: 'Invalid product UID' })

  // Gelato requires the print file to be a publicly accessible URL
  const printFileUrl = map.render_url

  // Split name into first/last for Gelato's address schema
  const nameParts = (shippingAddress.name ?? '').split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') || firstName

  const gelatoOrder = {
    orderReferenceId: String(order.id),
    customerReferenceId: String(order.user_id),
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
  map,
  digitalUrl,
  isDigital,
}: {
  order: Record<string, unknown>
  map: Record<string, unknown> | null
  digitalUrl?: string
  isDigital: boolean
}) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h1 style="color: #2D6A4F;">Your order is confirmed! 🗺️</h1>
      <p>Thanks for ordering from RadMaps.</p>
      ${isDigital
        ? `<p>Your <strong>digital download</strong> is ready:</p>
           <p><a href="${digitalUrl}" style="background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Download Your Map</a></p>
           <p><em>This link expires in 48 hours. Save the files to your device.</em></p>`
        : `<p>Your map is being printed and shipped by Gelato. Estimated delivery is 5–10 business days depending on your location.</p>
           <p>You'll receive a shipping notification with tracking details once your order is dispatched.</p>
           ${digitalUrl ? `<p>Your digital copy is also ready: <a href="${digitalUrl}">Download</a></p>` : ''}`
      }
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#999;">Order ID: <code>${order.id}</code> &nbsp;|&nbsp; RadMaps &mdash; Beautiful maps from your trails.</p>
    </div>
  `
}
