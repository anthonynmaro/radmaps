import { describe, expect, it } from 'vitest'
import { ARCHETYPES, ARCHETYPE_REGIONS, SAMPLE_REGIONS, type SampleRegionFixture } from '../utils/styleBrowserFixtures'
import { buildThemeDataContext } from '../utils/themeDataContract'
import { parseMatrixOptions } from '../scripts/lib/matrixOptions.mjs'

const EXPECTED_ARCHETYPE_IDS = [
  'archetype-mountain-loop',
  'archetype-flat-marathon',
  'archetype-thru-hike',
  'archetype-place-only',
]

function regionFor(id: string): SampleRegionFixture {
  const region = SAMPLE_REGIONS[id]
  expect(region, `${id} must be registered in SAMPLE_REGIONS`).toBeDefined()
  return region
}

function haversineKm(a: number[], b: number[]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

describe('route archetype manifest', () => {
  it('registers exactly the four review archetypes with labels and stress notes', () => {
    expect(ARCHETYPES.map(archetype => archetype.id)).toEqual(EXPECTED_ARCHETYPE_IDS)
    for (const archetype of ARCHETYPES) {
      expect(archetype.label.trim().length).toBeGreaterThan(0)
      expect(archetype.stresses.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(ARCHETYPES.map(archetype => archetype.id)).size).toBe(ARCHETYPES.length)
  })

  it('resolves every archetype id to a fixture region (and keeps the page default region)', () => {
    for (const archetype of ARCHETYPES) {
      expect(SAMPLE_REGIONS[archetype.id]).toBe(ARCHETYPE_REGIONS[archetype.id])
    }
    // pages/style-browser-fixture.vue falls back to chicago; the extraction
    // must not drop it.
    expect(SAMPLE_REGIONS.chicago).toBeDefined()
  })

  it('gives every archetype a coherent title, location, and bbox containing its route', () => {
    for (const archetype of ARCHETYPES) {
      const region = regionFor(archetype.id)
      expect(region.title.trim().length).toBeGreaterThan(0)
      expect(region.location.trim().length).toBeGreaterThan(0)
      const [minLng, minLat, maxLng, maxLat] = region.bbox
      expect(minLng).toBeLessThan(maxLng)
      expect(minLat).toBeLessThan(maxLat)
      for (const [lng, lat] of region.route) {
        expect(lng, `${archetype.id} route lng within bbox`).toBeGreaterThanOrEqual(minLng)
        expect(lng, `${archetype.id} route lng within bbox`).toBeLessThanOrEqual(maxLng)
        expect(lat, `${archetype.id} route lat within bbox`).toBeGreaterThanOrEqual(minLat)
        expect(lat, `${archetype.id} route lat within bbox`).toBeLessThanOrEqual(maxLat)
      }
    }
  })
})

describe('loop archetypes', () => {
  it('mountain loop and flat marathon close on themselves (start ≈ finish)', () => {
    for (const id of ['archetype-mountain-loop', 'archetype-flat-marathon']) {
      const route = regionFor(id).route
      expect(route.length).toBeGreaterThanOrEqual(8)
      const gapKm = haversineKm(route[0], route[route.length - 1])
      expect(gapKm, `${id} start/finish gap`).toBeLessThan(0.1)
    }
  })

  it('mountain loop is high relief alpine data', () => {
    const stats = regionFor('archetype-mountain-loop').stats ?? {}
    expect((stats.max_elevation_m ?? 0) - (stats.min_elevation_m ?? 0)).toBeGreaterThan(1000)
    expect(stats.elevation_gain_m ?? 0).toBeGreaterThan(2000)
  })

  it('flat marathon aliases the boston marathon loop fixture and stays low relief', () => {
    const region = regionFor('archetype-flat-marathon')
    expect(region).toBe(SAMPLE_REGIONS.boston)
    const stats = region.stats ?? {}
    expect(stats.distance_km ?? 0).toBeGreaterThan(42)
    expect(stats.distance_km ?? 0).toBeLessThan(43)
    expect((stats.max_elevation_m ?? 0) - (stats.min_elevation_m ?? 0)).toBeLessThan(100)
  })
})

describe('thru-hike archetype', () => {
  it('is a long point-to-point linear route with meaningful elevation', () => {
    const region = regionFor('archetype-thru-hike')
    expect(region.route.length).toBeGreaterThanOrEqual(20)
    const startFinishKm = haversineKm(region.route[0], region.route[region.route.length - 1])
    expect(startFinishKm, 'start must be far from finish').toBeGreaterThan(30)
    const stats = region.stats ?? {}
    expect(stats.distance_km ?? 0).toBeGreaterThan(80)
    expect(stats.elevation_gain_m ?? 0).toBeGreaterThanOrEqual(1000)
    // sanity: trail distance must exceed the straight-line separation
    expect(stats.distance_km ?? 0).toBeGreaterThan(startFinishKm)
  })
})

describe('place-only archetype', () => {
  it('has no route geometry and no distance/elevation stats', () => {
    const region = regionFor('archetype-place-only')
    expect(region.route).toEqual([])
    const stats = region.stats ?? {}
    expect(stats.distance_km).toBe(0)
    expect(stats.elevation_gain_m).toBe(0)
    expect(stats.elevation_loss_m).toBe(0)
    expect(stats.max_elevation_m).toBe(0)
    expect(stats.min_elevation_m).toBe(0)
    expect(stats.duration_seconds).toBe(0)
  })

  it('classifies as place purpose under the theme data contract (route slots drop)', () => {
    const region = regionFor('archetype-place-only')
    const context = buildThemeDataContext({
      geojson: { type: 'FeatureCollection', features: [] },
      stats: region.stats,
      bbox: region.bbox,
    })
    expect(context.purpose).toBe('place')
    expect(context.hasRoute).toBe(false)
    expect(context.hasDistance).toBe(false)
    expect(context.hasElevation).toBe(false)
    expect(context.hasLocation).toBe(true)
  })
})

describe('matrix capture options', () => {
  it('parses the --matrix flag', () => {
    expect(parseMatrixOptions(['--matrix']).matrix).toBe(true)
    expect(parseMatrixOptions(['--matrix=1']).matrix).toBe(true)
    expect(parseMatrixOptions([]).matrix).toBe(false)
    expect(parseMatrixOptions(['--theme=blueprint']).matrix).toBe(false)
  })

  it('defaults grading output to docs/theme_matrix and honors overrides', () => {
    expect(parseMatrixOptions(['--matrix']).matrixOut).toBe('docs/theme_matrix')
    expect(parseMatrixOptions(['--matrix', '--matrix-out=/tmp/grading']).matrixOut).toBe('/tmp/grading')
  })

  it('parses archetype filters and help', () => {
    expect(parseMatrixOptions(['--matrix', '--archetype=archetype-place-only,archetype-thru-hike']).archetypeFilter)
      .toEqual(['archetype-place-only', 'archetype-thru-hike'])
    expect(parseMatrixOptions(['--matrix']).archetypeFilter).toEqual([])
    expect(parseMatrixOptions(['--help']).help).toBe(true)
    expect(parseMatrixOptions(['-h']).help).toBe(true)
    expect(parseMatrixOptions(['--matrix']).help).toBe(false)
  })
})
