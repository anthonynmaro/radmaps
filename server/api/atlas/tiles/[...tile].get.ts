import { PMTiles } from 'pmtiles'
// @ts-expect-error vt-pbf does not publish bundled TypeScript declarations.
import vtpbf from 'vt-pbf'
import type { AtlasArtifactKey, AtlasManifest, AtlasManifestArtifact } from '~/utils/atlasManifest'
import {
  ATLAS_ARTIFACT_KEYS,
  atlasArtifactIntersectsBbox,
  atlasManifestArtifacts,
  atlasTileToBbox,
  findAtlasArtifact,
  selectAtlasArtifactForTile,
} from '~/utils/atlasManifest'

const DEFAULT_BASE_URL = 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles'
const DEFAULT_HOSTED_TILE_BASE_URL = 'https://tiles.radmaps.studio'
const PUBLIC_MANIFEST_URLS = {
  staging: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/manifests/staging.json',
  production: 'https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/manifests/production.json',
} as const
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
const EMPTY_POI_TILE = Buffer.from(vtpbf.fromGeojsonVt({
  poi: { features: [] },
}))
const EMPTY_OUTDOOR_ROUTES_TILE = Buffer.from(vtpbf.fromGeojsonVt({
  outdoor_route: { features: [] },
}))

type AtlasTileSource = 'base' | 'terrain' | 'poi' | 'outdoorRoutes'

// The terrain source is retained for Admin Atlas Lab QA of cached contour
// artifacts. Product MapPreview/proof/final renders use maplibre-contour at
// runtime instead of this PMTiles path.

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

function assertAtlasEnvironment(environment: string): asserts environment is keyof typeof PUBLIC_MANIFEST_URLS {
  if (!(environment in PUBLIC_MANIFEST_URLS)) {
    throw createError({ statusCode: 400, message: 'Unsupported atlas environment' })
  }
}

async function loadAtlasManifest(environment: string) {
  assertAtlasEnvironment(environment)

  const cache = manifestCache()
  const cached = cache.get(environment)
  if (cached) return cached

  const response = await fetch(PUBLIC_MANIFEST_URLS[environment], {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: `Atlas manifest fetch failed: ${response.status}`,
    })
  }
  const manifest = await response.json() as AtlasManifest
  cache.set(environment, manifest)
  return manifest
}

function isAtlasTileSource(source: string): source is AtlasTileSource {
  return source === 'base' || source === 'terrain' || source === 'poi' || source === 'outdoorRoutes'
}

function artifactKindForSource(source: AtlasTileSource): AtlasArtifactKey {
  if (source === 'terrain') return 'contours'
  if (source === 'poi') return 'poi'
  if (source === 'outdoorRoutes') return 'outdoorRoutes'
  return 'base'
}

function normalizedManifestArtifactKind(artifact: AtlasManifestArtifact): AtlasArtifactKey | 'other' {
  if (artifact.kind === 'terrain') return 'contours'
  return (ATLAS_ARTIFACT_KEYS as readonly string[]).includes(artifact.kind)
    ? artifact.kind as AtlasArtifactKey
    : 'other'
}

async function artifactFromQuery(
  event: Parameters<typeof getRouterParam>[0],
  source: AtlasTileSource,
  z: number,
  x: number,
  y: number,
): Promise<AtlasManifestArtifact | null> {
  const query = getQuery(event)
  const environment = typeof query.environment === 'string' && query.environment.trim()
    ? query.environment.trim()
    : 'production'
  const artifactId = typeof query.artifactId === 'string' ? query.artifactId.trim() : ''
  const manifest = await loadAtlasManifest(environment)
  if (artifactId) {
    const artifact = findAtlasArtifact(manifest, artifactId)
    if (!artifact) {
      throw createError({ statusCode: 404, message: 'Atlas artifact not found' })
    }
    if (normalizedManifestArtifactKind(artifact) !== artifactKindForSource(source)) {
      throw createError({ statusCode: 400, message: 'Atlas artifact kind does not match requested source' })
    }
    return artifact
  }

  const artifacts = atlasManifestArtifacts(manifest, artifactKindForSource(source))
  if (!artifacts.length) return null
  const artifact = selectAtlasArtifactForTile(artifacts, z, x, y)
  if (!artifact) {
    if (source !== 'base') return null
    throw createError({ statusCode: 404, message: 'Atlas tile outside available coverage' })
  }
  return artifact
}

function emptyTileForSource(source: AtlasTileSource) {
  if (source === 'terrain') return EMPTY_TERRAIN_TILE
  if (source === 'poi') return EMPTY_POI_TILE
  if (source === 'outdoorRoutes') return EMPTY_OUTDOOR_ROUTES_TILE
  return EMPTY_BASE_TILE
}

function emptyTileResponse(
  event: Parameters<typeof getRouterParam>[0],
  source: AtlasTileSource,
  metadata: { environment?: string, artifactId?: string } = {},
) {
  const emptyTile = emptyTileForSource(source)
  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Content-Length', emptyTile.byteLength)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  if (metadata.environment) setHeader(event, 'X-RadMaps-Atlas-Environment', metadata.environment)
  if (metadata.artifactId) setHeader(event, 'X-RadMaps-Atlas-Artifact', metadata.artifactId)
  setHeader(event, 'X-RadMaps-Atlas-Delivery', 'empty')
  return emptyTile
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

function atlasEnvironmentFromQuery(event: Parameters<typeof getRouterParam>[0]) {
  const query = getQuery(event)
  return typeof query.environment === 'string' && query.environment.trim()
    ? query.environment.trim()
    : 'production'
}

function requestedPmtilesUrlFromQuery(event: Parameters<typeof getRouterParam>[0]) {
  const query = getQuery(event)
  return typeof query.url === 'string' && query.url.trim() ? query.url.trim() : ''
}

function normalizeRequestedTileUrl(event: Parameters<typeof getRouterParam>[0]) {
  const requestedUrl = requestedPmtilesUrlFromQuery(event)

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

  return ''
}

async function hostedTileResponse(
  event: Parameters<typeof getRouterParam>[0],
  environment: string,
  source: AtlasTileSource,
  artifact: AtlasManifestArtifact,
  z: number,
  x: number,
  y: number,
) {
  const runtimeConfig = useRuntimeConfig()
  const configuredBaseUrl = typeof runtimeConfig.public.radmapsAtlasTileBaseUrl === 'string'
    ? runtimeConfig.public.radmapsAtlasTileBaseUrl.trim()
    : ''
  const tileBaseUrl = (configuredBaseUrl || DEFAULT_HOSTED_TILE_BASE_URL).replace(/\/$/, '')
  const tileUrl = `${tileBaseUrl}/tiles/${encodeURIComponent(environment)}/${encodeURIComponent(artifact.id)}/${z}/${x}/${y}.mvt`
  const response = await fetch(tileUrl)
  if (response.status === 204) {
    return emptyTileResponse(event, source, { environment, artifactId: artifact.id })
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      message: `Hosted atlas tile fetch failed: ${response.status}`,
    })
  }

  const data = Buffer.from(await response.arrayBuffer())
  setHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/x-protobuf')
  setHeader(event, 'Content-Length', data.byteLength)
  setHeader(event, 'Cache-Control', response.headers.get('cache-control') || 'public, max-age=86400')
  setHeader(event, 'X-RadMaps-Atlas-Environment', environment)
  setHeader(event, 'X-RadMaps-Atlas-Artifact', artifact.id)
  setHeader(event, 'X-RadMaps-Atlas-Delivery', 'nuxt-proxy')
  return data
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
  if (!isAtlasTileSource(source)) {
    throw createError({ statusCode: 404, message: 'Unknown atlas tile source' })
  }

  const z = numericTilePart(zPart, 'z')
  const x = numericTilePart(xPart, 'x')
  const y = numericTilePart(yPart, 'y')
  validateTileRange(z, x, y)
  const requestedUrl = normalizeRequestedTileUrl(event)

  if (!requestedUrl) {
    const environment = atlasEnvironmentFromQuery(event)
    const artifact = await artifactFromQuery(event, source, z, x, y)
    validateArtifactTile(artifact, z, x, y)
    if (artifact) {
      return hostedTileResponse(event, environment, source, artifact, z, x, y)
    }
    if (source !== 'base') return emptyTileResponse(event, source)
  }

  const pmtiles = getPmtiles(requestedUrl || DEFAULT_BASE_URL)
  const tile = await pmtiles.getZxy(z, x, y)

  if (!tile) {
    // MapLibre treats 204/empty vector tile responses as console errors. Return
    // a valid empty MVT containing the expected source layers so sparse PMTiles
    // archives and overscanned map views stay quiet during local QA.
    return emptyTileResponse(event, source)
  }

  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Content-Length', tile.data.byteLength)
  setHeader(event, 'Cache-Control', tile.cacheControl || 'public, max-age=31536000, immutable')
  return Buffer.from(tile.data)
})
