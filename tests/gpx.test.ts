import { describe, expect, it } from 'vitest'

import { parseGpxServer } from '../utils/gpx'
import { validateRouteGeojson } from '../server/utils/routeValidation'

const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="radmaps-test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Morning Ridge</name>
    <trkseg>
      <trkpt lat="39.7392" lon="-104.9903"><ele>1600</ele></trkpt>
      <trkpt lat="39.7400" lon="-104.9850"><ele>1615</ele></trkpt>
      <trkpt lat="39.7420" lon="-104.9800"><ele>1590</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpxServer', () => {
  it('parses GPX tracks into route data', () => {
    const result = parseGpxServer(validGpx)

    expect(result.trackName).toBe('Morning Ridge')
    expect(result.geojson.features.length).toBeGreaterThan(0)
    expect(result.bbox[0]).toBeLessThan(result.bbox[2])
    expect(result.bbox[1]).toBeLessThan(result.bbox[3])
    expect(result.stats.distance_km).toBeGreaterThan(0)
    expect(result.stats.elevation_gain_m).toBe(15)
    expect(result.stats.elevation_loss_m).toBe(25)
  })

  it('allows waypoint features alongside a valid track route', () => {
    const withWaypoint = validGpx.replace(
      '<trk>',
      '<wpt lat="39.7390" lon="-104.9900"><name>Trailhead</name></wpt><trk>',
    )

    const result = parseGpxServer(withWaypoint)

    expect(result.geojson.features.some(feature => feature.geometry.type === 'Point')).toBe(true)
    expect(() => validateRouteGeojson(result.geojson)).not.toThrow()
  })

  it('rejects XML entity declarations before parsing', () => {
    const unsafe = `<?xml version="1.0"?>
<!DOCTYPE gpx [
  <!ENTITY boom "boom">
]>
<gpx version="1.1"><trk><trkseg><trkpt lat="0" lon="0">&boom;</trkpt></trkseg></trk></gpx>`

    expect(() => parseGpxServer(unsafe)).toThrow(/DOCTYPE or ENTITY/)
  })

  it('rejects malformed XML', () => {
    expect(() => parseGpxServer('<gpx><trk>')).toThrow(/Malformed GPX XML/)
  })
})
