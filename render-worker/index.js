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
    .catch(err => {
      app.log.error(err)
      jobs.set(jobId, { status: 'failed', error: err.message, map_id })
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
function buildRenderHtml({ geojson, style_config, bbox, title, subtitle, stats, mapbox_token, maptiler_token, width, height }) {
  const styleJson = JSON.stringify(buildMapStyle(style_config, mapbox_token, maptiler_token))
  const geojsonStr = JSON.stringify(geojson)
  const padding = Math.round(Math.min(width, height) * style_config.padding_factor)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
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
      map.once('idle', () => { window.__mapReady = true; });
    });
  </script>
</body>
</html>`
}

// ─── Style builder for the worker (mirrors utils/mapStyle.ts) ────────────────
// No maplibre-contour in the worker — uses Mapbox terrain-v2 vector tiles for contours.
function buildMapStyle(config, mapboxToken, maptilerToken) {
  if (config.preset === 'topographic') {
    return buildTopographicStyle(config, mapboxToken)
  }
  return buildMinimalistStyle(config, mapboxToken, maptilerToken)
}

function buildMinimalistStyle(config, mapboxToken, maptilerToken) {
  const base = config.base_tile_style ?? 'carto-light'

  let baseTileSource, baseTileOpacity
  if (base === 'maptiler-outdoor' || base === 'maptiler-topo' || base === 'maptiler-winter') {
    const styleMap = { 'maptiler-outdoor': 'outdoor-v2', 'maptiler-topo': 'topo-v2', 'maptiler-winter': 'winter-v2' }
    baseTileSource = {
      type: 'raster',
      tiles: [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerToken ?? ''}`],
      tileSize: 512,
      attribution: '© MapTiler © OpenStreetMap contributors',
    }
    baseTileOpacity = 0.85
  } else {
    const dark = base === 'carto-dark'
    const sub = (s) => ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}.png`)
    baseTileSource = {
      type: 'raster',
      tiles: dark ? sub('dark_all') : sub('light_all'),
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
      { id: 'base-tiles', type: 'raster', source: 'base-tiles', paint: { 'raster-opacity': baseTileOpacity } },
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
        tiles: [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`],
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...(config.show_hillshade ? { 'mapbox-dem': demSource() } : {}),
      ...(config.show_contours ? { 'mapbox-terrain-v2': terrainV2Source(token) } : {}),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
      { id: 'outdoors-tiles', type: 'raster', source: 'mapbox-outdoors', paint: { 'raster-opacity': config.show_hillshade ? 0.75 : 0.9 } },
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
