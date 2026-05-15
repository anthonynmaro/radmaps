#!/usr/bin/env node
/**
 * Build a real local PMTiles archive from OSM data.
 *
 * This is the emergency/local atlas path: it fetches real OSM data from
 * Overpass, converts it to GeoJSON, builds MVT vector tiles, and writes a
 * PMTiles v3 archive that MapLibre can load locally. It is intentionally small
 * and region-scoped until Java/Docker are ready for Planetiler.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'
import osmtogeojson from 'osmtogeojson'
import { zxyToTileId } from 'pmtiles'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

const REGIONS = {
  driftless: {
    name: 'RadMaps Driftless / Madison Atlas Lab',
    bbox: [-90.2, 42.9, -88.95, 43.45],
    minzoom: 5,
    maxzoom: 13,
    center: [-89.57, 43.18, 10],
  },
  chicago: {
    name: 'RadMaps Chicago Atlas Lab',
    bbox: [-88.05, 41.6, -87.45, 42.05],
    minzoom: 5,
    maxzoom: 13,
    center: [-87.72, 41.88, 10],
  },
}

const args = parseArgs(process.argv.slice(2))
const region = REGIONS[args.region] ?? REGIONS.driftless
const cachePath = resolve(repoRoot, `atlas/source/${args.region}.overpass.json`)
const outputPath = resolve(repoRoot, args.output)

function parseArgs(argv) {
  const parsed = {
    region: 'driftless',
    output: 'public/atlas/radmaps-atlas-lab.pmtiles',
    forceFetch: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--region') parsed.region = argv[++i] ?? parsed.region
    else if (arg === '--output') parsed.output = argv[++i] ?? parsed.output
    else if (arg === '--force-fetch') parsed.forceFetch = true
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build-local-pmtiles.mjs [--region driftless|chicago] [--output public/atlas/radmaps-atlas-lab.pmtiles] [--force-fetch]')
      process.exit(0)
    }
  }
  return parsed
}

function overpassQuery([w, s, e, n]) {
  const bbox = `${s},${w},${n},${e}`
  return `[out:json][timeout:90];
(
  way["highway"](${bbox});
  relation["route"~"hiking|bicycle"](${bbox});
  way["waterway"](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["water"](${bbox});
  relation["water"](${bbox});
  way["landuse"](${bbox});
  relation["landuse"](${bbox});
  way["natural"~"wood|scrub|grassland|wetland|sand|bare_rock"](${bbox});
  relation["natural"~"wood|scrub|grassland|wetland|sand|bare_rock"](${bbox});
  way["leisure"="park"](${bbox});
  relation["leisure"="park"](${bbox});
  way["boundary"~"national_park|protected_area|administrative"](${bbox});
  relation["boundary"~"national_park|protected_area|administrative"](${bbox});
  node["place"](${bbox});
  node["tourism"~"viewpoint|camp_site|picnic_site|information"](${bbox});
  node["natural"="peak"](${bbox});
);
out body geom;`
}

async function fetchOverpass() {
  if (existsSync(cachePath) && !args.forceFetch) {
    console.log(`Using cached OSM source: ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf8'))
  }

  mkdirSync(dirname(cachePath), { recursive: true })
  const body = new URLSearchParams({ data: overpassQuery(region.bbox) })
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]

  let lastError
  for (const endpoint of endpoints) {
    try {
      console.log(`Fetching OSM data from ${endpoint}`)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const json = await response.json()
      writeFileSync(cachePath, `${JSON.stringify(json)}\n`)
      return json
    } catch (error) {
      lastError = error
      console.warn(`Overpass endpoint failed: ${endpoint}: ${error.message}`)
    }
  }

  throw lastError
}

function classifyFeature(feature) {
  const tags = feature.properties ?? {}
  if (tags.waterway) return 'waterway'
  if (tags.natural === 'water' || tags.water || tags.landuse === 'reservoir') return 'water'
  if (tags.leisure === 'park' || tags.boundary === 'protected_area' || tags.boundary === 'national_park') return 'park'
  if (tags.landuse || ['wood', 'scrub', 'grassland', 'wetland', 'sand', 'bare_rock'].includes(tags.natural)) return 'landcover'
  if (tags.highway) {
    if (['path', 'footway', 'cycleway', 'bridleway', 'track'].includes(tags.highway)) return 'trail'
    return 'road'
  }
  if (tags.place) return 'place_label'
  if (tags.tourism || tags.natural === 'peak') return 'poi'
  if (tags.boundary) return 'boundary'
  return null
}

function featureProps(feature, layer) {
  const tags = feature.properties ?? {}
  if (layer === 'road' || layer === 'trail') {
    return {
      name: tags.name ?? '',
      class: tags.highway ?? '',
      surface: tags.surface ?? tags.tracktype ?? 'unknown',
      ref: tags.ref ?? '',
    }
  }
  if (layer === 'landcover') return { class: tags.landuse ?? tags.natural ?? 'landcover', name: tags.name ?? '' }
  if (layer === 'water' || layer === 'waterway') return { class: tags.water ?? tags.waterway ?? tags.natural ?? 'water', name: tags.name ?? '' }
  if (layer === 'place_label') return { name: tags.name ?? '', class: tags.place ?? 'place' }
  if (layer === 'poi') return { name: tags.name ?? '', class: tags.tourism ?? tags.natural ?? 'poi' }
  if (layer === 'park') return { name: tags.name ?? '', class: tags.leisure ?? tags.boundary ?? 'park' }
  if (layer === 'boundary') return { name: tags.name ?? '', class: tags.boundary ?? 'boundary', admin_level: tags.admin_level ?? '' }
  return { name: tags.name ?? '' }
}

function splitLayers(geojson) {
  const layers = {
    water: [],
    waterway: [],
    road: [],
    trail: [],
    landcover: [],
    park: [],
    place_label: [],
    poi: [],
    boundary: [],
    contour: generatedContours(),
    terrain_art: generatedTerrainArt(),
  }

  for (const feature of geojson.features ?? []) {
    const layer = classifyFeature(feature)
    if (!layer || !layers[layer]) continue
    layers[layer].push({
      type: 'Feature',
      properties: featureProps(feature, layer),
      geometry: feature.geometry,
    })
  }

  return Object.fromEntries(
    Object.entries(layers)
      .filter(([, features]) => features.length > 0)
      .map(([name, features]) => [name, { type: 'FeatureCollection', features }]),
  )
}

function generatedContours() {
  const [w, s, e, n] = region.bbox
  return Array.from({ length: 22 }, (_, i) => {
    const y = s + ((n - s) * (i + 1)) / 24
    const coords = Array.from({ length: 9 }, (_, j) => {
      const x = w + ((e - w) * j) / 8
      return [x, y + Math.sin(i * 0.8 + j * 0.9) * (n - s) * 0.025]
    })
    return {
      type: 'Feature',
      properties: {
        elevation_ft: 700 + i * 40,
        interval_class: i % 5 === 0 ? 'major' : i % 2 === 0 ? 'index' : 'minor',
      },
      geometry: { type: 'LineString', coordinates: coords },
    }
  })
}

function generatedTerrainArt() {
  const [w, s, e, n] = region.bbox
  return [
    {
      type: 'Feature',
      properties: { art_type: 'ridge', order: 'primary' },
      geometry: { type: 'LineString', coordinates: [[w + 0.15 * (e - w), s + 0.15 * (n - s)], [w + 0.42 * (e - w), s + 0.58 * (n - s)], [w + 0.7 * (e - w), s + 0.82 * (n - s)]] },
    },
    {
      type: 'Feature',
      properties: { art_type: 'drainage', order: 'secondary' },
      geometry: { type: 'LineString', coordinates: [[w + 0.12 * (e - w), s + 0.78 * (n - s)], [w + 0.38 * (e - w), s + 0.56 * (n - s)], [w + 0.78 * (e - w), s + 0.42 * (n - s)]] },
    },
    {
      type: 'Feature',
      properties: { art_type: 'slope_band', slope_class: 3 },
      geometry: { type: 'Polygon', coordinates: [[[w + 0.2 * (e - w), s + 0.2 * (n - s)], [w + 0.58 * (e - w), s + 0.18 * (n - s)], [w + 0.68 * (e - w), s + 0.48 * (n - s)], [w + 0.3 * (e - w), s + 0.55 * (n - s)], [w + 0.2 * (e - w), s + 0.2 * (n - s)]]] },
    },
  ]
}

function tileRangeForBbox(z, [w, s, e, n]) {
  const min = lonLatToTile(w, n, z)
  const max = lonLatToTile(e, s, z)
  return {
    minX: Math.max(0, Math.min(min.x, max.x)),
    maxX: Math.min((1 << z) - 1, Math.max(min.x, max.x)),
    minY: Math.max(0, Math.min(min.y, max.y)),
    maxY: Math.min((1 << z) - 1, Math.max(min.y, max.y)),
  }
}

function lonLatToTile(lon, lat, z) {
  const latRad = lat * Math.PI / 180
  const n = 2 ** z
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
  }
}

function encodeTiles(layers) {
  const indexes = Object.fromEntries(
    Object.entries(layers).map(([name, data]) => [
      name,
      geojsonvt(data, {
        maxZoom: region.maxzoom,
        indexMaxZoom: Math.min(10, region.maxzoom),
        extent: 4096,
        buffer: 128,
        tolerance: 3,
        promoteId: 'id',
      }),
    ]),
  )

  const tiles = []
  for (let z = region.minzoom; z <= region.maxzoom; z += 1) {
    const range = tileRangeForBbox(z, region.bbox)
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        const tileLayers = {}
        for (const [name, index] of Object.entries(indexes)) {
          const tile = index.getTile(z, x, y)
          if (tile?.features?.length) tileLayers[name] = tile
        }
        if (Object.keys(tileLayers).length === 0) continue
        const buffer = vtpbf.fromGeojsonVt(tileLayers)
        tiles.push({ z, x, y, tileId: zxyToTileId(z, x, y), buffer })
      }
    }
  }
  return tiles.sort((a, b) => a.tileId - b.tileId)
}

function writeVarint(value, out) {
  let n = BigInt(value)
  while (n > 0x7fn) {
    out.push(Number((n & 0x7fn) | 0x80n))
    n >>= 7n
  }
  out.push(Number(n))
}

function serializeDirectory(entries) {
  const out = []
  writeVarint(entries.length, out)
  let lastId = 0
  for (const entry of entries) {
    writeVarint(entry.tileId - lastId, out)
    lastId = entry.tileId
  }
  for (const entry of entries) writeVarint(entry.runLength, out)
  for (const entry of entries) writeVarint(entry.length, out)
  for (const entry of entries) writeVarint(entry.offset + 1, out)
  return Buffer.from(out)
}

function writeUint64(view, offset, value) {
  view.setBigUint64(offset, BigInt(value), true)
}

function writePmtiles(tiles, layers) {
  let offset = 0
  const entries = tiles.map((tile) => {
    const entry = { tileId: tile.tileId, offset, length: tile.buffer.length, runLength: 1 }
    offset += tile.buffer.length
    return entry
  })

  const rootDir = serializeDirectory(entries)
  const metadata = Buffer.from(JSON.stringify({
    name: region.name,
    description: 'RadMaps local atlas lab PMTiles generated from OSM Overpass data plus derived local terrain-art placeholders.',
    attribution: '© OpenStreetMap contributors; derived terrain-art placeholders by RadMaps.',
    vector_layers: Object.keys(layers).map(id => ({ id, description: `RadMaps ${id} layer`, fields: {} })),
  }))
  const tileData = Buffer.concat(tiles.map(tile => tile.buffer))

  const headerSize = 127
  const rootDirectoryOffset = headerSize
  const jsonMetadataOffset = rootDirectoryOffset + rootDir.length
  const tileDataOffset = jsonMetadataOffset + metadata.length
  const archive = Buffer.alloc(tileDataOffset + tileData.length)

  archive.write('PMTiles', 0, 'ascii')
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  view.setUint8(7, 3)
  writeUint64(view, 8, rootDirectoryOffset)
  writeUint64(view, 16, rootDir.length)
  writeUint64(view, 24, jsonMetadataOffset)
  writeUint64(view, 32, metadata.length)
  writeUint64(view, 40, 0)
  writeUint64(view, 48, 0)
  writeUint64(view, 56, tileDataOffset)
  writeUint64(view, 64, tileData.length)
  writeUint64(view, 72, entries.length)
  writeUint64(view, 80, entries.length)
  writeUint64(view, 88, entries.length)
  view.setUint8(96, 1) // clustered
  view.setUint8(97, 1) // internal compression none
  view.setUint8(98, 1) // tile compression none
  view.setUint8(99, 1) // MVT
  view.setUint8(100, region.minzoom)
  view.setUint8(101, region.maxzoom)
  view.setInt32(102, Math.round(region.bbox[0] * 10_000_000), true)
  view.setInt32(106, Math.round(region.bbox[1] * 10_000_000), true)
  view.setInt32(110, Math.round(region.bbox[2] * 10_000_000), true)
  view.setInt32(114, Math.round(region.bbox[3] * 10_000_000), true)
  view.setUint8(118, region.center[2])
  view.setInt32(119, Math.round(region.center[0] * 10_000_000), true)
  view.setInt32(123, Math.round(region.center[1] * 10_000_000), true)

  rootDir.copy(archive, rootDirectoryOffset)
  metadata.copy(archive, jsonMetadataOffset)
  tileData.copy(archive, tileDataOffset)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, archive)
}

const osm = await fetchOverpass()
console.log(`OSM elements: ${osm.elements?.length ?? 0}`)
const geojson = osmtogeojson(osm, { flatProperties: true })
console.log(`GeoJSON features: ${geojson.features.length}`)
const layers = splitLayers(geojson)
console.log(`Layers: ${Object.entries(layers).map(([k, v]) => `${k}:${v.features.length}`).join(', ')}`)
const tiles = encodeTiles(layers)
console.log(`Encoded vector tiles: ${tiles.length}`)
writePmtiles(tiles, layers)
console.log(`Wrote ${outputPath}`)
