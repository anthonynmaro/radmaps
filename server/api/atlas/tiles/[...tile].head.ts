import type { AtlasArtifactKey, AtlasManifest, AtlasManifestArtifact } from '~/utils/atlasManifest'
import {
  atlasArtifactIntersectsBbox,
  atlasManifestArtifacts,
  atlasTileToBbox,
  findAtlasArtifact,
  selectAtlasArtifactForTile,
} from '~/utils/atlasManifest'

const DEFAULT_HOSTED_TILE_BASE_URL = 'https://tiles.radmaps.studio'
const PUBLIC_MANIFEST_URLS = {
  staging: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/manifests/staging.json',
  production: 'https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/manifests/production.json',
} as const
const EMPTY_TILE_LENGTH_BY_SOURCE = {
  terrain: 16,
  poi: 12,
  outdoorRoutes: 22,
} as const

type AtlasTileSource = 'base' | 'terrain' | 'poi' | 'outdoorRoutes'

const globalForAtlasTileHeads = globalThis as unknown as {
  __radmapsAtlasHeadManifestCache?: Map<string, AtlasManifest>
}

function manifestCache() {
  globalForAtlasTileHeads.__radmapsAtlasHeadManifestCache ??= new Map<string, AtlasManifest>()
  return globalForAtlasTileHeads.__radmapsAtlasHeadManifestCache
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
  return ['base', 'contours', 'hillshade', 'publicLands', 'poi', 'outdoorRoutes'].includes(artifact.kind)
    ? artifact.kind as AtlasArtifactKey
    : 'other'
}

function atlasEnvironmentFromQuery(event: Parameters<typeof getRouterParam>[0]) {
  const query = getQuery(event)
  return typeof query.environment === 'string' && query.environment.trim()
    ? query.environment.trim()
    : 'production'
}

async function artifactFromQuery(
  event: Parameters<typeof getRouterParam>[0],
  source: AtlasTileSource,
  z: number,
  x: number,
  y: number,
): Promise<AtlasManifestArtifact | null> {
  const query = getQuery(event)
  const environment = atlasEnvironmentFromQuery(event)
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

function emptyTileHeadResponse(event: Parameters<typeof getRouterParam>[0], source: AtlasTileSource) {
  setResponseStatus(event, 200)
  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Content-Length', EMPTY_TILE_LENGTH_BY_SOURCE[source as keyof typeof EMPTY_TILE_LENGTH_BY_SOURCE] ?? 0)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  setHeader(event, 'X-RadMaps-Atlas-Delivery', 'empty')
  return ''
}

async function hostedTileHeadResponse(
  event: Parameters<typeof getRouterParam>[0],
  environment: string,
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
  const response = await fetch(tileUrl, { method: 'HEAD' })
  if (!response.ok) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      message: `Hosted atlas tile fetch failed: ${response.status}`,
    })
  }

  setResponseStatus(event, 200)
  setHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/x-protobuf')
  const contentLength = response.headers.get('content-length')
  if (contentLength) setHeader(event, 'Content-Length', Number(contentLength))
  setHeader(event, 'Cache-Control', response.headers.get('cache-control') || 'public, max-age=86400')
  setHeader(event, 'X-RadMaps-Atlas-Environment', environment)
  setHeader(event, 'X-RadMaps-Atlas-Artifact', artifact.id)
  setHeader(event, 'X-RadMaps-Atlas-Delivery', 'nuxt-proxy')
  return ''
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

  const environment = atlasEnvironmentFromQuery(event)
  const artifact = await artifactFromQuery(event, source, z, x, y)
  validateArtifactTile(artifact, z, x, y)
  if (!artifact) return emptyTileHeadResponse(event, source)

  return hostedTileHeadResponse(event, environment, artifact, z, x, y)
})
