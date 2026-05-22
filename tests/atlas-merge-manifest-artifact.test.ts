import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

describe('atlas manifest artifact merge script', () => {
  it('adds a large base artifact without removing existing base or contour coverage', () => {
    const workdir = mkdtempSync(join(tmpdir(), 'radmaps-atlas-merge-'))
    const targetPath = join(workdir, 'staging.json')
    const sourcePath = join(workdir, 'north-america.json')
    const outputPath = join(workdir, 'merged.json')

    writeFileSync(targetPath, `${JSON.stringify({
      atlasVersion: '2026.05.18-staging',
      schemaVersion: 'radmaps-atlas-v1',
      coverage: 'us',
      label: 'Existing staging',
      storage: {
        provider: 'cloudflare-r2',
        publicBaseUrl: 'https://old.example',
      },
      artifacts: {
        base: [
          {
            id: 'radmaps-us-base',
            kind: 'base',
            url: 'https://old.example/atlas/v1/base/us/base.pmtiles',
            objectPath: 'atlas/v1/base/us/base.pmtiles',
            layers: ['water', 'transportation', 'place'],
          },
        ],
        contours: [
          {
            id: 'radmaps-yosemite-contours-r1c1',
            kind: 'contours',
            url: 'https://old.example/atlas/v1/terrain/yosemite/r1c1.pmtiles',
            objectPath: 'atlas/v1/terrain/yosemite/r1c1.pmtiles',
            layers: ['contour'],
          },
        ],
      },
      layerCatalog: ['water', 'transportation', 'place', 'contour'],
    }, null, 2)}\n`)

    writeFileSync(sourcePath, `${JSON.stringify({
      artifacts: {
        base: [
          {
            id: 'radmaps-north-america-base',
            kind: 'base',
            url: 'https://build-runner.example/generated.pmtiles',
            objectPath: 'atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles',
            bounds: [-170, 5, -50, 84],
            minzoom: 0,
            maxzoom: 14,
            bytes: 20296668015,
            layers: ['water', 'waterway', 'landcover', 'landuse', 'transportation', 'transportation_name', 'building', 'poi', 'place'],
          },
        ],
      },
    }, null, 2)}\n`)

    execFileSync('node', [
      'scripts/atlas-merge-manifest-artifact.mjs',
      '--source',
      sourcePath,
      '--target',
      targetPath,
      '--output',
      outputPath,
      '--kind',
      'base',
      '--public-base-url',
      'https://pub-staging.example',
      '--atlas-version',
      '2026.05.21-staging-composite.1',
      '--label',
      'North America staging composite',
      '--coverage',
      'north-america',
    ], { cwd: repoRoot, stdio: 'pipe' })

    const merged = JSON.parse(readFileSync(outputPath, 'utf8'))

    expect(merged.atlasVersion).toBe('2026.05.21-staging-composite.1')
    expect(merged.coverage).toBe('north-america')
    expect(merged.storage.publicBaseUrl).toBe('https://pub-staging.example')
    expect(merged.artifacts.base.map((artifact: { id: string }) => artifact.id)).toEqual([
      'radmaps-us-base',
      'radmaps-north-america-base',
    ])
    expect(merged.artifacts.contours.map((artifact: { id: string }) => artifact.id)).toEqual([
      'radmaps-yosemite-contours-r1c1',
    ])
    expect(merged.artifacts.base[1].url).toBe(
      'https://pub-staging.example/atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles',
    )
    expect(merged.layerCatalog).toContain('waterway')
    expect(merged.layerCatalog).toContain('building')
    expect(merged.layerCatalog).not.toContain('landuse')
    expect(merged.layerCatalog).not.toContain('transportation_name')
  })
})
