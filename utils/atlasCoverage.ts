import type { AtlasManifestArtifact } from './atlasManifest'

export type AtlasCoverageStatus = 'terrain' | 'base' | 'missing'

type AtlasCoverageInput = {
  baseArtifacts: AtlasManifestArtifact[]
  terrainArtifacts: AtlasManifestArtifact[]
}

type AtlasPreviewBboxInput = {
  center: [number, number]
  zoom: number
  route?: [number, number][]
  viewportWidth?: number
  viewportHeight?: number
  overscan?: number
}

export function atlasCoverageStatus(coverage: AtlasCoverageInput): AtlasCoverageStatus {
  if (coverage.terrainArtifacts.length) return 'terrain'
  if (coverage.baseArtifacts.length) return 'base'
  return 'missing'
}

export function atlasCoverageLabel(coverage: AtlasCoverageInput) {
  const status = atlasCoverageStatus(coverage)
  if (status === 'terrain') {
    return `full base + ${coverage.terrainArtifacts.length} terrain shard${coverage.terrainArtifacts.length === 1 ? '' : 's'}`
  }
  if (status === 'base') return 'full base only - contours missing for this route'
  return 'missing atlas coverage'
}

export function atlasCoverageWarning(coverage: AtlasCoverageInput) {
  return atlasCoverageStatus(coverage) === 'base'
    ? 'No contour terrain artifact intersects this showcase route yet. The preview is base-map-only here.'
    : ''
}

export function atlasExpandTerrainRegionArtifacts(
  matchedArtifacts: AtlasManifestArtifact[],
  allTerrainArtifacts: AtlasManifestArtifact[],
) {
  const regionKeys = new Set(matchedArtifacts.map(atlasTerrainRegionKey).filter(Boolean))
  if (!regionKeys.size) return sortArtifactsById(matchedArtifacts)

  const expanded = allTerrainArtifacts.filter(artifact => regionKeys.has(atlasTerrainRegionKey(artifact)))
  return sortArtifactsById(expanded.length ? expanded : matchedArtifacts)
}

export function atlasPreviewBbox(options: AtlasPreviewBboxInput): [number, number, number, number] {
  const width = options.viewportWidth ?? 1200
  const height = options.viewportHeight ?? 520
  const overscan = options.overscan ?? 6
  const scale = 512 * 2 ** options.zoom
  const centerX = lngToMercatorX(options.center[0])
  const centerY = latToMercatorY(options.center[1])
  const halfX = (width / 2 / scale) * overscan
  const halfY = (height / 2 / scale) * overscan
  const viewportBbox: [number, number, number, number] = [
    mercatorXToLng(centerX - halfX),
    mercatorYToLat(centerY + halfY),
    mercatorXToLng(centerX + halfX),
    mercatorYToLat(centerY - halfY),
  ]

  if (!options.route?.length) return viewportBbox

  const routeLons = options.route.map(([lon]) => lon)
  const routeLats = options.route.map(([, lat]) => lat)
  const routePadding = 0.08
  return [
    Math.min(viewportBbox[0], Math.min(...routeLons) - routePadding),
    Math.min(viewportBbox[1], Math.min(...routeLats) - routePadding),
    Math.max(viewportBbox[2], Math.max(...routeLons) + routePadding),
    Math.max(viewportBbox[3], Math.max(...routeLats) + routePadding),
  ]
}

function lngToMercatorX(lng: number) {
  return (lng + 180) / 360
}

function latToMercatorY(lat: number) {
  const radians = lat * Math.PI / 180
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2
}

function mercatorXToLng(x: number) {
  return x * 360 - 180
}

function mercatorYToLat(y: number) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI
}

function atlasTerrainRegionKey(artifact: AtlasManifestArtifact) {
  return artifact.sourceRegion || artifact.terrainRegion?.replace(/-r\d+c\d+$/, '') || artifact.id.replace(/^radmaps-/, '').replace(/-r\d+c\d+-contours$/, '').replace(/-contours$/, '')
}

function sortArtifactsById(artifacts: AtlasManifestArtifact[]) {
  return [...artifacts].sort((left, right) => left.id.localeCompare(right.id))
}
