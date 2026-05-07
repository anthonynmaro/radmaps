import { describe, expect, it } from 'vitest'
import { deletedRangesFromIndexes, deletedRangesFromRouteIndexes, excludeRangesFromRoute, mergeDeletedRangesForRoute, routeRangesToGeojson, sliceRouteByPercent } from '../utils/trail'

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

    expect(sliced.features).toHaveLength(2)
    expect(sliced.features.map(feature => feature.geometry.type)).toEqual(['LineString', 'LineString'])
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

    expect(sliced.features.map(feature => (feature.geometry as GeoJSON.LineString).coordinates)).toEqual([
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

  it('can bridge small missed index gaps for brush strokes', () => {
    const ranges = deletedRangesFromIndexes([10, 11, 15, 16], 100, 1, 3)

    expect(ranges).toEqual([
      { start: 9, end: 18 },
    ])
  })

  it('does not bridge brushed route ranges across hidden GPS jumps', () => {
    const coords = [
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.5, 40.5],
      [-89.5001, 40.5],
      [-89.5002, 40.5],
    ]

    const ranges = deletedRangesFromRouteIndexes([3, 4], coords, 1, 4, 250)

    expect(ranges).toEqual([
      { start: 50, end: 100, start_index: 3, end_index: 6 },
    ])
  })

  it('can keep brush deletion literal with no padding or bridge expansion', () => {
    const coords = [
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.5, 40.5],
      [-89.5001, 40.5],
      [-89.5002, 40.5],
    ]

    const ranges = deletedRangesFromRouteIndexes([3, 4], coords, 0, 0, 250)

    expect(ranges).toEqual([
      { start: 50, end: 83.33333333333334, start_index: 3, end_index: 5 },
    ])
  })

  it('splits route-aware brush ranges at the same 50m gaps used for rendering', () => {
    const coords = [
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.00082, 40.0],
      [-89.00092, 40.0],
      [-89.00102, 40.0],
    ]

    const ranges = deletedRangesFromRouteIndexes([1, 2, 3, 4], coords, 0, 0, 50)

    expect(ranges).toEqual([
      { start: 16.666666666666664, end: 50, start_index: 1, end_index: 3 },
      { start: 50, end: 83.33333333333334, start_index: 3, end_index: 5 },
    ])
  })

  it('does not merge adjacent saved ranges when their shared edge is a GPS jump', () => {
    const coords = [
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.5, 40.5],
      [-89.5001, 40.5],
      [-89.5002, 40.5],
    ]

    const ranges = deletedRangesFromRouteIndexes([1, 2, 3, 4], coords, 1, 4, 250)

    expect(ranges).toEqual([
      { start: 0, end: 50, start_index: 0, end_index: 3 },
      { start: 50, end: 100, start_index: 3, end_index: 6 },
    ])
  })

  it('keeps apply-time route range merging from crossing GPS jumps', () => {
    const geojson = lineRoute([
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.5, 40.5],
      [-89.5001, 40.5],
      [-89.5002, 40.5],
    ])

    const ranges = mergeDeletedRangesForRoute(geojson, [
      { start: 0, end: 50 },
      { start: 50, end: 100 },
    ])

    expect(ranges).toEqual([
      { start: 0, end: 50, start_index: 0, end_index: 3 },
      { start: 50, end: 100, start_index: 3, end_index: 6 },
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

    expect(preview.features).toHaveLength(2)
    expect((preview.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-89.0001, 40.0],
      [-89.0002, 40.0],
    ])
    expect((preview.features[1].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-89.0005, 40.0],
      [-89.0006, 40.0],
    ])
  })

  it('uses exact brush indexes instead of broad percentage spans when both are present', () => {
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

    const applied = excludeRangesFromRoute(geojson, 0, 100, [{
      start: 0,
      end: 100,
      start_index: 3,
      end_index: 5,
    }])

    expect(applied.features.map(feature => (feature.geometry as GeoJSON.LineString).coordinates)).toEqual([
      [
        [-89.0, 40.0],
        [-89.0001, 40.0],
        [-89.0002, 40.0],
      ],
      [
        [-89.0005, 40.0],
        [-89.0006, 40.0],
        [-89.0007, 40.0],
      ],
    ])
  })

  it('applies deleted ranges to the main route as separate line features', () => {
    const geojson = lineRoute([
      [-89.0, 40.0],
      [-89.0001, 40.0],
      [-89.0002, 40.0],
      [-89.0003, 40.0],
      [-89.0004, 40.0],
      [-89.0005, 40.0],
    ])

    const routed = excludeRangesFromRoute(geojson, 0, 100, [{ start: 40, end: 60 }])

    expect(routed.features).toHaveLength(2)
    expect(routed.features.map(feature => feature.geometry.type)).toEqual(['LineString', 'LineString'])
    expect((routed.features[0].geometry as GeoJSON.LineString).coordinates.at(-1)).toEqual([-89.0001, 40.0])
    expect((routed.features[1].geometry as GeoJSON.LineString).coordinates[0]).toEqual([-89.0004, 40.0])
  })
})
