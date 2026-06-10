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
  estimatedNextBuildCostUsd: number
  actualBuildCostUsd: number | null
  actualOverlayCostUsd: number | null
  lastCostAuditAt: string | null
  terrainStrategy: string
  artifactKinds: string[]
  sourceStrategy: string
  maxOverlayZoom: number
  printQaRequired: boolean
  qaFixtures: Array<{
    label: string
    activity: string
    printSize: string
  }>
}

const repoRoot = resolve(__dirname, '..')
const coverageTargets = JSON.parse(
  readFileSync(resolve(repoRoot, 'atlas/coverage-targets.json'), 'utf8'),
) as {
  schemaVersion: string
  costGuardrails: {
    totalBuildBudgetUsd: number
    actualCoverageBuildCostUsd: number
    remainingCoverageBuildBudgetUsd: number
    awsExperimentBudgetUsdPerMonth: number
    manualApprovalRequiredFor: string[]
    perRunRequirements: string[]
  }
  targets: CoverageTarget[]
}
const atlasRegions = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/regions.json'), 'utf8')) as Record<string, unknown>
const premadeSlugs = new Set(PREMADE_MAPS.map(map => map.slug))

describe('atlas coverage target matrix', () => {
  it('keeps coverage targets unique and ordered', () => {
    expect(coverageTargets.schemaVersion).toBe('radmaps-atlas-coverage-targets-v2')
    expect(coverageTargets.costGuardrails.totalBuildBudgetUsd).toBe(200)
    expect(coverageTargets.costGuardrails.awsExperimentBudgetUsdPerMonth).toBeLessThanOrEqual(200)
    expect(
      coverageTargets.costGuardrails.actualCoverageBuildCostUsd +
      coverageTargets.costGuardrails.remainingCoverageBuildBudgetUsd,
    ).toBeLessThanOrEqual(coverageTargets.costGuardrails.totalBuildBudgetUsd)
    expect(coverageTargets.costGuardrails.manualApprovalRequiredFor.join(' ')).toContain('20 GB')
    expect(coverageTargets.costGuardrails.manualApprovalRequiredFor.join(' ')).toContain('200 USD')
    expect(coverageTargets.costGuardrails.perRunRequirements.join(' ')).toContain('--dry-run')
    expect(coverageTargets.costGuardrails.perRunRequirements.join(' ')).toContain('--estimated-cost-usd')

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
      expect(target.artifactKinds, target.id).toContain('base')
      expect(target.artifactKinds, target.id).toContain('poi')
      expect(target.artifactKinds, target.id).toContain('outdoorRoutes')
      expect(target.sourceStrategy, target.id).toMatch(/overlay|base|extract/i)
      expect(target.maxOverlayZoom, target.id).toBe(16)
      expect(target.printQaRequired, target.id).toBe(true)
      expect(target.qaFixtures.length, target.id).toBeGreaterThanOrEqual(2)
      expect(target.qaFixtures.every(fixture => fixture.printSize === '24x36'), target.id).toBe(true)
      expect(target.estimatedNextBuildCostUsd, target.id).toBeLessThanOrEqual(target.maxNewBuildCostUsd)
      expect(target.actualBuildCostUsd === null || target.actualBuildCostUsd >= 0, target.id).toBe(true)
      expect(target.actualOverlayCostUsd === null || target.actualOverlayCostUsd >= 0, target.id).toBe(true)

      for (const slug of target.anchorPremades) {
        expect(premadeSlugs.has(slug), `${target.id} references ${slug}`).toBe(true)
      }
    }
  })

  it('keeps first-wave global builds under the small-pack cost cap', () => {
    const firstWave = coverageTargets.targets.filter(target => target.status === 'build-candidate')

    expect(firstWave.map(target => target.id)).toEqual([])

    for (const target of firstWave) {
      expect(target.maxNewBuildCostUsd, target.id).toBeLessThanOrEqual(25)
    }

    const buildCandidateBudget = coverageTargets.targets
      .filter(target => target.status === 'build-candidate')
      .reduce((sum, target) => sum + target.estimatedNextBuildCostUsd, 0)
    expect(buildCandidateBudget + coverageTargets.costGuardrails.actualCoverageBuildCostUsd).toBeLessThanOrEqual(200)

    expect(coverageTargets.targets.find(target => target.id === 'new-zealand-outdoor')?.status).toBe('staging-live')
    expect(coverageTargets.targets.find(target => target.id === 'northern-spain-camino')?.status).toBe('staging-live')
    expect(coverageTargets.targets.find(target => target.id === 'honshu-japan')?.status).toBe('staging-live')
    expect(coverageTargets.targets.find(target => target.id === 'patagonia-andes')?.status).toBe('staging-live')
  })
})
