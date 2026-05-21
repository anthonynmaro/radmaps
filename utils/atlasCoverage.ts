import type { AtlasManifestArtifact } from './atlasManifest'

export type AtlasCoverageStatus = 'terrain' | 'base' | 'missing'

type AtlasCoverageInput = {
  baseArtifacts: AtlasManifestArtifact[]
  terrainArtifacts: AtlasManifestArtifact[]
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
