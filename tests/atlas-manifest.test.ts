import { describe, expect, it } from 'vitest'
import {
  findAtlasArtifact,
  resolveAtlasArtifacts,
  type AtlasManifest,
} from '../utils/atlasManifest'

const manifest: AtlasManifest = {
  label: 'Test atlas',
  artifacts: {
    base: [
      {
        id: 'base-us',
        kind: 'base',
        url: 'https://tiles.example/base.pmtiles',
        objectPath: 'atlas/base.pmtiles',
        minzoom: 0,
        maxzoom: 14,
        bounds: [-125, 24, -66, 50],
        layers: ['water', 'transportation'],
      },
    ],
    contours: [
      {
        id: 'terrain-west',
        kind: 'contours',
        url: 'https://tiles.example/west.pmtiles',
        objectPath: 'atlas/west.pmtiles',
        minzoom: 8,
        maxzoom: 14,
        bounds: [-125, 30, -105, 50],
        layers: ['contour'],
      },
      {
        id: 'terrain-midwest',
        kind: 'contours',
        url: 'https://tiles.example/midwest.pmtiles',
        objectPath: 'atlas/midwest.pmtiles',
        minzoom: 8,
        maxzoom: 14,
        bounds: [-98, 35, -82, 49],
        layers: ['contour'],
      },
    ],
  },
}

describe('Atlas manifest resolver', () => {
  it('keeps multiple artifacts per kind and filters terrain by bbox', () => {
    const resolved = resolveAtlasArtifacts(manifest, manifest, {
      bbox: [-94, 42, -88, 46],
      requiredKinds: ['base', 'contours'],
    })

    expect(resolved.baseArtifacts.map(artifact => artifact.id)).toEqual(['base-us'])
    expect(resolved.contourArtifacts.map(artifact => artifact.id)).toEqual(['terrain-midwest'])
    expect(resolved.artifactIds).toContain('terrain-midwest')
    expect(resolved.artifactIds).not.toContain('terrain-west')
  })

  it('finds approved artifacts by id across all artifact arrays', () => {
    expect(findAtlasArtifact(manifest, 'terrain-west')?.objectPath).toBe('atlas/west.pmtiles')
    expect(findAtlasArtifact(manifest, 'missing')).toBeNull()
  })

  it('allows overlapping base artifacts while resolving only bbox-intersecting coverage', () => {
    const northAmericaManifest: AtlasManifest = {
      artifacts: {
        base: [
          {
            id: 'base-us',
            kind: 'base',
            url: 'https://tiles.example/base-us.pmtiles',
            objectPath: 'atlas/base-us.pmtiles',
            minzoom: 0,
            maxzoom: 14,
            bounds: [-125, 24, -66, 50],
            layers: ['water', 'transportation'],
          },
          {
            id: 'base-north-america',
            kind: 'base',
            url: 'https://tiles.example/base-na.pmtiles',
            objectPath: 'atlas/base-na.pmtiles',
            minzoom: 0,
            maxzoom: 14,
            bounds: [-170, 5, -50, 84],
            layers: ['water', 'transportation', 'place', 'poi'],
          },
        ],
      },
    }

    const canadaResolved = resolveAtlasArtifacts(northAmericaManifest, manifest, {
      bbox: [-116.6, 51.0, -115.2, 52.0],
      requiredKinds: ['base'],
    })
    const chicagoResolved = resolveAtlasArtifacts(northAmericaManifest, manifest, {
      bbox: [-88.1, 41.6, -87.4, 42.1],
      requiredKinds: ['base'],
    })

    expect(canadaResolved.baseArtifacts.map(artifact => artifact.id)).toEqual(['base-north-america'])
    expect(chicagoResolved.baseArtifacts.map(artifact => artifact.id)).toEqual(['base-us', 'base-north-america'])
    expect(chicagoResolved.baseUrl).toBe('https://tiles.example/base-us.pmtiles')
  })

  it('does not fall back to legacy contours when a manifest explicitly has no contour artifacts', () => {
    const fallback: AtlasManifest = {
      artifacts: {
        contours: [{
          id: 'legacy-contours',
          kind: 'contours',
          url: 'https://tiles.example/legacy.pmtiles',
        }],
      },
    }
    const resolved = resolveAtlasArtifacts({
      artifacts: {
        base: manifest.artifacts!.base!,
        contours: [],
      },
    }, fallback, { requiredKinds: ['base', 'contours'] })

    expect(resolved.baseArtifacts.map(artifact => artifact.id)).toEqual(['base-us'])
    expect(resolved.contourArtifacts).toEqual([])
    expect(resolved.artifactIds).not.toContain('legacy-contours')
  })
})
