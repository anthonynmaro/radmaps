// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { parseGpx } from '../utils/gpx'

// ── Minimal GPX fixtures ───────────────────────────────────────────────────────

function makeGpx(opts: {
  name?: string
  coords: Array<[number, number, number?]>
}): string {
  const trkpts = opts.coords.map(([lng, lat, ele]) =>
    `<trkpt lat="${lat}" lon="${lng}">${ele !== undefined ? `<ele>${ele}</ele>` : ''}</trkpt>`,
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    ${opts.name ? `<name>${opts.name}</name>` : ''}
    <trkseg>${trkpts}</trkseg>
  </trk>
</gpx>`
}

// Two coordinates ~111 km apart along a meridian (1° latitude ≈ 111 km)
const TWO_COORD_GPX = makeGpx({ coords: [[0, 0], [0, 1]] })

// A simple loop with elevation
const LOOP_GPX = makeGpx({
  name: 'Test Loop',
  coords: [
    [11.0, 47.0, 1000],
    [11.1, 47.0, 1100],
    [11.1, 47.1, 1200],
    [11.0, 47.1, 1100],
    [11.0, 47.0, 1000],
  ],
})

// ── Bbox ──────────────────────────────────────────────────────────────────────

describe('parseGpx — bbox', () => {
  it('returns [minLng, minLat, maxLng, maxLat]', () => {
    const { bbox } = parseGpx(LOOP_GPX)
    expect(bbox).toHaveLength(4)
    const [minLng, minLat, maxLng, maxLat] = bbox
    expect(minLng).toBe(11.0)
    expect(minLat).toBe(47.0)
    expect(maxLng).toBe(11.1)
    expect(maxLat).toBe(47.1)
  })

  it('minLng < maxLng and minLat < maxLat', () => {
    const { bbox: [minLng, minLat, maxLng, maxLat] } = parseGpx(LOOP_GPX)
    expect(minLng).toBeLessThan(maxLng)
    expect(minLat).toBeLessThan(maxLat)
  })
})

// ── Distance ──────────────────────────────────────────────────────────────────

describe('parseGpx — distance', () => {
  it('computes non-zero distance for two distinct points', () => {
    const { stats } = parseGpx(TWO_COORD_GPX)
    expect(stats.distance_km).toBeGreaterThan(0)
  })

  it('distance is approximately 111 km for 1° latitude at equator', () => {
    const { stats } = parseGpx(TWO_COORD_GPX)
    expect(stats.distance_km).toBeGreaterThan(100)
    expect(stats.distance_km).toBeLessThan(120)
  })

  it('distance is rounded to two decimal places', () => {
    const { stats } = parseGpx(TWO_COORD_GPX)
    const str = stats.distance_km.toString()
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(2)
  })

  it('accumulates distance across multiple segments', () => {
    const { stats } = parseGpx(LOOP_GPX)
    expect(stats.distance_km).toBeGreaterThan(0)
  })
})

// ── Elevation stats ───────────────────────────────────────────────────────────

describe('parseGpx — elevation stats', () => {
  it('computes elevation gain for ascending track', () => {
    const { stats } = parseGpx(LOOP_GPX)
    expect(stats.elevation_gain_m).toBeGreaterThan(0)
  })

  it('computes elevation loss for descending section', () => {
    const { stats } = parseGpx(LOOP_GPX)
    expect(stats.elevation_loss_m).toBeGreaterThan(0)
  })

  it('max elevation >= min elevation', () => {
    const { stats } = parseGpx(LOOP_GPX)
    expect(stats.max_elevation_m).toBeGreaterThanOrEqual(stats.min_elevation_m)
  })

  it('elevation stats are zero when no ele tags present', () => {
    const noEle = makeGpx({ coords: [[0, 0], [1, 1]] })
    const { stats } = parseGpx(noEle)
    expect(stats.elevation_gain_m).toBe(0)
    expect(stats.elevation_loss_m).toBe(0)
    expect(stats.max_elevation_m).toBe(0)
    expect(stats.min_elevation_m).toBe(0)
  })

  it('max_elevation_m is rounded to integer', () => {
    const { stats } = parseGpx(LOOP_GPX)
    expect(Number.isInteger(stats.max_elevation_m)).toBe(true)
  })
})

// ── Track name extraction ─────────────────────────────────────────────────────

describe('parseGpx — track name', () => {
  it('extracts the track name when present', () => {
    const { trackName } = parseGpx(LOOP_GPX)
    expect(trackName).toBe('Test Loop')
  })

  it('returns undefined when no name element is present', () => {
    const noName = makeGpx({ coords: [[0, 0], [1, 1]] })
    const { trackName } = parseGpx(noName)
    expect(trackName).toBeUndefined()
  })

  it('trims whitespace from track name', () => {
    const gpx = makeGpx({ name: '  Padded Name  ', coords: [[0, 0], [1, 1]] })
    const { trackName } = parseGpx(gpx)
    expect(trackName).toBe('Padded Name')
  })
})

// ── Error cases ───────────────────────────────────────────────────────────────

describe('parseGpx — error cases', () => {
  it('throws when GPX has no track coordinates', () => {
    const empty = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg></trkseg></trk></gpx>`
    expect(() => parseGpx(empty)).toThrow('No track coordinates found')
  })
})

// ── GeoJSON output ────────────────────────────────────────────────────────────

describe('parseGpx — geojson', () => {
  it('returns a valid GeoJSON FeatureCollection', () => {
    const { geojson } = parseGpx(LOOP_GPX)
    expect(geojson.type).toBe('FeatureCollection')
    expect(Array.isArray(geojson.features)).toBe(true)
  })
})
