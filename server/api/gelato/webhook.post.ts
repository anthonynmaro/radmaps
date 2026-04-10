/**
 * POST /api/gelato/webhook
 * Gelato webhook handler — receives fulfilment status events.
 * Configure at: https://dashboard.gelato.com/settings/webhooks
 *
 * Gelato sends a signed JWT Bearer token in the Authorization header.
 * Verify it with the webhook secret from your Gelato dashboard.
 *
 * Relevant events:
 *   order_status_updated — fires whenever an order changes status
 *     fulfillmentStatus values: created | passed | failed | cancelled |
 *       printed | shipped | draft | pending_approval | not_connected | partially_shipped
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { Resend } from 'resend'

// Gelato webhook payload shape (simplified)
interface GelatoWebhookPayload {
  id: string
  event: string
  order: {
    id: string                    // Gelato order ID
    orderReferenceId: string      // Our internal order UUID
    fulfillmentStatus: string
    shipments?: Array<{
      trackingCode?: string
      trackingUrl?: string
      carrierCode?: string
      carrierName?: string
    }>
  }
}

// Map Gelato fulfillmentStatus → our OrderStatus
const GELATO_STATUS_MAP: Record<string, string> = {
  created:             'in_production',
  passed:              'in_production',
  printed:             'in_production',
  shipped:             'shipped',
  partially_shipped:   'shipped',
  delivered:           'delivered',
  failed:              'failed',
  cancelled:           'cancelled',
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const rawBody = await readRawBody(event)
  const authHeader = getHeader(event, 'authorization')

  if (!rawBody) {
    throw createError({ statusCode: 400, message: 'Missing request body' })
  }

  // Gelato signs webhooks with HMAC-SHA256 of the raw body using the webhook secret.
  // The signature is sent as a Bearer token in the Authorization header.
  if (authHeader && config.gelatoWebhookSecret) {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const expectedSig = createHmac('sha256', config.gelatoWebhookSecret)
      .update(rawBody)
      .digest('hex')

    try {
      if (!timingSafeEqual(Buffer.from(token), Buffer.from(expectedSig))) {
        throw new Error('Signature mismatch')
      }
    } catch {
      throw createError({ statusCode: 401, message: 'Invalid Gelato webhook signature' })
    }
  }

  const body = JSON.parse(rawBody) as GelatoWebhookPayload

  if (body.event !== 'order_status_updated') {
    // Acknowledge but ignore unhandled events
    return { received: true }
  }

  const { order } = body
  const newStatus = GELATO_STATUS_MAP[order.fulfillmentStatus]

  if (!newStatus) {
    // Unknown fulfillmentStatus — acknowledge and ignore
    return { received: true }
  }

  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)
  const resend = new Resend(config.resendApiKey)

  // Look up our order by Gelato's order ID
  const { data: dbOrder } = await supabase
    .from('orders')
    .select('id, user_id, map_id, shipping_address, status')
    .eq('gelato_order_id', order.id)
    .single()

  if (!dbOrder) {
    console.warn(`Gelato webhook: no order found for Gelato ID ${order.id}`)
    return { received: true }
  }

  // Build update payload
  const updates: Record<string, string | null> = { status: newStatus }

  const firstShipment = order.shipments?.[0]
  if (firstShipment?.trackingCode) {
    updates.tracking_code = firstShipment.trackingCode
  }
  if (firstShipment?.carrierName) {
    updates.carrier = firstShipment.carrierName
  }

  await supabase.from('orders').update(updates).eq('id', dbOrder.id)

  // Send shipping notification email when order ships
  if (order.fulfillmentStatus === 'shipped' || order.fulfillmentStatus === 'partially_shipped') {
    const address = dbOrder.shipping_address as Record<string, string>
    const trackingUrl = firstShipment?.trackingUrl

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@trailmaps.com',
      to: address.email,
      subject: 'Your TrailMaps print is on its way! 📦',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2D6A4F;">Your map is on its way! 🗺️</h1>
          <p>Great news — your TrailMaps print has shipped and is heading to you.</p>
          ${trackingUrl
            ? `<p><a href="${trackingUrl}" style="background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Track Your Shipment</a></p>`
            : firstShipment?.trackingCode
              ? `<p>Tracking code: <strong>${firstShipment.trackingCode}</strong> via ${firstShipment.carrierName ?? 'carrier'}</p>`
              : ''
          }
          <p style="color:#666;font-size:14px;">Typical delivery is 3–7 business days after dispatch.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;">Order ID: <code>${dbOrder.id}</code></p>
        </div>
      `,
    })
  }

  // Send delivery notification email
  if (order.fulfillmentStatus === 'delivered') {
    const address = dbOrder.shipping_address as Record<string, string>
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@trailmaps.com',
      to: address.email,
      subject: 'Your TrailMaps print has been delivered! 📬',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2D6A4F;">Your map has arrived! 🗺️</h1>
          <p>Your TrailMaps print has been delivered. We hope you love it on the wall!</p>
          <p>Want to order another size or share a map with someone?
             <a href="https://trailmaps.com/dashboard">Visit your dashboard</a>.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;">Order ID: <code>${dbOrder.id}</code></p>
        </div>
      `,
    })
  }

  return { received: true }
})
