import { describe, expect, it } from 'vitest'
import { computeOverlayLayout, leaderAnchorCoord, type Projector } from '../utils/render/overlayLayout'

function lineFeature(coords: number[][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      },
    ],
  }
}

const identityProject: Projector = ([lng, lat]) => ({ x: lng, y: lat })

describe('overlay layout', () => {
  it('anchors leader dots at the start of each segment', () => {
    const result = computeOverlayLayout({
      styleConfig: {
        show_start_pin: false,
        show_finish_pin: false,
        trail_label_style: 'leader-lines',
        trail_segments: [
          {
            id: 'segment-1',
            name: 'Segment 1',
            color: '#F4B942',
            visible: true,
            source: 'uploaded-track',
            geojson: lineFeature([[10, 0], [90, 0], [90, 80]]),
            section_start: 0,
            section_end: 100,
          },
        ],
      },
      geojson: lineFeature([[0, 0], [0, 90]]),
      viewport: { w: 100, h: 100 },
      project: identityProject,
      pinOffset: 10,
    })

    expect(result.leaderLines).toHaveLength(1)
    expect(result.leaderLines[0].dotX).toBe(10)
    expect(result.leaderLines[0].dotY).toBe(0)
  })

  it('balances dense auto leader labels across both side columns', () => {
    const result = computeOverlayLayout({
      styleConfig: {
        show_start_pin: false,
        show_finish_pin: false,
        trail_label_style: 'leader-lines',
        trail_segments: Array.from({ length: 5 }, (_, index) => ({
          id: `segment-${index}`,
          name: `Segment ${index}`,
          color: '#F4B942',
          visible: true,
          source: 'uploaded-track' as const,
          geojson: lineFeature([[10, 20 + index * 20], [24, 20 + index * 20]]),
          section_start: 0,
          section_end: 100,
        })),
      },
      geojson: lineFeature([[0, 0], [0, 90]]),
      viewport: { w: 120, h: 160 },
      project: identityProject,
      pinOffset: 10,
    })

    const leftCount = result.leaderLines.filter(item => item.anchor === 'end').length
    const rightCount = result.leaderLines.filter(item => item.anchor === 'start').length

    expect(result.leaderLines).toHaveLength(5)
    expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(1)
  })

  it('chooses the first valid coordinate as the leader anchor', () => {
    expect(leaderAnchorCoord([[0, 0], [10, 0], [20, 0]])).toEqual([0, 0])
    expect(leaderAnchorCoord([[Number.NaN, 0], [10, 0], [20, 0]])).toEqual([10, 0])
  })
})
