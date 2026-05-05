import { describe, expect, it } from 'vitest'
import { deletedRangesFromIndexes, routeRangesToGeojson, sliceRouteByPercent } from '../utils/trail'

function lineRoute(coords: number[][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }],
  }
}

describe('sliceRouteByPercent', () => {
  it('splits large coordinate jumps instead of drawing connector chords', () => {
    const geojson = lineRoute([
      [-89.0, 40.0],
      [-89.0001, 40.0001],
      [-89.01, 40.01],
      [-89.0101, 40.0101],
    ])

    const sliced = sliceRouteByPercent(geojson, 0, 100)
    const geometry = sliced.features[0]?.geometry

    expect(geometry?.type).toBe('MultiLineString')
    expect((geometry as GeoJSON.MultiLineString).coordinates).toHaveLength(2)
  })

  it('keeps deleted ranges as route gaps inside segment slices', () => {
    const geojson = lineRoute([
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.0003, 40.0],
      [-89.0004, 40.0],
      [-89.0005, 40.0],
    ])

    const sliced = sliceRouteByPercent(geojson, 0, 100, [{ start: 40, end: 60 }])
    const geometry = sliced.features[0]?.geometry as GeoJSON.MultiLineString

    expect(geometry.type).toBe('MultiLineString')
    expect(geometry.coordinates).toEqual([
      [
        [-89.0, 40.0],
        [-89.0001, 40.0],
      ],
      [
        [-89.0004, 40.0],
        [-89.0005, 40.0],
      ],
    ])
  })
})

describe('route deletion helpers', () => {
  it('groups brushed coordinate indexes into mergeable deleted ranges', () => {
    const ranges = deletedRangesFromIndexes([1, 2, 10, 11], 20, 0)

    expect(ranges).toEqual([
      { start: 5, end: 15 },
      { start: 50, end: 60 },
    ])
  })

  it('renders selected deletion ranges without connector chords', () => {
    const geojson = lineRoute([
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.0003, 40.0],
      [-89.0004, 40.0],
      [-89.0005, 40.0],
      [-89.0006, 40.0],
      [-89.0007, 40.0],
    ])

    const preview = routeRangesToGeojson(geojson, [
      { start: 12.5, end: 37.5 },
      { start: 62.5, end: 87.5 },
    ])
    const geometry = preview.features[0]?.geometry as GeoJSON.MultiLineString

    expect(geometry.type).toBe('MultiLineString')
    expect(geometry.coordinates).toHaveLength(2)
    expect(geometry.coordinates[0]).toEqual([
      [-89.0001, 40.0],
      [-89.0002, 40.0],
    ])
    expect(geometry.coordinates[1]).toEqual([
      [-89.0005, 40.0],
      [-89.0006, 40.0],
    ])
  })
})
