import type { AtlasLayerId } from '../types'

export const ATLAS_LAYER_IDS = [
  'contour',
  'water',
  'waterway',
  'park',
  'landcover',
  'transportation',
  'building',
  'poi',
  'place',
] as const satisfies readonly AtlasLayerId[]

export type AtlasArtifactKey = 'base' | 'contours' | 'hillshade' | 'publicLands' | 'poi'

export type AtlasSourceLicense = {
  name: string
  url?: string
  attribution?: string
}

export type AtlasManifestArtifact = {
  id: string
  kind: AtlasArtifactKey | 'terrain' | 'overlay'
  url: string
  objectPath?: string
  minzoom?: number
  maxzoom?: number
  bounds?: [number, number, number, number]
  layers?: string[]
  bytes?: number
  etag?: string
  checksum?: string
  sourceLicenses?: Array<string | AtlasSourceLicense>
  createdAt?: string
  status?: 'staging' | 'validated' | 'production' | 'deprecated'
  terrainRegion?: string
  sourceRegion?: string
}

export type AtlasManifestArtifactEntry = AtlasManifestArtifact | AtlasManifestArtifact[]

export type AtlasAttribution = {
  name: string
  requiredText: string
  url?: string
}

export type AtlasManifest = {
  atlasVersion?: string
  schemaVersion?: string
  coverage?: string
  label?: string
  createdAt?: string
  storage?: {
    provider?: string
    bucket?: string
    publicBaseUrl?: string
  }
  artifacts?: Partial<Record<AtlasArtifactKey, AtlasManifestArtifactEntry>>
  layerCatalog?: AtlasLayerId[]
  attribution?: AtlasAttribution[]
}

export type AtlasResolvedArtifacts = {
  baseUrl: string
  contourUrl: string
  baseArtifacts: AtlasManifestArtifact[]
  contourArtifacts: AtlasManifestArtifact[]
  artifactsByKind: Partial<Record<AtlasArtifactKey, AtlasManifestArtifact[]>>
  artifactIds: string[]
  label: string
  coverageLabel: string
}

export function atlasArtifactZoomLabel(name: string, artifact?: AtlasManifestArtifact) {
  if (!artifact) return ''
  const minzoom = artifact.minzoom ?? '?'
  const maxzoom = artifact.maxzoom ?? '?'
  return `${name} z${minzoom}-${maxzoom}`
}

export function createFallbackAtlasManifest(options: {
  baseUrl: string
  contourUrl: string
  label?: string
}): AtlasManifest {
  return {
    atlasVersion: 'local-fallback',
    schemaVersion: 'radmaps-atlas-v1',
    coverage: 'driftless',
    label: options.label || 'Driftless / Madison lab pack',
    artifacts: {
      base: {
        id: 'radmaps-driftless-planetiler',
        kind: 'base',
        url: options.baseUrl,
        minzoom: 0,
        maxzoom: 14,
        layers: ['landcover', 'landuse', 'park', 'water', 'waterway', 'building', 'transportation', 'transportation_name', 'place', 'poi'],
      },
      contours: {
        id: 'radmaps-driftless-contours',
        kind: 'terrain',
        url: options.contourUrl,
        minzoom: 8,
        maxzoom: 14,
        layers: ['contour'],
      },
    },
    layerCatalog: [...ATLAS_LAYER_IDS],
  }
}

export function atlasManifestArtifacts(
  manifest: AtlasManifest | null | undefined,
  key: AtlasArtifactKey,
): AtlasManifestArtifact[] {
  const entry = manifest?.artifacts?.[key]
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

export function atlasAllManifestArtifacts(
  manifest: AtlasManifest | null | undefined,
): AtlasManifestArtifact[] {
  return (['base', 'contours', 'hillshade', 'publicLands', 'poi'] as const)
    .flatMap(key => atlasManifestArtifacts(manifest, key))
}

export function atlasArtifactIntersectsBbox(
  artifact: AtlasManifestArtifact,
  bbox?: [number, number, number, number] | null,
) {
  if (!bbox || !artifact.bounds) return true
  const [west, south, east, north] = bbox
  const [artifactWest, artifactSouth, artifactEast, artifactNorth] = artifact.bounds
  return west <= artifactEast &&
    east >= artifactWest &&
    south <= artifactNorth &&
    north >= artifactSouth
}

export function findAtlasArtifact(
  manifest: AtlasManifest | null | undefined,
  artifactId: string,
) {
  return atlasAllManifestArtifacts(manifest).find(artifact => artifact.id === artifactId) || null
}

function artifactDisplayName(kind: AtlasArtifactKey) {
  if (kind === 'publicLands') return 'public lands'
  return kind
}

function firstAtlasArtifactUrl(
  manifest: AtlasManifest,
  key: AtlasArtifactKey,
) {
  return atlasManifestArtifacts(manifest, key)[0]?.url || ''
}

export function resolveAtlasArtifacts(
  manifest: AtlasManifest,
  fallback: AtlasManifest,
  options: {
    bbox?: [number, number, number, number] | null
    requiredKinds?: AtlasArtifactKey[]
  } = {},
): AtlasResolvedArtifacts {
  const artifactsByKind = (['base', 'contours', 'hillshade', 'publicLands', 'poi'] as const)
    .reduce<Partial<Record<AtlasArtifactKey, AtlasManifestArtifact[]>>>((acc, key) => {
      const manifestHasEntry = Object.prototype.hasOwnProperty.call(manifest.artifacts || {}, key)
      const manifestArtifacts = atlasManifestArtifacts(manifest, key)
      const fallbackArtifacts = atlasManifestArtifacts(fallback, key)
      const resolved = (manifestHasEntry ? manifestArtifacts : fallbackArtifacts)
        .filter(artifact => atlasArtifactIntersectsBbox(artifact, options.bbox))
      if (resolved.length) acc[key] = resolved
      return acc
    }, {})
  const baseArtifacts = artifactsByKind.base || []
  const contourArtifacts = artifactsByKind.contours || []
  const base = baseArtifacts[0]
  const contours = contourArtifacts[0]
  const label = manifest.label || fallback.label || 'RadMaps atlas pack'
  const displayKinds = options.requiredKinds || ['base', 'contours']
  const coverageLabel = displayKinds
    .flatMap(kind => (artifactsByKind[kind] || []).map((artifact, index) =>
      atlasArtifactZoomLabel(`${artifactDisplayName(kind)}${index ? ` ${index + 1}` : ''}`, artifact),
    ))
    .filter(Boolean)
    .join(' - ') || 'PMTiles ready'
  const artifactIds = Object.values(artifactsByKind)
    .flatMap(artifacts => artifacts || [])
    .map(artifact => artifact.id)

  return {
    baseUrl: base?.url || firstAtlasArtifactUrl(fallback, 'base'),
    contourUrl: contours?.url || firstAtlasArtifactUrl(fallback, 'contours'),
    baseArtifacts,
    contourArtifacts,
    artifactsByKind,
    artifactIds,
    label,
    coverageLabel,
  }
}
