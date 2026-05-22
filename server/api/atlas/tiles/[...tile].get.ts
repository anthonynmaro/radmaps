import { PMTiles } from 'pmtiles'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
// @ts-expect-error vt-pbf does not publish bundled TypeScript declarations.
import vtpbf from 'vt-pbf'
import type { AtlasArtifactKey, AtlasManifest, AtlasManifestArtifact } from '~/utils/atlasManifest'
import {
  atlasArtifactIntersectsBbox,
  atlasManifestArtifacts,
  atlasTileToBbox,
  findAtlasArtifact,
  selectAtlasArtifactForTile,
} from '~/utils/atlasManifest'

const DEFAULT_BASE_URL = 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles'
const ALLOWED_TILE_URL_PREFIXES = [
  'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/',
  'https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/',
]
const EMPTY_BASE_TILE = Buffer.from(vtpbf.fromGeojsonVt(Object.fromEntries([
  'landcover',
  'landuse',
  'mountain_peak',
  'park',
  'place',
  'transportation',
  'transportation_name',
  'water',
  'water_name',
  'waterway',
  'building',
  'poi',
].map(layer => [layer, { features: [] }]))))
const EMPTY_TERRAIN_TILE = Buffer.from(vtpbf.fromGeojsonVt({
  contour: { features: [] },
}))

const globalForAtlasTiles = globalThis as unknown as {
  __radmapsAtlasPmtilesCache?: Map<string, PMTiles>
  __radmapsAtlasManifestCache?: Map<string, AtlasManifest>
}

function pmtilesCache() {
  globalForAtlasTiles.__radmapsAtlasPmtilesCache ??= new Map<string, PMTiles>()
  return globalForAtlasTiles.__radmapsAtlasPmtilesCache
}

function manifestCache() {
  globalForAtlasTiles.__radmapsAtlasManifestCache ??= new Map<string, AtlasManifest>()
  return globalForAtlasTiles.__radmapsAtlasManifestCache
}

function tilePathParts(event: Parameters<typeof getRouterParam>[0]) {
  const tile = getRouterParam(event, 'tile') || ''
  const parts = tile.split('/').filter(Boolean)
  if (parts.length !== 4) {
    throw createError({ statusCode: 404, message: 'Atlas tile not found' })
  }
  return parts
}

function numericTilePart(value: string, name: string) {
  const numericValue = Number(value.replace(/\.mvt$/, ''))
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw createError({ statusCode: 400, message: `Invalid tile ${name}` })
  }
  return numericValue
}

function validateTileRange(z: number, x: number, y: number) {
  if (z > 24) {
    throw createError({ statusCode: 400, message: 'Atlas tile zoom too high' })
  }
  const max = 2 ** z
  if (x >= max || y >= max) {
    throw createError({ statusCode: 400, message: 'Atlas tile coordinate outside zoom range' })
  }
}

async function loadLocalManifest(environment: string) {
  if (environment !== 'staging' && environment !== 'production') {
    throw createError({ statusCode: 400, message: 'Unsupported atlas environment' })
  }
  const cache = manifestCache()
  const cached = cache.get(environment)
  if (cached) return cached

  const file = resolve(process.cwd(), 'public/atlas/manifests', `${environment}.json`)
  const manifest = JSON.parse(await readFile(file, 'utf8')) as AtlasManifest
  cache.set(environment, manifest)
  return manifest
}

function artifactKindForSource(source: string): AtlasArtifactKey {
  return source === 'terrain' ? 'contours' : 'base'
}

async function artifactFromQuery(
  event: Parameters<typeof getRouterParam>[0],
  source: string,
  z: number,
  x: number,
  y: number,
): Promise<AtlasManifestArtifact | null> {
  const query = getQuery(event)
  const environment = typeof query.environment === 'string' && query.environment.trim()
    ? query.environment.trim()
    : 'staging'
  const artifactId = typeof query.artifactId === 'string' ? query.artifactId.trim() : ''
  const manifest = await loadLocalManifest(environment)
  if (artifactId) {
    const artifact = findAtlasArtifact(manifest, artifactId)
    if (!artifact) {
      throw createError({ statusCode: 404, message: 'Atlas artifact not found' })
    }
    return artifact
  }

  const artifacts = atlasManifestArtifacts(manifest, artifactKindForSource(source))
  if (!artifacts.length) return null
  const artifact = selectAtlasArtifactForTile(artifacts, z, x, y)
  if (!artifact) {
    throw createError({ statusCode: 404, message: 'Atlas tile outside available coverage' })
  }
  return artifact
}

function validateArtifactTile(
  artifact: AtlasManifestArtifact | null,
  z: number,
  x: number,
  y: number,
) {
  if (!artifact) return
  const minzoom = artifact.minzoom ?? 0
  const maxzoom = artifact.maxzoom ?? 24
  if (z < minzoom || z > maxzoom) {
    throw createError({ statusCode: 400, message: 'Atlas tile zoom outside artifact range' })
  }
  if (artifact.bounds && !atlasArtifactIntersectsBbox(artifact, atlasTileToBbox(z, x, y))) {
    throw createError({ statusCode: 404, message: 'Atlas tile outside artifact bounds' })
  }
}

async function normalizeTileUrl(
  event: Parameters<typeof getRouterParam>[0],
  source: string,
  z: number,
  x: number,
  y: number,
) {
  const query = getQuery(event)
  const requestedUrl = typeof query.url === 'string' && query.url.trim() ? query.url.trim() : ''

  if (requestedUrl) {
    if (!import.meta.dev) {
      throw createError({ statusCode: 400, message: 'Direct atlas tile URLs are dev-only' })
    }

    const isAllowedRemote = ALLOWED_TILE_URL_PREFIXES.some(prefix => requestedUrl.startsWith(prefix))
    const isAllowedLocal = /^https?:\/\/localhost:\d+\/atlas\//.test(requestedUrl)
    if (!isAllowedRemote && !isAllowedLocal) {
      throw createError({ statusCode: 400, message: 'Unsupported atlas tile URL' })
    }
    return requestedUrl
  }

  const artifact = await artifactFromQuery(event, source, z, x, y)
  validateArtifactTile(artifact, z, x, y)
  return artifact?.url || DEFAULT_BASE_URL
}

function getPmtiles(url: string) {
  const cache = pmtilesCache()
  const cached = cache.get(url)
  if (cached) return cached

  const pmtiles = new PMTiles(url)
  cache.set(url, pmtiles)
  return pmtiles
}

export default defineEventHandler(async (event) => {
  const [source, zPart, xPart, yPart] = tilePathParts(event)
  if (source !== 'base' && source !== 'terrain') {
    throw createError({ statusCode: 404, message: 'Unknown atlas tile source' })
  }

  const z = numericTilePart(zPart, 'z')
  const x = numericTilePart(xPart, 'x')
  const y = numericTilePart(yPart, 'y')
  validateTileRange(z, x, y)
  const pmtiles = getPmtiles(await normalizeTileUrl(event, source, z, x, y))
  const tile = await pmtiles.getZxy(z, x, y)

  if (!tile) {
    // MapLibre treats 204/empty vector tile responses as console errors. Return
    // a valid empty MVT containing the expected source layers so sparse PMTiles
    // archives and overscanned map views stay quiet during local QA.
    const emptyTile = source === 'terrain' ? EMPTY_TERRAIN_TILE : EMPTY_BASE_TILE
    setHeader(event, 'Content-Type', 'application/x-protobuf')
    setHeader(event, 'Content-Length', emptyTile.byteLength)
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    return emptyTile
  }

  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Content-Length', tile.data.byteLength)
  setHeader(event, 'Cache-Control', tile.cacheControl || 'public, max-age=31536000, immutable')
  return Buffer.from(tile.data)
})
