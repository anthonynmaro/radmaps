import type { AtlasLayerId } from '~/types'

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

export type AtlasManifestArtifact = {
  id: string
  kind: string
  url: string
  objectPath?: string
  minzoom?: number
  maxzoom?: number
  bounds?: [number, number, number, number]
  layers?: string[]
  bytes?: number
  etag?: string
}

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
  artifacts?: Partial<Record<AtlasArtifactKey, AtlasManifestArtifact>>
  layerCatalog?: AtlasLayerId[]
  attribution?: AtlasAttribution[]
}

export type AtlasResolvedArtifacts = {
  baseUrl: string
  contourUrl: string
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

export function resolveAtlasArtifacts(
  manifest: AtlasManifest,
  fallback: AtlasManifest,
): AtlasResolvedArtifacts {
  const base = manifest.artifacts?.base ?? fallback.artifacts?.base
  const contours = manifest.artifacts?.contours ?? fallback.artifacts?.contours
  const label = manifest.label || fallback.label || 'RadMaps atlas pack'
  const coverageLabel = [
    atlasArtifactZoomLabel('base', base),
    atlasArtifactZoomLabel('contours', contours),
  ].filter(Boolean).join(' - ') || 'PMTiles ready'

  return {
    baseUrl: base?.url || fallback.artifacts?.base?.url || '',
    contourUrl: contours?.url || fallback.artifacts?.contours?.url || '',
    label,
    coverageLabel,
  }
}
