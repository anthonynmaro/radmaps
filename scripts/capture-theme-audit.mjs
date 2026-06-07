#!/usr/bin/env node
import { chromium } from 'playwright'
import pixelmatch from 'pixelmatch'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OWNED_MAP_PRESETS = [
  ['radmaps-minimalist', 'Minimalist'],
  ['radmaps-topographic', 'Topographic'],
  ['radmaps-natural', 'Natural'],
  ['radmaps-toner-light', 'Toner Light'],
  ['radmaps-toner-dark', 'Toner Dark'],
  ['radmaps-contour-wash', 'Contour Wash'],
  ['radmaps-watercolor', 'Watercolor'],
  ['radmaps-night-relief', 'Night Relief'],
  ['radmaps-simple-contour', 'Simple Contour'],
  ['radmaps-alidade', 'Alidade'],
  ['radmaps-alidade-dark', 'Alidade Dark'],
]

const DEFAULT_ROUTE_CASING_WIDTH = 2.8
const WATERCOLOR_ROUTE_CASING_WIDTH = 3.5
const WATERCOLOR_ROUTE_OPACITY_CAP = 0.86
const DEFAULT_CONTOUR_MINOR_WIDTH = 1
const DEFAULT_CONTOUR_MAJOR_WIDTH = 0.5

function argValue(name, fallback) {
  const prefix = `--${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function argFlag(name) {
  return process.argv.includes(`--${name}`) || ['1', 'true', 'yes'].includes(argValue(name, '').toLowerCase())
}

function argNumber(name, fallback) {
  const value = Number.parseInt(argValue(name, String(fallback)), 10)
  return Number.isFinite(value) ? value : fallback
}

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

async function loadScreenshotManifest() {
  const manifestPath = path.resolve('utils/themes/screenshotManifest.json')
  return JSON.parse(await readFile(manifestPath, 'utf8'))
}

async function loadChromeContracts() {
  const contractPath = path.resolve('utils/themes/chromeContract.json')
  return JSON.parse(await readFile(contractPath, 'utf8'))
}

async function loadSemanticContracts() {
  const contractPath = path.resolve('utils/themes/semanticAuditContract.json')
  return JSON.parse(await readFile(contractPath, 'utf8'))
}

async function loadSpecImplementationStatus() {
  const contractPath = path.resolve('utils/themes/specContract.ts')
  const source = await readFile(contractPath, 'utf8')
  const status = new Map()
  const entryPattern = /id:\s*'([^']+)'[\s\S]*?notImplemented:\s*\[([\s\S]*?)\]/g
  let match
  while ((match = entryPattern.exec(source)) !== null) {
    const themeId = match[1]
    const notImplementedBlock = match[2].trim()
    status.set(themeId, {
      specContractExists: true,
      notImplementedCleared: notImplementedBlock.length === 0,
      notImplementedCount: notImplementedBlock.length === 0
        ? 0
        : (notImplementedBlock.match(/'[^']*'|"[^"]*"/g) ?? []).length || 1,
    })
  }
  return status
}

async function mapPaintScore(buffer) {
  const stats = await sharp(buffer).stats()
  return stats.channels
    .slice(0, 3)
    .reduce((score, channel) => score + channel.stdev, 0)
}

async function waitForMapPaint(page, label) {
  const started = Date.now()
  let lastScore = 0
  while (Date.now() - started < mapPaintTimeoutMs) {
    const buffer = await page.getByTestId('poster-map').screenshot()
    lastScore = await mapPaintScore(buffer)
    if (lastScore >= minMapPaintScore) return lastScore
    await page.waitForTimeout(500)
  }
  throw new Error(`${label} map band did not paint enough detail after ${mapPaintTimeoutMs}ms (score ${lastScore.toFixed(2)})`)
}

async function hideDevCaptureOverlays(page) {
  await page.addStyleTag({
    content: `
      #__nuxt-devtools__,
      #__nuxt-devtools-view__,
      #nuxt-devtools-container,
      #vue-tracer-overlay,
      #codex-browser-sidebar-comments-root,
      .nuxt-devtools,
      [data-nuxt-devtools],
      iframe[src*="devtools"],
      iframe[title*="DevTools"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })
  await page.evaluate(() => {
    if (!document.body) return
    for (const el of Array.from(document.body.children)) {
      const style = window.getComputedStyle(el)
      const zIndex = Number.parseInt(style.zIndex, 10)
      if (style.position === 'fixed' && Number.isFinite(zIndex) && zIndex >= 10000) {
        el.setAttribute('data-radmaps-audit-hidden', 'true')
        el.style.setProperty('display', 'none', 'important')
      }
    }
  })
}

async function capturePoster(page, url, file) {
  await page.goto(url, { waitUntil: 'commit', timeout: 30_000 })
  await hideDevCaptureOverlays(page)
  const poster = page.getByTestId('poster-canvas')
  const map = page.getByTestId('poster-map')
  await poster.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(waitMs)
  const expectsRenderReady = new URL(url).searchParams.get('print') === 'final'
  let renderReadyObserved = false
  if (expectsRenderReady) {
    try {
      await page.waitForFunction(() => window.__RENDER_READY === true, null, { timeout: mapPaintTimeoutMs })
      renderReadyObserved = true
    } catch {
      renderReadyObserved = false
    }
  } else if (!new URL(url).searchParams.has('surface')) {
    await page.waitForFunction(() => {
      const status = window.__RADMAPS_RENDER_STATUS
      return status?.mapLoaded === true &&
        status?.tilesLoaded === true &&
        (status?.primaryRouteExpected === false || status?.routeContentPresent === true) &&
        (status?.contoursExpected === false || status?.contourSourceLoaded === true) &&
        (status?.demExpected === false || status?.demSourceLoaded === true) &&
        status?.timedOut !== true
    }, null, { timeout: mapPaintTimeoutMs })
  }
  await hideDevCaptureOverlays(page)
  await waitForMapPaint(page, url)
  const posterBox = await poster.boundingBox()
  const mapBox = await map.boundingBox()
  if (!posterBox || !mapBox) throw new Error(`Missing poster/map geometry for ${url}`)
  await poster.screenshot({ path: file })
  const metadata = await sharp(file).metadata()
  const renderStatus = await page.evaluate(() => window.__RADMAPS_RENDER_STATUS ?? null)
  return {
    posterBox,
    mapBox,
    renderReadyObserved,
    renderStatus,
    imageWidth: metadata.width ?? Math.round(posterBox.width),
    imageHeight: metadata.height ?? Math.round(posterBox.height),
  }
}

function semanticCheck(name, pass, details = '') {
  return { name, pass: Boolean(pass), details }
}

function exactTokenCheck(name, actual, expected) {
  return semanticCheck(name, Object.is(actual, expected), `${String(actual)} vs ${String(expected)}`)
}

function colorTokenCheck(name, actual, expected) {
  return semanticCheck(
    name,
    String(actual ?? '').toUpperCase() === String(expected ?? '').toUpperCase(),
    `${String(actual ?? '')} vs ${String(expected ?? '')}`,
  )
}

function numericTokenCheck(name, actual, expected, tolerance = 0.001) {
  return semanticCheck(
    name,
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${String(actual ?? '')} vs ${String(expected ?? '')}`,
  )
}

function jsonTokenCheck(name, actual, expected) {
  return semanticCheck(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`,
  )
}

function contourMinorWidthExpression(weight, preset) {
  const factorA = preset === 'contour-art' ? 0.75 : 0.8
  const factorB = preset === 'contour-art' ? 1.4 : 1.0
  return ['interpolate', ['linear'], ['zoom'], 5, factorA * Number(weight), 14, factorB * Number(weight)]
}

function contourMajorWidthExpression(weight, preset) {
  const factorA = preset === 'contour-art' ? 1.3 : 1.5
  const factorB = preset === 'contour-art' ? 2.8 : 2.5
  return ['interpolate', ['linear'], ['zoom'], 5, factorA * Number(weight), 14, factorB * Number(weight)]
}

function contourMinorOpacityExpression(opacity) {
  return ['interpolate', ['linear'], ['zoom'], 5, Number(opacity), 14, Number(opacity) * 0.9]
}

function rendererContourWidth(style, contourSettings, kind) {
  if (kind === 'minor') {
    const styleWidth = Number(style.contour_minor_width ?? DEFAULT_CONTOUR_MINOR_WIDTH)
    return styleWidth !== DEFAULT_CONTOUR_MINOR_WIDTH
      ? styleWidth
      : Number(contourSettings.minor_width ?? styleWidth)
  }
  const styleWidth = Number(style.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH)
  return styleWidth !== DEFAULT_CONTOUR_MAJOR_WIDTH
    ? styleWidth
    : Number(contourSettings.major_width ?? contourSettings.index_width ?? styleWidth)
}

function rendererRouteOpacity(style, fallback = 0) {
  const routeOpacity = Number(style.route_opacity ?? fallback)
  const isWatercolorRoute = String(style.preset ?? '').includes('watercolor')
  if (isWatercolorRoute) return Math.min(routeOpacity, WATERCOLOR_ROUTE_OPACITY_CAP)
  const isTonerRoute = ['radmaps-toner', 'radmaps-toner-light', 'radmaps-toner-dark'].includes(String(style.preset ?? ''))
  return isTonerRoute ? Math.max(routeOpacity, 0.96) : routeOpacity
}

function normalizeCssFontToken(value) {
  return String(value ?? '')
    .replaceAll('"', '')
    .replaceAll("'", '')
    .toLowerCase()
}

function normalizeCssTextAlign(value) {
  const align = String(value ?? '').toLowerCase()
  if (align === 'start') return 'left'
  if (align === 'end') return 'right'
  return align
}

function titlePositionFromSnapshot(snapshot) {
  const headerRect = snapshot.header?.rect
  const canvasRect = snapshot.canvas?.rect
  if (!headerRect || !canvasRect?.height) return 'unknown'
  const headerCenter = headerRect.top + (headerRect.height / 2)
  return headerCenter >= canvasRect.height * 0.52 ? 'bottom' : 'top'
}

function footerVisibleFromSnapshot(snapshot) {
  const footer = snapshot.footer ?? {}
  return footer.display !== 'none'
    && footer.visibility !== 'hidden'
    && Number.parseFloat(footer.opacity || '1') > 0
    && Number(footer.rect?.height ?? 0) > 0
}

function appendSemanticTokenContractChecks(groups, style, semanticContract) {
  if (!semanticContract) {
    groups.mapLayers.push(semanticCheck('semantic token contract exists', false, 'missing semanticAuditContract entry'))
    return
  }

  groups.typography.push(
    exactTokenCheck('semantic contract title font configured', style.font_family, semanticContract.typography.titleFont),
    exactTokenCheck('semantic contract body font configured', style.body_font_family, semanticContract.typography.bodyFont),
  )
  groups.layout.push(
    exactTokenCheck('semantic contract composition applied', style.composition, semanticContract.layout.composition),
  )
  groups.palette.push(
    colorTokenCheck('semantic contract poster background color', style.background_color, semanticContract.palette.backgroundColor),
    colorTokenCheck('semantic contract label background color', style.label_bg_color, semanticContract.palette.labelBackgroundColor),
    colorTokenCheck('semantic contract label text color', style.label_text_color, semanticContract.palette.labelTextColor),
    colorTokenCheck('semantic contract route palette color', style.route_color, semanticContract.palette.routeColor),
  )
  groups.mapLayers.push(
    exactTokenCheck('semantic contract map preset', style.preset, semanticContract.map.preset),
    exactTokenCheck('semantic contract contour toggle', style.show_contours, semanticContract.map.showContours),
    exactTokenCheck('semantic contract hillshade toggle', style.show_hillshade, semanticContract.map.showHillshade),
    exactTokenCheck('semantic contract road toggle', style.show_roads, semanticContract.map.showRoads),
    exactTokenCheck('semantic contract place-label toggle', style.show_place_labels, semanticContract.map.showPlaceLabels),
    exactTokenCheck('semantic contract poi-label toggle', style.show_poi_labels, semanticContract.map.showPoiLabels),
    exactTokenCheck('semantic contract grid toggle', style.show_grid, semanticContract.map.showGrid),
    exactTokenCheck('semantic contract tile effect', style.tile_effect, semanticContract.map.tileEffect),
    numericTokenCheck('semantic contract tile grain', style.tile_grain, semanticContract.map.tileGrain),
    exactTokenCheck('semantic contract elevation-profile toggle', style.show_elevation_profile, semanticContract.map.showElevationProfile ?? false),
  )
  if (semanticContract.map.showGrid) {
    groups.motifs.push(
      exactTokenCheck('semantic contract grid scope', style.grid_scope, semanticContract.map.gridScope),
      numericTokenCheck('semantic contract grid opacity', style.grid_opacity, semanticContract.map.gridOpacity),
      numericTokenCheck('semantic contract grid spacing', style.grid_spacing, semanticContract.map.gridSpacing),
      numericTokenCheck('semantic contract grid weight', style.grid_weight, semanticContract.map.gridWeight),
    )
  }
  groups.routeStyling.push(
    colorTokenCheck('semantic contract route color', style.route_color, semanticContract.route.color),
    numericTokenCheck('semantic contract route width', style.route_width, semanticContract.route.width),
    numericTokenCheck('semantic contract route opacity', style.route_opacity, semanticContract.route.opacity),
    exactTokenCheck('semantic contract start marker toggle', style.show_start_pin, semanticContract.route.startPin),
    exactTokenCheck('semantic contract finish marker toggle', style.show_finish_pin, semanticContract.route.finishPin),
  )
}

function summarizeSemanticChecks(groups) {
  const checks = Object.values(groups).flat()
  const passed = checks.filter(check => check.pass).length
  const total = checks.length
  const score = total ? Number((passed / total).toFixed(4)) : 0
  return {
    passed,
    total,
    score,
    threshold: semanticParityThreshold,
    thresholdPass: score >= semanticParityThreshold,
    pass: checks.every(check => check.pass),
  }
}

function hexToRgb(hex) {
  const normalized = String(hex ?? '').replace('#', '').trim()
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function colorDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

function formatRgb(rgb) {
  if (!rgb) return 'n/a'
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`
}

function cssPx(value) {
  const parsed = Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

function isTransparentCssColor(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)'
}

async function averageColorForRegion(file, region) {
  const meta = await sharp(file).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) return null
  const left = Math.max(0, Math.min(width - 1, Math.round(region?.left ?? 0)))
  const top = Math.max(0, Math.min(height - 1, Math.round(region?.top ?? 0)))
  const right = Math.max(left + 1, Math.min(width, Math.round(region?.right ?? width)))
  const bottom = Math.max(top + 1, Math.min(height, Math.round(region?.bottom ?? height)))
  const stats = await sharp(file)
    .extract({ left, top, width: right - left, height: bottom - top })
    .stats()
  const [r, g, b] = stats.channels
  return r && g && b ? { r: r.mean, g: g.mean, b: b.mean } : null
}

async function countPixelsForRegion(file, region, predicate) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels
  const left = Math.max(0, Math.min(info.width - 1, Math.round(region?.left ?? 0)))
  const top = Math.max(0, Math.min(info.height - 1, Math.round(region?.top ?? 0)))
  const right = Math.max(left + 1, Math.min(info.width, Math.round(region?.right ?? info.width)))
  const bottom = Math.max(top + 1, Math.min(info.height, Math.round(region?.bottom ?? info.height)))
  let count = 0
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const index = (y * info.width + x) * channels
      if (predicate(data[index], data[index + 1], data[index + 2], data[index + 3] ?? 255)) count += 1
    }
  }
  return count
}

async function collectImageSemanticChecks(entry, printFile, geometry) {
  const imageWidth = geometry.imageWidth ?? Math.round(geometry.posterBox.width)
  const imageHeight = geometry.imageHeight ?? Math.round(geometry.posterBox.height)
  const mapRect = normalizeMapRect(geometry, imageWidth, imageHeight)
  const fullAverage = await averageColorForRegion(printFile, { left: 0, top: 0, right: imageWidth, bottom: imageHeight })
  const mapAverage = await averageColorForRegion(printFile, mapRect)
  const groups = {
    palette: [
      semanticCheck('dominant poster color measured', Boolean(fullAverage), formatRgb(fullAverage)),
      semanticCheck('dominant map color measured', Boolean(mapAverage), formatRgb(mapAverage)),
    ],
    mapLayers: [],
    routeStyling: [],
  }

  if (entry.themeId === 'blueprint') {
    const cyanotype = hexToRgb('#173F66')
    const yellowRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) => r > 210 && g > 150 && b < 120)
    const cyanContourPixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      ((r > 135 && g > 175 && b > 205) || (r > 55 && r < 170 && g > 105 && g < 195 && b > 135 && b < 235)),
    )
    groups.palette.push(
      semanticCheck('Blueprint poster dominant color is cyanotype blue', colorDistance(fullAverage, cyanotype) < 38, `${formatRgb(fullAverage)} vs #173F66`),
      semanticCheck('Blueprint map dominant color is cyanotype blue', colorDistance(mapAverage, cyanotype) < 38, `${formatRgb(mapAverage)} vs #173F66`),
    )
    groups.mapLayers.push(
      semanticCheck('Blueprint cyan/white contour density visible', cyanContourPixels > 6000, `${cyanContourPixels} pixels`),
    )
    groups.routeStyling.push(
      semanticCheck('Blueprint visible yellow route pixels', yellowRoutePixels > 220, `${yellowRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'usgs-vintage') {
    const paper = hexToRgb('#F0ECDE')
    const rustRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 105 && r < 190 && g > 30 && g < 95 && b > 20 && b < 75,
    )
    const greenIndexPixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 70 && r < 125 && g > 85 && g < 135 && b > 55 && b < 105,
    )
    const tanContourPixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 145 && r < 210 && g > 120 && g < 180 && b > 70 && b < 130,
    )
    groups.palette.push(
      semanticCheck('USGS poster dominant color is cream paper', colorDistance(fullAverage, paper) < 66, `${formatRgb(fullAverage)} vs #F0ECDE`),
      semanticCheck('USGS map dominant color is cream paper', colorDistance(mapAverage, paper) < 66, `${formatRgb(mapAverage)} vs #F0ECDE`),
    )
    groups.mapLayers.push(
      semanticCheck('USGS tan minor contours visible', tanContourPixels > 1800, `${tanContourPixels} pixels`),
      semanticCheck('USGS green index contours visible', greenIndexPixels > 600, `${greenIndexPixels} pixels`),
    )
    groups.routeStyling.push(
      semanticCheck('USGS visible rust route pixels', rustRoutePixels > 180, `${rustRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'classic-trail') {
    const paper = hexToRgb('#EEEEEA')
    const slateRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 35 && r < 85 && g > 65 && g < 110 && b > 85 && b < 135,
    )
    groups.palette.push(
      semanticCheck('Classic Trail poster average stays neutral slate paper', colorDistance(fullAverage, paper) < 68 && Math.max(fullAverage.r, fullAverage.g, fullAverage.b) - Math.min(fullAverage.r, fullAverage.g, fullAverage.b) < 18, `${formatRgb(fullAverage)} vs #EEEEEA`),
    )
    groups.routeStyling.push(
      semanticCheck('Classic Trail visible slate route pixels', slateRoutePixels > 120, `${slateRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'risograph') {
    const paper = hexToRgb('#F3EFE2')
    const pinkRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 220 && g > 55 && g < 120 && b > 95 && b < 160,
    )
    const blueContourPixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 25 && r < 95 && g > 65 && g < 130 && b > 150 && b < 235,
    )
    groups.palette.push(
      semanticCheck('Risograph poster dominant color is warm paper', colorDistance(fullAverage, paper) < 42, `${formatRgb(fullAverage)} vs #F3EFE2`),
      semanticCheck('Risograph map dominant color is warm paper, not blank white', colorDistance(mapAverage, paper) < 54, `${formatRgb(mapAverage)} vs #F3EFE2`),
    )
    groups.mapLayers.push(
      semanticCheck('Risograph blue contour ink visible', blueContourPixels > 1200, `${blueContourPixels} pixels`),
    )
    groups.routeStyling.push(
      semanticCheck('Risograph fluoro pink route visible', pinkRoutePixels > 180, `${pinkRoutePixels} pixels`),
    )
  }

  if (['midcentury-travel', 'ranch-ochre', 'daybreak-trace'].includes(entry.themeId)) {
    const routePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 25 && r < 95 && g > 15 && g < 75 && b > 10 && b < 65,
    )
    const sunPixels = await countPixelsForRegion(printFile, null, (r, g, b) =>
      r > 165 && r < 235 && g > 95 && g < 175 && b > 45 && b < 125,
    )
    groups.routeStyling.push(
      semanticCheck('Mid-Century family dark ink route visible', routePixels > 180, `${routePixels} pixels`),
    )
    groups.mapLayers.push(
      semanticCheck('Mid-Century family sun-arc ink visibly prints', sunPixels > 2200, `${sunPixels} pixels`),
    )
  }

  if (entry.themeId === 'brutalist') {
    const concrete = hexToRgb('#E4E0D7')
    const orangeRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 210 && g > 35 && g < 95 && b < 45,
    )
    groups.palette.push(
      semanticCheck('Brutalist poster dominant color is concrete', colorDistance(fullAverage, concrete) < 48, `${formatRgb(fullAverage)} vs #E4E0D7`),
      semanticCheck('Brutalist map field remains concrete-toned', colorDistance(mapAverage, concrete) < 72, `${formatRgb(mapAverage)} vs #E4E0D7`),
    )
    groups.routeStyling.push(
      semanticCheck('Brutalist orange route visible', orangeRoutePixels > 180, `${orangeRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'marathon-bib') {
    const redRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 190 && g > 25 && g < 90 && b > 20 && b < 75,
    )
    groups.routeStyling.push(
      semanticCheck('Marathon red route visible', redRoutePixels > 160, `${redRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'electric-atlas') {
    const magentaRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 190 && g > 25 && g < 95 && b > 100 && b < 180,
    )
    groups.routeStyling.push(
      semanticCheck('Electric Atlas magenta route visible', magentaRoutePixels > 150, `${magentaRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'moonstone') {
    const paper = hexToRgb('#EEF0ED')
    const rustRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 115 && r < 175 && g > 55 && g < 105 && b > 40 && b < 90,
    )
    groups.palette.push(
      semanticCheck('Moonstone poster average stays cool paper', colorDistance(fullAverage, paper) < 32, `${formatRgb(fullAverage)} vs #EEF0ED`),
    )
    groups.routeStyling.push(
      semanticCheck('Moonstone visible rust route pixels', rustRoutePixels > 120, `${rustRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'blueprint-strava') {
    const ink = hexToRgb('#07120F')
    const greenRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 35 && r < 95 && g > 175 && g < 240 && b > 110 && b < 180,
    )
    groups.palette.push(
      semanticCheck('Trail Blueprint poster dominant color is black-green ink', colorDistance(fullAverage, ink) < 44, `${formatRgb(fullAverage)} vs #07120F`),
    )
    groups.routeStyling.push(
      semanticCheck('Trail Blueprint visible green route pixels', greenRoutePixels > 120, `${greenRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'blackline') {
    const blackRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r < 42 && g < 42 && b < 42,
    )
    groups.palette.push(
      semanticCheck('Blackline poster average stays neutral paper/ink', Math.max(fullAverage.r, fullAverage.g, fullAverage.b) - Math.min(fullAverage.r, fullAverage.g, fullAverage.b) < 10 && fullAverage.r > 150, formatRgb(fullAverage)),
    )
    groups.routeStyling.push(
      semanticCheck('Blackline visible black route pixels', blackRoutePixels > 120, `${blackRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'contour-wash') {
    const field = hexToRgb('#9AA7A2')
    const washRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 35 && r < 75 && g > 40 && g < 80 && b > 40 && b < 85,
    )
    groups.palette.push(
      semanticCheck('Contour Wash poster dominant color is soft contour field', colorDistance(fullAverage, field) < 42, `${formatRgb(fullAverage)} vs #9AA7A2`),
    )
    groups.routeStyling.push(
      semanticCheck('Contour Wash visible charcoal route pixels', washRoutePixels > 120, `${washRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'splits-stats') {
    const ink = hexToRgb('#0B0D10')
    const orangeRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 210 && g > 60 && g < 125 && b > 25 && b < 80,
    )
    groups.palette.push(
      semanticCheck('Trail Profile poster dominant color is dark ink', colorDistance(fullAverage, ink) < 44, `${formatRgb(fullAverage)} vs #0B0D10`),
    )
    groups.routeStyling.push(
      semanticCheck('Trail Profile visible orange route pixels', orangeRoutePixels > 120, `${orangeRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'night-ride') {
    const ink = hexToRgb('#080B0E')
    const cyanRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 20 && r < 85 && g > 165 && g < 230 && b > 165 && b < 235,
    )
    groups.palette.push(
      semanticCheck('Night Ride poster dominant color is night ink', colorDistance(fullAverage, ink) < 44, `${formatRgb(fullAverage)} vs #080B0E`),
    )
    groups.routeStyling.push(
      semanticCheck('Night Ride visible cyan route pixels', cyanRoutePixels > 120, `${cyanRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'cartouche-place') {
    const paper = hexToRgb('#F4EFE4')
    groups.palette.push(
      semanticCheck('Cartouche poster dominant color is engraved paper', colorDistance(fullAverage, paper) < 42, `${formatRgb(fullAverage)} vs #F4EFE4`),
      semanticCheck('Cartouche map dominant color is engraved paper', colorDistance(mapAverage, paper) < 48, `${formatRgb(mapAverage)} vs #F4EFE4`),
    )
  }

  if (['dark-sky', 'copper-night'].includes(entry.themeId)) {
    const nightRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 190 && g > 120 && b < 130,
    )
    groups.routeStyling.push(
      semanticCheck('Dark Sky family warm route visible', nightRoutePixels > 120, `${nightRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'sea-chart') {
    const chartPaper = hexToRgb('#EDE6D2')
    const chartField = hexToRgb('#E6F0EC')
    const magentaRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 135 && r < 205 && g > 35 && g < 95 && b > 80 && b < 145,
    )
    groups.palette.push(
      semanticCheck('Sea Chart dominant color is warm chart paper', colorDistance(fullAverage, chartPaper) < 44, `${formatRgb(fullAverage)} vs #EDE6D2`),
      semanticCheck('Sea Chart map field is pale mint, not cream paper', colorDistance(mapAverage, chartField) < 38, `${formatRgb(mapAverage)} vs #E6F0EC`),
    )
    groups.routeStyling.push(
      semanticCheck('Sea Chart magenta course line visible', magentaRoutePixels > 150, `${magentaRoutePixels} pixels`),
    )
  }

  if (entry.themeId === 'transit-diagram') {
    const purpleRoutePixels = await countPixelsForRegion(printFile, mapRect, (r, g, b) =>
      r > 85 && r < 155 && g > 20 && g < 80 && b > 120 && b < 190,
    )
    groups.routeStyling.push(
      semanticCheck('Transit purple route line visible', purpleRoutePixels > 180, `${purpleRoutePixels} pixels`),
    )
  }

  return groups
}

function mergeSemanticCheckGroups(semantic, extraGroups) {
  const groups = { ...(semantic.groups ?? {}) }
  for (const [group, checks] of Object.entries(extraGroups)) {
    groups[group] = [...(groups[group] ?? []), ...checks]
  }
  return {
    ...semantic,
    groups,
    summary: summarizeSemanticChecks(groups),
  }
}

function visualReviewStatus(entry) {
  const status = entry.visualReview?.status ?? 'pending'
  return {
    status,
    pass: status === 'approved',
    reviewer: entry.visualReview?.reviewer ?? null,
    reviewedAt: entry.visualReview?.reviewedAt ?? null,
    notes: entry.visualReview?.notes ?? 'Visual review has not approved this theme.',
  }
}

const requiredSemanticGroups = [
  'typography',
  'layout',
  'palette',
  'mapLayers',
  'routeStyling',
  'motifs',
  'routeLayers',
  'print',
]

function semanticGroupsPass(semantic) {
  return semanticGroupStatus(semantic).pass
}

function semanticGroupStatus(semantic) {
  const groups = semantic?.groups ?? {}
  const missing = []
  const failed = []
  for (const group of requiredSemanticGroups) {
    const checks = groups[group]
    if (!Array.isArray(checks) || checks.length === 0) {
      missing.push(group)
      continue
    }
    if (!checks.every(check => check.pass === true)) failed.push(group)
  }
  return {
    pass: missing.length === 0 && failed.length === 0,
    required: [...requiredSemanticGroups],
    missing,
    failed,
  }
}

function readinessForResult(result) {
  const pixelPass = typeof result.score === 'number'
    && result.score >= parityThreshold
    && result.mapScore >= parityThreshold
    && result.chromeScore >= parityThreshold
  const semanticGroupReadiness = semanticGroupStatus(result.semantic)
  const semanticPass = result.semantic?.summary?.pass === true
    && result.semantic?.summary?.thresholdPass === true
    && semanticGroupReadiness.pass
  const visualPass = result.visualReview?.pass === true
  const specPass = result.specImplementation?.specContractExists === true
    && result.specImplementation?.notImplementedCleared === true
  return {
    pixelPass,
    semanticPass,
    semanticGroupsPass: semanticGroupReadiness.pass,
    requiredSemanticGroups: semanticGroupReadiness.required,
    missingSemanticGroups: semanticGroupReadiness.missing,
    failedSemanticGroups: semanticGroupReadiness.failed,
    visualPass,
    specPass,
    done: semanticPass && visualPass && specPass,
  }
}

async function collectSemanticChecks(page, entry, geometry, editorGeometry = null) {
  const chromeContract = chromeContractsByTheme.get(entry.themeId) ?? {}
  const semanticTokenContract = semanticContractsByTheme.get(entry.themeId)
  const snapshot = await page.evaluate((contract) => {
    const styleConfig = window.__RADMAPS_STYLE_FIXTURE__?.getStyle?.() ?? {}
    const title = document.querySelector('.poster-trail-name')
    const canvas = document.querySelector('[data-testid="poster-canvas"]')
    const map = document.querySelector('[data-testid="poster-map"]')
    const header = document.querySelector('[data-testid="poster-header"]')
    const headerRule = header?.querySelector('.poster-rule') ?? null
    const footer = document.querySelector('[data-testid="poster-footer"]')
    const posterGrid = document.querySelector('[data-testid="composition-grid-overlay"]')
    const mapGrid = document.querySelector('[data-testid="composition-map-grid-overlay"]')
    const grid = styleConfig.grid_scope === 'map' ? mapGrid : posterGrid
    const blueprintTopline = document.querySelector('[data-testid="blueprint-drafting-topline"]')
    const blueprintFigure = document.querySelector('[data-testid="blueprint-drafting-figure"]')
    const blueprintCoordinate = document.querySelector('[data-testid="blueprint-drafting-coordinate"]')
    const blueprintNeatline = document.querySelector('[data-testid="blueprint-sheet-neatline"]')
    const travelSun = document.querySelector('[data-testid="composition-travel-sun"]')
    const brutalistBaselineGrid = document.querySelector('[data-testid="composition-brutalist-baseline-grid"]')
    const brutalistRegistrationMarks = document.querySelector('[data-testid="composition-brutalist-registration-marks"]')
    const titleStyle = title ? window.getComputedStyle(title) : null
    const headerStyle = header ? window.getComputedStyle(header) : null
    const headerRuleStyle = headerRule ? window.getComputedStyle(headerRule) : null
    const canvasStyle = canvas ? window.getComputedStyle(canvas) : null
    const mapStyle = map ? window.getComputedStyle(map) : null
    const footerStyle = footer ? window.getComputedStyle(footer) : null
    const gridStyle = grid ? window.getComputedStyle(grid) : null
    const travelSunStyle = travelSun ? window.getComputedStyle(travelSun) : null
    const brutalistBaselineGridStyle = brutalistBaselineGrid ? window.getComputedStyle(brutalistBaselineGrid) : null
    const brutalistRegistrationMarksStyle = brutalistRegistrationMarks ? window.getComputedStyle(brutalistRegistrationMarks) : null
    const titleBeforeStyle = title ? window.getComputedStyle(title, '::before') : null
    const editorControlSelectors = [
      '[data-testid="chrome-cell-trash"]',
      '[data-testid="chrome-row-add-row"]',
      '[data-testid="chrome-cell-add-column"]',
      '[data-testid="poster-template-editor"]',
      '[data-testid="surface-template-editor"]',
      '.chrome-cell-resize-col',
      '.chrome-row-resize-row',
    ]
    const editorControlCount = editorControlSelectors
      .map(selector => Array.from(document.querySelectorAll(selector))
        .filter(element => {
          const style = window.getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0
        }).length)
      .reduce((sum, count) => sum + count, 0)
    const mapCamera = window.__RADMAPS_MAP_CAMERA__
    const routeLayerIds = mapCamera?.getLayerIds?.() ?? []
    const layerIdSet = new Set(routeLayerIds)
    const paint = (layerId, property) => layerIdSet.has(layerId) ? (mapCamera?.getPaintProperty?.(layerId, property) ?? null) : null
    const testIdCounts = Object.fromEntries([
      ...(contract.requiredTestIds ?? []),
      ...(contract.forbiddenTestIds ?? []),
    ].map(testId => [testId, document.querySelectorAll(`[data-testid="${testId}"]`).length]))
    const selectorCounts = Object.fromEntries([
      ...(contract.requiredSelectors ?? []),
      ...(contract.forbiddenSelectors ?? []),
    ].map(selector => [selector, document.querySelectorAll(selector).length]))
    const canvasRect = canvas?.getBoundingClientRect()
    const headerRect = header?.getBoundingClientRect()
    const headerRuleRect = headerRule?.getBoundingClientRect()
    const mapRect = map?.getBoundingClientRect()
    const footerRect = footer?.getBoundingClientRect()
    const pixelMaskRects = []
    if (canvasRect && blueprintCoordinate) {
      const rect = blueprintCoordinate.getBoundingClientRect()
      pixelMaskRects.push({
        left: (rect.left - canvasRect.left) / canvasRect.width,
        top: (rect.top - canvasRect.top) / canvasRect.height,
        right: (rect.right - canvasRect.left) / canvasRect.width,
        bottom: (rect.bottom - canvasRect.top) / canvasRect.height,
      })
    }
    return {
      styleConfig,
      title: {
        text: title?.textContent?.trim() ?? '',
        fontFamily: titleStyle?.fontFamily ?? '',
        fontSize: titleStyle?.fontSize ?? '',
        fontWeight: titleStyle?.fontWeight ?? '',
        textTransform: titleStyle?.textTransform ?? '',
        letterSpacing: titleStyle?.letterSpacing ?? '',
        lineHeight: titleStyle?.lineHeight ?? '',
        textAlign: titleStyle?.textAlign ?? '',
      },
      header: {
        display: headerStyle?.display ?? '',
        visibility: headerStyle?.visibility ?? '',
        opacity: headerStyle?.opacity ?? '',
        fontFamily: headerStyle?.fontFamily ?? '',
        backgroundColor: headerStyle?.backgroundColor ?? '',
        boxShadow: headerStyle?.boxShadow ?? '',
        borderTopWidth: headerStyle?.borderTopWidth ?? '',
        rect: headerRect && canvasRect ? {
          top: headerRect.top - canvasRect.top,
          left: headerRect.left - canvasRect.left,
          width: headerRect.width,
          height: headerRect.height,
        } : null,
      },
      headerRule: {
        exists: Boolean(headerRule),
        opacity: headerRuleStyle?.opacity ?? '',
        backgroundColor: headerRuleStyle?.backgroundColor ?? '',
        rect: headerRuleRect && canvasRect ? {
          top: headerRuleRect.top - canvasRect.top,
          left: headerRuleRect.left - canvasRect.left,
          width: headerRuleRect.width,
          height: headerRuleRect.height,
        } : null,
      },
      canvas: {
        backgroundColor: canvasStyle?.backgroundColor ?? '',
        rect: canvasRect ? { width: canvasRect.width, height: canvasRect.height } : null,
      },
      map: {
        backgroundColor: mapStyle?.backgroundColor ?? '',
        borderTopWidth: mapStyle?.borderTopWidth ?? '',
        borderTopColor: mapStyle?.borderTopColor ?? '',
        boxShadow: mapStyle?.boxShadow ?? '',
        rect: mapRect ? { width: mapRect.width, height: mapRect.height } : null,
      },
      footer: {
        display: footerStyle?.display ?? '',
        visibility: footerStyle?.visibility ?? '',
        opacity: footerStyle?.opacity ?? '',
        fontFamily: footerStyle?.fontFamily ?? '',
        backgroundColor: footerStyle?.backgroundColor ?? '',
        boxShadow: footerStyle?.boxShadow ?? '',
        borderTopWidth: footerStyle?.borderTopWidth ?? '',
        rect: footerRect && canvasRect ? {
          top: footerRect.top - canvasRect.top,
          left: footerRect.left - canvasRect.left,
          width: footerRect.width,
          height: footerRect.height,
        } : null,
      },
      grid: {
        exists: Boolean(grid),
        scope: styleConfig.grid_scope ?? '',
        posterExists: Boolean(posterGrid),
        mapExists: Boolean(mapGrid),
        opacity: gridStyle?.opacity ?? '',
        backgroundSize: gridStyle?.backgroundSize ?? '',
      },
      blueprintDrafting: {
        topline: Boolean(blueprintTopline),
        figure: Boolean(blueprintFigure),
        neatline: Boolean(blueprintNeatline),
      },
      travelSun: {
        exists: Boolean(travelSun),
        opacity: travelSunStyle?.opacity ?? '',
        mixBlendMode: travelSunStyle?.mixBlendMode ?? '',
      },
      brutalistMotifs: {
        baselineGrid: Boolean(brutalistBaselineGrid),
        baselineGridOpacity: brutalistBaselineGridStyle?.opacity ?? '',
        registrationMarks: Boolean(brutalistRegistrationMarks),
        registrationOpacity: brutalistRegistrationMarksStyle?.opacity ?? '',
      },
      risoTitleOffset: {
        content: titleBeforeStyle?.content ?? '',
        color: titleBeforeStyle?.color ?? '',
        opacity: titleBeforeStyle?.opacity ?? '',
        left: titleBeforeStyle?.left ?? '',
        top: titleBeforeStyle?.top ?? '',
        mixBlendMode: titleStyle?.mixBlendMode ?? '',
      },
      pixelMaskRects,
      renderStatus: window.__RADMAPS_RENDER_STATUS ?? null,
      renderReady: window.__RENDER_READY === true,
      editorControlCount,
      routeLayerIds,
      routePaint: {
        line: {
          color: paint('route-line', 'line-color'),
          gradient: paint('route-line', 'line-gradient'),
          width: paint('route-line', 'line-width'),
          opacity: paint('route-line', 'line-opacity'),
        },
        casing: {
          color: paint('route-line-casing', 'line-color'),
          width: paint('route-line-casing', 'line-width'),
          opacity: paint('route-line-casing', 'line-opacity'),
          blur: paint('route-line-casing', 'line-blur'),
        },
      },
      contourPaint: {
        minor: {
          color: paint('contours-minor', 'line-color'),
          opacity: paint('contours-minor', 'line-opacity'),
          width: paint('contours-minor', 'line-width'),
        },
        major: {
          color: paint('contours-major', 'line-color'),
          opacity: paint('contours-major', 'line-opacity'),
          width: paint('contours-major', 'line-width'),
        },
      },
      contractPresence: {
        testIdCounts,
        selectorCounts,
      },
    }
  }, chromeContract)

  const style = snapshot.styleConfig ?? {}
  const canvasRatio = snapshot.canvas.rect
    ? snapshot.canvas.rect.width / snapshot.canvas.rect.height
    : 0
  const mapHeightRatio = snapshot.canvas.rect && snapshot.map.rect
    ? snapshot.map.rect.height / snapshot.canvas.rect.height
    : 0
  const titleSizePx = Number.parseFloat(snapshot.title.fontSize || '0')
  const expectedTitleFont = chromeContract.typography?.titleFont ?? String(style.font_family ?? '')
  const expectedTitleCase = chromeContract.typography?.titleCase
  const expectedTitlePosition = chromeContract.layout?.titlePosition
  const expectedTitleAlign = chromeContract.layout?.titleAlign
  const expectedFooterVariant = chromeContract.layout?.footerVariant
  const routePaint = snapshot.routePaint ?? {}
  const routeLinePaint = routePaint.line ?? {}
  const routeCasingPaint = routePaint.casing ?? {}
  const contourPaint = snapshot.contourPaint ?? {}
  const contourMinorPaint = contourPaint.minor ?? {}
  const contourMajorPaint = contourPaint.major ?? {}
  const contourSettings = style.atlas_layer_settings?.contour ?? {}
  const expectedMinorContourOpacity = Number(contourSettings.minor_opacity ?? style.contour_opacity ?? 0)
  const expectedMajorContourOpacity = Number(contourSettings.major_opacity ?? contourSettings.index_opacity ?? style.contour_opacity ?? 0)
  const expectedMinorContourWidth = rendererContourWidth(style, contourSettings, 'minor')
  const expectedMajorContourWidth = rendererContourWidth(style, contourSettings, 'major')
  const isWatercolorRoute = String(style.preset ?? '').includes('watercolor')
  const routeRequiresGenericCasing = entry.themeId !== 'risograph'
  const expectedRouteOpacity = rendererRouteOpacity(style, 0)
  const expectedCasingWidth = Number(style.route_width ?? 0) + (isWatercolorRoute ? WATERCOLOR_ROUTE_CASING_WIDTH : DEFAULT_ROUTE_CASING_WIDTH)
  const expectedCasingOpacity = isWatercolorRoute
    ? Math.min(Number(style.route_opacity ?? 0), entry.themeId === 'plein-air' ? 0.58 : 0.78)
    : rendererRouteOpacity(style, 0)
  const renderedTitlePosition = titlePositionFromSnapshot(snapshot)
  const renderedTitleAlign = normalizeCssTextAlign(snapshot.title.textAlign)
  const footerVisible = footerVisibleFromSnapshot(snapshot)

  const groups = {
    typography: [
      semanticCheck('title text exists', snapshot.title.text.length > 0, snapshot.title.text),
      semanticCheck('title uses contract font', normalizeCssFontToken(snapshot.title.fontFamily).includes(normalizeCssFontToken(expectedTitleFont)), `${snapshot.title.fontFamily} vs ${expectedTitleFont}`),
      semanticCheck('title case matches contract', !expectedTitleCase || snapshot.title.textTransform === expectedTitleCase, `${snapshot.title.textTransform} vs ${expectedTitleCase ?? 'n/a'}`),
      semanticCheck('body font configured', Boolean(style.body_font_family), String(style.body_font_family ?? '')),
      semanticCheck('title did not fall back to Inter/system', !/(^|,\s*)(inter|system-ui|-apple-system|blinkmacsystemfont)($|,)/i.test(snapshot.title.fontFamily), snapshot.title.fontFamily),
    ],
    layout: [
      semanticCheck('poster is 2:3', Math.abs(canvasRatio - (2 / 3)) < 0.02, canvasRatio.toFixed(4)),
      semanticCheck('map band exists', Boolean(geometry.mapBox?.width && geometry.mapBox?.height), JSON.stringify(geometry.mapBox ?? {})),
      semanticCheck('manifest composition applied', style.composition === entry.composition, `${style.composition ?? ''} vs ${entry.composition}`),
      semanticCheck('theme id applied', style.color_theme === entry.themeId, `${style.color_theme ?? ''} vs ${entry.themeId}`),
      semanticCheck('title position matches contract', !expectedTitlePosition || renderedTitlePosition === expectedTitlePosition, `${renderedTitlePosition} vs ${expectedTitlePosition ?? 'n/a'}`),
      semanticCheck('title alignment matches contract', !expectedTitleAlign || renderedTitleAlign === expectedTitleAlign, `${renderedTitleAlign} vs ${expectedTitleAlign ?? 'n/a'}`),
      semanticCheck('footer visibility matches contract', !expectedFooterVariant || (expectedFooterVariant === 'hidden' ? !footerVisible : footerVisible), `${footerVisible ? 'visible' : 'hidden'} vs ${expectedFooterVariant ?? 'n/a'}`),
    ],
    palette: [
      semanticCheck('theme background configured', Boolean(style.background_color), String(style.background_color ?? '')),
      semanticCheck('label background configured', Boolean(style.label_bg_color), String(style.label_bg_color ?? '')),
      semanticCheck('label text color configured', Boolean(style.label_text_color), String(style.label_text_color ?? '')),
    ],
    mapLayers: [
      semanticCheck('map preset configured', Boolean(style.preset), String(style.preset ?? '')),
      semanticCheck('print map loaded', geometry.renderStatus?.mapLoaded === true && geometry.renderStatus?.tilesLoaded === true && geometry.renderStatus?.timedOut !== true, JSON.stringify(geometry.renderStatus ?? {})),
      semanticCheck('live contour minor layer matches contour toggle', style.show_contours === true ? snapshot.routeLayerIds.includes('contours-minor') : !snapshot.routeLayerIds.includes('contours-minor'), `${style.show_contours}/${snapshot.routeLayerIds.join(', ')}`),
      semanticCheck('live contour major layer matches contour toggle', style.show_contours === true ? snapshot.routeLayerIds.includes('contours-major') : !snapshot.routeLayerIds.includes('contours-major'), `${style.show_contours}/${snapshot.routeLayerIds.join(', ')}`),
      ...(style.show_contours === true
        ? [
            colorTokenCheck('live minor contour color matches token', contourMinorPaint.color, style.contour_color),
            colorTokenCheck('live major contour color matches token', contourMajorPaint.color, style.contour_major_color),
            jsonTokenCheck('live minor contour opacity matches token', contourMinorPaint.opacity, contourMinorOpacityExpression(expectedMinorContourOpacity)),
            numericTokenCheck('live major contour opacity matches token', contourMajorPaint.opacity, expectedMajorContourOpacity),
            jsonTokenCheck('live minor contour width matches token', contourMinorPaint.width, contourMinorWidthExpression(expectedMinorContourWidth, style.preset)),
            jsonTokenCheck('live major contour width matches token', contourMajorPaint.width, contourMajorWidthExpression(expectedMajorContourWidth, style.preset)),
          ]
        : []),
    ],
    routeStyling: [
      semanticCheck('uses live route color', Boolean(style.route_color), String(style.route_color ?? '')),
      semanticCheck('route width configured', Number(style.route_width ?? 0) > 0, String(style.route_width ?? '')),
      semanticCheck('route opacity configured', Number(style.route_opacity ?? 0) > 0, String(style.route_opacity ?? '')),
      semanticCheck('live route line layer present', snapshot.routeLayerIds.includes('route-line'), snapshot.routeLayerIds.join(', ')),
      colorTokenCheck('live route line color matches token', routeLinePaint.color, style.route_color),
      numericTokenCheck('live route line width matches token', routeLinePaint.width, style.route_width),
      numericTokenCheck('live route line opacity matches renderer token', routeLinePaint.opacity, expectedRouteOpacity),
      ...(routeRequiresGenericCasing
        ? [
            semanticCheck('live route casing layer present', snapshot.routeLayerIds.includes('route-line-casing'), snapshot.routeLayerIds.join(', ')),
            numericTokenCheck('live route casing width matches renderer token', routeCasingPaint.width, expectedCasingWidth),
            numericTokenCheck('live route casing opacity matches renderer token', routeCasingPaint.opacity, expectedCasingOpacity),
            semanticCheck('live route casing is wider than route', Number(routeCasingPaint.width ?? 0) > Number(routeLinePaint.width ?? 0), `${routeCasingPaint.width ?? ''} vs ${routeLinePaint.width ?? ''}`),
          ]
        : [
            semanticCheck('theme uses owned route treatment instead of generic casing', !snapshot.routeLayerIds.includes('route-line-casing'), snapshot.routeLayerIds.join(', ')),
          ]),
      semanticCheck('print route source loaded', geometry.renderStatus?.primaryRouteExpected === false || (
        geometry.renderStatus?.routeSourcePresent === true &&
        geometry.renderStatus?.routeSourceLoaded === true &&
        geometry.renderStatus?.routeContentPresent === true
      ), JSON.stringify(geometry.renderStatus ?? {})),
    ],
    motifs: [
      semanticCheck('theme chrome contract exists', Boolean(chromeContractsByTheme.has(entry.themeId)), entry.themeId),
      ...((chromeContract.requiredTestIds ?? []).map(testId =>
        semanticCheck(`required motif/test id ${testId} present`, Number(snapshot.contractPresence.testIdCounts[testId] ?? 0) > 0, `${snapshot.contractPresence.testIdCounts[testId] ?? 0}`),
      )),
      ...((chromeContract.forbiddenTestIds ?? []).map(testId =>
        semanticCheck(`forbidden motif/test id ${testId} absent`, Number(snapshot.contractPresence.testIdCounts[testId] ?? 0) === 0, `${snapshot.contractPresence.testIdCounts[testId] ?? 0}`),
      )),
      ...((chromeContract.requiredSelectors ?? []).map(selector =>
        semanticCheck(`required selector ${selector} present`, Number(snapshot.contractPresence.selectorCounts[selector] ?? 0) > 0, `${snapshot.contractPresence.selectorCounts[selector] ?? 0}`),
      )),
      ...((chromeContract.forbiddenSelectors ?? []).map(selector =>
        semanticCheck(`forbidden selector ${selector} absent`, Number(snapshot.contractPresence.selectorCounts[selector] ?? 0) === 0, `${snapshot.contractPresence.selectorCounts[selector] ?? 0}`),
      )),
    ],
    routeLayers: [
      ...((chromeContract.requiredRouteLayers ?? []).map(layerId =>
        semanticCheck(`required route/map layer ${layerId} present`, snapshot.routeLayerIds.includes(layerId), snapshot.routeLayerIds.join(', ')),
      )),
      ...((chromeContract.forbiddenRouteLayers ?? []).map(layerId =>
        semanticCheck(`forbidden route/map layer ${layerId} absent`, !snapshot.routeLayerIds.includes(layerId), snapshot.routeLayerIds.join(', ')),
      )),
    ],
    print: [
      semanticCheck('editor map loaded', editorGeometry?.renderStatus?.mapLoaded === true && editorGeometry?.renderStatus?.tilesLoaded === true && editorGeometry?.renderStatus?.timedOut !== true, JSON.stringify(editorGeometry?.renderStatus ?? {})),
      semanticCheck('editor route source loaded', editorGeometry?.renderStatus?.primaryRouteExpected === false || (
        editorGeometry?.renderStatus?.routeSourcePresent === true &&
        editorGeometry?.renderStatus?.routeSourceLoaded === true &&
        editorGeometry?.renderStatus?.routeContentPresent === true
      ), JSON.stringify(editorGeometry?.renderStatus ?? {})),
      semanticCheck('editor and print route expectation matches', editorGeometry?.renderStatus?.primaryRouteExpected === geometry.renderStatus?.primaryRouteExpected, `${editorGeometry?.renderStatus?.primaryRouteExpected} vs ${geometry.renderStatus?.primaryRouteExpected}`),
      semanticCheck('print has no editor controls', snapshot.editorControlCount === 0, `${snapshot.editorControlCount} visible controls`),
      semanticCheck('print render readiness observed', geometry.renderReadyObserved === true && snapshot.renderReady === true, JSON.stringify({
        observed: geometry.renderReadyObserved,
        ready: snapshot.renderReady,
        status: geometry.renderStatus ?? snapshot.renderStatus,
      })),
    ],
  }

  appendSemanticTokenContractChecks(groups, style, semanticTokenContract)

  if (entry.themeId === 'editorial-minimal') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.layout.push(
      semanticCheck('Editorial uses editorial-tall composition', style.composition === 'editorial-tall', String(style.composition ?? '')),
      semanticCheck('Editorial map band is 64 percent of poster height', mapHeightRatio >= 0.635 && mapHeightRatio <= 0.665, mapHeightRatio.toFixed(3)),
    )
    groups.typography.push(
      semanticCheck('Editorial title uses Playfair Display', snapshot.title.fontFamily.includes('Playfair Display'), snapshot.title.fontFamily),
      semanticCheck('Editorial body uses Source Serif 4', String(style.body_font_family ?? '').includes('Source Serif 4'), String(style.body_font_family ?? '')),
      semanticCheck('Editorial title is natural case', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
    )
    groups.palette.push(
      semanticCheck('Editorial warm paper background', String(style.background_color).toUpperCase() === '#F8F3EA', String(style.background_color ?? '')),
      semanticCheck('Editorial label background matches paper', String(style.label_bg_color).toUpperCase() === '#F8F3EA', String(style.label_bg_color ?? '')),
      semanticCheck('Editorial text is warm black', String(style.label_text_color).toUpperCase() === '#171410', String(style.label_text_color ?? '')),
      semanticCheck('Editorial route is rust accent', String(style.route_color).toUpperCase() === '#9A3B27', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Editorial uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Editorial contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Editorial roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Editorial hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Editorial warm land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#F1EADD' && String(atlasLayerSettings.landcover?.texture ?? '') === 'paper', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Editorial water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#D8DEE0' && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === '#B7C8CC', JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Editorial contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#D7CFC0' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#AFA28B', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Editorial print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Editorial gallery route layers present', ['route-line-editorial-gallery-shadow', 'route-line-editorial-paper-channel', 'route-line-editorial-ink-ridge', 'route-line-editorial-collector-cuts'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Editorial route weight is gallery accent', Number(style.route_width ?? 0) >= 3.2 && Number(style.route_width ?? 0) <= 3.8, String(style.route_width ?? '')),
      semanticCheck('Editorial poster grid disabled', style.show_grid === false, String(style.show_grid)),
    )
  }

  if (entry.themeId === 'blueprint') {
    const atlasLayers = style.atlas_layers ?? {}
    const cyanotypeReference = hexToRgb('#173F66')
    const backgroundRgb = hexToRgb(style.background_color)
    const labelBackgroundRgb = hexToRgb(style.label_bg_color)
    groups.typography.push(
      semanticCheck('Blueprint title uses Space Grotesk', snapshot.title.fontFamily.includes('Space Grotesk'), snapshot.title.fontFamily),
      semanticCheck('Blueprint title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Blueprint title is large', titleSizePx >= 48, `${titleSizePx}px`),
    )
    groups.layout.push(
      semanticCheck('Blueprint has integrated titleblock band', mapHeightRatio > 0.66 && mapHeightRatio < 0.82, mapHeightRatio.toFixed(3)),
      semanticCheck('Blueprint footer/titleblock is present', snapshot.footer.display !== 'none' && Boolean(snapshot.footer.rect?.height), snapshot.footer.display),
    )
    groups.palette.push(
      semanticCheck('Blueprint cyanotype background', colorDistance(backgroundRgb, cyanotypeReference) < 28, String(style.background_color ?? '')),
      semanticCheck('Blueprint label band matches cyanotype background', colorDistance(backgroundRgb, labelBackgroundRgb) < 4, `${style.background_color}/${style.label_bg_color}`),
      semanticCheck('Blueprint route is yellow', String(style.route_color).toUpperCase() === '#FFD45A', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Blueprint print map loaded', geometry.renderStatus?.mapLoaded === true && geometry.renderStatus?.tilesLoaded === true && geometry.renderStatus?.timedOut !== true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Blueprint uses owned alidade map', style.preset === 'radmaps-alidade-dark', String(style.preset ?? '')),
      semanticCheck('Blueprint contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Blueprint roads hidden', style.show_roads === false, String(style.show_roads)),
      semanticCheck('Blueprint labels hidden', style.show_place_labels === false && style.show_poi_labels === false, `${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Blueprint contour-only atlas layers', atlasLayers.contour === true
        && atlasLayers.landcover === false
        && atlasLayers.water === false
        && atlasLayers.waterway === false
        && atlasLayers.park === false
        && atlasLayers.transportation === false
        && atlasLayers.building === false
        && atlasLayers.place === false
        && atlasLayers.poi === false, JSON.stringify(atlasLayers)),
    )
    groups.routeStyling.push(
      semanticCheck('Blueprint print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Blueprint route is yellow', String(style.route_color).toUpperCase() === '#FFD45A', String(style.route_color ?? '')),
      semanticCheck('Blueprint route weight is drafting-bold', Number(style.route_width ?? 0) >= 4.5, String(style.route_width ?? '')),
    )
    groups.motifs.push(
      semanticCheck('Blueprint poster drafting grid enabled', style.show_grid === true && style.grid_scope === 'poster', `${style.show_grid}/${style.grid_scope}`),
      semanticCheck('Blueprint grid visible', snapshot.grid.exists, JSON.stringify(snapshot.grid)),
      semanticCheck('Blueprint grid density configured', Number(style.grid_spacing ?? 0) >= 4 && Number(style.grid_spacing ?? 0) <= 6, String(style.grid_spacing ?? '')),
      semanticCheck('Blueprint grid is light enough for drafting', Number(style.grid_opacity ?? 0) >= 0.12 && Number(style.grid_opacity ?? 0) <= 0.22, String(style.grid_opacity ?? '')),
      semanticCheck('Blueprint drafting labels present', snapshot.blueprintDrafting.topline && snapshot.blueprintDrafting.figure, JSON.stringify(snapshot.blueprintDrafting)),
      semanticCheck('Blueprint neatline present', snapshot.blueprintDrafting.neatline, JSON.stringify(snapshot.blueprintDrafting)),
    )
  }

  if (entry.themeId === 'moonstone') {
    groups.typography.push(
      semanticCheck('Moonstone title uses Space Grotesk', snapshot.title.fontFamily.includes('Space Grotesk'), snapshot.title.fontFamily),
      semanticCheck('Moonstone body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Moonstone title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Moonstone uses Blueprint grid composition', style.composition === 'blueprint-grid', String(style.composition ?? '')),
    )
    groups.palette.push(
      semanticCheck('Moonstone cool paper background', String(style.background_color).toUpperCase() === '#EEF0ED', String(style.background_color ?? '')),
      semanticCheck('Moonstone label background matches paper', String(style.label_bg_color).toUpperCase() === '#EEF0ED', String(style.label_bg_color ?? '')),
      semanticCheck('Moonstone text is graphite', String(style.label_text_color).toUpperCase() === '#243238', String(style.label_text_color ?? '')),
      semanticCheck('Moonstone route is oxidized rust', String(style.route_color).toUpperCase() === '#9B4D3A', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Moonstone uses owned alidade map', style.preset === 'radmaps-alidade', String(style.preset ?? '')),
      semanticCheck('Moonstone contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Moonstone roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Moonstone hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Moonstone route map remains light colorway', String(style.land_color ?? '').toUpperCase() === '#E4E7E1' && String(style.water_color ?? '').toUpperCase() === '#B7C9CC', `${style.land_color}/${style.water_color}`),
      semanticCheck('Moonstone graphite contour tokens configured', String(style.contour_color ?? '').toUpperCase() === '#B6BFB9' && String(style.contour_major_color ?? '').toUpperCase() === '#687972', `${style.contour_color}/${style.contour_major_color}`),
    )
    groups.routeStyling.push(
      semanticCheck('Moonstone print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Moonstone route has engraved weight', Number(style.route_width ?? 0) >= 3 && Number(style.route_width ?? 0) <= 4.1, String(style.route_width ?? '')),
      semanticCheck('Moonstone endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Moonstone etched route layers present', ['route-line-moonstone-engraved-channel', 'route-line-moonstone-blueprint-offset', 'route-line-moonstone-survey-ticks'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Moonstone does not inherit dark Blueprint station crosses', !snapshot.routeLayerIds.includes('route-line-blueprint-station-crosses'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Moonstone map grid enabled', style.show_grid === true && style.grid_scope === 'map', `${style.show_grid}/${style.grid_scope}`),
      semanticCheck('Moonstone map grid density configured', Number(style.grid_spacing ?? 0) === 8 && Number(style.grid_opacity ?? 0) >= 0.06 && Number(style.grid_opacity ?? 0) <= 0.09, `${style.grid_spacing}/${style.grid_opacity}`),
      semanticCheck('Moonstone map grid present', snapshot.grid.mapExists === true, JSON.stringify(snapshot.grid)),
      semanticCheck('Moonstone does not inherit Blueprint drafting labels', snapshot.blueprintDrafting.topline === false && snapshot.blueprintDrafting.figure === false, JSON.stringify(snapshot.blueprintDrafting)),
    )
  }

  if (entry.themeId === 'blueprint-strava') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Trail Blueprint title uses Space Grotesk', snapshot.title.fontFamily.includes('Space Grotesk'), snapshot.title.fontFamily),
      semanticCheck('Trail Blueprint body uses IBM Plex Sans', snapshot.footer.fontFamily.includes('IBM Plex Sans') || String(style.body_font_family ?? '').includes('IBM Plex Sans'), `${snapshot.footer.fontFamily} / ${style.body_font_family ?? ''}`),
      semanticCheck('Trail Blueprint title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Trail Blueprint uses technical composition', style.composition === 'blueprint-strava', String(style.composition ?? '')),
      semanticCheck('Trail Blueprint data footer is present', snapshot.footer.display !== 'none' && Boolean(snapshot.footer.rect?.height), snapshot.footer.display),
      semanticCheck('Trail Blueprint map panel is dominant', mapHeightRatio > 0.68 && mapHeightRatio < 0.88, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Trail Blueprint dark ink background', String(style.background_color).toUpperCase() === '#07120F', String(style.background_color ?? '')),
      semanticCheck('Trail Blueprint integrated title/footer ink matches background', String(style.label_bg_color).toUpperCase() === '#07120F', String(style.label_bg_color ?? '')),
      semanticCheck('Trail Blueprint data text uses pale green', String(style.label_text_color).toUpperCase() === '#DDF7EC', String(style.label_text_color ?? '')),
      semanticCheck('Trail Blueprint route is green', String(style.route_color).toUpperCase() === '#3DDC97', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Trail Blueprint uses owned alidade dark map', style.preset === 'radmaps-alidade-dark', String(style.preset ?? '')),
      semanticCheck('Trail Blueprint restrained contours enabled', style.show_contours === true && Number(style.contour_detail ?? 0) >= 1 && Number(style.contour_detail ?? 0) <= 2, `${style.show_contours}/${style.contour_detail}`),
      semanticCheck('Trail Blueprint hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Trail Blueprint roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Trail Blueprint landcover is dark green ink', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#0B1A15' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.9, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Trail Blueprint water is subdued dark ink', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#071B16' && Number(atlasLayerSettings.water?.fill_opacity ?? 0) <= 0.6, JSON.stringify(atlasLayerSettings.water ?? {})),
      semanticCheck('Trail Blueprint contours use green drafting ink', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#3A6A5E' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#91BFAE', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Trail Blueprint live route source loaded', snapshot.routeLayerIds.includes('route-line'), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Trail Blueprint route stays a clean GPX data line', !snapshot.routeLayerIds.some(layerId => layerId.startsWith('route-line-electric-') || layerId.startsWith('route-line-blueprint-') || layerId.startsWith('route-line-performance-') || layerId.startsWith('route-line-darksky-')), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Trail Blueprint route has compact data-line weight', Number(style.route_width ?? 0) >= 2.6 && Number(style.route_width ?? 0) <= 3.6, String(style.route_width ?? '')),
      semanticCheck('Trail Blueprint endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
    )
    groups.motifs.push(
      semanticCheck('Trail Blueprint map grid enabled', style.show_grid === true && style.grid_scope === 'map', `${style.show_grid}/${style.grid_scope}`),
      semanticCheck('Trail Blueprint grid density is technical and restrained', Number(style.grid_spacing ?? 0) === 8 && Number(style.grid_opacity ?? 0) >= 0.12 && Number(style.grid_opacity ?? 0) <= 0.16 && Number(style.grid_weight ?? 0) === 1, `${style.grid_spacing}/${style.grid_opacity}/${style.grid_weight}`),
      semanticCheck('Trail Blueprint map grid present', snapshot.grid.mapExists === true, JSON.stringify(snapshot.grid)),
      semanticCheck('Trail Blueprint does not inherit Blueprint drafting labels', snapshot.blueprintDrafting.topline === false && snapshot.blueprintDrafting.figure === false, JSON.stringify(snapshot.blueprintDrafting)),
    )
  }

  if (entry.themeId === 'usgs-vintage') {
    const atlasLayers = style.atlas_layers ?? {}
    const paperReference = hexToRgb('#F0ECDE')
    const backgroundRgb = hexToRgb(style.background_color)
    const labelBackgroundRgb = hexToRgb(style.label_bg_color)
    groups.typography.push(
      semanticCheck('USGS title uses Libre Baskerville', snapshot.title.fontFamily.includes('Libre Baskerville'), snapshot.title.fontFamily),
      semanticCheck('USGS title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('USGS title is collar-scaled and readable', titleSizePx >= 42, `${titleSizePx}px`),
    )
    groups.layout.push(
      semanticCheck('USGS full quad map area is dominant', mapHeightRatio > 0.72 && mapHeightRatio < 0.90, mapHeightRatio.toFixed(3)),
      semanticCheck('USGS bottom collar is present', snapshot.header.display !== 'none' && Boolean(snapshot.header.rect?.height), snapshot.header.display),
      semanticCheck('USGS footer collar corner ticks are present', snapshot.footer.display !== 'none' && Boolean(snapshot.footer.rect?.height), snapshot.footer.display),
      semanticCheck('USGS map neatline has real stroke weight', cssPx(snapshot.map.borderTopWidth) >= 1.4, snapshot.map.borderTopWidth),
      semanticCheck('USGS collar is integrated with paper, not carded', isTransparentCssColor(snapshot.header.backgroundColor) && isTransparentCssColor(snapshot.footer.backgroundColor) && String(snapshot.header.boxShadow ?? '').toLowerCase() === 'none', `${snapshot.header.backgroundColor}/${snapshot.footer.backgroundColor}/${snapshot.header.boxShadow}`),
    )
    groups.palette.push(
      semanticCheck('USGS cream paper background', colorDistance(backgroundRgb, paperReference) < 18, String(style.background_color ?? '')),
      semanticCheck('USGS label band matches cream paper', colorDistance(backgroundRgb, labelBackgroundRgb) < 4, `${style.background_color}/${style.label_bg_color}`),
      semanticCheck('USGS route is rust red', String(style.route_color).toUpperCase() === '#9D3825', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('USGS print map loaded', geometry.renderStatus?.mapLoaded === true && geometry.renderStatus?.tilesLoaded === true && geometry.renderStatus?.timedOut !== true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('USGS uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('USGS contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('USGS minor contours are tan', String(style.contour_color).toUpperCase() === '#C5AA72', String(style.contour_color ?? '')),
      semanticCheck('USGS index contours are green', String(style.contour_major_color).toUpperCase() === '#617349', String(style.contour_major_color ?? '')),
      semanticCheck('USGS roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('USGS map layer set is contour and paper only', atlasLayers.contour === true
        && atlasLayers.landcover === true
        && atlasLayers.park === true
        && atlasLayers.water === false
        && atlasLayers.waterway === false
        && atlasLayers.transportation === false
        && atlasLayers.building === false
        && atlasLayers.place === false
        && atlasLayers.poi === false, JSON.stringify(atlasLayers)),
    )
    groups.routeStyling.push(
      semanticCheck('USGS print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('USGS route is rust red', String(style.route_color).toUpperCase() === '#9D3825', String(style.route_color ?? '')),
      semanticCheck('USGS route weight is clean survey line', Number(style.route_width ?? 0) >= 3 && Number(style.route_width ?? 0) <= 4.25, String(style.route_width ?? '')),
      semanticCheck('USGS endpoint markers enabled', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('USGS clean paper-channel route layer present', snapshot.routeLayerIds.includes('route-line-usgs-paper-channel'), snapshot.routeLayerIds.join(', ')),
      semanticCheck('USGS speculative route artifacts absent', !snapshot.routeLayerIds.includes('route-line-usgs-red-pencil-offset') && !snapshot.routeLayerIds.includes('route-line-usgs-survey-hachures') && !snapshot.routeLayerIds.includes('route-line-usgs-survey-stations'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('USGS coordinate label present', (snapshot.contractPresence?.testIdCounts?.['usgs-heritage-coordinate'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('USGS scale label present', (snapshot.contractPresence?.testIdCounts?.['usgs-heritage-scale'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('USGS four geodetic coordinate ticks present', (snapshot.contractPresence?.testIdCounts?.['usgs-coordinate-tick'] ?? 0) >= 4, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('USGS each corner tick is present', ['.usgs-coordinate-tick--nw', '.usgs-coordinate-tick--ne', '.usgs-coordinate-tick--se', '.usgs-coordinate-tick--sw'].every(selector => Number(snapshot.contractPresence?.selectorCounts?.[selector] ?? 0) > 0), JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('USGS printed grid disabled', style.show_grid === false, String(style.show_grid)),
    )
  }

  if (entry.themeId === 'classic-trail') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Classic Trail title uses Libre Baskerville', snapshot.title.fontFamily.includes('Libre Baskerville'), snapshot.title.fontFamily),
      semanticCheck('Classic Trail body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
      semanticCheck('Classic Trail title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Classic Trail uses USGS park-quad composition', style.composition === 'park-quad', String(style.composition ?? '')),
      semanticCheck('Classic Trail footer/collar remains visible', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Classic Trail cool paper background', String(style.background_color).toUpperCase() === '#EEEEEA', String(style.background_color ?? '')),
      semanticCheck('Classic Trail label background matches cool paper', String(style.label_bg_color).toUpperCase() === '#EEEEEA', String(style.label_bg_color ?? '')),
      semanticCheck('Classic Trail text is slate ink', String(style.label_text_color).toUpperCase() === '#26313B', String(style.label_text_color ?? '')),
      semanticCheck('Classic Trail route is slate blue', String(style.route_color).toUpperCase() === '#2F536A', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Classic Trail uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Classic Trail contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Classic Trail place labels hidden for contour-only quad', style.show_place_labels === false, String(style.show_place_labels)),
      semanticCheck('Classic Trail roads and POIs hidden', style.show_roads === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_poi_labels}`),
      semanticCheck('Classic Trail hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Classic Trail cool paper land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#EEEEEA' && String(atlasLayerSettings.landcover?.texture ?? '') === 'paper', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Classic Trail water layers suppressed for slate contour quad', Number(atlasLayerSettings.water?.fill_opacity ?? 1) === 0 && Number(atlasLayerSettings.waterway?.opacity ?? 1) === 0, JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Classic Trail slate contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#9FA6AD' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#5F6E7E', JSON.stringify(atlasLayerSettings.contour ?? {})),
      semanticCheck('Classic Trail place label token suppressed', String(atlasLayerSettings.place?.label_color ?? '').toUpperCase() === '#40505A' && Number(atlasLayerSettings.place?.label_opacity ?? 1) === 0, JSON.stringify(atlasLayerSettings.place ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Classic Trail print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Classic Trail route has survey weight', Number(style.route_width ?? 0) >= 3 && Number(style.route_width ?? 0) <= 4, String(style.route_width ?? '')),
      semanticCheck('Classic Trail route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Classic Trail endpoint markers enabled', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Classic Trail slate route layers present', ['route-line-classic-trail-paper-channel', 'route-line-classic-trail-slate-offset'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Classic Trail blaze route artifacts absent', !snapshot.routeLayerIds.includes('route-line-classic-trail-blaze-cuts') && !snapshot.routeLayerIds.includes('route-line-classic-trail-blazes'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Classic Trail does not inherit USGS coordinate chrome', (snapshot.contractPresence?.testIdCounts?.['usgs-heritage-coordinate'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Classic Trail does not inherit USGS scale chrome', (snapshot.contractPresence?.testIdCounts?.['usgs-heritage-scale'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Classic Trail printed grid disabled', style.show_grid === false, String(style.show_grid)),
    )
  }

  if (entry.themeId === 'risograph') {
    const atlasLayers = style.atlas_layers ?? {}
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Risograph title uses Big Shoulders Display', snapshot.title.fontFamily.includes('Big Shoulders Display'), snapshot.title.fontFamily),
      semanticCheck('Risograph body uses Work Sans', String(style.body_font_family ?? '').includes('Work Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Risograph title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Risograph title is stacked and large', titleSizePx >= 52, `${titleSizePx}px`),
    )
    groups.layout.push(
      semanticCheck('Risograph uses riso-stack composition', style.composition === 'riso-stack', String(style.composition ?? '')),
      semanticCheck('Risograph caption/meta footer remains visible', footerVisible === true, `${footerVisible}`),
      semanticCheck('Risograph title floats as ink, not a panel', isTransparentCssColor(snapshot.header.backgroundColor) && String(snapshot.header.boxShadow ?? '').toLowerCase() === 'none', `${snapshot.header.backgroundColor}/${snapshot.header.boxShadow}`),
      semanticCheck('Risograph map stack occupies print field', mapHeightRatio >= 0.68 && mapHeightRatio <= 0.76, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Risograph paper background', String(style.background_color).toUpperCase() === '#F4F0E3', String(style.background_color ?? '')),
      semanticCheck('Risograph label background matches paper', String(style.label_bg_color).toUpperCase() === '#F4F0E3', String(style.label_bg_color ?? '')),
      semanticCheck('Risograph ink is deep blue', String(style.label_text_color).toUpperCase() === '#16243F', String(style.label_text_color ?? '')),
      semanticCheck('Risograph route is fluoro pink', String(style.route_color).toUpperCase() === '#FF4F7B', String(style.route_color ?? '')),
      semanticCheck('Risograph contour ink is blue', String(style.contour_color).toUpperCase() === '#2F5FD0', String(style.contour_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Risograph uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Risograph contour-only atlas layers', atlasLayers.contour === true
        && atlasLayers.landcover === true
        && atlasLayers.water === false
        && atlasLayers.waterway === false
        && atlasLayers.park === false
        && atlasLayers.transportation === false
        && atlasLayers.place === false
        && atlasLayers.poi === false,
      JSON.stringify(atlasLayers)),
      semanticCheck('Risograph contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Risograph roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Risograph hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Risograph duotone print effect configured', style.tile_effect === 'duotone' && Number(style.tile_duotone_strength ?? 0) >= 0.75, `${style.tile_effect}/${style.tile_duotone_strength}`),
      semanticCheck('Risograph paper grain configured', Number(style.tile_grain ?? 0) >= 0.45, String(style.tile_grain ?? '')),
      semanticCheck('Risograph paper land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#F4F0E3' && String(atlasLayerSettings.landcover?.texture ?? '') === 'paper', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Risograph blue contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#2F5FD0' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#2F5FD0', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Risograph print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Risograph route weight is bold two-ink print line', Number(style.route_width ?? 0) >= 4.4 && Number(style.route_width ?? 0) <= 5.2, String(style.route_width ?? '')),
      semanticCheck('Risograph endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Risograph misregistered route plates present', ['route-line-riso-blue', 'route-line-riso-pink-overprint'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Risograph caption present', (snapshot.contractPresence?.testIdCounts?.['composition-riso-caption'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Risograph meta block present', (snapshot.contractPresence?.testIdCounts?.['composition-riso-meta'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Risograph title blue misregistration offset present', snapshot.risoTitleOffset.content && snapshot.risoTitleOffset.content !== 'none' && snapshot.risoTitleOffset.content !== '""', JSON.stringify(snapshot.risoTitleOffset)),
      semanticCheck('Risograph title uses multiply overprint', snapshot.risoTitleOffset.mixBlendMode === 'multiply', JSON.stringify(snapshot.risoTitleOffset)),
      semanticCheck('Risograph title offset is physically displaced', Number.parseFloat(snapshot.risoTitleOffset.left || '0') > 0 && Number.parseFloat(snapshot.risoTitleOffset.top || '0') > 0, JSON.stringify(snapshot.risoTitleOffset)),
    )
  }

  if (['midcentury-travel', 'ranch-ochre', 'daybreak-trace'].includes(entry.themeId)) {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    const expected = {
      'midcentury-travel': {
        paper: '#E6D2A2',
        band: '#19382A',
        text: '#FAEBC2',
        route: '#2A2018',
        land: '#E8CC93',
        water: '#83A79D',
        waterway: '#6E9A94',
        minorContour: '#D8A85F',
        majorContour: '#B06A2A',
        grainMin: 0.10,
        grainMax: 0.14,
      },
      'ranch-ochre': {
        paper: '#EFDEC0',
        band: '#EFDEC0',
        text: '#3A2414',
        route: '#3A2414',
        land: '#E9CD95',
        water: '#EFDEC0',
        waterway: '#A3733C',
        minorContour: '#A3733C',
        majorContour: '#684620',
        grainMin: 0.14,
        grainMax: 0.18,
      },
      'daybreak-trace': {
        paper: '#F4D8CF',
        band: '#F4D8CF',
        text: '#3A2630',
        route: '#3A2630',
        land: '#F4D8CF',
        water: '#F4D8CF',
        waterway: '#E19A82',
        minorContour: '#E19A82',
        majorContour: '#BE624A',
        grainMin: 0.08,
        grainMax: 0.12,
      },
    }[entry.themeId]
    groups.typography.push(
      semanticCheck('Mid-Century family title uses Oswald', snapshot.title.fontFamily.includes('Oswald'), snapshot.title.fontFamily),
      semanticCheck('Mid-Century family body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
      semanticCheck('Mid-Century family title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Mid-Century family travel-banner composition', style.composition === 'travel-banner', String(style.composition ?? '')),
      semanticCheck('Mid-Century family map-dominant travel-poster balance', mapHeightRatio >= 0.68 && mapHeightRatio <= 0.84, mapHeightRatio.toFixed(3)),
      semanticCheck('Mid-Century banner is integrated with paper, not shadowed card', String(snapshot.header.boxShadow ?? '').toLowerCase() === 'none', String(snapshot.header.boxShadow ?? '')),
    )
    groups.palette.push(
      semanticCheck('Mid-Century family colorway paper token', String(style.background_color).toUpperCase() === expected.paper, `${style.background_color ?? ''} vs ${expected.paper}`),
      semanticCheck('Mid-Century family colorway banner token', String(style.label_bg_color).toUpperCase() === expected.band, `${style.label_bg_color ?? ''} vs ${expected.band}`),
      semanticCheck('Mid-Century family colorway title text token', String(style.label_text_color).toUpperCase() === expected.text, `${style.label_text_color ?? ''} vs ${expected.text}`),
      semanticCheck('Mid-Century family colorway route token', String(style.route_color).toUpperCase() === expected.route, `${style.route_color ?? ''} vs ${expected.route}`),
      semanticCheck('Mid-Century family grain configured', Number(style.tile_grain ?? 0) >= expected.grainMin && Number(style.tile_grain ?? 0) <= expected.grainMax, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Mid-Century family uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Mid-Century family contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Mid-Century family non-essential labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Mid-Century family hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Mid-Century family landcover polygons disabled for flat poster paper', style.atlas_layers?.landcover === false, JSON.stringify(style.atlas_layers ?? {})),
      semanticCheck('Mid-Century family colorway land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === expected.land, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Mid-Century family colorway water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === expected.water && String((atlasLayerSettings.waterway?.color ?? atlasLayerSettings.water?.waterway_color) ?? '').toUpperCase() === expected.waterway, JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Mid-Century family colorway contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === expected.minorContour && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === expected.majorContour, JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Mid-Century family print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Mid-Century family route is bold poster ink', Number(style.route_width ?? 0) >= 3.8, String(style.route_width ?? '')),
      semanticCheck('Mid-Century family endpoint markers enabled', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Mid-Century family uses solid GPX route without extra route ornaments', !['route-line-travel-shadow', 'route-line-travel-highlight', 'route-line-travel-register-cuts', 'route-line-travel-waypoints'].some(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Mid-Century sun motif present', (snapshot.contractPresence?.testIdCounts?.['composition-travel-sun'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Mid-Century sun motif has print opacity', snapshot.travelSun.exists === true && Number.parseFloat(snapshot.travelSun.opacity || '0') >= 0.65 && snapshot.travelSun.mixBlendMode === 'multiply', JSON.stringify(snapshot.travelSun)),
      semanticCheck('Mid-Century sun arc selectors present', ['.composition-travel-sun__disk', '.composition-travel-sun__arc--wide', '.composition-travel-sun__arc--mid', '.composition-travel-sun__arc--inner'].every(selector => Number(snapshot.contractPresence?.selectorCounts?.[selector] ?? 0) > 0), JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Mid-Century printed grid disabled', style.show_grid === false, String(style.show_grid)),
    )
  }

  if (entry.themeId === 'brutalist') {
    groups.typography.push(
      semanticCheck('Brutalist title uses Bebas Neue', snapshot.title.fontFamily.includes('Bebas Neue'), snapshot.title.fontFamily),
      semanticCheck('Brutalist title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Brutalist title is monumental', titleSizePx >= 58, `${titleSizePx}px`),
    )
    groups.palette.push(
      semanticCheck('Brutalist concrete background', String(style.background_color).toUpperCase() === '#E4E0D7', String(style.background_color ?? '')),
      semanticCheck('Brutalist route is orange', String(style.route_color).toUpperCase() === '#FF3B00', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Brutalist uses owned toner map', style.preset === 'radmaps-toner-light', String(style.preset ?? '')),
      semanticCheck('Brutalist contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Brutalist minor contours are pale concrete', String(style.contour_color).toUpperCase() === '#C2BFB5', String(style.contour_color ?? '')),
      semanticCheck('Brutalist index contours are concrete graphite', String(style.contour_major_color).toUpperCase() === '#4C4740', String(style.contour_major_color ?? '')),
      semanticCheck('Brutalist index contours are deliberate but not map-dominant', Number(style.contour_major_width ?? 0) >= 0.8 && Number(style.atlas_layer_settings?.contour?.major_opacity ?? 0) >= 0.38 && Number(style.atlas_layer_settings?.contour?.major_opacity ?? 0) <= 0.5, `${style.contour_major_width}/${style.atlas_layer_settings?.contour?.major_opacity}`),
      semanticCheck('Brutalist roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
    )
    groups.routeStyling.push(
      semanticCheck('Brutalist route is deliberate heavy line', Number(style.route_width ?? 0) >= 4.4, String(style.route_width ?? '')),
      semanticCheck('Brutalist endpoint markers disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Brutalist elevation profile disabled', style.show_elevation_profile !== true, String(style.show_elevation_profile)),
    )
    groups.motifs.push(
      semanticCheck('Brutalist baseline grid present', (snapshot.contractPresence?.testIdCounts?.['composition-brutalist-baseline-grid'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Brutalist registration marks present', (snapshot.contractPresence?.testIdCounts?.['composition-brutalist-registration-marks'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Brutalist baseline grid is visible but restrained', snapshot.brutalistMotifs.baselineGrid === true && Number.parseFloat(snapshot.brutalistMotifs.baselineGridOpacity || '0') >= 0.12 && Number.parseFloat(snapshot.brutalistMotifs.baselineGridOpacity || '0') <= 0.22, JSON.stringify(snapshot.brutalistMotifs)),
      semanticCheck('Brutalist registration marks have print contrast', snapshot.brutalistMotifs.registrationMarks === true && Number.parseFloat(snapshot.brutalistMotifs.registrationOpacity || '0') >= 0.30, JSON.stringify(snapshot.brutalistMotifs)),
    )
  }

  if (entry.themeId === 'sea-chart') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Sea Chart title uses Libre Baskerville', snapshot.title.fontFamily.includes('Libre Baskerville'), snapshot.title.fontFamily),
      semanticCheck('Sea Chart body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Sea Chart title case is not forced uppercase', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Sea Chart uses nautical composition', style.composition === 'sea-chart', String(style.composition ?? '')),
      semanticCheck('Sea Chart footer remains hidden', footerVisible === false, `${footerVisible}`),
      semanticCheck('Sea Chart titleblock is integrated near lower neatline', Boolean(snapshot.header.rect && snapshot.canvas.rect) && snapshot.header.rect.left / snapshot.canvas.rect.width < 0.075 && (snapshot.header.rect.top + snapshot.header.rect.height) / snapshot.canvas.rect.height > 0.84, JSON.stringify(snapshot.header.rect ?? {})),
      semanticCheck('Sea Chart titleblock background is transparent', ['rgba(0, 0, 0, 0)', 'transparent'].includes(String(snapshot.header.backgroundColor ?? '').toLowerCase()), String(snapshot.header.backgroundColor ?? '')),
      semanticCheck('Sea Chart titleblock is not a floating card shadow', String(snapshot.header.boxShadow ?? '').toLowerCase() === 'none', String(snapshot.header.boxShadow ?? '')),
      semanticCheck('Sea Chart titleblock uses a single chart rule', snapshot.headerRule.exists === true && Number(snapshot.headerRule.rect?.height ?? 0) >= 1 && Number.parseFloat(snapshot.headerRule.opacity || '0') >= 0.35, JSON.stringify(snapshot.headerRule ?? {})),
    )
    groups.palette.push(
      semanticCheck('Sea Chart warm chart paper background', String(style.background_color).toUpperCase() === '#EDE6D2', String(style.background_color ?? '')),
      semanticCheck('Sea Chart label band matches chart paper', String(style.label_bg_color).toUpperCase() === '#EDE6D2', String(style.label_bg_color ?? '')),
      semanticCheck('Sea Chart ink color is nautical navy', String(style.label_text_color).toUpperCase() === '#1D2A36', String(style.label_text_color ?? '')),
      semanticCheck('Sea Chart route is magenta', String(style.route_color).toUpperCase() === '#B23A6A', String(style.route_color ?? '')),
      semanticCheck('Sea Chart paper grain configured', Number(style.tile_grain ?? 0) >= 0.06 && Number(style.tile_grain ?? 0) <= 0.10, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Sea Chart uses owned contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Sea Chart contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Sea Chart roads, place labels, and POIs hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Sea Chart hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Sea Chart chart field token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#E6F0EC', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Sea Chart water and waterway tokens configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#CFE2DD' && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === '#7FA999', JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Sea Chart contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#7FA999' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#4A786D', JSON.stringify(atlasLayerSettings.contour ?? {})),
      semanticCheck('Sea Chart place label token suppressed', String(atlasLayerSettings.place?.label_color ?? '').toUpperCase() === '#315C65' && Number(atlasLayerSettings.place?.label_opacity ?? 1) === 0, JSON.stringify(atlasLayerSettings.place ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Sea Chart print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Sea Chart route is course-line weight', Number(style.route_width ?? 0) >= 2.4 && Number(style.route_width ?? 0) <= 3.4, String(style.route_width ?? '')),
      semanticCheck('Sea Chart endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Sea Chart magenta dotted course layer present', snapshot.routeLayerIds.includes('route-line-sea-course'), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Sea Chart waypoint dot layer present', snapshot.routeLayerIds.includes('route-line-sea-waypoints'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Sea Chart poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Sea Chart vector chart motif present', (snapshot.contractPresence?.testIdCounts?.['composition-sea-chart-art'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Sea Chart neatline present', (snapshot.contractPresence?.selectorCounts?.['.sea-chart-neatline'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Sea Chart compass rose present', (snapshot.contractPresence?.testIdCounts?.['sea-chart-rose'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Sea Chart graticule present', (snapshot.contractPresence?.selectorCounts?.['.sea-chart-graticule'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Sea Chart rhumb lines present', (snapshot.contractPresence?.selectorCounts?.['.sea-chart-rhumb-lines'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Sea Chart depth/sounding marks present', (snapshot.contractPresence?.selectorCounts?.['.sea-chart-depth-bands'] ?? 0) > 0 && (snapshot.contractPresence?.selectorCounts?.['.sea-chart-soundings'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Sea Chart soundings are dense enough to read as chart data', (snapshot.contractPresence?.selectorCounts?.['.sea-chart-soundings text'] ?? 0) >= 8, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'transit-diagram') {
    const atlasLayers = style.atlas_layers ?? {}
    groups.typography.push(
      semanticCheck('Transit title uses Outfit', snapshot.title.fontFamily.includes('Outfit'), snapshot.title.fontFamily),
      semanticCheck('Transit title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Transit diagram composition active', style.composition === 'transit-diagram', String(style.composition ?? '')),
      semanticCheck('Transit map occupies diagram panel', mapHeightRatio > 0.62 && mapHeightRatio < 0.86, mapHeightRatio.toFixed(3)),
    )
    groups.mapLayers.push(
      semanticCheck('Transit uses owned simple contour map', style.preset === 'radmaps-simple-contour', String(style.preset ?? '')),
      semanticCheck('Transit contours disabled', style.show_contours === false && atlasLayers.contour === false, `${style.show_contours}/${atlasLayers.contour}`),
      semanticCheck('Transit roads and place labels enabled', style.show_roads === true && style.show_place_labels === true, `${style.show_roads}/${style.show_place_labels}`),
      semanticCheck('Transit POIs hidden', style.show_poi_labels === false, String(style.show_poi_labels)),
      semanticCheck('Transit hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Transit station map layers present', ['transit-station-halo', 'transit-station-dot', 'transit-station-label'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.routeStyling.push(
      semanticCheck('Transit print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Transit route is purple', String(style.route_color).toUpperCase() === '#7A1FA2', String(style.route_color ?? '')),
      semanticCheck('Transit route is diagram-thick', Number(style.route_width ?? 0) >= 6.5, String(style.route_width ?? '')),
      semanticCheck('Transit endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
    )
    groups.motifs.push(
      semanticCheck('Transit map grid enabled', style.show_grid === true && style.grid_scope === 'map', `${style.show_grid}/${style.grid_scope}`),
      semanticCheck('Transit diagram legend present', (snapshot.contractPresence?.testIdCounts?.['composition-transit-diagram-art'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Transit station key present', (snapshot.contractPresence?.testIdCounts?.['transit-diagram-station-key'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Transit line key present', (snapshot.contractPresence?.selectorCounts?.['.transit-diagram-line-key'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'field-journal') {
    const atlasLayers = style.atlas_layers ?? {}
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Field Journal title uses Cormorant Garamond', snapshot.title.fontFamily.includes('Cormorant Garamond'), snapshot.title.fontFamily),
      semanticCheck('Field Journal title is natural case', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
      semanticCheck('Field Journal body uses Source Serif 4', String(style.body_font_family ?? '').includes('Source Serif 4'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Field Journal journal-spread composition active', style.composition === 'journal-spread', String(style.composition ?? '')),
      semanticCheck('Field Journal map leaves right margin notes column', mapHeightRatio > 0.62 && mapHeightRatio < 0.82, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Field Journal kraft paper background', String(style.background_color).toUpperCase() === '#F2E8D4', String(style.background_color ?? '')),
      semanticCheck('Field Journal label band stays kraft paper', String(style.label_bg_color).toUpperCase() === '#F2E8D4', String(style.label_bg_color ?? '')),
      semanticCheck('Field Journal ink text is warm brown-black', String(style.label_text_color).toUpperCase() === '#362616', String(style.label_text_color ?? '')),
      semanticCheck('Field Journal route is brown ink', String(style.route_color).toUpperCase() === '#6A4A2A', String(style.route_color ?? '')),
      semanticCheck('Field Journal paper grain configured', Number(style.tile_grain ?? 0) >= 0.16, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Field Journal uses owned natural map', style.preset === 'radmaps-natural', String(style.preset ?? '')),
      semanticCheck('Field Journal contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Field Journal place labels enabled', style.show_place_labels === true, String(style.show_place_labels)),
      semanticCheck('Field Journal roads and POIs hidden', style.show_roads === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_poi_labels}`),
      semanticCheck('Field Journal hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Field Journal layer-color print effect configured', style.tile_effect === 'layer-color', String(style.tile_effect ?? '')),
      semanticCheck('Field Journal natural atlas layer set', atlasLayers.landcover === true && atlasLayers.water === true && atlasLayers.waterway === true && atlasLayers.park === true && atlasLayers.transportation === false && atlasLayers.poi === false, JSON.stringify(atlasLayers)),
      semanticCheck('Field Journal warm minor contours configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#9B8665', JSON.stringify(atlasLayerSettings.contour ?? {})),
      semanticCheck('Field Journal dark index contours configured', String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#67563A', JSON.stringify(atlasLayerSettings.contour ?? {})),
      semanticCheck('Field Journal muted water configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#A1B6AE', JSON.stringify(atlasLayerSettings.water ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Field Journal print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Field Journal route is exact brown token', String(style.route_color).toUpperCase() === '#6A4A2A', String(style.route_color ?? '')),
      semanticCheck('Field Journal route has ink sketch weight', Number(style.route_width ?? 0) >= 3 && Number(style.route_width ?? 0) <= 3.8, String(style.route_width ?? '')),
      semanticCheck('Field Journal route remains mostly opaque', Number(style.route_opacity ?? 0) >= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Field Journal endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Field Journal drybrush route layers present', ['route-line-journal-wash', 'route-line-journal-drybrush'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Field Journal ruled notes present', (snapshot.contractPresence?.testIdCounts?.['composition-journal-notes'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Field Journal route specimen tag present', (snapshot.contractPresence?.testIdCounts?.['composition-journal-route-sketch'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Field Journal tipped-in tape present', (snapshot.contractPresence?.testIdCounts?.['composition-journal-tape'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Field Journal note rules present', (snapshot.contractPresence?.selectorCounts?.['.journal-note-rule'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Field Journal specimen tag selector present', (snapshot.contractPresence?.selectorCounts?.['.journal-specimen-tag'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Field Journal tape strip selector present', (snapshot.contractPresence?.selectorCounts?.['.journal-tape-strip'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'botanical') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Botanical title uses Cormorant Garamond', snapshot.title.fontFamily.includes('Cormorant Garamond'), snapshot.title.fontFamily),
      semanticCheck('Botanical title is natural case', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
      semanticCheck('Botanical body uses Source Serif 4', String(style.body_font_family ?? '').includes('Source Serif 4'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Botanical plate composition active', style.composition === 'botanical-plate', String(style.composition ?? '')),
      semanticCheck('Botanical map sits as centered plate', mapHeightRatio > 0.62 && mapHeightRatio < 0.82, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Botanical warm green paper background', String(style.background_color).toUpperCase() === '#F0E7D4', String(style.background_color ?? '')),
      semanticCheck('Botanical label background matches paper', String(style.label_bg_color).toUpperCase() === '#F0E7D4', String(style.label_bg_color ?? '')),
      semanticCheck('Botanical text is dark botanical green', String(style.label_text_color).toUpperCase() === '#253721', String(style.label_text_color ?? '')),
      semanticCheck('Botanical route is green ink', String(style.route_color).toUpperCase() === '#31512B', String(style.route_color ?? '')),
      semanticCheck('Botanical paper grain configured', Number(style.tile_grain ?? 0) >= 0.16, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Botanical uses owned natural map', style.preset === 'radmaps-natural', String(style.preset ?? '')),
      semanticCheck('Botanical contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Botanical roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Botanical hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Botanical green land wash configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#E1D8BE' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.94, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Botanical water wash configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#9EBB9F', JSON.stringify(atlasLayerSettings.water ?? {})),
      semanticCheck('Botanical specimen contours configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#8F9F6D' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#536737', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Botanical print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Botanical route is exact green token', String(style.route_color).toUpperCase() === '#31512B', String(style.route_color ?? '')),
      semanticCheck('Botanical route has specimen weight', Number(style.route_width ?? 0) >= 4 && Number(style.route_width ?? 0) <= 4.7, String(style.route_width ?? '')),
      semanticCheck('Botanical route remains mostly opaque', Number(style.route_opacity ?? 0) >= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Botanical endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Botanical specimen route layers present', ['route-line-botanical-pressed', 'route-line-botanical-ink-vein', 'route-line-botanical-specimen-dots'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Botanical engraved frame present', (snapshot.contractPresence?.testIdCounts?.['composition-botanical-frame'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Botanical specimen caption present', (snapshot.contractPresence?.testIdCounts?.['composition-botanical-caption'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Botanical ornamental corners present', (snapshot.contractPresence?.selectorCounts?.['.botanical-corner'] ?? 0) >= 4, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Botanical specimen caption label present', (snapshot.contractPresence?.selectorCounts?.['.botanical-caption-label'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'bold-modern') {
    const atlasLayers = style.atlas_layers ?? {}
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Modernist title uses Big Shoulders Display', snapshot.title.fontFamily.includes('Big Shoulders Display'), snapshot.title.fontFamily),
      semanticCheck('Modernist body uses DM Sans', String(style.body_font_family ?? '').includes('DM Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Modernist title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Modernist uses modernist-block composition', style.composition === 'modernist-block', String(style.composition ?? '')),
      semanticCheck('Modernist generic footer hidden; metadata lives in titleblock', footerVisible === false, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Modernist warm poster background', String(style.background_color).toUpperCase() === '#F2E8DA', String(style.background_color ?? '')),
      semanticCheck('Modernist accent slab is red', String(style.label_bg_color).toUpperCase() === '#E2483D', String(style.label_bg_color ?? '')),
      semanticCheck('Modernist title text is black', String(style.label_text_color).toUpperCase() === '#15130F', String(style.label_text_color ?? '')),
      semanticCheck('Modernist route is red', String(style.route_color).toUpperCase() === '#E2483D', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Modernist uses owned toner map', style.preset === 'radmaps-toner-light', String(style.preset ?? '')),
      semanticCheck('Modernist contour-only atlas layers', atlasLayers.contour === true
        && atlasLayers.landcover === false
        && atlasLayers.water === false
        && atlasLayers.waterway === false
        && atlasLayers.park === false
        && atlasLayers.transportation === false
        && atlasLayers.place === false
        && atlasLayers.poi === false,
      JSON.stringify(atlasLayers)),
      semanticCheck('Modernist contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Modernist roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Modernist hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Modernist landcover disabled in owned map', Number(atlasLayerSettings.landcover?.opacity ?? 1) === 0, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Modernist contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#D6D0C7' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#191614', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Modernist print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Modernist route is heavy graphic line', Number(style.route_width ?? 0) >= 3.9 && Number(style.route_width ?? 0) <= 4.7, String(style.route_width ?? '')),
      semanticCheck('Modernist route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.88, String(style.route_opacity ?? '')),
      semanticCheck('Modernist endpoint markers enabled', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Modernist print trap route layers present', ['route-line-modernist-trap', 'route-line-modernist-knockout', 'route-line-modernist-register'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Modernist poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Modernist accent slab present', (snapshot.contractPresence?.testIdCounts?.['composition-modernist-accent'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Modernist old side rail removed', (snapshot.contractPresence?.testIdCounts?.['composition-side-rail'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Modernist old map bleed removed', (snapshot.contractPresence?.testIdCounts?.['composition-modernist-bleed'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
    )
  }

  if (entry.themeId === 'blackline') {
    const atlasLayers = style.atlas_layers ?? {}
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Blackline title uses Big Shoulders Display', snapshot.title.fontFamily.includes('Big Shoulders Display'), snapshot.title.fontFamily),
      semanticCheck('Blackline body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Blackline title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Blackline inherits Modernist block composition', style.composition === 'modernist-block', String(style.composition ?? '')),
      semanticCheck('Blackline generic footer hidden; metadata lives in titleblock', footerVisible === false, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Blackline clean paper background', String(style.background_color).toUpperCase() === '#F6F6F3', String(style.background_color ?? '')),
      semanticCheck('Blackline accent slab is black', String(style.label_bg_color).toUpperCase() === '#11100E', String(style.label_bg_color ?? '')),
      semanticCheck('Blackline label text token remains contrast-safe', String(style.label_text_color).toUpperCase() === '#F6F6F3', String(style.label_text_color ?? '')),
      semanticCheck('Blackline route is pure black', String(style.route_color).toUpperCase() === '#0C0C0C', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Blackline uses owned toner map', style.preset === 'radmaps-toner-light', String(style.preset ?? '')),
      semanticCheck('Blackline contour-only atlas layers', atlasLayers.contour === true
        && atlasLayers.landcover === false
        && atlasLayers.water === false
        && atlasLayers.waterway === false
        && atlasLayers.park === false
        && atlasLayers.transportation === false
        && atlasLayers.place === false
        && atlasLayers.poi === false,
      JSON.stringify(atlasLayers)),
      semanticCheck('Blackline contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Blackline roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Blackline hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Blackline landcover disabled in owned map', Number(atlasLayerSettings.landcover?.opacity ?? 1) === 0, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Blackline mono contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#D7D7D2' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#11100E', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Blackline print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Blackline route is heavy plate line', Number(style.route_width ?? 0) >= 3.6 && Number(style.route_width ?? 0) <= 4.6, String(style.route_width ?? '')),
      semanticCheck('Blackline endpoint markers enabled', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Blackline clean mono route layers present', ['route-line-blackline-plate', 'route-line-blackline-knockout'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Blackline does not inherit Modernist register route layer', !snapshot.routeLayerIds.includes('route-line-modernist-register') && !snapshot.routeLayerIds.includes('route-line-blackline-register'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Blackline poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Blackline accent slab present', (snapshot.contractPresence?.testIdCounts?.['composition-modernist-accent'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Blackline old side rail removed', (snapshot.contractPresence?.testIdCounts?.['composition-side-rail'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Blackline old map bleed removed', (snapshot.contractPresence?.testIdCounts?.['composition-modernist-bleed'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
    )
  }

  if (entry.themeId === 'marathon-bib') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Marathon title uses Bebas Neue', snapshot.title.fontFamily.includes('Bebas Neue'), snapshot.title.fontFamily),
      semanticCheck('Marathon body uses Atkinson Hyperlegible Next', String(style.body_font_family ?? '').includes('Atkinson Hyperlegible Next'), String(style.body_font_family ?? '')),
      semanticCheck('Marathon title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Marathon uses bib numerals composition', style.composition === 'bib-numerals', String(style.composition ?? '')),
      semanticCheck('Marathon footer/race collar remains visible', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Marathon bib paper background', String(style.background_color).toUpperCase() === '#FBFAF4', String(style.background_color ?? '')),
      semanticCheck('Marathon label band matches bib paper', String(style.label_bg_color).toUpperCase() === '#FBFAF4', String(style.label_bg_color ?? '')),
      semanticCheck('Marathon bib ink is black', String(style.label_text_color).toUpperCase() === '#0A0A0A', String(style.label_text_color ?? '')),
      semanticCheck('Marathon route is race red', String(style.route_color).toUpperCase() === '#E0322C', String(style.route_color ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Marathon uses owned alidade map', style.preset === 'radmaps-alidade', String(style.preset ?? '')),
      semanticCheck('Marathon contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Marathon roads and map labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Marathon hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Marathon keeps map as landcover + contour only', style.atlas_layers?.landcover === true && style.atlas_layers?.contour === true && style.atlas_layers?.water === false && style.atlas_layers?.transportation === false && style.atlas_layers?.place === false && style.atlas_layers?.poi === false, JSON.stringify(style.atlas_layers ?? {})),
      semanticCheck('Marathon race-paper land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#F0ECE2' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.94, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Marathon contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#D8D0C2' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#A59A86', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Marathon print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Marathon route has endpoint pins', style.show_start_pin === true && style.show_finish_pin === true, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Marathon route has bib weight', Number(style.route_width ?? 0) >= 4.4, String(style.route_width ?? '')),
      semanticCheck('Marathon route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.88, String(style.route_opacity ?? '')),
      semanticCheck('Marathon bib route layers present', ['route-line-bib-knockout', 'route-line-bib-mile-dashes', 'route-line-bib-mile-ticks', 'route-line-bib-checkpoint-dots'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Marathon poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Marathon ghost bib numeral present', (snapshot.contractPresence?.testIdCounts?.['composition-bib-ghost'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Marathon bib paper present', (snapshot.contractPresence?.testIdCounts?.['composition-bib-paper'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Marathon pin holes present', (snapshot.contractPresence?.testIdCounts?.['composition-bib-pin-hole'] ?? 0) >= 4, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Marathon tear strip present', (snapshot.contractPresence?.testIdCounts?.['composition-bib-tear-strip'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Marathon finish data headline present', (snapshot.contractPresence?.testIdCounts?.['composition-bib-finish-headline'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
    )
  }

  if (entry.themeId === 'relief-shaded') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Relief title uses Newsreader', snapshot.title.fontFamily.includes('Newsreader'), snapshot.title.fontFamily),
      semanticCheck('Relief title is natural case', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
      semanticCheck('Relief body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Relief uses editorial-tall composition', style.composition === 'editorial-tall', String(style.composition ?? '')),
      semanticCheck('Relief keeps large terrain map band', mapHeightRatio > 0.62 && mapHeightRatio < 0.82, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Relief warm terrain paper background', String(style.background_color).toUpperCase() === '#ECE4D3', String(style.background_color ?? '')),
      semanticCheck('Relief label background matches paper', String(style.label_bg_color).toUpperCase() === '#ECE4D3', String(style.label_bg_color ?? '')),
      semanticCheck('Relief text is warm dark ink', String(style.label_text_color).toUpperCase() === '#27231D', String(style.label_text_color ?? '')),
      semanticCheck('Relief route is deep terrain ink', String(style.route_color).toUpperCase() === '#6C271B', String(style.route_color ?? '')),
      semanticCheck('Relief terrain grain configured', Number(style.tile_grain ?? 0) >= 0.08 && Number(style.tile_grain ?? 0) <= 0.12, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Relief uses owned natural map', style.preset === 'radmaps-natural', String(style.preset ?? '')),
      semanticCheck('Relief hillshade enabled', style.show_hillshade === true && Number(style.hillshade_intensity ?? 0) >= 0.5, `${style.show_hillshade}/${style.hillshade_intensity}`),
      semanticCheck('Relief contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Relief roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Relief layer-color terrain effect configured', style.tile_effect === 'layer-color', String(style.tile_effect ?? '')),
      semanticCheck('Relief hypsometric land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#DCC899' && String(atlasLayerSettings.landcover?.texture ?? '') === 'relief', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Relief terrain water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#9FBDB3', JSON.stringify(atlasLayerSettings.water ?? {})),
      semanticCheck('Relief fine contour token configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#967C52' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#5E4A31', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Relief print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Relief route is exact terrain ink token', String(style.route_color).toUpperCase() === '#6C271B', String(style.route_color ?? '')),
      semanticCheck('Relief endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Relief route has confident weight', Number(style.route_width ?? 0) >= 4.4, String(style.route_width ?? '')),
      semanticCheck('Relief shadow/highlight route layers present', ['route-line-relief-shadow', 'route-line-relief-highlight'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Relief poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Relief hypsometric bands present', (snapshot.contractPresence?.testIdCounts?.['composition-relief-bands'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Relief legend present', (snapshot.contractPresence?.testIdCounts?.['composition-relief-legend'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Relief stamp present', (snapshot.contractPresence?.testIdCounts?.['composition-relief-stamp'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Relief band selectors present', (snapshot.contractPresence?.selectorCounts?.['.relief-band'] ?? 0) >= 3, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Relief legend swatches present', (snapshot.contractPresence?.selectorCounts?.['.relief-legend-swatch'] ?? 0) >= 3, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (['dark-sky', 'copper-night'].includes(entry.themeId)) {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    const expected = entry.themeId === 'dark-sky'
      ? {
          paper: '#070C1E',
          text: '#E7ECFB',
          route: '#E8C66A',
          land: '#101A38',
          water: '#071024',
          waterway: '#18294C',
          minorContour: '#22325D',
          majorContour: '#50689C',
          grainMin: 0.20,
          grainMax: 0.24,
          routeWidthMin: 3.1,
          routeWidthMax: 3.5,
        }
      : {
          paper: '#100B08',
          text: '#F0D9BF',
          route: '#F0B15F',
          land: '#15100C',
          water: '#1B202A',
          waterway: '#2E3440',
          minorContour: '#493021',
          majorContour: '#9C6741',
          grainMin: 0.22,
          grainMax: 0.26,
          routeWidthMin: 3.0,
          routeWidthMax: 3.4,
        }
    groups.typography.push(
      semanticCheck('Dark Sky family title uses Cormorant Garamond', snapshot.title.fontFamily.includes('Cormorant Garamond'), snapshot.title.fontFamily),
      semanticCheck('Dark Sky family body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
      semanticCheck('Dark Sky family title is natural case', snapshot.title.textTransform !== 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Dark Sky family uses star-horizon composition', style.composition === 'darksky-stars', String(style.composition ?? '')),
      semanticCheck('Dark Sky family compact metadata footer remains present', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Dark Sky family night background', String(style.background_color).toUpperCase() === expected.paper, `${style.background_color ?? ''} vs ${expected.paper}`),
      semanticCheck('Dark Sky family label band matches night background', String(style.label_bg_color).toUpperCase() === expected.paper, `${style.label_bg_color ?? ''} vs ${expected.paper}`),
      semanticCheck('Dark Sky family text color matches colorway', String(style.label_text_color).toUpperCase() === expected.text, `${style.label_text_color ?? ''} vs ${expected.text}`),
      semanticCheck('Dark Sky family warm route color', String(style.route_color).toUpperCase() === expected.route, `${style.route_color ?? ''} vs ${expected.route}`),
      semanticCheck('Dark Sky family paper grain configured', Number(style.tile_grain ?? 0) >= expected.grainMin && Number(style.tile_grain ?? 0) <= expected.grainMax, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Dark Sky family uses owned night relief map', style.preset === 'radmaps-night-relief', String(style.preset ?? '')),
      semanticCheck('Dark Sky family contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Dark Sky family roads and map labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Dark Sky family hillshade disabled for flat nocturne relief', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Dark Sky family layer-color tile effect configured', style.tile_effect === 'layer-color', String(style.tile_effect ?? '')),
      semanticCheck('Dark Sky family nocturne land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === expected.land, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Dark Sky family nocturne water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === expected.water && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === expected.waterway, JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Dark Sky family contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === expected.minorContour && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === expected.majorContour, JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Dark Sky family print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Dark Sky family endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Dark Sky family route glint weight', Number(style.route_width ?? 0) >= expected.routeWidthMin && Number(style.route_width ?? 0) <= expected.routeWidthMax, String(style.route_width ?? '')),
      semanticCheck('Dark Sky family constellation route layers present', ['route-line-darksky-glow-wide', 'route-line-darksky-offset-starpath', 'route-line-darksky-constellation', 'route-line-darksky-star-crosses'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Dark Sky family poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Dark Sky family star field present', (snapshot.contractPresence?.testIdCounts?.['composition-star-field'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Dark Sky family ridge horizon present', (snapshot.contractPresence?.testIdCounts?.['composition-darksky-ridge'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Dark Sky family layered ridge lines present', (snapshot.contractPresence?.selectorCounts?.['.darksky-ridge-line'] ?? 0) >= 2, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'electric-atlas') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Electric Atlas title uses Big Shoulders Display', snapshot.title.fontFamily.includes('Big Shoulders Display'), snapshot.title.fontFamily),
      semanticCheck('Electric Atlas title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Electric Atlas body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Electric Atlas uses technical data composition', style.composition === 'blueprint-strava', String(style.composition ?? '')),
      semanticCheck('Electric Atlas technical footer/data band present', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Electric Atlas ink background', String(style.background_color).toUpperCase() === '#060814', String(style.background_color ?? '')),
      semanticCheck('Electric Atlas label background matches ink', String(style.label_bg_color).toUpperCase() === '#060814', String(style.label_bg_color ?? '')),
      semanticCheck('Electric Atlas text is cold white', String(style.label_text_color).toUpperCase() === '#EDF8FF', String(style.label_text_color ?? '')),
      semanticCheck('Electric Atlas route is electric magenta', String(style.route_color).toUpperCase() === '#FF2E88', String(style.route_color ?? '')),
      semanticCheck('Electric Atlas grain configured', Number(style.tile_grain ?? 0) >= 0.06 && Number(style.tile_grain ?? 0) <= 0.10, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Electric Atlas uses owned alidade dark map', style.preset === 'radmaps-alidade-dark', String(style.preset ?? '')),
      semanticCheck('Electric Atlas contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Electric Atlas roads and map labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Electric Atlas hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Electric Atlas neon land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#0B101F', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Electric Atlas neon water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#08172A', JSON.stringify(atlasLayerSettings.water ?? {})),
      semanticCheck('Electric Atlas violet contour token configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#34346E' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#5A5AB0', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Electric Atlas print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Electric Atlas route glow layers present', ['route-line-electric-glow-wide', 'route-line-electric-pulse'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Electric Atlas route has neon weight', Number(style.route_width ?? 0) >= 4 && Number(style.route_width ?? 0) <= 4.6, String(style.route_width ?? '')),
      semanticCheck('Electric Atlas endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
    )
    groups.motifs.push(
      semanticCheck('Electric Atlas map grid present', snapshot.grid.mapExists === true && style.grid_scope === 'map', `${snapshot.grid.mapExists}/${style.grid_scope}`),
      semanticCheck('Electric Atlas map grid density configured', Number(style.grid_spacing ?? 0) === 6 && Number(style.grid_opacity ?? 0) >= 0.10 && Number(style.grid_opacity ?? 0) <= 0.14, `${style.grid_spacing}/${style.grid_opacity}`),
      semanticCheck('Electric Atlas trace motif present', (snapshot.contractPresence?.testIdCounts?.['composition-electric-trace'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Electric Atlas chip motif present', (snapshot.contractPresence?.testIdCounts?.['composition-electric-chip'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Electric Atlas neon trace lines present', (snapshot.contractPresence?.selectorCounts?.['.electric-trace-line'] ?? 0) >= 3, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
      semanticCheck('Electric Atlas chip value present', (snapshot.contractPresence?.selectorCounts?.['.composition-electric-chip b'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'contour-wash') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Contour Wash title uses Space Grotesk', snapshot.title.fontFamily.includes('Space Grotesk'), snapshot.title.fontFamily),
      semanticCheck('Contour Wash title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Contour Wash body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Contour Wash uses quiet art-wash composition', style.composition === 'art-wash', String(style.composition ?? '')),
      semanticCheck('Contour Wash footer remains hidden', footerVisible === false, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Contour Wash soft paper background', String(style.background_color).toUpperCase() === '#ECEAE6', String(style.background_color ?? '')),
      semanticCheck('Contour Wash label background matches paper', String(style.label_bg_color).toUpperCase() === '#ECEAE6', String(style.label_bg_color ?? '')),
      semanticCheck('Contour Wash text is charcoal', String(style.label_text_color).toUpperCase() === '#2B2A28', String(style.label_text_color ?? '')),
      semanticCheck('Contour Wash route is charcoal', String(style.route_color).toUpperCase() === '#303538', String(style.route_color ?? '')),
      semanticCheck('Contour Wash paper grain configured', Number(style.tile_grain ?? 0) >= 0.06 && Number(style.tile_grain ?? 0) <= 0.10, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Contour Wash uses contour-wash map', style.preset === 'radmaps-contour-wash', String(style.preset ?? '')),
      semanticCheck('Contour Wash contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Contour Wash roads and map labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Contour Wash hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Contour Wash grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Contour Wash land wash token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#ECEAE6' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.94, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Contour Wash water wash token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#C9D6D3' && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === '#AEBBB7', JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Contour Wash broad contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#A9B5B1' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#758A85', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Contour Wash print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Contour Wash route is broad brushed line', Number(style.route_width ?? 0) >= 4.8, String(style.route_width ?? '')),
      semanticCheck('Contour Wash route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.94, String(style.route_opacity ?? '')),
      semanticCheck('Contour Wash endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Contour Wash echo route layers present', ['route-line-contour-wash-field', 'route-line-contour-wash-echo-low', 'route-line-contour-wash-echo-high'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Contour Wash does not inherit Plein Air deckle', (snapshot.contractPresence?.testIdCounts?.['composition-plein-air-deckle'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Contour Wash does not inherit Plein Air palette marks', (snapshot.contractPresence?.testIdCounts?.['composition-plein-air-palette'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Contour Wash has no Plein Air palette swatches', (snapshot.contractPresence?.selectorCounts?.['.plein-air-palette-swatch'] ?? 0) === 0, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'splits-stats') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Trail Profile title uses Space Grotesk', snapshot.title.fontFamily.includes('Space Grotesk'), snapshot.title.fontFamily),
      semanticCheck('Trail Profile body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Trail Profile title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Trail Profile uses splits-grid composition', style.composition === 'splits-grid', String(style.composition ?? '')),
      semanticCheck('Trail Profile profile/stat footer remains visible', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Trail Profile dark background', String(style.background_color).toUpperCase() === '#0B0D10', String(style.background_color ?? '')),
      semanticCheck('Trail Profile label background matches ink', String(style.label_bg_color).toUpperCase() === '#0B0D10', String(style.label_bg_color ?? '')),
      semanticCheck('Trail Profile text is warm light', String(style.label_text_color).toUpperCase() === '#F2EFE8', String(style.label_text_color ?? '')),
      semanticCheck('Trail Profile route is orange', String(style.route_color).toUpperCase() === '#FF5A36', String(style.route_color ?? '')),
      semanticCheck('Trail Profile grain configured', Number(style.tile_grain ?? 0) >= 0.06 && Number(style.tile_grain ?? 0) <= 0.10, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Trail Profile uses owned alidade dark map', style.preset === 'radmaps-alidade-dark', String(style.preset ?? '')),
      semanticCheck('Trail Profile contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Trail Profile roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Trail Profile hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Trail Profile elevation profile enabled', style.show_elevation_profile === true, String(style.show_elevation_profile)),
      semanticCheck('Trail Profile dark land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#141619', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Trail Profile water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#0E1720' && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === '#1A2A38', JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Trail Profile contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#282D33' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#596168', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Trail Profile print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Trail Profile route has performance weight', Number(style.route_width ?? 0) >= 3.2 && Number(style.route_width ?? 0) <= 3.9, String(style.route_width ?? '')),
      semanticCheck('Trail Profile route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Trail Profile endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Trail Profile performance route layers present', ['route-line-performance-glow', 'route-line-performance-shadow', 'route-line-performance-split-cuts', 'route-line-performance-checkpoints'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Trail Profile map grid enabled', style.show_grid === true && style.grid_scope === 'map', `${style.show_grid}/${style.grid_scope}`),
      semanticCheck('Trail Profile map grid density configured', Number(style.grid_spacing ?? 0) === 8 && Number(style.grid_opacity ?? 0) >= 0.08 && Number(style.grid_opacity ?? 0) <= 0.12, `${style.grid_spacing}/${style.grid_opacity}`),
      semanticCheck('Trail Profile map grid present', snapshot.grid.mapExists === true, JSON.stringify(snapshot.grid)),
      semanticCheck('Trail Profile elevation profile band present', (snapshot.contractPresence?.testIdCounts?.['elevation-profile-band'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
    )
  }

  if (entry.themeId === 'night-ride') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Night Ride title uses Oswald', snapshot.title.fontFamily.includes('Oswald'), snapshot.title.fontFamily),
      semanticCheck('Night Ride body uses IBM Plex Sans', String(style.body_font_family ?? '').includes('IBM Plex Sans'), String(style.body_font_family ?? '')),
      semanticCheck('Night Ride title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
    )
    groups.layout.push(
      semanticCheck('Night Ride inherits Trail Profile composition', style.composition === 'splits-grid', String(style.composition ?? '')),
      semanticCheck('Night Ride profile/stat footer remains visible', footerVisible === true, `${footerVisible}`),
    )
    groups.palette.push(
      semanticCheck('Night Ride dark background', String(style.background_color).toUpperCase() === '#080B0E', String(style.background_color ?? '')),
      semanticCheck('Night Ride label background matches night ink', String(style.label_bg_color).toUpperCase() === '#080B0E', String(style.label_bg_color ?? '')),
      semanticCheck('Night Ride text is pale cyan', String(style.label_text_color).toUpperCase() === '#DFF9FF', String(style.label_text_color ?? '')),
      semanticCheck('Night Ride route is cyan', String(style.route_color).toUpperCase() === '#28D6D6', String(style.route_color ?? '')),
      semanticCheck('Night Ride grain configured', Number(style.tile_grain ?? 0) >= 0.08 && Number(style.tile_grain ?? 0) <= 0.12, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Night Ride uses owned alidade dark map', style.preset === 'radmaps-alidade-dark', String(style.preset ?? '')),
      semanticCheck('Night Ride contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Night Ride roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Night Ride hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Night Ride elevation profile enabled', style.show_elevation_profile === true, String(style.show_elevation_profile)),
      semanticCheck('Night Ride dark land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#101417', JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Night Ride water token configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#0B1A23' && String(atlasLayerSettings.waterway?.color ?? '').toUpperCase() === '#18313A', JSON.stringify({ water: atlasLayerSettings.water ?? {}, waterway: atlasLayerSettings.waterway ?? {} })),
      semanticCheck('Night Ride contour tokens configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#222F34' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#52666A', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Night Ride print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Night Ride route has performance weight', Number(style.route_width ?? 0) >= 3.1 && Number(style.route_width ?? 0) <= 3.9, String(style.route_width ?? '')),
      semanticCheck('Night Ride route opacity is print-strong', Number(style.route_opacity ?? 0) >= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Night Ride endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Night Ride performance route layers present', ['route-line-performance-glow', 'route-line-performance-shadow', 'route-line-performance-split-cuts', 'route-line-performance-checkpoints'].every(layerId => snapshot.routeLayerIds.includes(layerId)), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Night Ride map grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Night Ride elevation profile band present', (snapshot.contractPresence?.testIdCounts?.['elevation-profile-band'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
    )
  }

  if (entry.themeId === 'cartouche-place') {
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Cartouche title uses Playfair Display', snapshot.title.fontFamily.includes('Playfair Display'), snapshot.title.fontFamily),
      semanticCheck('Cartouche title is uppercase', snapshot.title.textTransform === 'uppercase', snapshot.title.textTransform),
      semanticCheck('Cartouche body uses Source Serif 4', String(style.body_font_family ?? '').includes('Source Serif 4'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Cartouche place-frame composition active', style.composition === 'place-frame', String(style.composition ?? '')),
      semanticCheck('Cartouche hides generic footer band', !footerVisible, `${footerVisible ? 'visible' : 'hidden'}`),
      semanticCheck('Cartouche map fills engraved plate', mapHeightRatio > 0.70 && mapHeightRatio <= 1.01, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Cartouche engraved paper background', String(style.background_color).toUpperCase() === '#F4EFE4', String(style.background_color ?? '')),
      semanticCheck('Cartouche label background matches paper', String(style.label_bg_color).toUpperCase() === '#F4EFE4', String(style.label_bg_color ?? '')),
      semanticCheck('Cartouche ink text is dark blue-black', String(style.label_text_color).toUpperCase() === '#20242B', String(style.label_text_color ?? '')),
      semanticCheck('Cartouche optional route color is rust', String(style.route_color).toUpperCase() === '#9A3B27', String(style.route_color ?? '')),
      semanticCheck('Cartouche paper grain configured', Number(style.tile_grain ?? 0) >= 0.10 && Number(style.tile_grain ?? 0) <= 0.14, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Cartouche uses owned alidade place map', style.preset === 'radmaps-alidade', String(style.preset ?? '')),
      semanticCheck('Cartouche contours disabled', style.show_contours === false, String(style.show_contours)),
      semanticCheck('Cartouche roads and place labels enabled', style.show_roads === true && style.show_place_labels === true, `${style.show_roads}/${style.show_place_labels}`),
      semanticCheck('Cartouche POIs enabled', style.show_poi_labels === true, String(style.show_poi_labels)),
      semanticCheck('Cartouche hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Cartouche engraved land token configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#F1EBDD' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.9, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Cartouche street-network tokens configured', String(atlasLayerSettings.transportation?.major_color ?? '').toUpperCase() === '#7A6E55' && String(atlasLayerSettings.transportation?.minor_color ?? '').toUpperCase() === '#9A8F76', JSON.stringify(atlasLayerSettings.transportation ?? {})),
      semanticCheck('Cartouche place label token configured', String(atlasLayerSettings.place?.label_color ?? '').toUpperCase() === '#5C513F' && Number(atlasLayerSettings.place?.label_opacity ?? 0) >= 0.6, JSON.stringify(atlasLayerSettings.place ?? {})),
      semanticCheck('Cartouche POI label token configured', String(atlasLayerSettings.poi?.label_color ?? '').toUpperCase() === '#6F604A' && Number(atlasLayerSettings.poi?.label_opacity ?? 0) >= 0.24, JSON.stringify(atlasLayerSettings.poi ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Cartouche route can be omitted for place fixture', geometry.renderStatus?.primaryRouteExpected === false || (
        geometry.renderStatus?.routeSourcePresent === true &&
        geometry.renderStatus?.routeSourceLoaded === true &&
        geometry.renderStatus?.routeContentPresent === true
      ), JSON.stringify(geometry.renderStatus ?? {})),
      semanticCheck('Cartouche optional route has restrained width', Number(style.route_width ?? 0) >= 2.4 && Number(style.route_width ?? 0) <= 3.1, String(style.route_width ?? '')),
      semanticCheck('Cartouche optional route opacity is subdued', Number(style.route_opacity ?? 0) >= 0.8 && Number(style.route_opacity ?? 0) <= 0.9, String(style.route_opacity ?? '')),
      semanticCheck('Cartouche endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
    )
    groups.motifs.push(
      semanticCheck('Cartouche poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Cartouche plate frame present', (snapshot.contractPresence?.testIdCounts?.['composition-plate-frame'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Cartouche seal present', (snapshot.contractPresence?.testIdCounts?.['composition-cartouche-seal'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Cartouche engraved corners present', (snapshot.contractPresence?.selectorCounts?.['.cartouche-corner'] ?? 0) >= 4, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  if (entry.themeId === 'plein-air') {
    const atlasLayers = style.atlas_layers ?? {}
    const atlasLayerSettings = style.atlas_layer_settings ?? {}
    groups.typography.push(
      semanticCheck('Plein Air title uses Cormorant Garamond', snapshot.title.fontFamily.includes('Cormorant Garamond'), snapshot.title.fontFamily),
      semanticCheck('Plein Air title keeps natural case', snapshot.title.textTransform === 'none', snapshot.title.textTransform),
      semanticCheck('Plein Air body uses Source Sans 3', String(style.body_font_family ?? '').includes('Source Sans 3'), String(style.body_font_family ?? '')),
    )
    groups.layout.push(
      semanticCheck('Plein Air art-wash composition active', style.composition === 'art-wash', String(style.composition ?? '')),
      semanticCheck('Plein Air hides generic footer band', !footerVisible, `${footerVisible ? 'visible' : 'hidden'}`),
      semanticCheck('Plein Air keeps large watercolor map field', mapHeightRatio > 0.76 && mapHeightRatio <= 1.01, mapHeightRatio.toFixed(3)),
    )
    groups.palette.push(
      semanticCheck('Plein Air warm paper background', String(style.background_color).toUpperCase() === '#F6F1E8', String(style.background_color ?? '')),
      semanticCheck('Plein Air label background matches paper', String(style.label_bg_color).toUpperCase() === '#F6F1E8', String(style.label_bg_color ?? '')),
      semanticCheck('Plein Air ink text is warm charcoal', String(style.label_text_color).toUpperCase() === '#33302A', String(style.label_text_color ?? '')),
      semanticCheck('Plein Air route is burnt sienna', String(style.route_color).toUpperCase() === '#C2683F', String(style.route_color ?? '')),
      semanticCheck('Plein Air watercolor grain configured', Number(style.tile_grain ?? 0) >= 0.16, String(style.tile_grain ?? '')),
    )
    groups.mapLayers.push(
      semanticCheck('Plein Air uses owned watercolor paper map', style.preset === 'radmaps-watercolor-paper', String(style.preset ?? '')),
      semanticCheck('Plein Air contours enabled', style.show_contours === true, String(style.show_contours)),
      semanticCheck('Plein Air hillshade disabled', style.show_hillshade === false, String(style.show_hillshade)),
      semanticCheck('Plein Air roads and labels hidden', style.show_roads === false && style.show_place_labels === false && style.show_poi_labels === false, `${style.show_roads}/${style.show_place_labels}/${style.show_poi_labels}`),
      semanticCheck('Plein Air watercolor atlas layer set', atlasLayers.landcover === true && atlasLayers.water === true && atlasLayers.waterway === true && atlasLayers.park === true && atlasLayers.transportation === false && atlasLayers.place === false && atlasLayers.poi === false, JSON.stringify(atlasLayers)),
      semanticCheck('Plein Air watercolor land wash configured', String(atlasLayerSettings.landcover?.color ?? '').toUpperCase() === '#E6D7BB' && Number(atlasLayerSettings.landcover?.opacity ?? 0) >= 0.86, JSON.stringify(atlasLayerSettings.landcover ?? {})),
      semanticCheck('Plein Air soft green water configured', String(atlasLayerSettings.water?.fill_color ?? '').toUpperCase() === '#A9C2B4', JSON.stringify(atlasLayerSettings.water ?? {})),
      semanticCheck('Plein Air light contour token configured', String(atlasLayerSettings.contour?.minor_color ?? '').toUpperCase() === '#C0B59A' && String(atlasLayerSettings.contour?.major_color ?? '').toUpperCase() === '#8A7D63', JSON.stringify(atlasLayerSettings.contour ?? {})),
    )
    groups.routeStyling.push(
      semanticCheck('Plein Air print route source loaded', geometry.renderStatus?.routeSourcePresent === true && geometry.renderStatus?.routeSourceLoaded === true && geometry.renderStatus?.routeContentPresent === true, JSON.stringify(geometry.renderStatus ?? snapshot.renderStatus)),
      semanticCheck('Plein Air route is exact burnt sienna token', String(style.route_color).toUpperCase() === '#C2683F', String(style.route_color ?? '')),
      semanticCheck('Plein Air route has painterly weight', Number(style.route_width ?? 0) >= 3.2 && Number(style.route_width ?? 0) <= 4.1, String(style.route_width ?? '')),
      semanticCheck('Plein Air route opacity is restrained watercolor', Number(style.route_opacity ?? 0) >= 0.86 && Number(style.route_opacity ?? 0) <= 0.94, String(style.route_opacity ?? '')),
      semanticCheck('Plein Air endpoint pins disabled', style.show_start_pin === false && style.show_finish_pin === false, `${style.show_start_pin}/${style.show_finish_pin}`),
      semanticCheck('Plein Air drybrush route layer present', snapshot.routeLayerIds.includes('route-line-plein-air-drybrush'), snapshot.routeLayerIds.join(', ')),
      semanticCheck('Plein Air pigment bleed layers absent', !snapshot.routeLayerIds.includes('route-line-pigment-bleed') && !snapshot.routeLayerIds.includes('route-line-pigment-offset'), snapshot.routeLayerIds.join(', ')),
    )
    groups.motifs.push(
      semanticCheck('Plein Air poster grid disabled', style.show_grid === false, String(style.show_grid)),
      semanticCheck('Plein Air deckle edge present', (snapshot.contractPresence?.testIdCounts?.['composition-plein-air-deckle'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Plein Air palette marks present', (snapshot.contractPresence?.testIdCounts?.['composition-plein-air-palette'] ?? 0) > 0, JSON.stringify(snapshot.contractPresence?.testIdCounts ?? {})),
      semanticCheck('Plein Air palette has three swatches', (snapshot.contractPresence?.selectorCounts?.['.plein-air-palette-swatch'] ?? 0) === 3, JSON.stringify(snapshot.contractPresence?.selectorCounts ?? {})),
    )
  }

  return {
    groups,
    summary: summarizeSemanticChecks(groups),
    snapshot,
  }
}

async function captureReferencePoster(page, standaloneUrl, theme, file) {
  await page.goto(standaloneUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.locator('.card').first().waitFor({ state: 'visible', timeout: 30_000 })
  const card = page.locator('.card', { hasText: `id: ${theme}` }).first()
  await card.waitFor({ state: 'visible', timeout: 15_000 })
  const poster = card.locator('.posterbox').first()
  await poster.screenshot({ path: file })
}

function resolveTargetReference(entry) {
  if (!entry.referencePath) return null
  if (targetsDir) return path.resolve(targetsDir, path.basename(entry.referencePath))
  return path.resolve(entry.referencePath)
}

function fixtureOverrideQuery(entry) {
  const params = new URLSearchParams()
  const overrides = entry.fixtureOverrides ?? {}
  if (entry.contentFixture) params.set('region', entry.contentFixture)
  if (entry.routeFixture) params.set('routeShape', entry.routeFixture)
  if (overrides.title) params.set('title', overrides.title)
  if (overrides.location) params.set('location', overrides.location)
  if (overrides.occasion) params.set('occasion', overrides.occasion)
  if (typeof overrides.distanceKm === 'number' && Number.isFinite(overrides.distanceKm)) {
    params.set('distanceKm', String(overrides.distanceKm))
  }
  if (typeof overrides.gainM === 'number' && Number.isFinite(overrides.gainM)) {
    params.set('gainM', String(overrides.gainM))
  }
  if (overrides.date) params.set('date', overrides.date)
  const query = params.toString()
  return query ? `&${query}` : ''
}

async function copyTargetReference(entry, file) {
  const referencePath = resolveTargetReference(entry)
  if (!referencePath || !existsSync(referencePath)) return false
  await sharp(referencePath).png().toFile(file)
  return true
}

function normalizeMapRect(geometry, width, height) {
  const relative = {
    left: (geometry.mapBox.x - geometry.posterBox.x) / geometry.posterBox.width,
    top: (geometry.mapBox.y - geometry.posterBox.y) / geometry.posterBox.height,
    width: geometry.mapBox.width / geometry.posterBox.width,
    height: geometry.mapBox.height / geometry.posterBox.height,
  }
  const left = Math.max(0, Math.round(relative.left * width))
  const top = Math.max(0, Math.round(relative.top * height))
  const right = Math.min(width, Math.round((relative.left + relative.width) * width))
  const bottom = Math.min(height, Math.round((relative.top + relative.height) * height))
  return {
    left,
    top,
    right,
    bottom,
  }
}

async function normalizedRaw(file, width, height) {
  return sharp(file)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

function scoreFromChangedPixels(changedPixels, scoredPixels) {
  if (!scoredPixels) return 1
  return Number(Math.max(0, 1 - changedPixels / scoredPixels).toFixed(4))
}

function isDynamicMapLinePixel(data, index, maskColors) {
  if (!maskColors.length) return false
  const alpha = data[index + 3]
  if (alpha < 24) return false
  const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] }
  return maskColors.some(color => colorDistance(pixel, color) <= 72)
}

function dynamicMapLineMaskedData(referenceData, liveData, width, height, maskColorValues, shouldMaskPixel = () => true) {
  const maskColors = maskColorValues
    .map(color => hexToRgb(color))
    .filter(Boolean)
  const reference = Buffer.from(referenceData)
  const live = Buffer.from(liveData)
  if (!maskColors.length) return { reference, live, maskedPixels: 0 }

  let maskedPixels = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (!shouldMaskPixel(x, y)) continue
      if (!isDynamicMapLinePixel(referenceData, index, maskColors) && !isDynamicMapLinePixel(liveData, index, maskColors)) continue
      maskedPixels += 1
      reference[index + 3] = 0
      live[index + 3] = 0
    }
  }

  return { reference, live, maskedPixels }
}

function rectMaskedData(referenceData, liveData, width, height, rects = []) {
  const reference = Buffer.from(referenceData)
  const live = Buffer.from(liveData)
  let maskedPixels = 0
  for (const rect of rects) {
    const left = Math.max(0, Math.min(width, Math.floor((rect.left ?? 0) * width) - 3))
    const top = Math.max(0, Math.min(height, Math.floor((rect.top ?? 0) * height) - 3))
    const right = Math.max(left, Math.min(width, Math.ceil((rect.right ?? 0) * width) + 3))
    const bottom = Math.max(top, Math.min(height, Math.ceil((rect.bottom ?? 0) * height) + 3))
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * width + x) * 4
        if (reference[index + 3] !== 0 || live[index + 3] !== 0) maskedPixels += 1
        reference[index + 3] = 0
        live[index + 3] = 0
      }
    }
  }
  return { reference, live, maskedPixels }
}

function scoreRegion(referenceData, liveData, width, height, predicate) {
  const size = width * height * 4
  const referenceRegion = Buffer.alloc(size)
  const liveRegion = Buffer.alloc(size)
  let scoredPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (!predicate(x, y)) {
        referenceRegion[index + 3] = 0
        liveRegion[index + 3] = 0
        continue
      }
      if (referenceData[index + 3] === 0 && liveData[index + 3] === 0) {
        referenceRegion[index + 3] = 0
        liveRegion[index + 3] = 0
        continue
      }
      scoredPixels += 1
      referenceRegion[index] = referenceData[index]
      referenceRegion[index + 1] = referenceData[index + 1]
      referenceRegion[index + 2] = referenceData[index + 2]
      referenceRegion[index + 3] = referenceData[index + 3]
      liveRegion[index] = liveData[index]
      liveRegion[index + 1] = liveData[index + 1]
      liveRegion[index + 2] = liveData[index + 2]
      liveRegion[index + 3] = liveData[index + 3]
    }
  }

  const changedPixels = pixelmatch(referenceRegion, liveRegion, null, width, height, {
    includeAA: false,
    threshold: diffThreshold,
  })
  return scoreFromChangedPixels(changedPixels, scoredPixels)
}

async function scorePoster(referenceFile, liveFile, geometry, diffFile, styleConfig = {}, pixelMaskRects = []) {
  const referenceMeta = await sharp(referenceFile).metadata()
  const width = referenceMeta.width
  const height = referenceMeta.height
  if (!width || !height) throw new Error(`Cannot read dimensions for ${referenceFile}`)

  const reference = await normalizedRaw(referenceFile, width, height)
  const live = await normalizedRaw(liveFile, width, height)
  const rectMask = rectMaskedData(reference.data, live.data, width, height, pixelMaskRects)
  const mapRect = normalizeMapRect(geometry, width, height)
  const isMapPixel = (x, y) => x >= mapRect.left && x < mapRect.right && y >= mapRect.top && y < mapRect.bottom
  const dynamicMapMask = dynamicMapLineMaskedData(rectMask.reference, rectMask.live, width, height, [
    styleConfig.route_color,
    styleConfig.contour_color,
  ], isMapPixel)
  const diff = Buffer.alloc(width * height * 4)
  const changedPixels = pixelmatch(dynamicMapMask.reference, dynamicMapMask.live, diff, width, height, {
    diffColor: [224, 32, 72],
    diffColorAlt: [32, 104, 224],
    includeAA: false,
    threshold: diffThreshold,
  })
  await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(diffFile)

  const overall = scoreFromChangedPixels(changedPixels, Math.max(0, (width * height) - dynamicMapMask.maskedPixels - rectMask.maskedPixels))
  const mapScore = scoreRegion(dynamicMapMask.reference, dynamicMapMask.live, width, height, isMapPixel)
  const chromeScore = scoreRegion(dynamicMapMask.reference, dynamicMapMask.live, width, height, (x, y) => !isMapPixel(x, y))

  return {
    score: overall,
    mapScore,
    chromeScore,
    dynamicMapMaskedPixels: dynamicMapMask.maskedPixels,
    rectMaskedPixels: rectMask.maskedPixels,
    dimensions: { width, height },
    mapRect,
  }
}

async function writeContactSheet(items, sheetPath, opts = {}) {
  const thumbW = opts.thumbW ?? 180
  const thumbH = opts.thumbH ?? 270
  const labelH = opts.labelH ?? 36
  const gap = opts.gap ?? 16
  const cols = opts.cols ?? 5
  const rows = Math.ceil(items.length / cols)
  const width = cols * thumbW + (cols + 1) * gap
  const height = rows * (thumbH + labelH) + (rows + 1) * gap
  const composites = []

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const left = gap + col * (thumbW + gap)
    const top = gap + row * (thumbH + labelH + gap)
    const image = await sharp(items[i].file)
      .resize(thumbW, thumbH, { fit: 'cover' })
      .png()
      .toBuffer()
    const labelSvg = Buffer.from(`
      <svg width="${thumbW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f6ef"/>
        <text x="8" y="14" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#222">${items[i].title}</text>
        <text x="8" y="29" font-family="Arial, sans-serif" font-size="9" fill="#666">${items[i].subtitle}</text>
      </svg>
    `)
    composites.push({ input: image, left, top })
    composites.push({ input: labelSvg, left, top: top + thumbH })
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#e8e1d4',
    },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath)
}

async function writeReports(results, reportDir) {
  const sorted = [...results].sort((a, b) => (a.score ?? -1) - (b.score ?? -1))
  const json = {
    generatedAt: new Date().toISOString(),
    threshold: parityThreshold,
    semanticThreshold: semanticParityThreshold,
    diffThreshold,
    themes: sorted,
  }
  await writeFile(path.join(reportDir, 'parity-report.json'), JSON.stringify(json, null, 2))

  const lines = [
    '# Theme Parity Report',
    '',
    `Generated: ${json.generatedAt}`,
    'Gate: semantic style-token checks plus approved visual review plus cleared spec implementation status',
    `Semantic parity threshold: ${formatScore(semanticParityThreshold)}; all required semantic groups and checks must pass for done.`,
    `Pixelmatch threshold: ${diffThreshold} (non-gating smoke metric)`,
    `Done requires passing semantic groups (${requiredSemanticGroups.join(', ')}), approved visual review, and cleared specContract notImplemented[]; it does not require pixelmatch because route, contour, and map geometry are data-driven.`,
    '',
    '| Theme | Track | Pixel Overall | Pixel Map | Pixel Chrome | Semantic Score | Dynamic Map Mask | Text Mask | Semantic | Visual Review | Spec | Done | Target | Live | Diff |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|',
  ]
  for (const result of sorted) {
    lines.push(`| ${result.theme} | ${result.track} | ${formatScore(result.score)} | ${formatScore(result.mapScore)} | ${formatScore(result.chromeScore)} | ${formatSemanticScore(result.semantic)} | ${formatPixelCount(result.dynamicMapMaskedPixels)} | ${formatPixelCount(result.rectMaskedPixels)} | ${formatSemantic(result.semantic)} | ${formatVisualReview(result.visualReview)} | ${formatSpec(result.specImplementation)} | ${formatDone(result.readiness)} | ${markdownPath(result.target)} | ${markdownPath(result.live)} | ${markdownPath(result.diffImage)} |`)
  }
  lines.push('')
  lines.push('## Semantic Checks')
  for (const result of sorted) {
    lines.push('')
    lines.push(`### ${result.theme}`)
    if (!result.semantic?.groups) {
      lines.push('No semantic checks recorded.')
      continue
    }
    for (const [group, checks] of Object.entries(result.semantic.groups)) {
      const failed = checks.filter(check => !check.pass)
      lines.push(`- ${group}: ${checks.filter(check => check.pass).length}/${checks.length}`)
      for (const check of failed) {
        lines.push(`  - FAIL ${check.name}${check.details ? ` (${check.details})` : ''}`)
      }
    }
    lines.push(`- visual review: ${formatVisualReview(result.visualReview)}${result.visualReview?.notes ? ` (${result.visualReview.notes})` : ''}`)
    lines.push(`- spec: ${formatSpec(result.specImplementation)}`)
    lines.push(`- done: ${formatDone(result.readiness)}`)
  }
  await writeFile(path.join(reportDir, 'parity-report.md'), `${lines.join('\n')}\n`)

  console.log('')
  console.log('Theme parity scores')
  for (const result of sorted) {
    console.log(`${result.theme.padEnd(22)} pixel ${formatScore(result.score).padStart(6)} map ${formatScore(result.mapScore).padStart(6)} chrome ${formatScore(result.chromeScore).padStart(6)} semantic ${formatSemanticScore(result.semantic).padStart(6)} checks ${formatSemantic(result.semantic).padStart(7)} visual ${formatVisualReview(result.visualReview).padStart(8)} spec ${formatSpec(result.specImplementation).padStart(7)} done ${formatDone(result.readiness).padStart(4)} ${result.track}`)
  }
}

function formatScore(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'n/a'
}

function formatPixelCount(value) {
  return typeof value === 'number' ? String(value) : 'n/a'
}

function formatSemantic(semantic) {
  if (!semantic?.summary) return 'n/a'
  return `${semantic.summary.passed}/${semantic.summary.total}${semantic.summary.pass ? '' : ' fail'}`
}

function formatSemanticScore(semantic) {
  if (!semantic?.summary || typeof semantic.summary.score !== 'number') return 'n/a'
  return formatScore(semantic.summary.score)
}

function formatVisualReview(visualReview) {
  if (!visualReview) return 'n/a'
  return visualReview.pass ? 'approved' : visualReview.status
}

function formatSpec(specImplementation) {
  if (!specImplementation?.specContractExists) return 'missing'
  return specImplementation.notImplementedCleared
    ? 'clear'
    : `${specImplementation.notImplementedCount ?? 1} open`
}

function formatDone(readiness) {
  return readiness?.done ? 'yes' : 'no'
}

function markdownPath(file) {
  return file ? `[file](${file})` : ''
}

const baseUrl = argValue('base-url', 'http://localhost:3003')
const outDir = path.resolve(argValue('out', path.join('/tmp', `radmaps-theme-audit-${Date.now()}`)))
const standalonePath = path.resolve(argValue('standalone', 'docs/RadMaps Theme Review (standalone).html'))
const standaloneUrl = pathToFileURL(standalonePath).href
const targetsDir = argValue('targets', '')
const themeFilterArg = argValue('theme', '')
const themeFilter = new Set(themeFilterArg.split(',').map(value => value.trim()).filter(Boolean))
const skipOwnedMaps = argFlag('skip-owned')
const posterWidth = argNumber('width', 540)
const posterHeight = argNumber('height', 810)
const waitMs = argNumber('wait', 2500)
const mapPaintTimeoutMs = argNumber('map-timeout', 25_000)
const minMapPaintScore = Number.parseFloat(argValue('min-map-score', '8'))
const diffThreshold = Number.parseFloat(argValue('diff-threshold', '0.12'))
const parityThreshold = Number.parseFloat(argValue('parity-threshold', '0.94'))
const semanticParityThreshold = Number.parseFloat(argValue('semantic-threshold', String(parityThreshold)))

const manifest = await loadScreenshotManifest()
const chromeContracts = await loadChromeContracts()
const semanticContracts = await loadSemanticContracts()
const specImplementationStatus = await loadSpecImplementationStatus()
const chromeContractsByTheme = new Map(chromeContracts.map(contract => [contract.themeId, contract]))
const semanticContractsByTheme = new Map(semanticContracts.map(contract => [contract.themeId, contract]))
const selectedEntries = manifest.filter(entry => !themeFilter.size || themeFilter.has(entry.themeId))

await mkdir(outDir, { recursive: true })
await mkdir(path.join(outDir, 'poster-themes', 'reference'), { recursive: true })
await mkdir(path.join(outDir, 'poster-themes', 'editor'), { recursive: true })
await mkdir(path.join(outDir, 'poster-themes', 'print'), { recursive: true })
await mkdir(path.join(outDir, 'poster-themes', 'diff'), { recursive: true })
await mkdir(path.join(outDir, 'owned-map-presets'), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: posterWidth, height: posterHeight },
  deviceScaleFactor: 1,
})

const posterItems = []
const parityResults = []
for (const entry of selectedEntries) {
  const theme = entry.themeId
  const composition = entry.composition
  const referenceFile = path.join(outDir, 'poster-themes', 'reference', `${safeName(theme)}.png`)
  const editorFile = path.join(outDir, 'poster-themes', 'editor', `${safeName(theme)}.png`)
  const printFile = path.join(outDir, 'poster-themes', 'print', `${safeName(theme)}.png`)
  const diffFile = path.join(outDir, 'poster-themes', 'diff', `${safeName(theme)}.png`)
  const fixtureQuery = fixtureOverrideQuery(entry)
  const editorUrl = `${baseUrl}/style-browser-fixture?theme=${encodeURIComponent(theme)}&composition=${encodeURIComponent(composition)}${fixtureQuery}&width=${posterWidth}&height=${posterHeight}`
  const printUrl = `${baseUrl}/style-browser-fixture?theme=${encodeURIComponent(theme)}&composition=${encodeURIComponent(composition)}${fixtureQuery}&print=final`

  const copiedTarget = await copyTargetReference(entry, referenceFile)
  if (!copiedTarget && existsSync(standalonePath)) {
    await captureReferencePoster(page, standaloneUrl, theme, referenceFile)
  }
  if (existsSync(referenceFile)) {
    posterItems.push({ title: theme, subtitle: copiedTarget ? 'target' : 'reference', file: referenceFile })
  }

  const editorGeometry = await capturePoster(page, editorUrl, editorFile)
  posterItems.push({ title: theme, subtitle: 'live editor', file: editorFile })
  const printGeometry = await capturePoster(page, printUrl, printFile)
  const domSemantic = await collectSemanticChecks(page, entry, printGeometry, editorGeometry)
  const imageSemanticGroups = await collectImageSemanticChecks(entry, printFile, printGeometry)
  const semantic = mergeSemanticCheckGroups(domSemantic, imageSemanticGroups)
  const visualReview = visualReviewStatus(entry)
  const specImplementation = specImplementationStatus.get(theme) ?? {
    specContractExists: false,
    notImplementedCleared: false,
    notImplementedCount: 0,
  }
  posterItems.push({ title: theme, subtitle: 'live print', file: printFile })

  if (existsSync(referenceFile)) {
    const score = await scorePoster(referenceFile, printFile, printGeometry, diffFile, domSemantic.snapshot?.styleConfig, domSemantic.snapshot?.pixelMaskRects)
    const result = {
      theme,
      displayName: entry.displayName,
      composition,
      contentFixture: entry.contentFixture,
      track: entry.track,
      score: score.score,
      mapScore: score.mapScore,
      chromeScore: score.chromeScore,
      target: referenceFile,
      live: printFile,
      editor: editorFile,
      diffImage: diffFile,
      dimensions: score.dimensions,
      mapRect: score.mapRect,
      dynamicMapMaskedPixels: score.dynamicMapMaskedPixels,
      rectMaskedPixels: score.rectMaskedPixels,
      semantic,
      visualReview,
      specImplementation,
    }
    result.readiness = readinessForResult(result)
    parityResults.push(result)
  } else {
    const result = {
      theme,
      displayName: entry.displayName,
      composition,
      contentFixture: entry.contentFixture,
      track: entry.track,
      score: null,
      mapScore: null,
      chromeScore: null,
      target: null,
      live: printFile,
      editor: editorFile,
      diffImage: null,
      semantic,
      visualReview,
      specImplementation,
    }
    result.readiness = readinessForResult(result)
    parityResults.push(result)
  }
  console.log(`poster ${theme} -> ${editorFile} / ${printFile}`)
}

const ownedItems = []
if (!skipOwnedMaps) {
  for (const [preset, label] of OWNED_MAP_PRESETS) {
    const file = path.join(outDir, 'owned-map-presets', `${safeName(preset)}.png`)
    const url = `${baseUrl}/style-browser-fixture?theme=editorial-minimal&composition=editorial-tall&preset=${encodeURIComponent(preset)}&width=${posterWidth}&height=${posterHeight}&roads=1&labels=1`
    await capturePoster(page, url, file)
    ownedItems.push({ title: preset, subtitle: label, file })
    console.log(`owned ${preset} -> ${file}`)
  }
}

await browser.close()

const posterSheet = path.join(outDir, 'poster-theme-triptych-contact-sheet.png')
await writeContactSheet(posterItems, posterSheet, { cols: 3 })

if (ownedItems.length) {
  const ownedSheet = path.join(outDir, 'owned-map-contact-sheet.png')
  await writeContactSheet(ownedItems, ownedSheet, { cols: 4 })
  console.log(`OWNED_CONTACT_SHEET ${ownedSheet}`)
}

await writeReports(parityResults, outDir)

console.log(`POSTER_CONTACT_SHEET ${posterSheet}`)
console.log(`PARITY_REPORT_JSON ${path.join(outDir, 'parity-report.json')}`)
console.log(`PARITY_REPORT_MD ${path.join(outDir, 'parity-report.md')}`)
