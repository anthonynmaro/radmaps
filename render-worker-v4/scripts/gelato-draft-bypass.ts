import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

import type { PrintRenderJobRow } from '../src/queue/processJob.js'
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
    let value = match[2].trim()
    value = value.replace(/\s+#.*$/, '')
    value = value.replace(/^['"]|['"]$/g, '')
    out[match[1]] = value
  }
  return out
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function argValue(name: string): string | null {
  const prefix = `${name}=`
  const arg = process.argv.slice(2).find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

function fail(message: string): never {
  console.error(`error ${message}`)
  process.exit(1)
}

Object.assign(process.env, readEnv('../.env'), readEnv('.env'))
process.env.APP_URL ||= process.env.NUXT_PUBLIC_SITE_URL

if (process.env.GELATO_ORDER_TYPE !== 'draft') {
  fail('GELATO_ORDER_TYPE must be draft for this Stripe-bypass test.')
}

const mapId = argValue('--map-id')
if (!mapId) fail('Usage: npm run gelato:draft-bypass -- --map-id=<uuid> [--product-uid=<uid>]')

const productUid = argValue('--product-uid')
  ?? 'flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver'
const product = PRODUCTS.find(item => item.product_uid === productUid)
if (!product) fail(`Unknown product UID: ${productUid}`)

const databaseUrl = requireEnv('DATABASE_URL')
requireEnv('SUPABASE_URL')
requireEnv('SUPABASE_SERVICE_KEY')
requireEnv('BROWSERLESS_TOKEN')
requireEnv('RENDER_TICKET_SECRET')
requireEnv('GELATO_API_KEY')
requireEnv('APP_URL')

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  idleTimeoutMillis: 30_000,
  ssl: { rejectUnauthorized: false },
})

const { processJob } = await import('../src/queue/processJob.js')
const { shutdownDb } = await import('../src/db.js')

try {
  const client = await pool.connect()
  try {
    const mapRes = await client.query(
      `SELECT id, user_id, title, style_config, geojson, stats, bbox,
              location_label, location_city, location_region, location_country, location_lng, location_lat,
              proof_render_url, render_url
         FROM maps
        WHERE id = $1
        LIMIT 1`,
      [mapId],
    )
    const map = mapRes.rows[0]
    if (!map) fail(`Map not found: ${mapId}`)

    const proofRenderUrl = map.proof_render_url ?? map.render_url
    if (!proofRenderUrl) {
      fail('Map has no proof_render_url/render_url. Render a proof before running the draft bypass.')
    }

    const providerProfile = getProviderProfile(productUid)
    const framing = getPrintFraming(productUid, 'final')
    const mapContentHash = computeMapContentHash(map.style_config, map.geojson, framing, map)
    const chromeHash = computeChromeHash(map.style_config, map.stats, map)
    const proofRenderHash = computeProofRenderHash(mapContentHash, chromeHash)
    const printHash = computePrintHash({
      mapContentHash,
      chromeHash,
      productUid,
      dpi: framing.dpi,
      bleedMm: providerProfile.bleedMm,
    })

    const stripeSessionId = `cs_bypass_${Date.now()}_${randomUUID().slice(0, 8)}`
    const stripePiId = `pi_bypass_${Date.now()}_${randomUUID().slice(0, 8)}`
    const shippingAddress = {
      name: process.env.GELATO_DRAFT_SHIP_NAME ?? 'RadMaps Draft Test',
      email: process.env.GELATO_DRAFT_SHIP_EMAIL ?? 'anthony+gelato-draft@radmaps.studio',
      phone: process.env.GELATO_DRAFT_SHIP_PHONE ?? '3125550100',
      address1: process.env.GELATO_DRAFT_SHIP_ADDRESS1 ?? '123 Main St',
      address2: process.env.GELATO_DRAFT_SHIP_ADDRESS2 ?? '',
      city: process.env.GELATO_DRAFT_SHIP_CITY ?? 'Chicago',
      state_code: process.env.GELATO_DRAFT_SHIP_STATE ?? 'IL',
      zip: process.env.GELATO_DRAFT_SHIP_ZIP ?? '60601',
      country_code: process.env.GELATO_DRAFT_SHIP_COUNTRY ?? 'US',
    }

    await client.query('BEGIN')
    if (!map.user_id) {
      fail('Bypass script currently requires a map with user_id because this database has no orders.guest_email column.')
    }

    const orderRes = await client.query(
      `INSERT INTO orders (
          user_id, map_id, stripe_pi_id, product_uid, print_size,
          quantity, shipping_address, total_cents, currency, status,
          fulfillment_status, active_stripe_session_id
        )
        VALUES ($1,$2,$3,$4,$5,1,$6,$7,'usd','paid','paid',$8)
        RETURNING id`,
      [
        map.user_id,
        map.id,
        stripePiId,
        productUid,
        product.size_label,
        shippingAddress,
        product.price_cents,
        stripeSessionId,
      ],
    )
    const orderId = orderRes.rows[0].id as string

    await client.query(
      `INSERT INTO order_snapshots (
          stripe_session_id, order_id, user_id, map_id, product_uid,
          style_config, geojson, stats, bbox, proof_render_hash,
          proof_render_url, map_content_hash, chrome_hash, hash_version,
          provider_profile
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        stripeSessionId,
        orderId,
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

    const jobRes = await client.query(
      `INSERT INTO print_render_jobs (
          stripe_session_id, print_hash, status, attempts, max_attempts,
          worker_id, claimed_at
        )
        VALUES ($1,$2,'rendering',1,1,'gelato-draft-bypass/local',now())
        RETURNING *`,
      [stripeSessionId, printHash],
    )
    await client.query('COMMIT')

    const job = jobRes.rows[0] as PrintRenderJobRow
    console.log(`created order=${orderId} session=${stripeSessionId} job=${job.id}`)
    console.log(`rendering final file and submitting Gelato ${process.env.GELATO_ORDER_TYPE} order...`)

    const result = await processJob({
      client,
      job,
      workerId: 'gelato-draft-bypass/local',
    })

    const finalOrder = await client.query(
      `SELECT id, gelato_order_id, fulfillment_status, status, print_file_url
         FROM orders
        WHERE id = $1`,
      [orderId],
    )
    console.log(JSON.stringify({ result, order: finalOrder.rows[0] }, null, 2))
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
} finally {
  await pool.end()
  await shutdownDb().catch(() => {})
}
