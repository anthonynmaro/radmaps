import type { WATERCOLOR_ATLAS_LAYERS } from './constants'

export type WatercolorSourceLayer = typeof WATERCOLOR_ATLAS_LAYERS[number]

export type WatercolorTileCoord = {
  z: number
  x: number
  y: number
}

export type WatercolorFeatureGroup =
  | 'water'
  | 'waterway'
  | 'park'
  | 'landcover'
  | 'landuse'
  | 'building'
  | 'road-major'
  | 'road-minor'
  | 'trail'
  | 'label'
  | 'poi'
  | 'unknown'

export type WatercolorPoint = {
  x: number
  y: number
  worldX: number
  worldY: number
}

export type WatercolorFeatureGeometry = {
  rings: WatercolorPoint[][]
  lines: WatercolorPoint[][]
}

export type WatercolorFeature = WatercolorFeatureGeometry & {
  sourceLayer: WatercolorSourceLayer | string
  group: WatercolorFeatureGroup
  properties: Record<string, unknown>
  featureSeed: string
}

export type WatercolorGeometry = {
  requestTile: WatercolorTileCoord
  sourceTile: WatercolorTileCoord
  tileSize: number
  features: WatercolorFeature[]
}

export type WatercolorTexturePack = {
  paperClean: string
  paperAged: string
  stains: string
  blueWash: string
  greenWash: string
  granulation: string
  roadMajor: string
  roadMinor: string
  trailWaterway: string
  blooms: string
}

export type WatercolorPalette = {
  paper: string
  water: string
  waterEdge: string
  park: string
  parkEdge: string
  roadMajor: string
  roadMinor: string
  roadEdge: string
  trail: string
  waterway: string
  building: string
}

export type WatercolorComposeOptions = {
  seed: string
  tileSize?: number
  palette?: Partial<WatercolorPalette>
  texturePack?: Partial<WatercolorTexturePack>
}

export type WatercolorRawImage = {
  data: Uint8ClampedArray
  width: number
  height: number
  channels: number
}
