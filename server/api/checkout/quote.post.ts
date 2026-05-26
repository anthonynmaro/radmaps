import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'
import {
  CheckoutShippingAddress,
  currentOptionalUser,
  fetchGelatoShippingQuotes,
  normalizeShippingAddress,
  productOrThrow,
  shippingAddressHash,
  type CheckoutCartSource,
} from '~/server/utils/checkoutHardened'
import { assertRateLimit } from '~/server/utils/rateLimit'

const Body = z.object({
  cart_source: z.enum(['custom', 'premade']),
  map_id: z.string().uuid().optional(),
  premade_slug: z.string().min(1).optional(),
  product_uid: z.string().min(1),
  print_size: z.string().optional(),
  quantity: z.number().int().min(1).max(10).default(1),
  shipping_address: CheckoutShippingAddress,
  digital_only: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  assertRateLimit(event, { key: 'checkout-quote', limit: 40, windowMs: 15 * 60_000 })

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const config = useRuntimeConfig()
  const adminClient = await serverSupabaseServiceRole(event)
  const user = body.cart_source === 'custom'
    ? await serverSupabaseUser(event)
    : await currentOptionalUser(event)
  const product = productOrThrow(body.product_uid, body.digital_only)
  const address = normalizeShippingAddress(body.shipping_address)
  const addressHash = shippingAddressHash(address)

  let mapId: string | null = null
  let premadeSlug: string | null = null
  let guestEmail: string | null = user?.id ? null : address.email

  if (body.cart_source === 'custom') {
    if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })
    if (!body.map_id) throw createError({ statusCode: 400, message: 'map_id is required' })
    const supabase = await serverSupabaseClient(event)
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, status')
      .eq('id', body.map_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!map) throw createError({ statusCode: 404, message: 'Map not found' })
    if (!body.digital_only && map.status !== 'rendered') {
      throw createError({ statusCode: 422, message: 'Map must be rendered before quoting a print' })
    }
    mapId = body.map_id
    guestEmail = null
  } else {
    if (!body.premade_slug) throw createError({ statusCode: 400, message: 'premade_slug is required' })
    const premade = await getPublishedPremadeBySlug(adminClient, body.premade_slug, {
      staticFallbackWhenNoPublished: process.env.NODE_ENV !== 'production',
    })
    if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })
    premadeSlug = premade.slug
  }

  const { data: attempt, error: attemptError } = await adminClient
    .from('checkout_attempts')
    .insert({
      cart_source: body.cart_source satisfies CheckoutCartSource,
      user_id: user?.id ?? null,
      guest_email: guestEmail,
      map_id: mapId,
      premade_slug: premadeSlug,
      product_uid: product.product_uid,
      print_size: body.print_size || product.size_label,
      quantity: body.quantity,
      shipping_address: address,
      address_hash: addressHash,
      status: body.digital_only ? 'started' : 'quoted',
    })
    .select('id')
    .single()
  if (attemptError || !attempt) {
    throw createError({ statusCode: 500, message: attemptError?.message || 'Could not create checkout attempt' })
  }

  if (body.digital_only || product.type === 'digital') {
    return {
      checkout_attempt_id: attempt.id,
      quote_id: null,
      options: [],
      selected: null,
      expires_at: null,
    }
  }

  const options = await fetchGelatoShippingQuotes({
    gelatoApiKey: config.gelatoApiKey,
    orderType: config.gelatoOrderType as 'order' | 'draft',
    productUid: product.product_uid,
    quantity: body.quantity,
    currency: 'usd',
    shippingAddress: address,
  })

  const rows = options.map((option, index) => ({
    checkout_attempt_id: attempt.id,
    cart_source: body.cart_source,
    user_id: user?.id ?? null,
    guest_email: guestEmail,
    map_id: mapId,
    premade_slug: premadeSlug,
    product_uid: product.product_uid,
    quantity: body.quantity,
    shipping_address: address,
    address_hash: addressHash,
    shipment_method_uid: option.shipment_method_uid,
    shipment_method_name: option.shipment_method_name,
    amount_cents: option.amount_cents,
    currency: option.currency,
    min_delivery_date: option.min_delivery_date,
    max_delivery_date: option.max_delivery_date,
    raw_quote: option.raw_quote,
    status: index === 0 ? 'selected' : 'quoted',
  }))

  const { data: quotes, error: quoteError } = await adminClient
    .from('shipping_quotes')
    .insert(rows)
    .select('id, shipment_method_uid, shipment_method_name, amount_cents, currency, min_delivery_date, max_delivery_date, expires_at, status')
  if (quoteError || !quotes?.length) {
    await adminClient.from('checkout_attempts').update({ status: 'failed', error_message: quoteError?.message || 'Quote insert failed' }).eq('id', attempt.id)
    throw createError({ statusCode: 500, message: quoteError?.message || 'Could not save shipping quote' })
  }

  const selected = quotes.find((quote: any) => quote.status === 'selected') || quotes[0]
  await adminClient.from('checkout_attempts').update({ quote_id: selected.id }).eq('id', attempt.id)

  return {
    checkout_attempt_id: attempt.id,
    quote_id: selected.id,
    options: quotes,
    selected,
    expires_at: selected.expires_at,
  }
})
