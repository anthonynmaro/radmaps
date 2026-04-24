/**
 * POST /api/shop/checkout
 *
 * Creates a Stripe Checkout session for a PREMADE map purchase. Supports both:
 *   • Guests — `user_id` is null, `guest_email` is required.
 *   • Logged-in users — inferred from the Supabase session.
 *
 * The order row itself is not created here — that happens in the
 * Stripe webhook (`/api/orders/webhook`) on `checkout.session.completed`,
 * where we read the session metadata populated below.
 */
import Stripe from 'stripe'
import { z } from 'zod'
import { serverSupabaseUser } from '#supabase/server'
import { getProduct } from '~/utils/products'
import { getPremadeBySlug } from '~/data/premade-maps'

const ShopCheckoutBody = z.object({
  slug: z.string().min(1),
  product_uid: z.string(),        // Gelato productUid (or 'digital')
  print_size: z.string(),
  quantity: z.number().int().min(1).max(10).default(1),
  shipping_address: z.object({
    name: z.string().min(1),
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state_code: z.string().length(2),
    country_code: z.string().length(2),
    zip: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  digital_only: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = ShopCheckoutBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const { slug, product_uid, print_size, quantity, shipping_address, digital_only } = parsed.data
  const config = useRuntimeConfig()

  // Resolve premade from the static catalog
  const premade = getPremadeBySlug(slug)
  if (!premade) {
    throw createError({ statusCode: 404, message: 'Premade map not found' })
  }

  // Resolve pricing
  const product = digital_only ? null : getProduct(product_uid)
  const DIGITAL_PRICE = 999 // $9.99
  const unitPrice = digital_only ? DIGITAL_PRICE : product?.price_cents ?? 0
  if (!unitPrice) {
    throw createError({ statusCode: 400, message: 'Invalid product UID' })
  }
  const totalCents = unitPrice * quantity

  // Attach logged-in user if present (guests are allowed)
  let user_id: string | null = null
  try {
    const user = await serverSupabaseUser(event)
    if (user) user_id = user.id
  } catch {
    // not logged in — that's fine for the shop flow
  }

  const stripe = new Stripe(config.stripeSecretKey)
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://radmaps.studio'
      : 'http://localhost:3001'

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
              ? `${premade.title} — Digital Download`
              : `${premade.title} — ${product?.name ?? print_size}`,
            description: premade.subtitle,
            images: premade.preview_image_url ? [premade.preview_image_url] : [],
          },
          unit_amount: unitPrice,
        },
        quantity,
      },
    ],
    metadata: {
      // `kind` lets the webhook distinguish premade vs custom orders.
      kind: 'premade',
      premade_slug: premade.slug,
      premade_title: premade.title,
      user_id: user_id ?? '',
      guest_email: user_id ? '' : shipping_address.email,
      product_uid: digital_only ? 'digital' : product_uid,
      print_size: digital_only ? 'digital' : print_size,
      quantity: String(quantity),
      shipping_address: JSON.stringify(shipping_address),
      digital_only: String(digital_only),
    },
    shipping_address_collection: digital_only
      ? undefined
      : {
          allowed_countries: [
            'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO',
            'ES', 'IT', 'IE', 'DK', 'FI', 'NZ', 'JP',
          ],
        },
    success_url: `${baseUrl}/shop/${premade.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/shop/${premade.slug}`,
  })

  return {
    url: session.url,
    session_id: session.id,
    total_cents: totalCents,
  }
})
