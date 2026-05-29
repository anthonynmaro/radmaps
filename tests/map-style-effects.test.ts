import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import {
  buildMapStyle,
  mapBackgroundColor,
  mapInkColor,
  resolveTonerPalette,
  resolveTonerRouteStyle,
  resolveTonerVariant,
  styleUsesContours,
  tonerDotNaturalFilter,
  tonerDotParkFilter,
  tonerDotPatternId,
} from '../utils/mapStyle'

function baseTileUrl(style: object): string {
  const sources = (style as { sources?: Record<string, { tiles?: string[] }> }).sources
  const tileUrl = sources?.['base-tiles']?.tiles?.[0]
  if (!tileUrl) throw new Error('Missing base-tiles source URL')
  return tileUrl
}

function sourceTileUrl(style: object, sourceId: string): string {
  const sources = (style as { sources?: Record<string, { tiles?: string[] }> }).sources
  const tileUrl = sources?.[sourceId]?.tiles?.[0]
  if (!tileUrl) throw new Error(`Missing ${sourceId} source URL`)
  return tileUrl
}

function sourceById(style: object, sourceId: string): Record<string, unknown> | undefined {
  return (style as { sources?: Record<string, Record<string, unknown>> }).sources?.[sourceId]
}

interface TestLayer {
  id: string
  type?: string
  source?: string
  'source-layer'?: string
  filter?: unknown
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

function layerById(style: object, id: string): TestLayer | undefined {
  return (style as { layers?: TestLayer[] }).layers?.find(layer => layer.id === id)
}

function layerIndex(style: object, id: string): number {
  return ((style as { layers?: TestLayer[] }).layers ?? []).findIndex(layer => layer.id === id)
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

  it('renders Native Toner natural waterways with the ink treatment', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'native-toner',
      label_text_color: '#111111',
    }, 'mapbox-test-token')

    expect(layerById(style, 'nt-waterways')?.['source-layer']).toBe('waterway')
    expect(layerById(style, 'nt-waterways')?.paint?.['line-color']).toBe('#111111')
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

  it('draws natural waterway lines below contour art terrain layers', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      water_color: '#0A2040',
      show_hillshade: true,
    }, 'mapbox-test-token')
    const waterways = layerById(style, 'contour-art-waterways')

    expect(waterways?.['source-layer']).toBe('waterway')
    expect(waterways?.filter).toEqual(['in', ['get', 'class'], ['literal', ['river', 'canal', 'stream', 'stream_intermittent']]])
    expect(JSON.stringify(waterways?.filter)).not.toContain('ditch')
    expect(JSON.stringify(waterways?.filter)).not.toContain('drain')
    expect(waterways?.paint?.['line-color']).toBe('#0A2040')
    expect(layerIndex(style, 'contour-art-water')).toBeLessThan(layerIndex(style, 'contour-art-waterways'))
    expect(layerIndex(style, 'contour-art-waterways')).toBeLessThan(layerIndex(style, 'hillshade'))
    expect(layerIndex(style, 'contour-art-waterways')).toBeLessThan(layerIndex(style, 'contours-minor'))
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

describe('RadMaps Atlas style integration', () => {
  it('resolves Toner palettes from explicit light/dark presets', () => {
    expect(resolveTonerVariant({ preset: 'radmaps-toner-light', toner_variant: 'dark', dark: true })).toBe('light')
    expect(resolveTonerVariant({ preset: 'radmaps-toner-dark', toner_variant: 'light', dark: false })).toBe('dark')
    expect(resolveTonerVariant({ toner_variant: 'auto', dark: true })).toBe('dark')
    expect(resolveTonerVariant({ toner_variant: 'auto', dark: false })).toBe('light')
    expect(resolveTonerVariant({ toner_variant: 'dark', dark: false })).toBe('dark')
    expect(resolveTonerVariant({ toner_variant: 'light', dark: true })).toBe('light')

    const dark = resolveTonerPalette({ preset: 'radmaps-toner-dark' })
    const light = resolveTonerPalette({ preset: 'radmaps-toner-light' })

    expect(dark.background).toBe('#000000')
    expect(dark.roadMajor).toBe('#FFFFFF')
    expect(dark.roadMinor).toBe('#5F6B75')
    expect(light.background).toBe('#FFFFFF')
    expect(light.roadMajor).toBe('#000000')
    expect(light.roadMinor).toBe('#3F3F3F')
    expect(mapBackgroundColor({ ...DEFAULT_STYLE_CONFIG, preset: 'radmaps-toner-dark' })).toBe('#000000')
    expect(mapInkColor({ ...DEFAULT_STYLE_CONFIG, preset: 'radmaps-toner-light' })).toBe('#000000')
    expect(resolveTonerRouteStyle({ ...DEFAULT_STYLE_CONFIG, preset: 'radmaps-toner-dark', route_color: '#111111' })).toMatchObject({
      route_color: '#FF4A3D',
      route_width: DEFAULT_STYLE_CONFIG.route_width,
      route_opacity: 0.96,
    })
    expect(resolveTonerRouteStyle({ ...DEFAULT_STYLE_CONFIG, preset: 'radmaps-toner-dark', route_width: 1.5 })).toMatchObject({
      route_width: 1.5,
    })
  })

  it('routes owned Atlas provider-replacement presets through RadMaps Atlas tiles', () => {
    const ownedProviderReplacementPresets = [
      'radmaps-minimalist',
      'radmaps-topographic',
      'radmaps-natural',
      'radmaps-toner-light',
      'radmaps-toner-dark',
      'radmaps-contour-wash',
      'radmaps-watercolor-pigment-wash',
      'radmaps-watercolor-brush-ink',
      'radmaps-alidade',
      'radmaps-alidade-dark',
    ] as const

    for (const preset of ownedProviderReplacementPresets) {
      const style = buildMapStyle({
        ...DEFAULT_STYLE_CONFIG,
        preset,
      }, 'mapbox-test-token')

      expect(sourceTileUrl(style, 'radmaps-atlas-base')).toBe('/api/atlas/tiles/base/{z}/{x}/{y}.mvt?environment=production')
    }
  })

  it('renders the dark first-party Toner style without Stadia tiles', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-dark',
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: true,
    }, 'mapbox-test-token')

    expect(sourceTileUrl(style, 'radmaps-atlas-base')).toBe('/api/atlas/tiles/base/{z}/{x}/{y}.mvt?environment=production')
    expect(JSON.stringify(style)).not.toContain('tiles.stadiamaps.com')
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#000000')
    expect(layerById(style, 'radmaps-toner-dark-water')?.paint?.['fill-color']).toBe('#8595A2')
    expect(layerById(style, 'radmaps-toner-dark-water')?.paint?.['fill-opacity']).toBe(0.44)
    expect(layerById(style, 'radmaps-toner-dark-water')?.paint?.['fill-antialias']).toBe(false)
    expect(layerById(style, 'radmaps-toner-dark-roads-major')?.paint?.['line-color']).toBe('#FFFFFF')
    expect(layerById(style, 'radmaps-toner-dark-roads-major')?.paint?.['line-opacity']).toBe(1)
    expect(layerById(style, 'radmaps-toner-dark-roads-minor')?.paint?.['line-color']).toBe('#5F6B75')
    expect(layerById(style, 'radmaps-toner-dark-roads-minor')?.paint?.['line-width']).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0.38, 13, 1.35, 16, 2.65])
    expect(layerById(style, 'radmaps-toner-dark-place-labels')?.paint?.['text-color']).toBe('#FFFFFF')
    expect(layerById(style, 'radmaps-toner-dark-place-labels')?.paint?.['text-halo-color']).toBe('#000000')
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#FF4A3D')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(DEFAULT_STYLE_CONFIG.route_width)
    expect(layerById(style, 'route-line-casing')?.paint?.['line-color']).toBe('#000000')
  })

  it('renders the light first-party Toner style with black linework', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-light',
      show_roads: true,
      show_place_labels: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#FFFFFF')
    expect(layerById(style, 'radmaps-toner-light-water')?.paint?.['fill-color']).toBe('#B7B7B7')
    expect(layerById(style, 'radmaps-toner-light-water')?.paint?.['fill-opacity']).toBe(0.34)
    expect(layerById(style, 'radmaps-toner-light-water')?.paint?.['fill-antialias']).toBe(false)
    expect(layerById(style, 'radmaps-toner-light-roads-major')?.paint?.['line-color']).toBe('#000000')
    expect(layerById(style, 'radmaps-toner-light-roads-minor')?.paint?.['line-color']).toBe('#3F3F3F')
    expect(layerById(style, 'radmaps-toner-light-place-labels')?.paint?.['text-color']).toBe('#000000')
    expect(layerById(style, 'radmaps-toner-light-place-labels')?.paint?.['text-halo-color']).toBe('#FFFFFF')
  })

  it('adds Toner polygon dot patterns only for selected Atlas area features', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-dark',
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-toner-dark-landcover-dots')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-dark-building-dots')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-dark-toner-texture')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-dark-natural-dots')?.filter).toEqual(tonerDotNaturalFilter())
    expect(layerById(style, 'radmaps-toner-dark-natural-dots')?.paint?.['fill-pattern']).toBe(tonerDotPatternId('dark', 'soft'))
    expect(layerById(style, 'radmaps-toner-dark-natural-dots')?.paint?.['fill-opacity']).toBe(0.22)
    expect(layerById(style, 'radmaps-toner-dark-park-dots')?.filter).toEqual(tonerDotParkFilter())
    expect(layerById(style, 'radmaps-toner-dark-park-dots')?.paint?.['fill-pattern']).toBe(tonerDotPatternId('dark', 'soft'))
    expect(layerById(style, 'radmaps-toner-dark-park-dots')?.paint?.['fill-opacity']).toBe(0.24)
  })

  it('preserves the pale blue contour-wash look as a non-watercolor owned Atlas preset', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-contour-wash',
      show_contours: true,
      show_roads: false,
      show_place_labels: false,
      contour_detail: 5,
      route_color: '#9A5E57',
    }, 'mapbox-test-token')

    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#d7e8f7')
    expect(layerById(style, 'radmaps-contour-wash-landcover')?.paint?.['fill-color']).toBe('#d7e8f7')
    expect(layerById(style, 'radmaps-contour-wash-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-contour-wash-place-labels')).toBeUndefined()
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#9A5E57')
    expect(layerById(style, 'route-line-wash')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#75a8d2')
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#4c7fa9')
  })

  it('uses the local approved-artifact tile API for owned atlas presets', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      show_contours: true,
    }, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(sourceTileUrl(style, 'radmaps-atlas-base')).toBe('/api/atlas/tiles/base/{z}/{x}/{y}.mvt?environment=production')
    expect(sourceTileUrl(style, 'contours')).toBe('contour://dem/{z}/{x}/{y}')
    expect((style as { glyphs?: string }).glyphs).toBe('https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf')
  })

  it('renders visible Atlas Watercolor as one high-resolution art raster below crisp vectors', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-watercolor',
      watercolor_seed: 'studio-proof',
      show_contours: true,
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: true,
    }, 'mapbox-test-token')

    expect(sourceTileUrl(style, 'radmaps-atlas-base')).toBe('/api/atlas/tiles/base/{z}/{x}/{y}.mvt?environment=production')
    expect(sourceTileUrl(style, 'radmaps-watercolor-base')).toBe('/api/watercolor/tiles/base/{z}/{x}/{y}.png?scale=2&recipe=watercolor&seed=studio-proof&renderer=watercolor-art-compositor-v5&texturePack=watercolor-asset-pack-v2-dev&layers=water%2Cpark%2Cwaterway%2Cbuilding%2Ctransportation&environment=production&water=%23B8D8E8&park=%23EDE8DF&waterway=%23B8D8E8')
    expect(sourceById(style, 'radmaps-watercolor-base')).toMatchObject({
      type: 'raster',
      tileSize: 512,
      maxzoom: 18,
    })
    expect(layerById(style, 'radmaps-watercolor-base')).toMatchObject({
      type: 'raster',
      source: 'radmaps-watercolor-base',
    })
    expect(layerById(style, 'radmaps-watercolor-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-park')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-roads-major')).toBeUndefined()
    expect(layerById(style, 'contours-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-place-labels')).toBeDefined()
    expect(layerById(style, 'route-line')).toBeDefined()
    expect(layerIndex(style, 'radmaps-watercolor-base')).toBeLessThan(layerIndex(style, 'route-line'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'radmaps-watercolor-place-labels'))
  })

  it('keeps dark Atlas base layers readable when poster chrome colors are near black', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-alidade-dark',
      background_color: '#0E0E10',
      land_color: '#161618',
      water_color: '#101820',
      label_text_color: '#F4F2EE',
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-alidade-dark-landcover')?.paint?.['fill-color']).toBe('#102a1d')
    expect(layerById(style, 'radmaps-alidade-dark-water')?.paint?.['fill-color']).toBe('#3f9fbd')
    expect(layerById(style, 'radmaps-alidade-dark-park')?.paint?.['fill-color']).toBe('#193f25')
    expect(layerById(style, 'radmaps-alidade-dark-roads-major')?.paint?.['line-color']).toBe('#f18f45')
  })

  it('keeps routes below Toner labels so labels remain readable', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-dark',
    }, 'mapbox-test-token')

    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'radmaps-toner-dark-place-labels'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'radmaps-toner-dark-poi-labels'))
  })

  it('reserves route collision space and lets Atlas point labels move around the route', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-night-relief',
    }, 'mapbox-test-token')
    const routeCollisionLayer = layerById(style, 'route-label-collision')
    const placeLabelLayer = layerById(style, 'radmaps-night-relief-place-labels')
    const poiLabelLayer = layerById(style, 'radmaps-night-relief-poi-labels')

    expect(routeCollisionLayer?.source).toBe('route')
    expect(routeCollisionLayer?.layout?.['symbol-placement']).toBe('line')
    expect(routeCollisionLayer?.paint?.['text-opacity']).toBe(0)
    expect(layerIndex(style, 'route-label-collision')).toBeGreaterThan(layerIndex(style, 'route-line'))
    expect(layerIndex(style, 'route-label-collision')).toBeLessThan(layerIndex(style, 'radmaps-night-relief-place-labels'))
    expect(placeLabelLayer?.layout?.['text-variable-anchor']).toContain('top-left')
    expect(placeLabelLayer?.layout?.['text-radial-offset']).toBeGreaterThan(0)
    expect(poiLabelLayer?.layout?.['text-variable-anchor']).toContain('bottom-right')
    expect(poiLabelLayer?.layout?.['text-justify']).toBe('auto')
  })

  it('honors Atlas layer toggles by removing disabled source layers', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      show_contours: true,
      atlas_layers: {
        contour: false,
        water: false,
        transportation: false,
        poi: false,
        place: true,
      },
    }, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(layerById(style, 'contours-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-field-topo-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-field-topo-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-field-topo-poi-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-field-topo-place-labels')).toBeDefined()
  })

  it('lets Atlas major roads, minor roads, and trails be toggled independently', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      atlas_layer_settings: {
        transportation: {
          show_major: true,
          show_minor: false,
          show_trails: false,
        },
      },
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-field-topo-roads-major')).toBeDefined()
    expect(layerById(style, 'radmaps-field-topo-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-field-topo-roads-trails')).toBeUndefined()
  })

  it('treats show_roads false as transportation off for Atlas presets', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-dark',
      show_roads: false,
      atlas_layers: {
        transportation: true,
      },
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-toner-dark-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-dark-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-dark-roads-trails')).toBeUndefined()
  })

  it('does not use POI noise as Toner dot texture', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-toner-dark',
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-toner-dark-toner-texture')).toBeUndefined()
  })

  it('makes Atlas Watercolor Wash use pigment blooms without over-blurring print linework', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-watercolor-pigment-wash',
      show_roads: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-watercolor-pigment-wash-paper-wash')?.paint?.['fill-translate']).toEqual([1.4, -1.2])
    expect(layerById(style, 'radmaps-watercolor-pigment-wash-water-edge-bloom')?.paint?.['line-blur']).toBe(2.2)
    expect(layerById(style, 'radmaps-watercolor-pigment-wash-waterway-bloom')?.paint?.['line-blur']).toBe(2.1)
    expect(layerById(style, 'radmaps-watercolor-pigment-wash-roads-major-wash')?.paint?.['line-blur']).toBe(1.5)
    expect(layerById(style, 'radmaps-watercolor-pigment-wash-roads-major')?.paint?.['line-blur']).toBe(0.18)
  })

  it('keeps Atlas Watercolor Brush more inked than the softer Wash variant', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-watercolor-brush-ink',
      show_roads: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-watercolor-brush-ink-water-edge-bloom')?.paint?.['line-blur']).toBe(1.4)
    expect(layerById(style, 'radmaps-watercolor-brush-ink-roads-major-wash')?.paint?.['line-blur']).toBe(0.8)
    expect(layerById(style, 'radmaps-watercolor-brush-ink-roads-major')?.paint?.['line-blur']).toBe(0.05)
    expect(layerById(style, 'radmaps-watercolor-brush-ink-roads-trails')?.paint?.['line-dasharray']).toEqual([1.7, 1.1])
  })

  it('adds a drier Atlas Watercolor Paper option with sharper paper-grain linework', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-watercolor-paper',
      show_roads: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-watercolor-paper-paper-wash')?.paint?.['fill-translate']).toEqual([2.2, -1.8])
    expect(layerById(style, 'radmaps-watercolor-paper-pigment-granulation')?.paint?.['circle-blur']).toBe(0.45)
    expect(layerById(style, 'radmaps-watercolor-paper-water-edge-bloom')?.paint?.['line-blur']).toBe(1.8)
    expect(layerById(style, 'radmaps-watercolor-paper-roads-major')?.paint?.['line-blur']).toBe(0.08)
  })

  it('keeps trail classes out of the Atlas minor-road layer', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-field-topo-roads-minor')?.filter).toEqual([
      'in',
      ['get', 'class'],
      ['literal', ['minor', 'service', 'street', 'residential', 'tertiary', 'unclassified']],
    ])
    expect(layerById(style, 'radmaps-field-topo-roads-trails')?.filter).toEqual([
      'in',
      ['get', 'class'],
      ['literal', ['path', 'track', 'trail', 'footway', 'cycleway', 'bridleway', 'pedestrian']],
    ])
  })

  it('applies Atlas layer style settings to vector paint properties', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      atlas_layer_settings: {
        water: { fill_color: '#2BA9E0', fill_opacity: 0.42 },
        transportation: { major_color: '#FF4F1F', opacity: 0.5, major_width: 3.25 },
        place: { label_color: '#211A16', label_opacity: 0.33 },
      },
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-field-topo-water')?.paint?.['fill-color']).toBe('#2BA9E0')
    expect(layerById(style, 'radmaps-field-topo-water')?.paint?.['fill-opacity']).toBe(0.42)
    expect(layerById(style, 'radmaps-field-topo-roads-major')?.paint?.['line-color']).toBe('#FF4F1F')
    expect(layerById(style, 'radmaps-field-topo-roads-major')?.paint?.['line-opacity']).toBe(0.5)
    expect(layerById(style, 'radmaps-field-topo-roads-major')?.paint?.['line-width']).toEqual(['interpolate', ['linear'], ['zoom'], 6, 0.55, 12, 3.25, 16, 3.25])
    expect(layerById(style, 'radmaps-field-topo-place-labels')?.paint?.['text-color']).toBe('#211A16')
    expect(layerById(style, 'radmaps-field-topo-place-labels')?.paint?.['text-opacity']).toBe(0.33)
  })

  it('lets Quick theme palette colors drive Atlas map layers when no layer override is set', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-topographic',
      land_color: '#F2EAD2',
      water_color: '#3F6FB8',
      label_text_color: '#1A1F45',
      roads_color: '#E84A2A',
      show_roads: true,
      show_place_labels: true,
    }, 'mapbox-test-token')

    expect(layerById(style, 'radmaps-topographic-landcover')?.paint?.['fill-color']).toBe('#F2EAD2')
    expect(layerById(style, 'radmaps-topographic-park')?.paint?.['fill-color']).toBe('#F2EAD2')
    expect(layerById(style, 'radmaps-topographic-water')?.paint?.['fill-color']).toBe('#3F6FB8')
    expect(layerById(style, 'radmaps-topographic-waterway')?.paint?.['line-color']).toBe('#3F6FB8')
    expect(layerById(style, 'radmaps-topographic-roads-major')?.paint?.['line-color']).toBe('#E84A2A')
    expect(layerById(style, 'radmaps-topographic-place-labels')?.paint?.['text-color']).toBe('#1A1F45')
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

  it('renders natural waterways in Road Net maps even when road lines are hidden', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'road-network',
      show_roads: false,
      water_color: '#60B8FF',
    }, 'mapbox-test-token')

    expect(layerById(style, 'rn-waterways')?.['source-layer']).toBe('waterway')
    expect(layerById(style, 'rn-waterways')?.paint?.['line-color']).toBe('#60B8FF')
    expect(layerById(style, 'rn-street')).toBeUndefined()
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
