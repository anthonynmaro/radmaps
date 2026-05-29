import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { WATERCOLOR_ATLAS_LAYERS, WATERCOLOR_TILE_SIZE } from './constants'
import { quantizedGeometrySeed } from './seed'
import type {
  WatercolorFeature,
  WatercolorFeatureGroup,
  WatercolorGeometry,
  WatercolorPoint,
  WatercolorTileCoord,
} from './types'

type MvtPoint = { x: number, y: number }

function featureGroup(sourceLayer: string, properties: Record<string, unknown>): WatercolorFeatureGroup {
  if (sourceLayer === 'water') return 'water'
  if (sourceLayer === 'waterway') return 'waterway'
  if (sourceLayer === 'park') return 'park'
  if (sourceLayer === 'landcover') return 'landcover'
  if (sourceLayer === 'landuse') return 'landuse'
  if (sourceLayer === 'building') return 'building'
  if (sourceLayer === 'place' || sourceLayer === 'transportation_name') return 'label'
  if (sourceLayer === 'poi') return 'poi'
  if (sourceLayer === 'transportation') {
    const rawClass = String(properties.class || properties.kind || properties.type || '').toLowerCase()
    if (['motorway', 'trunk', 'primary', 'secondary'].includes(rawClass)) return 'road-major'
    if (['path', 'track', 'trail', 'footway', 'cycleway', 'bridleway', 'pedestrian'].includes(rawClass)) return 'trail'
    return 'road-minor'
  }
  return 'unknown'
}

function pointToTilePixel(
  point: MvtPoint,
  extent: number,
  sourceTile: WatercolorTileCoord,
  requestTile: WatercolorTileCoord,
  tileSize: number,
): WatercolorPoint {
  const zoomScale = 2 ** (requestTile.z - sourceTile.z)
  const requestTileX = (sourceTile.x + point.x / extent) * zoomScale
  const requestTileY = (sourceTile.y + point.y / extent) * zoomScale
  const x = (requestTileX - requestTile.x) * tileSize
  const y = (requestTileY - requestTile.y) * tileSize
  return {
    x,
    y,
    worldX: requestTile.x * tileSize + x,
    worldY: requestTile.y * tileSize + y,
  }
}

function featureSeed(
  sourceLayer: string,
  id: unknown,
  group: WatercolorFeatureGroup,
  rings: WatercolorPoint[][],
  lines: WatercolorPoint[][],
) {
  if (id !== undefined && id !== null) return `${sourceLayer}:${String(id)}`
  const points = [...rings.flat(), ...lines.flat()]
  return quantizedGeometrySeed(`${sourceLayer}:${group}`, points)
}

export function extractWatercolorGeometry(
  mvt: Buffer | Uint8Array,
  options: {
    requestTile: WatercolorTileCoord
    sourceTile?: WatercolorTileCoord
    tileSize?: number
  },
): WatercolorGeometry {
  const requestTile = options.requestTile
  const sourceTile = options.sourceTile || requestTile
  const tileSize = options.tileSize || WATERCOLOR_TILE_SIZE
  const vectorTile = new VectorTile(new Pbf(mvt))
  const features: WatercolorFeature[] = []

  for (const sourceLayer of WATERCOLOR_ATLAS_LAYERS) {
    const layer = vectorTile.layers[sourceLayer]
    if (!layer) continue
    const extent = Number(layer.extent || 4096)
    for (let index = 0; index < layer.length; index += 1) {
      const feature = layer.feature(index)
      const properties = { ...(feature.properties || {}) } as Record<string, unknown>
      const group = featureGroup(sourceLayer, properties)
      const geometry = feature.loadGeometry() as MvtPoint[][]
      const converted = geometry.map(line =>
        line.map(point => pointToTilePixel(point, extent, sourceTile, requestTile, tileSize)),
      )
      const rings = feature.type === 3 ? converted : []
      const lines = feature.type === 2 ? converted : []
      features.push({
        sourceLayer,
        group,
        properties,
        rings,
        lines,
        featureSeed: featureSeed(sourceLayer, feature.id, group, rings, lines),
      })
    }
  }

  return {
    requestTile,
    sourceTile,
    tileSize,
    features,
  }
}
