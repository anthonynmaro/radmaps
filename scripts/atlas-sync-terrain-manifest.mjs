#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const args = parseArgs(process.argv.slice(2))
const pack = args.pack || 'us-terrain-phase1'
const date = args.date || '2026-05-18'
const environment = args.environment || 'staging'
const manifestPath = resolve(repoRoot, args.manifest || `public/atlas/manifests/${environment}.json`)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const publicBaseUrl = (args.publicBaseUrl || manifest.storage?.publicBaseUrl || '').replace(/\/$/, '')
const verify = args.verify !== 'none'

if (!publicBaseUrl) throw new Error('Missing public base URL. Pass --public-base-url or set manifest.storage.publicBaseUrl.')

const plan = JSON.parse(execFileSync(process.execPath, [
  resolve(repoRoot, 'scripts/atlas-terrain-plan.mjs'),
  '--pack',
  pack,
  '--date',
  date,
], { encoding: 'utf8' }))

const existingContours = Array.isArray(manifest.artifacts?.contours)
  ? manifest.artifacts.contours
  : manifest.artifacts?.contours
    ? [manifest.artifacts.contours]
    : []

const artifacts = []
for (const region of plan.regions) {
  const artifact = await artifactFromRegion(region)
  artifacts.push(artifact)
}

const nextById = new Map(existingContours.map(artifact => [artifact.id, artifact]))
for (const artifact of artifacts) nextById.set(artifact.id, artifact)

manifest.artifacts = {
  ...(manifest.artifacts || {}),
  contours: [...nextById.values()].sort((left, right) => left.id.localeCompare(right.id)),
}
manifest.layerCatalog = Array.from(new Set([...(manifest.layerCatalog || []), 'contour']))
manifest.updatedAt = new Date().toISOString()

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({
  manifest: manifestPath,
  pack,
  date,
  environment,
  addedOrUpdated: artifacts.length,
  totalContours: manifest.artifacts.contours.length,
  verify,
}, null, 2))

async function artifactFromRegion(region) {
  const objectPath = region.object
  const objectSlug = objectPath.split('/')[3] || region.id
  const url = `${publicBaseUrl}/${objectPath.split('/').map(encodeURIComponent).join('/')}`
  const verification = verify ? await verifyPmtiles(url) : {}
  return {
    id: `radmaps-${objectSlug}-contours`,
    kind: 'contours',
    url,
    objectPath,
    minzoom: region.minzoom ?? 8,
    maxzoom: region.maxzoom ?? 14,
    bounds: region.bbox,
    layers: ['contour'],
    ...(verification.bytes ? { bytes: verification.bytes } : {}),
    sourceLicenses: [
      'Mapzen Terrain Tiles on AWS Open Data',
      'RadMaps generated contours',
    ],
    createdAt: `${date}T00:00:00.000Z`,
    status: environment === 'production' ? 'production' : 'staging',
    terrainRegion: region.id,
    sourceRegion: region.sourceRegion || region.id,
  }
}

async function verifyPmtiles(url) {
  const response = await fetch(url, { headers: { range: 'bytes=0-16383' } })
  if (response.status !== 206) throw new Error(`Expected 206 Partial Content for ${url}, got ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const magic = new TextDecoder().decode(bytes.slice(0, 7))
  if (magic !== 'PMTiles') throw new Error(`Object does not look like PMTiles: ${url}`)
  const contentRange = response.headers.get('content-range') || ''
  const totalBytes = Number(contentRange.match(/\/(\d+)$/)?.[1] || 0)
  return { bytes: totalBytes || undefined }
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--pack') parsed.pack = argv[++i]
    else if (arg === '--date') parsed.date = argv[++i]
    else if (arg === '--environment') parsed.environment = argv[++i]
    else if (arg === '--manifest') parsed.manifest = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--verify') parsed.verify = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/atlas-sync-terrain-manifest.mjs --pack us-terrain-phase1 --date 2026-05-18 --environment staging [--verify none]')
      process.exit(0)
    }
  }
  return parsed
}
