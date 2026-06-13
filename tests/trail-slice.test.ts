import { describe, expect, it } from 'vitest'
import { bboxForCoords, bendLineCoords, buildElevationProfile, buildGeometryBackedSegmentPatch, defaultTrailSegmentColor, deletedRangesFromIndexes, deletedRangesFromRouteIndexes, excludeRangesFromRoute, extendSegmentCoordinates, extractNamedTrackSegments, isGeometryBackedSegment, lineStringFeatureCollection, mergeDeletedRangesForRoute, resolveTrailSegmentGeojson, routeRangesToGeojson, routeStatsForCoords, sanitizeSegmentBends, patchTrailSegment, removeTrailSegment, sliceRouteByPercent, splitTrailSegmentAt, splitTrailSegmentInList, trailSegmentEndpointFeatures } from '../utils/trail'
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

describe('defaultTrailSegmentColor', () => {
  it('uses the active route color for Dark Sky segments', () => {
    expect(defaultTrailSegmentColor(
      { color_theme: 'dark-sky', route_color: '#F4B942' },
      [{ color: '#F4B942' }],
    )).toBe('#F4B942')
  })

  it('keeps the normal unique-color palette for other themes', () => {
    expect(defaultTrailSegmentColor(
      { color_theme: 'chalk', route_color: '#C1121F' },
      [{ color: '#2D6A4F' }],
    )).toBe('#3A7CA5')
  })
})

describe('buildElevationProfile', () => {
  it('compresses profile relief while preserving elevation labels', () => {
    const geojson = lineRoute(Array.from({ length: 12 }, (_, index) => [
      -89 + index * 0.001,
      40,
      200 + index * 10,
    ]))

    const fullRelief = buildElevationProfile(geojson, 20, 1)
    const compressed = buildElevationProfile(geojson, 20, 0.5)

    expect(fullRelief).toMatchObject({ minElev: 200, maxElev: 310 })
    expect(compressed).toMatchObject({ minElev: 200, maxElev: 310 })
    expect(fullRelief?.strokePath).toContain('1000,8')
    expect(compressed?.strokePath).toContain('1000,54')
  })

  it('can derive a synthetic profile from sparse route geometry when explicitly allowed', () => {
    const geojson = lineRoute([
      [-89, 40],
      [-88.998, 40.002],
      [-88.996, 39.998],
      [-88.994, 40.003],
    ])

    expect(buildElevationProfile(geojson)).toBeNull()

    const fallback = buildElevationProfile(geojson, 20, 0.65, true)
    expect(fallback?.synthetic).toBe(true)
    expect(fallback?.strokePath).toContain('1000')
  })

  it('rejects the synthetic profile fallback outside tests', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      expect(() => buildElevationProfile(lineRoute([
        [-89, 40],
        [-88.998, 40.002],
      ]), 20, 0.65, true)).toThrow(/test-only/)
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })
})

describe('trail segment geometry', () => {
  it('extracts named GPX tracks as exact uploaded-track geometries', () => {
    const primary: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '\nTiny Connector\n' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-90, 41],
              [-90.001, 41],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { name: 'Long Trail' },
          geometry: {
            type: 'LineString',
            coordinates: Array.from({ length: 400 }, (_, i) => [-89 - i * 0.0001, 40]),
          },
        },
      ],
    }

    const segments = extractNamedTrackSegments(primary)
    const resolvedTiny = resolveTrailSegmentGeojson(primary, segments[0])

    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      name: 'Tiny Connector',
      source: 'uploaded-track',
      section_start: 0,
      section_end: 100,
      bbox: [-90.001, 41, -90, 41],
    })
    expect(segments[0].geojson?.features).toHaveLength(1)
    expect((resolvedTiny.features[0].geometry as GeoJSON.LineString).coordinates).toEqual([
      [-90, 41],
      [-90.001, 41],
    ])
  })

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

  it('preserves uploaded-track line boundaries instead of stitching separate GPX parts', () => {
    const primary = lineRoute([
      [-89, 40],
      [-89.0001, 40],
    ])
    const uploaded: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [-90, 41],
              [-90.001, 41],
              [-90.002, 41],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [-91, 42],
              [-91.001, 42],
              [-91.002, 42],
            ],
          },
        },
      ],
    }
    const segment: TrailSegment = {
      id: 'uploaded-multipart',
      name: 'Uploaded multipart',
      color: '#3A7CA5',
      visible: true,
      source: 'uploaded-track',
      geojson: uploaded,
      section_start: 0,
      section_end: 100,
    }

    const resolved = resolveTrailSegmentGeojson(primary, segment)

    expect(resolved.features).toHaveLength(2)
    expect(resolved.features.map(feature => (feature.geometry as GeoJSON.LineString).coordinates)).toEqual([
      [
        [-90, 41],
        [-90.001, 41],
        [-90.002, 41],
      ],
      [
        [-91, 42],
        [-91.001, 42],
        [-91.002, 42],
      ],
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
    // No seg_id requested → property absent (legacy callers unchanged).
    expect(handles.every(feature => !('seg_id' in (feature.properties ?? {})))).toBe(true)
  })

  it('tags segment handle features with the owning segment id for editor hit-testing', () => {
    const resolved = lineRoute([
      [-90, 41],
      [-90.0001, 41],
      [-90.0002, 41],
    ])

    const handles = trailSegmentEndpointFeatures(resolved, '#3A7CA5', 'seg-a')

    expect(handles.map(feature => feature.properties)).toEqual([
      { color: '#3A7CA5', seg_id: 'seg-a' },
      { color: '#3A7CA5', seg_id: 'seg-a' },
    ])
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

describe('trail segment write-path helpers', () => {
  const segments: TrailSegment[] = [
    { id: 'a', name: 'North Loop', color: '#2D6A4F', visible: true, section_start: 0, section_end: 40 },
    { id: 'b', name: 'South Loop', color: '#3A7CA5', visible: true, section_start: 40, section_end: 100 },
  ]

  it('patches only the target segment and returns a new array', () => {
    const next = patchTrailSegment(segments, 'a', { name: 'Renamed', dash: true })

    expect(next).not.toBe(segments)
    expect(next[0]).toEqual({ ...segments[0], name: 'Renamed', dash: true })
    expect(next[1]).toBe(segments[1])
    expect(segments[0].name).toBe('North Loop')
  })

  it('removes only the target segment', () => {
    const next = removeTrailSegment(segments, 'a')

    expect(next).toEqual([segments[1]])
    expect(segments).toHaveLength(2)
  })
})

describe('splitTrailSegmentAt', () => {
  function sequentialIds() {
    let n = 0
    return () => `child-${++n}`
  }

  // 11 evenly spaced coords along a parallel: index i sits at i/10 → i*10%.
  const primary = lineRoute(Array.from({ length: 11 }, (_, i) => [-89 + i * 0.0001, 40]))

  const routeSlice: TrailSegment = {
    id: 'orig',
    name: 'Black Loop',
    color: '#C1121F',
    visible: true,
    section_start: 0,
    section_end: 100,
    width: 4,
    opacity: 0.8,
    smooth: 2,
    dash: true,
    color_mode: 'solid',
    label_lnglat: [-89.5, 40.5],
  }

  it('splits a percentage route-slice segment at the nearest route position', () => {
    const result = splitTrailSegmentAt(routeSlice, primary, [-89 + 5 * 0.0001, 40.00001], { idFactory: sequentialIds() })

    expect(result).not.toBeNull()
    const [first, second] = result!
    expect(first).toMatchObject({
      id: 'child-1',
      name: 'Black Loop 1',
      section_start: 0,
      section_end: 50,
      color: '#C1121F',
      width: 4,
      opacity: 0.8,
      smooth: 2,
      dash: true,
      color_mode: 'solid',
      visible: true,
    })
    expect(second).toMatchObject({
      id: 'child-2',
      name: 'Black Loop 2',
      section_start: 50,
      section_end: 100,
      color: '#C1121F',
      dash: true,
    })
    // User-dragged label positions never carry over — labels re-place automatically.
    expect('label_lnglat' in first).toBe(false)
    expect('label_lnglat' in second).toBe(false)
    // Original untouched (pure function).
    expect(routeSlice.section_end).toBe(100)
  })

  it('clamps the split inside the segment section and rejects degenerate children', () => {
    const windowed: TrailSegment = { ...routeSlice, section_start: 20, section_end: 80 }

    // Click near the route start: nearest in-window position is the section start → degenerate.
    expect(splitTrailSegmentAt(windowed, primary, [-89, 40], { idFactory: sequentialIds() })).toBeNull()

    const result = splitTrailSegmentAt(windowed, primary, [-89 + 5 * 0.0001, 40], { idFactory: sequentialIds() })
    expect(result![0]).toMatchObject({ section_start: 20, section_end: 50 })
    expect(result![1]).toMatchObject({ section_start: 50, section_end: 80 })
  })

  it('falls back to a generic name for unnamed segments', () => {
    const unnamed: TrailSegment = { ...routeSlice, name: '   ' }
    const result = splitTrailSegmentAt(unnamed, primary, [-89 + 5 * 0.0001, 40], { idFactory: sequentialIds() })
    expect(result!.map(s => s.name)).toEqual(['Trail 1', 'Trail 2'])
  })

  it('splits a single-line geometry-backed segment into two self-contained tracks', () => {
    const coords = Array.from({ length: 10 }, (_, i) => [-90 + i * 0.0001, 41])
    const bends = Array(9).fill(0)
    bends[2] = 0.5
    bends[7] = -0.5
    const drawn: TrailSegment = {
      id: 'drawn',
      name: 'Ridge',
      color: '#E87722',
      visible: true,
      source: 'drawn-track',
      geojson: lineRoute(coords),
      section_start: 0,
      section_end: 100,
      width: 3,
      dash: false,
      bends,
      label_lnglat: [-90.5, 41.5],
    }

    const result = splitTrailSegmentAt(drawn, primary, [-90 + 5 * 0.0001, 41.00001], { idFactory: sequentialIds() })

    expect(result).not.toBeNull()
    const [first, second] = result!
    expect(first.name).toBe('Ridge 1')
    expect(second.name).toBe('Ridge 2')
    expect(first.source).toBe('drawn-track')
    expect(second.source).toBe('drawn-track')
    expect(first).toMatchObject({ section_start: 0, section_end: 100 })
    expect(second).toMatchObject({ section_start: 0, section_end: 100 })

    const firstCoords = (first.geojson!.features[0].geometry as GeoJSON.LineString).coordinates
    const secondCoords = (second.geojson!.features[0].geometry as GeoJSON.LineString).coordinates
    // Children share the split coordinate so the track stays continuous.
    expect(firstCoords.at(-1)).toEqual(secondCoords[0])
    expect(firstCoords).toHaveLength(6)   // coords 0..5
    expect(secondCoords).toHaveLength(5)  // coords 5..9
    expect(first.bbox).toBeDefined()
    expect(second.bbox).toBeDefined()
    expect(first.stats?.distance_km).toBeGreaterThan(0)
    // Per-edge bends slice with the geometry.
    expect(first.bends).toHaveLength(5)
    expect(first.bends?.[2]).toBe(0.5)
    expect(second.bends).toHaveLength(4)
    expect(second.bends?.[2]).toBe(-0.5)
    expect('label_lnglat' in first).toBe(false)
  })

  it('preserves line boundaries when splitting multi-line uploaded tracks (no connector chords)', () => {
    const lineA = Array.from({ length: 4 }, (_, i) => [-90 + i * 0.0001, 41])
    const lineB = Array.from({ length: 3 }, (_, i) => [-90.5 + i * 0.0001, 41.5])
    const uploaded: TrailSegment = {
      id: 'uploaded',
      name: 'Network',
      color: '#3A7CA5',
      visible: true,
      source: 'uploaded-track',
      source_filename: 'network.gpx',
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lineA } },
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lineB } },
        ],
      },
      section_start: 0,
      section_end: 100,
    }

    // Split near flat index 2 (inside line A).
    const result = splitTrailSegmentAt(uploaded, primary, [-90 + 2 * 0.0001, 41.00001], { idFactory: sequentialIds() })

    expect(result).not.toBeNull()
    const [first, second] = result!
    // First child: the head of line A only.
    expect(first.geojson!.features).toHaveLength(1)
    expect((first.geojson!.features[0].geometry as GeoJSON.LineString).coordinates).toEqual(lineA.slice(0, 3))
    // Second child: the tail of line A plus line B as SEPARATE lines.
    expect(second.geojson!.features).toHaveLength(2)
    expect((second.geojson!.features[0].geometry as GeoJSON.LineString).coordinates).toEqual(lineA.slice(2))
    expect((second.geojson!.features[1].geometry as GeoJSON.LineString).coordinates).toEqual(lineB)
    expect(first.source_filename).toBe('network.gpx')
    expect(second.source_filename).toBe('network.gpx')
  })

  it('rejects geometry-backed splits without enough coordinates', () => {
    const tiny: TrailSegment = {
      id: 'tiny',
      name: 'Tiny',
      color: '#2D6A4F',
      visible: true,
      source: 'drawn-track',
      geojson: lineRoute([[-90, 41], [-90.0001, 41], [-90.0002, 41]]),
      section_start: 0,
      section_end: 100,
    }
    expect(splitTrailSegmentAt(tiny, primary, [-90.0001, 41], { idFactory: sequentialIds() })).toBeNull()
  })
})

describe('splitTrailSegmentInList', () => {
  it('replaces the original segment with both children at the same index', () => {
    const primary = lineRoute(Array.from({ length: 11 }, (_, i) => [-89 + i * 0.0001, 40]))
    let n = 0
    const segments: TrailSegment[] = [
      { id: 'a', name: 'Before', color: '#2D6A4F', visible: true, section_start: 0, section_end: 10 },
      { id: 'b', name: 'Target', color: '#C1121F', visible: true, section_start: 0, section_end: 100 },
      { id: 'c', name: 'After', color: '#3A7CA5', visible: true, section_start: 90, section_end: 100 },
    ]

    const result = splitTrailSegmentInList(segments, 'b', primary, [-89 + 5 * 0.0001, 40], { idFactory: () => `kid-${++n}` })

    expect(result).not.toBeNull()
    expect(result!.segments.map(s => s.id)).toEqual(['a', 'kid-1', 'kid-2', 'c'])
    expect(result!.first.name).toBe('Target 1')
    expect(result!.second.name).toBe('Target 2')
    expect(segments).toHaveLength(3)
  })

  it('returns null for unknown segments and degenerate splits', () => {
    const primary = lineRoute(Array.from({ length: 11 }, (_, i) => [-89 + i * 0.0001, 40]))
    const segments: TrailSegment[] = [
      { id: 'b', name: 'Target', color: '#C1121F', visible: true, section_start: 0, section_end: 100 },
    ]
    expect(splitTrailSegmentInList(segments, 'missing', primary, [-89, 40])).toBeNull()
    expect(splitTrailSegmentInList(segments, 'b', primary, [-89, 40])).toBeNull()
  })
})
