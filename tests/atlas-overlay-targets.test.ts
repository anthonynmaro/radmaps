import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type OverlayTarget = {
  label: string
  coverageTarget: string
  artifactPrefix: string
  maxPoiFeatures?: number
  maxOutdoorRouteFeatures?: number
  bboxes: Array<{
    label: string
    bbox: [number, number, number, number]
  }>
}

const repoRoot = resolve(__dirname, '..')
const overlays = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/overlay-targets.json'), 'utf8')) as {
  schemaVersion: string
  defaults: {
    minzoom: number
    maxzoom: number
    maxPoiFeatures: number
    maxOutdoorRouteFeatures: number
    maxOutdoorRouteGeometryPoints: number
  }
  targets: Record<string, OverlayTarget>
}
const coverageTargets = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/coverage-targets.json'), 'utf8')) as {
  costGuardrails: {
    totalBuildBudgetUsd: number
  }
  targets: Array<{
    id: string
    artifactKinds: string[]
    maxOverlayZoom: number
  }>
}

describe('atlas overlay target matrix', () => {
  it('keeps overlay targets first-class but budget-gated', () => {
    expect(overlays.schemaVersion).toBe('radmaps-atlas-overlay-targets-v1')
    expect(coverageTargets.costGuardrails.totalBuildBudgetUsd).toBeLessThanOrEqual(200)
    expect(overlays.defaults.minzoom).toBe(8)
    expect(overlays.defaults.maxzoom).toBe(16)
    expect(overlays.defaults.maxPoiFeatures).toBeGreaterThan(0)
    expect(overlays.defaults.maxOutdoorRouteFeatures).toBeGreaterThan(0)
    expect(overlays.defaults.maxOutdoorRouteGeometryPoints).toBeGreaterThan(0)
  })

  it('maps every overlay target to a coverage target that declares z16 overlays', () => {
    const coverageById = new Map(coverageTargets.targets.map(target => [target.id, target]))

    for (const [id, target] of Object.entries(overlays.targets)) {
      const coverage = coverageById.get(target.coverageTarget)
      expect(coverage, id).toBeTruthy()
      expect(coverage?.artifactKinds, id).toContain('poi')
      expect(coverage?.artifactKinds, id).toContain('outdoorRoutes')
      expect(coverage?.maxOverlayZoom, id).toBe(16)
    }
  })

  it('keeps artifact prefixes and hotspot bboxes valid', () => {
    const prefixes = Object.values(overlays.targets).map(target => target.artifactPrefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)

    for (const [id, target] of Object.entries(overlays.targets)) {
      expect(target.label.length, id).toBeGreaterThan(8)
      expect(target.artifactPrefix, id).toMatch(/^[a-z0-9][a-z0-9-]+$/)
      expect(target.bboxes.length, id).toBeGreaterThan(0)

      for (const hotspot of target.bboxes) {
        const [minLng, minLat, maxLng, maxLat] = hotspot.bbox
        expect(hotspot.label.length, id).toBeGreaterThan(2)
        expect(minLng, `${id}/${hotspot.label}`).toBeGreaterThanOrEqual(-180)
        expect(maxLng, `${id}/${hotspot.label}`).toBeLessThanOrEqual(180)
        expect(minLat, `${id}/${hotspot.label}`).toBeGreaterThanOrEqual(-90)
        expect(maxLat, `${id}/${hotspot.label}`).toBeLessThanOrEqual(90)
        expect(minLng, `${id}/${hotspot.label}`).toBeLessThan(maxLng)
        expect(minLat, `${id}/${hotspot.label}`).toBeLessThan(maxLat)
      }
    }
  })
})
