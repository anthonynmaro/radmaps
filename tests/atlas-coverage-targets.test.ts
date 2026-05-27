import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PREMADE_MAPS } from '~/data/premade-maps'

type CoverageTarget = {
  id: string
  label: string
  priority: number
  status: string
  buildClass: string
  atlasRegion: string | null
  bbox: [number, number, number, number]
  activities: string[]
  anchorPremades: string[]
  maxNewBuildCostUsd: number
  terrainStrategy: string
}

const repoRoot = resolve(__dirname, '..')
const coverageTargets = JSON.parse(
  readFileSync(resolve(repoRoot, 'atlas/coverage-targets.json'), 'utf8'),
) as {
  schemaVersion: string
  costGuardrails: {
    awsExperimentBudgetUsdPerMonth: number
    manualApprovalRequiredFor: string[]
  }
  targets: CoverageTarget[]
}
const atlasRegions = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/regions.json'), 'utf8')) as Record<string, unknown>
const premadeSlugs = new Set(PREMADE_MAPS.map(map => map.slug))

describe('atlas coverage target matrix', () => {
  it('keeps coverage targets unique and ordered', () => {
    expect(coverageTargets.schemaVersion).toBe('radmaps-atlas-coverage-targets-v1')
    expect(coverageTargets.costGuardrails.awsExperimentBudgetUsdPerMonth).toBeLessThanOrEqual(300)
    expect(coverageTargets.costGuardrails.manualApprovalRequiredFor.join(' ')).toContain('20 GB')

    const ids = coverageTargets.targets.map(target => target.id)
    const priorities = coverageTargets.targets.map(target => target.priority)

    expect(new Set(ids).size).toBe(ids.length)
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b))
  })

  it('points runnable targets at declared atlas build regions', () => {
    for (const target of coverageTargets.targets) {
      if (target.status === 'build-candidate' || target.status === 'qa-ready' || target.status === 'staging-live') {
        expect(target.atlasRegion, target.id).toBeTruthy()
        expect(atlasRegions[target.atlasRegion!], target.id).toBeTruthy()
      }

      if (target.status.startsWith('deferred')) {
        expect(target.atlasRegion, target.id).toBeNull()
      }
    }
  })

  it('keeps bboxes valid and source premade slugs real', () => {
    for (const target of coverageTargets.targets) {
      const [minLng, minLat, maxLng, maxLat] = target.bbox

      expect(minLng, target.id).toBeGreaterThanOrEqual(-180)
      expect(maxLng, target.id).toBeLessThanOrEqual(180)
      expect(minLat, target.id).toBeGreaterThanOrEqual(-90)
      expect(maxLat, target.id).toBeLessThanOrEqual(90)
      expect(minLng, target.id).toBeLessThan(maxLng)
      expect(minLat, target.id).toBeLessThan(maxLat)
      expect(target.activities.length, target.id).toBeGreaterThan(0)
      expect(target.terrainStrategy, target.id).toContain('runtime')

      for (const slug of target.anchorPremades) {
        expect(premadeSlugs.has(slug), `${target.id} references ${slug}`).toBe(true)
      }
    }
  })

  it('keeps first-wave global builds under the small-pack cost cap', () => {
    const firstWave = coverageTargets.targets.filter(target => target.status === 'build-candidate')

    expect(firstWave.map(target => target.id)).toEqual([
      'patagonia-andes',
    ])

    for (const target of firstWave) {
      expect(target.maxNewBuildCostUsd, target.id).toBeLessThanOrEqual(25)
    }

    expect(coverageTargets.targets.find(target => target.id === 'new-zealand-outdoor')?.status).toBe('staging-live')
    expect(coverageTargets.targets.find(target => target.id === 'northern-spain-camino')?.status).toBe('staging-live')
    expect(coverageTargets.targets.find(target => target.id === 'honshu-japan')?.status).toBe('staging-live')
  })
})
