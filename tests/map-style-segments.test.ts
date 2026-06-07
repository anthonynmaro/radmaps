import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import { buildMapStyle, effectiveSegmentDotRadius, shouldRenderPrimaryRoute } from '../utils/mapStyle'
import { shouldExpectPrimaryRouteContent } from '../utils/render/routeReadiness'
import { ALL_STYLE_PRESETS } from '../utils/styleLayerGraph'

function layerById(style: object, id: string): { filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> } | undefined {
  return (style as { layers?: Array<{ id: string; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> }> }).layers?.find(layer => layer.id === id)
}

function sourceById(style: object, id: string): object | undefined {
  return (style as { sources?: Record<string, object> }).sources?.[id]
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

  it('hides the primary route by default when visible trail segments are present', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      trail_segments: [{
        id: 'segment-a',
        name: 'Segment A',
        color: '#F4B942',
        visible: true,
        section_start: 0,
        section_end: 100,
      }],
    }

    const style = buildMapStyle(config)

    expect(shouldRenderPrimaryRoute(config)).toBe(false)
    expect(sourceById(style, 'route')).toBeUndefined()
    expect(layerById(style, 'route-line')).toBeUndefined()
    expect(layerById(style, 'route-line-casing')).toBeUndefined()
    expect(layerById(style, 'trail-seg-line-segment-a')).toBeDefined()
  })

  it('can explicitly render the primary route underneath trail segments', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      show_primary_route: true,
      trail_segments: [{
        id: 'segment-a',
        name: 'Segment A',
        color: '#F4B942',
        visible: true,
        section_start: 0,
        section_end: 100,
      }],
    }

    const style = buildMapStyle(config)

    expect(shouldRenderPrimaryRoute(config)).toBe(true)
    expect(sourceById(style, 'route')).toBeDefined()
    expect(layerById(style, 'route-line')).toBeDefined()
    expect(layerById(style, 'route-line-casing')).toBeDefined()
    expect(layerById(style, 'trail-seg-line-segment-a')).toBeDefined()
  })

  it('does not require primary route content for place-only render readiness', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      show_primary_route: true,
    }
    const emptyGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    }
    const pointGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [-99.1332, 19.4326] },
      }],
    }
    const routeGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[-99.14, 19.42], [-99.12, 19.44]] },
      }],
    }

    expect(shouldRenderPrimaryRoute(config)).toBe(true)
    expect(shouldExpectPrimaryRouteContent(config, emptyGeojson)).toBe(false)
    expect(shouldExpectPrimaryRouteContent(config, pointGeojson)).toBe(false)
    expect(shouldExpectPrimaryRouteContent(config, routeGeojson)).toBe(true)
  })

  it('omits the primary route underneath visible trail segments across every preset', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      const config: StyleConfig = {
        ...DEFAULT_STYLE_CONFIG,
        preset,
        trail_segments: [{
          id: 'segment-a',
          name: 'Segment A',
          color: '#F4B942',
          visible: true,
          section_start: 0,
          section_end: 100,
        }],
      }
      const style = buildMapStyle(config, 'mapbox-test-token')

      expect(shouldRenderPrimaryRoute(config), preset).toBe(false)
      expect(sourceById(style, 'route'), preset).toBeUndefined()
      expect(layerById(style, 'route-line'), preset).toBeUndefined()
      expect(layerById(style, 'route-line-casing'), preset).toBeUndefined()
      expect(layerById(style, 'trail-seg-line-segment-a'), preset).toBeDefined()
    }
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
