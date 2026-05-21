import { describe, expect, it } from 'vitest'
import type { AtlasManifestArtifact } from '../utils/atlasManifest'
import { atlasCoverageLabel, atlasCoverageStatus, atlasCoverageWarning } from '../utils/atlasCoverage'

const baseArtifact: AtlasManifestArtifact = {
  id: 'base-us',
  kind: 'base',
  url: 'https://tiles.example/base.pmtiles',
}

const terrainArtifact: AtlasManifestArtifact = {
  id: 'terrain-yosemite',
  kind: 'contours',
  url: 'https://tiles.example/yosemite.pmtiles',
}

describe('Atlas coverage status', () => {
  it('reports full base plus terrain when contour artifacts match the route bbox', () => {
    const coverage = {
      baseArtifacts: [baseArtifact],
      terrainArtifacts: [terrainArtifact, { ...terrainArtifact, id: 'terrain-yosemite-2' }],
    }

    expect(atlasCoverageStatus(coverage)).toBe('terrain')
    expect(atlasCoverageLabel(coverage)).toBe('full base + 2 terrain shards')
    expect(atlasCoverageWarning(coverage)).toBe('')
  })

  it('distinguishes base-only coverage from missing atlas coverage', () => {
    const baseOnly = { baseArtifacts: [baseArtifact], terrainArtifacts: [] }
    const missing = { baseArtifacts: [], terrainArtifacts: [] }

    expect(atlasCoverageStatus(baseOnly)).toBe('base')
    expect(atlasCoverageLabel(baseOnly)).toContain('full base only')
    expect(atlasCoverageWarning(baseOnly)).toContain('base-map-only')
    expect(atlasCoverageStatus(missing)).toBe('missing')
    expect(atlasCoverageLabel(missing)).toBe('missing atlas coverage')
  })
})
