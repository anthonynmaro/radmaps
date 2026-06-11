#!/usr/bin/env node
/**
 * Stamp stable, content-derived `rm_id` feature ids onto label-layer features
 * in a RadMaps atlas PMTiles archive.
 *
 * Design: docs/ATLAS_STABLE_FEATURE_IDS.md (E2). The atlas `base` stage emits
 * PMTiles directly from stock Planetiler (no mbtiles intermediate), so this is
 * a PMTiles -> PMTiles rewrite:
 *
 *   - point label layers (place/poi/water_name/mountain_peak):
 *       rm_id = base36(xxhash64(`${layer}|${class}|${normalize(name)}|${geohash}`))
 *       geohash-6 for place (~1.2km cell), geohash-7 (~150m) for the rest.
 *   - line label layers (transportation_name/waterway): tile clipping makes
 *       geometry-derived geohashes unstable per tile, so NO geohash:
 *       rm_id = base36(xxhash64(`${layer}|${class}|${normalize(name|ref)}`))
 *   - normalize: NFKC, casefold, trim, collapse whitespace. name falls back to
 *       name:latin then ref then empty. Features with no name AND no ref are
 *       skipped (no id stamped).
 *   - Non-label layers pass through byte-identical (raw protobuf segment copy);
 *       tiles without stampable features keep their original compressed bytes.
 *   - Idempotent: re-running on already-stamped tiles produces identical bytes.
 *
 * CLI:
 *   node scripts/atlas-add-feature-ids.mjs --input base.pmtiles --output stamped.pmtiles
 *   node scripts/atlas-add-feature-ids.mjs --input base.pmtiles --in-place
 *   node scripts/atlas-add-feature-ids.mjs --diff old.pmtiles new.pmtiles
 */

import { closeSync, mkdirSync, openSync, readSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import Protobuf from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'
import vtpbf from 'vt-pbf'
import { bytesToHeader, readVarint, tileIdToZxy, zxyToTileId } from 'pmtiles'

export const FEATURE_ID_SCHEME = 'rm_id@1'

/** Point label layers -> geohash precision used as the location disambiguator. */
export const POINT_LABEL_LAYERS = Object.freeze({
  place: 6,
  poi: 7,
  water_name: 7,
  mountain_peak: 7,
})

/** Line label layers: keyed without geohash (tile-clipped geometry). */
export const LINE_LABEL_LAYERS = Object.freeze(new Set(['transportation_name', 'waterway']))

export const LABEL_LAYERS = Object.freeze(new Set([
  ...Object.keys(POINT_LABEL_LAYERS),
  ...LINE_LABEL_LAYERS,
]))

// ---------------------------------------------------------------------------
// xxhash64 — pure-JS BigInt implementation (no native binaries; CI-safe).
// Verified against the reference XXH64 test vectors in the unit tests.
// ---------------------------------------------------------------------------

const MASK64 = 0xFFFFFFFFFFFFFFFFn
const P64_1 = 0x9E3779B185EBCA87n
const P64_2 = 0xC2B2AE3D27D4EB4Fn
const P64_3 = 0x165667B19E3779F9n
const P64_4 = 0x85EBCA77C2B2AE63n
const P64_5 = 0x27D4EB2F165667C5n

function rotl64(value, rotation) {
  return ((value << rotation) | (value >> (64n - rotation))) & MASK64
}

function xxh64Round(acc, input) {
  return (rotl64((acc + ((input * P64_2) & MASK64)) & MASK64, 31n) * P64_1) & MASK64
}

function xxh64MergeRound(acc, value) {
  return (((acc ^ xxh64Round(0n, value)) * P64_1 + P64_4) & MASK64)
}

/** @returns {bigint} unsigned 64-bit hash */
export function xxhash64(input, seed = 0n) {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  const length = data.length
  let offset = 0
  let hash
  if (length >= 32) {
    let v1 = (seed + P64_1 + P64_2) & MASK64
    let v2 = (seed + P64_2) & MASK64
    let v3 = seed & MASK64
    let v4 = (seed - P64_1) & MASK64
    for (; offset + 32 <= length; offset += 32) {
      v1 = xxh64Round(v1, data.readBigUInt64LE(offset))
      v2 = xxh64Round(v2, data.readBigUInt64LE(offset + 8))
      v3 = xxh64Round(v3, data.readBigUInt64LE(offset + 16))
      v4 = xxh64Round(v4, data.readBigUInt64LE(offset + 24))
    }
    hash = (rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n)) & MASK64
    hash = xxh64MergeRound(hash, v1)
    hash = xxh64MergeRound(hash, v2)
    hash = xxh64MergeRound(hash, v3)
    hash = xxh64MergeRound(hash, v4)
  } else {
    hash = ((seed & MASK64) + P64_5) & MASK64
  }
  hash = (hash + BigInt(length)) & MASK64
  for (; offset + 8 <= length; offset += 8) {
    const k1 = xxh64Round(0n, data.readBigUInt64LE(offset))
    hash = ((rotl64(hash ^ k1, 27n) * P64_1) + P64_4) & MASK64
  }
  if (offset + 4 <= length) {
    hash = ((rotl64(hash ^ ((BigInt(data.readUInt32LE(offset)) * P64_1) & MASK64), 23n) * P64_2) + P64_3) & MASK64
    offset += 4
  }
  for (; offset < length; offset += 1) {
    hash = (rotl64(hash ^ ((BigInt(data[offset]) * P64_5) & MASK64), 11n) * P64_1) & MASK64
  }
  hash ^= hash >> 33n
  hash = (hash * P64_2) & MASK64
  hash ^= hash >> 29n
  hash = (hash * P64_3) & MASK64
  hash ^= hash >> 32n
  return hash
}

// ---------------------------------------------------------------------------
// Geohash encode (pure; no dependency).
// ---------------------------------------------------------------------------

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export function encodeGeohash(lon, lat, precision) {
  let minLat = -90
  let maxLat = 90
  let minLon = -180
  let maxLon = 180
  let hash = ''
  let bit = 0
  let ch = 0
  let evenBit = true
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (minLon + maxLon) / 2
      if (lon >= mid) {
        ch = ch * 2 + 1
        minLon = mid
      } else {
        ch *= 2
        maxLon = mid
      }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) {
        ch = ch * 2 + 1
        minLat = mid
      } else {
        ch *= 2
        maxLat = mid
      }
    }
    evenBit = !evenBit
    bit += 1
    if (bit === 5) {
      hash += GEOHASH_BASE32[ch]
      bit = 0
      ch = 0
    }
  }
  return hash
}

// ---------------------------------------------------------------------------
// rm_id derivation
// ---------------------------------------------------------------------------

/** NFKC, casefold, trim, collapse whitespace. */
export function normalizeLabelText(value) {
  if (value == null) return ''
  return String(value).normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** name -> name:latin -> ref -> null (null means: skip the feature). */
export function pickLabelText(properties) {
  for (const key of ['name', 'name:latin', 'ref']) {
    const value = properties?.[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export function computeRmId(layerName, className, normalizedText, geohash) {
  const key = geohash
    ? `${layerName}|${className}|${normalizedText}|${geohash}`
    : `${layerName}|${className}|${normalizedText}`
  return xxhash64(key).toString(36)
}

/** Inverse web-mercator: tile-local integer coords -> lon/lat (same math as vector-tile toGeoJSON). */
export function tilePointToLonLat(px, py, extent, z, x, y) {
  const worldSize = extent * 2 ** z
  const shiftX = extent * x
  const shiftY = extent * y
  const lon = ((px + shiftX) * 360) / worldSize - 180
  const y2 = 180 - ((py + shiftY) * 360) / worldSize
  const lat = (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90
  return [lon, lat]
}

/**
 * Compute the rm_id for one decoded vector-tile feature, or null when the
 * feature carries no name/ref. Point-layer features that are not actual point
 * geometries (e.g. water_name sea/lake centerlines) are tile-clipped, so they
 * fall back to the line-style key without a geohash.
 */
export function rmIdForFeature(layerName, feature, extent, z, x, y) {
  const properties = feature.properties
  const text = pickLabelText(properties)
  if (text == null) return null
  const normalized = normalizeLabelText(text)
  const className = properties?.class == null ? '' : String(properties.class)
  let geohash = null
  const precision = POINT_LABEL_LAYERS[layerName]
  if (precision && feature.type === 1) {
    const geometry = feature.loadGeometry()
    const point = geometry?.[0]?.[0]
    if (point) {
      const [lon, lat] = tilePointToLonLat(point.x, point.y, extent, z, x, y)
      geohash = encodeGeohash(lon, lat, precision)
    }
  }
  return computeRmId(layerName, className, normalized, geohash)
}

// ---------------------------------------------------------------------------
// MVT tile processing — split top-level layer messages so non-label layers
// pass through byte-identical; only label layers with stamped features are
// re-encoded (via vt-pbf).
// ---------------------------------------------------------------------------

function readUVarint(buffer, position) {
  let result = 0
  let shift = 0
  let pos = position
  for (;;) {
    const byte = buffer[pos]
    pos += 1
    if (shift < 28) {
      result += (byte & 0x7f) << shift
    } else {
      result += (byte & 0x7f) * 2 ** shift
    }
    if (byte < 0x80) return { value: result, pos }
    shift += 7
    if (shift > 63) throw new Error('Malformed varint in MVT buffer')
  }
}

function skipWireValue(buffer, pos, wireType) {
  if (wireType === 0) return readUVarint(buffer, pos).pos
  if (wireType === 1) return pos + 8
  if (wireType === 2) {
    const len = readUVarint(buffer, pos)
    return len.pos + len.value
  }
  if (wireType === 5) return pos + 4
  throw new Error(`Unsupported protobuf wire type ${wireType} in MVT buffer`)
}

/**
 * Split an uncompressed MVT tile into top-level segments. Layer segments
 * (field 3) carry their layer name; everything is kept as raw bytes including
 * the tag so reassembly is byte-exact for untouched segments.
 */
export function splitTileLayers(buffer) {
  const segments = []
  let pos = 0
  while (pos < buffer.length) {
    const segmentStart = pos
    const tag = readUVarint(buffer, pos)
    const fieldNumber = tag.value >> 3
    const wireType = tag.value & 0x7
    if (fieldNumber === 3 && wireType === 2) {
      const len = readUVarint(buffer, tag.pos)
      const messageStart = len.pos
      const messageEnd = len.pos + len.value
      segments.push({
        kind: 'layer',
        name: readLayerName(buffer, messageStart, messageEnd),
        raw: buffer.subarray(segmentStart, messageEnd),
        message: buffer.subarray(messageStart, messageEnd),
      })
      pos = messageEnd
    } else {
      const end = skipWireValue(buffer, tag.pos, wireType)
      segments.push({ kind: 'other', raw: buffer.subarray(segmentStart, end) })
      pos = end
    }
  }
  return segments
}

function readLayerName(buffer, start, end) {
  let pos = start
  while (pos < end) {
    const tag = readUVarint(buffer, pos)
    const fieldNumber = tag.value >> 3
    const wireType = tag.value & 0x7
    if (fieldNumber === 1 && wireType === 2) {
      const len = readUVarint(buffer, tag.pos)
      return Buffer.from(buffer.subarray(len.pos, len.pos + len.value)).toString('utf8')
    }
    pos = skipWireValue(buffer, tag.pos, wireType)
  }
  return ''
}

/** vt-pbf-compatible layer wrapper that overrides feature properties. */
class StampedLayer {
  constructor(layer, stampedProperties) {
    this.version = layer.version
    this.name = layer.name
    this.extent = layer.extent
    this.length = layer.length
    this._layer = layer
    this._stampedProperties = stampedProperties
  }

  feature(index) {
    const feature = this._layer.feature(index)
    return {
      id: feature.id,
      type: feature.type,
      properties: this._stampedProperties[index],
      loadGeometry: () => feature.loadGeometry(),
    }
  }
}

/**
 * Stamp rm_id onto label-layer features of one uncompressed MVT tile buffer.
 * Returns { buffer, changed, stamped, skipped }. When no label layer contains
 * a stampable feature, `changed` is false and `buffer` is the input buffer.
 */
export function stampTileBuffer(buffer, { z, x, y }) {
  const segments = splitTileLayers(buffer)
  const hasLabelLayer = segments.some(segment => segment.kind === 'layer' && LABEL_LAYERS.has(segment.name))
  if (!hasLabelLayer) return { buffer, changed: false, stamped: 0, skipped: 0 }

  const decoded = new VectorTile(new Protobuf(buffer))
  let stamped = 0
  let skipped = 0
  const replacements = new Map()

  for (const segment of segments) {
    if (segment.kind !== 'layer' || !LABEL_LAYERS.has(segment.name)) continue
    if (replacements.has(segment.name)) continue
    const layer = decoded.layers[segment.name]
    if (!layer) continue
    const stampedProperties = new Array(layer.length)
    let layerStamped = 0
    for (let i = 0; i < layer.length; i += 1) {
      const feature = layer.feature(i)
      const properties = { ...feature.properties }
      const rmId = rmIdForFeature(segment.name, feature, layer.extent, z, x, y)
      if (rmId != null) {
        properties.rm_id = rmId
        layerStamped += 1
      } else {
        skipped += 1
      }
      stampedProperties[i] = properties
    }
    if (layerStamped === 0) continue
    stamped += layerStamped
    const encoded = vtpbf.fromVectorTileJs({ layers: { [segment.name]: new StampedLayer(layer, stampedProperties) } })
    replacements.set(segment.name, Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength))
  }

  if (replacements.size === 0) return { buffer, changed: false, stamped: 0, skipped }

  const parts = segments.map((segment) => {
    if (segment.kind === 'layer' && replacements.has(segment.name)) {
      const replacement = replacements.get(segment.name)
      replacements.delete(segment.name)
      return replacement
    }
    return segment.raw
  })
  return { buffer: Buffer.concat(parts), changed: true, stamped, skipped }
}

// ---------------------------------------------------------------------------
// PMTiles v3 reading
// ---------------------------------------------------------------------------

const COMPRESSION_NONE = 1
const COMPRESSION_GZIP = 2
const TILE_TYPE_MVT = 1
const HEADER_SIZE = 127

function readBytes(fd, offset, length) {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const bytes = readSync(fd, buffer, read, length - read, offset + read)
    if (bytes <= 0) throw new Error(`Short read at offset ${offset + read}`)
    read += bytes
  }
  return buffer
}

function decompress(buffer, compression) {
  if (compression === COMPRESSION_GZIP) return gunzipSync(buffer)
  if (compression === COMPRESSION_NONE || compression === 0) return buffer
  throw new Error(`Unsupported PMTiles compression: ${compression}`)
}

function parseDirectory(buffer) {
  const position = { buf: buffer, pos: 0 }
  const count = readVarint(position)
  const entries = new Array(count)
  let lastId = 0
  for (let i = 0; i < count; i += 1) {
    lastId += readVarint(position)
    entries[i] = { tileId: lastId, offset: 0, length: 0, runLength: 0 }
  }
  for (let i = 0; i < count; i += 1) entries[i].runLength = readVarint(position)
  for (let i = 0; i < count; i += 1) entries[i].length = readVarint(position)
  for (let i = 0; i < count; i += 1) {
    const value = readVarint(position)
    if (value === 0 && i > 0) {
      entries[i].offset = entries[i - 1].offset + entries[i - 1].length
    } else {
      entries[i].offset = value - 1
    }
  }
  return entries
}

/** Read header + flattened tile entries + metadata object from a PMTiles v3 file. */
export function openArchive(path) {
  const fd = openSync(path, 'r')
  const headerBytes = readBytes(fd, 0, HEADER_SIZE)
  const header = bytesToHeader(headerBytes.buffer.slice(headerBytes.byteOffset, headerBytes.byteOffset + headerBytes.byteLength))
  const root = parseDirectory(decompress(
    readBytes(fd, header.rootDirectoryOffset, header.rootDirectoryLength),
    header.internalCompression,
  ))
  const entries = []
  for (const entry of root) {
    if (entry.runLength === 0) {
      const leaf = parseDirectory(decompress(
        readBytes(fd, header.leafDirectoryOffset + entry.offset, entry.length),
        header.internalCompression,
      ))
      for (const leafEntry of leaf) {
        if (leafEntry.runLength === 0) throw new Error('Nested leaf directories are not supported')
        entries.push(leafEntry)
      }
    } else {
      entries.push(entry)
    }
  }
  entries.sort((a, b) => a.tileId - b.tileId)
  const metadataRaw = decompress(
    readBytes(fd, header.jsonMetadataOffset, header.jsonMetadataLength),
    header.internalCompression,
  )
  const metadata = metadataRaw.length ? JSON.parse(metadataRaw.toString('utf8')) : {}
  return {
    fd,
    header,
    entries,
    metadata,
    readTileData(entry) {
      return readBytes(fd, header.tileDataOffset + entry.offset, entry.length)
    },
    close() {
      closeSync(fd)
    },
  }
}

// ---------------------------------------------------------------------------
// PMTiles v3 writing (same approach as scripts/build-contour-pmtiles.mjs,
// generalized: streamed tile data, optional leaf directories, gzip throughout)
// ---------------------------------------------------------------------------

function writeVarintBytes(value, out) {
  let n = BigInt(Math.round(value))
  if (n < 0n) throw new Error(`Cannot varint-encode negative value ${value}`)
  while (n > 0x7fn) {
    out.push(Number((n & 0x7fn) | 0x80n))
    n >>= 7n
  }
  out.push(Number(n))
}

export function serializeDirectory(entries) {
  const out = []
  writeVarintBytes(entries.length, out)
  let lastId = 0
  for (const entry of entries) {
    writeVarintBytes(entry.tileId - lastId, out)
    lastId = entry.tileId
  }
  for (const entry of entries) writeVarintBytes(entry.runLength, out)
  for (const entry of entries) writeVarintBytes(entry.length, out)
  let previousEnd = 0
  entries.forEach((entry, index) => {
    const isContiguous = index > 0 && entry.offset === previousEnd
    writeVarintBytes(isContiguous ? 0 : entry.offset + 1, out)
    previousEnd = entry.offset + entry.length
  })
  return Buffer.from(out)
}

function buildDirectories(entries) {
  // Small archives: a single root directory. Large archives: leaf directories
  // sized so the root stays well under the 16KB first-fetch recommendation.
  if (entries.length <= 16384) {
    return { rootDir: serializeDirectory(entries), leafDir: Buffer.alloc(0) }
  }
  const chunkSize = Math.max(4096, Math.ceil(entries.length / 2400))
  const leafDirectories = []
  const rootEntries = []
  let leafOffset = 0
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize)
    const directory = gzipSync(serializeDirectory(chunk))
    leafDirectories.push(directory)
    rootEntries.push({ tileId: chunk[0].tileId, offset: leafOffset, length: directory.length, runLength: 0 })
    leafOffset += directory.length
  }
  return { rootDir: serializeDirectory(rootEntries), leafDir: Buffer.concat(leafDirectories) }
}

function buildHeader(fields) {
  const header = Buffer.alloc(HEADER_SIZE)
  header.write('PMTiles', 0, 'ascii')
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  view.setUint8(7, 3)
  view.setBigUint64(8, BigInt(fields.rootDirectoryOffset), true)
  view.setBigUint64(16, BigInt(fields.rootDirectoryLength), true)
  view.setBigUint64(24, BigInt(fields.jsonMetadataOffset), true)
  view.setBigUint64(32, BigInt(fields.jsonMetadataLength), true)
  view.setBigUint64(40, BigInt(fields.leafDirectoryOffset), true)
  view.setBigUint64(48, BigInt(fields.leafDirectoryLength), true)
  view.setBigUint64(56, BigInt(fields.tileDataOffset), true)
  view.setBigUint64(64, BigInt(fields.tileDataLength), true)
  view.setBigUint64(72, BigInt(fields.numAddressedTiles), true)
  view.setBigUint64(80, BigInt(fields.numTileEntries), true)
  view.setBigUint64(88, BigInt(fields.numTileContents), true)
  view.setUint8(96, fields.clustered ? 1 : 0)
  view.setUint8(97, fields.internalCompression)
  view.setUint8(98, fields.tileCompression)
  view.setUint8(99, fields.tileType)
  view.setUint8(100, fields.minZoom)
  view.setUint8(101, fields.maxZoom)
  view.setInt32(102, Math.round(fields.minLon * 10_000_000), true)
  view.setInt32(106, Math.round(fields.minLat * 10_000_000), true)
  view.setInt32(110, Math.round(fields.maxLon * 10_000_000), true)
  view.setInt32(114, Math.round(fields.maxLat * 10_000_000), true)
  view.setUint8(118, fields.centerZoom)
  view.setInt32(119, Math.round(fields.centerLon * 10_000_000), true)
  view.setInt32(123, Math.round(fields.centerLat * 10_000_000), true)
  return header
}

function assembleArchive(outputPath, { entries, metadataBuffer, tileDataPath, tileDataLength, headerFields }) {
  const compressedMetadata = gzipSync(metadataBuffer)
  const { rootDir, leafDir } = buildDirectories(entries)
  const compressedRoot = gzipSync(rootDir)
  const rootDirectoryOffset = HEADER_SIZE
  const leafDirectoryOffset = rootDirectoryOffset + compressedRoot.length
  const jsonMetadataOffset = leafDirectoryOffset + leafDir.length
  const tileDataOffset = jsonMetadataOffset + compressedMetadata.length
  const header = buildHeader({
    ...headerFields,
    internalCompression: COMPRESSION_GZIP,
    rootDirectoryOffset,
    rootDirectoryLength: compressedRoot.length,
    leafDirectoryOffset,
    leafDirectoryLength: leafDir.length,
    jsonMetadataOffset,
    jsonMetadataLength: compressedMetadata.length,
    tileDataOffset,
    tileDataLength,
  })
  mkdirSync(dirname(outputPath), { recursive: true })
  const out = openSync(outputPath, 'w')
  try {
    writeSync(out, header)
    writeSync(out, compressedRoot)
    if (leafDir.length) writeSync(out, leafDir)
    writeSync(out, compressedMetadata)
    const source = openSync(tileDataPath, 'r')
    try {
      const chunk = Buffer.alloc(8 * 1024 * 1024)
      let position = 0
      for (;;) {
        const bytes = readSync(source, chunk, 0, chunk.length, position)
        if (bytes <= 0) break
        writeSync(out, chunk, 0, bytes)
        position += bytes
      }
      if (position !== tileDataLength) throw new Error(`Tile data length mismatch: wrote ${position}, expected ${tileDataLength}`)
    } finally {
      closeSync(source)
    }
  } finally {
    closeSync(out)
  }
}

/**
 * Test/fixture writer: build a PMTiles archive from uncompressed MVT tiles
 * [{ z, x, y, buffer }]. Tiles are gzip-compressed like Planetiler output.
 */
export function writePmtilesFromTiles(outputPath, tiles, options = {}) {
  const sorted = tiles
    .map(tile => ({ ...tile, tileId: zxyToTileId(tile.z, tile.x, tile.y) }))
    .sort((a, b) => a.tileId - b.tileId)
  const tileDataPath = `${outputPath}.tiledata.tmp`
  mkdirSync(dirname(resolve(tileDataPath)), { recursive: true })
  const fd = openSync(tileDataPath, 'w')
  const entries = []
  let offset = 0
  try {
    for (const tile of sorted) {
      const compressed = gzipSync(tile.buffer)
      writeSync(fd, compressed)
      entries.push({ tileId: tile.tileId, offset, length: compressed.length, runLength: 1 })
      offset += compressed.length
    }
  } finally {
    closeSync(fd)
  }
  const zooms = sorted.map(tile => tile.z)
  const metadata = Buffer.from(JSON.stringify(options.metadata ?? { vector_layers: [] }))
  assembleArchive(outputPath, {
    entries,
    metadataBuffer: metadata,
    tileDataPath,
    tileDataLength: offset,
    headerFields: {
      numAddressedTiles: entries.length,
      numTileEntries: entries.length,
      numTileContents: entries.length,
      clustered: true,
      tileCompression: COMPRESSION_GZIP,
      tileType: TILE_TYPE_MVT,
      minZoom: options.minZoom ?? Math.min(...zooms),
      maxZoom: options.maxZoom ?? Math.max(...zooms),
      minLon: options.bounds?.[0] ?? -180,
      minLat: options.bounds?.[1] ?? -85,
      maxLon: options.bounds?.[2] ?? 180,
      maxLat: options.bounds?.[3] ?? 85,
      centerZoom: options.centerZoom ?? Math.min(...zooms),
      centerLon: options.center?.[0] ?? 0,
      centerLat: options.center?.[1] ?? 0,
    },
  })
  unlinkSync(tileDataPath)
}

// ---------------------------------------------------------------------------
// Archive stamping
// ---------------------------------------------------------------------------

function updateMetadata(metadata) {
  const updated = { ...metadata, feature_id_scheme: FEATURE_ID_SCHEME }
  if (Array.isArray(updated.vector_layers)) {
    updated.vector_layers = updated.vector_layers.map((layer) => {
      if (!layer || !LABEL_LAYERS.has(layer.id)) return layer
      return { ...layer, fields: { ...(layer.fields ?? {}), rm_id: 'String' } }
    })
  }
  return updated
}

/**
 * Rewrite a PMTiles archive with rm_id stamped onto label layers.
 * Returns processing stats.
 */
export function stampPmtilesArchive(inputPath, outputPath, options = {}) {
  const log = options.quiet ? () => {} : message => console.log(message)
  const archive = openArchive(inputPath)
  const { header, entries, metadata } = archive
  try {
    if (header.tileType !== TILE_TYPE_MVT) {
      throw new Error(`Expected an MVT PMTiles archive, got tile type ${header.tileType}`)
    }
    if (header.tileCompression !== COMPRESSION_GZIP && header.tileCompression !== COMPRESSION_NONE && header.tileCompression !== 0) {
      throw new Error(`Unsupported tile compression ${header.tileCompression}; expected gzip or none`)
    }
    const gzipTiles = header.tileCompression === COMPRESSION_GZIP

    const tileDataPath = `${outputPath}.tiledata.tmp`
    const out = openSync(tileDataPath, 'w')
    const stats = {
      scheme: FEATURE_ID_SCHEME,
      input: inputPath,
      output: outputPath,
      tileEntries: entries.length,
      uniqueBlobs: 0,
      stampedTiles: 0,
      stampedFeatures: 0,
      skippedNamelessFeatures: 0,
      passthroughBlobs: 0,
      sharedLabelRunLengthEntries: 0,
    }
    const newEntries = new Array(entries.length)
    // input blob -> { passthrough: true, offset, length } when the blob has no
    // stampable content (output bytes === input bytes, location-independent).
    const pureCache = new Map()
    // label-bearing blobs depend on tile z/x/y (geohash), so cache per placement.
    const stampedCache = new Map()
    let outOffset = 0
    let numAddressedTiles = 0

    const writeBlob = (buffer) => {
      writeSync(out, buffer)
      const blob = { offset: outOffset, length: buffer.length }
      outOffset += buffer.length
      stats.uniqueBlobs += 1
      return blob
    }

    try {
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]
        numAddressedTiles += Math.max(entry.runLength, 1)
        const inputKey = `${entry.offset},${entry.length}`
        let blob = pureCache.get(inputKey)
        if (!blob) {
          const [z, x, y] = tileIdToZxy(entry.tileId)
          const placedKey = `${inputKey}@${z}/${x}/${y}`
          blob = stampedCache.get(placedKey)
          if (!blob) {
            const compressed = archive.readTileData(entry)
            const raw = gzipTiles ? gunzipSync(compressed) : compressed
            const result = stampTileBuffer(raw, { z, x, y })
            if (result.changed) {
              if (entry.runLength > 1) stats.sharedLabelRunLengthEntries += 1
              stats.stampedTiles += 1
              stats.stampedFeatures += result.stamped
              stats.skippedNamelessFeatures += result.skipped
              blob = writeBlob(gzipTiles ? gzipSync(result.buffer) : result.buffer)
              stampedCache.set(placedKey, blob)
            } else {
              stats.skippedNamelessFeatures += result.skipped
              stats.passthroughBlobs += 1
              blob = writeBlob(compressed)
              pureCache.set(inputKey, blob)
            }
          }
        }
        newEntries[i] = { tileId: entry.tileId, offset: blob.offset, length: blob.length, runLength: entry.runLength }
        if (!options.quiet && entries.length > 50000 && i % 50000 === 0 && i > 0) {
          log(JSON.stringify({ featureIds: { progress: i, of: entries.length } }))
        }
      }

      const metadataBuffer = Buffer.from(JSON.stringify(updateMetadata(metadata)))
      assembleArchive(outputPath, {
        entries: newEntries,
        metadataBuffer,
        tileDataPath,
        tileDataLength: outOffset,
        headerFields: {
          numAddressedTiles,
          numTileEntries: newEntries.length,
          numTileContents: stats.uniqueBlobs,
          clustered: header.clustered,
          tileCompression: header.tileCompression,
          tileType: header.tileType,
          minZoom: header.minZoom,
          maxZoom: header.maxZoom,
          minLon: header.minLon,
          minLat: header.minLat,
          maxLon: header.maxLon,
          maxLat: header.maxLat,
          centerZoom: header.centerZoom,
          centerLon: header.centerLon,
          centerLat: header.centerLat,
        },
      })
    } finally {
      closeSync(out)
      try {
        unlinkSync(tileDataPath)
      } catch { /* already removed by assembleArchive failure paths */ }
    }
    stats.outputBytes = statSync(outputPath).size
    log(JSON.stringify({ featureIds: stats }, null, 2))
    return stats
  } finally {
    archive.close()
  }
}

// ---------------------------------------------------------------------------
// Stability diff — compares rm_id populations across two archive builds.
// This is what gets run across two consecutive real region builds (different
// OSM extract dates) to verify id stability before E5 consumes the scheme.
// ---------------------------------------------------------------------------

export function collectRmIds(path) {
  const archive = openArchive(path)
  const idsByLayer = new Map()
  try {
    const gzipTiles = archive.header.tileCompression === COMPRESSION_GZIP
    const seenBlobs = new Set()
    for (const entry of archive.entries) {
      const inputKey = `${entry.offset},${entry.length}`
      if (seenBlobs.has(inputKey)) continue
      seenBlobs.add(inputKey)
      const compressed = archive.readTileData(entry)
      const raw = gzipTiles ? gunzipSync(compressed) : compressed
      const segments = splitTileLayers(raw)
      if (!segments.some(segment => segment.kind === 'layer' && LABEL_LAYERS.has(segment.name))) continue
      const decoded = new VectorTile(new Protobuf(raw))
      for (const layerName of Object.keys(decoded.layers)) {
        if (!LABEL_LAYERS.has(layerName)) continue
        const layer = decoded.layers[layerName]
        let ids = idsByLayer.get(layerName)
        if (!ids) {
          ids = new Set()
          idsByLayer.set(layerName, ids)
        }
        for (let i = 0; i < layer.length; i += 1) {
          const rmId = layer.feature(i).properties?.rm_id
          if (typeof rmId === 'string') ids.add(rmId)
        }
      }
    }
  } finally {
    archive.close()
  }
  return idsByLayer
}

export function diffArchiveIds(oldPath, newPath) {
  const oldIds = collectRmIds(oldPath)
  const newIds = collectRmIds(newPath)
  const layers = {}
  const layerNames = new Set([...oldIds.keys(), ...newIds.keys()])
  let totalOld = 0
  let totalNew = 0
  let totalShared = 0
  for (const layerName of [...layerNames].sort()) {
    const before = oldIds.get(layerName) ?? new Set()
    const after = newIds.get(layerName) ?? new Set()
    let shared = 0
    for (const id of before) if (after.has(id)) shared += 1
    layers[layerName] = {
      old: before.size,
      new: after.size,
      shared,
      overlapPctOfOld: before.size ? Number(((shared / before.size) * 100).toFixed(2)) : null,
    }
    totalOld += before.size
    totalNew += after.size
    totalShared += shared
  }
  return {
    old: oldPath,
    new: newPath,
    layers,
    total: {
      old: totalOld,
      new: totalNew,
      shared: totalShared,
      overlapPctOfOld: totalOld ? Number(((totalShared / totalOld) * 100).toFixed(2)) : null,
    },
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = { diff: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') parsed.input = argv[++i]
    else if (arg === '--output') parsed.output = argv[++i]
    else if (arg === '--in-place') parsed.inPlace = true
    else if (arg === '--quiet') parsed.quiet = true
    else if (arg === '--diff') parsed.diff = [argv[++i], argv[++i]]
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  node scripts/atlas-add-feature-ids.mjs --input <base.pmtiles> --output <stamped.pmtiles>
  node scripts/atlas-add-feature-ids.mjs --input <base.pmtiles> --in-place
  node scripts/atlas-add-feature-ids.mjs --diff <old.pmtiles> <new.pmtiles>

Stamps content-derived rm_id (${FEATURE_ID_SCHEME}) onto label-layer features
(${[...LABEL_LAYERS].join(', ')}). Idempotent; non-label layers byte-identical.
--diff reports rm_id overlap between two stamped builds (stability check).`)
      process.exit(0)
    }
  }
  return parsed
}

function runCli() {
  const args = parseArgs(process.argv.slice(2))
  if (args.diff) {
    const [oldPath, newPath] = args.diff
    if (!oldPath || !newPath) throw new Error('--diff requires two archive paths')
    console.log(JSON.stringify(diffArchiveIds(resolve(oldPath), resolve(newPath)), null, 2))
    return
  }
  if (!args.input) throw new Error('Missing --input <archive.pmtiles> (or --diff <old> <new>)')
  const input = resolve(args.input)
  if (args.inPlace) {
    const staging = `${input}.stamped.tmp`
    stampPmtilesArchive(input, staging, { quiet: args.quiet })
    renameSync(staging, input)
    console.log(JSON.stringify({ featureIds: { inPlace: input } }))
    return
  }
  if (!args.output) throw new Error('Missing --output <archive.pmtiles> (or pass --in-place)')
  stampPmtilesArchive(input, resolve(args.output), { quiet: args.quiet })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli()
}
