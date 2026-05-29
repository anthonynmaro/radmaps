import {
  WATERCOLOR_ATLAS_MAXZOOM,
  WATERCOLOR_RECIPE_ID,
  WATERCOLOR_RENDERER_VERSION,
  WATERCOLOR_TEXTURE_PACK_VERSION,
  WATERCOLOR_TILE_SIZE,
} from '~/utils/watercolor/constants'
import { extractWatercolorGeometry } from '~/utils/watercolor/geometryExtractor'
import { encodeWatercolorArtTilePng } from '~/utils/watercolor/artTileComposer'
import type { WatercolorFeature, WatercolorPalette } from '~/utils/watercolor/types'

type QueryRecord = Record<string, unknown>

function tilePathParts(event: Parameters<typeof getRouterParam>[0]) {
  const tile = getRouterParam(event, 'tile') || ''
  const parts = tile.split('/').filter(Boolean)
  if (parts.length !== 4 || parts[0] !== 'base') {
    throw createError({ statusCode: 404, message: 'Watercolor tile not found' })
  }
  return parts
}

function numericTilePart(value: string, name: string) {
  const numericValue = Number(value.replace(/\.png$/, ''))
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw createError({ statusCode: 400, message: `Invalid watercolor tile ${name}` })
  }
  return numericValue
}

function validateTileRange(z: number, x: number, y: number) {
  if (z > 24) {
    throw createError({ statusCode: 400, message: 'Watercolor tile zoom too high' })
  }
  const max = 2 ** z
  if (x >= max || y >= max) {
    throw createError({ statusCode: 400, message: 'Watercolor tile coordinate outside zoom range' })
  }
}

function sourceTileForRequest(z: number, x: number, y: number) {
  const sourceZ = Math.min(z, WATERCOLOR_ATLAS_MAXZOOM)
  if (sourceZ === z) return { z, x, y }
  const scale = 2 ** (z - sourceZ)
  return {
    z: sourceZ,
    x: Math.floor(x / scale),
    y: Math.floor(y / scale),
  }
}

function cleanQueryValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function cleanHexColor(value: unknown) {
  const raw = cleanQueryValue(value)
  if (!raw) return undefined
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : undefined
}

function paletteFromQuery(query: QueryRecord): Partial<WatercolorPalette> {
  const palette: Partial<WatercolorPalette> = {}
  const water = cleanHexColor(query.water)
  const park = cleanHexColor(query.park)
  const waterway = cleanHexColor(query.waterway)
  const roadMajor = cleanHexColor(query.roadMajor)
  const roadMinor = cleanHexColor(query.roadMinor)
  const trail = cleanHexColor(query.trail)
  if (water) palette.water = water
  if (park) palette.park = park
  if (waterway) palette.waterway = waterway
  if (roadMajor) palette.roadMajor = roadMajor
  if (roadMinor) palette.roadMinor = roadMinor
  if (trail) palette.trail = trail
  return palette
}

function enabledLayersFromQuery(query: QueryRecord) {
  const rawLayers = cleanQueryValue(query.layers)
  const layers = rawLayers
    ? rawLayers.split(',').map(layer => layer.trim()).filter(Boolean)
    : ['water', 'park', 'waterway', 'building', 'transportation']
  return new Set(layers)
}

function featureEnabled(feature: WatercolorFeature, enabledLayers: Set<string>) {
  if (feature.group === 'water') return enabledLayers.has('water')
  if (feature.group === 'park') return enabledLayers.has('park')
  if (feature.group === 'waterway') return enabledLayers.has('waterway')
  if (feature.group === 'building') return enabledLayers.has('building')
  if (feature.group === 'road-major' || feature.group === 'road-minor' || feature.group === 'trail') {
    return enabledLayers.has('transportation')
  }
  return false
}

async function fetchAtlasMvt(
  event: Parameters<typeof getRouterParam>[0],
  sourceTile: { z: number, x: number, y: number },
) {
  const query = getQuery(event) as QueryRecord
  const requestUrl = getRequestURL(event)
  const atlasUrl = new URL(`/api/atlas/tiles/base/${sourceTile.z}/${sourceTile.x}/${sourceTile.y}.mvt`, requestUrl.origin)
  atlasUrl.searchParams.set('environment', cleanQueryValue(query.environment) || 'production')
  const artifactId = cleanQueryValue(query.artifactId)
  if (artifactId) atlasUrl.searchParams.set('artifactId', artifactId)
  const response = await fetch(atlasUrl)
  if (!response.ok) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      message: `Atlas tile fetch for watercolor failed: ${response.status}`,
    })
  }
  return Buffer.from(await response.arrayBuffer())
}

export default defineEventHandler(async (event) => {
  const [, zPart, xPart, yPart] = tilePathParts(event)
  const z = numericTilePart(zPart, 'z')
  const x = numericTilePart(xPart, 'x')
  const y = numericTilePart(yPart, 'y')
  validateTileRange(z, x, y)

  const query = getQuery(event) as QueryRecord
  const scale = Number(cleanQueryValue(query.scale) || '2')
  if (!Number.isFinite(scale) || scale !== 2) {
    throw createError({ statusCode: 400, message: 'Watercolor tiles currently require scale=2' })
  }

  const sourceTile = sourceTileForRequest(z, x, y)
  const mvt = await fetchAtlasMvt(event, sourceTile)
  const seed = cleanQueryValue(query.seed) || 'radmaps-watercolor'
  const recipe = cleanQueryValue(query.recipe) || WATERCOLOR_RECIPE_ID
  const geometry = extractWatercolorGeometry(mvt, {
    requestTile: { z, x, y },
    sourceTile,
    tileSize: WATERCOLOR_TILE_SIZE,
  })
  const enabledLayers = enabledLayersFromQuery(query)
  const filteredGeometry = {
    ...geometry,
    features: geometry.features.filter(feature => featureEnabled(feature, enabledLayers)),
  }
  const png = await encodeWatercolorArtTilePng(filteredGeometry, {
    seed: `${recipe}:${seed}`,
    tileSize: WATERCOLOR_TILE_SIZE,
    palette: paletteFromQuery(query),
  })

  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Content-Length', png.byteLength)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'X-RadMaps-Watercolor-Renderer', WATERCOLOR_RENDERER_VERSION)
  setHeader(event, 'X-RadMaps-Watercolor-Texture-Pack', WATERCOLOR_TEXTURE_PACK_VERSION)
  setHeader(event, 'X-RadMaps-Watercolor-Recipe', recipe)
  setHeader(event, 'X-RadMaps-Watercolor-Source-Z', String(sourceTile.z))
  return png
})
