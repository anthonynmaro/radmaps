import { describe, expect, it } from 'vitest'

import { MAX_ROUTE_GEOJSON_BYTES, MAX_ROUTE_POINTS, assertRouteGeojsonSize, validateRouteGeojson } from '../server/utils/routeValidation'

function routeWithPointCount(count: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: Array.from({ length: count }, (_, index) => {
            const pct = index / Math.max(count - 1, 1)
            return [-90 + pct, 40 + pct * 0.1]
          }),
        },
      },
    ],
  }
}

describe('route GeoJSON validation', () => {
  it('accepts detailed long activity routes up to the route point budget', () => {
    expect(MAX_ROUTE_POINTS).toBe(100_000)
    expect(() => validateRouteGeojson(routeWithPointCount(100_000))).not.toThrow()
  })

  it('rejects routes above the route point budget with a clear error', () => {
    expect(() => validateRouteGeojson(routeWithPointCount(MAX_ROUTE_POINTS + 1))).toThrow(
      `Route exceeds ${MAX_ROUTE_POINTS.toLocaleString()} point limit`,
    )
  })

  it('rejects oversized serialized GeoJSON before render persistence', () => {
    const geojson = routeWithPointCount(2)
    geojson.features[0]!.properties = { padding: 'x'.repeat(MAX_ROUTE_GEOJSON_BYTES) }
    expect(() => assertRouteGeojsonSize(geojson)).toThrow('Route GeoJSON exceeds 5 MB limit')
  })
})
