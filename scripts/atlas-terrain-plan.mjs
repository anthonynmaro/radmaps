#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const config = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/terrain-regions.json'), 'utf8'))
const virtualRegions = buildVirtualRegions(config)
const availableRegions = {
  ...config.regions,
  ...virtualRegions,
}
const args = parseArgs(process.argv.slice(2))
const date = args.date || new Date().toISOString().slice(0, 10)
const regions = resolveRegions(args.pack || args.region || 'midwest-core')

const plan = regions.map((id) => {
  const region = availableRegions[id]
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
    sampleStepPx: region.sampleStepPx,
    terrainZone: region.terrainZone || 'standard',
    sourceRegion: region.sourceRegion || id,
    split: region.split || null,
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
  if (config.packs[value]) return config.packs[value].flatMap(expandRegionRef)
  if (availableRegions[value]) return [value]
  throw new Error(`Unknown terrain pack or region "${value}". Known packs: ${Object.keys(config.packs).sort().join(', ')}`)
}

function expandRegionRef(ref) {
  if (typeof ref === 'string') return [ref]
  if (ref?.split) {
    const cols = Number(ref.cols || 1)
    const rows = Number(ref.rows || 1)
    return splitRegionIds(ref.split, cols, rows)
  }
  throw new Error(`Unsupported terrain region reference: ${JSON.stringify(ref)}`)
}

function buildVirtualRegions(config) {
  const regions = {}
  for (const refs of Object.values(config.packs || {})) {
    for (const ref of refs) {
      if (!ref || typeof ref === 'string' || !ref.split) continue
      const base = config.regions?.[ref.split]
      if (!base) throw new Error(`Terrain split references unknown region "${ref.split}"`)
      const cols = Number(ref.cols || 1)
      const rows = Number(ref.rows || 1)
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const id = splitRegionId(ref.split, row, col)
          const bbox = splitBbox(base.bbox, cols, rows, row, col)
          const objectSlug = `${base.objectSlug || ref.split}-r${row + 1}c${col + 1}`
          regions[id] = {
            ...base,
            name: `${base.name} R${row + 1}C${col + 1}`,
            bbox,
            center: [roundCoord((bbox[0] + bbox[2]) / 2), roundCoord((bbox[1] + bbox[3]) / 2), base.center?.[2] ?? base.minzoom],
            objectSlug,
            sourceRegion: ref.split,
            split: { cols, rows, row: row + 1, col: col + 1 },
          }
        }
      }
    }
  }
  return regions
}

function splitRegionIds(baseId, cols, rows) {
  const ids = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) ids.push(splitRegionId(baseId, row, col))
  }
  return ids
}

function splitRegionId(baseId, row, col) {
  return `${baseId}-r${row + 1}c${col + 1}`
}

function splitBbox([w, s, e, n], cols, rows, row, col) {
  return [
    roundCoord(w + ((e - w) * col) / cols),
    roundCoord(s + ((n - s) * row) / rows),
    roundCoord(w + ((e - w) * (col + 1)) / cols),
    roundCoord(s + ((n - s) * (row + 1)) / rows),
  ]
}

function roundCoord(value) {
  return Number(value.toFixed(6))
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
