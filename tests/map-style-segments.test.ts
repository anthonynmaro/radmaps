import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import { buildMapStyle, effectiveSegmentDotRadius } from '../utils/mapStyle'

function layerById(style: object, id: string): { filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> } | undefined {
  return (style as { layers?: Array<{ id: string; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> }> }).layers?.find(layer => layer.id === id)
}

describe('trail segment styling', () => {
  it('uses small precise segment handle dots by default', () => {
    expect(effectiveSegmentDotRadius(DEFAULT_STYLE_CONFIG)).toBe(1.5)
  })

  it('caps legacy-large segment handle dots', () => {
    const config: StyleConfig = { ...DEFAULT_STYLE_CONFIG, segment_dot_size: 4 }

    expect(effectiveSegmentDotRadius(config)).toBe(2.5)
  })

  it('renders segment handle dots without stroke halos', () => {
    const style = buildMapStyle(DEFAULT_STYLE_CONFIG)

    expect(layerById(style, 'segment-handle-halo')).toBeUndefined()
    expect(layerById(style, 'segment-handle-dot')?.paint).not.toHaveProperty('circle-stroke-width')
    expect(layerById(style, 'segment-handle-dot')?.paint).not.toHaveProperty('circle-stroke-color')
  })

  it('can render a segment with the elevation gradient treatment', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      trail_segments: [{
        id: 'gradient-segment',
        name: 'Gradient',
        color: '#2D6A4F',
        visible: true,
        section_start: 0,
        section_end: 100,
        color_mode: 'gradient',
      }],
    })

    const source = (style as { sources?: Record<string, Record<string, unknown>> }).sources?.['trail-seg-gradient-segment']
    const layer = layerById(style, 'trail-seg-line-gradient-segment')

    expect(source?.lineMetrics).toBe(true)
    expect(layer?.paint).toHaveProperty('line-gradient')
    expect(layer?.paint).not.toHaveProperty('line-color')
  })
})

describe('road and label overlays', () => {
  it('omits road and place-label layers when roads are disabled', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      show_roads: false,
      show_place_labels: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'roads-major')).toBeUndefined()
    expect(layerById(style, 'roads-place-labels')).toBeUndefined()
  })

  it('can hide place labels while leaving road layers enabled', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'route-only',
      show_roads: true,
      show_place_labels: false,
    }, 'mapbox-test-token')

    expect(layerById(style, 'roads-major')).toBeDefined()
    expect(layerById(style, 'roads-place-labels')).toBeUndefined()
  })

  it('renders named generic POIs when POI labels are enabled', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'route-only',
      show_roads: true,
      show_poi_labels: true,
    }, 'mapbox-test-token')

    const layer = layerById(style, 'roads-poi-labels')

    expect(layer).toBeDefined()
    expect(layer?.filter).toEqual(['all',
      ['has', 'name'],
      ['<=', ['to-number', ['get', 'filterrank'], 5], 3],
    ])
    expect(layer?.layout).not.toHaveProperty('icon-image')
  })
})
