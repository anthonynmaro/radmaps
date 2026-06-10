import { DEFAULT_CONTOUR_MAJOR_WIDTH, DEFAULT_ROUTE_CASING_WIDTH, DEFAULT_STYLE_CONFIG, DEFAULT_SEGMENT_CASING_WIDTH, type RouteStats, type StyleConfig, type TonerVariant, type TrailSegment } from '~/types'
import {
  CIRCLE_SCALE_PROPERTIES,
  LINE_SCALE_PROPERTIES,
  ROUTE_SCALE_PROPERTIES,
  SYMBOL_SCALE_PROPERTIES,
  effectiveStyleConfig,
  getPresetGraph,
  styleGraphUsesContours,
  type ScaledMapLibreProperty,
} from '~/utils/styleLayerGraph'
import { contrastRatio } from '~/utils/colorContrast'
import {
  WATERCOLOR_MAPLIBRE_TILE_SIZE,
  WATERCOLOR_RECIPE_ID,
  WATERCOLOR_RENDER_MAXZOOM,
  WATERCOLOR_TEXTURE_PACK_VERSION,
  WATERCOLOR_RENDERER_VERSION,
} from '~/utils/watercolor/constants'

type MapStyleObject = Record<string, unknown> & {
  layers?: Array<Record<string, unknown>>
}

function withScaleMetadata<T extends Record<string, unknown>>(layer: T, scale: ScaledMapLibreProperty[]): T {
  const metadata = (layer.metadata && typeof layer.metadata === 'object')
    ? layer.metadata as Record<string, unknown>
    : {}
  const radmaps = (metadata.radmaps && typeof metadata.radmaps === 'object')
    ? metadata.radmaps as Record<string, unknown>
    : {}
  return {
    ...layer,
    metadata: {
      ...metadata,
      radmaps: {
        ...radmaps,
        scale,
      },
    },
  }
}

function applyGraphLayerMetadata<T extends object>(style: T, config: StyleConfig): T {
  const mapStyle = style as MapStyleObject
  if (!Array.isArray(mapStyle.layers)) return style
  const graphLayers = new Map(getPresetGraph(config.preset).layers.map(layer => [layer.id, layer]))
  mapStyle.layers = mapStyle.layers.map((layer) => {
    const graphLayer = graphLayers.get(String(layer.id ?? ''))
    return graphLayer?.scale?.length ? withScaleMetadata(layer, graphLayer.scale) : layer
  })
  return mapStyle as T
}

/**
 * Build a MapLibre GL Style JSON object from a StyleConfig.
 * Used in both the browser MapPreview and the server render worker.
 *
 * Contour strategy:
 *   Browser/print → contourTileUrl is provided by MapPreview.vue
 *                   (maplibre-contour protocol), generating contours on the fly
 *                   from Terrarium DEM tiles. This is the only product contour
 *                   path; if no contourTileUrl is provided, contour sources and
 *                   layers are intentionally omitted.
 *
 * Base tile options (base_tile_style):
 *   carto-light / carto-dark  — free CARTO raster tiles (no token)
 *   maptiler-outdoor/topo/winter — MapTiler raster tiles (requires MAPTILER_TOKEN)
 *   topographic preset        — Mapbox Outdoors v12 (requires MAPBOX_TOKEN)
 */
export function buildMapStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
  stadiaToken?: string,
): object {
  const effectiveConfig = effectiveStyleConfig(config)
  let style: object
  if (effectiveConfig.preset === 'topographic') {
    style = buildTopographicStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (isRadMapsAtlasPreset(effectiveConfig.preset)) {
    style = buildRadMapsAtlasStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'route-only') {
    style = buildRouteOnlyStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'road-network') {
    style = buildRoadNetworkStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'contour-art') {
    style = buildContourArtStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'natural-topo') {
    style = buildNaturalTopoStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'stadia-watercolor') {
    style = buildStadiaWatercolorStyle(effectiveConfig, contourTileUrl, stadiaToken, mapboxToken)
  } else if (effectiveConfig.preset === 'stadia-toner') {
    style = buildStadiaTonerStyle(effectiveConfig, contourTileUrl, stadiaToken, mapboxToken)
  } else if (effectiveConfig.preset === 'native-toner') {
    style = buildNativeTonerStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'native-watercolor') {
    style = buildNativeWatercolorStyle(effectiveConfig, contourTileUrl, mapboxToken)
  } else if (effectiveConfig.preset === 'alidade-smooth') {
    style = buildAlidadeSmoothStyle(effectiveConfig, maptilerToken, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'alidade-smooth-dark') {
    style = buildAlidadeSmoothDarkStyle(effectiveConfig, maptilerToken, mapboxToken, contourTileUrl)
  } else {
    style = buildMinimalistStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  }
  const forcedBackgroundColor = effectiveConfig.color_theme === 'brutalist'
    ? '#E6E3DD'
    : effectiveConfig.color_theme === 'blackline'
      ? '#F7F7F4'
      : null
  if (forcedBackgroundColor && Array.isArray((style as { layers?: unknown }).layers)) {
    const backgroundLayer = ((style as { layers: Array<{ id?: string, paint?: Record<string, unknown> }> }).layers)
      .find(layer => layer.id === 'background')
    if (backgroundLayer) {
      backgroundLayer.paint = {
        ...(backgroundLayer.paint ?? {}),
        'background-color': forcedBackgroundColor,
      }
    }
  }
  return applyGraphLayerMetadata(style, effectiveConfig)
}

function isRadMapsAtlasPreset(preset?: string) {
  return Boolean(preset?.startsWith('radmaps-'))
}

function isRadMapsTonerPreset(preset?: string) {
  return preset === 'radmaps-toner-light'
    || preset === 'radmaps-toner-dark'
    || preset === 'radmaps-toner'
}

function atlasLayerEnabled(config: StyleConfig, layer: keyof NonNullable<StyleConfig['atlas_layers']>, fallback = true) {
  return config.atlas_layers?.[layer] ?? fallback
}

function atlasNumberSetting(value: number | undefined, fallback: number, min = 0, max = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function atlasTileUrl(source: 'base' | 'poi' | 'outdoorRoutes') {
  return sameOriginTileUrl(`/api/atlas/tiles/${source}/{z}/{x}/{y}.mvt?environment=production`)
}

function sameOriginTileUrl(path: string) {
  const origin = typeof globalThis !== 'undefined'
    ? (globalThis as { location?: { origin?: string } }).location?.origin
    : ''
  return origin ? `${origin}${path}` : path
}

function outdoorRouteFilter(settings: NonNullable<StyleConfig['atlas_layer_settings']>['outdoorRoute']) {
  const activities = settings?.activities?.length
    ? settings.activities
    : ['hiking', 'cycling', 'mountain-biking', 'bikepacking']
  const routeValues = Array.from(new Set(activities.flatMap((activity) => {
    if (activity === 'mountain-biking') return ['mtb']
    if (activity === 'bikepacking' || activity === 'cycling') return ['bicycle']
    return ['hiking']
  })))

  return [
    'any',
    ['in', ['get', 'activity'], ['literal', activities]],
    ['in', ['get', 'route'], ['literal', routeValues]],
  ]
}

function watercolorTileUrl(config: StyleConfig) {
  const atlasSettings = config.atlas_layer_settings ?? {}
  const enabledLayers = [
    atlasLayerEnabled(config, 'water') ? 'water' : '',
    atlasLayerEnabled(config, 'park') ? 'park' : '',
    atlasLayerEnabled(config, 'waterway') ? 'waterway' : '',
    atlasLayerEnabled(config, 'building') ? 'building' : '',
    atlasLayerEnabled(config, 'transportation', config.show_roads ?? true) && config.show_roads !== false ? 'transportation' : '',
  ].filter(Boolean).join(',')
  const params = new URLSearchParams({
    scale: '2',
    recipe: WATERCOLOR_RECIPE_ID,
    seed: config.watercolor_seed || 'default',
    renderer: WATERCOLOR_RENDERER_VERSION,
    texturePack: WATERCOLOR_TEXTURE_PACK_VERSION,
    layers: enabledLayers,
    environment: 'production',
  })
  if (config.atlas_manifest_id) params.set('artifactId', config.atlas_manifest_id)
  const watercolorPalette = {
    water: atlasSettings.water?.fill_color || config.water_color,
    park: atlasSettings.park?.fill_color || config.land_color,
    waterway: atlasSettings.waterway?.color || atlasSettings.water?.waterway_color || config.water_color,
    roadMajor: atlasSettings.transportation?.major_color || config.roads_color,
    roadMinor: atlasSettings.transportation?.minor_color || config.roads_color,
    trail: atlasSettings.transportation?.trail_color,
  }
  for (const [key, value] of Object.entries(watercolorPalette)) {
    if (value) params.set(key, value)
  }
  return sameOriginTileUrl(`/api/watercolor/tiles/base/{z}/{x}/{y}.png?${params.toString()}`)
}

export function styleUsesContours(config: Pick<StyleConfig, 'preset' | 'show_contours'>): boolean {
  return styleGraphUsesContours(config)
}

// ─── Contour thresholds for maplibre-contour ─────────────────────────────────
// Per-detail-level thresholds: { mapZoom: [minorIntervalMeters, majorIntervalMeters] }
// These are used in MapPreview.vue to generate the contourTileUrl.
// Exported so MapPreview can build the URL without duplicating the table.
//
// maplibre-contour's getOptionsForZoom picks the HIGHEST key ≤ current map
// zoom. If no key qualifies, levels=[] and nothing is drawn. Start at zoom 1
// as a universal fallback. maplibre-contour's `overzoom` option requests
// lower-resolution parent DEM tiles, so RadMaps keeps it at 0 for contour
// fidelity. Key 1 covers any poster zoom below the first named key.
export const CONTOUR_THRESHOLDS: Record<number, Record<number, [number, number]>> = {
  0: { 1: [1000, 5000], 7: [500, 2000], 8: [500, 2000], 9: [300, 1500], 10: [200, 1000], 11: [200, 1000], 12: [200, 1000], 13: [100, 500],  14: [50,  200] },
  1: { 1: [500,  2000], 7: [300, 1500], 8: [200, 1000], 9: [100, 500],  10: [100, 500],  11: [100, 500],  12: [100, 500],  13: [50,  200],  14: [20,  100] },
  2: { 1: [200,  1000], 7: [200, 1000], 8: [100, 500],  9: [50,  250],  10: [50,  200],  11: [50,  200],  12: [50,  200],  13: [20,  100],  14: [10,  50]  },
  3: { 1: [100,  500],  7: [100, 500],  8: [50,  250],  9: [30,  150],  10: [20,  100],  11: [20,  100],  12: [20,  100],  13: [10,  50],   14: [5,   20]  }, // default
  4: { 1: [50,   250],  7: [50,  250],  8: [30,  150],  9: [20,  100],  10: [10,  50],   11: [10,  50],   12: [10,  50],   13: [5,   20],   14: [5,   10]  },
  5: { 1: [20,   100],  7: [20,  100],  8: [10,  50],   9: [10,  50],   10: [5,   20],   11: [5,   20],   12: [5,   20],   13: [2,   10],   14: [2,   5]   },
}

export const LOW_RELIEF_CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
  1: [5, 25],
  7: [5, 25],
  8: [5, 25],
  9: [5, 25],
  10: [5, 25],
  11: [5, 25],
  12: [5, 25],
  13: [5, 25],
  14: [5, 25],
}

export const BRUTALIST_LOW_RELIEF_CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
  1: [5, 20],
  7: [5, 20],
  8: [5, 20],
  9: [5, 20],
  10: [5, 20],
  11: [5, 20],
  12: [5, 20],
  13: [5, 20],
  14: [5, 20],
}

export const CONTOUR_DEM_OVERZOOM = 0

export type AdaptiveContourReliefBand = 'unknown' | 'low' | 'moderate' | 'high' | 'extreme'

export interface AdaptiveContourReliefProfile {
  band: AdaptiveContourReliefBand
  detail: number | null
  reliefM: number | null
  gainPerKm: number | null
  elevationChangeM: number | null
}

const SMOOTH_CONTOUR_THEME_IDS = new Set([
  'blueprint-strava',
  'bold-modern',
  'classic-trail',
  'contour-wash',
  'daybreak-trace',
  'editorial-minimal',
  'midcentury-travel',
  'ranch-ochre',
  'splits-stats',
])

const AUTHORED_NON_LOW_RELIEF_CONTOUR_THEME_IDS = new Set([
  'botanical',
  'brutalist',
  'moonstone',
])

const AUTHORED_SPARSE_LOW_RELIEF_CONTOUR_THEME_IDS = new Set<string>([
])

const THEME_MIN_CONTOUR_DETAIL = new Map<string, number>([
  ['bold-modern', 2],
  ['classic-trail', 2],
  ['contour-wash', 2],
  ['editorial-minimal', 2],
  ['usgs-vintage', 2],
])

const THEME_MAX_CONTOUR_DETAIL = new Map<string, number>([
  ['blueprint-strava', 4],
  ['daybreak-trace', 3],
  ['electric-atlas', 3],
  ['splits-stats', 4],
])

const THEME_NON_LOW_RELIEF_MAX_CONTOUR_DETAIL = new Map<string, number>([
  ['night-ride', 0],
])

const SUPPRESS_SEA_LEVEL_CONTOUR_THEME_IDS = new Set([
  'blueprint-strava',
  'splits-stats',
])

function contourFeatureFilter(
  config: Partial<Pick<StyleConfig, 'color_theme'>>,
  levelFilter: unknown[],
): unknown[] {
  if (!SUPPRESS_SEA_LEVEL_CONTOUR_THEME_IDS.has(config.color_theme ?? '')) return levelFilter
  return ['all', ['>', ['get', 'ele'], 0], levelFilter]
}

function clampContourDetail(detail: number): number {
  if (!Number.isFinite(detail)) return 3
  return Math.max(0, Math.min(5, Math.round(detail)))
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function detailForReliefMeters(reliefM: number | null): number | null {
  if (reliefM == null) return null
  if (reliefM <= 250) return 5
  if (reliefM <= 350) return 4
  if (reliefM <= 700) return 1
  if (reliefM <= 1200) return 1
  return 0
}

function detailForGainPerKm(gainPerKm: number | null): number | null {
  if (gainPerKm == null) return null
  if (gainPerKm <= 35) return 5
  if (gainPerKm <= 55) return 4
  if (gainPerKm <= 85) return 3
  if (gainPerKm <= 140) return 2
  if (gainPerKm <= 210) return 1
  return 0
}

function bandForContourDetail(detail: number | null): AdaptiveContourReliefBand {
  if (detail == null) return 'unknown'
  if (detail === 5) return 'low'
  if (detail === 4) return 'moderate'
  if (detail >= 1) return 'high'
  return 'extreme'
}

export function resolveAdaptiveContourReliefProfile(
  stats?: Partial<RouteStats> | null,
): AdaptiveContourReliefProfile {
  if (!stats) {
    return { band: 'unknown', detail: null, reliefM: null, gainPerKm: null, elevationChangeM: null }
  }

  const minElevationM = finiteOrNull(stats.min_elevation_m)
  const maxElevationM = finiteOrNull(stats.max_elevation_m)
  const gainM = Math.max(finiteOrNull(stats.elevation_gain_m) ?? 0, finiteOrNull(stats.elevation_loss_m) ?? 0)
  const distanceKm = finiteOrNull(stats.distance_km)
  const reliefM = minElevationM != null && maxElevationM != null && maxElevationM > minElevationM
    ? maxElevationM - minElevationM
    : null
  const gainPerKm = distanceKm != null && distanceKm > 0 && gainM > 0
    ? gainM / distanceKm
    : null
  const elevationChangeM = reliefM ?? (gainM > 0 ? gainM : null)
  const reliefDetail = detailForReliefMeters(reliefM)
  const gainDetail = detailForGainPerKm(gainPerKm)

  if (reliefDetail == null && gainDetail == null) {
    return { band: 'unknown', detail: null, reliefM, gainPerKm, elevationChangeM }
  }

  const detail = Math.min(reliefDetail ?? 5, gainDetail ?? 5)
  return {
    band: bandForContourDetail(detail),
    detail,
    reliefM,
    gainPerKm,
    elevationChangeM,
  }
}

export function resolveAdaptiveContourDetail(
  config: Pick<StyleConfig, 'contour_detail'> & Partial<Pick<StyleConfig, 'color_theme'>>,
  stats?: Partial<RouteStats> | null,
): number {
  const fallback = clampContourDetail(config.contour_detail ?? 3)
  const profile = resolveAdaptiveContourReliefProfile(stats)
  let adaptiveDetail = profile.detail
  if (adaptiveDetail == null) return fallback
  const themeMinimumDetail = THEME_MIN_CONTOUR_DETAIL.get(config.color_theme ?? '')
  if (themeMinimumDetail != null) {
    adaptiveDetail = Math.max(adaptiveDetail, themeMinimumDetail)
  }
  const themeMaximumDetail = THEME_MAX_CONTOUR_DETAIL.get(config.color_theme ?? '')
  if (themeMaximumDetail != null) {
    adaptiveDetail = Math.min(adaptiveDetail, themeMaximumDetail)
  }
  const nonLowReliefThemeMaximumDetail = THEME_NON_LOW_RELIEF_MAX_CONTOUR_DETAIL.get(config.color_theme ?? '')
  if (nonLowReliefThemeMaximumDetail != null && profile.band !== 'low') {
    adaptiveDetail = Math.min(adaptiveDetail, nonLowReliefThemeMaximumDetail)
  }
  if (
    adaptiveDetail === 5 &&
    fallback < adaptiveDetail &&
    AUTHORED_SPARSE_LOW_RELIEF_CONTOUR_THEME_IDS.has(config.color_theme ?? '')
  ) {
    return fallback
  }
  if (
    adaptiveDetail !== 5 &&
    adaptiveDetail > fallback &&
    AUTHORED_NON_LOW_RELIEF_CONTOUR_THEME_IDS.has(config.color_theme ?? '')
  ) {
    return fallback
  }
  return adaptiveDetail
}

export function resolveAdaptiveContourOverzoom(
  config: Pick<StyleConfig, 'color_theme'>,
): number {
  return SMOOTH_CONTOUR_THEME_IDS.has(config.color_theme ?? '') ? 2 : CONTOUR_DEM_OVERZOOM
}

export function resolveAdaptiveContourThresholds(
  config: Pick<StyleConfig, 'contour_detail'> & Partial<Pick<StyleConfig, 'color_theme'>>,
  stats?: Partial<RouteStats> | null,
): Record<number, [number, number]> {
  const detail = resolveAdaptiveContourDetail(config, stats)
  const profile = resolveAdaptiveContourReliefProfile(stats)
  if (detail !== 5 || profile.band !== 'low') return CONTOUR_THRESHOLDS[detail] ?? CONTOUR_THRESHOLDS[3]
  if (config.color_theme === 'brutalist') return BRUTALIST_LOW_RELIEF_CONTOUR_THRESHOLDS
  return LOW_RELIEF_CONTOUR_THRESHOLDS
}

function scaleNumber(value: number | undefined, factor: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return Math.min(value * factor, max)
}

function clampNumberMin(value: number | undefined, min: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return Math.max(value, min)
}

function clampNumberMax(value: number | undefined, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return Math.min(value, max)
}

export function resolveAdaptiveContourStyleConfig(
  config: StyleConfig,
  stats?: Partial<RouteStats> | null,
): StyleConfig {
  if (!styleGraphUsesContours(config)) return config

  const adaptiveDetail = resolveAdaptiveContourDetail(config, stats)
  const reliefProfile = resolveAdaptiveContourReliefProfile(stats)
  const hasStats = reliefProfile.band !== 'unknown'
  const isLowRelief = adaptiveDetail === 5 && hasStats
  const highReliefProfile = adaptiveDetail <= 3 && reliefProfile.band !== 'low'
    ? config.color_theme === 'bold-modern'
      ? ({
          0: { opacityFactor: 1, minorMax: 0.18, majorMax: 0.78, widthFactor: 1 },
          1: { opacityFactor: 1, minorMax: 0.20, majorMax: 0.82, widthFactor: 1 },
          2: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.86, widthFactor: 1 },
          3: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.88, widthFactor: 1 },
        } as const)[adaptiveDetail]
      : config.color_theme === 'editorial-minimal'
        ? ({
            0: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.34, widthFactor: 0.9 },
            1: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.36, widthFactor: 0.95 },
            2: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.38, widthFactor: 1 },
            3: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.40, widthFactor: 1 },
          } as const)[adaptiveDetail]
      : config.color_theme === 'brutalist'
        ? ({
            0: { opacityFactor: 1, minorMax: 0.08, majorMax: 0.88, widthFactor: 1 },
            1: { opacityFactor: 1, minorMax: 0.10, majorMax: 0.88, widthFactor: 1 },
            2: { opacityFactor: 1, minorMax: 0.12, majorMax: 0.88, widthFactor: 1 },
            3: { opacityFactor: 1, minorMax: 0.14, majorMax: 0.88, widthFactor: 1 },
          } as const)[adaptiveDetail]
      : config.color_theme === 'botanical'
        ? ({
            0: { opacityFactor: 1, minorMax: 0.14, majorMax: 0.72, widthFactor: 1 },
            1: { opacityFactor: 1, minorMax: 0.16, majorMax: 0.76, widthFactor: 1 },
            2: { opacityFactor: 1, minorMax: 0.18, majorMax: 0.78, widthFactor: 1 },
            3: { opacityFactor: 1, minorMax: 0.20, majorMax: 0.80, widthFactor: 1 },
          } as const)[adaptiveDetail]
        : config.color_theme === 'night-ride'
          ? ({
              0: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.54, widthFactor: 0.86 },
              1: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.56, widthFactor: 0.9 },
              2: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.58, widthFactor: 0.94 },
              3: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.60, widthFactor: 1 },
            } as const)[adaptiveDetail]
        : ['daybreak-trace', 'midcentury-travel', 'ranch-ochre'].includes(config.color_theme ?? '')
          ? ({
              0: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.62, widthFactor: 1 },
              1: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.66, widthFactor: 1 },
              2: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.68, widthFactor: 1 },
              3: { opacityFactor: 1, minorMax: 0.30, majorMax: 0.70, widthFactor: 1 },
            } as const)[adaptiveDetail]
      : ({
          0: { opacityFactor: 0.34, minorMax: 0.10, majorMax: 0.38, widthFactor: 0.54 },
          1: { opacityFactor: 0.48, minorMax: 0.16, majorMax: 0.46, widthFactor: 0.68 },
          2: { opacityFactor: 0.68, minorMax: 0.24, majorMax: 0.56, widthFactor: 0.82 },
          3: { opacityFactor: 0.82, minorMax: 0.30, majorMax: 0.62, widthFactor: 0.90 },
        } as const)[adaptiveDetail]
    : null

  if (adaptiveDetail === config.contour_detail && !isLowRelief && !highReliefProfile) {
    return config
  }

  const next: StyleConfig = {
    ...config,
    contour_detail: adaptiveDetail,
  }

  if (isLowRelief) {
    const lowReliefOpacityFloor = config.color_theme === 'brutalist'
      ? { contour: 0.52, minor: 0.68, major: 0.58 }
      : config.color_theme === 'daybreak-trace'
        ? { contour: 0.12, minor: 0.06, major: 0.22 }
      : ['daybreak-trace', 'midcentury-travel', 'ranch-ochre'].includes(config.color_theme ?? '')
        ? { contour: 0.14, minor: 0.055, major: 0.28 }
        : { contour: 0.34, minor: 0.24, major: 0.42 }
    next.contour_opacity = Math.max(next.contour_opacity ?? 0, lowReliefOpacityFloor.contour)

    const contourSettings = next.atlas_layer_settings?.contour
    if (contourSettings) {
      next.atlas_layer_settings = {
        ...next.atlas_layer_settings,
        contour: {
          ...contourSettings,
          minor_opacity: Math.max(contourSettings.minor_opacity ?? next.contour_opacity, lowReliefOpacityFloor.minor),
          major_opacity: Math.max(contourSettings.major_opacity ?? contourSettings.index_opacity ?? next.contour_opacity, lowReliefOpacityFloor.major),
          index_opacity: contourSettings.index_opacity == null
            ? contourSettings.index_opacity
            : Math.max(contourSettings.index_opacity, lowReliefOpacityFloor.major),
        },
      }
    }
  }

  if (highReliefProfile) {
    const adaptedOpacity = clampNumberMax(next.contour_opacity, highReliefProfile.minorMax)
    const adaptedMinorWidth = scaleNumber(next.contour_minor_width, highReliefProfile.widthFactor, next.contour_minor_width ?? 1)
    const adaptedMajorWidth = scaleNumber(next.contour_major_width, highReliefProfile.widthFactor, next.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH)
    if (adaptedOpacity != null) next.contour_opacity = adaptedOpacity
    if (adaptedMinorWidth != null) next.contour_minor_width = adaptedMinorWidth
    if (adaptedMajorWidth != null) next.contour_major_width = adaptedMajorWidth

    const contourSettings = next.atlas_layer_settings?.contour
    if (contourSettings) {
      next.atlas_layer_settings = {
        ...next.atlas_layer_settings,
        contour: {
          ...contourSettings,
          minor_opacity: clampNumberMax(contourSettings.minor_opacity ?? next.contour_opacity, highReliefProfile.minorMax),
          major_opacity: clampNumberMax(contourSettings.major_opacity ?? contourSettings.index_opacity ?? next.contour_opacity, highReliefProfile.majorMax),
          index_opacity: contourSettings.index_opacity == null
            ? contourSettings.index_opacity
            : clampNumberMax(contourSettings.index_opacity, highReliefProfile.majorMax),
          minor_width: scaleNumber(contourSettings.minor_width, highReliefProfile.widthFactor, contourSettings.minor_width ?? 1),
          major_width: scaleNumber(contourSettings.major_width ?? contourSettings.index_width, highReliefProfile.widthFactor, contourSettings.major_width ?? contourSettings.index_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH),
          index_width: contourSettings.index_width == null
            ? contourSettings.index_width
            : scaleNumber(contourSettings.index_width, highReliefProfile.widthFactor, contourSettings.index_width),
        },
      }
    }
  }

  next.contour_opacity = clampNumberMin(next.contour_opacity, 0) ?? next.contour_opacity
  return next
}

// ─── Color helpers ────────────────────────────────────────────────────────────

// Linearly interpolate between two hex colors. t=0 → a, t=1 → b.
export function blendHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0')
  const g = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0')
  const bh = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0')
  return `#${r}${g}${bh}`
}

// ─── Tile effect URL wrapper ──────────────────────────────────────────────────
// Prefixes raster tile URLs with a custom 'styledtile://' protocol when a
// per-pixel effect is active. Parameters are encoded into the URL so MapLibre
// generates a distinct cache key whenever they change.
//
// Format: styledtile://{effect},{...params}|{realTileUrl}
//
// The MapPreview.vue protocol handler parses this, fetches the real tile,
// applies the pixel transform via OffscreenCanvas, and returns the result.
// The render-worker registers an identical handler in its inline script.
function styledTileUrls(config: StyleConfig, urls: string[]): string[] {
  const effect = config.tile_effect ?? 'none'
  if (effect === 'none') return urls

  if (effect === 'invert') {
    return urls.map(u => `styledtile://invert|${u}`)
  }

  if (effect === 'duotone') {
    // Shadow → label_text_color (dark), Highlight → background_color (light).
    // Together they remap any tile's luminance into the poster's own palette.
    const shadow    = (config.label_text_color  ?? '#1C1917').replace('#', '')
    const highlight = (config.background_color  ?? '#F7F4EF').replace('#', '')
    const strength  = Math.round((config.tile_duotone_strength ?? 0.9) * 100)
    return urls.map(u => `styledtile://duotone,${shadow},${highlight},${strength}|${u}`)
  }

  if (effect === 'posterize') {
    const levels = config.tile_posterize_levels ?? 4
    return urls.map(u => `styledtile://posterize,${levels}|${u}`)
  }

  if (effect === 'layer-color') {
    // Trilinear luminance mapping: dark pixels → shadow, mid → midtone, light → highlight.
    // Defaults to the poster's text/bg palette so out-of-the-box results match the theme.
    const shadowHex    = config.tile_shadow_color    ?? config.label_text_color  ?? '#1C1917'
    const highlightHex = config.tile_highlight_color ?? config.background_color  ?? '#F7F4EF'
    const midHex       = config.tile_midtone_color   ?? blendHex(shadowHex, highlightHex, 0.5)
    const shadow    = shadowHex.replace('#', '')
    const mid       = midHex.replace('#', '')
    const highlight = highlightHex.replace('#', '')
    return urls.map(u => `styledtile://layer-color,${shadow},${mid},${highlight}|${u}`)
  }

  return urls
}

export function mapBackgroundColor(config: StyleConfig): string {
  if (config.color_theme === 'brutalist') {
    return config.background_color ?? '#E6E3DD'
  }
  if (isRadMapsTonerPreset(config.preset)) {
    return resolveTonerPalette(config).background
  }
  return config.tile_effect === 'invert'
    ? (config.label_text_color ?? '#1C1917')
    : (config.background_color ?? '#F7F4EF')
}

export function mapInkColor(config: StyleConfig): string {
  if (isRadMapsTonerPreset(config.preset)) {
    return resolveTonerPalette(config).ink
  }
  return config.tile_effect === 'invert'
    ? (config.background_color ?? '#F7F4EF')
    : (config.label_text_color ?? '#1C1917')
}

export type ResolvedTonerVariant = Exclude<TonerVariant, 'auto'>
export type TonerDotDensity = 'soft' | 'medium' | 'dense'

export const TONER_DOT_PATTERN_ID_PREFIX = 'radmaps-toner-dot-'
export const TONER_DOT_PATTERN_IDS = (['light', 'dark'] as const).flatMap(variant =>
  (['soft', 'medium', 'dense'] as const).map(density => `${TONER_DOT_PATTERN_ID_PREFIX}${variant}-${density}`),
)

export function tonerDotPatternId(variant: ResolvedTonerVariant, density: TonerDotDensity): string {
  return `${TONER_DOT_PATTERN_ID_PREFIX}${variant}-${density}`
}

export const TONER_DOT_PARK_CLASSES = ['national_park', 'state_park', 'local_park', 'preserve'] as const
export const TONER_DOT_NATURAL_CLASSES = ['forest', 'wood', 'wetland'] as const

export function tonerDotParkFilter(): unknown[] {
  return ['in', ['get', 'class'], ['literal', [...TONER_DOT_PARK_CLASSES]]]
}

export function tonerDotNaturalFilter(): unknown[] {
  return ['in', ['get', 'class'], ['literal', [...TONER_DOT_NATURAL_CLASSES]]]
}

export interface TonerPalette {
  variant: ResolvedTonerVariant
  background: string
  land: string
  ink: string
  water: string
  waterway: string
  park: string
  building: string
  label: string
  labelHalo: string
  poiLabel: string
  roadMajor: string
  roadMinor: string
  trail: string
  landOpacity: number
  waterOpacity: number
  parkOpacity: number
  buildingOpacity: number
  roadOpacity: number
  minorRoadOpacity: number
  trailOpacity: number
}

type TonerVariantConfig = {
  preset?: StyleConfig['preset'] | string
  toner_variant?: TonerVariant
  dark?: boolean
}

export function resolveTonerVariant(config: TonerVariantConfig): ResolvedTonerVariant {
  if (config.preset === 'radmaps-toner-light') return 'light'
  if (config.preset === 'radmaps-toner-dark') return 'dark'
  if (config.toner_variant === 'light' || config.toner_variant === 'dark') return config.toner_variant
  return config.dark === true ? 'dark' : 'light'
}

export function resolveTonerPalette(config: TonerVariantConfig): TonerPalette {
  const variant = resolveTonerVariant(config)
  if (variant === 'dark') {
    return {
      variant,
      background: '#000000',
      land: '#000000',
      ink: '#FFFFFF',
      water: '#8595A2',
      waterway: '#93A1AC',
      park: '#A8A8A8',
      building: '#FFFFFF',
      label: '#FFFFFF',
      labelHalo: '#000000',
      poiLabel: '#FFFFFF',
      roadMajor: '#FFFFFF',
      roadMinor: '#5F6B75',
      trail: '#7D8A94',
      landOpacity: 1,
      waterOpacity: 0.44,
      parkOpacity: 0.14,
      buildingOpacity: 0.14,
      roadOpacity: 1,
      minorRoadOpacity: 0.98,
      trailOpacity: 0.86,
    }
  }

  return {
    variant,
    background: '#FFFFFF',
    land: '#FFFFFF',
    ink: '#000000',
    water: '#B7B7B7',
    waterway: '#555555',
    park: '#CFCFCF',
    building: '#000000',
    label: '#000000',
    labelHalo: '#FFFFFF',
    poiLabel: '#000000',
    roadMajor: '#000000',
    roadMinor: '#3F3F3F',
    trail: '#2F2F2F',
    landOpacity: 1,
    waterOpacity: 0.34,
    parkOpacity: 0.10,
    buildingOpacity: 0.08,
    roadOpacity: 0.94,
    minorRoadOpacity: 0.82,
    trailOpacity: 0.62,
  }
}

export function resolveTonerRouteStyle(config: Pick<StyleConfig, 'preset' | 'toner_variant' | 'dark' | 'route_color' | 'route_width' | 'route_opacity'>): Pick<StyleConfig, 'route_color' | 'route_width' | 'route_opacity'> {
  const routeColor = config.route_color ?? DEFAULT_STYLE_CONFIG.route_color
  const routeWidth = config.route_width ?? DEFAULT_STYLE_CONFIG.route_width
  const routeOpacity = config.route_opacity ?? DEFAULT_STYLE_CONFIG.route_opacity
  if (!isRadMapsTonerPreset(config.preset)) {
    return { route_color: routeColor, route_width: routeWidth, route_opacity: routeOpacity }
  }

  const palette = resolveTonerPalette(config)
  const fallbackRouteColor = palette.variant === 'dark' ? '#FF4A3D' : '#C1121F'
  const usesDefaultRouteColor = routeColor === DEFAULT_STYLE_CONFIG.route_color
  return {
    route_color: (palette.variant === 'dark' && usesDefaultRouteColor) || contrastRatio(routeColor, palette.background) < 3 ? fallbackRouteColor : routeColor,
    route_width: routeWidth,
    route_opacity: Math.max(routeOpacity, 0.96),
  }
}

// ─── DEM source (hillshade) ───────────────────────────────────────────────────
// AWS Terrain Tiles (Tilezen/Terrarium) — free, no auth, terrarium encoding.
function demSource(_token: string) {
  return {
    'mapbox-dem': {
      type: 'raster-dem' as const,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium' as const,
      attribution: '© Mapzen, © OpenStreetMap contributors',
    },
  }
}

// ─── Contour sources ──────────────────────────────────────────────────────────

// Browser path: maplibre-contour generates vector contours from the DEM tiles.
// The tileUrl is a custom "contour://" protocol URL produced by DemSource.contourProtocol().
function mlContourSource(tileUrl: string) {
  return {
    'contours': {
      type: 'vector' as const,
      tiles: [tileUrl],
      minzoom: 0,
      maxzoom: 14,
    },
  }
}

function contourSource(_token: string, contourTileUrl?: string) {
  return contourTileUrl ? mlContourSource(contourTileUrl) : {}
}

// ─── Hillshade layers ─────────────────────────────────────────────────────────

function hillshadeLayers(config: StyleConfig) {
  if (!config.show_hillshade) return []
  const isReliefTheme = config.color_theme === 'relief-shaded'
  return [
    {
      id: 'hillshade',
      type: 'hillshade' as const,
      source: 'mapbox-dem',
      paint: {
        'hillshade-shadow-color': isReliefTheme ? '#9B845F' : '#000000',
        'hillshade-highlight-color': isReliefTheme ? '#FFF7DE' : '#FFFFFF',
        'hillshade-accent-color': isReliefTheme ? '#D8C08C' : '#000000',
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': config.hillshade_intensity,
      },
    },
  ]
}

// ─── Contour line layers ──────────────────────────────────────────────────────

export function contourMinorLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_minor_width ?? 1
  if (config.preset === 'contour-art') {
    return ['interpolate', ['linear'], ['zoom'], 5, 0.75 * weight, 14, 1.4 * weight]
  }
  return ['interpolate', ['linear'], ['zoom'], 5, 0.8 * weight, 14, 1.0 * weight]
}

export function contourMinorLineOpacityExpression(opacity: number): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], 5, opacity, 14, opacity * 0.9]
}

export function contourMidLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_minor_width ?? 1
  return ['interpolate', ['linear'], ['zoom'], 5, 1.1 * weight, 14, 1.5 * weight]
}

export function contourMajorLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH
  if (config.preset === 'contour-art') {
    return ['interpolate', ['linear'], ['zoom'], 5, 1.3 * weight, 14, 2.8 * weight]
  }
  return ['interpolate', ['linear'], ['zoom'], 5, 1.5 * weight, 14, 2.5 * weight]
}

function contourLayers(config: StyleConfig, usingMlContour: boolean) {
  if (!config.show_contours) return []

  // ── maplibre-contour path ───────────────────────────────────────────────────
  // Source layer: 'contours'  |  level: 0 = minor, 1 = major
  if (usingMlContour) {
    const layers: object[] = [
      {
        id: 'contours-minor',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: contourFeatureFilter(config, ['!=', ['get', 'level'], 1]),
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_color,
          'line-opacity': contourMinorLineOpacityExpression(config.contour_opacity),
          'line-width': contourMinorLineWidthExpression(config),
        },
      },
      {
        id: 'contours-major',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: contourFeatureFilter(config, ['==', ['get', 'level'], 1]),
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_major_color,
          'line-opacity': config.contour_opacity,
          'line-width': contourMajorLineWidthExpression(config),
        },
      },
    ]

    if (config.show_elevation_labels) {
      layers.push({
        id: 'contours-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contours',
        filter: contourFeatureFilter(config, ['==', ['get', 'level'], 1]),
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 500,
          'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
          'text-letter-spacing': 0.06,
          'text-padding': 4,
          'text-pitch-alignment': 'viewport',
          // viewport keeps labels horizontal — far more legible than map-aligned
          // which tilts text to follow the contour curve
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': config.contour_major_color,
          // Use the poster background colour as the halo so it reads on both
          // light (chalk/topaz) and dark (obsidian/midnight) themes
          'text-halo-color': config.background_color,
          'text-halo-width': 2,
          'text-opacity': config.contour_opacity,
        },
      })
    }

    return layers
  }

  return []
}

// ─── Roads overlay ───────────────────────────────────────────────────────────
// Mapbox Streets v8 vector tiles — uses the same token as terrain.
// Falls back gracefully (no source/layers added) when no token is present.

function roadsSource(token: string) {
  return {
    'mapbox-streets': {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    },
  }
}

const NATURAL_WATERWAY_CLASSES = ['river', 'canal', 'stream', 'stream_intermittent'] as const

function waterwayLayer(id: string, color: string, opacity: number, minWidth: number, maxWidth: number): object {
  return {
    id,
    type: 'line',
    source: 'mapbox-streets',
    'source-layer': 'waterway',
    filter: ['in', ['get', 'class'], ['literal', [...NATURAL_WATERWAY_CLASSES]]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': color,
      'line-opacity': opacity,
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, minWidth, 14, maxWidth],
    },
  }
}

function usesRoadOverlay(config: StyleConfig): boolean {
  return config.show_roads === true || config.show_place_labels !== false || config.show_poi_labels === true
}

function placeLabelTypes(scale: StyleConfig['place_labels_scale']): string[] {
  if (scale === 'city') return ['city']
  if (scale === 'village') return ['city', 'town', 'village']
  return ['city', 'town']  // default: 'town'
}

function roadsLayers(config: StyleConfig): object[] {
  const roadColor  = config.roads_color  ?? config.label_text_color
  const roadOpacity = config.roads_opacity ?? 0.6
  const labelColor  = config.place_labels_color  ?? config.label_text_color
  const labelOpacity = config.place_labels_opacity ?? 0.75
  const poiColor  = config.poi_labels_color  ?? config.label_text_color
  const poiOpacity = config.poi_labels_opacity ?? 0.65

  const layers: object[] = []

  if (config.show_roads) {
    layers.push(
      // Motorways + trunk — widest, most prominent
      {
        id: 'roads-major',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.50,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.0, 14, 3.5],
        },
      },
      // Primary + secondary
      {
        id: 'roads-primary',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.37,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 2.5],
        },
      },
      // Tertiary + local streets
      {
        id: 'roads-minor',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['tertiary', 'street', 'service', 'path']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.23,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.5],
        },
      },
    )
  }

  // Place labels (cities, towns, villages) — shown by default
  if (config.show_place_labels !== false) {
    layers.push({
      id: 'roads-place-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['in', ['get', 'type'], ['literal', placeLabelTypes(config.place_labels_scale)]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 14, 13],
        'text-anchor': 'center',
        'text-max-width': 8,
      },
      paint: {
        'text-color': labelColor,
        'text-opacity': labelOpacity,
        'text-halo-color': config.background_color,
        'text-halo-width': 1.5,
      },
    })
  }

  // POI labels — opt-in only
  if (config.show_poi_labels) {
    layers.push({
      id: 'roads-poi-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'poi_label',
      filter: ['all',
        ['has', 'name'],
        ['<=', ['to-number', ['get', 'filterrank'], 5], 3],
      ],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-max-width': 6,
      },
      paint: {
        'text-color': poiColor,
        'text-opacity': poiOpacity,
        'text-halo-color': config.background_color,
        'text-halo-width': 1,
      },
    })
  }

  return layers
}

// ─── Trail segment sources/layers ────────────────────────────────────────────

const ELEVATION_GRADIENT_PAINT = [
  'interpolate', ['linear'], ['line-progress'],
  0,    '#4F8EF7',
  0.25, '#52B788',
  0.6,  '#F4A261',
  0.85, '#E76F51',
  1,    '#C1121F',
] as const

export function trailSegmentSources(segments: TrailSegment[] = []): Record<string, object> {
  const sources: Record<string, object> = {}
  for (const seg of segments) {
    if (!seg.visible) continue
    sources[`trail-seg-${seg.id}`] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      ...(seg.color_mode === 'gradient' ? { lineMetrics: true } : {}),
    }
  }
  return sources
}

export function trailSegmentLayers(segments: TrailSegment[] = [], config: StyleConfig): object[] {
  const layers: object[] = []
  for (const seg of segments) {
    if (!seg.visible) continue
    const width = seg.width ?? config.route_width ?? 2
    const opacity = seg.opacity ?? 0.9
    const dashArray = seg.dash ? [4, 3] : undefined
    const useGradient = seg.color_mode === 'gradient'

    layers.push(withScaleMetadata({
      id: `trail-seg-casing-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.segment_casing_color ?? '#FFFFFF',
        'line-width': width + (config.segment_casing_width ?? DEFAULT_SEGMENT_CASING_WIDTH),
        'line-opacity': opacity,
      },
    }, LINE_SCALE_PROPERTIES))

    const lineLayer: Record<string, unknown> = {
      id: `trail-seg-line-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        ...(useGradient ? { 'line-gradient': ELEVATION_GRADIENT_PAINT } : { 'line-color': seg.color }),
        'line-width': width,
        'line-opacity': opacity,
        ...(dashArray ? { 'line-dasharray': dashArray } : {}),
      },
    }
    layers.push(withScaleMetadata(lineLayer, LINE_SCALE_PROPERTIES))
  }
  return layers
}

// ─── Segment endpoint handles ─────────────────────────────────────────────────
// Small colored dots at the start/end of each visible trail segment.
// Data is populated by MapPreview.vue's populateSegmentSources().
// circle-color is data-driven from the GeoJSON feature's `color` property.

function segmentHandleSource(): object {
  return {
    'segment-handles': {
      type: 'geojson' as const,
      data: { type: 'FeatureCollection', features: [] },
    },
  }
}

export function effectiveSegmentDotRadius(config: StyleConfig): number {
  const configured = typeof config.segment_dot_size === 'number' && Number.isFinite(config.segment_dot_size)
    ? config.segment_dot_size
    : 1.5
  return Math.min(Math.max(configured, 0.5), 2.5)
}

function segmentHandleLayers(config: StyleConfig): object[] {
  const dotR = effectiveSegmentDotRadius(config)
  return [
    withScaleMetadata({
      id: 'segment-handle-dot',
      type: 'circle',
      source: 'segment-handles',
      paint: {
        'circle-radius': dotR,
        'circle-color': ['get', 'color'],
        'circle-opacity': 1,
      },
    }, CIRCLE_SCALE_PROPERTIES),
  ]
}

// Pins are rendered as maplibregl.Marker HTML elements (see MapPreview.vue → placePinMarkers).
// No MapLibre source/layers needed — markers sit in the DOM above the canvas.

// ─── Route source ─────────────────────────────────────────────────────────────
// lineMetrics must be true when using line-gradient; data is populated by MapPreview.vue.

function routeSource(config: StyleConfig): object {
  // lineMetrics is required for line-gradient, but causes MapLibre to draw connector
  // segments between MultiLineString sub-lines. Disable it when deleted ranges are
  // present so that route gaps render correctly; the layer falls back to line-color.
  const useGradient = config.route_color_mode === 'gradient' && !(config.route_deleted_ranges ?? []).length
  return {
    type: 'geojson' as const,
    data: { type: 'FeatureCollection', features: [] },
    ...(useGradient ? { lineMetrics: true } : {}),
  }
}

function hasVisibleTrailSegments(config: Pick<StyleConfig, 'trail_segments'>): boolean {
  return (config.trail_segments ?? []).some(segment => segment.visible)
}

export function shouldRenderPrimaryRoute(
  config: Pick<StyleConfig, 'trail_segments' | 'show_primary_route'>,
): boolean {
  return config.show_primary_route ?? !hasVisibleTrailSegments(config)
}

function primaryRouteSource(config: StyleConfig): Record<string, object> {
  return shouldRenderPrimaryRoute(config) ? { route: routeSource(config) } : {}
}

function primaryRouteLayers(config: StyleConfig, visibilityConfig: StyleConfig = config): object[] {
  return shouldRenderPrimaryRoute(visibilityConfig) ? routeLayers(config) : []
}

function primaryRouteLabelCollisionLayer(config: StyleConfig): object[] {
  return shouldRenderPrimaryRoute(config) ? [routeLabelCollisionLayer(config)] : []
}

// ─── Route layers ─────────────────────────────────────────────────────────────

function routeLayers(config: StyleConfig) {
  const isWatercolorRoute = config.preset?.includes('watercolor') ?? false
  const isEditorialRoute = config.color_theme === 'editorial-minimal'
  const isSeaChartRoute = config.color_theme === 'sea-chart'
  const isRisographRoute = config.color_theme === 'risograph'
  const isReliefRoute = config.color_theme === 'relief-shaded'
  const isJournalRoute = config.color_theme === 'field-journal'
  const isPleinAirRoute = config.color_theme === 'plein-air'
  const isBibRoute = config.color_theme === 'marathon-bib'
  const isBlueprintRoute = config.color_theme === 'blueprint'
  const isPerformanceRoute = config.color_theme === 'splits-stats' || config.color_theme === 'night-ride'
  const isMoonstoneRoute = config.color_theme === 'moonstone'
  const isClassicTrailRoute = config.color_theme === 'classic-trail'
  const isUsgsVintageRoute = config.color_theme === 'usgs-vintage'
  const isBotanicalRoute = config.color_theme === 'botanical'
  const isBlacklineRoute = config.color_theme === 'blackline'
  const isBrutalistRoute = config.color_theme === 'brutalist'
  const isElectricRoute = config.color_theme === 'electric-atlas'
  const isDarkSkyRoute = config.color_theme === 'dark-sky' || config.color_theme === 'copper-night'
  const routeOpacity = isSeaChartRoute ? 0 : isWatercolorRoute ? Math.min(config.route_opacity, 0.86) : config.route_opacity
  const routeBlur = isWatercolorRoute ? 0.28 : 0
  const routeLayout = {
    'line-join': 'round',
    'line-cap': 'round',
  } as const
  if (isRisographRoute) {
    return [
      withScaleMetadata({
        id: 'route-line-riso-blue',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.water_color ?? '#2f5fd0',
          'line-width': Math.max(1.2, config.route_width - 0.4),
          'line-opacity': Math.min(config.route_opacity * 0.9, 0.86),
          'line-translate': [4.2, 3.4],
        },
      }, ROUTE_SCALE_PROPERTIES),
      withScaleMetadata({
        id: 'route-line-riso-pink-overprint',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.route_color,
          'line-width': config.route_width + 1.6,
          'line-opacity': Math.min(config.route_opacity * 0.32, 0.34),
          'line-translate': [-1.4, -1],
          'line-blur': 0.45,
        },
      }, ROUTE_SCALE_PROPERTIES),
      withScaleMetadata({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.route_color,
          'line-width': config.route_width,
          'line-opacity': routeOpacity,
        },
      }, ROUTE_SCALE_PROPERTIES),
    ]
  }
  const routeWash = isWatercolorRoute
    ? [
        withScaleMetadata({
          id: 'route-line-wash',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width + (isPleinAirRoute ? 8.4 : 4.2),
            'line-opacity': Math.min(config.route_opacity * (isPleinAirRoute ? 0.38 : 0.24), isPleinAirRoute ? 0.40 : 0.28),
            'line-blur': isPleinAirRoute ? 4.6 : 2.8,
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const editorialGalleryLayers = isEditorialRoute
    ? [
        withScaleMetadata({
          id: 'route-line-editorial-gallery-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#6F4A37',
            'line-width': config.route_width + 5.2,
            'line-opacity': Math.min(config.route_opacity * 0.10, 0.10),
            'line-blur': 2.4,
            'line-translate': [1.2, 1.4],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-editorial-paper-channel',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#F8F3EA',
            'line-width': config.route_width + 2.2,
            'line-opacity': Math.min(config.route_opacity * 0.58, 0.58),
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const editorialGalleryMarks = isEditorialRoute
    ? [
        withScaleMetadata({
          id: 'route-line-editorial-ink-ridge',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#5E2C20',
            'line-width': Math.max(1, config.route_width - 1.2),
            'line-opacity': Math.min(config.route_opacity * 0.32, 0.32),
            'line-translate': [-0.65, -0.45],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-editorial-collector-cuts',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#F8F3EA',
            'line-width': 1.05,
            'line-opacity': Math.min(config.route_opacity * 0.56, 0.56),
            'line-dasharray': [0.3, 7.2],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const reliefShadow = isReliefRoute
    ? [
        withScaleMetadata({
          id: 'route-line-relief-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#F5EFE2',
            'line-width': config.route_width + 3.4,
            'line-opacity': Math.min(config.route_opacity * 0.92, 0.92),
            'line-blur': 0.15,
            'line-translate': [0, 0],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-relief-highlight',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#14110D',
            'line-width': Math.max(1, config.route_width - 0.8),
            'line-opacity': Math.min(config.route_opacity, 0.96),
            'line-blur': 0,
            'line-translate': [0, 0],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const journalInkLayers = isJournalRoute
    ? [
        withScaleMetadata({
          id: 'route-line-journal-wash',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#A17B4D',
            'line-width': config.route_width + 4.1,
            'line-opacity': Math.min(config.route_opacity * 0.28, 0.30),
            'line-blur': 1.7,
            'line-translate': [1.3, 1.1],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-journal-drybrush',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': Math.max(1, config.route_width - 0.25),
            'line-opacity': Math.min(config.route_opacity * 0.78, 0.80),
            'line-dasharray': [1.25, 0.52],
            'line-translate': [-0.8, 0.7],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const contourStudyLayers: object[] = []
  const contourStudyMarks: object[] = []
  const seaChartCourseLayers = isSeaChartRoute
    ? [
        withScaleMetadata({
          id: 'route-line-sea-course-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#1D2A36',
            'line-width': config.route_width + 3.2,
            'line-opacity': Math.min(config.route_opacity * 0.22, 0.22),
            'line-blur': 0.8,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-sea-course',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width,
            'line-opacity': Math.min(config.route_opacity * 0.92, 0.92),
            'line-dasharray': [1.2, 2.8],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const seaChartWaypointLayers = isSeaChartRoute
    ? [
        withScaleMetadata({
          id: 'route-line-sea-waypoints',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 44,
            'text-field': '•',
            'text-font': ['Noto Sans Regular'],
            'text-size': 16,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.route_color,
            'text-opacity': Math.min(config.route_opacity * 0.98, 0.98),
            'text-halo-color': config.background_color ?? '#E4EDE7',
            'text-halo-width': 1.2,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const electricAtlasLayers = isElectricRoute
    ? [
        withScaleMetadata({
          id: 'route-line-electric-glow-wide',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#0DE8FF',
            'line-width': config.route_width + 10,
            'line-opacity': Math.min(config.route_opacity * 0.18, 0.18),
            'line-blur': 6,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-electric-glow-hot',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width + 4.6,
            'line-opacity': Math.min(config.route_opacity * 0.36, 0.36),
            'line-blur': 2.4,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-electric-offset',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#35F3FF',
            'line-width': Math.max(1, config.route_width - 1.15),
            'line-opacity': Math.min(config.route_opacity * 0.58, 0.58),
            'line-translate': [1.7, 1.2],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const electricAtlasMarks = isElectricRoute
    ? [
        withScaleMetadata({
          id: 'route-line-electric-pulse',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#5FC3DD',
            'line-width': 1.2,
            'line-opacity': Math.min(config.route_opacity * 0.72, 0.72),
            'line-dasharray': [0.5, 7.2],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const darkSkyRouteLayers = isDarkSkyRoute
    ? [
        withScaleMetadata({
          id: 'route-line-darksky-glow-wide',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width + 8,
            'line-opacity': Math.min(config.route_opacity * 0.18, 0.18),
            'line-blur': 5.2,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-darksky-glow-core',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width + 3.2,
            'line-opacity': Math.min(config.route_opacity * 0.28, 0.28),
            'line-blur': 1.8,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-darksky-offset-starpath',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#E7ECFB',
            'line-width': Math.max(1, config.route_width - 1.25),
            'line-opacity': Math.min(config.route_opacity * 0.34, 0.34),
            'line-translate': [1.6, -1.3],
            'line-dasharray': [0.55, 6.4],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const darkSkyRouteMarks = isDarkSkyRoute
    ? [
        withScaleMetadata({
          id: 'route-line-darksky-constellation',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 76,
            'text-field': '•',
            'text-font': ['Noto Sans Regular'],
            'text-size': 20,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.label_text_color ?? '#E7ECFB',
            'text-opacity': Math.min(config.route_opacity * 0.82, 0.82),
            'text-halo-color': config.background_color ?? '#070C1E',
            'text-halo-width': 1.1,
          },
        }, SYMBOL_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-darksky-star-crosses',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 142,
            'text-field': '✦',
            'text-font': ['Noto Sans Regular'],
            'text-size': 9,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.route_color,
            'text-opacity': Math.min(config.route_opacity * 0.52, 0.52),
            'text-halo-color': config.background_color ?? '#070C1E',
            'text-halo-width': 1.1,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const bibRaceLayers = isBibRoute
    ? [
        withScaleMetadata({
          id: 'route-line-bib-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#14264A',
            'line-width': config.route_width + 3.8,
            'line-opacity': Math.min(config.route_opacity * 0.13, 0.13),
            'line-blur': 1.1,
            'line-translate': [1.2, 1.2],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-bib-knockout',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#FBFAF4',
            'line-width': config.route_width + 2.2,
            'line-opacity': Math.min(config.route_opacity * 0.82, 0.82),
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const bibMileLayers = isBibRoute
    ? [
        withScaleMetadata({
          id: 'route-line-bib-mile-dashes',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#0A0A0A',
            'line-width': 1.35,
            'line-opacity': Math.min(config.route_opacity * 0.56, 0.56),
            'line-dasharray': [0.35, 8],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-bib-mile-ticks',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 82,
            'text-field': '|',
            'text-font': ['Noto Sans Regular'],
            'text-size': 15,
            'text-rotate': 90,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.label_text_color ?? '#0A0A0A',
            'text-opacity': Math.min(config.route_opacity * 0.48, 0.48),
            'text-halo-color': config.background_color ?? '#FBFAF4',
            'text-halo-width': 1,
          },
        }, SYMBOL_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-bib-checkpoint-dots',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 168,
            'text-field': '●',
            'text-font': ['Noto Sans Regular'],
            'text-size': 15,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.background_color ?? '#FBFAF4',
            'text-opacity': Math.min(config.route_opacity * 0.95, 0.95),
            'text-halo-color': config.route_color ?? '#E0322C',
            'text-halo-width': 2.8,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const moonstoneEtchLayers = isMoonstoneRoute
    ? [
        withScaleMetadata({
          id: 'route-line-moonstone-engraved-channel',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#EEF0ED',
            'line-width': config.route_width + 3.4,
            'line-opacity': Math.min(config.route_opacity * 0.92, 0.92),
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-moonstone-blueprint-offset',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.contour_major_color ?? '#687972',
            'line-width': Math.max(1, config.route_width - 0.85),
            'line-opacity': Math.min(config.route_opacity * 0.34, 0.34),
            'line-translate': [1.4, -1.2],
            'line-dasharray': [1.4, 0.5],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const blueprintDraftLayers = isBlueprintRoute
    ? [
        withScaleMetadata({
          id: 'route-line-blueprint-construction-glow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.contour_major_color ?? '#8AB7E3',
            'line-width': config.route_width + 5.2,
            'line-opacity': Math.min(config.route_opacity * 0.18, 0.18),
            'line-blur': 1.35,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-blueprint-drafting-offset',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#DCEEFF',
            'line-width': Math.max(1, config.route_width - 0.72),
            'line-opacity': Math.min(config.route_opacity * 0.38, 0.38),
            'line-translate': [1.2, -1.1],
            'line-dasharray': [1.65, 0.55],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const blueprintDraftMarks = isBlueprintRoute
    ? [
        withScaleMetadata({
          id: 'route-line-blueprint-station-crosses',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 78,
            'text-field': '+',
            'text-font': ['Noto Sans Regular'],
            'text-size': 10,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.label_text_color ?? '#DCEEFF',
            'text-opacity': Math.min(config.route_opacity * 0.56, 0.56),
            'text-halo-color': config.route_color ?? '#FFD45A',
            'text-halo-width': 0.8,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const moonstoneSurveyMarks = isMoonstoneRoute
    ? [
        withScaleMetadata({
          id: 'route-line-moonstone-survey-ticks',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 72,
            'text-field': '╋',
            'text-font': ['Noto Sans Regular'],
            'text-size': 10,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.contour_major_color ?? '#687972',
            'text-opacity': Math.min(config.route_opacity * 0.48, 0.48),
            'text-halo-color': config.background_color ?? '#EEF0ED',
            'text-halo-width': 1.2,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const classicTrailLayers = isClassicTrailRoute
    ? [
        withScaleMetadata({
          id: 'route-line-classic-trail-paper-channel',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#EEEEEA',
            'line-width': config.route_width + 2.4,
            'line-opacity': Math.min(config.route_opacity * 0.82, 0.82),
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-classic-trail-slate-offset',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.contour_major_color ?? '#5F6E7E',
            'line-width': Math.max(1, config.route_width - 0.45),
            'line-opacity': Math.min(config.route_opacity * 0.34, 0.34),
            'line-translate': [1.1, 1],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const classicTrailMarks: object[] = []
  const usgsVintageLayers = isUsgsVintageRoute
    ? [
        withScaleMetadata({
          id: 'route-line-usgs-paper-channel',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#F5EED8',
            'line-width': config.route_width + 2.9,
            'line-opacity': Math.min(config.route_opacity * 0.78, 0.78),
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const usgsVintageMarks: object[] = []
  const pleinAirBrushMarks = isPleinAirRoute
    ? [
        withScaleMetadata({
          id: 'route-line-plein-air-drybrush',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#7D3E28',
            'line-width': Math.max(1, config.route_width - 0.55),
            'line-opacity': Math.min(config.route_opacity * 0.34, 0.34),
            'line-blur': 0.22,
            'line-dasharray': [1.2, 0.55],
            'line-translate': [-0.55, -0.35],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const botanicalSpecimenLayers = isBotanicalRoute
    ? [
        withScaleMetadata({
          id: 'route-line-botanical-pressed',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.water_color ?? '#A7BFA8',
            'line-width': config.route_width + 6.6,
            'line-opacity': Math.min(config.route_opacity * 0.12, 0.12),
            'line-blur': 1.6,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-botanical-vein',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color ?? '#31512B',
            'line-width': Math.max(1.6, config.route_width - 0.35),
            'line-opacity': Math.min(config.route_opacity * 0.72, 0.72),
            'line-translate': [-0.45, 0.35],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-botanical-stem-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': '#2D3F22',
            'line-width': Math.max(1.1, config.route_width - 1.1),
            'line-opacity': Math.min(config.route_opacity * 0.30, 0.30),
            'line-translate': [0.8, 0.8],
            'line-blur': 0.18,
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const botanicalSpecimenMarks = isBotanicalRoute
    ? [
        withScaleMetadata({
          id: 'route-line-botanical-ink-vein',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color ?? '#31512B',
            'line-width': 1.35,
            'line-opacity': Math.min(config.route_opacity * 0.88, 0.88),
            'line-translate': [-0.2, -0.2],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-botanical-leaf-cuts',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#EFE6D4',
            'line-width': Math.max(1, config.route_width - 1.6),
            'line-opacity': Math.min(config.route_opacity * 0.12, 0.12),
            'line-dasharray': [0.22, 5.4],
            'line-translate': [0.45, -0.35],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-botanical-specimen-dots',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 74,
            'text-field': '·',
            'text-font': ['Noto Sans Regular'],
            'text-size': 31,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.route_color,
            'text-opacity': Math.min(config.route_opacity * 0.32, 0.32),
            'text-halo-color': config.background_color ?? '#EFE6D4',
            'text-halo-width': 1,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const performanceTraceLayers = isPerformanceRoute
    ? [
        withScaleMetadata({
          id: 'route-line-performance-glow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.route_color,
            'line-width': config.route_width + 5.4,
            'line-opacity': Math.min(config.route_opacity * 0.20, 0.20),
            'line-blur': 1.15,
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-performance-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#0B0D10',
            'line-width': config.route_width + 2.2,
            'line-opacity': Math.min(config.route_opacity * 0.78, 0.78),
            'line-translate': [1.1, 1.1],
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const performanceSplitMarks = isPerformanceRoute
    ? [
        withScaleMetadata({
          id: 'route-line-performance-split-cuts',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#0B0D10',
            'line-width': Math.max(1, config.route_width - 1.25),
            'line-opacity': Math.min(config.route_opacity * 0.64, 0.64),
            'line-dasharray': [0.34, 4.8],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-performance-checkpoints',
          type: 'symbol',
          source: 'route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 84,
            'text-field': '●',
            'text-font': ['Noto Sans Regular'],
            'text-size': 9,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-keep-upright': false,
          },
          paint: {
            'text-color': config.route_color,
            'text-opacity': Math.min(config.route_opacity * 0.72, 0.72),
            'text-halo-color': config.background_color ?? '#0B0D10',
            'text-halo-width': 1.15,
          },
        }, SYMBOL_SCALE_PROPERTIES),
      ]
    : []
  const modernistPrintLayers: object[] = []
  const modernistRegisterMarks: object[] = []
  const blacklineProofLayers = isBlacklineRoute
    ? [
        withScaleMetadata({
          id: 'route-line-blackline-plate',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_bg_color ?? '#11100E',
            'line-width': config.route_width + 2.6,
            'line-opacity': Math.min(config.route_opacity * 0.16, 0.16),
            'line-translate': [1.5, 1.5],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-blackline-knockout',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#F6F2EA',
            'line-width': config.route_width + 1.6,
            'line-opacity': Math.min(config.route_opacity * 0.86, 0.86),
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const blacklineRegisterMarks: object[] = []
  const brutalistProofLayers = isBrutalistRoute
    ? [
        withScaleMetadata({
          id: 'route-line-brutalist-slab-shadow',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.label_text_color ?? '#0A0A0A',
            'line-width': config.route_width + 5,
            'line-opacity': Math.min(config.route_opacity * 0.13, 0.13),
            'line-blur': 0.65,
            'line-translate': [2.4, 2.4],
          },
        }, ROUTE_SCALE_PROPERTIES),
        withScaleMetadata({
          id: 'route-line-brutalist-cement-cut',
          type: 'line',
          source: 'route',
          layout: routeLayout,
          paint: {
            'line-color': config.background_color ?? '#E4E0D7',
            'line-width': config.route_width + 2,
            'line-opacity': Math.min(config.route_opacity * 0.80, 0.80),
          },
        }, ROUTE_SCALE_PROPERTIES),
      ]
    : []
  const brutalistProofMarks: object[] = []
  const casing = withScaleMetadata({
    id: 'route-line-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
        'line-color': isPleinAirRoute ? '#F4E9D6' : isWatercolorRoute ? '#f6eed8' : mapBackgroundColor(config),
        'line-width': config.route_width + (isWatercolorRoute ? 3.5 : DEFAULT_ROUTE_CASING_WIDTH),
        'line-opacity': isSeaChartRoute ? 0 : isWatercolorRoute ? Math.min(config.route_opacity, isPleinAirRoute ? 0.58 : 0.78) : config.route_opacity,
        ...(isWatercolorRoute ? { 'line-blur': isPleinAirRoute ? 1.05 : 0.65 } : {}),
    },
  }, ROUTE_SCALE_PROPERTIES)

  const useGradient = config.route_color_mode === 'gradient' && !(config.route_deleted_ranges ?? []).length
  if (useGradient) {
    return [
      ...routeWash,
      ...seaChartCourseLayers,
      casing,
      withScaleMetadata({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-gradient': ELEVATION_GRADIENT_PAINT,
          'line-width': config.route_width,
          'line-opacity': routeOpacity,
          ...(isWatercolorRoute ? { 'line-blur': routeBlur } : {}),
        },
      }, ROUTE_SCALE_PROPERTIES),
      ...seaChartWaypointLayers,
    ]
  }

  return [
    ...routeWash,
    ...editorialGalleryLayers,
    ...reliefShadow,
    ...journalInkLayers,
    ...contourStudyLayers,
    ...seaChartCourseLayers,
    ...electricAtlasLayers,
    ...darkSkyRouteLayers,
    ...bibRaceLayers,
    ...blueprintDraftLayers,
    ...moonstoneEtchLayers,
    ...classicTrailLayers,
    ...usgsVintageLayers,
    ...botanicalSpecimenLayers,
    ...performanceTraceLayers,
    ...modernistPrintLayers,
    ...blacklineProofLayers,
    ...brutalistProofLayers,
    casing,
    withScaleMetadata({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: routeLayout,
      paint: {
        'line-color': config.route_color,
        'line-width': config.route_width,
        'line-opacity': routeOpacity,
        ...(isWatercolorRoute ? { 'line-blur': routeBlur } : {}),
      },
    }, ROUTE_SCALE_PROPERTIES),
    ...seaChartWaypointLayers,
    ...editorialGalleryMarks,
    ...bibMileLayers,
    ...blueprintDraftMarks,
    ...moonstoneSurveyMarks,
    ...classicTrailMarks,
    ...usgsVintageMarks,
    ...pleinAirBrushMarks,
    ...botanicalSpecimenMarks,
    ...performanceSplitMarks,
    ...contourStudyMarks,
    ...electricAtlasMarks,
    ...darkSkyRouteMarks,
    ...modernistRegisterMarks,
    ...blacklineRegisterMarks,
    ...brutalistProofMarks,
  ]
}

function routeLabelCollisionLayer(config: StyleConfig) {
  const routeCollisionSize = Math.max(12, (config.route_width ?? 4) + 12)

  return withScaleMetadata({
    id: 'route-label-collision',
    type: 'symbol',
    source: 'route',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 28,
      'text-field': 'XXXX',
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, routeCollisionSize * 0.75, 14, routeCollisionSize],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-keep-upright': false,
      'visibility': 'visible',
    },
    paint: {
      'text-opacity': 0,
    },
  }, SYMBOL_SCALE_PROPERTIES)
}

const ROUTE_AVOIDING_LABEL_ANCHORS = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
]

// ─── Minimalist Style ─────────────────────────────────────────────────────────

function buildMinimalistStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const maptilerTk = maptilerToken || ''
  const base = config.base_tile_style ?? 'carto-light'
  const usingMlContour = !!contourTileUrl

  // ── Resolve base tiles ─────────────────────────────────────────────────────
  let baseTileSource: object
  let baseTileOpacity: number
  let baseTileAttribution: string

  if (base === 'maptiler-outdoor' || base === 'maptiler-topo' || base === 'maptiler-winter') {
    const styleMap: Record<string, string> = {
      'maptiler-outdoor': 'outdoor-v2',
      'maptiler-topo': 'topo-v2',
      'maptiler-winter': 'winter-v2',
    }
    baseTileSource = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
      tileSize: 512,
    }
    baseTileOpacity = 0.85
    baseTileAttribution = '© MapTiler © OpenStreetMap contributors'
  } else {
    const dark = base === 'carto-dark'
    // @2x raster tiles for retina/print quality. CARTO basemaps support
    // the `{r}` retina suffix; we hard-code `@2x` and bump tileSize to
    // 512 so MapLibre renders glyphs/edges sharply at print DPI.
    const sub = (s: string) =>
      ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}@2x.png`)
    baseTileSource = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, dark ? sub('dark_all') : sub('light_all')),
      tileSize: 512,
    }
    baseTileOpacity = base === 'carto-dark' ? 0.45 : 0.55
    baseTileAttribution = '© CARTO © OpenStreetMap contributors'
  }

  return {
    version: 8,
    name: 'RadMaps Minimalist',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': { ...baseTileSource, attribution: baseTileAttribution },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    baseTileOpacity,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Route-Only Style ─────────────────────────────────────────────────────────
// No base raster tiles — just a solid background + route + optional contours/terrain.
// Produces the clean "route on paper" look: solid colour field, route line, faint labels.

function buildAtlasContourLayers(config: StyleConfig, usingMlContour: boolean, options: {
  watercolor: boolean
  night: boolean
  simple: boolean
  ghostTexture?: boolean
}): object[] {
  if (!config.show_contours) return []
  if (!usingMlContour) return []

  const contourSettings = config.atlas_layer_settings?.contour
  const minorOpacity = atlasNumberSetting(contourSettings?.minor_opacity, config.contour_opacity)
  const majorOpacity = atlasNumberSetting(contourSettings?.major_opacity ?? contourSettings?.index_opacity, config.contour_opacity)
  const midOpacity = Math.max(0, minorOpacity * 0.55)
  const ghostOpacity = options.simple || options.ghostTexture === false ? 0 : options.watercolor ? 0.075 : options.night ? 0.12 : 0.08
  const layers: object[] = []
  if (ghostOpacity > 0) {
    layers.push(withScaleMetadata({
      id: 'contours-ghost-texture',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: contourFeatureFilter(config, ['!=', ['get', 'level'], 1]),
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ghostOpacity,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, options.watercolor ? 2.2 : 1.6],
        'line-blur': options.watercolor ? 1.6 : 0.8,
      },
    }, LINE_SCALE_PROPERTIES))
  }

  layers.push(
    withScaleMetadata({
      id: 'contours-minor',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: contourFeatureFilter(config, ['!=', ['get', 'level'], 1]),
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': contourMinorLineOpacityExpression(minorOpacity),
        'line-width': contourMinorLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.25 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
    withScaleMetadata({
      id: 'contours-mid',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: contourFeatureFilter(config, ['==', ['get', 'level'], 1]),
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': midOpacity,
        'line-width': contourMidLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.2 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
    withScaleMetadata({
      id: 'contours-major',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: contourFeatureFilter(config, ['==', ['get', 'level'], 1]),
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_major_color,
        'line-opacity': majorOpacity,
        'line-width': contourMajorLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.08 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
  )

  if (config.show_elevation_labels) {
    layers.push(withScaleMetadata({
      id: 'contours-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contours',
      filter: contourFeatureFilter(config, ['==', ['get', 'level'], 1]),
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 500,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
        'text-letter-spacing': 0.06,
        'text-padding': 4,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': config.background_color,
        'text-halo-width': options.watercolor ? 2.4 : 2,
        'text-opacity': options.watercolor ? config.contour_opacity * 0.7 : config.contour_opacity,
      },
    }, SYMBOL_SCALE_PROPERTIES))
  }

  return layers
}

function buildRadMapsAtlasStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const preset = config.preset || 'radmaps-field-topo'
  const isWatercolor = preset.includes('watercolor')
  const isWatercolorArtTile = preset === 'radmaps-watercolor'
  const isWatercolorClassic = preset === 'radmaps-watercolor-classic'
  const isPigmentWash = preset === 'radmaps-watercolor-pigment-wash'
  const isWatercolorPaper = preset === 'radmaps-watercolor-paper'
  const isBrushInk = preset === 'radmaps-watercolor-brush-ink'
  const isNight = preset === 'radmaps-night-relief'
  const isDarkAtlas = isNight || preset === 'radmaps-alidade-dark'
  const isToner = isRadMapsTonerPreset(preset)
  const tonerPalette = isToner ? resolveTonerPalette(config) : null
  const isContourWash = preset === 'radmaps-contour-wash'
  const isSimpleContour = preset === 'radmaps-simple-contour'
  const atlasSettings = config.atlas_layer_settings ?? {}
  const useThemeLayerColors = !isDarkAtlas && !isContourWash && !isToner
  const themeLand = useThemeLayerColors ? config.land_color : undefined
  const themeWater = useThemeLayerColors ? config.water_color : undefined
  const ink = isDarkAtlas ? (config.label_text_color || '#d8f2dc') : tonerPalette?.ink ?? (config.label_text_color || '#405340')
  const land = atlasSettings.landcover?.color || themeLand || (isDarkAtlas ? '#102a1d' : isWatercolorClassic ? '#d9e4d3' : isPigmentWash ? '#e2ead2' : isWatercolorPaper ? '#eadfc8' : isBrushInk ? '#d7e4c9' : isContourWash ? '#d7e8f7' : tonerPalette?.land ?? '#e7dfbf')
  const water = atlasSettings.water?.fill_color || themeWater || (isDarkAtlas ? '#3f9fbd' : isWatercolorClassic ? '#78bdca' : isPigmentWash ? '#6bbfd0' : isWatercolorPaper ? '#8bbdc4' : isBrushInk ? '#43aec8' : isContourWash ? '#bad9ef' : tonerPalette?.water ?? '#79b7c8')
  const waterway = atlasSettings.waterway?.color || atlasSettings.water?.waterway_color || tonerPalette?.waterway || water
  const park = atlasSettings.park?.fill_color || themeLand || (isDarkAtlas ? '#193f25' : isWatercolorClassic ? '#c3d8b4' : isPigmentWash ? '#bdd3aa' : isWatercolorPaper ? '#d1c69f' : isBrushInk ? '#adc99b' : isContourWash ? '#d3e2ec' : tonerPalette?.park ?? '#c9d29a')
  const road = atlasSettings.transportation?.road_color || (isToner ? tonerPalette?.roadMajor : config.roads_color) || (isWatercolorClassic ? '#9a8d86' : isPigmentWash ? '#a68b84' : isWatercolorPaper ? '#9b806d' : isBrushInk ? '#8f5966' : isDarkAtlas ? '#f18f45' : isContourWash ? '#8aa6bd' : tonerPalette?.roadMajor ?? '#b7663c')
  const roadMajor = atlasSettings.transportation?.major_color || tonerPalette?.roadMajor || road
  const roadMinor = atlasSettings.transportation?.minor_color || tonerPalette?.roadMinor || road
  const trail = atlasSettings.transportation?.trail_color || tonerPalette?.trail || (isWatercolorClassic ? '#8c9d7c' : isPigmentWash ? '#8ea27a' : isWatercolorPaper ? '#9b8c61' : isBrushInk ? '#7f8f70' : isContourWash ? '#7d9ab3' : ink)
  const labelHalo = atlasSettings.place?.halo_color || (isDarkAtlas ? '#0b1d15' : isWatercolorClassic ? '#edf1e4' : isPigmentWash ? '#eef1df' : isWatercolorPaper ? '#f2e8d3' : isBrushInk ? '#f4ebd8' : isContourWash ? '#d7e8f7' : tonerPalette?.labelHalo ?? '#f7f2e7')
  const label = atlasSettings.place?.label_color || (isToner ? tonerPalette?.label : config.place_labels_color) || config.label_text_color || (isDarkAtlas ? '#e5f3d8' : '#29362d')
  const poiLabel = atlasSettings.poi?.label_color || (isToner ? tonerPalette?.poiLabel : config.poi_labels_color) || label
  const roadOpacity = atlasNumberSetting(atlasSettings.transportation?.opacity ?? config.roads_opacity, isWatercolorClassic ? 0.28 : isPigmentWash ? 0.34 : isWatercolorPaper ? 0.24 : isBrushInk ? 0.48 : isDarkAtlas ? 0.9 : isContourWash ? 0.18 : tonerPalette?.roadOpacity ?? 0.82)
  const usingMlContour = !!contourTileUrl
  const defaultContours = !isWatercolorArtTile && (config.show_contours || isSimpleContour || isContourWash || preset === 'radmaps-field-topo' || preset === 'radmaps-topographic' || preset === 'radmaps-natural' || preset === 'radmaps-night-relief')
  const wantsContours = atlasLayerEnabled(config, 'contour', defaultContours) && defaultContours
  const showLandcover = atlasLayerEnabled(config, 'landcover')
  const showPark = atlasLayerEnabled(config, 'park')
  const showWater = atlasLayerEnabled(config, 'water')
  const showWaterway = atlasLayerEnabled(config, 'waterway')
  const showBuildings = atlasLayerEnabled(config, 'building')
  const showTransportation = atlasLayerEnabled(config, 'transportation', config.show_roads ?? true) && config.show_roads !== false
  const showMajorRoads = showTransportation && (atlasSettings.transportation?.show_major ?? true)
  const showMinorRoads = showTransportation && (atlasSettings.transportation?.show_minor ?? true)
  const showTrails = showTransportation && (atlasSettings.transportation?.show_trails ?? true)
  const showPlaces = atlasLayerEnabled(config, 'place', config.show_place_labels !== false) && config.show_place_labels !== false
  const showPois = atlasLayerEnabled(config, 'poi', config.show_poi_labels ?? true) && config.show_poi_labels !== false
  const showOutdoorRoutes = atlasLayerEnabled(config, 'outdoorRoute')
  const atlasFillSmoothing = { 'fill-antialias': !tonerPalette }
  const waterEdgeLayerId = isWatercolor ? `${preset}-water-edge-bloom` : `${preset}-water-edge-soften`
  const waterEdgeOpacity = isWatercolor
    ? (isWatercolorClassic ? 0.30 : isPigmentWash ? 0.28 : isWatercolorPaper ? 0.24 : 0.42)
    : (tonerPalette ? 0.12 : isDarkAtlas ? 0.32 : isContourWash ? 0.22 : isSimpleContour ? 0.16 : 0.24)
  const waterEdgeBlur = isWatercolor
    ? (isWatercolorPaper ? 1.8 : isBrushInk ? 1.4 : 2.2)
    : (tonerPalette ? 0.65 : isDarkAtlas ? 1.35 : isContourWash ? 1.1 : 1.0)
  const waterEdgeWidth = isWatercolor
    ? ['interpolate', ['linear'], ['zoom'], 5, 1.4, 12, isWatercolorPaper ? 3.8 : isBrushInk ? 3.2 : 4.6, 16, isWatercolorPaper ? 5.8 : isBrushInk ? 5.2 : 6.6]
    : ['interpolate', ['linear'], ['zoom'], 5, tonerPalette ? 0.7 : 0.95, 12, isDarkAtlas ? 3.4 : 2.8, 16, isDarkAtlas ? 5.0 : 4.0]
  const waterwaySoftLayerId = isWatercolor ? `${preset}-waterway-bloom` : `${preset}-waterway-soften`
  const waterwayConfiguredWidth = atlasSettings.waterway?.width ?? atlasSettings.water?.waterway_width
  const waterwayMinWidth = Math.max(0.05, (waterwayConfiguredWidth ?? 1) * (isWatercolor ? 0.55 : 0.35))
  const waterwayMidWidth = waterwayConfiguredWidth ?? (isPigmentWash ? 1.6 : 1.1)
  const waterwayMaxWidth = waterwayConfiguredWidth ?? (isPigmentWash ? 2.8 : 2.0)
  const waterwaySoftOpacity = isWatercolor
    ? (isWatercolorClassic ? 0.34 : isPigmentWash ? 0.32 : isWatercolorPaper ? 0.28 : 0.42)
    : (tonerPalette ? 0.10 : isDarkAtlas ? 0.26 : isContourWash ? 0.18 : 0.20)
  const waterwaySoftBlur = isWatercolor
    ? (isWatercolorPaper ? 1.5 : isBrushInk ? 1.2 : 2.1)
    : (tonerPalette ? 0.45 : isDarkAtlas ? 0.85 : 0.65)
  const waterwaySoftWidth = isWatercolor
    ? ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, isWatercolorPaper ? 2.6 : isBrushInk ? 2.6 : 3.6, 15, isWatercolorPaper ? 4.4 : isBrushInk ? 4.6 : 5.8]
    : ['interpolate', ['linear'], ['zoom'], 8, waterwayMinWidth + 0.7, 13, waterwayMidWidth + 1.6, 15, waterwayMaxWidth + 2.4]
  const waterwayCoreBlur = isWatercolor
    ? (isWatercolorPaper ? 0.25 : isBrushInk ? 0.15 : 0.45)
    : (tonerPalette ? 0.04 : 0.12)

  const sources: Record<string, object> = {
    'radmaps-atlas-base': {
      type: 'vector' as const,
      tiles: [atlasTileUrl('base')],
      minzoom: 0,
      maxzoom: 14,
      attribution: '© OpenStreetMap contributors © RadMaps Atlas',
    },
    ...(showPois ? {
      'radmaps-atlas-poi': {
        type: 'vector' as const,
        tiles: [atlasTileUrl('poi')],
        minzoom: 0,
        maxzoom: 16,
        attribution: '© Overture Maps Foundation © OpenStreetMap contributors © RadMaps Atlas',
      },
    } : {}),
    ...(showOutdoorRoutes ? {
      'radmaps-atlas-outdoor-routes': {
        type: 'vector' as const,
        tiles: [atlasTileUrl('outdoorRoutes')],
        minzoom: 0,
        maxzoom: 16,
        attribution: '© OpenStreetMap contributors © RadMaps Atlas',
      },
    } : {}),
    ...primaryRouteSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }
  if (isWatercolorArtTile) {
    sources['radmaps-watercolor-base'] = {
      type: 'raster' as const,
      tiles: [watercolorTileUrl(config)],
      tileSize: WATERCOLOR_MAPLIBRE_TILE_SIZE,
      minzoom: 0,
      maxzoom: WATERCOLOR_RENDER_MAXZOOM,
      attribution: '© OpenStreetMap contributors © RadMaps Atlas',
    }
  }

  if (wantsContours) {
    Object.assign(sources, contourSource(token, contourTileUrl))
  }
  if (config.show_hillshade && !isSimpleContour) {
    Object.assign(sources, demSource(token))
  }

  const explicitContourColor = config.contour_color !== DEFAULT_STYLE_CONFIG.contour_color ? config.contour_color : undefined
  const explicitContourMajorColor = config.contour_major_color !== DEFAULT_STYLE_CONFIG.contour_major_color ? config.contour_major_color : undefined
  const explicitContourOpacity = config.contour_opacity !== DEFAULT_STYLE_CONFIG.contour_opacity ? config.contour_opacity : undefined
  const explicitContourMinorWidth = config.contour_minor_width !== DEFAULT_STYLE_CONFIG.contour_minor_width ? config.contour_minor_width : undefined
  const explicitContourMajorWidth = config.contour_major_width !== DEFAULT_STYLE_CONFIG.contour_major_width ? config.contour_major_width : undefined
  const explicitElevationLabels = config.show_elevation_labels !== DEFAULT_STYLE_CONFIG.show_elevation_labels ? config.show_elevation_labels : undefined
  const contourColor = explicitContourColor ?? atlasSettings.contour?.minor_color ?? (isContourWash ? undefined : config.contour_color) ?? (isDarkAtlas ? '#63a97c' : isContourWash ? '#75a8d2' : isWatercolor ? '#78996e' : '#8b875e')
  const contourMajorColor = explicitContourMajorColor ?? atlasSettings.contour?.major_color ?? atlasSettings.contour?.index_color ?? (isContourWash ? undefined : config.contour_major_color) ?? (isDarkAtlas ? '#8ed39f' : isContourWash ? '#4c7fa9' : isWatercolor ? '#6f885f' : '#68653f')
  const contourOpacity = atlasNumberSetting(explicitContourOpacity ?? atlasSettings.contour?.minor_opacity ?? config.contour_opacity, isContourWash ? 0.46 : isSimpleContour ? 0.75 : isWatercolor ? 0.22 : isDarkAtlas ? 0.46 : 0.34)
  const atlasContourHasOpacitySplit = atlasSettings.contour?.major_opacity != null || atlasSettings.contour?.index_opacity != null
  const contourLayerSettings = explicitContourOpacity == null || atlasContourHasOpacitySplit
    ? atlasSettings
    : {
        ...atlasSettings,
        contour: {
          ...atlasSettings.contour,
          minor_opacity: undefined,
          major_opacity: undefined,
          index_opacity: undefined,
        },
      }
  const contourConfig: StyleConfig = {
    ...config,
    atlas_layer_settings: contourLayerSettings,
    show_contours: wantsContours,
    contour_color: contourColor,
    contour_major_color: contourMajorColor,
    contour_opacity: contourOpacity,
    contour_minor_width: explicitContourMinorWidth ?? atlasSettings.contour?.minor_width ?? config.contour_minor_width,
    contour_major_width: explicitContourMajorWidth ?? atlasSettings.contour?.major_width ?? atlasSettings.contour?.index_width ?? config.contour_major_width,
    show_elevation_labels: explicitElevationLabels ?? atlasSettings.contour?.labels ?? config.show_elevation_labels,
    background_color: labelHalo,
  }
  const atlasContourLayers = wantsContours
    ? buildAtlasContourLayers(contourConfig, usingMlContour, {
        watercolor: isWatercolor,
        night: isNight,
        simple: isSimpleContour,
        ghostTexture: !['blackline', 'bold-modern', 'brutalist', 'contour-wash', 'copper-night'].includes(config.color_theme ?? ''),
      })
    : []
  const routeConfig = tonerPalette ? { ...config, ...resolveTonerRouteStyle(config), background_color: tonerPalette.background } : config
  const tonerPatternVariant = tonerPalette?.variant
  const mapBackground = config.color_theme === 'brutalist'
    ? '#E6E3DD'
    : isWatercolorArtTile
      ? '#eee5cd'
      : tonerPalette
        ? (atlasSettings.landcover?.color ?? tonerPalette.background)
        : (isDarkAtlas ? atlasSettings.landcover?.color || land : land)
  const styleName = tonerPalette
    ? `RadMaps Toner ${tonerPalette.variant === 'dark' ? 'Dark' : 'Light'}`
    : `RadMaps Atlas ${preset}`

  return {
    version: 8,
    name: styleName,
    // Atlas labels use open MapLibre demo glyphs for local/proof testing so
    // owned styles do not depend on Mapbox font stacks just because a token is
    // present in the runtime config.
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackground } },
      ...(isWatercolorArtTile ? [{ id: 'radmaps-watercolor-base', type: 'raster', source: 'radmaps-watercolor-base', paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } }] : []),
      ...(!isWatercolorArtTile && isWatercolor && showLandcover ? [{ id: `${preset}-paper-wash`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'landcover', paint: { 'fill-color': isWatercolorPaper ? '#f7ecd6' : '#f6efd8', 'fill-opacity': isWatercolorClassic ? 0.22 : isPigmentWash ? 0.16 : isWatercolorPaper ? 0.28 : 0.12, 'fill-translate': isWatercolorPaper ? [2.2, -1.8] : [1.4, -1.2] } }] : []),
      ...(!isWatercolorArtTile && isWatercolor && showPois ? [withScaleMetadata({ id: `${preset}-pigment-granulation`, type: 'circle', source: 'radmaps-atlas-base', 'source-layer': 'poi', minzoom: 8, paint: { 'circle-color': isWatercolorPaper ? '#a79068' : '#719471', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 0.35, 13, isWatercolorPaper ? 0.95 : 0.7, 16, isWatercolorPaper ? 1.35 : 1.0], 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, isWatercolorPaper ? 0.10 : 0.055, 14, isWatercolorPaper ? 0.16 : 0.08], 'circle-blur': isWatercolorPaper ? 0.45 : 0.75 } }, ['circle-radius'])] : []),
      ...(!isWatercolorArtTile && showLandcover ? [{ id: `${preset}-landcover`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'landcover', paint: { 'fill-color': land, 'fill-opacity': atlasNumberSetting(atlasSettings.landcover?.opacity, tonerPalette?.landOpacity ?? (isContourWash ? 0.94 : isSimpleContour ? 0.12 : isWatercolorClassic ? 0.50 : isPigmentWash ? 0.52 : isWatercolorPaper ? 0.56 : isBrushInk ? 0.68 : 0.82)), ...atlasFillSmoothing } }] : []),
      ...(!isWatercolorArtTile && tonerPatternVariant && showLandcover ? [{ id: `${preset}-natural-dots`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'landcover', filter: tonerDotNaturalFilter(), paint: { 'fill-pattern': tonerDotPatternId(tonerPatternVariant, 'soft'), 'fill-opacity': tonerPatternVariant === 'dark' ? 0.22 : 0.14, ...atlasFillSmoothing } }] : []),
      ...(!isWatercolorArtTile && isWatercolor && showPark ? [{ id: `${preset}-park-wash`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'park', paint: { 'fill-color': park, 'fill-opacity': isWatercolorClassic ? 0.22 : isPigmentWash ? 0.16 : isWatercolorPaper ? 0.24 : 0.22, 'fill-translate': [-1.2, 1.1] } }] : []),
      ...(!isWatercolorArtTile && showPark ? [{ id: `${preset}-park`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'park', paint: { 'fill-color': park, 'fill-opacity': atlasNumberSetting(atlasSettings.park?.opacity, tonerPalette?.parkOpacity ?? (isContourWash ? 0.28 : isSimpleContour ? 0.10 : isWatercolorClassic ? 0.30 : isPigmentWash ? 0.30 : isWatercolorPaper ? 0.32 : isBrushInk ? 0.46 : 0.58)), ...atlasFillSmoothing } }] : []),
      ...(!isWatercolorArtTile && tonerPatternVariant && showPark ? [{ id: `${preset}-park-dots`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'park', filter: tonerDotParkFilter(), paint: { 'fill-pattern': tonerDotPatternId(tonerPatternVariant, 'soft'), 'fill-opacity': tonerPatternVariant === 'dark' ? 0.24 : 0.16, ...atlasFillSmoothing } }] : []),
      ...(!isWatercolorArtTile && isWatercolor && showWater ? [{ id: `${preset}-water-pigment-pool`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'water', paint: { 'fill-color': water, 'fill-opacity': isWatercolorPaper ? 0.20 : 0.24, 'fill-translate': [-1.6, 1.2] } }] : []),
      ...(!isWatercolorArtTile && showWater ? [withScaleMetadata({ id: waterEdgeLayerId, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'water', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': water, 'line-opacity': waterEdgeOpacity, 'line-width': waterEdgeWidth, 'line-blur': waterEdgeBlur } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showWater ? [{ id: `${preset}-water`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'water', paint: { 'fill-color': water, 'fill-opacity': atlasNumberSetting(atlasSettings.water?.fill_opacity, tonerPalette?.waterOpacity ?? (isContourWash ? 0.36 : isWatercolorClassic ? 0.46 : isPigmentWash ? 0.48 : isWatercolorPaper ? 0.38 : isBrushInk ? 0.58 : 0.76)), ...atlasFillSmoothing, ...(isWatercolor ? { 'fill-translate': [0.7, -0.4] } : {}) } }] : []),
      ...(!isWatercolorArtTile && showWaterway ? [withScaleMetadata({ id: waterwaySoftLayerId, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'waterway', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': waterway, 'line-opacity': waterwaySoftOpacity, 'line-width': waterwaySoftWidth, 'line-blur': waterwaySoftBlur } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showWaterway ? [withScaleMetadata({ id: `${preset}-waterway`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'waterway', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': waterway, 'line-opacity': atlasNumberSetting(atlasSettings.waterway?.opacity ?? atlasSettings.water?.waterway_opacity, isWatercolorClassic ? 0.48 : isPigmentWash ? 0.50 : isWatercolorPaper ? 0.42 : isBrushInk ? 0.68 : 0.78), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, waterwayMinWidth, 13, waterwayMidWidth, 15, waterwayMaxWidth], 'line-blur': waterwayCoreBlur } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showBuildings ? [{ id: `${preset}-building`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': atlasSettings.building?.fill_color || tonerPalette?.building || ink, 'fill-opacity': atlasNumberSetting(atlasSettings.building?.opacity, tonerPalette?.buildingOpacity ?? (isSimpleContour ? 0.05 : 0.16)), ...atlasFillSmoothing } }] : []),
      ...(config.show_hillshade && !isSimpleContour ? hillshadeLayers(config) : []),
      ...atlasContourLayers,
      ...(!isWatercolorArtTile && isWatercolor && showMinorRoads ? [withScaleMetadata({ id: `${preset}-roads-minor-wash`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'street', 'residential', 'tertiary', 'unclassified']]], paint: { 'line-color': roadMinor, 'line-opacity': roadOpacity * (isWatercolorPaper ? 0.22 : isBrushInk ? 0.34 : 0.30), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, isWatercolorPaper ? 2.0 : 2.6, 16, isWatercolorPaper ? 3.7 : 4.4], 'line-blur': isWatercolorPaper ? 0.9 : isBrushInk ? 0.7 : 1.3 } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showMinorRoads ? [withScaleMetadata({ id: `${preset}-roads-minor`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'street', 'residential', 'tertiary', 'unclassified']]], paint: { 'line-color': roadMinor, 'line-opacity': roadOpacity * (tonerPalette?.minorRoadOpacity ?? (isWatercolorClassic ? 0.42 : isPigmentWash ? 0.46 : isWatercolorPaper ? 0.36 : 0.62)), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, tonerPalette ? 0.38 : 0.25, 13, atlasSettings.transportation?.minor_width ?? (tonerPalette ? 1.35 : isWatercolor ? 1.05 : 0.9), 16, (atlasSettings.transportation?.minor_width ?? (tonerPalette ? 2.65 : isWatercolor ? 2.1 : 2.1))], ...(isWatercolor ? { 'line-blur': isWatercolorPaper ? 0.1 : isBrushInk ? 0.08 : 0.25 } : {}) } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && isWatercolor && showMajorRoads ? [withScaleMetadata({ id: `${preset}-roads-major-wash`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': roadMajor, 'line-opacity': roadOpacity * (isWatercolorPaper ? 0.28 : isBrushInk ? 0.44 : 0.38), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, isWatercolorPaper ? 3.2 : 4.0, 16, isWatercolorPaper ? 5.4 : 6.4], 'line-blur': isWatercolorPaper ? 1.0 : isBrushInk ? 0.8 : 1.5 } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showMajorRoads ? [withScaleMetadata({ id: `${preset}-roads-major`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': roadMajor, 'line-opacity': roadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, tonerPalette ? 0.95 : 0.55, 12, atlasSettings.transportation?.major_width ?? (tonerPalette ? 3.3 : isWatercolor ? 2.0 : 2.0), 16, (atlasSettings.transportation?.major_width ?? (tonerPalette ? 6.6 : isWatercolor ? 4.0 : 4.2))], ...(isWatercolor ? { 'line-blur': isWatercolorPaper ? 0.08 : isBrushInk ? 0.05 : 0.18 } : {}) } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showTrails ? [withScaleMetadata({ id: `${preset}-roads-trails`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'trail', 'footway', 'cycleway', 'bridleway', 'pedestrian']]], paint: { 'line-color': trail, 'line-opacity': tonerPalette ? Math.min(roadOpacity, tonerPalette.trailOpacity) : isWatercolorClassic ? Math.min(roadOpacity, 0.28) : isPigmentWash ? Math.min(roadOpacity, 0.30) : isWatercolorPaper ? Math.min(roadOpacity, 0.24) : isWatercolor ? Math.min(roadOpacity, 0.42) : Math.min(roadOpacity, 0.65), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, tonerPalette ? 0.45 : 0.35, 14, atlasSettings.transportation?.trail_width ?? (tonerPalette ? 1.5 : 1.2), 16, (atlasSettings.transportation?.trail_width ?? (tonerPalette ? 2.6 : 2.0))], 'line-dasharray': isBrushInk || isWatercolorPaper ? [1.7, 1.1] : [1.2, 1.6], ...(isWatercolor ? { 'line-blur': isWatercolorPaper ? 0.08 : isBrushInk ? 0.05 : 0.16 } : {}) } }, LINE_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showOutdoorRoutes ? [withScaleMetadata({ id: `${preset}-outdoor-routes`, type: 'line', source: 'radmaps-atlas-outdoor-routes', 'source-layer': 'outdoor_route', minzoom: 8, filter: outdoorRouteFilter(atlasSettings.outdoorRoute), layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': atlasSettings.outdoorRoute?.color || trail, 'line-opacity': atlasNumberSetting(atlasSettings.outdoorRoute?.opacity, isWatercolor ? 0.42 : 0.58), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 12, atlasSettings.outdoorRoute?.width ?? 1.2, 16, (atlasSettings.outdoorRoute?.width ?? 2.8)], 'line-dasharray': [2.2, 1.1] } }, LINE_SCALE_PROPERTIES)] : []),
      ...primaryRouteLayers(routeConfig, config),
      ...primaryRouteLabelCollisionLayer(config),
      ...(showPlaces ? [withScaleMetadata({ id: `${preset}-place-labels`, type: 'symbol', source: 'radmaps-atlas-base', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, atlasSettings.place?.font_size ?? 9, 12, (atlasSettings.place?.font_size ?? 15)], 'text-letter-spacing': 0.02, 'text-variable-anchor': ROUTE_AVOIDING_LABEL_ANCHORS, 'text-radial-offset': isWatercolor ? 0.62 : 0.46, 'text-justify': 'auto' }, paint: { 'text-color': label, 'text-opacity': atlasNumberSetting(atlasSettings.place?.label_opacity ?? config.place_labels_opacity, isWatercolor ? 0.48 : 0.78), 'text-halo-color': atlasSettings.place?.halo_color || labelHalo, 'text-halo-width': isWatercolor ? 1.6 : 1.2 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...(showPois ? [withScaleMetadata({ id: `${preset}-poi-labels`, type: 'symbol', source: 'radmaps-atlas-base', 'source-layer': 'poi', minzoom: 12, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 11], 'text-variable-anchor': ROUTE_AVOIDING_LABEL_ANCHORS, 'text-radial-offset': 0.72, 'text-justify': 'auto' }, paint: { 'text-color': poiLabel, 'text-opacity': atlasNumberSetting(atlasSettings.poi?.label_opacity ?? config.poi_labels_opacity, isWatercolor ? 0.34 : 0.62), 'text-halo-color': labelHalo, 'text-halo-width': 1.1 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...(showPois ? [withScaleMetadata({ id: `${preset}-poi-overlay-labels`, type: 'symbol', source: 'radmaps-atlas-poi', 'source-layer': 'poi', minzoom: 12, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8.5, 15, 11.5, 16, 13], 'text-variable-anchor': ROUTE_AVOIDING_LABEL_ANCHORS, 'text-radial-offset': 0.86, 'text-justify': 'auto' }, paint: { 'text-color': poiLabel, 'text-opacity': atlasNumberSetting(atlasSettings.poi?.label_opacity ?? config.poi_labels_opacity, isWatercolor ? 0.38 : 0.66), 'text-halo-color': labelHalo, 'text-halo-width': 1.15 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...(!isWatercolorArtTile && showOutdoorRoutes && (atlasSettings.outdoorRoute?.labels ?? true) ? [withScaleMetadata({ id: `${preset}-outdoor-route-labels`, type: 'symbol', source: 'radmaps-atlas-outdoor-routes', 'source-layer': 'outdoor_route', minzoom: 10, filter: outdoorRouteFilter(atlasSettings.outdoorRoute), layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8.5, 14, 11, 16, 13], 'text-letter-spacing': 0.02 }, paint: { 'text-color': atlasSettings.outdoorRoute?.label_color || atlasSettings.outdoorRoute?.color || trail, 'text-opacity': atlasNumberSetting(atlasSettings.outdoorRoute?.label_opacity, isWatercolor ? 0.44 : 0.68), 'text-halo-color': labelHalo, 'text-halo-width': 1.2 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

function buildRouteOnlyStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const glyphs = mapboxTk
    ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
    : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

  return {
    version: 8,
    name: 'RadMaps Route Only',
    glyphs,
    sources: {
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Road-Network Style ───────────────────────────────────────────────────────
// No raster tiles — vector roads from Mapbox Streets rendered as ink lines on a
// clean background. Produces the London-poster "city map" look.
// Requires a Mapbox token (same streets source as show_roads).

function buildRoadNetworkStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const bg = mapBackgroundColor(config)
  const ink = mapInkColor(config)
  const roadColor = config.roads_color ?? ink
  const roadOpacity = config.roads_opacity ?? 1

  const sources: Record<string, object> = {
    ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
    ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
    ...primaryRouteSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  // Fills (water, landuse) belong below hillshade/contours as base features.
  // Road lines belong above hillshade/contours so labels/lines aren't cut by terrain.
  const fillLayers: object[] = []
  const roadLineLayers: object[] = []

  if (token) {
    sources['mapbox-streets'] = {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    }

    // Water fill (light, below roads)
    fillLayers.push({
      id: 'rn-water',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      paint: { 'fill-color': config.water_color ?? '#B8D8E8', 'fill-opacity': 0.6 },
    })
    fillLayers.push(waterwayLayer('rn-waterways', config.water_color ?? '#B8D8E8', 0.7, 0.45, 1.6))

    // Land use — parks / green space
    fillLayers.push({
      id: 'rn-landuse',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'wood', 'forest', 'scrub']]],
      paint: { 'fill-color': ink, 'fill-opacity': 0.04 },
    })
  }

  if (token && config.show_roads) {
    // Service / footpath (thinnest)
    roadLineLayers.push({
      id: 'rn-service',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['service', 'path', 'pedestrian', 'track']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.18,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 0.8],
      },
    })

    // Residential / local streets
    roadLineLayers.push({
      id: 'rn-street',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'tertiary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.32,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.2],
      },
    })

    // Secondary
    roadLineLayers.push({
      id: 'rn-secondary',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 14, 2.0],
      },
    })

    // Motorway / trunk (boldest)
    roadLineLayers.push({
      id: 'rn-motorway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.75,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 3.0],
      },
    })
  }

  return {
    version: 8,
    name: 'RadMaps Road Network',
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': bg } },
      ...fillLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Contour-Art Style ────────────────────────────────────────────────────────
// No raster tiles — contour lines ARE the map. Clean white (or theme) background
// with high-detail contours styled for print quality. Route overlaid on top.
// Produces the John Muir Trail topo-art look.

function buildContourArtStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const artConfig = { ...config, show_contours: true, contour_detail: config.contour_detail ?? 4 }
  const glyphs = token
    ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
    : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

  return {
    version: 8,
    name: 'RadMaps Contour Art',
    glyphs,
    sources: {
      ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
      ...contourSource(token, contourTileUrl),
      ...(token ? roadsSource(token) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...(token
        ? [{
            id: 'contour-art-water',
            type: 'fill',
            source: 'mapbox-streets',
            'source-layer': 'water',
            paint: {
              'fill-color': config.water_color ?? '#B8D8E8',
              'fill-opacity': 0.62,
            },
          },
          waterwayLayer('contour-art-waterways', config.water_color ?? '#B8D8E8', 0.85, 0.6, 2.0)]
        : []),
      // Hillshade at very low opacity for subtle topographic depth
      ...(config.show_hillshade
        ? [{
            id: 'hillshade',
            type: 'hillshade' as const,
            source: 'mapbox-dem',
            paint: {
              'hillshade-shadow-color': '#000000',
              'hillshade-highlight-color': '#FFFFFF',
              'hillshade-accent-color': '#000000',
              'hillshade-illumination-direction': 335,
              'hillshade-exaggeration': Math.min(config.hillshade_intensity, 0.25),
            },
          }]
        : []
      ),
      // Contour art layers — wider lines for bold print look
      ...(usingMlContour
        ? [
            {
              id: 'contours-minor',
              type: 'line',
              source: 'contours',
              'source-layer': 'contours',
              filter: contourFeatureFilter(artConfig, ['!=', ['get', 'level'], 1]),
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': artConfig.contour_color,
                'line-opacity': artConfig.contour_opacity,
                'line-width': contourMinorLineWidthExpression(artConfig),
              },
            },
            {
              id: 'contours-major',
              type: 'line',
              source: 'contours',
              'source-layer': 'contours',
              filter: contourFeatureFilter(artConfig, ['==', ['get', 'level'], 1]),
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': artConfig.contour_major_color,
                'line-opacity': artConfig.contour_opacity,
                'line-width': contourMajorLineWidthExpression(artConfig),
              },
            },
            ...(config.show_elevation_labels ? [{
              id: 'contours-labels',
              type: 'symbol',
              source: 'contours',
              'source-layer': 'contours',
              filter: contourFeatureFilter(artConfig, ['==', ['get', 'level'], 1]),
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 500,
                'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
                'text-letter-spacing': 0.06,
                'text-padding': 4,
                'text-pitch-alignment': 'viewport',
                'text-rotation-alignment': 'viewport',
              },
              paint: {
                'text-color': artConfig.contour_major_color,
                'text-halo-color': config.background_color,
                'text-halo-width': 2,
                'text-opacity': artConfig.contour_opacity,
              },
            }] : []),
          ]
        : contourLayers(artConfig, false)
      ),
      ...(token ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Natural Topo Style ───────────────────────────────────────────────────────
// MapTiler outdoor/topo tiles — natural colour palette (greens, blues, earth tones).
// Produces the full-colour terrain map look. Requires a MapTiler token.

function buildNaturalTopoStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const maptilerTk = maptilerToken || ''
  const usingMlContour = !!contourTileUrl
  const tileStyle = (config.base_tile_style === 'maptiler-topo' || config.base_tile_style === 'maptiler-winter')
    ? config.base_tile_style
    : 'maptiler-outdoor'
  const styleMap: Record<string, string> = {
    'maptiler-outdoor': 'outdoor-v2',
    'maptiler-topo': 'topo-v2',
    'maptiler-winter': 'winter-v2',
  }
  const tileMapStyle = styleMap[tileStyle] ?? 'outdoor-v2'

  return {
    version: 8,
    name: 'RadMaps Natural Topo',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${tileMapStyle}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles',
        type: 'raster',
        source: 'base-tiles',
        paint: {
          'raster-opacity':    0.95,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Stadia Watercolor Style ──────────────────────────────────────────────────
// Hand-painted watercolor raster tiles from Stamen Design, hosted by Stadia Maps.
// Free for low-traffic / non-commercial use. Production needs a STADIA_API_KEY.

function buildStadiaWatercolorStyle(config: StyleConfig, contourTileUrl?: string, stadiaToken?: string, mapboxToken?: string): object {
  const usingMlContour = !!contourTileUrl
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : ''
  const mapboxTk = mapboxToken || ''

  return {
    version: 8,
    name: 'RadMaps Watercolor',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        // Use @2x (512×512 retina) tiles + tileSize 512 so the worker
        // gets twice the source pixel density. At print DPI the rendered
        // zoom often exceeds the source maxzoom (Stadia stamen_watercolor
        // is capped at z14 server-side), and MapLibre upscales — @2x
        // halves the upscale factor so glyphs/edges stay sharp.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}@2x.jpg${keyParam}`,
        ]),
        tileSize: 512,
        // Stadia stamen_watercolor's effective server-side maxzoom is 14 —
        // higher zooms return 204 No Content even though they advertise 16.
        // Cap here so MapLibre upscales z14 tiles for higher view zooms
        // (e.g. 300 DPI print rendering at zoom 15+) instead of leaving
        // gaps. Watercolor is artistic — soft upscale looks fine.
        maxzoom: 14,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#d4dde1' } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.95,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Stadia Toner Style ───────────────────────────────────────────────────────
// High-contrast black & white graphic style by Stamen Design, hosted by Stadia Maps.

function buildStadiaTonerStyle(config: StyleConfig, contourTileUrl?: string, stadiaToken?: string, mapboxToken?: string): object {
  const usingMlContour = !!contourTileUrl
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : ''
  const mapboxTk = mapboxToken || ''
  const tonerLayerGroup = config.show_place_labels === false
    ? 'stamen_toner_background'
    : 'stamen_toner'

  return {
    version: 8,
    name: 'RadMaps Toner',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        // @2x for HiDPI print rendering — see watercolor source comment.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/${tonerLayerGroup}/{z}/{x}/{y}@2x.png${keyParam}`,
        ]),
        tileSize: 512,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.85,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Native Toner ───────────────────────────────────────────────────────
// B&W vector look using Mapbox Streets v8. Falls back to CARTO light with
// raster-saturation: -1 when no Mapbox token is present.

function buildNativeTonerStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const ink = mapInkColor(config)
  const roadColor = config.roads_color ?? ink
  const roadOpacity = config.roads_opacity ?? 1

  const sources: Record<string, object> = {
    ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
    ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
    ...primaryRouteSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  // Fills (water, landuse, buildings) sit below hillshade/contours as base features.
  // Road lines sit above so they aren't visually cut by terrain.
  const baseLayers: object[] = []
  const roadLineLayers: object[] = []

  if (token) {
    sources['mapbox-streets'] = {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    }
    baseLayers.push(
      { id: 'nt-water',     type: 'fill', source: 'mapbox-streets', 'source-layer': 'water',
        paint: { 'fill-color': ink, 'fill-opacity': 0.85 } },
      waterwayLayer('nt-waterways', ink, 0.85, 0.45, 1.7),
      { id: 'nt-landuse',   type: 'fill', source: 'mapbox-streets', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'wood', 'forest', 'scrub']]],
        paint: { 'fill-color': ink, 'fill-opacity': 0.08 } },
      { id: 'nt-buildings', type: 'fill', source: 'mapbox-streets', 'source-layer': 'building',
        paint: { 'fill-color': ink, 'fill-opacity': 0.06 } },
    )
  }

  if (token && config.show_roads) {
    roadLineLayers.push(
      { id: 'nt-service', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['service', 'path', 'pedestrian', 'track']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.25,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.0] } },
      { id: 'nt-street', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'tertiary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.55,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 1.6] } },
      { id: 'nt-secondary', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.80,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 14, 2.8] } },
      { id: 'nt-motorway', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 1.0,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.0, 14, 4.0] } },
    )
  }

  if (!token) {
    sources['base-tiles'] = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`)),
      tileSize: 512,
      attribution: '© CARTO © OpenStreetMap contributors',
    }
    baseLayers.push({
      id: 'base-tiles', type: 'raster', source: 'base-tiles',
      paint: { 'raster-opacity': 0.9, 'raster-saturation': -1, 'raster-contrast': 0.30 },
    })
  }

  return {
    version: 8,
    name: 'RadMaps Native Toner',
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...baseLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Native Watercolor ──────────────────────────────────────────────────
// Warm paper approximation: CARTO light at low opacity over a cream background.
// No Mapbox token required.

function buildNativeWatercolorStyle(
  config: StyleConfig,
  contourTileUrl?: string,
  mapboxToken?: string,
): object {
  const usingMlContour = !!contourTileUrl
  const mapboxTk = mapboxToken || ''
  const cartoUrls = ['a', 'b', 'c', 'd'].map(
    p => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`,
  )

  return {
    version: 8,
    name: 'RadMaps Native Watercolor',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, cartoUrls),
        tileSize: 512,
        attribution: '© CARTO © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.38,
          'raster-saturation': (config.tile_saturation ?? 0) - 0.35,
          'raster-hue-rotate': (config.tile_hue_rotate ?? 0) + 18,
          'raster-contrast':   (config.tile_contrast ?? 0) - 0.15,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Alidade Smooth ─────────────────────────────────────────────────────
// Clean modern cartography using MapTiler Streets v2 raster tiles.

function buildAlidadeSmoothStyle(
  config: StyleConfig,
  maptilerToken?: string,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const maptilerTk = maptilerToken || ''
  const mapboxTk   = mapboxToken   || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Alidade Smooth',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.92,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Alidade Smooth Dark ────────────────────────────────────────────────
// Dark clean cartography using MapTiler Dataviz Dark raster tiles.
// If dataviz-dark is unavailable at your MapTiler tier, swap the map ID to dark-matter.

function buildAlidadeSmoothDarkStyle(
  config: StyleConfig,
  maptilerToken?: string,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const maptilerTk = maptilerToken || ''
  const mapboxTk   = mapboxToken   || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Alidade Smooth Dark',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.88,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Topographic Style ────────────────────────────────────────────────────────

function buildTopographicStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Topographic',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      'mapbox-outdoors': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`]),
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
      ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && token ? roadsSource(token) : {}),
      ...primaryRouteSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'outdoors-tiles',
        type: 'raster',
        source: 'mapbox-outdoors',
        paint: {
          'raster-opacity':    config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': Math.max(-1, Math.min(1, (config.show_hillshade ? -0.15 : 0) + (config.tile_saturation ?? 0))),
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(token ? roadsLayers(config) : []),
      ...primaryRouteLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}
