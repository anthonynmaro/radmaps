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
  const { map_id, geojson, style_config, title, subtitle, stats, bbox, mapbox_token, maptiler_token } = request.body

  const jobId = randomUUID()
  jobs.set(jobId, { status: 'queued', map_id })

  // Kick off async render (don't await)
  renderMap({ jobId, map_id, geojson, style_config, title, subtitle, stats, bbox, mapbox_token, maptiler_token })
    .catch(async err => {
      app.log.error(err)
      jobs.set(jobId, { status: 'failed', error: err.message, map_id })

      // Write error sentinel to Supabase so the client can detect failure fast
      // instead of waiting for the 5-minute client-side poll timeout.
      try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
        await supabase
          .from('maps')
          .update({ render_url: `error:${err.message.slice(0, 200)}` })
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
async function renderMap({ jobId, map_id, geojson, style_config, title, subtitle, stats, bbox, mapbox_token, maptiler_token }) {
  jobs.set(jobId, { status: 'rendering', map_id })

  // Render at 18×24" × 300 DPI (Gelato's most popular large-format poster size).
  // Adding 3mm bleed on each side (≈ 35px at 300 DPI) gives the final canvas size.
  // For larger products (24×36") the render is upscaled by Gelato's print pipeline;
  // alternatively, pass product dimensions from the job payload to render at native size.
  const WIDTH_PX = 5470   // (18in + 6mm bleed) × 300 DPI ≈ 5400 + 70
  const HEIGHT_PX = 7270  // (24in + 6mm bleed) × 300 DPI ≈ 7200 + 70

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH_PX, height: HEIGHT_PX, deviceScaleFactor: 1 })

  // Build self-contained HTML page that renders the map
  const html = buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width: WIDTH_PX, height: HEIGHT_PX })
  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Wait for MapLibre to finish rendering
  await page.waitForFunction('window.__mapReady === true', { timeout: 30000 })
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

  const jpegPath = `${map_id}/render-${Date.now()}.jpg`
  const { error: jpegError } = await supabase.storage
    .from('maps')
    .upload(jpegPath, optimisedJpeg, { contentType: 'image/jpeg', upsert: true })

  if (jpegError) throw new Error(`JPEG upload failed: ${jpegError.message}`)

  const { data: { publicUrl: jpegUrl } } = supabase.storage.from('maps').getPublicUrl(jpegPath)

  // TODO: Generate PDF (Puppeteer print-to-PDF) — omitted for brevity
  // const pdfBuffer = await page.pdf({ width: `${WIDTH_PX}px`, height: `${HEIGHT_PX}px`, printBackground: true })

  // Update map record
  await supabase
    .from('maps')
    .update({ render_url: jpegUrl, status: 'rendered' })
    .eq('id', map_id)

  jobs.set(jobId, { status: 'complete', map_id, render_url: jpegUrl })
}

// ─── HTML template for server-side MapLibre render ───────────────────────────
// Uses vh units throughout (1vh = height/100 in Puppeteer's fixed viewport)
// matching cqh units in MapPreview.vue (1cqh = 1% of poster canvas height).
function buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width, height }) {
  const styleJson = JSON.stringify(buildMapStyle(style_config, mapbox_token, maptiler_token))
  const geojsonStr = JSON.stringify(geojson)
  const padding = Math.round(Math.min(width, height) * (style_config.padding_factor ?? 0.15))

  const fg = style_config.label_text_color || '#1C1917'
  const bg = style_config.label_bg_color || style_config.background_color || '#F7F4EF'
  const trailName = style_config.trail_name || title || 'Your Trail'
  const occasionText = style_config.occasion_text || ''
  const locationText = style_config.location_text || stats?.location || ''
  const maxElev = stats?.max_elevation_m ? `${Math.round(stats.max_elevation_m).toLocaleString()} M ELEV.` : ''
  const locationLine = [locationText ? locationText.toUpperCase() : '', maxElev].filter(Boolean).join('  ·  ')
  const distanceMi = stats?.distance_km ? (stats.distance_km * 0.621371).toFixed(1) : ''
  const elevGainFt = stats?.elevation_gain_m ? Math.round(stats.elevation_gain_m * 3.28084).toLocaleString() : ''

  // Typography per theme (mirrors THEME_TYPOGRAPHY in MapPreview.vue)
  const THEME_TYPOGRAPHY = {
    chalk:    { titleFont: "'Work Sans'",          titleWeight: '300', titleTracking: '0.38em', titleSize: '3.4vh', subFont: "'Work Sans'",          subWeight: '400', subTracking: '0.28em', statsFont: "'Work Sans'" },
    topaz:    { titleFont: "'Space Grotesk'",      titleWeight: '700', titleTracking: '0.06em', titleSize: '4.4vh', subFont: "'Space Grotesk'",      subWeight: '400', subTracking: '0.22em', statsFont: "'Space Grotesk'" },
    dusk:     { titleFont: "'DM Serif Display'",   titleWeight: '400', titleTracking: '0.03em', titleSize: '4.8vh', subFont: "'DM Sans'",            subWeight: '400', subTracking: '0.22em', statsFont: "'DM Sans'" },
    obsidian: { titleFont: "'Big Shoulders Display'", titleWeight: '800', titleTracking: '-0.01em', titleSize: '5.8vh', subFont: "'DM Sans'",        subWeight: '400', subTracking: '0.35em', statsFont: "'Big Shoulders Display'" },
    forest:   { titleFont: "'Oswald'",             titleWeight: '600', titleTracking: '0.08em', titleSize: '4.6vh', subFont: "'Oswald'",             subWeight: '300', subTracking: '0.22em', statsFont: "'Oswald'" },
    midnight: { titleFont: "'Fjalla One'",         titleWeight: '400', titleTracking: '0.12em', titleSize: '4.8vh', subFont: "'DM Sans'",            subWeight: '300', subTracking: '0.32em', statsFont: "'Fjalla One'" },
  }
  const typo = THEME_TYPOGRAPHY[style_config.color_theme ?? 'chalk'] ?? THEME_TYPOGRAPHY.chalk

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
    coordHtml = `<span style="display:block;font-family:${typo.statsFont},sans-serif;font-weight:500;font-size:1.2vh;letter-spacing:0.04em;color:${fg};opacity:0.65;">${fmtCoord(lat,'N','S')}</span>
                 <span style="display:block;font-family:${typo.statsFont},sans-serif;font-weight:500;font-size:1.2vh;letter-spacing:0.04em;color:${fg};opacity:0.65;">${fmtCoord(lng,'E','W')}</span>`
  }

  // Build stat blocks HTML
  const statsHtml = [
    distanceMi ? `<div style="display:flex;flex-direction:column;align-items:flex-start;">
      <span style="font-family:${typo.statsFont},sans-serif;font-weight:600;font-size:2.6vh;letter-spacing:-0.01em;line-height:1;color:${fg};">${distanceMi}</span>
      <span style="font-family:${typo.statsFont},sans-serif;font-weight:400;font-size:0.8vh;letter-spacing:0.18em;text-transform:uppercase;color:${fg};opacity:0.45;margin-top:0.55vh;">miles</span>
    </div>` : '',
    distanceMi && elevGainFt ? `<div style="width:1px;height:3vh;background:${fg};opacity:0.15;align-self:center;flex-shrink:0;"></div>` : '',
    elevGainFt ? `<div style="display:flex;flex-direction:column;align-items:flex-start;">
      <span style="font-family:${typo.statsFont},sans-serif;font-weight:600;font-size:2.6vh;letter-spacing:-0.01em;line-height:1;color:${fg};">${elevGainFt}</span>
      <span style="font-family:${typo.statsFont},sans-serif;font-weight:400;font-size:0.8vh;letter-spacing:0.18em;text-transform:uppercase;color:${fg};opacity:0.45;margin-top:0.55vh;">ft gain</span>
    </div>` : '',
    coordHtml ? `<div style="width:1px;height:3vh;background:${fg};opacity:0.15;align-self:center;flex-shrink:0;"></div><div>${coordHtml}</div>` : '',
  ].filter(Boolean).join('')

  // Logo HTML (when positioned over map)
  function logoHtml() {
    if (!style_config.show_logo || !style_config.logo_url) return ''
    const size = (style_config.logo_size ?? 8) * height / 100
    const pos = style_config.logo_position ?? 'map-top-right'
    if (pos === 'map-top-right') {
      return `<img src="${style_config.logo_url}" alt="" style="position:absolute;top:2%;right:2%;max-height:${size}px;max-width:15%;object-fit:contain;z-index:10;pointer-events:none;" />`
    }
    return ''
  }

  // Logo in footer-left
  function logoFooterHtml() {
    if (!style_config.show_logo || !style_config.logo_url || style_config.logo_position !== 'footer-left') return ''
    return `<img src="${style_config.logo_url}" alt="" style="max-height:4vh;max-width:10%;object-fit:contain;flex-shrink:0;" />`
  }

  // Logo in header-right
  function logoHeaderHtml() {
    if (!style_config.show_logo || !style_config.logo_url || style_config.logo_position !== 'header-right') return ''
    const size = (style_config.logo_size ?? 8) * height / 100
    return `<img src="${style_config.logo_url}" alt="" style="position:absolute;top:50%;right:7vw;transform:translateY(-50%);max-height:${size}px;max-width:12%;object-fit:contain;" />`
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
        <span style="font-family:${typo.statsFont},sans-serif;font-weight:500;font-size:${fontSize}px;color:${fg};opacity:0.85;">${escapeHtml(s.name)}</span>
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
      map.addLayer({ id: 'trail-seg-casing-${s.id}', type: 'line', source: 'trail-seg-${s.id}', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': ${w + 3}, 'line-opacity': ${op} } });
      map.addLayer({ id: 'trail-seg-line-${s.id}', type: 'line', source: 'trail-seg-${s.id}', layout: { 'line-join': 'round', 'line-cap': 'round'${s.dash ? ", 'line-dasharray': [4,3]" : ''} }, paint: { 'line-color': '${s.color}', 'line-width': ${w}, 'line-opacity': ${op} } });`
    }).join('')
  }

  // Font families needed for Google Fonts
  const fontsNeeded = new Set([
    typo.titleFont.replace(/'/g, '').split(',')[0],
    typo.statsFont.replace(/'/g, '').split(',')[0],
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
      padding: 3vh 7vw 2.2vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-end;
      gap: 1.1vh;
      position: relative;
    }
    #poster-header h1 {
      font-family: ${typo.titleFont}, sans-serif;
      font-weight: ${typo.titleWeight};
      letter-spacing: ${typo.titleTracking};
      font-size: ${typo.titleSize};
      line-height: 1.1;
      color: ${fg};
      text-align: center;
      text-transform: uppercase;
      margin: 0;
    }
    #poster-header p {
      font-family: ${typo.subFont}, sans-serif;
      font-weight: ${typo.subWeight};
      letter-spacing: ${typo.subTracking};
      font-size: 1.0vh;
      color: ${fg};
      opacity: 0.5;
      text-transform: uppercase;
      text-align: center;
      margin: 0;
    }
    #poster-rule {
      width: 100%; height: 1px;
      background: ${fg}; opacity: 0.12;
      margin-top: 0.4vh; flex-shrink: 0;
    }
    #map-container {
      flex: 1; position: relative; overflow: hidden;
    }
    #map { width: 100%; height: 100%; }
    #poster-footer {
      flex-shrink: 0;
      background: ${bg};
      padding: 1.8vh 7vw;
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

    ${occasionText ? `<p style="font-family:${typo.subFont},sans-serif;font-weight:${typo.subWeight};font-size:0.95vh;letter-spacing:0.22em;text-transform:uppercase;color:${fg};opacity:0.5;text-align:center;position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;">${escapeHtml(occasionText)}</p>` : ''}

    <div id="poster-mark">
      <svg viewBox="0 0 32 32" fill="none" style="width:4vh;height:4vh;color:${fg};opacity:0.4;">
        <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
        <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
        <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
        <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
        <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
      </svg>
      <span style="font-family:${typo.statsFont},sans-serif;font-weight:700;font-size:0.55vh;letter-spacing:0.22em;color:${fg};opacity:0.4;text-transform:uppercase;">RAD MAPS</span>
      ${style_config.show_branding !== false ? `<span style="font-family:${typo.statsFont},sans-serif;font-weight:400;font-size:0.42vh;letter-spacing:0.14em;color:${fg};opacity:0.28;">radmaps.studio</span>` : ''}
    </div>
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
      }
      ctx.putImageData(imgData, 0, 0);
      var resultBlob = await canvas.convertToBlob({ type: 'image/png' });
      return { data: await resultBlob.arrayBuffer() };
    });

    const map = new maplibregl.Map({
      container: 'map',
      style: ${styleJson},
      bounds: ${JSON.stringify(bbox)},
      fitBoundsOptions: { padding: ${padding} },
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: ${geojsonStr} });
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': ${style_config.route_width + 3}, 'line-opacity': ${style_config.route_opacity} }
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '${style_config.route_color}', 'line-width': ${style_config.route_width}, 'line-opacity': ${style_config.route_opacity} }
      });
      ${trailSegmentsJs()}
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
      ...(config.show_hillshade ? { 'mapbox-dem': demSource() } : {}),
      ...(config.show_contours ? { 'mapbox-terrain-v2': terrainV2Source(mapboxToken) } : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
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
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      'mapbox-outdoors': {
        type: 'raster',
        tiles: styledTileUrls(config, [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`]),
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...(config.show_hillshade ? { 'mapbox-dem': demSource() } : {}),
      ...(config.show_contours ? { 'mapbox-terrain-v2': terrainV2Source(token) } : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
      {
        id: 'outdoors-tiles', type: 'raster', source: 'mapbox-outdoors',
        paint: {
          'raster-opacity':    config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': Math.max(-1, Math.min(1, (config.show_hillshade ? -0.15 : 0) + (config.tile_saturation ?? 0))),
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
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
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1.0],
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
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 14, 1.5],
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.5],
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
