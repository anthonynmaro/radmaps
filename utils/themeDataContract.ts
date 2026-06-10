import type { ColorTheme, CompositionId, PosterTextSlot, RouteStats, StyleConfig, ThemeBaseMapMode, ThemeDefinition } from '~/types'

export const THEME_DATA_CONTRACT_VERSION = 'theme-data-contract-v1'

export type ThemePurpose =
  | 'route-terrain'
  | 'route-urban'
  | 'place'
  | 'city'
  | 'nautical'

export type ThemeRenderMode =
  | 'picker-preview'
  | 'editor'
  | 'proof'
  | 'checkout'
  | 'final'
  | 'share'

export type DataSource =
  | 'gpx.distance'
  | 'gpx.elevation_gain'
  | 'gpx.elevation_profile'
  | 'gpx.duration'
  | 'gpx.splits'
  | 'route.geometry'
  | 'route.endpoints'
  | 'location.name'
  | 'location.coords'
  | 'location.point_elevation'
  | 'location.region'
  | 'derived.composition_meta'
  | 'static'

export type MissingDataPolicy = 'remove' | 'derive' | 'placeholder'
export type ThemeRequirement = 'route' | 'elevation' | 'location' | 'always'
export type OmittedThemeMapFeature = 'route' | 'elevation_profile' | 'splits' | 'pins'

export interface ThemeSlotContract {
  slot: PosterTextSlot
  source: DataSource
  requires: ThemeRequirement
  ifMissing: MissingDataPolicy
  deriveFrom?: DataSource[]
}

export interface ThemeDataContextInput {
  geojson?: GeoJSON.FeatureCollection | null
  stats?: Partial<RouteStats> | null
  bbox?: [number, number, number, number] | number[] | null
  styleConfig?: Partial<StyleConfig> | null
  title?: string | null
  subtitle?: string | null
  location_label?: string | null
  location_city?: string | null
  location_region?: string | null
  location_country?: string | null
  location_lng?: number | null
  location_lat?: number | null
  location_elevation_m?: number | null
  location_metadata_source?: string | null
  location_metadata_enriched_at?: string | null
  atlas_coverage_status?: 'terrain' | 'base' | 'missing' | null
}

export interface ThemeDataContext {
  version: typeof THEME_DATA_CONTRACT_VERSION
  purpose: ThemePurpose
  hasRoute: boolean
  hasDistance: boolean
  hasElevation: boolean
  hasPointElevation: boolean
  hasLocation: boolean
  hasCoords: boolean
  hasDate: boolean
  distanceKm: number | null
  elevationGainM: number | null
  pointElevationM: number | null
  date: string | null
  activityType: string | null
  label: string | null
  city: string | null
  region: string | null
  country: string | null
  coords: { lng: number, lat: number } | null
  locationMetadataSource: string | null
  locationMetadataEnrichedAt: string | null
  bbox: [number, number, number, number] | null
  atlasCoverageStatus: 'terrain' | 'base' | 'missing' | null
  recommendedBaseMapMode: ThemeBaseMapMode
}

export interface ResolvedThemeDataContract {
  version: typeof THEME_DATA_CONTRACT_VERSION
  themeId: ColorTheme | string
  composition?: CompositionId
  mode: ThemeRenderMode
  context: ThemeDataContext
  slotContracts: ThemeSlotContract[]
  resolvedSlotValues: Partial<Record<PosterTextSlot, string>>
  omittedSlotIds: PosterTextSlot[]
  omittedMapFeatures: OmittedThemeMapFeature[]
  warnings: string[]
}

const ROUTE_FIRST_COMPOSITIONS = new Set<CompositionId>([
  'blueprint-strava',
  'splits-grid',
  'bib-numerals',
  'transit-diagram',
])

const URBAN_COMPOSITIONS = new Set<CompositionId>([
  'place-frame',
  'sea-chart',
  'transit-diagram',
])

const PREVIEW_PLACEHOLDER_MODES = new Set<ThemeRenderMode>(['picker-preview', 'editor'])

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeBbox(value: ThemeDataContextInput['bbox']): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const [minLng, minLat, maxLng, maxLat] = value.map(Number)
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  if (minLng >= maxLng || minLat >= maxLat) return null
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null
  return [minLng, minLat, maxLng, maxLat]
}

function bboxCenter(bbox: [number, number, number, number] | null) {
  if (!bbox) return null
  return {
    lng: (bbox[0] + bbox[2]) / 2,
    lat: (bbox[1] + bbox[3]) / 2,
  }
}

function hasRenderableLine(geojson?: GeoJSON.FeatureCollection | null): boolean {
  for (const feature of geojson?.features ?? []) {
    const geometry = feature.geometry
    if (!geometry) continue
    if (geometry.type === 'LineString' && geometry.coordinates.length > 1) return true
    if (geometry.type === 'MultiLineString' && geometry.coordinates.some(line => line.length > 1)) return true
  }
  return false
}

function geojsonHasElevation(geojson?: GeoJSON.FeatureCollection | null): boolean {
  for (const feature of geojson?.features ?? []) {
    const geometry = feature.geometry
    if (!geometry) continue
    const lines = geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : []
    for (const line of lines) {
      for (const coord of line) {
        if (typeof coord[2] === 'number' && Number.isFinite(coord[2]) && coord[2] !== 0) return true
      }
    }
  }
  return false
}

function purposeForContext(input: {
  composition?: CompositionId
  activityType: string | null
  hasRoute: boolean
  hasElevation: boolean
  hasLocation: boolean
}): ThemePurpose {
  if (!input.hasRoute && input.hasLocation) return 'place'
  if (input.composition && URBAN_COMPOSITIONS.has(input.composition)) return input.composition === 'sea-chart' ? 'nautical' : 'city'

  const activity = input.activityType?.toLowerCase() ?? ''
  if (activity.match(/run|ride|cycling|bike|virtualride|walk|strava/)) return 'route-urban'
  if (input.hasRoute && input.hasElevation) return 'route-terrain'
  if (input.hasRoute) return 'route-urban'
  return 'place'
}

function recommendedBaseMapModeForContext(input: {
  purpose: ThemePurpose
  hasRoute: boolean
  reliefM: number | null
  elevationChangeM: number | null
  atlasCoverageStatus: 'terrain' | 'base' | 'missing' | null
}): ThemeBaseMapMode {
  if (!input.hasRoute || input.purpose === 'place') return 'minimal'
  const reliefM = input.reliefM ?? input.elevationChangeM
  const lowRelief = reliefM != null && reliefM <= 80
  if (!lowRelief) return 'terrain'
  return input.atlasCoverageStatus === 'base' || input.atlasCoverageStatus === 'terrain'
    ? 'streets'
    : 'minimal'
}

export function buildThemeDataContext(input: ThemeDataContextInput = {}): ThemeDataContext {
  const stats = input.stats ?? {}
  const styleConfig = input.styleConfig ?? {}
  const bbox = normalizeBbox(input.bbox)
  const lng = finiteNumber(input.location_lng)
  const lat = finiteNumber(input.location_lat)
  const coords = lng != null && lat != null
    ? { lng, lat }
    : bboxCenter(bbox)
  const distanceKm = finiteNumber(stats.distance_km)
  const elevationGainM = finiteNumber(stats.elevation_gain_m)
  const elevationLossM = finiteNumber(stats.elevation_loss_m)
  const maxElevationM = finiteNumber(stats.max_elevation_m)
  const minElevationM = finiteNumber(stats.min_elevation_m)
  const reliefM = minElevationM != null && maxElevationM != null && maxElevationM > minElevationM
    ? maxElevationM - minElevationM
    : null
  const gainM = Math.max(elevationGainM ?? 0, elevationLossM ?? 0)
  const elevationChangeM = reliefM ?? (gainM > 0 ? gainM : null)
  const hasLine = hasRenderableLine(input.geojson)
  const hasDistanceStat = distanceKm != null && distanceKm > 0
  const hasRoute = hasLine || (input.geojson == null && hasDistanceStat)
  const hasDistance = hasRoute && hasDistanceStat
  const hasElevation = hasRoute && (
    geojsonHasElevation(input.geojson) ||
    Boolean(elevationGainM && elevationGainM > 0) ||
    Boolean(elevationLossM && elevationLossM > 0) ||
    (maxElevationM != null && minElevationM != null && maxElevationM > minElevationM)
  )
  const pointElevationM = finiteNumber(input.location_elevation_m)
  const label = cleanText(input.location_label)
    ?? cleanText(stats.location)
    ?? cleanText(styleConfig.location_text)
    ?? cleanText(input.title)
    ?? null
  const city = cleanText(input.location_city)
  const country = cleanText(input.location_country)
  const region = cleanText(input.location_region)
  const hasLocation = Boolean(label || city || region || country || coords)
  const activityType = cleanText(stats.activity_type)
  const composition = styleConfig.composition
  const purpose = purposeForContext({
    composition,
    activityType,
    hasRoute,
    hasElevation,
    hasLocation,
  })
  const atlasCoverageStatus = input.atlas_coverage_status ?? null

  return {
    version: THEME_DATA_CONTRACT_VERSION,
    purpose,
    hasRoute,
    hasDistance,
    hasElevation,
    hasPointElevation: pointElevationM != null,
    hasLocation,
    hasCoords: Boolean(coords),
    hasDate: Boolean(cleanText(stats.date)),
    distanceKm: hasDistance ? distanceKm : null,
    elevationGainM: hasElevation && elevationGainM != null && elevationGainM > 0 ? elevationGainM : null,
    pointElevationM,
    date: cleanText(stats.date),
    activityType,
    label,
    city,
    region,
    country,
    coords,
    locationMetadataSource: cleanText(input.location_metadata_source),
    locationMetadataEnrichedAt: cleanText(input.location_metadata_enriched_at),
    bbox,
    atlasCoverageStatus,
    recommendedBaseMapMode: recommendedBaseMapModeForContext({
      purpose,
      hasRoute,
      reliefM,
      elevationChangeM,
      atlasCoverageStatus,
    }),
  }
}

export function themeDataContextSignature(context: ThemeDataContext) {
  return {
    version: context.version,
    purpose: context.purpose,
    hasRoute: context.hasRoute,
    hasDistance: context.hasDistance,
    hasElevation: context.hasElevation,
    hasPointElevation: context.hasPointElevation,
    hasLocation: context.hasLocation,
    hasCoords: context.hasCoords,
    hasDate: context.hasDate,
    distanceKm: context.distanceKm,
    elevationGainM: context.elevationGainM,
    pointElevationM: context.pointElevationM,
    date: context.date,
    activityType: context.activityType,
    label: context.label,
    city: context.city,
    region: context.region,
    country: context.country,
    coords: context.coords,
    locationMetadataSource: context.locationMetadataSource,
    locationMetadataEnrichedAt: context.locationMetadataEnrichedAt,
    atlasCoverageStatus: context.atlasCoverageStatus,
    recommendedBaseMapMode: context.recommendedBaseMapMode,
  }
}

export function resolveThemeBaseMapMode(
  context: ThemeDataContext,
  requested?: ThemeBaseMapMode | 'auto' | null,
): ThemeBaseMapMode {
  return requested && requested !== 'auto' ? requested : context.recommendedBaseMapMode
}

export function themePurposeForContext(context: ThemeDataContext): ThemePurpose {
  return context.purpose
}

export function defaultThemeSlotContracts(composition?: CompositionId): ThemeSlotContract[] {
  const routeFirst = Boolean(composition && ROUTE_FIRST_COMPOSITIONS.has(composition))
  return [
    { slot: 'trail_name', source: 'location.name', requires: 'always', ifMissing: 'placeholder' },
    { slot: 'location_text', source: 'location.name', requires: 'location', ifMissing: routeFirst ? 'remove' : 'placeholder' },
    { slot: 'occasion_text', source: 'static', requires: 'always', ifMissing: 'remove' },
    { slot: 'distance', source: 'gpx.distance', requires: 'route', ifMissing: 'remove' },
    { slot: 'elevation_gain', source: 'gpx.elevation_gain', requires: 'elevation', ifMissing: 'remove' },
    { slot: 'date', source: 'gpx.distance', requires: 'route', ifMissing: 'remove' },
    { slot: 'coordinates', source: 'location.coords', requires: 'location', ifMissing: 'remove' },
    { slot: 'start_pin_label', source: 'route.endpoints', requires: 'route', ifMissing: 'remove' },
    { slot: 'finish_pin_label', source: 'route.endpoints', requires: 'route', ifMissing: 'remove' },
    { slot: 'composition_kicker', source: 'derived.composition_meta', requires: 'always', ifMissing: 'placeholder' },
    { slot: 'composition_meta', source: 'derived.composition_meta', requires: routeFirst ? 'route' : 'location', ifMissing: routeFirst ? 'remove' : 'derive' },
    { slot: 'composition_footer', source: 'derived.composition_meta', requires: routeFirst ? 'route' : 'always', ifMissing: routeFirst ? 'remove' : 'placeholder' },
    { slot: 'composition_side_rail', source: 'static', requires: 'always', ifMissing: 'placeholder' },
  ]
}

function requirementMet(requirement: ThemeRequirement, context: ThemeDataContext) {
  if (requirement === 'always') return true
  if (requirement === 'route') return context.hasRoute
  if (requirement === 'elevation') return context.hasElevation
  if (requirement === 'location') return context.hasLocation
  return true
}

function valueForSource(source: DataSource, context: ThemeDataContext): string | null {
  if (source === 'gpx.distance') return context.distanceKm != null ? String(context.distanceKm) : null
  if (source === 'gpx.elevation_gain') return context.elevationGainM != null ? String(context.elevationGainM) : null
  if (source === 'location.name') return context.label
  if (source === 'location.region') return context.region ?? context.city ?? context.country
  if (source === 'location.coords') return context.coords ? `${context.coords.lat},${context.coords.lng}` : null
  if (source === 'location.point_elevation') return context.pointElevationM != null ? String(context.pointElevationM) : null
  if (source === 'derived.composition_meta') return context.region ?? context.label ?? context.date
  return null
}

function placeholdersAllowed(mode: ThemeRenderMode) {
  return PREVIEW_PLACEHOLDER_MODES.has(mode)
}

export function resolveThemeDataContract(
  theme: ThemeDefinition | ColorTheme | string | null | undefined,
  composition: CompositionId | undefined,
  context: ThemeDataContext,
  mode: ThemeRenderMode,
): ResolvedThemeDataContract {
  const themeId = typeof theme === 'string' ? theme : theme?.id ?? 'unknown'
  const contracts = defaultThemeSlotContracts(composition)
  const omittedSlotIds: PosterTextSlot[] = []
  const resolvedSlotValues: Partial<Record<PosterTextSlot, string>> = {}
  const warnings: string[] = []

  for (const contract of contracts) {
    const value = valueForSource(contract.source, context)
    const met = requirementMet(contract.requires, context)
    if (met && value != null) {
      resolvedSlotValues[contract.slot] = value
      continue
    }
    if (!met && contract.ifMissing === 'remove') {
      omittedSlotIds.push(contract.slot)
      continue
    }
    if (!met && contract.ifMissing === 'placeholder' && !placeholdersAllowed(mode)) {
      omittedSlotIds.push(contract.slot)
      warnings.push(`${contract.slot}: placeholder suppressed in ${mode}`)
    }
  }

  const omittedMapFeatures: OmittedThemeMapFeature[] = []
  if (!context.hasRoute) omittedMapFeatures.push('route', 'splits', 'pins')
  if (!context.hasElevation) omittedMapFeatures.push('elevation_profile')

  return {
    version: THEME_DATA_CONTRACT_VERSION,
    themeId,
    composition,
    mode,
    context,
    slotContracts: contracts,
    resolvedSlotValues,
    omittedSlotIds: Array.from(new Set(omittedSlotIds)),
    omittedMapFeatures: Array.from(new Set(omittedMapFeatures)),
    warnings,
  }
}
