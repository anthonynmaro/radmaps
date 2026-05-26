import { createHash, createHmac, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { Pool } from 'pg'
import Stripe from 'stripe'

import { PRODUCTS } from '~/utils/products'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { getPrintFraming } from '~/utils/print/printFraming'
import {
  computeChromeHash,
  computeMapContentHash,
  computePrintHash,
  computeProofRenderHash,
} from '~/utils/render/hash'
import { HASH_VERSION } from '~/utils/render/hashVersion'

function readEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    out[match[1]] = match[2].trim().replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '')
  }
  return out
}

function requireEnv(env: Record<string, string>, key: string): string {
  const value = env[key]
  if (!value) throw new Error(`Missing ${key}`)
  return value
}

function argValue(name: string): string | null {
  const prefix = `${name}=`
  const arg = process.argv.slice(2).find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

function normalizeShippingAddress(input: {
  name: string
  email: string
  phone?: string
  address1: string
  address2?: string
  city: string
  state_code: string
  zip: string
  country_code: string
}) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: (input.phone || '').trim(),
    address1: input.address1.trim(),
    address2: (input.address2 || '').trim(),
    city: input.city.trim(),
    state_code: input.state_code.trim().toUpperCase(),
    zip: input.zip.trim(),
    country_code: input.country_code.trim().toUpperCase(),
  }
}

function shippingAddressHash(address: ReturnType<typeof normalizeShippingAddress>): string {
  return createHash('sha256')
    .update(JSON.stringify({
      name: address.name.toLowerCase(),
      address1: address.address1.toLowerCase(),
      address2: address.address2.toLowerCase(),
      city: address.city.toLowerCase(),
      state_code: address.state_code.toLowerCase(),
      country_code: address.country_code.toLowerCase(),
      zip: address.zip.toLowerCase(),
      email: address.email.toLowerCase(),
      phone: address.phone.replace(/\D/g, ''),
    }))
    .digest('hex')
}

const env = { ...readEnv('.env'), ...readEnv('../.env') }
const mapId = argValue('--map-id')
if (!mapId) {
  console.error('Usage: npm run stripe:webhook-sim -- --map-id=<uuid> [--product-uid=<uid>]')
  process.exit(1)
}

const productUid = argValue('--product-uid')
  ?? 'flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver'
const product = PRODUCTS.find(item => item.product_uid === productUid)
if (!product) throw new Error(`Unknown product UID: ${productUid}`)
const stripe = new Stripe(requireEnv(env, 'STRIPE_SECRET_KEY'), {
  apiVersion: '2026-04-22.dahlia',
  maxNetworkRetries: 2,
})

const pool = new Pool({
  connectionString: requireEnv(env, 'DATABASE_URL'),
  max: 1,
  ssl: { rejectUnauthorized: false },
})

const client = await pool.connect()
try {
  const mapRes = await client.query(
    `SELECT id, user_id, title, style_config, geojson, stats, bbox,
            proof_render_url, render_url
       FROM maps
      WHERE id = $1
      LIMIT 1`,
    [mapId],
  )
  const map = mapRes.rows[0]
  if (!map) throw new Error(`Map not found: ${mapId}`)
  if (!map.user_id) throw new Error('Map has no user_id; simulation needs an authenticated custom map.')

  const proofRenderUrl = map.proof_render_url ?? map.render_url
  if (!proofRenderUrl) {
    throw new Error('Map has no proof_render_url/render_url. Render a proof first.')
  }

  const providerProfile = getProviderProfile(productUid)
  const framing = getPrintFraming(productUid, 'final')
  const mapContentHash = computeMapContentHash(map.style_config, map.geojson, framing)
  const chromeHash = computeChromeHash(map.style_config, map.stats)
  const proofRenderHash = computeProofRenderHash(mapContentHash, chromeHash)
  const printHash = computePrintHash({
    mapContentHash,
    chromeHash,
    productUid,
    dpi: framing.dpi,
    bleedMm: providerProfile.bleedMm,
  })
  const stripeSessionId = `cs_test_webhook_${Date.now()}_${randomUUID().slice(0, 8)}`

  await client.query(
    `INSERT INTO order_snapshots (
        stripe_session_id, order_id, user_id, map_id, product_uid,
        style_config, geojson, stats, bbox, proof_render_hash,
        proof_render_url, map_content_hash, chrome_hash, hash_version,
        provider_profile
      )
      VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      stripeSessionId,
      map.user_id,
      map.id,
      productUid,
      map.style_config,
      map.geojson,
      map.stats,
      map.bbox,
      proofRenderHash,
      proofRenderUrl,
      mapContentHash,
      chromeHash,
      HASH_VERSION,
      providerProfile,
    ],
  )

  const shippingAddress = {
    name: env.STRIPE_SIM_SHIP_NAME ?? 'RadMaps Stripe Webhook Test',
    email: env.STRIPE_SIM_SHIP_EMAIL ?? 'anthony+stripe-webhook@radmaps.studio',
    phone: env.STRIPE_SIM_SHIP_PHONE ?? '3125550100',
    address1: env.STRIPE_SIM_SHIP_ADDRESS1 ?? '123 Main St',
    address2: env.STRIPE_SIM_SHIP_ADDRESS2 ?? '',
    city: env.STRIPE_SIM_SHIP_CITY ?? 'Chicago',
    state_code: env.STRIPE_SIM_SHIP_STATE ?? 'IL',
    zip: env.STRIPE_SIM_SHIP_ZIP ?? '60601',
    country_code: env.STRIPE_SIM_SHIP_COUNTRY ?? 'US',
  }
  const normalizedAddress = normalizeShippingAddress(shippingAddress)
  const addressHash = shippingAddressHash(normalizedAddress)
  const shippingCents = Number(env.STRIPE_SIM_SHIPPING_CENTS ?? '649')
  const amountTotal = product.price_cents + shippingCents

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountTotal,
    currency: 'usd',
    payment_method: 'pm_card_visa',
    payment_method_types: ['card'],
    confirm: true,
    metadata: {
      radmaps_smoke_test: 'stripe-webhook-sim',
      map_id: map.id,
      product_uid: productUid,
    },
  }, {
    idempotencyKey: `radmaps-webhook-sim:${stripeSessionId}`,
  })

  const attemptRes = await client.query(
    `INSERT INTO checkout_attempts (
       cart_source, user_id, map_id, product_uid, print_size, quantity,
       shipping_address, address_hash, stripe_session_id, status
     )
     VALUES ('custom',$1,$2,$3,$4,1,$5,$6,$7,'session_created')
     RETURNING id`,
    [
      map.user_id,
      map.id,
      productUid,
      product.size_label,
      normalizedAddress,
      addressHash,
      stripeSessionId,
    ],
  )
  const checkoutAttemptId = attemptRes.rows[0].id as string

  const quoteRes = await client.query(
    `INSERT INTO shipping_quotes (
       checkout_attempt_id, cart_source, user_id, map_id, product_uid, quantity,
       shipping_address, address_hash, shipment_method_uid, shipment_method_name,
       amount_cents, currency, status
     )
     VALUES ($1,'custom',$2,$3,$4,1,$5,$6,$7,$8,$9,'usd','used')
     RETURNING id`,
    [
      checkoutAttemptId,
      map.user_id,
      map.id,
      productUid,
      normalizedAddress,
      addressHash,
      env.STRIPE_SIM_SHIPMENT_METHOD_UID ?? 'usps_ground_advantage',
      env.STRIPE_SIM_SHIPMENT_METHOD_NAME ?? 'USPS Ground Advantage',
      shippingCents,
    ],
  )
  const quoteId = quoteRes.rows[0].id as string
  await client.query(`UPDATE checkout_attempts SET quote_id = $1 WHERE id = $2`, [quoteId, checkoutAttemptId])

  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}_${randomUUID().slice(0, 8)}`,
    object: 'event',
    api_version: '2026-03-25.dahlia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
    data: {
      object: {
        id: stripeSessionId,
        object: 'checkout.session',
        amount_subtotal: product.price_cents,
        amount_total: amountTotal,
        total_details: {
          amount_discount: 0,
          amount_shipping: shippingCents,
          amount_tax: 0,
        },
        currency: 'usd',
        payment_intent: paymentIntent.id,
        payment_status: 'paid',
        metadata: {
          cart_source: 'custom',
          checkout_attempt_id: checkoutAttemptId,
          quote_id: quoteId,
          user_id: map.user_id,
          map_id: map.id,
          map_title: map.title ?? 'RadMaps Print',
          product_uid: productUid,
          print_size: product.size_label,
          quantity: '1',
          digital_only: 'false',
          address_hash: addressHash,
        },
        customer_details: {
          name: normalizedAddress.name,
          email: normalizedAddress.email,
          phone: normalizedAddress.phone,
          address: {
            line1: normalizedAddress.address1,
            line2: normalizedAddress.address2,
            city: normalizedAddress.city,
            state: normalizedAddress.state_code,
            postal_code: normalizedAddress.zip,
            country: normalizedAddress.country_code,
          },
        },
      },
    },
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', requireEnv(env, 'STRIPE_WEBHOOK_SECRET'))
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const webhookUrl = new URL('/api/orders/webhook', env.LOCAL_APP_URL ?? 'http://localhost:3001')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  })
  const body = await res.text()
  const orderRes = await client.query(
    `SELECT id, status, fulfillment_status, payment_status, stripe_pi_id,
            shipping_quote_id, shipment_method_uid, amount_shipping_cents
       FROM orders
      WHERE stripe_session_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [stripeSessionId],
  )
  const jobRes = await client.query(
    `SELECT id, status, print_hash
       FROM print_render_jobs
      WHERE stripe_session_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [stripeSessionId],
  )
  console.log(JSON.stringify({
    httpStatus: res.status,
    body,
    stripeSessionId,
    paymentIntentId: paymentIntent.id,
    checkoutAttemptId,
    quoteId,
    printHash,
    order: orderRes.rows[0] ?? null,
    printJob: jobRes.rows[0] ?? null,
  }, null, 2))
} finally {
  client.release()
  await pool.end()
}
