/**
 * Standalone test harness:
 *   - Pulls a list of map IDs from prod Supabase (read-only)
 *   - Renders each through the v4 pipeline (Native + Sharp chrome)
 *   - Saves PNG + JPEG to ./outputs/
 *
 * Bypasses the worker's HTTP layer, render_cache lookups, and Storage
 * uploads — the goal is a visual comparison against the editor's render.
 *
 * Usage:
 *   tsx --env-file=.env scripts/test-render.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { buildMapStyle } from '../../utils/mapStyle.js'
import { getPrintFraming } from '../../utils/print/printFraming.js'
import {
  computeOverlayLayout,
  mercatorProjector,
} from '../../utils/render/overlayLayout.js'
import { applyPrintScaleToStyle, getPrintScale } from '../../utils/render/printScale.js'
import { smoothGeojson } from '../../utils/render/routeSmoothing.js'
import {
  excludeRangesFromRoute,
  sliceRouteByPercent,
  trailSourceId,
} from '../../utils/trail.js'
import { compositePoster } from '../src/chrome/compositor.js'
import { headerBandHeightPx, footerBandHeightPx } from '../src/chrome/svgTemplate.js'
import { getPosterLayout, getPosterTypography } from '../../utils/posterData.js'
import { fetchLogo } from '../src/chrome/logoFetch.js'
import { renderMapLayer } from '../src/renderer/index.js'
import { resolveCamera } from '../src/renderer/native.js'

/**
 * Inject GeoJSON data into the style's empty geojson sources, mirroring
 * what the browser editor's populateRouteSource / populateSegmentSources
 * does at runtime. Without this, MapLibre Native renders a map with all
 * the chrome (basemap, contours, hillshade) but the route + segments are
 * invisible because their sources are empty.
 *
 * Now uses the shared utils/render/routeSmoothing.ts (Tier-1 anti-drift
 * extraction) so editor and worker apply identical smoothing.
 *
 * Returns the processed (smoothed, cropped) geojson so the overlay
 * layout can be computed against the same coordinates the map shows.
 */
function injectGeojsonSources(
  styleJson: any,
  rawGeojson: GeoJSON.FeatureCollection,
  styleConfig: any,
): { sourcesPopulated: string[]; processedGeojson: GeoJSON.FeatureCollection } {
  const populated: string[] = []
  const sources = styleJson.sources as Record<string, any>

  // route — apply crop / deleted ranges, then smoothing (shared with editor).
  const cropStart = styleConfig.route_crop_start ?? 0
  const cropEnd = styleConfig.route_crop_end ?? 100
  const deletedRanges = styleConfig.route_deleted_ranges ?? []
  const hasModification = cropStart > 0 || cropEnd < 100 || deletedRanges.length > 0
  const cropped = hasModification
    ? excludeRangesFromRoute(rawGeojson, cropStart, cropEnd, deletedRanges)
    : rawGeojson
  const smoothStrength = styleConfig.route_smooth ?? 0
  const processed = smoothGeojson(cropped, smoothStrength)

  if (sources.route) {
    sources.route.data = processed
    populated.push('route')
  }

  // trail segments
  const handleFeatures: GeoJSON.Feature[] = []
  for (const seg of (styleConfig.trail_segments ?? [])) {
    if (!seg.visible) continue
    const sliced = sliceRouteByPercent(rawGeojson, seg.section_start, seg.section_end)
    const sourceId = trailSourceId(seg)
    if (sources[sourceId]) {
      sources[sourceId].data = sliced
      populated.push(sourceId)
    }
    const coords = (sliced.features[0]?.geometry as GeoJSON.LineString | undefined)?.coordinates
    if (coords && coords.length >= 2) {
      handleFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords[0] },
        properties: { color: seg.color },
      })
      handleFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords[coords.length - 1] },
        properties: { color: seg.color },
      })
    }
  }
  if (sources['segment-handles']) {
    sources['segment-handles'].data = { type: 'FeatureCollection', features: handleFeatures }
    populated.push('segment-handles')
  }

  return { sourcesPopulated: populated, processedGeojson: processed }
}

interface ProdMapRow {
  id: string
  title: string
  geojson: GeoJSON.FeatureCollection
  stats: { distance_mi?: number; ascent_ft?: number; [k: string]: unknown }
  bbox: [number, number, number, number]
  style_config: Record<string, unknown>
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN
const MAPTILER_TOKEN = process.env.MAPTILER_TOKEN
const STADIA_API_KEY = process.env.STADIA_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY required (root .env)')
}

const TARGETS: Array<{ id: string; label: string; size: '18x24' | '24x36' | '16x20' | '11x14' | '8x10' }> = [
  { id: '50bf79ce-7a6b-47f5-bc7a-3fd5690f5c8e', label: 'whiskey-off-road',  size: '18x24' },
  { id: '6844d3ac-b1bc-45de-acbc-8d91f2c4d7ff', label: 'kickapoo-mtb',      size: '18x24' },
]

async function fetchMap(id: string): Promise<ProdMapRow> {
  const url = `${SUPABASE_URL}/rest/v1/maps?id=eq.${id}&select=id,title,geojson,stats,bbox,style_config`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: 'application/vnd.pgrst.object+json',
    },
  })
  if (!res.ok) {
    throw new Error(`fetchMap(${id}) failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as ProdMapRow
}

// Set RENDER_CLASS=proof for 150 DPI (faster), 'final' (default) for 300 DPI
// print-ready output (200 DPI for 32×48 per PrintProviderProfile.maxDpi).
const RENDER_CLASS: 'proof' | 'final' = (process.env.RENDER_CLASS as 'proof' | 'final') || 'final'

async function renderOne({ id, label, size }: typeof TARGETS[0]) {
  console.log(`\n──── ${label}  (${id}, ${size}, ${RENDER_CLASS}) ────`)
  const map = await fetchMap(id)
  console.log(
    `  title="${map.title}"  preset=${(map.style_config as { preset?: string }).preset ?? '?'}  ` +
      `geojson features=${map.geojson.features.length}`,
  )

  const framing = getPrintFraming(size, RENDER_CLASS)
  const rawRgbaMb = (framing.fullWidthPx * framing.fullHeightPx * 4) / 1e6
  console.log(
    `  framing: ${framing.fullWidthPx}×${framing.fullHeightPx}px @ ${framing.dpi}dpi  ` +
      `bleed=${framing.bleedIn.toFixed(2)}in  raw RGBA=${rawRgbaMb.toFixed(0)}MB`,
  )

  // Build the same MapLibre style JSON the browser editor uses.
  let styleJson = buildMapStyle(
    map.style_config as never,
    MAPBOX_TOKEN,
    MAPTILER_TOKEN,
    undefined,
    STADIA_API_KEY,
  ) as any

  // Plan v4 §10: scale layer line widths / label sizes for print DPI.
  // Without this, a 4.5px route line is hairline-thin on a 5471px-wide
  // 300 DPI canvas; with it, lines and labels look correct at print
  // viewing distance.
  const printScale = getPrintScale({ dpi: framing.dpi })
  styleJson = applyPrintScaleToStyle(styleJson, printScale)
  console.log(
    `  ✓ print scale: route=${printScale.route.toFixed(2)} contours=${printScale.contours.toFixed(2)} labels=${printScale.labels.toFixed(2)}`,
  )

  // CRITICAL: inject the geojson data into empty sources, otherwise the
  // route + segments render as empty layers (the v4 worker is missing
  // this step — see scripts/test-render.ts injectGeojsonSources comment).
  // Returns the processed (cropped + smoothed) geojson so we can use it
  // for overlay-layout computation against the same coords the map shows.
  const { sourcesPopulated, processedGeojson } = injectGeojsonSources(
    styleJson,
    map.geojson,
    map.style_config,
  )
  console.log(`  ✓ injected sources: [${sourcesPopulated.join(', ')}]`)

  const t0 = Date.now()

  // Native renderer — produces oversized full-bleed map PNG.
  const renderResult = await renderMapLayer({
    styleJson,
    styleConfig: map.style_config as never,
    framing,
    fallbackCenter: [
      (map.bbox[0] + map.bbox[2]) / 2,
      (map.bbox[1] + map.bbox[3]) / 2,
    ],
    fallbackZoom: 11,
  })
  const tMap = Date.now() - t0
  console.log(
    `  ✓ map rendered: ${renderResult.widthPx}×${renderResult.heightPx}px  ` +
      `backend=${renderResult.backend}  ${tMap}ms  ` +
      `(${(renderResult.pngBuffer.byteLength / 1e6).toFixed(2)} MB)`,
  )

  // Save the raw map PNG (no chrome) for comparison.
  const outDir = path.join(import.meta.dirname, '..', 'outputs')
  await fs.mkdir(outDir, { recursive: true })
  const mapOnlyPath = path.join(outDir, `${label}.map-only.png`)
  await fs.writeFile(mapOnlyPath, renderResult.pngBuffer)
  console.log(`  ✓ saved ${mapOnlyPath}`)

  // Pre-fetch logo if enabled.
  let logo = null
  const sc = map.style_config as { show_logo?: boolean; logo_url?: string }
  if (sc.show_logo && sc.logo_url) {
    try {
      logo = await fetchLogo(sc.logo_url)
      if (logo) console.log(`  ✓ logo fetched: ${logo.buffer.byteLength} bytes`)
      else console.log(`  ⚠ logo URL rejected by SSRF whitelist`)
    } catch (err) {
      console.log(`  ⚠ logo fetch failed (continuing without): ${(err as Error).message}`)
    }
  }

  // Compute pin + leader-line layout using the SAME camera the renderer
  // used. With ratio=1 in the Native renderer (see native.ts), the zoom
  // is in physical-pixel terms — same width the projector uses.
  const camera = resolveCamera(map.style_config as never, framing.fullWidthPx) ?? {
    center: [
      (map.bbox[0] + map.bbox[2]) / 2,
      (map.bbox[1] + map.bbox[3]) / 2,
    ] as [number, number],
    zoom: 11,
  }
  const project = mercatorProjector({
    center: camera.center,
    zoom: camera.zoom,
    viewport: { w: framing.fullWidthPx, h: framing.fullHeightPx },
  })
  const pinOffset = Math.max(40, framing.fullHeightPx * 0.07)
  // Editor parity (MapPreview.vue:1176): leader-line dots are projected
  // from the RAW route geojson, NOT the cropped/deleted version. The
  // editor's populateRouteSource applies crops to the visible polyline,
  // but recomputeOverlays uses props.map.geojson directly so segment
  // start dots stay anchored to the user's original route. Using
  // processedGeojson here was making segments project to different X
  // positions and end up in the wrong left/right bucket.
  const overlayLayout = computeOverlayLayout({
    styleConfig: map.style_config as never,
    geojson: map.geojson,
    viewport: { w: framing.fullWidthPx, h: framing.fullHeightPx },
    project,
    pinOffset,
    headerH: headerBandHeightPx(
      getPosterLayout(map.style_config as never),
      getPosterTypography(map.style_config as never),
      map.style_config as never,
      framing,
    ),
    footerH: footerBandHeightPx(map.style_config as never, framing),
  })
  console.log(
    `  ✓ overlay layout: pins=${overlayLayout.pins.length}  leaders=${overlayLayout.leaderLines.length}`,
  )

  // Compose chrome over the map.
  const t1 = Date.now()
  const compResult = await compositePoster({
    mapPng: renderResult.pngBuffer,
    framing,
    styleConfig: map.style_config as never,
    stats: map.stats as never,
    logo,
    overlayLayout,
    bbox: map.bbox,
  })
  const finalJpeg = compResult.jpegBuffer
  const tComp = Date.now() - t1
  console.log(
    `  ✓ chrome composited: ${(finalJpeg.byteLength / 1e6).toFixed(2)} MB  ${tComp}ms`,
  )

  const finalPath = path.join(outDir, `${label}.final.jpg`)
  await fs.writeFile(finalPath, finalJpeg)
  console.log(`  ✓ saved ${finalPath}`)

  // Print-ready sanity checks:
  //   1. Pixel dimensions match expected framing
  //   2. File size under Gelato's 200 MB limit
  //   3. sRGB ICC profile embedded
  //   4. Format is JPEG
  const meta = await sharp(finalJpeg).metadata()
  const dimsMatch =
    meta.width === framing.fullWidthPx && meta.height === framing.fullHeightPx
  const fileSizeMb = finalJpeg.byteLength / 1e6
  const underLimit = fileSizeMb < 200
  const isJpeg = meta.format === 'jpeg'
  const hasIcc = !!meta.icc
  // librsvg-rendered SVG → Sharp JPEG. Sharp tags sRGB by default; verify.
  const memoryPeakMb = process.memoryUsage().rss / 1e6

  const checks = [
    { name: 'dimensions', pass: dimsMatch, detail: `${meta.width}×${meta.height} vs ${framing.fullWidthPx}×${framing.fullHeightPx}` },
    { name: 'file size <200MB', pass: underLimit, detail: `${fileSizeMb.toFixed(1)} MB` },
    { name: 'format=jpeg', pass: isJpeg, detail: meta.format ?? 'unknown' },
    { name: 'ICC profile', pass: hasIcc, detail: hasIcc ? `${meta.icc?.length ?? 0} bytes` : 'missing' },
    { name: 'memory peak', pass: memoryPeakMb < 2048, detail: `${memoryPeakMb.toFixed(0)} MB RSS` },
  ]
  for (const c of checks) {
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}: ${c.detail}`)
  }

  const allPass = checks.every((c) => c.pass)
  if (!allPass) {
    console.log(`  ⚠ NOT print-ready: ${checks.filter((c) => !c.pass).map((c) => c.name).join(', ')}`)
  }

  return {
    label,
    mapOnlyPath,
    finalPath,
    tMap,
    tComp,
    dpi: framing.dpi,
    fileSizeMb,
    printReady: allPass,
  }
}

async function main() {
  const results = []
  for (const t of TARGETS) {
    try {
      results.push(await renderOne(t))
    } catch (err) {
      console.error(`✗ ${t.label} FAILED:`, (err as Error).message)
      console.error((err as Error).stack)
    }
  }
  console.log('\n──── summary ────')
  for (const r of results) {
    const tag = r.printReady ? '✓ print-ready' : '✗ not print-ready'
    console.log(
      `  ${r.label}  ${r.dpi}dpi  map=${r.tMap}ms  chrome=${r.tComp}ms  ${r.fileSizeMb.toFixed(1)}MB  ${tag}`,
    )
  }
}

await main()
