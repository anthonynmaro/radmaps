import { describe, expect, it } from 'vitest'
import { bboxForCoords, bendLineCoords, buildGeometryBackedSegmentPatch, deletedRangesFromIndexes, deletedRangesFromRouteIndexes, excludeRangesFromRoute, extendSegmentCoordinates, isGeometryBackedSegment, lineStringFeatureCollection, mergeDeletedRangesForRoute, resolveTrailSegmentGeojson, routeRangesToGeojson, routeStatsForCoords, sanitizeSegmentBends, sliceRouteByPercent, trailSegmentEndpointFeatures } from '../utils/trail'
import type { TrailSegment } from '../types'

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

describe('trail segment geometry', () => {
  it('resolves legacy segments as slices of the primary route', () => {
    const primary = lineRoute([
      [-89, 40],
      [-89.0001, 40],
      [-89.0002, 40],
      [-89.0003, 40],
    ])
    const segment: TrailSegment = {
      id: 'primary-segment',
      name: 'Primary',
      color: '#2D6A4F',
      visible: true,
      section_start: 25,
      section_end: 75,
    }

    const resolved = resolveTrailSegmentGeojson(primary, segment)

    expect((resolved.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-89.0001, 40],
      [-89.0002, 40],
    ])
  })

  it('resolves uploaded-track segments against their own geometry', () => {
    const primary = lineRoute([
      [-89, 40],
      [-89.0001, 40],
    ])
    const uploaded = lineRoute([
      [-90, 41],
      [-90.0001, 41],
      [-90.0002, 41],
      [-90.0003, 41],
    ])
    const segment: TrailSegment = {
      id: 'uploaded-segment',
      name: 'Uploaded',
      color: '#3A7CA5',
      visible: true,
      source: 'uploaded-track',
      geojson: uploaded,
      section_start: 25,
      section_end: 75,
    }

    const resolved = resolveTrailSegmentGeojson(primary, segment)

    expect((resolved.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-90.0001, 41],
      [-90.0002, 41],
    ])
  })

  it('resolves drawn-track segments against their own geometry', () => {
    const primary = lineRoute([
      [-89, 40],
      [-89.0001, 40],
    ])
    const drawn = lineRoute([
      [-90, 41],
      [-90.0001, 41],
      [-90.0002, 41],
      [-90.0003, 41],
    ])
    const segment: TrailSegment = {
      id: 'drawn-segment',
      name: 'Drawn',
      color: '#E87722',
      visible: true,
      source: 'drawn-track',
      geojson: drawn,
      section_start: 25,
      section_end: 75,
    }

    const resolved = resolveTrailSegmentGeojson(primary, segment)

    expect((resolved.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-90.0001, 41],
      [-90.0002, 41],
    ])
  })

  it('keeps geometry-backed segment points connected across intentional long jumps', () => {
    const primary = lineRoute([
      [-89, 40],
      [-89.0001, 40],
    ])
    const drawn = lineRoute([
      [-90, 41],
      [-90.02, 41],
      [-90.04, 41],
    ])
    const segment: TrailSegment = {
      id: 'drawn-extension',
      name: 'Drawn extension',
      color: '#E87722',
      visible: true,
      source: 'drawn-track',
      geojson: drawn,
      section_start: 0,
      section_end: 100,
    }

    const resolved = resolveTrailSegmentGeojson(primary, segment)

    expect(resolved.features).toHaveLength(1)
    expect((resolved.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-90, 41],
      [-90.02, 41],
      [-90.04, 41],
    ])
  })

  it('builds drawn segment geometry, bbox, and distance-only stats from clicked points', () => {
    const coords = [
      [-90, 41],
      [-90.001, 41],
      [-90.001, 41.001],
    ]

    const geojson = lineStringFeatureCollection(coords)
    const stats = routeStatsForCoords(coords)
    const patch = buildGeometryBackedSegmentPatch(coords)

    expect((geojson.features[0].geometry as GeoJSON.LineString).coordinates).toEqual(coords)
    expect(bboxForCoords(coords)).toEqual([-90.001, 41, -90, 41.001])
    expect(stats.distance_km).toBeGreaterThan(0)
    expect(stats.elevation_gain_m).toBe(0)
    expect(patch.geojson).toEqual(geojson)
    expect(patch.bbox).toEqual([-90.001, 41, -90, 41.001])
    expect(patch.section_start).toBe(0)
    expect(patch.section_end).toBe(100)
  })

  it('calculates segment elevation gain when coordinates include elevation', () => {
    const stats = routeStatsForCoords([
      [-90, 41, 100],
      [-90.001, 41, 130],
      [-90.002, 41, 110],
      [-90.003, 41, 150],
    ])

    expect(stats.elevation_gain_m).toBe(70)
    expect(stats.elevation_loss_m).toBe(20)
    expect(stats.min_elevation_m).toBe(100)
    expect(stats.max_elevation_m).toBe(150)
  })

  it('appends and prepends extension points for geometry-backed segments', () => {
    const segment: TrailSegment = {
      id: 'drawn-segment',
      name: 'Drawn',
      color: '#E87722',
      visible: true,
      source: 'drawn-track',
      geojson: lineRoute([
        [-90, 41],
        [-90.001, 41],
      ]),
      section_start: 0,
      section_end: 100,
    }

    expect(extendSegmentCoordinates(segment, [[-90.002, 41]], 'end')).toEqual([
      [-90, 41],
      [-90.001, 41],
      [-90.002, 41],
    ])
    expect(extendSegmentCoordinates(segment, [[-89.999, 41], [-89.998, 41]], 'start')).toEqual([
      [-89.998, 41],
      [-89.999, 41],
      [-90, 41],
      [-90.001, 41],
    ])
    expect(isGeometryBackedSegment(segment)).toBe(true)
  })

  it('builds segment handle features from resolved geometry endpoints', () => {
    const resolved = lineRoute([
      [-90, 41],
      [-90.0001, 41],
      [-90.0002, 41],
    ])

    const handles = trailSegmentEndpointFeatures(resolved, '#3A7CA5')

    expect(handles.map(feature => feature.geometry)).toEqual([
      { type: 'Point', coordinates: [-90, 41] },
      { type: 'Point', coordinates: [-90.0002, 41] },
    ])
    expect(handles.map(feature => feature.properties?.color)).toEqual(['#3A7CA5', '#3A7CA5'])
  })

  it('curves point-to-point geometry and flips bend direction while keeping endpoints anchored', () => {
    const coords = [
      [-90, 41],
      [-89.99, 41],
    ]

    const rightBend = bendLineCoords(coords, 1)
    const leftBend = bendLineCoords(coords, -1)

    expect(rightBend[0]).toEqual(coords[0])
    expect(rightBend[rightBend.length - 1]).toEqual(coords[1])
    expect(leftBend[0]).toEqual(coords[0])
    expect(leftBend[leftBend.length - 1]).toEqual(coords[1])
    expect(rightBend.length).toBeGreaterThan(coords.length)
    expect(rightBend[Math.floor(rightBend.length / 2)][1]).toBeGreaterThan(41)
    expect(leftBend[Math.floor(leftBend.length / 2)][1]).toBeLessThan(41)
  })

  it('applies bend only to the requested stretch between editable points', () => {
    const coords = [
      [-90, 41],
      [-89.99, 41],
      [-89.98, 41],
    ]

    const bent = bendLineCoords(coords, [0, 1])

    expect(bent[0]).toEqual(coords[0])
    expect(bent).toContainEqual(coords[1])
    expect(bent[bent.length - 1]).toEqual(coords[2])
    expect(bent.slice(0, bent.findIndex(coord => coord[0] === coords[1][0] && coord[1] === coords[1][1]) + 1)).toEqual([
      coords[0],
      coords[1],
    ])
    expect(bent.slice(bent.findIndex(coord => coord[0] === coords[1][0] && coord[1] === coords[1][1]) + 1)).toHaveLength(12)
  })

  it('sanitizes noisy bend values from dense edit sessions', () => {
    expect(sanitizeSegmentBends([0.02, -0.04, 0.07], 3)).toEqual([0, 0, 0])
    expect(sanitizeSegmentBends(Array(20).fill(0.5), 20)).toEqual(Array(20).fill(0))
    expect(sanitizeSegmentBends([0, 0.4, 0, -0.3], 4)).toEqual([0, 0.4, 0, -0.3])
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
