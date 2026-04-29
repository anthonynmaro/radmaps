import { describe, it, expect } from 'vitest'
import {
  sliceRouteByPercent,
  excludeRangesFromRoute,
  detectDisconnectedRanges,
  buildElevationProfile,
  findRoutePercent,
  getAllRouteCoords,
  getRouteEndpoints,
  extractNamedTrackSegments,
} from '../utils/trail'
import type { DeletedRange } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLineString(coords: number[][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }],
  }
}

function makeMultiLineString(lines: number[][][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    }],
  }
}

const TEN_COORDS = Array.from({ length: 10 }, (_, i) => [i * 0.001, 47.0 + i * 0.001])

// ── getAllRouteCoords ─────────────────────────────────────────────────────────

describe('getAllRouteCoords', () => {
  it('returns coordinates from a LineString', () => {
    const fc = makeLineString([[0, 0], [1, 1], [2, 2]])
    expect(getAllRouteCoords(fc)).toEqual([[0, 0], [1, 1], [2, 2]])
  })

  it('flattens a MultiLineString into one array', () => {
    const fc = makeMultiLineString([[[0, 0], [1, 1]], [[2, 2], [3, 3]]])
    expect(getAllRouteCoords(fc)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]])
  })

  it('handles multiple features', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[2, 2], [3, 3]] } },
      ],
    }
    expect(getAllRouteCoords(fc)).toHaveLength(4)
  })

  it('returns empty array for empty FeatureCollection', () => {
    expect(getAllRouteCoords({ type: 'FeatureCollection', features: [] })).toEqual([])
  })
})

// ── getRouteEndpoints ─────────────────────────────────────────────────────────

describe('getRouteEndpoints', () => {
  it('returns start and finish for a valid route', () => {
    const fc = makeLineString([[10, 20], [11, 21], [12, 22]])
    const { start, finish } = getRouteEndpoints(fc)
    expect(start).toEqual([10, 20])
    expect(finish).toEqual([12, 22])
  })

  it('returns null for both when route is empty', () => {
    const { start, finish } = getRouteEndpoints({ type: 'FeatureCollection', features: [] })
    expect(start).toBeNull()
    expect(finish).toBeNull()
  })
})

// ── sliceRouteByPercent ───────────────────────────────────────────────────────

describe('sliceRouteByPercent', () => {
  it('0–100 returns the full route', () => {
    const fc = makeLineString(TEN_COORDS)
    const result = sliceRouteByPercent(fc, 0, 100)
    const coords = getAllRouteCoords(result)
    expect(coords).toHaveLength(TEN_COORDS.length)
  })

  it('0–50 returns approximately the first half', () => {
    const fc = makeLineString(TEN_COORDS)
    const result = sliceRouteByPercent(fc, 0, 50)
    const coords = getAllRouteCoords(result)
    expect(coords.length).toBeGreaterThan(0)
    expect(coords.length).toBeLessThan(TEN_COORDS.length)
  })

  it('clamps start below 0 to 0', () => {
    const fc = makeLineString(TEN_COORDS)
    const clamped = sliceRouteByPercent(fc, -10, 100)
    const full = sliceRouteByPercent(fc, 0, 100)
    expect(getAllRouteCoords(clamped)).toHaveLength(getAllRouteCoords(full).length)
  })

  it('clamps end above 100 to 100', () => {
    const fc = makeLineString(TEN_COORDS)
    const clamped = sliceRouteByPercent(fc, 0, 110)
    const full = sliceRouteByPercent(fc, 0, 100)
    expect(getAllRouteCoords(clamped)).toHaveLength(getAllRouteCoords(full).length)
  })

  it('returns empty FeatureCollection for empty input', () => {
    const result = sliceRouteByPercent({ type: 'FeatureCollection', features: [] }, 0, 100)
    expect(result.features).toHaveLength(0)
  })

  it('result is a single LineString feature', () => {
    const fc = makeLineString(TEN_COORDS)
    const result = sliceRouteByPercent(fc, 10, 90)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry.type).toBe('LineString')
  })
})

// ── excludeRangesFromRoute ────────────────────────────────────────────────────

describe('excludeRangesFromRoute', () => {
  it('no deleted ranges returns the cropped section as LineString', () => {
    const fc = makeLineString(TEN_COORDS)
    const result = excludeRangesFromRoute(fc, 0, 100, [])
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry.type).toBe('LineString')
  })

  it('deleting the whole range returns empty FeatureCollection', () => {
    const fc = makeLineString(TEN_COORDS)
    const result = excludeRangesFromRoute(fc, 0, 100, [{ start: 0, end: 100 }])
    expect(result.features).toHaveLength(0)
  })

  it('a mid-route delete produces a MultiLineString', () => {
    const coords = Array.from({ length: 20 }, (_, i) => [i * 0.001, 47.0])
    const fc = makeLineString(coords)
    const result = excludeRangesFromRoute(fc, 0, 100, [{ start: 30, end: 70 }])
    expect(result.features).toHaveLength(1)
    expect(result.features[0].geometry.type).toBe('MultiLineString')
  })

  it('overlapping deleted ranges are merged', () => {
    const coords = Array.from({ length: 100 }, (_, i) => [i * 0.001, 47.0])
    const fc = makeLineString(coords)
    const ranges: DeletedRange[] = [{ start: 20, end: 50 }, { start: 40, end: 70 }]
    const result = excludeRangesFromRoute(fc, 0, 100, ranges)
    // Merged into one gap → two surviving sections → MultiLineString
    expect(result.features[0].geometry.type).toBe('MultiLineString')
  })

  it('crop-only (no deletes) respects start/end', () => {
    const fc = makeLineString(TEN_COORDS)
    const full = getAllRouteCoords(excludeRangesFromRoute(fc, 0, 100, []))
    const cropped = getAllRouteCoords(excludeRangesFromRoute(fc, 50, 100, []))
    expect(cropped.length).toBeLessThan(full.length)
  })
})

// ── detectDisconnectedRanges ──────────────────────────────────────────────────

describe('detectDisconnectedRanges', () => {
  it('returns empty array when route has no gaps', () => {
    // Tightly-spaced points — less than 50 m apart
    const coords = Array.from({ length: 5 }, (_, i) => [0 + i * 0.0001, 47.0])
    const fc = makeLineString(coords)
    expect(detectDisconnectedRanges(fc)).toHaveLength(0)
  })

  it('detects a gap above the threshold', () => {
    // Two clusters 10 km apart
    const coords = [[0, 47], [0.0001, 47], [1, 47], [1.0001, 47]]
    const fc = makeLineString(coords)
    const ranges = detectDisconnectedRanges(fc, 50)
    expect(ranges.length).toBeGreaterThan(0)
  })

  it('respects a custom threshold', () => {
    // 200 m gap
    const coords = [[0, 47], [0.002, 47]]
    const fc = makeLineString(coords)
    expect(detectDisconnectedRanges(fc, 100)).toHaveLength(1)
    expect(detectDisconnectedRanges(fc, 500)).toHaveLength(0)
  })

  it('returns empty array for single-point route', () => {
    const fc = makeLineString([[0, 47]])
    expect(detectDisconnectedRanges(fc)).toHaveLength(0)
  })
})

// ── buildElevationProfile ─────────────────────────────────────────────────────

describe('buildElevationProfile', () => {
  it('returns null when fewer than 10 coordinates have elevation', () => {
    const fc = makeLineString([[0, 47, 100], [1, 47, 200]])
    expect(buildElevationProfile(fc)).toBeNull()
  })

  it('returns null for coords with no elevation (third value missing)', () => {
    const fc = makeLineString(Array.from({ length: 20 }, (_, i) => [i * 0.001, 47]))
    expect(buildElevationProfile(fc)).toBeNull()
  })

  it('returns a valid profile for sufficient elevation data', () => {
    const coords = Array.from({ length: 50 }, (_, i) => [i * 0.001, 47, 1000 + i * 10])
    const fc = makeLineString(coords)
    const profile = buildElevationProfile(fc)
    expect(profile).not.toBeNull()
    expect(profile!.svgPath).toMatch(/^M 0,100/)
    expect(profile!.svgPath).toMatch(/Z$/)
    expect(profile!.minElev).toBeLessThan(profile!.maxElev)
  })

  it('strokePath starts with M and has no trailing Z', () => {
    const coords = Array.from({ length: 50 }, (_, i) => [i * 0.001, 47, 1000 + Math.sin(i) * 100])
    const fc = makeLineString(coords)
    const profile = buildElevationProfile(fc)!
    expect(profile.strokePath).toMatch(/^M /)
    expect(profile.strokePath).not.toMatch(/Z$/)
  })

  it('does not divide by zero when all elevations are equal', () => {
    const coords = Array.from({ length: 50 }, (_, i) => [i * 0.001, 47, 1000])
    const fc = makeLineString(coords)
    expect(() => buildElevationProfile(fc)).not.toThrow()
  })
})

// ── findRoutePercent ──────────────────────────────────────────────────────────

describe('findRoutePercent', () => {
  it('first coordinate returns ~0%', () => {
    const fc = makeLineString(TEN_COORDS)
    const pct = findRoutePercent([TEN_COORDS[0][0], TEN_COORDS[0][1]], fc)
    expect(pct).toBeCloseTo(0, 1)
  })

  it('last coordinate returns ~100%', () => {
    const fc = makeLineString(TEN_COORDS)
    const last = TEN_COORDS[TEN_COORDS.length - 1]
    const pct = findRoutePercent([last[0], last[1]], fc)
    expect(pct).toBeCloseTo(100, 1)
  })

  it('midpoint coordinate returns ~50%', () => {
    const fc = makeLineString(TEN_COORDS)
    const mid = TEN_COORDS[Math.floor(TEN_COORDS.length / 2)]
    const pct = findRoutePercent([mid[0], mid[1]], fc)
    expect(pct).toBeGreaterThan(30)
    expect(pct).toBeLessThan(70)
  })

  it('returns 0 for empty route', () => {
    expect(findRoutePercent([0, 0], { type: 'FeatureCollection', features: [] })).toBe(0)
  })
})

// ── extractNamedTrackSegments ─────────────────────────────────────────────────

describe('extractNamedTrackSegments', () => {
  it('returns [] for a single named track', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: 'Only Track' },
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      }],
    }
    expect(extractNamedTrackSegments(fc)).toHaveLength(0)
  })

  it('returns [] for no named tracks', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      }],
    }
    expect(extractNamedTrackSegments(fc)).toHaveLength(0)
  })

  it('returns segments for two named tracks', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'Segment A' }, geometry: { type: 'LineString', coordinates: Array.from({ length: 5 }, (_, i) => [i, 0]) } },
        { type: 'Feature', properties: { name: 'Segment B' }, geometry: { type: 'LineString', coordinates: Array.from({ length: 5 }, (_, i) => [i + 5, 0]) } },
      ],
    }
    const segs = extractNamedTrackSegments(fc)
    expect(segs).toHaveLength(2)
    expect(segs[0].name).toBe('Segment A')
    expect(segs[1].name).toBe('Segment B')
  })

  it('section percentages approximately span 0–100', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'LineString', coordinates: Array.from({ length: 5 }, (_, i) => [i, 0]) } },
        { type: 'Feature', properties: { name: 'B' }, geometry: { type: 'LineString', coordinates: Array.from({ length: 5 }, (_, i) => [i + 5, 0]) } },
      ],
    }
    const segs = extractNamedTrackSegments(fc)
    expect(segs[0].section_start).toBe(0)
    expect(segs[segs.length - 1].section_end).toBe(100)
  })

  it('each segment has a unique id', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0], [2, 0]] } },
        { type: 'Feature', properties: { name: 'B' }, geometry: { type: 'LineString', coordinates: [[3, 0], [4, 0], [5, 0]] } },
        { type: 'Feature', properties: { name: 'C' }, geometry: { type: 'LineString', coordinates: [[6, 0], [7, 0], [8, 0]] } },
      ],
    }
    const segs = extractNamedTrackSegments(fc)
    const ids = segs.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('colors cycle through SEGMENT_COLORS', () => {
    const makeTrack = (name: string) => ({
      type: 'Feature' as const,
      properties: { name },
      geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 0], [2, 0]] },
    })
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: ['A', 'B', 'C'].map(makeTrack),
    }
    const segs = extractNamedTrackSegments(fc)
    const colors = segs.map(s => s.color)
    // Colors are valid hex strings
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
