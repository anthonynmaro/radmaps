import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import { buildMapStyle, styleUsesContours } from '../utils/mapStyle'

function baseTileUrl(style: object): string {
  const sources = (style as { sources?: Record<string, { tiles?: string[] }> }).sources
  const tileUrl = sources?.['base-tiles']?.tiles?.[0]
  if (!tileUrl) throw new Error('Missing base-tiles source URL')
  return tileUrl
}

function layerById(style: object, id: string): { paint?: Record<string, unknown> } | undefined {
  return (style as { layers?: Array<{ id: string; paint?: Record<string, unknown> }> }).layers?.find(layer => layer.id === id)
}

describe('map tile effects', () => {
  it('wraps raster tile URLs with the invert tile processor', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-toner',
      tile_effect: 'invert',
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(baseTileUrl(style)).toBe(
      'styledtile://invert|https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png?api_key=stadia-test-token',
    )
  })

  it('applies tile effects to label-free Toner tiles', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-toner',
      show_place_labels: false,
      tile_effect: 'duotone',
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(baseTileUrl(style)).toContain(
      '|https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}@2x.png?api_key=stadia-test-token',
    )
  })

  it('ignores saved raster tile effects on native vector toner maps', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'native-toner',
      background_color: '#FFFFFF',
      label_text_color: '#111111',
      tile_effect: 'invert',
      show_roads: true,
    }

    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#FFFFFF')
    expect(layerById(style, 'nt-street')?.paint?.['line-color']).toBe('#111111')
  })

  it('uses configured road color and opacity in Native Toner maps', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'native-toner',
      show_roads: true,
      roads_color: '#60B8FF',
      roads_opacity: 0.4,
    }

    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(layerById(style, 'nt-street')?.paint?.['line-color']).toBe('#60B8FF')
    expect(layerById(style, 'nt-street')?.paint?.['line-opacity']).toBeCloseTo(0.22)
    expect(layerById(style, 'nt-motorway')?.paint?.['line-opacity']).toBeCloseTo(0.4)
  })

  it('hides Native Toner road layers when roads are disabled', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'native-toner',
      show_roads: false,
    }

    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(layerById(style, 'nt-street')).toBeUndefined()
    expect(layerById(style, 'nt-motorway')).toBeUndefined()
    expect(layerById(style, 'nt-water')).toBeDefined()
  })

  it('matches route casing to the inverted map background', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-toner',
      background_color: '#FFFFFF',
      label_text_color: '#111111',
      tile_effect: 'invert',
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#111111')
    expect(layerById(style, 'route-line-casing')?.paint?.['line-color']).toBe('#111111')
  })
})

describe('contour style requirements', () => {
  it('draws theme-colored water below contour art when vector data is available', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      water_color: '#0A2040',
    }, 'mapbox-test-token')

    expect(layerById(style, 'contour-art-water')?.paint?.['fill-color']).toBe('#0A2040')
  })

  it('applies contour-art major and minor weight controls in the browser contour path', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      contour_minor_width: 2,
      contour_major_width: 2,
    }, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.8,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 2.6, 14, 5.6,
    ])
  })

  it('treats contour art as contour-dependent even when a saved contour toggle is false', () => {
    expect(styleUsesContours({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_contours: false,
    })).toBe(true)
  })

  it('keeps non-contour presets dependent on the contour toggle', () => {
    expect(styleUsesContours({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'minimalist',
      show_contours: false,
    })).toBe(false)
  })
})

describe('road network styling', () => {
  it('uses configured road color and opacity in Road Net maps', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'road-network',
      show_roads: true,
      roads_color: '#60B8FF',
      roads_opacity: 0.7,
    }, 'mapbox-test-token')

    expect(layerById(style, 'rn-street')?.paint?.['line-color']).toBe('#60B8FF')
    expect(layerById(style, 'rn-street')?.paint?.['line-opacity']).toBeCloseTo(0.224)
    expect(layerById(style, 'rn-motorway')?.paint?.['line-opacity']).toBeCloseTo(0.525)
  })

  it('hides Road Net road layers when roads are disabled', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'road-network',
      show_roads: false,
    }, 'mapbox-test-token')

    expect(layerById(style, 'rn-street')).toBeUndefined()
    expect(layerById(style, 'rn-motorway')).toBeUndefined()
  })
})
