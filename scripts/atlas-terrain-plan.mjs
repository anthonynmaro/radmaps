#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const config = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/terrain-regions.json'), 'utf8'))
const args = parseArgs(process.argv.slice(2))
const date = args.date || new Date().toISOString().slice(0, 10)
const regions = resolveRegions(args.pack || args.region || 'midwest-core')

const plan = regions.map((id) => {
  const region = config.regions[id]
  if (!region) throw new Error(`Terrain pack references unknown region "${id}"`)
  const objectSlug = region.objectSlug || id
  const demTiles = tileCountForBbox(region.demZoom, region.bbox)
  return {
    id,
    name: region.name,
    bbox: region.bbox,
    demZoom: region.demZoom,
    demTileCount: demTiles.count,
    minzoom: region.minzoom,
    maxzoom: region.maxzoom,
    contourIntervalFt: region.contourIntervalFt,
    indexIntervalFt: region.indexIntervalFt,
    majorIntervalFt: region.majorIntervalFt,
    terrainZone: region.terrainZone || 'standard',
    output: `atlas/build/terrain/${objectSlug}/radmaps-${objectSlug}-contours.pmtiles`,
    object: `atlas/v1/terrain/${objectSlug}/${date}/radmaps-${objectSlug}-contours.pmtiles`,
  }
})

if (args.format === 'lines') {
  console.log(plan.map(item => item.id).join('\n'))
} else if (args.format === 'shell') {
  for (const item of plan) {
    console.log([item.id, item.output, item.object].join('\t'))
  }
} else {
  const totals = plan.reduce((memo, item) => ({
    regions: memo.regions + 1,
    demTileCount: memo.demTileCount + item.demTileCount,
  }), { regions: 0, demTileCount: 0 })
  console.log(JSON.stringify({
    schemaVersion: config.schemaVersion,
    date,
    pack: args.pack || args.region || 'midwest-core',
    totals,
    regions: plan,
  }, null, 2))
}

function resolveRegions(value) {
  if (config.packs[value]) return config.packs[value]
  if (config.regions[value]) return [value]
  throw new Error(`Unknown terrain pack or region "${value}". Known packs: ${Object.keys(config.packs).sort().join(', ')}`)
}

function parseArgs(argv) {
  const parsed = { format: 'json' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--pack') parsed.pack = argv[++i]
    else if (arg === '--region') parsed.region = argv[++i]
    else if (arg === '--date') parsed.date = argv[++i]
    else if (arg === '--format') parsed.format = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/atlas-terrain-plan.mjs [--pack midwest-core] [--region <id>] [--date yyyy-mm-dd] [--format json|lines|shell]')
      process.exit(0)
    }
  }
  return parsed
}

function lonLatToTile(lon, lat, z) {
  const latRad = lat * Math.PI / 180
  const n = 2 ** z
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
  }
}

function tileCountForBbox(z, [w, s, e, n]) {
  const min = lonLatToTile(w, n, z)
  const max = lonLatToTile(e, s, z)
  const minX = Math.max(0, Math.min(min.x, max.x))
  const maxX = Math.min((1 << z) - 1, Math.max(min.x, max.x))
  const minY = Math.max(0, Math.min(min.y, max.y))
  const maxY = Math.min((1 << z) - 1, Math.max(min.y, max.y))
  return {
    x: maxX - minX + 1,
    y: maxY - minY + 1,
    count: (maxX - minX + 1) * (maxY - minY + 1),
  }
}
