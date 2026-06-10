#!/usr/bin/env node
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const COVERAGE_TARGETS_PATH = join(ROOT, 'atlas/coverage-targets.json')
const DEFAULT_SITE_URL = 'https://radmaps.studio'
const DEFAULT_TILE_BASE_URL = 'https://tiles.radmaps.studio'
const RENDER_READY_EXPRESSION = 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeContentPresent === true'
const FINAL_24X36 = {
  productUid: '24x36',
  widthPx: 7271,
  heightPx: 10871,
  deviceScaleFactor: 2,
}

const args = parseArgs(process.argv.slice(2))
loadDotEnv(join(ROOT, '.env'))

const siteUrl = stripTrailingSlash(args.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL)
const tileBaseUrl = stripTrailingSlash(args.tileBaseUrl || process.env.NUXT_PUBLIC_RADMAPS_ATLAS_TILE_BASE_URL || DEFAULT_TILE_BASE_URL)
const environment = args.environment || 'production'
const date = args.date || new Date().toISOString().slice(0, 10)
const outputDir = resolve(ROOT, args.outputDir || `artifacts/atlas-print-qa/${date}`)
const shouldRender = Boolean(args.render)
const limit = args.limit === undefined ? null : Number.parseInt(args.limit, 10)
const requestedFixture = args.fixture || 'all'
const requestedTarget = args.target || ''

if (limit !== null && (!Number.isFinite(limit) || limit < 1)) {
  throw new Error('--limit must be a positive integer')
}

mkdirSync(outputDir, { recursive: true })

const coverageTargets = JSON.parse(readFileSync(COVERAGE_TARGETS_PATH, 'utf8'))
const fixtures = buildFixtures(coverageTargets)
  .filter(fixture => requestedFixture === 'all' || fixture.id === requestedFixture)
  .filter(fixture => !requestedTarget || fixture.targetId === requestedTarget)
  .slice(0, limit ?? undefined)

if (!fixtures.length) {
  throw new Error('No Atlas print QA fixtures matched the requested filters')
}

const manifestResponse = await fetch(`${tileBaseUrl}/manifests/${environment}.json`, {
  headers: { accept: 'application/json' },
})
if (!manifestResponse.ok) {
  throw new Error(`Atlas manifest fetch failed: ${manifestResponse.status}`)
}
const manifest = await manifestResponse.json()

const run = {
  generatedAt: new Date().toISOString(),
  environment,
  siteUrl,
  tileBaseUrl,
  renderBackend: shouldRender ? 'aws-renderer' : 'tile-audit-only',
  budget: coverageTargets.costGuardrails,
  atlasVersion: manifest.atlasVersion,
  artifactCounts: Object.fromEntries(Object.entries(manifest.artifacts || {}).map(([kind, entry]) => [
    kind,
    Array.isArray(entry) ? entry.length : entry ? 1 : 0,
  ])),
  fixtures: [],
}

for (const fixture of fixtures) {
  const fixtureOutput = await auditFixture({ fixture, manifest, environment, siteUrl, tileBaseUrl })

  if (shouldRender) {
    const renderResult = await renderFixture({ fixture, siteUrl, outputDir })
    fixtureOutput.render = renderResult
  }

  run.fixtures.push(fixtureOutput)
  console.log(`${fixtureOutput.status === 'passed' ? 'PASS' : 'CHECK'} ${fixture.id}`)
}

const summaryPath = join(outputDir, 'summary.json')
writeFileSync(summaryPath, `${JSON.stringify(run, null, 2)}\n`)
console.log(`Atlas print QA summary written to ${summaryPath}`)
setImmediate(() => process.exit(0))

function parseArgs(rawArgs) {
  const parsed = {}
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--render') {
      parsed.render = true
      continue
    }
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    const next = rawArgs[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
    } else {
      parsed[key] = next
      index += 1
    }
  }
  return parsed
}

function loadDotEnv(path) {
  if (!existsSync(path)) return
  const contents = readFileSync(path, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    if (!key || process.env[key]) continue
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '')
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildFixtures(coverageTargets) {
  return coverageTargets.targets.flatMap(target => (target.qaFixtures || []).map((fixture) => {
    if (!Array.isArray(fixture.bbox) || fixture.bbox.length !== 4) {
      throw new Error(`Fixture ${target.id}/${fixture.label} is missing bbox`)
    }
    return {
      id: `${target.id}-${slugify(fixture.label)}`,
      targetId: target.id,
      targetLabel: target.label,
      label: fixture.label,
      activity: fixture.activity,
      printSize: fixture.printSize,
      bbox: fixture.bbox,
    }
  }))
}

async function auditFixture({ fixture, manifest, environment, siteUrl, tileBaseUrl }) {
  const center = bboxCenter(fixture.bbox)
  const baseTile = tileForLngLat(8, center.lng, center.lat)
  const overlayTile = tileForLngLat(16, center.lng, center.lat)
  const baseArtifacts = artifacts(manifest, 'base').filter(artifact => intersects(artifact.bounds, fixture.bbox))
  const poiArtifacts = artifacts(manifest, 'poi').filter(artifact => intersects(artifact.bounds, fixture.bbox))
  const outdoorRouteArtifacts = artifacts(manifest, 'outdoorRoutes').filter(artifact => intersects(artifact.bounds, fixture.bbox))
  const baseTileArtifact = baseArtifacts.find(artifact => intersects(artifact.bounds, baseTile.bbox))
  const poiTileArtifact = poiArtifacts.find(artifact => intersects(artifact.bounds, overlayTile.bbox))
  const outdoorRouteTileArtifact = outdoorRouteArtifacts.find(artifact => intersects(artifact.bounds, overlayTile.bbox))
  const probes = []

  probes.push(await appProxyProbe(`${siteUrl}/api/atlas/tiles/base/${baseTile.path}.mvt?environment=${environment}`))
  probes.push(await appProxyProbe(`${siteUrl}/api/atlas/tiles/poi/${overlayTile.path}.mvt?environment=${environment}`))
  probes.push(await appProxyProbe(`${siteUrl}/api/atlas/tiles/outdoorRoutes/${overlayTile.path}.mvt?environment=${environment}`))

  for (const artifact of [baseTileArtifact, poiTileArtifact, outdoorRouteTileArtifact].filter(Boolean)) {
    const z = artifact.kind === 'base' ? 8 : 16
    const tile = z === 8 ? baseTile : overlayTile
    probes.push(await workerProbe(`${tileBaseUrl}/tiles/${environment}/${artifact.id}/${tile.path}.mvt`, artifact.kind))
  }

  const status = probes.every(probe => probe.ok) && baseArtifacts.length ? 'passed' : 'needs-review'
  return {
    id: fixture.id,
    targetId: fixture.targetId,
    label: fixture.label,
    activity: fixture.activity,
    printSize: fixture.printSize,
    bbox: fixture.bbox,
    status,
    artifactIds: {
      base: baseArtifacts.map(artifact => artifact.id),
      poi: poiArtifacts.map(artifact => artifact.id),
      outdoorRoutes: outdoorRouteArtifacts.map(artifact => artifact.id),
    },
    probes,
  }
}

async function appProxyProbe(url) {
  return probe(url, 'app-proxy')
}

async function workerProbe(url, kind) {
  const result = await probe(url, 'cloudflare-worker')
  if (kind !== 'base' && result.status === 204) {
    return {
      ...result,
      ok: true,
      delivery: result.delivery || 'empty-upstream',
    }
  }
  return result
}

async function probe(url, surface) {
  const res = await fetch(url, { method: 'GET' }).catch(error => ({ error }))
  if ('error' in res) {
    return { surface, url, ok: false, error: res.error.message }
  }
  return {
    surface,
    url,
    ok: res.ok && (res.headers.get('content-type') || '').includes('application/x-protobuf'),
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: Number(res.headers.get('content-length') || 0),
    artifact: res.headers.get('x-radmaps-atlas-artifact'),
    delivery: res.headers.get('x-radmaps-atlas-delivery'),
  }
}

async function renderFixture({ fixture, siteUrl, outputDir }) {
  const endpoint = stripTrailingSlash(process.env.PROOF_RENDER_ENDPOINT || '')
  const token = process.env.PROOF_RENDER_TOKEN || ''
  const secret = process.env.RENDER_TICKET_SECRET || ''

  if (!endpoint || !token || !secret) {
    throw new Error('PROOF_RENDER_ENDPOINT, PROOF_RENDER_TOKEN, and RENDER_TICKET_SECRET are required for --render')
  }

  const ticket = createRenderTicket({
    kind: 'atlas-qa',
    subject: fixture.id,
    renderClass: 'final',
    widthPx: FINAL_24X36.widthPx,
    heightPx: FINAL_24X36.heightPx,
    deviceScaleFactor: FINAL_24X36.deviceScaleFactor,
    productUid: FINAL_24X36.productUid,
    expiresAt: Date.now() + 30 * 60_000,
  }, secret)
  const url = `${siteUrl}/render/atlas-qa/${fixture.id}?ticket=${encodeURIComponent(ticket)}`
  const started = Date.now()
  const response = await fetch(`${endpoint}/screenshot?${new URLSearchParams({ token, timeout: '120000' }).toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      options: {
        type: 'png',
        fullPage: false,
        captureBeyondViewport: false,
      },
      viewport: {
        width: Math.ceil(FINAL_24X36.widthPx / FINAL_24X36.deviceScaleFactor),
        height: Math.ceil(FINAL_24X36.heightPx / FINAL_24X36.deviceScaleFactor),
        deviceScaleFactor: FINAL_24X36.deviceScaleFactor,
      },
      gotoOptions: {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      },
      waitForFunction: {
        fn: `() => ${RENDER_READY_EXPRESSION}`,
        timeout: 120000,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`AWS renderer failed for ${fixture.id} (${response.status}): ${body.slice(0, 1000)}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const imagePath = join(outputDir, `${fixture.id}.png`)
  writeFileSync(imagePath, buffer)
  return {
    status: 'rendered',
    backend: 'aws-renderer',
    imagePath,
    bytes: buffer.byteLength,
    widthPx: FINAL_24X36.widthPx,
    heightPx: FINAL_24X36.heightPx,
    deviceScaleFactor: FINAL_24X36.deviceScaleFactor,
    renderMs: Date.now() - started,
    url,
  }
}

function createRenderTicket(payload, secret) {
  const body = base64url(JSON.stringify(payload))
  return `${body}.${base64url(createHmac('sha256', secret).update(body).digest())}`
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function artifacts(manifest, kind) {
  const entry = manifest.artifacts?.[kind]
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

function bboxCenter([west, south, east, north]) {
  return {
    lng: (west + east) / 2,
    lat: (south + north) / 2,
  }
}

function tilePathForLngLat(z, lng, lat) {
  return tileForLngLat(z, lng, lat).path
}

function tileForLngLat(z, lng, lat) {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = lat * Math.PI / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  const clampedX = Math.max(0, Math.min(n - 1, x))
  const clampedY = Math.max(0, Math.min(n - 1, y))
  return {
    z,
    x: clampedX,
    y: clampedY,
    path: `${z}/${clampedX}/${clampedY}`,
    bbox: tileBbox(z, clampedX, clampedY),
  }
}

function tileBbox(z, x, y) {
  const n = 2 ** z
  const west = x / n * 360 - 180
  const east = (x + 1) / n * 360 - 180
  const north = tileYToLat(y, n)
  const south = tileYToLat(y + 1, n)
  return [west, south, east, north]
}

function tileYToLat(y, n) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
}

function intersects(bounds, bbox) {
  if (!bounds) return true
  const [west, south, east, north] = bbox
  const [artifactWest, artifactSouth, artifactEast, artifactNorth] = bounds
  return west <= artifactEast &&
    east >= artifactWest &&
    south <= artifactNorth &&
    north >= artifactSouth
}
