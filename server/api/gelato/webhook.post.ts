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
import { timingSafeEqual } from 'crypto'
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

  // Gelato sends a static secret in the Authorization header (HTTP Header auth type).
  // The Header Name is "Authorization" and the value is the raw secret — no Bearer prefix.
  if (config.gelatoWebhookSecret) {
    if (!authHeader) {
      throw createError({ statusCode: 401, message: 'Missing Authorization header' })
    }
    try {
      const incoming = Buffer.from(authHeader)
      const expected = Buffer.from(config.gelatoWebhookSecret as string)
      if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
        throw new Error('Mismatch')
      }
    } catch {
      throw createError({ statusCode: 401, message: 'Invalid Gelato webhook secret' })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(config.public.supabaseUrl as string, config.supabaseServiceKey as string) as any
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
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
      to: address.email,
      subject: 'Your RadMaps print is on its way! 📦',
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #2D6A4F;">Your map is on its way! 🗺️</h1>
          <p>Great news — your RadMaps print has shipped and is heading to you.</p>
          ${trackingUrl
            ? `<p><a href="${trackingUrl}" style="background:#2D6A4F;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Track Your Shipment</a></p>`
            : firstShipment?.trackingCode
              ? `<p>Tracking code: <strong>${firstShipment.trackingCode}</strong> via ${firstShipment.carrierName ?? 'carrier'}</p>`
              : ''
          }
          <p style="color:#666;font-size:14px;">Typical delivery is 3–7 business days after dispatch.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;">
            Order ID: <code>${dbOrder.id}</code> &nbsp;|&nbsp;
            <a href="https://radmaps.studio/support" style="color:#2D6A4F;">Track order</a> &nbsp;|&nbsp;
            <a href="mailto:support@radmaps.studio" style="color:#2D6A4F;">Get help</a>
          </p>
        </div>
      `,
    })
  }

  // Send delivery notification email
  if (order.fulfillmentStatus === 'delivered') {
    const address = dbOrder.shipping_address as Record<string, string>
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
      to: address.email,
      subject: 'Your RadMaps print has been delivered! 📬',
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #2D6A4F;">Your map has arrived! 🗺️</h1>
          <p>Your RadMaps print has been delivered. We hope you love it on the wall!</p>
          <p>Want to order another size or share a map with someone?
             <a href="https://radmaps.studio/" style="color:#2D6A4F;font-weight:600;">Visit your studio</a>.</p>
          <div style="background:#F7F4EF;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;font-size:13px;color:#666;">Something not right? If your print arrived damaged, email us within 14 days at
              <a href="mailto:support@radmaps.studio" style="color:#2D6A4F;">support@radmaps.studio</a> with a photo and we'll send a free replacement.</p>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:12px;color:#999;">
            Order ID: <code>${dbOrder.id}</code> &nbsp;|&nbsp;
            <a href="https://radmaps.studio/support" style="color:#2D6A4F;">Support</a>
          </p>
        </div>
      `,
    })
  }

  return { received: true }
})
