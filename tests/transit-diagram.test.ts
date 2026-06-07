import { describe, expect, it } from 'vitest'
import {
  buildTransitDiagramGeojson,
  buildTransitStationGeojson,
  normalizeRoutePoint,
  sampleRouteByDistance,
  type TransitBbox,
} from '../utils/transitDiagram'
import { getAllRouteCoords } from '../utils/trail'

const bbox: TransitBbox = [0, 0, 10, 10]

function routeFeatureCollection(coords: number[][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    }],
  }
}

describe('transit diagram route abstraction', () => {
  it('samples real route distance rather than using fabricated station geometry', () => {
    const coords = [
      [0, 0],
      [0, 1],
      [0, 2],
      [10, 2],
    ]

    const samples = sampleRouteByDistance(coords, 3)

    expect(samples).toHaveLength(3)
    expect(samples[0]).toEqual([0, 0])
    expect(samples[2]).toEqual([10, 2])
    expect(samples[1][1]).toBeGreaterThan(1.8)
    expect(samples[1][0]).toBeGreaterThan(3.5)
    expect(samples[1][0]).toBeLessThan(4.5)
  })

  it('turns uploaded GPX geometry into a 45/90 transit route within the route bounds', () => {
    const source = routeFeatureCollection([
      [0.8, 1],
      [1.1, 1.8],
      [2.4, 3.6],
      [3.2, 4.1],
      [4.7, 5.9],
      [5.5, 6.3],
      [6.1, 7.4],
      [7.3, 8.1],
      [8.4, 8.8],
      [9.2, 9.1],
      [9.4, 9.6],
      [9.6, 9.8],
      [9.8, 9.9],
    ])

    const diagram = buildTransitDiagramGeojson(source, bbox)
    const coords = getAllRouteCoords(diagram)

    expect(diagram.features[0]?.properties?.radmaps_transit_diagram).toBe(true)
    expect(coords).toHaveLength(6)
    for (const coord of coords) {
      expect(coord[0]).toBeGreaterThanOrEqual(bbox[0])
      expect(coord[0]).toBeLessThanOrEqual(bbox[2])
      expect(coord[1]).toBeGreaterThanOrEqual(bbox[1])
      expect(coord[1]).toBeLessThanOrEqual(bbox[3])
    }

    const normalized = coords.map(coord => normalizeRoutePoint(coord, bbox))
    for (let i = 1; i < normalized.length; i++) {
      const dx = normalized[i].x - normalized[i - 1].x
      const dy = normalized[i].y - normalized[i - 1].y
      const eighthTurns = Math.atan2(dy, dx) / (Math.PI / 4)
      expect(Math.abs(eighthTurns - Math.round(eighthTurns))).toBeLessThan(0.000001)
    }
  })

  it('builds ringed station metadata from the transformed route', () => {
    const diagram = routeFeatureCollection([
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [5, 3],
      [6, 4],
    ])

    const stations = buildTransitStationGeojson(diagram)

    expect(stations.features).toHaveLength(6)
    expect(stations.features[0]?.properties).toMatchObject({ label: 'START', terminal: true, secondary: false })
    expect(stations.features[1]?.properties).toMatchObject({ label: 'RIDGE', terminal: false, secondary: false })
    expect(stations.features[2]?.properties).toMatchObject({ label: 'OVERLOOK', terminal: false, secondary: true })
    expect(stations.features[5]?.properties).toMatchObject({ label: 'FINISH', terminal: true, secondary: false })
  })
})
