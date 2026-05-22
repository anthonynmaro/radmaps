import { describe, expect, it } from 'vitest'

import {
  STRAVA_IMPORT_MAX_POINTS,
  buildStravaImportRoute,
  simplifyStravaCoordinates,
} from '../server/utils/stravaImportRoute'
import { validateRouteGeojson } from '../server/utils/routeValidation'

const activity = {
  name: 'Morning Ride',
  sport_type: 'Ride',
  distance: 40_394,
  total_elevation_gain: 296,
  elapsed_time: 70_320,
  start_date: '2026-04-12T12:00:00Z',
}

function syntheticRideStream(count: number): {
  latlng: { data: [number, number][] }
  altitude: { data: number[] }
} {
  const latlng: [number, number][] = []
  const altitude: number[] = []

  for (let i = 0; i < count; i++) {
    const pct = i / (count - 1)
    const lat = 43.05 + pct * 0.25 + Math.sin(pct * Math.PI * 12) * 0.003
    const lng = -89.45 + pct * 0.55 + Math.cos(pct * Math.PI * 10) * 0.004
    latlng.push([lat, lng])
    altitude.push(260 + Math.sin(pct * Math.PI * 20) * 30)
  }

  return { latlng: { data: latlng }, altitude: { data: altitude } }
}

describe('Strava import route building', () => {
  it('keeps normal activities unchanged', () => {
    const route = buildStravaImportRoute(activity, syntheticRideStream(120))
    const coordinates = route.geojson.features[0].geometry.type === 'LineString'
      ? route.geojson.features[0].geometry.coordinates
      : []

    expect(route.sourcePointCount).toBe(120)
    expect(route.importedPointCount).toBe(120)
    expect(coordinates).toHaveLength(120)
    expect(() => validateRouteGeojson(route.geojson)).not.toThrow()
  })

  it('simplifies long Strava streams before the 50k route guard rejects them', () => {
    const route = buildStravaImportRoute(activity, syntheticRideStream(60_001))
    const coordinates = route.geojson.features[0].geometry.type === 'LineString'
      ? route.geojson.features[0].geometry.coordinates
      : []

    expect(route.sourcePointCount).toBe(60_001)
    expect(route.importedPointCount).toBeLessThanOrEqual(STRAVA_IMPORT_MAX_POINTS)
    expect(coordinates.at(0)?.[0]).toBeCloseTo(-89.446)
    expect(coordinates.at(0)?.[1]).toBeCloseTo(43.05)
    expect(coordinates.at(-1)?.[0]).toBeCloseTo(-88.896)
    expect(coordinates.at(-1)?.[1]).toBeCloseTo(43.3)
    expect(route.bbox[0]).toBeLessThan(route.bbox[2])
    expect(route.bbox[1]).toBeLessThan(route.bbox[3])
    expect(route.stats.distance_km).toBe(40.39)
    expect(route.stats.duration_seconds).toBe(70_320)
    expect(() => validateRouteGeojson(route.geojson)).not.toThrow()
  })

  it('falls back to endpoint-preserving sampling for extremely dense straight streams', () => {
    const coords = Array.from({ length: 70_000 }, (_, i) => {
      const pct = i / 69_999
      return [-89 + pct, 43 + pct] as [number, number]
    })

    const simplified = simplifyStravaCoordinates(coords)

    expect(simplified.length).toBeLessThanOrEqual(STRAVA_IMPORT_MAX_POINTS)
    expect(simplified[0]).toEqual(coords[0])
    expect(simplified.at(-1)).toEqual(coords.at(-1))
  })
})
