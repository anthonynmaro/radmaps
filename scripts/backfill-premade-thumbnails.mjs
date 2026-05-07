#!/usr/bin/env node
import { createHmac, createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const THUMB_WIDTH = 720
const THUMB_HEIGHT = 1080
const THUMB_QUALITY = 82
const THUMB_VERSION = 'premade-thumbnail-v1'
const NGROK_BYPASS_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function readEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    out[match[1]] = match[2].trim().replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '')
  }
  return out
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    force: false,
    limit: 10,
    concurrency: 2,
    retries: 1,
    ids: [],
    siteUrl: undefined,
    localBrowser: false,
    syncSourceMaps: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--force') out.force = true
    else if (arg === '--limit') out.limit = Number(argv[++i])
    else if (arg === '--concurrency') out.concurrency = Number(argv[++i])
    else if (arg === '--retries') out.retries = Number(argv[++i])
    else if (arg === '--site-url') out.siteUrl = argv[++i]
    else if (arg === '--local-browser') out.localBrowser = true
    else if (arg === '--sync-source-maps') out.syncSourceMaps = true
    else if (arg === '--ids') out.ids = argv[++i].split(',').map(s => s.trim()).filter(Boolean)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  out.limit = Math.max(1, Math.min(500, out.limit || 10))
  out.concurrency = Math.max(1, Math.min(8, out.concurrency || 2))
  out.retries = Math.max(0, Math.min(5, out.retries || 0))
  return out
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(v => stableStringify(v)).join(',')}]`
  const parts = []
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue
    parts.push(`${JSON.stringify(key)}:${stableStringify(value[key])}`)
  }
  return `{${parts.join(',')}}`
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex')
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signTicket(payload, secret) {
  const body = base64url(JSON.stringify(payload))
  const sig = base64url(createHmac('sha256', secret).update(body).digest())
  return `${body}.${sig}`
}

function thumbnailHash(row) {
  return sha256(stableStringify({
    version: THUMB_VERSION,
    widthPx: THUMB_WIDTH,
    heightPx: THUMB_HEIGHT,
    geojson: row.geojson,
    stats: row.stats ?? {},
    style_config: row.style_config ?? {},
  }))
}

function thumbnailPath(id, hash) {
  return `renders/thumb/premade/${id}/${hash}.jpg`
}

function getLocalTunnelUserAgent(url) {
  try {
    return new URL(url).hostname.endsWith('.ngrok-free.dev')
      ? { userAgent: NGROK_BYPASS_USER_AGENT }
      : undefined
  } catch {
    return undefined
  }
}

async function restJson(baseUrl, serviceKey, path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status}): ${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : null
}

async function listRows({ supabaseUrl, serviceKey, ids, force, limit, syncSourceMaps }) {
  const params = new URLSearchParams({
    select: 'id,slug,source_map_id,geojson,bbox,stats,style_config,preview_image_url,needs_preview',
    order: 'updated_at.asc',
    limit: String(limit),
  })
  if (ids.length) {
    params.set('id', `in.(${ids.join(',')})`)
  } else if (syncSourceMaps) {
    params.set('preview_image_url', 'not.is.null')
  } else if (!force) {
    params.set('or', '(preview_image_url.is.null,needs_preview.eq.true)')
  }
  return await restJson(supabaseUrl, serviceKey, `/rest/v1/premade_maps?${params.toString()}`)
}

async function uploadObject({ supabaseUrl, serviceKey, path, buffer }) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/maps/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'image/jpeg',
      'Cache-Control': '86400',
      'x-upsert': 'true',
    },
    body: buffer,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${text.slice(0, 600)}`)
}

async function updatePremade({ supabaseUrl, serviceKey, id, previewUrl }) {
  await restJson(supabaseUrl, serviceKey, `/rest/v1/premade_maps?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      preview_image_url: previewUrl,
      needs_preview: false,
    }),
  })
}

async function updateSourceMapThumbnail({ supabaseUrl, serviceKey, sourceMapId, previewUrl }) {
  if (!sourceMapId) return
  await restJson(supabaseUrl, serviceKey, `/rest/v1/maps?id=eq.${sourceMapId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      thumbnail_url: previewUrl,
    }),
  })
}

async function screenshot({ browserlessEndpoint, browserlessToken, browserlessTimeoutMs, url }) {
  const endpoint = browserlessEndpoint.replace(/\/$/, '')
  const query = new URLSearchParams({ token: browserlessToken, timeout: String(browserlessTimeoutMs) })
  const res = await fetch(`${endpoint}/screenshot?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      userAgent: getLocalTunnelUserAgent(url),
      options: {
        type: 'jpeg',
        quality: THUMB_QUALITY,
        fullPage: false,
        captureBeyondViewport: false,
      },
      viewport: {
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        deviceScaleFactor: 1,
      },
      gotoOptions: {
        waitUntil: 'load',
        timeout: browserlessTimeoutMs,
      },
      waitForFunction: {
        fn: '() => window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true',
        timeout: browserlessTimeoutMs,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Browserless screenshot failed (${res.status}): ${text.slice(0, 600)}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 20_000 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`Invalid JPEG thumbnail (${buffer.length} bytes)`)
  }
  return buffer
}

async function screenshotLocal({ browserlessTimeoutMs, url }) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: THUMB_WIDTH, height: THUMB_HEIGHT },
      deviceScaleFactor: 1,
    })
    await page.goto(url, { waitUntil: 'load', timeout: browserlessTimeoutMs })
    await page.waitForFunction(
      () => window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true,
      undefined,
      { timeout: browserlessTimeoutMs },
    )
    return await page.screenshot({
      type: 'jpeg',
      quality: THUMB_QUALITY,
      fullPage: false,
    })
  } finally {
    await browser.close()
  }
}

async function renderOne(row, ctx) {
  if (!row.geojson?.features?.length || !row.bbox || !row.style_config) {
    throw new Error('missing geojson, bbox, or style_config')
  }
  const hash = thumbnailHash(row)
  const path = thumbnailPath(row.id, hash)
  if (!ctx.force && !row.needs_preview && row.preview_image_url?.includes(path)) {
    if (!ctx.dryRun) {
      await updateSourceMapThumbnail({ ...ctx, sourceMapId: row.source_map_id, previewUrl: row.preview_image_url })
    }
    return { slug: row.slug, status: 'cached', previewUrl: row.preview_image_url }
  }
  const previewUrl = `${ctx.supabaseUrl}/storage/v1/object/public/maps/${path}`
  if (ctx.dryRun) return { slug: row.slug, status: 'dry-run', previewUrl }

  const ticket = signTicket({
    kind: 'premade',
    subject: row.id,
    renderClass: 'thumbnail',
    widthPx: THUMB_WIDTH,
    heightPx: THUMB_HEIGHT,
    deviceScaleFactor: 1,
    productUid: 'premade-thumbnail',
    expiresAt: Date.now() + 10 * 60_000,
  }, ctx.renderTicketSecret)
  const url = new URL(`/render/premade/${row.id}`, ctx.siteUrl)
  url.searchParams.set('ticket', ticket)

  const buffer = ctx.localBrowser
    ? await screenshotLocal({ ...ctx, url: url.toString() })
    : await screenshot({ ...ctx, url: url.toString() })
  await uploadObject({ ...ctx, path, buffer })
  await updatePremade({ ...ctx, id: row.id, previewUrl })
  await updateSourceMapThumbnail({ ...ctx, sourceMapId: row.source_map_id, previewUrl })
  return { slug: row.slug, status: 'rendered', previewUrl }
}

async function withRetries(row, ctx) {
  let lastError
  for (let attempt = 0; attempt <= ctx.retries; attempt++) {
    try {
      return await renderOne(row, ctx)
    } catch (err) {
      lastError = err
      if (attempt < ctx.retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }
  return { slug: row.slug, status: 'failed', error: lastError instanceof Error ? lastError.message : String(lastError) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = { ...process.env, ...readEnv(resolve(import.meta.dirname, '..', '.env')) }
  const ctx = {
    ...args,
    supabaseUrl: env.SUPABASE_URL || env.NUXT_PUBLIC_SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    browserlessToken: env.BROWSERLESS_TOKEN,
    browserlessEndpoint: env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io',
    browserlessTimeoutMs: Number(env.BROWSERLESS_TIMEOUT_MS || 60_000),
    renderTicketSecret: env.RENDER_TICKET_SECRET || 'dev-render-ticket-secret',
    siteUrl: args.siteUrl || env.NUXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3001',
  }

  for (const key of ['supabaseUrl', 'serviceKey', 'browserlessToken', 'renderTicketSecret', 'siteUrl']) {
    if (!ctx[key]) throw new Error(`Missing ${key}`)
  }

  const rows = await listRows(ctx)
  console.log(`Found ${rows.length} premade map(s) to process.`)

  let cursor = 0
  let failed = 0
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      const result = await withRetries(row, ctx)
      if (result.status === 'failed') failed++
      console.log(`${result.status.padEnd(8)} ${result.slug}${result.error ? ` - ${result.error}` : ''}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(ctx.concurrency, rows.length) }, () => worker()))
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
