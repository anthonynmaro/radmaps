import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Atlas terrain manifest sync script', () => {
  it('adds verified terrain plan artifacts to an atlas manifest without requiring hardcoded URLs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'radmaps-atlas-manifest-'))
    const manifestPath = join(dir, 'staging.json')
    writeFileSync(manifestPath, JSON.stringify({
      atlasVersion: 'test-atlas',
      schemaVersion: 'radmaps-atlas-v1',
      storage: {
        provider: 'cloudflare-r2',
        bucket: 'radmaps-atlas-staging',
        publicBaseUrl: 'https://tiles.example.test',
      },
      artifacts: {
        base: [{
          id: 'radmaps-us-base',
          kind: 'base',
          url: 'https://tiles.example.test/base.pmtiles',
          objectPath: 'atlas/v1/base/us/base.pmtiles',
          minzoom: 0,
          maxzoom: 14,
          bounds: [-125, 24.4, -66.8, 49.5],
          layers: ['water'],
        }],
        contours: [],
      },
      layerCatalog: ['water'],
    }, null, 2))

    execFileSync(process.execPath, [
      'scripts/atlas-sync-terrain-manifest.mjs',
      '--pack',
      'us-terrain-backbone',
      '--date',
      '2026-05-18',
      '--environment',
      'staging',
      '--manifest',
      manifestPath,
      '--verify',
      'none',
    ], { encoding: 'utf8' })

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    expect(manifest.artifacts.contours.length).toBe(136)
    expect(manifest.layerCatalog).toContain('contour')
    expect(manifest.artifacts.contours[0]).toMatchObject({
      kind: 'contours',
      layers: ['contour'],
      status: 'staging',
    })
    expect(manifest.artifacts.contours.some((artifact: { id: string }) =>
      artifact.id === 'radmaps-sierra-yosemite-expanded-r1c1-contours',
    )).toBe(true)
  })
})
