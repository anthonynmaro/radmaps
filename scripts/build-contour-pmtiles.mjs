#!/usr/bin/env node
/**
 * Build RadMaps-owned vector contour PMTiles from public Terrarium DEM tiles.
 *
 * Runtime maps use the generated PMTiles archive only. Mapzen/AWS Terrarium is
 * an input dataset for this build step, not a live provider dependency.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'
import { zxyToTileId } from 'pmtiles'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

const REGIONS = {
  driftless: {
    name: 'RadMaps Driftless Terrain Atlas',
    bbox: [-90.25, 42.85, -88.85, 43.55],
    center: [-89.55, 43.2, 10],
    demZoom: 12,
    minzoom: 8,
    maxzoom: 14,
    contourIntervalFt: 40,
    sampleStepPx: 4,
  },
  madison: {
    name: 'RadMaps Madison Terrain Atlas',
    bbox: [-89.55, 42.98, -89.25, 43.17],
    center: [-89.40, 43.08, 12],
    demZoom: 12,
    minzoom: 9,
    maxzoom: 14,
    contourIntervalFt: 20,
    sampleStepPx: 3,
  },
  yosemite: {
    name: 'RadMaps Yosemite Terrain Atlas',
    bbox: [-119.75, 37.60, -119.35, 37.92],
    center: [-119.573, 37.748, 12],
    demZoom: 12,
    minzoom: 8,
    maxzoom: 14,
    contourIntervalFt: 80,
    sampleStepPx: 4,
  },
  'rocky-mountain': {
    name: 'RadMaps Rocky Mountain Terrain Atlas',
    bbox: [-105.85, 40.16, -105.45, 40.52],
    center: [-105.646, 40.325, 12],
    demZoom: 12,
    minzoom: 8,
    maxzoom: 14,
    contourIntervalFt: 80,
    sampleStepPx: 4,
  },
  smokies: {
    name: 'RadMaps Smokies Terrain Atlas',
    bbox: [-83.75, 35.44, -83.22, 35.80],
    center: [-83.507, 35.611, 12],
    demZoom: 12,
    minzoom: 8,
    maxzoom: 14,
    contourIntervalFt: 80,
    sampleStepPx: 4,
  },
  superior: {
    name: 'RadMaps North Shore Terrain Atlas',
    bbox: [-91.52, 47.08, -90.68, 47.58],
    center: [-91.109, 47.309, 12],
    demZoom: 12,
    minzoom: 8,
    maxzoom: 14,
    contourIntervalFt: 40,
    sampleStepPx: 4,
  },
}

const args = parseArgs(process.argv.slice(2))
const region = REGIONS[args.region] ?? REGIONS.driftless
const outputPath = resolve(repoRoot, args.output)
const cacheDir = resolve(repoRoot, `atlas/terrain/${args.region}/terrarium-z${region.demZoom}`)

function parseArgs(argv) {
  const parsed = {
    region: 'driftless',
    output: 'public/atlas/radmaps-driftless-contours.pmtiles',
    forceFetch: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--region') parsed.region = argv[++i] ?? parsed.region
    else if (arg === '--output') parsed.output = argv[++i] ?? parsed.output
    else if (arg === '--force-fetch') parsed.forceFetch = true
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build-contour-pmtiles.mjs [--region driftless|madison|yosemite|rocky-mountain|smokies|superior] [--output public/atlas/radmaps-driftless-contours.pmtiles] [--force-fetch]')
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

function pixelToLonLat(px, py, z) {
  const world = 256 * 2 ** z
  const lon = (px / world) * 360 - 180
  const y = 1 - (2 * py) / world
  const lat = Math.atan(Math.sinh(Math.PI * y)) * 180 / Math.PI
  return [lon, lat]
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

async function fetchTile(z, x, y) {
  mkdirSync(resolve(cacheDir, String(x)), { recursive: true })
  const path = resolve(cacheDir, String(x), `${y}.png`)
  if (existsSync(path) && !args.forceFetch) return readFileSync(path)

  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed DEM tile ${z}/${x}/${y}: ${response.status} ${response.statusText}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(path, buffer)
  return buffer
}

function terrariumToFeet(r, g, b) {
  return ((r * 256 + g + b / 256) - 32768) * 3.28084
}

async function loadMosaic() {
  const z = region.demZoom
  const range = tileRangeForBbox(z, region.bbox)
  const tilesX = range.maxX - range.minX + 1
  const tilesY = range.maxY - range.minY + 1
  const width = tilesX * 256
  const height = tilesY * 256
  const rgb = new Uint8Array(width * height * 3)

  console.log(`DEM tiles z${z}: ${tilesX}x${tilesY} (${tilesX * tilesY} tiles)`)
  for (let ty = range.minY; ty <= range.maxY; ty += 1) {
    for (let tx = range.minX; tx <= range.maxX; tx += 1) {
      const png = await fetchTile(z, tx, ty)
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      if (info.width !== 256 || info.height !== 256 || info.channels < 3) {
        throw new Error(`Unexpected DEM tile shape for ${z}/${tx}/${ty}: ${info.width}x${info.height}x${info.channels}`)
      }
      const ox = (tx - range.minX) * 256
      const oy = (ty - range.minY) * 256
      for (let y = 0; y < 256; y += 1) {
        const src = y * 256 * info.channels
        const dest = ((oy + y) * width + ox) * 3
        for (let x = 0; x < 256; x += 1) {
          rgb[dest + x * 3] = data[src + x * info.channels]
          rgb[dest + x * 3 + 1] = data[src + x * info.channels + 1]
          rgb[dest + x * 3 + 2] = data[src + x * info.channels + 2]
        }
      }
    }
  }

  return {
    z,
    range,
    width,
    height,
    rgb,
    originPx: range.minX * 256,
    originPy: range.minY * 256,
  }
}

function sampleElevation(mosaic) {
  const step = region.sampleStepPx
  const width = Math.floor((mosaic.width - 1) / step) + 1
  const height = Math.floor((mosaic.height - 1) / step) + 1
  const values = new Float32Array(width * height)
  let min = Infinity
  let max = -Infinity

  for (let y = 0; y < height; y += 1) {
    const py = Math.min(y * step, mosaic.height - 1)
    for (let x = 0; x < width; x += 1) {
      const px = Math.min(x * step, mosaic.width - 1)
      const idx = (py * mosaic.width + px) * 3
      const feet = terrariumToFeet(mosaic.rgb[idx], mosaic.rgb[idx + 1], mosaic.rgb[idx + 2])
      values[y * width + x] = feet
      min = Math.min(min, feet)
      max = Math.max(max, feet)
    }
  }

  console.log(`Elevation range: ${Math.round(min)}ft to ${Math.round(max)}ft`)
  return { width, height, values, step, min, max }
}

function samplePoint(mosaic, sample, x, y) {
  return pixelToLonLat(
    mosaic.originPx + x * sample.step,
    mosaic.originPy + y * sample.step,
    mosaic.z,
  )
}

function interp(a, b, level) {
  if (a === b) return 0.5
  return Math.max(0, Math.min(1, (level - a) / (b - a)))
}

function crossing(a, b, level) {
  return (a < level && b >= level) || (b < level && a >= level)
}

function contourClass(level) {
  if (level % 200 === 0) return 'major'
  if (level % 80 === 0) return 'index'
  return 'minor'
}

function buildContourFeatures(mosaic, sample) {
  const features = []
  const interval = region.contourIntervalFt
  const minLevel = Math.ceil(sample.min / interval) * interval
  const maxLevel = Math.floor(sample.max / interval) * interval

  for (let y = 0; y < sample.height - 1; y += 1) {
    for (let x = 0; x < sample.width - 1; x += 1) {
      const v00 = sample.values[y * sample.width + x]
      const v10 = sample.values[y * sample.width + x + 1]
      const v11 = sample.values[(y + 1) * sample.width + x + 1]
      const v01 = sample.values[(y + 1) * sample.width + x]
      const cellMin = Math.min(v00, v10, v11, v01)
      const cellMax = Math.max(v00, v10, v11, v01)
      const start = Math.max(minLevel, Math.ceil(cellMin / interval) * interval)
      const end = Math.min(maxLevel, Math.floor(cellMax / interval) * interval)
      if (start > end) continue

      for (let level = start; level <= end; level += interval) {
        const points = []
        if (crossing(v00, v10, level)) {
          const t = interp(v00, v10, level)
          points.push(samplePoint(mosaic, sample, x + t, y))
        }
        if (crossing(v10, v11, level)) {
          const t = interp(v10, v11, level)
          points.push(samplePoint(mosaic, sample, x + 1, y + t))
        }
        if (crossing(v01, v11, level)) {
          const t = interp(v01, v11, level)
          points.push(samplePoint(mosaic, sample, x + t, y + 1))
        }
        if (crossing(v00, v01, level)) {
          const t = interp(v00, v01, level)
          points.push(samplePoint(mosaic, sample, x, y + t))
        }

        if (points.length === 2) addSegment(features, level, points[0], points[1])
        else if (points.length === 4) {
          addSegment(features, level, points[0], points[1])
          addSegment(features, level, points[2], points[3])
        }
      }
    }
  }

  console.log(`Contour segments: ${features.length}`)
  return features
}

function addSegment(features, level, a, b) {
  const [w, s, e, n] = region.bbox
  if ((a[0] < w && b[0] < w) || (a[0] > e && b[0] > e) || (a[1] < s && b[1] < s) || (a[1] > n && b[1] > n)) return
  features.push({
    type: 'Feature',
    properties: {
      elevation_ft: level,
      label: `${level} ft`,
      interval_class: contourClass(level),
      contour_interval_ft: region.contourIntervalFt,
      dem_source: 'mapzen-terrarium-aws',
      terrain_atlas_version: `${args.region}-contours-${new Date().toISOString().slice(0, 10)}`,
    },
    geometry: { type: 'LineString', coordinates: [a, b] },
  })
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
        tolerance: 1,
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
        tiles.push({ z, x, y, tileId: zxyToTileId(z, x, y), buffer: vtpbf.fromGeojsonVt(tileLayers) })
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
  let previousEnd = 0
  entries.forEach((entry, index) => {
    const isContiguous = index > 0 && entry.offset === previousEnd
    writeVarint(isContiguous ? 0 : entry.offset + 1, out)
    previousEnd = entry.offset + entry.length
  })
  return Buffer.from(out)
}

function writeUint64(view, offset, value) {
  view.setBigUint64(offset, BigInt(value), true)
}

function writePmtiles(tiles, layers) {
  const compressedTiles = tiles.map(tile => ({ ...tile, buffer: gzipSync(tile.buffer) }))
  let offset = 0
  const tileEntries = compressedTiles.map((tile) => {
    const entry = { tileId: tile.tileId, offset, length: tile.buffer.length, runLength: 1 }
    offset += tile.buffer.length
    return entry
  })

  const leafChunkSize = 256
  const leafDirectories = []
  const rootEntries = []
  let leafOffset = 0
  for (let i = 0; i < tileEntries.length; i += leafChunkSize) {
    const chunk = tileEntries.slice(i, i + leafChunkSize)
    const directory = serializeDirectory(chunk)
    leafDirectories.push(directory)
    rootEntries.push({
      tileId: chunk[0].tileId,
      offset: leafOffset,
      length: directory.length,
      runLength: 0,
    })
    leafOffset += directory.length
  }

  const rootDir = serializeDirectory(rootEntries)
  const leafDir = Buffer.concat(leafDirectories)
  const metadata = Buffer.from(JSON.stringify({
    name: region.name,
    description: 'RadMaps generated contour vector tiles from public Mapzen/AWS Terrarium DEM input.',
    attribution: 'Derived from Mapzen terrain tiles on AWS Open Data; map data attribution remains separate.',
    vector_layers: Object.keys(layers).map(id => ({
      id,
      description: 'RadMaps vector contour layer',
      fields: {
        elevation_ft: 'Number',
        label: 'String',
        interval_class: 'String',
        contour_interval_ft: 'Number',
        dem_source: 'String',
        terrain_atlas_version: 'String',
      },
    })),
  }))
  const tileData = Buffer.concat(compressedTiles.map(tile => tile.buffer))
  const headerSize = 127
  const rootDirectoryOffset = headerSize
  const leafDirectoryOffset = rootDirectoryOffset + rootDir.length
  const jsonMetadataOffset = leafDirectoryOffset + leafDir.length
  const tileDataOffset = jsonMetadataOffset + metadata.length
  const archive = Buffer.alloc(tileDataOffset + tileData.length)
  archive.write('PMTiles', 0, 'ascii')
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  view.setUint8(7, 3)
  writeUint64(view, 8, rootDirectoryOffset)
  writeUint64(view, 16, rootDir.length)
  writeUint64(view, 24, jsonMetadataOffset)
  writeUint64(view, 32, metadata.length)
  writeUint64(view, 40, leafDirectoryOffset)
  writeUint64(view, 48, leafDir.length)
  writeUint64(view, 56, tileDataOffset)
  writeUint64(view, 64, tileData.length)
  writeUint64(view, 72, tileEntries.length)
  writeUint64(view, 80, tileEntries.length + rootEntries.length)
  writeUint64(view, 88, tileEntries.length)
  view.setUint8(96, 1)
  view.setUint8(97, 1)
  view.setUint8(98, 2)
  view.setUint8(99, 1)
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
  leafDir.copy(archive, leafDirectoryOffset)
  metadata.copy(archive, jsonMetadataOffset)
  tileData.copy(archive, tileDataOffset)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, archive)
}

const mosaic = await loadMosaic()
const sample = sampleElevation(mosaic)
const contourFeatures = buildContourFeatures(mosaic, sample)
const layers = {
  contour: { type: 'FeatureCollection', features: contourFeatures },
}
const tiles = encodeTiles(layers)
console.log(`Encoded contour vector tiles: ${tiles.length}`)
writePmtiles(tiles, layers)
console.log(`Wrote ${outputPath}`)
