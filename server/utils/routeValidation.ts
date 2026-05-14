import { createError } from 'h3'

const MAX_ROUTE_POINTS = 50_000

function assertFiniteLngLat(coord: unknown): asserts coord is [number, number, ...number[]] {
  if (!Array.isArray(coord) || coord.length < 2) {
    throw createError({ statusCode: 400, message: 'Invalid route coordinate' })
  }
  const [lng, lat, alt] = coord
  if (
    typeof lng !== 'number' || typeof lat !== 'number' ||
    !Number.isFinite(lng) || !Number.isFinite(lat) ||
    lng < -180 || lng > 180 || lat < -90 || lat > 90
  ) {
    throw createError({ statusCode: 400, message: 'Route coordinates are out of range' })
  }
  if (alt !== undefined && (typeof alt !== 'number' || !Number.isFinite(alt))) {
    throw createError({ statusCode: 400, message: 'Invalid elevation value in route' })
  }
}

export function validateRouteGeojson(geojson: unknown): asserts geojson is GeoJSON.FeatureCollection {
  if (!geojson || typeof geojson !== 'object' || (geojson as { type?: unknown }).type !== 'FeatureCollection') {
    throw createError({ statusCode: 400, message: 'Route must be a GeoJSON FeatureCollection' })
  }

  const features = (geojson as { features?: unknown }).features
  if (!Array.isArray(features) || features.length === 0) {
    throw createError({ statusCode: 400, message: 'Route has no features' })
  }

  let pointCount = 0
  for (const feature of features) {
    const geometry = (feature as { geometry?: { type?: unknown; coordinates?: unknown } })?.geometry
    if (!geometry) continue

    if (geometry.type === 'LineString') {
      if (!Array.isArray(geometry.coordinates)) {
        throw createError({ statusCode: 400, message: 'Invalid route geometry' })
      }
      for (const coord of geometry.coordinates) {
        assertFiniteLngLat(coord)
        pointCount++
      }
    } else if (geometry.type === 'MultiLineString') {
      if (!Array.isArray(geometry.coordinates)) {
        throw createError({ statusCode: 400, message: 'Invalid route geometry' })
      }
      for (const line of geometry.coordinates) {
        if (!Array.isArray(line)) throw createError({ statusCode: 400, message: 'Invalid route geometry' })
        for (const coord of line) {
          assertFiniteLngLat(coord)
          pointCount++
        }
      }
    } else if (geometry.type === 'Point') {
      // "Place a location" posters store the pin as a single Point feature.
      // No route geometry, just a coordinate the renderer frames the map around.
      assertFiniteLngLat(geometry.coordinates)
      pointCount++
    } else if (geometry.type === 'MultiPoint') {
      if (!Array.isArray(geometry.coordinates)) {
        throw createError({ statusCode: 400, message: 'Invalid route geometry' })
      }
      for (const coord of geometry.coordinates) {
        assertFiniteLngLat(coord)
        pointCount++
      }
    } else {
      continue
    }

    if (pointCount > MAX_ROUTE_POINTS) {
      throw createError({ statusCode: 413, message: `Route exceeds ${MAX_ROUTE_POINTS.toLocaleString()} point limit` })
    }
  }

  if (pointCount === 0) {
    throw createError({ statusCode: 400, message: 'Route has no coordinates' })
  }
}
