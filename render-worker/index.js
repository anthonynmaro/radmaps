/**
 * TrailMaps Render Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone Node.js service deployed on Railway.
 * Receives render jobs from the Nuxt API server, renders the map using
 * Puppeteer + MapLibre GL JS at 300 DPI, and uploads outputs to Supabase Storage.
 *
 * Deploy separately from the main Nuxt app.
 * Requires: Node 20+, Chromium (bundled with Puppeteer)
 */

import Fastify from 'fastify'
import puppeteer from 'puppeteer'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { buildMapStyle } from './mapStyle.js'

// Allowed logo URL origins — must match where logos are actually stored.
// This prevents SSRF: an authenticated user could set logo_url to an internal
// cloud metadata endpoint (e.g. 169.254.169.254) and trigger a fetch via Puppeteer.
const ALLOWED_LOGO_ORIGINS = [
  process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null,
  'https://radmaps.studio',
].filter(Boolean)

function validateLogoUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    if (!ALLOWED_LOGO_ORIGINS.some(origin => parsed.origin === origin)) return null
    return url
  } catch {
    return null
  }
}

const app = Fastify({ logger: true })

// In-memory job store (use Redis/BullMQ for production at scale)
const jobs = new Map()

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return // Skip auth for health check
  const auth = request.headers.authorization
  if (!auth || auth !== `Bearer ${process.env.RENDER_WORKER_SECRET}`) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok' }))

// ─── Submit render job ────────────────────────────────────────────────────────
app.post('/render', async (request, reply) => {
  const {
    map_id, geojson, style_config, title, subtitle, stats, bbox,
    mapbox_token, maptiler_token, quality,
    // Product-specific render dimensions (optional — falls back to 18×24" default)
    render_width_px, render_height_px,
    // User-adjusted map framing from ProductSelector (optional)
    framing,
  } = request.body
  const isPreview = quality === 'preview'

  const jobId = randomUUID()
  jobs.set(jobId, { status: 'queued', map_id })

  // Kick off async render (don't await)
  renderMap({
    jobId, map_id, geojson, style_config, title, subtitle, stats, bbox,
    mapbox_token, maptiler_token, isPreview,
    render_width_px, render_height_px, framing,
  })
    .catch(async err => {
      app.log.error(err)
      jobs.set(jobId, { status: 'failed', error: err.message, map_id })

      // Write error sentinel to Supabase so the client can detect failure fast.
      // Preview failures write to thumbnail_url; print failures write to render_url.
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
        const sentinel = `error:${err.message.slice(0, 200)}`
        await supabase
          .from('maps')
          .update(isPreview ? { thumbnail_url: sentinel } : { render_url: sentinel })
          .eq('id', map_id)
      } catch (supabaseErr) {
        app.log.error('Failed to write error sentinel to Supabase:', supabaseErr)
      }
    })

  return reply.status(202).send({ job_id: jobId, status: 'queued' })
})

// ─── Poll job status ──────────────────────────────────────────────────────────
app.get('/render/status/:jobId', async (request, reply) => {
  const job = jobs.get(request.params.jobId)
  if (!job) return reply.status(404).send({ error: 'Job not found' })
  return job
})

// ─── Core render function ─────────────────────────────────────────────────────
async function renderMap({
  jobId, map_id, geojson, style_config, title, subtitle, stats, bbox,
  mapbox_token, maptiler_token, isPreview,
  render_width_px, render_height_px, framing,
}) {
  jobs.set(jobId, { status: 'rendering', map_id })
  app.log.info(`[render ${jobId}] mapbox_token present: ${!!mapbox_token}`)

  // Product-aware dimensions:
  // If render_width_px / render_height_px are provided, use them (already includes bleed).
  // Otherwise fall back to the 18×24" default (for backwards compatibility).
  const DEFAULT_PRINT_W = 5470  // 18" × 300 DPI + 2×35px bleed
  const DEFAULT_PRINT_H = 7270  // 24" × 300 DPI + 2×35px bleed
  const PREVIEW_SCALE = 0.25

  let WIDTH_PX, HEIGHT_PX
  if (isPreview) {
    const baseW = render_width_px || DEFAULT_PRINT_W
    const baseH = render_height_px || DEFAULT_PRINT_H
    WIDTH_PX  = Math.round(baseW * PREVIEW_SCALE)
    HEIGHT_PX = Math.round(baseH * PREVIEW_SCALE)
  } else {
    WIDTH_PX  = render_width_px || DEFAULT_PRINT_W
    HEIGHT_PX = render_height_px || DEFAULT_PRINT_H
  }

  // Print renders use deviceScaleFactor=2 with a half-size CSS viewport.
  // This gives Chrome the full physical resolution (WIDTH_PX × HEIGHT_PX) in the
  // screenshot while MapLibre only loads tiles for the CSS viewport (WIDTH_PX/2),
  // reducing tile count from ~484 to ~121 and eliminating tile-load timeouts.
  // All vh-based typography and route line widths scale correctly at 2× DPR.
  const CSS_W = isPreview ? WIDTH_PX : Math.round(WIDTH_PX / 2)
  const CSS_H = isPreview ? HEIGHT_PX : Math.round(HEIGHT_PX / 2)
  const DPR   = isPreview ? 1 : 2

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Root cause of WebGL failure: Chrome's GPU process can't bind a command buffer
      // sequence (BindToCurrentSequence failed) in Railway's container environment.
      // --in-process-gpu runs GPU code inside the renderer process, eliminating the
      // cross-process binding that fails. --no-zygote prevents the zygote process
      // from interfering. --use-angle=swiftshader-webgl uses Chrome's built-in
      // software WebGL renderer (no system GL/EGL libraries required).
      '--in-process-gpu',
      '--no-zygote',
      '--use-angle=swiftshader-webgl',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: CSS_W, height: CSS_H, deviceScaleFactor: DPR })

  // Forward in-page console output to the worker log so tile errors are visible.
  page.on('console', msg => app.log.info(`[page:${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => app.log.error(`[page:error] ${err.message}`))

  // Stadia Maps uses domain-based auth: it checks the HTTP Referer header and only
  // serves tiles to allowlisted domains. Puppeteer's headless context sends no Referer
  // for in-page XHR/fetch requests (tile fetches), causing 401s.
  // setExtraHTTPHeaders applies to ALL requests from the page (navigation + fetch + XHR),
  // unlike setRequestInterception which requires per-request handling.
  // APP_URL must match a domain registered in the Stadia Maps dashboard (or use STADIA_API_KEY).
  await page.setExtraHTTPHeaders({ 'Referer': process.env.APP_URL ?? 'http://localhost:3000' })

  // Build self-contained HTML page that renders the map.
  // Pass CSS viewport dimensions (CSS_W × CSS_H) — at DPR=2 for print, these are
  // half the physical size. The browser renders at physical resolution automatically.
  const html = buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width: CSS_W, height: CSS_H, framing })
  // waitUntil:'load' ensures the MapLibre CDN script has executed before the
  // inline map-init script runs. networkidle is intentionally avoided because
  // MapLibre fires hundreds of tile requests that would stall it indefinitely.
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 })

  // Preview: 25s. Print: 75s (page script force-completes at 60s absolute / 25s post-load).
  // With DPR=2, tile count is ~4× lower so renders finish well under 60s.
  await page.waitForFunction('window.__mapReady === true', { timeout: isPreview ? 25000 : 75000 })
  await new Promise(resolve => setTimeout(resolve, isPreview ? 500 : 2000))

  // Screenshot
  const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 95 })
  await browser.close()

  // Optimise with Sharp
  const optimisedJpeg = await sharp(screenshotBuffer)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()

  // Upload to Supabase Storage
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
  )

  const fileKey = isPreview ? 'preview' : 'render'
  const jpegPath = `${map_id}/${fileKey}-${Date.now()}.jpg`
  const { error: jpegError } = await supabase.storage
    .from('maps')
    .upload(jpegPath, optimisedJpeg, { contentType: 'image/jpeg', upsert: true })

  if (jpegError) throw new Error(`JPEG upload failed: ${jpegError.message}`)

  const { data: { publicUrl: jpegUrl } } = supabase.storage.from('maps').getPublicUrl(jpegPath)

  // Preview → thumbnail_url only.
  // Print → render_url + status 'rendered' + is_public true (makes the map
  // accessible via the public share endpoint for the first time).
  const update = isPreview
    ? { thumbnail_url: jpegUrl }
    : { render_url: jpegUrl, status: 'rendered', is_public: true }
  await supabase.from('maps').update(update).eq('id', map_id)

  jobs.set(jobId, { status: 'complete', map_id, ...(isPreview ? { thumbnail_url: jpegUrl } : { render_url: jpegUrl }) })
}

// ─── HTML template for server-side MapLibre render ───────────────────────────
// Uses vh units throughout (1vh = height/100 in Puppeteer's fixed viewport)
// matching cqh units in MapPreview.vue (1cqh = 1% of poster canvas height).
function buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width, height, framing }) {
  const stadia_token = process.env.STADIA_API_KEY ?? ''
  const styleJson = JSON.stringify(buildMapStyle(style_config, mapbox_token, maptiler_token, undefined, stadia_token))
  const cropStart = style_config.route_crop_start ?? 0
  const cropEnd = style_config.route_crop_end ?? 100
  const deletedRanges = style_config.route_deleted_ranges ?? []
  const hasModification = cropStart > 0 || cropEnd < 100 || deletedRanges.length > 0
  const croppedGeojson = hasModification
    ? excludeRangesFromRoute(geojson, cropStart, cropEnd, deletedRanges)
    : geojson
  const geojsonStr = JSON.stringify(smoothGeojson(croppedGeojson, style_config.route_smooth ?? 0))
  const padding = Math.round(Math.min(width, height) * (style_config.padding_factor ?? 0.15))

  const fg = style_config.label_text_color || '#1C1917'
  const bg = style_config.label_bg_color || style_config.background_color || '#F7F4EF'
  const trailName = style_config.trail_name || title || 'Your Trail'
  const occasionText = style_config.occasion_text || ''
  const locationText = style_config.location_text || stats?.location || ''
  const locationLine = locationText ? locationText.toUpperCase() : ''
  const distanceMi = stats?.distance_km ? (stats.distance_km * 0.621371).toFixed(1) : ''
  const elevGainFt = stats?.elevation_gain_m ? Math.round(stats.elevation_gain_m * 3.28084).toLocaleString() : ''

  // Typography and layout per theme — mirrors utils/posterData.ts (keep in sync).
  // Sizes are plain numbers; append 'vh' here (vs 'cqh' in browser preview).
  const SERIF_FONTS_SET = new Set(['Playfair Display','Cormorant Garamond','Libre Baskerville','DM Serif Display'])
  function toFontStack(family) {
    return `'${family}', ${SERIF_FONTS_SET.has(family) ? 'serif' : 'sans-serif'}`
  }
  const POSTER_TYPOGRAPHY = {
    // Family A
    chalk:         { titleFont: "'Work Sans', sans-serif",           titleWeight: '300', titleTracking: '0.38em', titleCase: 'uppercase', titleSize: 3.4, titleLineHeight: '1.15', subFont: "'Work Sans', sans-serif",           subWeight: '400', subTracking: '0.28em', subSize: 1.0,  statsFont: "'Work Sans', sans-serif",           statsWeight: '500' },
    topaz:         { titleFont: "'Space Grotesk', sans-serif",       titleWeight: '700', titleTracking: '0.06em', titleCase: 'uppercase', titleSize: 4.4, titleLineHeight: '1.05', subFont: "'Space Grotesk', sans-serif",       subWeight: '400', subTracking: '0.22em', subSize: 1.05, statsFont: "'Space Grotesk', sans-serif",       statsWeight: '600' },
    dusk:          { titleFont: "'DM Serif Display', serif",         titleWeight: '400', titleTracking: '0.03em', titleCase: 'none',      titleSize: 4.8, titleLineHeight: '1.1',  subFont: "'DM Sans', sans-serif",            subWeight: '400', subTracking: '0.22em', subSize: 1.0,  statsFont: "'DM Sans', sans-serif",            statsWeight: '500' },
    obsidian:      { titleFont: "'Big Shoulders Display', sans-serif", titleWeight: '800', titleTracking: '-0.01em', titleCase: 'uppercase', titleSize: 5.8, titleLineHeight: '0.95', subFont: "'DM Sans', sans-serif",          subWeight: '400', subTracking: '0.35em', subSize: 1.0,  statsFont: "'Big Shoulders Display', sans-serif", statsWeight: '700' },
    forest:        { titleFont: "'Oswald', sans-serif",              titleWeight: '600', titleTracking: '0.08em', titleCase: 'uppercase', titleSize: 4.6, titleLineHeight: '1.05', subFont: "'Oswald', sans-serif",             subWeight: '300', subTracking: '0.22em', subSize: 1.0,  statsFont: "'Oswald', sans-serif",             statsWeight: '500' },
    midnight:      { titleFont: "'Fjalla One', sans-serif",          titleWeight: '400', titleTracking: '0.12em', titleCase: 'uppercase', titleSize: 4.8, titleLineHeight: '1.05', subFont: "'DM Sans', sans-serif",            subWeight: '300', subTracking: '0.32em', subSize: 1.0,  statsFont: "'Fjalla One', sans-serif",         statsWeight: '400' },
    // Family B
    editorial:     { titleFont: "'Playfair Display', serif",         titleWeight: '400', titleTracking: '0.02em', titleCase: 'none',      titleSize: 5.0, titleLineHeight: '1.1',  subFont: "'Playfair Display', serif",        subWeight: '400', subTracking: '0.18em', subSize: 1.0,  statsFont: "'Libre Baskerville', serif",       statsWeight: '400' },
    bauhaus:       { titleFont: "'Big Shoulders Display', sans-serif", titleWeight: '900', titleTracking: '-0.02em', titleCase: 'uppercase', titleSize: 6.8, titleLineHeight: '0.9',  subFont: "'DM Sans', sans-serif",          subWeight: '400', subTracking: '0.28em', subSize: 0.95, statsFont: "'Big Shoulders Display', sans-serif", statsWeight: '700' },
    vintage:       { titleFont: "'DM Serif Display', serif",         titleWeight: '400', titleTracking: '0.04em', titleCase: 'none',      titleSize: 5.2, titleLineHeight: '1.08', subFont: "'DM Serif Display', serif",        subWeight: '400', subTracking: '0.22em', subSize: 1.0,  statsFont: "'DM Sans', sans-serif",            statsWeight: '400' },
    brutalist:     { titleFont: "'Bebas Neue', sans-serif",          titleWeight: '400', titleTracking: '0.07em', titleCase: 'uppercase', titleSize: 7.2, titleLineHeight: '0.92', subFont: "'DM Sans', sans-serif",            subWeight: '700', subTracking: '0.35em', subSize: 0.9,  statsFont: "'Bebas Neue', sans-serif",         statsWeight: '400' },
    risograph:     { titleFont: "'Oswald', sans-serif",              titleWeight: '500', titleTracking: '0.10em', titleCase: 'uppercase', titleSize: 5.0, titleLineHeight: '1.0',  subFont: "'Oswald', sans-serif",             subWeight: '300', subTracking: '0.25em', subSize: 1.0,  statsFont: "'Work Sans', sans-serif",          statsWeight: '500' },
    blueprint:     { titleFont: "'Space Grotesk', sans-serif",       titleWeight: '700', titleTracking: '0.14em', titleCase: 'uppercase', titleSize: 4.2, titleLineHeight: '1.05', subFont: "'Space Grotesk', sans-serif",      subWeight: '400', subTracking: '0.28em', subSize: 0.9,  statsFont: "'Space Grotesk', sans-serif",      statsWeight: '600' },
    kertok:        { titleFont: "'Work Sans', sans-serif",           titleWeight: '200', titleTracking: '0.06em', titleCase: 'none',      titleSize: 4.6, titleLineHeight: '1.12', subFont: "'Work Sans', sans-serif",          subWeight: '300', subTracking: '0.20em', subSize: 0.95, statsFont: "'Work Sans', sans-serif",          statsWeight: '300' },
    'mid-century': { titleFont: "'Oswald', sans-serif",              titleWeight: '400', titleTracking: '0.16em', titleCase: 'uppercase', titleSize: 4.4, titleLineHeight: '1.05', subFont: "'Work Sans', sans-serif",          subWeight: '400', subTracking: '0.30em', subSize: 0.95, statsFont: "'Oswald', sans-serif",             statsWeight: '400' },
    'topo-art':    { titleFont: "'Work Sans', sans-serif",           titleWeight: '400', titleTracking: '0.28em', titleCase: 'uppercase', titleSize: 3.6, titleLineHeight: '1.15', subFont: "'Work Sans', sans-serif",          subWeight: '300', subTracking: '0.22em', subSize: 0.95, statsFont: "'Work Sans', sans-serif",          statsWeight: '400' },
    'dark-sky':    { titleFont: "'Fjalla One', sans-serif",          titleWeight: '400', titleTracking: '0.08em', titleCase: 'uppercase', titleSize: 5.4, titleLineHeight: '1.0',  subFont: "'DM Sans', sans-serif",            subWeight: '300', subTracking: '0.35em', subSize: 1.0,  statsFont: "'Fjalla One', sans-serif",         statsWeight: '400' },
  }
  const POSTER_LAYOUT = {
    chalk: { titleAlign: 'center', titlePosition: 'top' }, topaz: { titleAlign: 'center', titlePosition: 'top' },
    dusk: { titleAlign: 'center', titlePosition: 'top' }, obsidian: { titleAlign: 'center', titlePosition: 'top' },
    forest: { titleAlign: 'center', titlePosition: 'top' }, midnight: { titleAlign: 'center', titlePosition: 'top' },
    editorial: { titleAlign: 'left', titlePosition: 'top' }, bauhaus: { titleAlign: 'left', titlePosition: 'bottom' },
    vintage: { titleAlign: 'center', titlePosition: 'top' }, brutalist: { titleAlign: 'left', titlePosition: 'bottom' },
    risograph: { titleAlign: 'left', titlePosition: 'top' }, blueprint: { titleAlign: 'left', titlePosition: 'bottom' },
    kertok: { titleAlign: 'left', titlePosition: 'top' }, 'mid-century': { titleAlign: 'center', titlePosition: 'bottom' },
    'topo-art': { titleAlign: 'center', titlePosition: 'top' }, 'dark-sky': { titleAlign: 'center', titlePosition: 'bottom' },
  }
  const baseTypo = POSTER_TYPOGRAPHY[style_config.color_theme ?? 'chalk'] ?? POSTER_TYPOGRAPHY.chalk
  const fontOverride = style_config.font_family
  const typo = fontOverride ? {
    ...baseTypo,
    titleFont: toFontStack(fontOverride),
    subFont: toFontStack(style_config.body_font_family ?? fontOverride),
    statsFont: toFontStack(style_config.body_font_family ?? fontOverride),
  } : baseTypo
  const layout = POSTER_LAYOUT[style_config.color_theme ?? 'chalk'] ?? POSTER_LAYOUT.chalk

  const borderW = style_config.border_style === 'thick' ? '2px' : style_config.border_style === 'thin' ? '1px' : '0'

  // Build coordinate strings from bbox center
  function fmtCoord(v, pos, neg) {
    const d = Math.abs(Math.floor(v))
    const m = Math.round((Math.abs(v) - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }
  let coordHtml = ''
  if (bbox) {
    const lat = (bbox[1] + bbox[3]) / 2
    const lng = (bbox[0] + bbox[2]) / 2
    coordHtml = `<span style="display:block;font-family:${typo.statsFont};font-weight:500;font-size:1.2vh;letter-spacing:0.04em;color:${fg};opacity:0.65;">${fmtCoord(lat,'N','S')}</span>
                 <span style="display:block;font-family:${typo.statsFont};font-weight:500;font-size:1.2vh;letter-spacing:0.04em;color:${fg};opacity:0.65;">${fmtCoord(lng,'E','W')}</span>`
  }

  // Build stat blocks HTML
  const statsHtml = [
    distanceMi ? `<div style="display:flex;flex-direction:column;align-items:flex-start;">
      <span style="font-family:${typo.statsFont};font-weight:600;font-size:2.6vh;letter-spacing:-0.01em;line-height:1;color:${fg};">${distanceMi}</span>
      <span style="font-family:${typo.statsFont};font-weight:400;font-size:0.8vh;letter-spacing:0.18em;text-transform:uppercase;color:${fg};opacity:0.45;margin-top:0.55vh;">miles</span>
    </div>` : '',
    distanceMi && elevGainFt ? `<div style="width:1px;height:3vh;background:${fg};opacity:0.15;align-self:center;flex-shrink:0;"></div>` : '',
    elevGainFt ? `<div style="display:flex;flex-direction:column;align-items:flex-start;">
      <span style="font-family:${typo.statsFont};font-weight:600;font-size:2.6vh;letter-spacing:-0.01em;line-height:1;color:${fg};">${elevGainFt}</span>
      <span style="font-family:${typo.statsFont};font-weight:400;font-size:0.8vh;letter-spacing:0.18em;text-transform:uppercase;color:${fg};opacity:0.45;margin-top:0.55vh;">ft gain</span>
    </div>` : '',
    coordHtml ? `<div style="width:1px;height:3vh;background:${fg};opacity:0.15;align-self:center;flex-shrink:0;"></div><div>${coordHtml}</div>` : '',
  ].filter(Boolean).join('')

  // Logo HTML (when positioned over map)
  function logoHtml() {
    const safeUrl = validateLogoUrl(style_config.show_logo ? style_config.logo_url : null)
    if (!safeUrl) return ''
    const size = (style_config.logo_size ?? 8) * height / 100
    const pos = style_config.logo_position ?? 'map-top-right'
    if (pos === 'map-top-right') {
      return `<img src="${safeUrl}" alt="" style="position:absolute;top:2%;right:2%;max-height:${size}px;max-width:15%;object-fit:contain;z-index:10;pointer-events:none;" />`
    }
    return ''
  }

  // Logo in footer-left
  function logoFooterHtml() {
    const safeUrl = validateLogoUrl(style_config.show_logo && style_config.logo_position === 'footer-left' ? style_config.logo_url : null)
    if (!safeUrl) return ''
    return `<img src="${safeUrl}" alt="" style="max-height:4vh;max-width:10%;object-fit:contain;flex-shrink:0;" />`
  }

  // Logo in header-right
  function logoHeaderHtml() {
    const safeUrl = validateLogoUrl(style_config.show_logo && style_config.logo_position === 'header-right' ? style_config.logo_url : null)
    if (!safeUrl) return ''
    const size = (style_config.logo_size ?? 8) * height / 100
    return `<img src="${safeUrl}" alt="" style="position:absolute;top:50%;right:7vw;transform:translateY(-50%);max-height:${size}px;max-width:12%;object-fit:contain;" />`
  }

  // Text overlays HTML
  function textOverlaysHtml() {
    const overlays = style_config.text_overlays ?? []
    if (!overlays.length) return ''
    return overlays.map(o => {
      const fs = (o.font_size / 100) * height
      const xOffset = o.alignment === 'center' ? '-50%' : o.alignment === 'right' ? '-100%' : '0%'
      const bgStyle = o.bg_color ? `background:${o.bg_color};padding:${height*0.003}px ${height*0.008}px;border-radius:${height*0.004}px;` : ''
      const italic = o.italic ? 'italic' : 'normal'
      return `<div style="position:absolute;left:${o.x}%;top:${o.y}%;font-family:'${o.font_family}',sans-serif;font-size:${fs}px;color:${o.color};text-align:${o.alignment};opacity:${o.opacity};font-weight:${o.bold?700:400};font-style:${italic};white-space:pre;transform:translateX(${xOffset});pointer-events:none;z-index:8;${bgStyle}">${escapeHtml(o.content)}</div>`
    }).join('')
  }

  // Trail legend HTML
  function trailLegendHtml() {
    const segments = (style_config.trail_segments ?? []).filter(s => s.visible && s.name)
    if (!style_config.trail_legend?.show || !segments.length) return ''
    const pos = style_config.trail_legend?.position ?? 'bottom-left'
    const posMap = {
      'bottom-left': 'bottom:2%;left:2%',
      'bottom-right': 'bottom:2%;right:2%',
      'top-left': 'top:2%;left:2%',
      'top-right': 'top:2%;right:2%',
    }
    const posStyle = posMap[pos] ?? posMap['bottom-left']
    const swatchW = Math.round(width * 0.022)
    const swatchH = Math.round(height * 0.0035)
    const fontSize = Math.round(height * 0.0075)
    const padding = Math.round(height * 0.008)
    const gap = Math.round(height * 0.005)
    const items = segments.map(s =>
      `<div style="display:flex;align-items:center;gap:${Math.round(width*0.008)}px;margin-bottom:${gap}px;">
        <div style="width:${swatchW}px;height:${swatchH}px;background:${s.color};border-radius:2px;flex-shrink:0;"></div>
        <span style="font-family:${typo.statsFont};font-weight:500;font-size:${fontSize}px;color:${fg};opacity:0.85;">${escapeHtml(s.name)}</span>
      </div>`
    ).join('')
    return `<div style="position:absolute;${posStyle};z-index:9;background:rgba(255,255,255,0.88);border-radius:${Math.round(height*0.006)}px;padding:${padding}px ${Math.round(width*0.012)}px;pointer-events:none;">
      ${items}
    </div>`
  }

  // Vignette overlay HTML
  function vignetteHtml() {
    if (!style_config.show_vignette) return ''
    const intensity = style_config.vignette_intensity ?? 0.45
    const isDark = ['obsidian', 'forest', 'midnight'].includes(style_config.color_theme ?? '')
    const alpha = isDark ? intensity : intensity * 0.65
    return `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${alpha.toFixed(2)}) 100%);pointer-events:none;z-index:11;"></div>`
  }

  // Film grain overlay HTML
  function grainHtml() {
    const grain = style_config.tile_grain ?? 0
    if (grain <= 0) return ''
    return `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:11;mix-blend-mode:overlay;" xmlns="http://www.w3.org/2000/svg">
      <filter id="grain-noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noiseOut"/>
        <feColorMatrix type="saturate" values="0" in="noiseOut"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-noise)" opacity="${grain}"/>
    </svg>`
  }

  // Trail segment JS (run inside map.on('load'))
  function trailSegmentsJs() {
    // buildMapStyle already added trail-seg-* sources and layers in the style JSON.
    // We only need to populate each source with the sliced GeoJSON data.
    const segments = (style_config.trail_segments ?? []).filter(s => s.visible)
    if (!segments.length) return ''
    return segments.map(s => {
      const sliced = sliceRouteByPct(geojson, s.section_start, s.section_end)
      const slicedStr = JSON.stringify(sliced)
      return `
      var _src${s.id.replace(/-/g,'_')} = map.getSource('trail-seg-${s.id}');
      if (_src${s.id.replace(/-/g,'_')}) _src${s.id.replace(/-/g,'_')}.setData(${slicedStr});`
    }).join('')
  }

  // Dot marker JS (run inside map.on('load')).
  // Matches MapPreview.vue's makePinDotEl(): colored circle + white border + shadow.
  // The text labels and leader lines are added in pinLabelsIdleJs() after 'idle'.
  function pinMarkersJs() {
    const showStart = style_config.show_start_pin !== false
    const showFinish = style_config.show_finish_pin !== false
    if (!showStart && !showFinish) return ''

    let startCoord = null, endCoord = null
    for (const f of geojson.features) {
      const g = f.geometry
      if (g.type === 'LineString' && g.coordinates.length > 0) {
        if (!startCoord) startCoord = g.coordinates[0]
        endCoord = g.coordinates[g.coordinates.length - 1]
      } else if (g.type === 'MultiLineString') {
        for (const line of g.coordinates) {
          if (line.length > 0) {
            if (!startCoord) startCoord = line[0]
            endCoord = line[line.length - 1]
          }
        }
      }
    }
    if (!startCoord && !endCoord) return ''

    const pinColor = style_config.pin_color ?? style_config.label_text_color ?? '#1C1917'
    const pinOpacity = style_config.pin_opacity ?? 0.9
    const dotSize = Math.max(10, height * 0.015)
    const borderSize = Math.max(2, dotSize * 0.18)
    const startJson = JSON.stringify(startCoord)
    const endJson   = JSON.stringify(endCoord)

    return `
      (function() {
        var PIN_COLOR = ${JSON.stringify(pinColor)};
        var PIN_OPACITY = ${pinOpacity};
        var DOT_SIZE = ${dotSize.toFixed(1)};
        var BORDER_SIZE = ${borderSize.toFixed(1)};
        function makeDotEl() {
          var el = document.createElement('div');
          el.style.cssText = 'width:' + DOT_SIZE + 'px;height:' + DOT_SIZE + 'px;border-radius:50%;background:' + PIN_COLOR + ';opacity:' + PIN_OPACITY + ';border:' + BORDER_SIZE + 'px solid rgba(255,255,255,0.85);box-shadow:0 1px 6px rgba(0,0,0,0.4);pointer-events:none;';
          return el;
        }
        ${showStart && startCoord ? `new maplibregl.Marker({ element: makeDotEl(), anchor: 'center' }).setLngLat(${startJson}).addTo(map);` : ''}
        ${showFinish && endCoord  ? `new maplibregl.Marker({ element: makeDotEl(), anchor: 'center' }).setLngLat(${endJson}).addTo(map);`  : ''}
      })();
    `
  }

  // Pin label SVG overlay (run after 'idle' or 20s grace so map.project() is accurate).
  // Matches MapPreview.vue's SVG overlay: leader line + text label with stroke halo.
  function pinLabelsIdleJs() {
    const showStart = style_config.show_start_pin !== false
    const showFinish = style_config.show_finish_pin !== false
    if (!showStart && !showFinish) return ''

    let startCoord = null, endCoord = null
    for (const f of geojson.features) {
      const g = f.geometry
      if (g.type === 'LineString' && g.coordinates.length > 0) {
        if (!startCoord) startCoord = g.coordinates[0]
        endCoord = g.coordinates[g.coordinates.length - 1]
      } else if (g.type === 'MultiLineString') {
        for (const line of g.coordinates) {
          if (line.length > 0) {
            if (!startCoord) startCoord = line[0]
            endCoord = line[line.length - 1]
          }
        }
      }
    }
    if (!startCoord && !endCoord) return ''

    const pinColor   = style_config.pin_color ?? style_config.label_text_color ?? '#1C1917'
    const pinOpacity = style_config.pin_opacity ?? 0.9
    const bgColor    = style_config.background_color ?? '#FFFFFF'
    const pinFontFamily = style_config.pin_font_family
      ? `'${style_config.pin_font_family}', sans-serif`
      : typo.statsFont
    const startLabel  = (style_config.start_pin_label  ?? 'Start').toUpperCase()
    const finishLabel = (style_config.finish_pin_label ?? 'Finish').toUpperCase()
    const svgFontSize = (height * 0.022).toFixed(1)
    const svgLineW    = (height * 0.0012).toFixed(2)
    const offset      = (height * 0.07).toFixed(1)

    const startJson  = JSON.stringify(startCoord)
    const endJson    = JSON.stringify(endCoord)
    const startSavedLabel  = style_config.start_label_lnglat  ? JSON.stringify(style_config.start_label_lnglat)  : 'null'
    const finishSavedLabel = style_config.finish_label_lnglat ? JSON.stringify(style_config.finish_label_lnglat) : 'null'

    return `
      (function() {
        var PIN_COLOR   = ${JSON.stringify(pinColor)};
        var PIN_OPACITY = ${pinOpacity};
        var BG_COLOR    = ${JSON.stringify(bgColor)};
        var FONT_FAMILY = ${JSON.stringify(pinFontFamily)};
        var FONT_SIZE   = ${svgFontSize};
        var LINE_W      = ${svgLineW};
        var OFFSET      = ${offset};

        var svgParts = [];

        function addPin(coord, savedLabelLnglat, labelText, defaultLeft) {
          if (!coord) return;
          var dot = map.project(coord);
          var labelPt;
          if (savedLabelLnglat) {
            var saved = map.project(savedLabelLnglat);
            labelPt = { x: saved.x, y: saved.y };
          } else {
            labelPt = defaultLeft
              ? { x: dot.x - OFFSET * 0.7, y: dot.y - OFFSET * 0.8 }
              : { x: dot.x + OFFSET * 0.7, y: dot.y - OFFSET * 0.8 };
          }
          var anchor = labelPt.x < dot.x ? 'end' : 'start';
          svgParts.push(
            '<line x1="' + dot.x + '" y1="' + dot.y + '" x2="' + labelPt.x + '" y2="' + labelPt.y +
            '" stroke="' + PIN_COLOR + '" stroke-width="' + LINE_W + '" stroke-opacity="' + (PIN_OPACITY * 0.55).toFixed(2) + '" />'
          );
          svgParts.push(
            '<text x="' + labelPt.x + '" y="' + labelPt.y +
            '" text-anchor="' + anchor +
            '" font-size="' + FONT_SIZE +
            '" font-family="' + FONT_FAMILY +
            '" fill="' + PIN_COLOR +
            '" opacity="' + PIN_OPACITY +
            '" stroke="' + BG_COLOR + '" stroke-width="3" paint-order="stroke fill"' +
            ' font-weight="600" letter-spacing="0.12em" dominant-baseline="middle">' +
            labelText + '</text>'
          );
        }

        ${showStart  && startCoord ? `addPin(${startJson},  ${startSavedLabel},  ${JSON.stringify(startLabel)},  true);`  : ''}
        ${showFinish && endCoord   ? `addPin(${endJson},    ${finishSavedLabel}, ${JSON.stringify(finishLabel)}, false);` : ''}

        if (svgParts.length > 0) {
          var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svgEl.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;z-index:14;overflow:visible;pointer-events:none;');
          svgEl.innerHTML = svgParts.join('');
          document.getElementById('map-container').appendChild(svgEl);
        }
      })();
    `
  }

  // Font families needed for Google Fonts — include all three font roles
  const fontsNeeded = new Set([
    typo.titleFont.replace(/'/g, '').split(',')[0].trim(),
    typo.subFont.replace(/'/g, '').split(',')[0].trim(),
    typo.statsFont.replace(/'/g, '').split(',')[0].trim(),
  ])
  if (style_config.font_family) fontsNeeded.add(style_config.font_family)
  if (style_config.body_font_family) fontsNeeded.add(style_config.body_font_family)
  ;(style_config.text_overlays ?? []).forEach(o => fontsNeeded.add(o.font_family))
  const googleFontsUrl = `https://fonts.googleapis.com/css2?${[...fontsNeeded].map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`).join('&')}&display=swap`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px; height: ${height}px; overflow: hidden;
      display: flex; flex-direction: column;
      background: ${style_config.background_color || '#F7F4EF'};
      font-family: sans-serif;
      position: relative;
    }
    #poster-header {
      flex-shrink: 0;
      background: ${style_config.background_color || '#F7F4EF'};
      padding: ${layout.titlePosition === 'bottom' ? '2.4vh 7vw 3.5vh' : '5vh 7vw 2.8vh'};
      display: flex; flex-direction: column;
      align-items: ${layout.titleAlign === 'left' ? 'flex-start' : 'center'}; justify-content: center;
      gap: 1.1vh;
      position: relative;
      order: ${layout.titlePosition === 'top' ? '0' : '1'};
    }
    #poster-header h1 {
      font-family: ${typo.titleFont};
      font-weight: ${typo.titleWeight};
      letter-spacing: ${typo.titleTracking};
      font-size: ${(typo.titleSize * (style_config.title_scale ?? 1.0)).toFixed(3)}vh;
      line-height: ${typo.titleLineHeight};
      color: ${fg};
      text-align: ${layout.titleAlign};
      text-transform: ${typo.titleCase};
      margin: 0;
    }
    #poster-header p {
      font-family: ${typo.subFont};
      font-weight: ${typo.subWeight};
      letter-spacing: ${typo.subTracking};
      font-size: ${(typo.subSize * (style_config.subtitle_scale ?? 1.0)).toFixed(3)}vh;
      color: ${fg};
      opacity: 0.5;
      text-transform: uppercase;
      text-align: ${layout.titleAlign};
      margin: 0;
    }
    #poster-rule {
      width: 100%; height: 1px;
      background: ${fg}; opacity: 0.12;
      margin-top: 0.4vh; flex-shrink: 0;
    }
    #map-container {
      flex: 1; position: relative; overflow: hidden;
      order: ${layout.titlePosition === 'top' ? '1' : '0'};
    }
    #map { width: 100%; height: 100%; }
    #poster-footer {
      flex-shrink: 0;
      background: ${bg};
      padding: ${borderW !== '0' ? 'calc(1.8vh + 14px) 7vw' : '1.8vh 7vw'};
      display: flex; align-items: center; justify-content: space-between;
      position: relative;
      order: 2;
      border-top: ${borderW !== '0' ? borderW + ' solid ' + fg + '1a' : '1px solid ' + fg + '0d'};
    }
    #poster-stats {
      display: flex; align-items: flex-start; gap: 2.4vw;
    }
    #poster-mark {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.4vh; flex-shrink: 0;
    }
    ${borderW !== '0' ? `
    #poster-frame {
      position: absolute; inset: 14px;
      border: ${borderW} solid ${fg}; opacity: 0.18;
      z-index: 20; pointer-events: none;
    }` : ''}
  </style>
</head>
<body>

  ${borderW !== '0' ? '<div id="poster-frame"></div>' : ''}

  <!-- HEADER -->
  <div id="poster-header">
    <h1>${escapeHtml(trailName)}</h1>
    ${locationLine ? `<p>${escapeHtml(locationLine)}</p>` : ''}
    <div id="poster-rule"></div>
    ${logoHeaderHtml()}
  </div>

  <!-- MAP -->
  <div id="map-container">
    <div id="map"></div>
    ${logoHtml()}
    ${trailLegendHtml()}
    ${vignetteHtml()}
    ${grainHtml()}
  </div>

  <!-- TEXT OVERLAYS: poster-level, covers header + map + footer like browser -->
  ${textOverlaysHtml() ? `<div style="position:absolute;inset:0;pointer-events:none;z-index:25;">${textOverlaysHtml()}</div>` : ''}

  <!-- FOOTER -->
  <div id="poster-footer">
    ${logoFooterHtml()}
    <div id="poster-stats">${statsHtml}</div>

    ${occasionText ? `<p style="font-family:${typo.subFont};font-weight:${typo.subWeight};font-size:${(0.95 * (style_config.occasion_scale ?? 1.0)).toFixed(3)}vh;letter-spacing:0.22em;text-transform:uppercase;color:${fg};opacity:0.5;text-align:center;position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;">${escapeHtml(occasionText)}</p>` : ''}

    ${style_config.show_branding !== false ? `
    <div id="poster-mark">
      <svg viewBox="0 0 32 32" fill="none" style="width:4vh;height:4vh;color:${fg};opacity:0.4;">
        <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
        <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
        <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
        <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
        <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
      </svg>
      <span style="font-family:${typo.statsFont};font-weight:700;font-size:0.55vh;letter-spacing:0.22em;color:${fg};opacity:0.4;text-transform:uppercase;">RAD MAPS</span>
      <span style="font-family:${typo.statsFont};font-weight:400;font-size:0.42vh;letter-spacing:0.14em;color:${fg};opacity:0.28;">radmaps.studio</span>
    </div>` : ''}
  </div>

  <script>
    // ── styledtile:// protocol handler ────────────────────────────────────────
    // Mirrors the handler registered in MapPreview.vue.
    // Must be registered before the Map instance is created so MapLibre
    // can resolve the protocol during style load.
    maplibregl.addProtocol('styledtile', async function(params, abortController) {
      var url = params.url;
      var withoutScheme = url.slice('styledtile://'.length);
      var pipeIdx = withoutScheme.indexOf('|');
      if (pipeIdx === -1) throw new Error('Invalid styledtile URL');
      var effectPart = withoutScheme.slice(0, pipeIdx);
      var realUrl    = withoutScheme.slice(pipeIdx + 1);
      var parts = effectPart.split(',');
      var effect = parts[0];
      var args   = parts.slice(1);
      var res = await fetch(realUrl, { signal: abortController ? abortController.signal : undefined });
      if (!res.ok) throw new Error('Tile fetch failed: ' + res.status);
      var blob = await res.blob();
      var img  = await createImageBitmap(blob);
      var canvas = new OffscreenCanvas(img.width, img.height);
      var ctx  = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var imgData = ctx.getImageData(0, 0, img.width, img.height);
      var d = imgData.data;
      if (effect === 'duotone') {
        var sh = args[0], hi = args[1], strength = parseInt(args[2]) / 100;
        var sr = parseInt(sh.slice(0,2),16), sg = parseInt(sh.slice(2,4),16), sb = parseInt(sh.slice(4,6),16);
        var hr = parseInt(hi.slice(0,2),16), hg = parseInt(hi.slice(2,4),16), hb = parseInt(hi.slice(4,6),16);
        for (var i = 0; i < d.length; i += 4) {
          var lum = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) / 255;
          d[i]   = Math.round(d[i]   + (sr + (hr-sr)*lum - d[i])   * strength);
          d[i+1] = Math.round(d[i+1] + (sg + (hg-sg)*lum - d[i+1]) * strength);
          d[i+2] = Math.round(d[i+2] + (sb + (hb-sb)*lum - d[i+2]) * strength);
        }
      } else if (effect === 'posterize') {
        var levels = Math.max(2, parseInt(args[0]));
        var step = 255 / (levels - 1);
        for (var i = 0; i < d.length; i += 4) {
          d[i]   = Math.round(Math.round(d[i]  /step)*step);
          d[i+1] = Math.round(Math.round(d[i+1]/step)*step);
          d[i+2] = Math.round(Math.round(d[i+2]/step)*step);
        }
      } else if (effect === 'layer-color') {
        // args: [shadowHex, midHex, highlightHex] — trilinear luminance-band mapping
        function hx(s, o) { return parseInt(s.slice(o, o+2), 16); }
        var sr2 = hx(args[0],0), sg2 = hx(args[0],2), sb2 = hx(args[0],4);
        var mr2 = hx(args[1],0), mg2 = hx(args[1],2), mb2 = hx(args[1],4);
        var hr2 = hx(args[2],0), hg2 = hx(args[2],2), hb2 = hx(args[2],4);
        for (var i = 0; i < d.length; i += 4) {
          var L2 = (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) / 255;
          var sw2 = Math.max(0, 1 - L2 * 2);
          var hw2 = Math.max(0, (L2 - 0.5) * 2);
          var mw2 = 1 - sw2 - hw2;
          d[i]   = Math.round(sr2*sw2 + mr2*mw2 + hr2*hw2);
          d[i+1] = Math.round(sg2*sw2 + mg2*mw2 + hg2*hw2);
          d[i+2] = Math.round(sb2*sw2 + mb2*mw2 + hb2*hw2);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      var resultBlob = await canvas.convertToBlob({ type: 'image/png' });
      return { data: await resultBlob.arrayBuffer() };
    });

    // Viewport priority:
    // 1. User-adjusted framing from ProductSelector (explicit center/zoom/bearing)
    // 2. Saved map_center/map_zoom from style_config (user panned in the editor)
    // 3. fitBounds to bbox with padding (default, no saved view)
    ${framing ? `
    const map = new maplibregl.Map({
      container: 'map',
      style: ${styleJson},
      center: ${JSON.stringify(framing.center)},
      zoom: ${framing.zoom},
      bearing: ${framing.bearing ?? 0},
      pitch: ${framing.pitch ?? 0},
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    ` : (style_config.map_zoom != null && style_config.map_center != null) ? `
    const map = new maplibregl.Map({
      container: 'map',
      style: ${styleJson},
      center: ${JSON.stringify(style_config.map_center)},
      zoom: ${(() => {
        // Correct zoom for render viewport vs editor viewport.
        // The same zoom shows more area on a wider canvas, so we zoom in proportionally.
        // Cap per-preset: stamen tiles only have coverage to zoom 13.
        const maxZ = ['stadia-watercolor','stadia-toner'].includes(style_config.preset) ? 13 : 16
        if (!style_config.map_editor_width) return style_config.map_zoom
        return Math.min(style_config.map_zoom + Math.log2(width / style_config.map_editor_width), maxZ).toFixed(4)
      })()},
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    ` : `
    const map = new maplibregl.Map({
      container: 'map',
      style: ${styleJson},
      bounds: ${JSON.stringify(bbox)},
      fitBoundsOptions: { padding: ${padding} },
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    `}

    console.log('render: map object created, waiting for load event');
    var _tileErrors = 0;
    map.on('error', function(e) {
      var msg = e.error ? e.error.message : JSON.stringify(e);
      console.error('MapLibre error:', msg);
      _tileErrors++;
      if (_tileErrors === 8 && !window.__mapReady) {
        console.warn('render: forcing __mapReady after 8 tile errors');
        setTimeout(function() {
          if (!window.__mapReady) {
            ${pinLabelsIdleJs()}
            window.__mapReady = true;
          }
        }, 1500);
      }
    });

    // Absolute safety valve — should rarely trigger given the post-load timer below.
    // At DPR=2 (print), tile count is ~4× lower so load+idle normally fires within 30s.
    setTimeout(function() {
      if (!window.__mapReady) {
        console.warn('render: forcing __mapReady after 60s absolute timeout');
        window.__mapReady = true;
      }
    }, 60000);

    map.on('load', function() {
      console.log('render: load event fired, adding route and starting 20s grace timer');
      try {
        var _routeSrc = map.getSource('route');
        if (_routeSrc) _routeSrc.setData(${geojsonStr});
        ${trailSegmentsJs()}
        ${pinMarkersJs()}
        setTimeout(function() {
          if (!window.__mapReady) {
            console.warn('render: forcing __mapReady after 25s post-load grace');
            ${pinLabelsIdleJs()}
            window.__mapReady = true;
          }
        }, 25000);
        map.once('idle', function() {
          console.log('render: idle event fired');
          ${pinLabelsIdleJs()}
          window.__mapReady = true;
        });
      } catch(e) { console.error('render: load callback threw:', e && e.message || String(e)); }
    });
  </script>
</body>
</html>`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Route smoothing — exactly matches MapPreview.vue SMOOTH_PRESETS (10 levels)
const SMOOTH_PRESETS = [
  null,                        // 0 — Off
  { radius: 2,  passes: 1 },  // 1
  { radius: 3,  passes: 2 },  // 2
  { radius: 4,  passes: 2 },  // 3
  { radius: 6,  passes: 3 },  // 4
  { radius: 8,  passes: 3 },  // 5
  { radius: 10, passes: 4 },  // 6
  { radius: 13, passes: 4 },  // 7
  { radius: 16, passes: 5 },  // 8
  { radius: 20, passes: 5 },  // 9
  { radius: 25, passes: 6 },  // 10 — Max
]

function smoothLine(coords, strength) {
  const preset = SMOOTH_PRESETS[strength]
  if (!preset || coords.length < 3) return coords
  const { radius, passes } = preset
  let pts = coords.map(c => c.slice())
  for (let p = 0; p < passes; p++) {
    const out = pts.map(c => c.slice())
    for (let i = 1; i < pts.length - 1; i++) {
      const lo = Math.max(0, i - radius)
      const hi = Math.min(pts.length - 1, i + radius)
      const n = hi - lo + 1
      out[i] = pts[i].map((_, dim) => {
        let sum = 0
        for (let j = lo; j <= hi; j++) sum += pts[j][dim]
        return sum / n
      })
    }
    pts = out
    pts[0] = coords[0].slice()
    pts[pts.length - 1] = coords[coords.length - 1].slice()
  }
  return pts
}

function smoothGeojson(geojson, strength) {
  if (!strength) return geojson
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return { ...feature, geometry: { ...g, coordinates: smoothLine(g.coordinates, strength) } }
      }
      if (g.type === 'MultiLineString') {
        return { ...feature, geometry: { ...g, coordinates: g.coordinates.map(line => smoothLine(line, strength)) } }
      }
      return feature
    }),
  }
}

// Slice route GeoJSON by percentage (mirrors utils/trail.ts)
function sliceRouteByPct(geojson, startPct, endPct) {
  const allCoords = []
  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') allCoords.push(...g.coordinates)
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) allCoords.push(...line)
  }
  if (!allCoords.length) return { type: 'FeatureCollection', features: [] }
  const start = Math.floor(allCoords.length * Math.max(0, startPct) / 100)
  const end = Math.ceil(allCoords.length * Math.min(100, endPct) / 100)
  const sliced = allCoords.slice(start, Math.max(end, start + 2))
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: sliced } }] }
}

// Exclude deleted ranges from route (mirrors utils/trail.ts excludeRangesFromRoute)
function excludeRangesFromRoute(geojson, cropStart, cropEnd, deletedRanges) {
  const allCoords = []
  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') allCoords.push(...g.coordinates)
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) allCoords.push(...line)
  }
  if (!allCoords.length) return { type: 'FeatureCollection', features: [] }

  const total = allCoords.length
  const cropStartIdx = Math.floor(total * Math.max(0, cropStart) / 100)
  const cropEndIdx = Math.ceil(total * Math.min(100, cropEnd) / 100)

  let blocked = (deletedRanges ?? []).map(r => [
    Math.max(cropStartIdx, Math.floor(total * r.start / 100)),
    Math.min(cropEndIdx, Math.ceil(total * r.end / 100)),
  ]).filter(([s, e]) => e > s)
  blocked.sort((a, b) => a[0] - b[0])

  const merged = []
  for (const [s, e] of blocked) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    } else {
      merged.push([s, e])
    }
  }

  const lineCoords = []
  let cursor = cropStartIdx
  for (const [blockStart, blockEnd] of merged) {
    if (blockStart > cursor) {
      const coords = allCoords.slice(cursor, blockStart)
      if (coords.length >= 2) lineCoords.push(coords)
    }
    cursor = blockEnd
  }
  if (cursor < cropEndIdx) {
    const coords = allCoords.slice(cursor, cropEndIdx)
    if (coords.length >= 2) lineCoords.push(coords)
  }

  if (!lineCoords.length) return { type: 'FeatureCollection', features: [] }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: lineCoords.length === 1
        ? { type: 'LineString', coordinates: lineCoords[0] }
        : { type: 'MultiLineString', coordinates: lineCoords },
    }]
  }
}

// buildMapStyle is imported from ./mapStyle.js (esbuild bundle of utils/mapStyle.ts)


// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
app.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`Render worker listening on port ${PORT}`)
})
