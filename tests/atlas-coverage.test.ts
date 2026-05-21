import { describe, expect, it } from 'vitest'
import type { AtlasManifestArtifact } from '../utils/atlasManifest'
import { atlasCoverageLabel, atlasCoverageStatus, atlasCoverageWarning, atlasExpandTerrainRegionArtifacts, atlasPreviewBbox } from '../utils/atlasCoverage'

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

  it('uses the preview viewport, not just the route line, for terrain artifact selection', () => {
    const bbox = atlasPreviewBbox({
      center: [-119.573, 37.748],
      zoom: 12.2,
      route: [[-119.628, 37.731], [-119.536, 37.787]],
    })

    expect(bbox[0]).toBeLessThan(-120)
    expect(bbox[2]).toBeGreaterThan(-119.1)
    expect(bbox[1]).toBeLessThan(37.6)
    expect(bbox[3]).toBeGreaterThan(37.9)
  })

  it('expands matched terrain shards to the full source region so zooming does not reveal shard edges', () => {
    const allTerrain = [
      { ...terrainArtifact, id: 'radmaps-sierra-r1c1-contours', sourceRegion: 'sierra' },
      { ...terrainArtifact, id: 'radmaps-sierra-r1c2-contours', sourceRegion: 'sierra' },
      { ...terrainArtifact, id: 'radmaps-sierra-r2c1-contours', sourceRegion: 'sierra' },
      { ...terrainArtifact, id: 'radmaps-rockies-r1c1-contours', sourceRegion: 'rockies' },
    ]

    expect(atlasExpandTerrainRegionArtifacts([allTerrain[1]], allTerrain).map(artifact => artifact.id)).toEqual([
      'radmaps-sierra-r1c1-contours',
      'radmaps-sierra-r1c2-contours',
      'radmaps-sierra-r2c1-contours',
    ])
  })
})
