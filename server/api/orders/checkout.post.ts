/**
 * POST /api/orders/checkout
 * Create a Stripe Checkout session for a map order.
 * Returns { url } — redirect the user to this URL.
 */
import Stripe from 'stripe'
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getProduct, formatPrice } from '~/utils/products'

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
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const parsed = CheckoutBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { map_id, product_uid, print_size, quantity, shipping_address, digital_only } = parsed.data

  const config = useRuntimeConfig()
  const supabase = await serverSupabaseClient(event)

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

  const totalCents = unitPrice * quantity
  const stripe = new Stripe(config.stripeSecretKey)
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://radmaps.studio'
    : 'http://localhost:3001'

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: shipping_address.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: digital_only
              ? `${map.title} — Digital Download`
              : `${map.title} — ${product?.name ?? print_size}`,
            images: map.render_url ? [map.render_url] : [],
          },
          unit_amount: unitPrice,
        },
        quantity,
      },
    ],
    metadata: {
      user_id: user.id,
      map_id,
      product_uid: digital_only ? 'digital' : product_uid,
      print_size: digital_only ? 'digital' : print_size,
      quantity: String(quantity),
      shipping_address: JSON.stringify(shipping_address),
      digital_only: String(digital_only),
    },
    shipping_address_collection: digital_only
      ? undefined
      : { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO'] },
    success_url: `${baseUrl}/create/${map_id}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/create/${map_id}/checkout`,
  })

  return { url: session.url, session_id: session.id }
})
