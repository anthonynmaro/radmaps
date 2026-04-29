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
  await page.setViewport({ width: WIDTH_PX, height: HEIGHT_PX, deviceScaleFactor: 1 })

  // Forward in-page console output to the worker log so tile errors are visible.
  page.on('console', msg => app.log.info(`[page:${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => app.log.error(`[page:error] ${err.message}`))

  // Build self-contained HTML page that renders the map
  // If framing data is provided (user adjusted center/zoom in ProductSelector),
  // pass it through so the render matches the user's chosen view.
  const html = buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width: WIDTH_PX, height: HEIGHT_PX, framing })
  // waitUntil:'load' ensures the MapLibre CDN script has executed before the
  // inline map-init script runs. networkidle is intentionally avoided because
  // MapLibre fires hundreds of tile requests that would stall it indefinitely.
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 })

  // Preview: 30s. Print: 100s (page script force-completes at 80s via tile-error counter or hard timeout).
  await page.waitForFunction('window.__mapReady === true', { timeout: isPreview ? 30000 : 100000 })
  await new Promise(resolve => setTimeout(resolve, 500)) // Extra settle time

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
  const styleJson = JSON.stringify(buildMapStyle(style_config, mapbox_token, maptiler_token))
  const cropStart = style_config.route_crop_start ?? 0
  const cropEnd = style_config.route_crop_end ?? 100
  const croppedGeojson = (cropStart > 0 || cropEnd < 100) ? sliceRouteByPct(geojson, cropStart, cropEnd) : geojson
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
      return `<div style="position:absolute;left:${o.x}%;top:${o.y}%;font-family:'${o.font_family}',sans-serif;font-size:${fs}px;color:${o.color};text-align:${o.alignment};opacity:${o.opacity};font-weight:${o.bold?700:400};white-space:pre-wrap;transform:translateX(${xOffset});pointer-events:none;z-index:8;${bgStyle}">${escapeHtml(o.content)}</div>`
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
    const segments = (style_config.trail_segments ?? []).filter(s => s.visible)
    if (!segments.length) return ''
    return segments.map(s => {
      const sliced = sliceRouteByPct(geojson, s.section_start, s.section_end)
      const slicedStr = JSON.stringify(sliced)
      const w = s.width ?? style_config.route_width ?? 3
      const op = s.opacity ?? 0.9
      const dashArray = s.dash ? '[4,3]' : 'undefined'
      return `
      map.addSource('trail-seg-${s.id}', { type: 'geojson', data: ${slicedStr} });
      map.addLayer({ id: 'trail-seg-casing-${s.id}', type: 'line', source: 'trail-seg-${s.id}', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '${style_config.background_color ?? '#F7F4EF'}', 'line-width': ${w + 3}, 'line-opacity': ${op} } });
      map.addLayer({ id: 'trail-seg-line-${s.id}', type: 'line', source: 'trail-seg-${s.id}', layout: { 'line-join': 'round', 'line-cap': 'round'${s.dash ? ", 'line-dasharray': [4,3]" : ''} }, paint: { 'line-color': '${s.color}', 'line-width': ${w}, 'line-opacity': ${op} } });`
    }).join('')
  }

  // Flag marker JS (run inside map.on('load')).
  // Creates maplibregl.Marker DOM elements — Puppeteer screenshots capture DOM
  // overlays, so these appear correctly in the rendered image.
  // Start flag: pole leans LEFT, pennant extends RIGHT.
  // Finish flag: pole leans RIGHT, checkered rect extends LEFT.
  // Opposing lean gives natural separation on loop trailheads — no offset hack needed.
  function pinMarkersJs() {
    const showStart = style_config.show_start_pin !== false
    const showFinish = style_config.show_finish_pin !== false
    if (!showStart && !showFinish) return ''

    let startCoord = null
    let endCoord = null
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

    const startJson = JSON.stringify(startCoord)
    const endJson   = JSON.stringify(endCoord)

    // Mirrors MapPreview.vue: start pole on LEFT (anchor=bottom-left),
    // finish pole on RIGHT (anchor=bottom-right) → no overlap at loop trailheads.
    return `
      (function() {
        var GREEN = '#2D6A4F', RED = '#B91C1C';
        function flagSvg(type) {
          if (type === 'start') {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" style="display:block;overflow:visible">'
              + '<line x1="2" y1="34" x2="7" y2="4" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.85"/>'
              + '<polygon points="7,4 7,15 23,9.5" fill="white" opacity="0.85"/>'
              + '<line x1="2" y1="34" x2="7" y2="4" stroke="' + GREEN + '" stroke-width="2" stroke-linecap="round"/>'
              + '<polygon points="7,4 7,15 23,9.5" fill="' + GREEN + '"/>'
              + '<circle cx="2" cy="34" r="3.5" fill="white" opacity="0.85"/>'
              + '<circle cx="2" cy="34" r="2.2" fill="' + GREEN + '"/>'
              + '</svg>';
          }
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" style="display:block;overflow:visible">'
            + '<line x1="22" y1="34" x2="17" y2="4" stroke="white" stroke-width="4" stroke-linecap="round" opacity="0.85"/>'
            + '<rect x="1" y="4" width="16" height="12" fill="white" opacity="0.85"/>'
            + '<line x1="22" y1="34" x2="17" y2="4" stroke="' + RED + '" stroke-width="2" stroke-linecap="round"/>'
            + '<rect x="1"  y="4"  width="8" height="6" fill="' + RED + '"/>'
            + '<rect x="9"  y="4"  width="8" height="6" fill="white"/>'
            + '<rect x="1"  y="10" width="8" height="6" fill="white"/>'
            + '<rect x="9"  y="10" width="8" height="6" fill="' + RED + '"/>'
            + '<circle cx="22" cy="34" r="3.5" fill="white" opacity="0.85"/>'
            + '<circle cx="22" cy="34" r="2.2" fill="' + RED + '"/>'
            + '</svg>';
        }
        function makeMarker(type, coord, anchor) {
          var el = document.createElement('div');
          el.style.cssText = 'display:block;pointer-events:none;';
          el.innerHTML = flagSvg(type);
          new maplibregl.Marker({ element: el, anchor: anchor })
            .setLngLat(coord)
            .addTo(map);
        }
        ${showStart && startCoord ? `makeMarker('start', ${startJson}, 'bottom-left');`  : ''}
        ${showFinish && endCoord  ? `makeMarker('finish', ${endJson},  'bottom-right');` : ''}
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
      font-size: ${typo.titleSize}vh;
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
      font-size: ${typo.subSize}vh;
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
    <div style="position:absolute;inset:0;pointer-events:none;z-index:8;">${textOverlaysHtml()}</div>
    ${vignetteHtml()}
    ${grainHtml()}
  </div>

  <!-- FOOTER -->
  <div id="poster-footer">
    ${logoFooterHtml()}
    <div id="poster-stats">${statsHtml}</div>

    ${occasionText ? `<p style="font-family:${typo.subFont};font-weight:${typo.subWeight};font-size:0.95vh;letter-spacing:0.22em;text-transform:uppercase;color:${fg};opacity:0.5;text-align:center;position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;">${escapeHtml(occasionText)}</p>` : ''}

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

    // If user-adjusted framing is provided, use center/zoom instead of fitBounds.
    // This ensures the print render matches exactly what the user saw in the preview.
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

    var _tileErrors = 0;
    map.on('error', function(e) {
      var msg = e.error ? e.error.message : JSON.stringify(e);
      console.error('MapLibre error:', msg);
      // If many tile errors accumulate (e.g. Mapbox terrain tiles 401ing),
      // stop waiting — take the screenshot with whatever loaded.
      _tileErrors++;
      if (_tileErrors >= 8 && !window.__mapReady) {
        console.warn('render: forcing __mapReady after ' + _tileErrors + ' tile errors');
        setTimeout(function() { if (!window.__mapReady) window.__mapReady = true; }, 1500);
      }
    });

    // Hard safety valve at 80s (Puppeteer hard timeout is 100s).
    setTimeout(function() {
      if (!window.__mapReady) {
        console.warn('render: forcing __mapReady after 80s fallback');
        window.__mapReady = true;
      }
    }, 80000);

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: ${geojsonStr} });
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '${style_config.background_color ?? '#F7F4EF'}', 'line-width': ${style_config.route_width + 3}, 'line-opacity': ${style_config.route_opacity} }
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '${style_config.route_color}', 'line-width': ${style_config.route_width}, 'line-opacity': ${style_config.route_opacity} }
      });
      ${trailSegmentsJs()}
      ${pinMarkersJs()}
      map.once('idle', () => { window.__mapReady = true; });
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

// Route smoothing — mirrors MapPreview.vue smoothLine/smoothGeojson (utils/posterData.ts pattern)
const SMOOTH_PRESETS = [
  null,
  { radius: 3,  passes: 2 },
  { radius: 6,  passes: 3 },
  { radius: 10, passes: 4 },
  { radius: 16, passes: 5 },
  { radius: 25, passes: 6 },
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

// ─── Style builder for the worker (mirrors utils/mapStyle.ts) ────────────────
// No maplibre-contour in the worker — uses Mapbox terrain-v2 vector tiles for contours.
function buildMapStyle(config, mapboxToken, maptilerToken) {
  if (config.preset === 'topographic') {
    return buildTopographicStyle(config, mapboxToken)
  }
  return buildMinimalistStyle(config, mapboxToken, maptilerToken)
}

// Mirrors styledTileUrls() in utils/mapStyle.ts
function styledTileUrls(config, urls) {
  const effect = config.tile_effect ?? 'none'
  if (effect === 'none') return urls
  if (effect === 'duotone') {
    const shadow    = (config.label_text_color  ?? '#1C1917').replace('#', '')
    const highlight = (config.background_color  ?? '#F7F4EF').replace('#', '')
    const strength  = Math.round((config.tile_duotone_strength ?? 0.9) * 100)
    return urls.map(u => `styledtile://duotone,${shadow},${highlight},${strength}|${u}`)
  }
  if (effect === 'posterize') {
    const levels = config.tile_posterize_levels ?? 4
    return urls.map(u => `styledtile://posterize,${levels}|${u}`)
  }
  return urls
}

function buildMinimalistStyle(config, mapboxToken, maptilerToken) {
  const base = config.base_tile_style ?? 'carto-light'

  let baseTileSource, baseTileOpacity
  if (base === 'maptiler-outdoor' || base === 'maptiler-topo' || base === 'maptiler-winter') {
    const styleMap = { 'maptiler-outdoor': 'outdoor-v2', 'maptiler-topo': 'topo-v2', 'maptiler-winter': 'winter-v2' }
    baseTileSource = {
      type: 'raster',
      tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerToken ?? ''}`]),
      tileSize: 512,
      attribution: '© MapTiler © OpenStreetMap contributors',
    }
    baseTileOpacity = 0.85
  } else {
    const dark = base === 'carto-dark'
    const sub = (s) => ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}.png`)
    baseTileSource = {
      type: 'raster',
      tiles: styledTileUrls(config, dark ? sub('dark_all') : sub('light_all')),
      tileSize: 256,
      attribution: '© CARTO © OpenStreetMap contributors',
    }
    baseTileOpacity = dark ? 0.45 : 0.55
  }

  const glyphs = mapboxToken
    ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxToken}`
    : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

  return {
    version: 8,
    glyphs,
    sources: {
      'base-tiles': baseTileSource,
      // Gate Mapbox sources on token presence — empty token causes 401s that block idle
      ...(config.show_hillshade && mapboxToken ? { 'mapbox-dem': demSource() } : {}),
      ...(config.show_contours && mapboxToken ? { 'mapbox-terrain-v2': terrainV2Source(mapboxToken) } : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.land_color ?? config.background_color } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    baseTileOpacity,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config),
    ],
  }
}

function buildTopographicStyle(config, mapboxToken) {
  const token = mapboxToken ?? ''
  return {
    version: 8,
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      // Skip Mapbox outdoors tiles if token is absent — avoids 401s blocking idle
      ...(token ? {
        'mapbox-outdoors': {
          type: 'raster',
          tiles: styledTileUrls(config, [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`]),
          tileSize: 512,
          attribution: '© Mapbox © OpenStreetMap contributors',
        },
      } : {}),
      ...(config.show_hillshade && token ? { 'mapbox-dem': demSource() } : {}),
      ...(config.show_contours && token ? { 'mapbox-terrain-v2': terrainV2Source(token) } : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.land_color ?? config.background_color } },
      // Only add the outdoors raster layer if we have a token (source won't exist otherwise)
      ...(token ? [{
        id: 'outdoors-tiles', type: 'raster', source: 'mapbox-outdoors',
        paint: {
          'raster-opacity':    config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': Math.max(-1, Math.min(1, (config.show_hillshade ? -0.15 : 0) + (config.tile_saturation ?? 0))),
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      }] : []),
      ...hillshadeLayers(config),
      ...contourLayers(config),
    ],
  }
}

function demSource() {
  return {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium',
  }
}

function terrainV2Source(token) {
  return {
    type: 'vector',
    tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${token ?? ''}`],
    minzoom: 10,
    maxzoom: 15,
  }
}

function hillshadeLayers(config) {
  if (!config.show_hillshade) return []
  return [{
    id: 'hillshade',
    type: 'hillshade',
    source: 'mapbox-dem',
    paint: {
      'hillshade-shadow-color': '#000000',
      'hillshade-highlight-color': '#FFFFFF',
      'hillshade-accent-color': '#000000',
      'hillshade-illumination-direction': 335,
      'hillshade-exaggeration': config.hillshade_intensity,
    },
  }]
}

function contourLayers(config) {
  if (!config.show_contours) return []
  const detail = Math.round(config.contour_detail ?? 2)
  const layers = []
  const minorW = config.contour_minor_width ?? 1
  const majorW = config.contour_major_width ?? 1
  if (detail >= 2) {
    layers.push({
      id: 'contours-minor',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, config.contour_opacity, 14, config.contour_opacity * 0.9],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8 * minorW, 14, 1.0 * minorW],
      },
    })
  }
  if (detail >= 1) {
    layers.push({
      id: 'contours-mid',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 5],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': config.contour_opacity,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1 * minorW, 14, 1.5 * minorW],
      },
    })
  }
  layers.push({
    id: 'contours-major',
    type: 'line',
    source: 'mapbox-terrain-v2',
    'source-layer': 'contour',
    filter: ['==', ['get', 'index'], 10],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': config.contour_major_color,
      'line-opacity': config.contour_opacity,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5 * majorW, 14, 2.5 * majorW],
    },
  })
  if (config.show_elevation_labels) {
    layers.push({
      id: 'contours-labels',
      type: 'symbol',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 10],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 14, 11],
        'text-letter-spacing': 0.05,
        'text-padding': 2,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.5,
        'text-opacity': config.contour_opacity,
      },
    })
  }
  return layers
}

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
app.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`Render worker listening on port ${PORT}`)
})
