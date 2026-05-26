import { Resend } from 'resend'
import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { recordOrderEvent } from '~/server/utils/checkoutHardened'
import { requireOrderSupportActionsFlag } from '~/server/utils/orderSupport'
import { getProduct } from '~/utils/products'

const Body = z.object({
  email: z.string().email().optional(),
  note: z.string().trim().max(1000).optional(),
})

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}

export default defineEventHandler(async (event) => {
  const staff = await requireStaff(event, 'support:write')
  await requireOrderSupportActionsFlag(event, staff)
  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, message: 'Order id is required' })
  const parsed = Body.safeParse(await readBody(event).catch(() => ({})))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const config = useRuntimeConfig()
  const supabase = await serverSupabaseServiceRole(event)
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, guest_email, shipping_address, product_uid, print_size, premade_title, status, tracking_code, carrier, digital_url')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!order) throw createError({ statusCode: 404, message: 'Order not found' })

  const shippingEmail = typeof order.shipping_address?.email === 'string' ? order.shipping_address.email : ''
  const to = parsed.data.email || order.guest_email || shippingEmail
  if (!to) throw createError({ statusCode: 409, message: 'Order has no email address.' })

  const product = getProduct(String(order.product_uid))
  const productName = order.premade_title || product?.name || order.print_size || 'RadMaps order'
  const resend = new Resend(config.resendApiKey)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'orders@radmaps.studio',
    to,
    subject: 'Your RadMaps order details',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="color:#2D6A4F;">Your RadMaps order</h1>
        <p>Here are the latest details for <strong>${escapeHtml(productName)}</strong>.</p>
        <div style="background:#F7F4EF;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 6px;font-size:13px;color:#666;">Order ID</p>
          <p style="margin:0;font-size:14px;font-weight:600;">${escapeHtml(order.id)}</p>
          <p style="margin:12px 0 6px;font-size:13px;color:#666;">Status</p>
          <p style="margin:0;font-size:14px;font-weight:600;">${escapeHtml(order.status)}</p>
          ${order.tracking_code ? `<p style="margin:12px 0 0;font-size:13px;color:#666;">Tracking: ${escapeHtml(order.carrier)} ${escapeHtml(order.tracking_code)}</p>` : ''}
        </div>
        ${order.digital_url ? `<p><a href="${escapeHtml(order.digital_url)}" style="background:#2D6A4F;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Download your map</a></p>` : ''}
        <p style="font-size:12px;color:#777;">Questions? Reply to this email or contact support@radmaps.studio.</p>
      </div>
    `,
  })

  await recordOrderEvent(supabase, {
    orderId,
    eventType: 'support_email_resent',
    actorType: 'staff',
    actorId: staff.user!.id,
    message: parsed.data.note,
    metadata: { email: to },
  })

  return { ok: true, email: to }
})
