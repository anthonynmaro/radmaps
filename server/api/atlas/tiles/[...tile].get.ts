import { PMTiles } from 'pmtiles'

const DEFAULT_BASE_URL = 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles'
const ALLOWED_TILE_URL_PREFIXES = [
  'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/',
  'https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/',
]

const globalForAtlasTiles = globalThis as unknown as {
  __radmapsAtlasPmtilesCache?: Map<string, PMTiles>
}

function pmtilesCache() {
  globalForAtlasTiles.__radmapsAtlasPmtilesCache ??= new Map<string, PMTiles>()
  return globalForAtlasTiles.__radmapsAtlasPmtilesCache
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

function normalizeTileUrl(event: Parameters<typeof getRouterParam>[0]) {
  const query = getQuery(event)
  const requestedUrl = typeof query.url === 'string' && query.url.trim()
    ? query.url.trim()
    : DEFAULT_BASE_URL

  const isAllowedRemote = ALLOWED_TILE_URL_PREFIXES.some(prefix => requestedUrl.startsWith(prefix))
  const isAllowedLocal = import.meta.dev && /^https?:\/\/localhost:\d+\/atlas\//.test(requestedUrl)
  if (!isAllowedRemote && !isAllowedLocal) {
    throw createError({ statusCode: 400, message: 'Unsupported atlas tile URL' })
  }

  return requestedUrl
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
  const pmtiles = getPmtiles(normalizeTileUrl(event))
  const tile = await pmtiles.getZxy(z, x, y)

  if (!tile) {
    setResponseStatus(event, 204)
    return ''
  }

  setHeader(event, 'Content-Type', 'application/x-protobuf')
  setHeader(event, 'Content-Length', tile.data.byteLength)
  setHeader(event, 'Cache-Control', tile.cacheControl || 'public, max-age=31536000, immutable')
  return Buffer.from(tile.data)
})
