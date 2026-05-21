import { describe, expect, it } from 'vitest'
import type { AtlasManifest } from '../utils/atlasManifest'
import {
  manifestObjectPath,
  parseTileRequestPath,
  tileToBbox,
  validateArtifactTileRequest,
} from '../workers/atlas-tiles/src/routing'

const manifest: AtlasManifest = {
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
      },
    ],
  },
}

describe('Atlas Worker routing', () => {
  it('parses only approved tile routes', () => {
    expect(parseTileRequestPath('/tiles/staging/base-us/8/44/97.mvt')).toMatchObject({
      environment: 'staging',
      artifactId: 'base-us',
      z: 8,
      x: 44,
      y: 97,
    })
    expect(() => parseTileRequestPath('/tiles/staging/base-us/8/44/97.png')).toThrow(/.mvt/)
  })

  it('rejects coordinates outside the z/x/y matrix', () => {
    expect(() => parseTileRequestPath('/tiles/staging/base-us/2/4/0.mvt')).toThrow(/outside zoom range/)
  })

  it('validates artifact identity, zoom range, and bounds', () => {
    const parsed = parseTileRequestPath('/tiles/staging/base-us/8/44/97.mvt')
    expect(parsed).not.toBeNull()
    expect(validateArtifactTileRequest(manifest, parsed!).id).toBe('base-us')

    const outside = parseTileRequestPath('/tiles/staging/base-us/8/1/1.mvt')
    expect(() => validateArtifactTileRequest(manifest, outside!)).toThrow(/outside artifact bounds/)
  })

  it('uses fixed R2 manifest object paths', () => {
    expect(manifestObjectPath('production')).toBe('atlas/v1/manifests/production.json')
    const [west, south, east, north] = tileToBbox(0, 0, 0)
    expect(west).toBe(-180)
    expect(east).toBe(180)
    expect(south).toBeCloseTo(-85.05112877980659)
    expect(north).toBeCloseTo(85.05112877980659)
  })
})
