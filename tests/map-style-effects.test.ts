import { afterAll, describe, expect, it } from 'vitest'
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
import { applyThemeToStyleConfig } from '../utils/themeApplication'
import { getThemeDefinition } from '../utils/themes/refined'
import { THEME_CHROME_CONTRACTS } from '../utils/themes/chromeContract'
import { THEME_SCREENSHOT_MANIFEST } from '../utils/themes/screenshotManifest'

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

const semanticMapTokenCoverage = new Set<string>()

function coverSemanticMapTokens(...themeIds: string[]) {
  for (const themeId of themeIds) {
    semanticMapTokenCoverage.add(themeId)
  }
}

afterAll(() => {
  expect([...semanticMapTokenCoverage].sort()).toEqual(
    THEME_SCREENSHOT_MANIFEST.map(entry => entry.themeId).sort(),
  )
})

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

    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

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
  it('materializes every static theme route-layer contract in generated MapLibre style JSON', () => {
    const runtimeMapPreviewLayers = new Set([
      'transit-station-halo',
      'transit-station-dot',
      'transit-station-label',
    ])

    for (const contract of THEME_CHROME_CONTRACTS) {
      const theme = getThemeDefinition(contract.themeId)
      expect(theme, contract.themeId).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      for (const layerId of contract.requiredRouteLayers ?? []) {
        if (runtimeMapPreviewLayers.has(layerId)) continue
        expect(layerById(style, layerId), `${contract.themeId}:${layerId}`).toBeDefined()
      }

      for (const layerId of contract.forbiddenRouteLayers ?? []) {
        expect(layerById(style, layerId), `${contract.themeId}:${layerId}`).toBeUndefined()
      }
    }
  })

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

  it('softens Atlas water and waterway edges in Night Relief', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-night-relief',
      show_roads: false,
      show_place_labels: false,
      show_hillshade: true,
      show_contours: true,
    }, 'mapbox-test-token')

    const waterEdge = layerById(style, 'radmaps-night-relief-water-edge-soften')
    const water = layerById(style, 'radmaps-night-relief-water')
    const waterwaySoft = layerById(style, 'radmaps-night-relief-waterway-soften')
    const waterway = layerById(style, 'radmaps-night-relief-waterway')

    expect(waterEdge?.layout).toMatchObject({ 'line-join': 'round', 'line-cap': 'round' })
    expect(waterEdge?.paint?.['line-blur']).toBeGreaterThan(0)
    expect(waterEdge?.paint?.['line-width']).toEqual(['interpolate', ['linear'], ['zoom'], 5, 0.95, 12, 3.4, 16, 5.0])
    expect(layerIndex(style, 'radmaps-night-relief-water-edge-soften')).toBeLessThan(layerIndex(style, 'radmaps-night-relief-water'))
    expect(water?.paint?.['fill-antialias']).toBe(true)

    expect(waterwaySoft?.layout).toMatchObject({ 'line-join': 'round', 'line-cap': 'round' })
    expect(waterwaySoft?.paint?.['line-blur']).toBeGreaterThan(0)
    expect(waterway?.layout).toMatchObject({ 'line-join': 'round', 'line-cap': 'round' })
    expect(waterway?.paint?.['line-blur']).toBeGreaterThan(0)
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

  it('lets explicit contour controls override Atlas contour defaults', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-night-relief',
      show_contours: true,
      contour_color: '#AABBCC',
      contour_major_color: '#DDEEFF',
      contour_opacity: 0.82,
      contour_minor_width: 2,
      contour_major_width: 1.75,
      atlas_layer_settings: {
        contour: {
          minor_color: '#111111',
          major_color: '#222222',
          minor_opacity: 0.18,
          minor_width: 0.25,
          major_width: 0.25,
        },
      },
    }, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#AABBCC')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.82, 14, 0.82 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.6, 14, 2,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#DDEEFF')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.82)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 2.625, 14, 4.375,
    ])
  })

  it('keeps Atlas contour settings as defaults until a top-level control is explicit', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      show_contours: true,
      atlas_layer_settings: {
        contour: {
          minor_color: '#445566',
          major_color: '#778899',
          minor_opacity: 0.28,
          minor_width: 0.4,
          major_width: 0.7,
        },
      },
    }, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#445566')
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#778899')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.28, 14, 0.28 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.32000000000000006, 14, 0.4,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.0499999999999998, 14, 1.75,
    ])
  })

  it('renders Dark Sky with explicit dark/gold Atlas colors and no hillshade', () => {
    const theme = getThemeDefinition('dark-sky')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig({
      ...DEFAULT_STYLE_CONFIG,
      show_hillshade: true,
    }, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(sourceById(style, 'mapbox-dem')).toBeUndefined()
    expect(layerById(style, 'hillshade')).toBeUndefined()
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#101A38')
    expect(layerById(style, 'radmaps-night-relief-landcover')?.paint?.['fill-color']).toBe('#101A38')
    expect(layerById(style, 'radmaps-night-relief-landcover')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-night-relief-park')?.paint?.['fill-color']).toBe('#101A38')
    expect(layerById(style, 'radmaps-night-relief-park')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-night-relief-water')?.paint?.['fill-color']).toBe('#071024')
    expect(layerById(style, 'radmaps-night-relief-water')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-night-relief-waterway')?.paint?.['line-color']).toBe('#18294C')
    expect(layerById(style, 'radmaps-night-relief-waterway')?.paint?.['line-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-night-relief-place-labels')).toBeUndefined()
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

  it('renders Plein Air route as restrained watercolor linework from the GPX route source', () => {
    const theme = getThemeDefinition('plein-air')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(layerById(style, 'route-line-wash')?.source).toBe('route')
    expect(layerById(style, 'route-line-pigment-bleed')).toBeUndefined()
    expect(layerById(style, 'route-line-pigment-offset')).toBeUndefined()
    expect(layerById(style, 'route-line-plein-air-drybrush')?.source).toBe('route')
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-color']).toBe('#7D3E28')
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-width']).toBe(3.05)
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-opacity']).toBeCloseTo(0.306, 6)
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-blur']).toBe(0.22)
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-dasharray']).toEqual([1.2, 0.55])
    expect(layerById(style, 'route-line-plein-air-drybrush')?.paint?.['line-translate']).toEqual([-0.55, -0.35])
    expect(layerById(style, 'route-line')?.source).toBe('route')
    expect(layerIndex(style, 'route-line-wash')).toBeLessThan(layerIndex(style, 'route-line'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-plein-air-drybrush'))
  })

  it('applies Plein Air map tokens as the watercolor art-wash contract', () => {
    coverSemanticMapTokens('plein-air')
    const theme = getThemeDefinition('plein-air')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-watercolor-paper')
    expect(config.composition).toBe('art-wash')
    expect(config.font_family).toBe('Cormorant Garamond')
    expect(config.body_font_family).toBe('Source Sans 3')
    expect(config.tile_grain).toBe(0.18)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#C2683F')
    expect(config.route_width).toBe(3.6)
    expect(config.route_opacity).toBe(0.9)
    expect(config.contour_detail).toBe(5)
    expect(config.contour_opacity).toBe(0.36)
    expect(config.contour_color).toBe('#C0B59A')
    expect(config.contour_major_color).toBe('#8A7D63')
    expect(config.water_color).toBe('#A9C2B4')
    expect(config.land_color).toBe('#F3EDE1')
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#E6D7BB')
    expect(layerById(style, 'radmaps-watercolor-paper-landcover')?.paint?.['fill-color']).toBe('#E6D7BB')
    expect(layerById(style, 'radmaps-watercolor-paper-landcover')?.paint?.['fill-opacity']).toBe(0.88)
    expect(layerById(style, 'radmaps-watercolor-paper-park')?.paint?.['fill-color']).toBe('#A9C2B4')
    expect(layerById(style, 'radmaps-watercolor-paper-water')?.paint?.['fill-color']).toBe('#A9C2B4')
    expect(layerById(style, 'radmaps-watercolor-paper-water')?.paint?.['fill-opacity']).toBe(0.26)
    expect(layerById(style, 'radmaps-watercolor-paper-waterway')?.paint?.['line-color']).toBe('#A9C2B4')
    expect(layerById(style, 'radmaps-watercolor-paper-waterway')?.paint?.['line-opacity']).toBe(0.32)
    expect(layerById(style, 'radmaps-watercolor-paper-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-paper-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-paper-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-watercolor-paper-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#C0B59A')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.36, 14, 0.36 * 0.9,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#8A7D63')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.44)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#C2683F')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.6)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.86)
  })

  it('renders Moonstone routes as GPX-source etched survey linework', () => {
    const theme = getThemeDefinition('moonstone')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_color).toBe('#9B4D3A')
    expect(config.route_width).toBeLessThan(4)
    expect(config.route_opacity).toBe(0.94)
    expect(layerById(style, 'route-line-moonstone-engraved-channel')?.source).toBe('route')
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.source).toBe('route')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.source).toBe('route')
    expect(layerById(style, 'route-line-moonstone-engraved-channel')?.paint?.['line-color']).toBe('#EEF0ED')
    expect(layerById(style, 'route-line-moonstone-engraved-channel')?.paint?.['line-width']).toBe(6.949999999999999)
    expect(layerById(style, 'route-line-moonstone-engraved-channel')?.paint?.['line-opacity']).toBeCloseTo(0.8648)
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.paint?.['line-color']).toBe('#687972')
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.paint?.['line-width']).toBe(2.6999999999999997)
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.paint?.['line-opacity']).toBeCloseTo(0.3196)
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.paint?.['line-translate']).toEqual([1.4, -1.2])
    expect(layerById(style, 'route-line-moonstone-blueprint-offset')?.paint?.['line-dasharray']).toEqual([1.4, 0.5])
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.layout?.['symbol-spacing']).toBe(72)
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.layout?.['text-field']).toBe('╋')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.layout?.['text-size']).toBe(10)
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.paint?.['text-color']).toBe('#687972')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.paint?.['text-opacity']).toBeCloseTo(0.4512)
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.paint?.['text-halo-color']).toBe('#EEF0ED')
    expect(layerById(style, 'route-line-moonstone-survey-ticks')?.paint?.['text-halo-width']).toBe(1.2)
    expect(layerById(style, 'route-line-blueprint-station-crosses')).toBeUndefined()
    expect(layerIndex(style, 'route-line-moonstone-engraved-channel')).toBeLessThan(layerIndex(style, 'route-line-moonstone-blueprint-offset'))
    expect(layerIndex(style, 'route-line-moonstone-blueprint-offset')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-moonstone-survey-ticks'))
  })

  it('applies Moonstone map tokens as the Blueprint light colorway contract', () => {
    coverSemanticMapTokens('moonstone')
    const theme = getThemeDefinition('moonstone')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-alidade')
    expect(config.composition).toBe('blueprint-grid')
    expect(config.font_family).toBe('Space Grotesk')
    expect(config.body_font_family).toBe('IBM Plex Sans')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(true)
    expect(config.grid_scope).toBe('map')
    expect(config.grid_opacity).toBe(0.075)
    expect(config.route_color).toBe('#9B4D3A')
    expect(config.route_width).toBe(3.55)
    expect(config.route_opacity).toBe(0.94)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#EEF0ED')
    expect(layerById(style, 'radmaps-alidade-landcover')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#B6BFB9')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.26, 14, 0.26 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.56 * 0.8, 14, 0.56,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#687972')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.46)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#9B4D3A')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.55)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.94)
  })

  it('renders Blueprint routes as GPX-source drafting survey linework', () => {
    const theme = getThemeDefinition('blueprint')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(3)
    expect(layerById(style, 'route-line-blueprint-construction-glow')?.source).toBe('route')
    expect(layerById(style, 'route-line-blueprint-drafting-offset')?.source).toBe('route')
    expect(layerById(style, 'route-line-blueprint-station-crosses')?.source).toBe('route')
    expect(layerById(style, 'route-line-blueprint-drafting-offset')?.paint?.['line-dasharray']).toEqual([1.65, 0.55])
    expect(layerById(style, 'route-line-blueprint-station-crosses')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-blueprint-station-crosses')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-blueprint-station-crosses')?.layout?.['text-field']).toBe('+')
    expect(layerIndex(style, 'route-line-blueprint-construction-glow')).toBeLessThan(layerIndex(style, 'route-line-blueprint-drafting-offset'))
    expect(layerIndex(style, 'route-line-blueprint-drafting-offset')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-blueprint-station-crosses'))
  })

  it('applies Blueprint map tokens as the cyanotype drafting contract', () => {
    coverSemanticMapTokens('blueprint')
    const theme = getThemeDefinition('blueprint')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-alidade-dark')
    expect(config.composition).toBe('blueprint-grid')
    expect(config.font_family).toBe('Space Grotesk')
    expect(config.body_font_family).toBe('IBM Plex Sans')
    expect(config.tile_grain).toBe(0.04)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(true)
    expect(config.grid_scope).toBe('poster')
    expect(config.grid_opacity).toBe(0.2)
    expect(config.grid_weight).toBe(1)
    expect(config.grid_spacing).toBe(5)
    expect(config.route_color).toBe('#FFD45A')
    expect(config.route_width).toBe(6.4)
    expect(config.route_opacity).toBe(1)
    expect(config.route_smooth).toBe(2)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.atlas_layers).toEqual({
      contour: true,
      landcover: false,
      water: false,
      waterway: false,
      park: false,
      transportation: false,
      building: false,
      place: false,
      poi: false,
    })
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#123F66')
    expect(layerById(style, 'radmaps-alidade-dark-landcover')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-park')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-dark-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-ghost-texture')?.paint?.['line-color']).toBe('#9CCDEB')
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#9CCDEB')
    expect(config.contour_detail).toBe(1)
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.18, 14, 0.18 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.46 * 0.8, 14, 0.46,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#E6F4FF')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.58)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.96 * 1.5, 14, 0.96 * 2.5,
    ])
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#FFD45A')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(6.4)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(1)
  })

  it('renders Classic Trail routes as a clean GPX-source slate colorway', () => {
    const theme = getThemeDefinition('classic-trail')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(3)
    expect(config.route_color).toBe('#2F536A')
    expect(config.route_opacity).toBe(0.94)
    expect(layerById(style, 'route-line-classic-trail-paper-channel')?.source).toBe('route')
    expect(layerById(style, 'route-line-classic-trail-slate-offset')?.source).toBe('route')
    expect(layerById(style, 'route-line-classic-trail-paper-channel')?.paint?.['line-color']).toBe('#EEEEEA')
    expect(layerById(style, 'route-line-classic-trail-paper-channel')?.paint?.['line-width']).toBe(5.65)
    expect(layerById(style, 'route-line-classic-trail-paper-channel')?.paint?.['line-opacity']).toBeCloseTo(0.7708)
    expect(layerById(style, 'route-line-classic-trail-slate-offset')?.paint?.['line-color']).toBe('#5F6E7E')
    expect(layerById(style, 'route-line-classic-trail-slate-offset')?.paint?.['line-width']).toBe(2.8)
    expect(layerById(style, 'route-line-classic-trail-slate-offset')?.paint?.['line-opacity']).toBeCloseTo(0.3196)
    expect(layerById(style, 'route-line-classic-trail-slate-offset')?.paint?.['line-translate']).toEqual([1.1, 1])
    expect(layerById(style, 'route-line-classic-trail-blaze-cuts')).toBeUndefined()
    expect(layerById(style, 'route-line-classic-trail-blazes')).toBeUndefined()
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#2F536A')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.25)
    expect(layerIndex(style, 'route-line-classic-trail-paper-channel')).toBeLessThan(layerIndex(style, 'route-line-classic-trail-slate-offset'))
    expect(layerIndex(style, 'route-line-classic-trail-slate-offset')).toBeLessThan(layerIndex(style, 'route-line-casing'))
  })

  it('applies Classic Trail map tokens as the USGS slate colorway contract', () => {
    coverSemanticMapTokens('classic-trail')
    const theme = getThemeDefinition('classic-trail')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.composition).toBe('park-quad')
    expect(config.font_family).toBe('Libre Baskerville')
    expect(config.body_font_family).toBe('Source Sans 3')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.pin_color).toBe('#2F536A')
    expect(config.pin_opacity).toBe(1)
    expect(config.route_color).toBe('#2F536A')
    expect(config.route_width).toBe(3.25)
    expect(config.route_opacity).toBe(0.94)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#EEEEEA')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#EEEEEA')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-opacity']).toBe(0.98)
    expect(layerById(style, 'radmaps-simple-contour-park')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#9FA6AD')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.34, 14, 0.34 * 0.9,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#5F6E7E')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.50)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#2F536A')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.25)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.94)
  })

  it('renders USGS Heritage routes as clean GPX-source rust linework', () => {
    const theme = getThemeDefinition('usgs-vintage')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(3)
    expect(config.route_color).toBe('#9D3825')
    expect(config.route_opacity).toBe(0.96)
    expect(layerById(style, 'route-line-usgs-paper-channel')?.source).toBe('route')
    expect(layerById(style, 'route-line-usgs-paper-channel')?.paint?.['line-color']).toBe('#F0ECDE')
    expect(layerById(style, 'route-line-usgs-paper-channel')?.paint?.['line-width']).toBe(6.05)
    expect(layerById(style, 'route-line-usgs-paper-channel')?.paint?.['line-opacity']).toBeCloseTo(0.7488)
    expect(layerById(style, 'route-line-usgs-red-pencil-offset')).toBeUndefined()
    expect(layerById(style, 'route-line-usgs-survey-hachures')).toBeUndefined()
    expect(layerById(style, 'route-line-usgs-survey-stations')).toBeUndefined()
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#9D3825')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.15)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
    expect(layerIndex(style, 'route-line-usgs-paper-channel')).toBeLessThan(layerIndex(style, 'route-line-casing'))
  })

  it('applies USGS Heritage map tokens as the style contract', () => {
    coverSemanticMapTokens('usgs-vintage')
    const theme = getThemeDefinition('usgs-vintage')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.composition).toBe('park-quad')
    expect(config.font_family).toBe('Libre Baskerville')
    expect(config.body_font_family).toBe('Source Sans 3')
    expect(config.tile_grain).toBe(0.46)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.pin_color).toBe('#9D3825')
    expect(config.pin_opacity).toBe(1)
    expect(config.route_color).toBe('#9D3825')
    expect(config.route_width).toBe(3.15)
    expect(config.route_opacity).toBe(0.96)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#F0ECDE')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#F0ECDE')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-opacity']).toBe(0.98)
    expect(layerById(style, 'radmaps-simple-contour-park')?.paint?.['fill-color']).toBe('#F0ECDE')
    expect(layerById(style, 'radmaps-simple-contour-park')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-simple-contour-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-ghost-texture')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#C5AA72')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.62, 14, 0.62 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.72 * 0.8, 14, 0.72,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#617349')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.70)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.92 * 1.5, 14, 0.92 * 2.5,
    ])
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#9D3825')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.15)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
  })

  it('renders Editorial Minimal routes as GPX-source gallery print linework', () => {
    const theme = getThemeDefinition('editorial-minimal')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_color).toBe('#9A3B27')
    expect(config.route_width).toBe(3.4)
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-editorial-paper-channel')?.source).toBe('route')
    expect(layerById(style, 'route-line-editorial-ink-ridge')?.source).toBe('route')
    expect(layerById(style, 'route-line-editorial-collector-cuts')?.source).toBe('route')
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.paint?.['line-color']).toBe('#6F4A37')
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.paint?.['line-width']).toBe(8.6)
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.paint?.['line-opacity']).toBeCloseTo(0.09)
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.paint?.['line-blur']).toBe(2.4)
    expect(layerById(style, 'route-line-editorial-gallery-shadow')?.paint?.['line-translate']).toEqual([1.2, 1.4])
    expect(layerById(style, 'route-line-editorial-paper-channel')?.paint?.['line-color']).toBe('#F8F3EA')
    expect(layerById(style, 'route-line-editorial-paper-channel')?.paint?.['line-width']).toBe(5.6)
    expect(layerById(style, 'route-line-editorial-paper-channel')?.paint?.['line-opacity']).toBeCloseTo(0.522)
    expect(layerById(style, 'route-line-editorial-ink-ridge')?.paint?.['line-color']).toBe('#5E2C20')
    expect(layerById(style, 'route-line-editorial-ink-ridge')?.paint?.['line-width']).toBe(2.2)
    expect(layerById(style, 'route-line-editorial-ink-ridge')?.paint?.['line-opacity']).toBeCloseTo(0.288)
    expect(layerById(style, 'route-line-editorial-ink-ridge')?.paint?.['line-translate']).toEqual([-0.65, -0.45])
    expect(layerById(style, 'route-line-editorial-collector-cuts')?.paint?.['line-color']).toBe('#F8F3EA')
    expect(layerById(style, 'route-line-editorial-collector-cuts')?.paint?.['line-width']).toBe(1.05)
    expect(layerById(style, 'route-line-editorial-collector-cuts')?.paint?.['line-opacity']).toBeCloseTo(0.504)
    expect(layerById(style, 'route-line-editorial-collector-cuts')?.paint?.['line-dasharray']).toEqual([0.3, 7.2])
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#9A3B27')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.4)
    expect(layerIndex(style, 'route-line-editorial-gallery-shadow')).toBeLessThan(layerIndex(style, 'route-line-editorial-paper-channel'))
    expect(layerIndex(style, 'route-line-editorial-paper-channel')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-editorial-ink-ridge'))
    expect(layerIndex(style, 'route-line-editorial-ink-ridge')).toBeLessThan(layerIndex(style, 'route-line-editorial-collector-cuts'))
  })

  it('applies Editorial Minimal map tokens as the style contract', () => {
    coverSemanticMapTokens('editorial-minimal')
    const theme = getThemeDefinition('editorial-minimal')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.route_color).toBe('#9A3B27')
    expect(config.route_width).toBe(3.4)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#F1EADD')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#F1EADD')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-opacity']).toBe(0.98)
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-color']).toBe('#D8DEE0')
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-opacity']).toBe(0.18)
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-color']).toBe('#B7C8CC')
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-opacity']).toBe(0.20)
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#D7CFC0')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.16, 14, 0.16 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.42 * 0.8, 14, 0.42,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#AFA28B')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.24)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.38 * 1.5, 14, 0.38 * 2.5,
    ])
  })

  it('renders Risograph routes as GPX-source two-ink misregistered plates', () => {
    const theme = getThemeDefinition('risograph')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_color).toBe('#FF4F7B')
    expect(config.background_color).toBe('#EAE6DB')
    expect(config.route_width).toBe(6.2)
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'route-line-riso-blue')?.source).toBe('route')
    expect(layerById(style, 'route-line-riso-pink-overprint')?.source).toBe('route')
    expect(layerById(style, 'route-line-riso-blue')?.paint?.['line-color']).toBe('#2F5FD0')
    expect(layerById(style, 'route-line-riso-blue')?.paint?.['line-width']).toBeCloseTo(5.8)
    expect(layerById(style, 'route-line-riso-blue')?.paint?.['line-opacity']).toBe(0.81)
    expect(layerById(style, 'route-line-riso-blue')?.paint?.['line-translate']).toEqual([4.2, 3.4])
    expect(layerById(style, 'route-line-riso-pink-overprint')?.paint?.['line-color']).toBe('#FF4F7B')
    expect(layerById(style, 'route-line-riso-pink-overprint')?.paint?.['line-width']).toBeCloseTo(7.8)
    expect(layerById(style, 'route-line-riso-pink-overprint')?.paint?.['line-opacity']).toBeCloseTo(0.288)
    expect(layerById(style, 'route-line-riso-pink-overprint')?.paint?.['line-translate']).toEqual([-1.4, -1])
    expect(layerById(style, 'route-line-riso-pink-overprint')?.paint?.['line-blur']).toBe(0.45)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#FF4F7B')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(6.2)
    expect(layerIndex(style, 'route-line-riso-blue')).toBeLessThan(layerIndex(style, 'route-line-riso-pink-overprint'))
    expect(layerIndex(style, 'route-line-riso-pink-overprint')).toBeLessThan(layerIndex(style, 'route-line'))
  })

  it('applies Risograph map tokens as the style contract', () => {
    coverSemanticMapTokens('risograph')
    const theme = getThemeDefinition('risograph')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.composition).toBe('riso-stack')
    expect(config.font_family).toBe('Big Shoulders Display')
    expect(config.body_font_family).toBe('Work Sans')
    expect(config.tile_grain).toBe(0.5)
    expect(config.tile_effect).toBe('duotone')
    expect(config.tile_duotone_strength).toBe(0.82)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#FF4F7B')
    expect(config.route_width).toBe(6.2)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#EAE6DB')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#EAE6DB')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-opacity']).toBe(0.06)
    expect(layerById(style, 'radmaps-simple-contour-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-park')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-ghost-texture')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#2F5FD0')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.40, 14, 0.40 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.92 * 0.8, 14, 0.92,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#2F5FD0')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.58)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#FF4F7B')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(6.2)
    expect(layerById(style, 'route-line-riso-blue')?.paint?.['line-color']).toBe('#2F5FD0')
  })

  it('renders Field Journal routes as GPX-source dry ink linework', () => {
    const theme = getThemeDefinition('field-journal')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(3)
    expect(layerById(style, 'route-line-journal-wash')?.source).toBe('route')
    expect(layerById(style, 'route-line-journal-drybrush')?.source).toBe('route')
    expect(layerById(style, 'route-line-journal-wash')?.paint?.['line-translate']).toEqual([1.3, 1.1])
    expect(layerById(style, 'route-line-journal-drybrush')?.paint?.['line-dasharray']).toEqual([1.25, 0.52])
    expect(layerById(style, 'route-line-journal-drybrush')?.paint?.['line-translate']).toEqual([-0.8, 0.7])
    expect(layerIndex(style, 'route-line-journal-wash')).toBeLessThan(layerIndex(style, 'route-line-journal-drybrush'))
    expect(layerIndex(style, 'route-line-journal-drybrush')).toBeLessThan(layerIndex(style, 'route-line-casing'))
  })

  it('applies Field Journal map tokens as the naturalist spread contract', () => {
    coverSemanticMapTokens('field-journal')
    const theme = getThemeDefinition('field-journal')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-natural')
    expect(config.composition).toBe('journal-spread')
    expect(config.font_family).toBe('Cormorant Garamond')
    expect(config.body_font_family).toBe('Source Serif 4')
    expect(config.base_tile_style).toBe('maptiler-outdoor')
    expect(config.tile_effect).toBe('layer-color')
    expect(config.tile_grain).toBe(0.18)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(true)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.contour_detail).toBe(5)
    expect(config.route_color).toBe('#6A4A2A')
    expect(config.route_width).toBe(3.85)
    expect(config.route_opacity).toBe(0.98)
    expect(config.contour_color).toBe('#9B8665')
    expect(config.contour_major_color).toBe('#67563A')
    expect(config.water_color).toBe('#A1B6AE')
    expect(config.land_color).toBe('#E8D9BE')
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#E8D9BE')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-color']).toBe('#E8D9BE')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-opacity']).toBe(0.92)
    expect(layerById(style, 'radmaps-natural-park')?.paint?.['fill-color']).toBe('#B6B181')
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-color']).toBe('#A1B6AE')
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-opacity']).toBe(0.28)
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-color']).toBe('#7E9C95')
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-opacity']).toBe(0.36)
    expect(layerById(style, 'radmaps-natural-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-poi-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-place-labels')?.paint?.['text-color']).toBe('#4C422E')
    expect(layerById(style, 'radmaps-natural-place-labels')?.paint?.['text-opacity']).toBe(0.46)
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#9B8665')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.30, 14, 0.30 * 0.9,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#67563A')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.42)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#6A4A2A')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.85)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.98)
    expect(layerById(style, 'route-line-journal-wash')?.paint?.['line-color']).toBe('#A17B4D')
    expect(layerById(style, 'route-line-journal-wash')?.paint?.['line-width']).toBeCloseTo(7.95, 6)
    expect(layerById(style, 'route-line-journal-wash')?.paint?.['line-opacity']).toBeCloseTo(0.2744, 6)
    expect(layerById(style, 'route-line-journal-drybrush')?.paint?.['line-color']).toBe('#6A4A2A')
    expect(layerById(style, 'route-line-journal-drybrush')?.paint?.['line-width']).toBe(3.6)
    expect(layerById(style, 'route-line-journal-drybrush')?.paint?.['line-opacity']).toBeCloseTo(0.7644, 6)
  })

  it('renders Shaded Relief route with a GPX-source terrain shadow beneath the route ink', () => {
    const theme = getThemeDefinition('relief-shaded')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.hillshade_intensity).toBe(0.22)
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-shadow-color']).toBe('#9B845F')
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-highlight-color']).toBe('#FFF7DE')
    expect(layerById(style, 'route-line-relief-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-relief-highlight')?.source).toBe('route')
    expect(layerById(style, 'route-line-relief-shadow')?.paint?.['line-color']).toBe('#F5EFE2')
    expect(layerById(style, 'route-line-relief-shadow')?.paint?.['line-width']).toBe(8.5)
    expect(layerById(style, 'route-line-relief-shadow')?.paint?.['line-opacity']).toBeCloseTo(0.8832, 6)
    expect(layerById(style, 'route-line-relief-shadow')?.paint?.['line-blur']).toBe(0.15)
    expect(layerById(style, 'route-line-relief-shadow')?.paint?.['line-translate']).toEqual([0, 0])
    expect(layerById(style, 'route-line-relief-highlight')?.paint?.['line-color']).toBe('#14110D')
    expect(layerById(style, 'route-line-relief-highlight')?.paint?.['line-width']).toBeCloseTo(4.3, 6)
    expect(layerById(style, 'route-line-relief-highlight')?.paint?.['line-opacity']).toBeCloseTo(0.96, 6)
    expect(layerById(style, 'route-line-relief-highlight')?.paint?.['line-blur']).toBe(0)
    expect(layerById(style, 'route-line-relief-highlight')?.paint?.['line-translate']).toEqual([0, 0])
    expect(layerIndex(style, 'route-line-relief-shadow')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line-relief-highlight')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line-casing')).toBeLessThan(layerIndex(style, 'route-line'))
  })

  it('renders Sea Chart route as a GPX-source charted course with waypoint marks', () => {
    const theme = getThemeDefinition('sea-chart')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_color).toBe('#A6245D')
    expect(config.route_width).toBe(3.5)
    expect(config.route_opacity).toBe(0.96)
    expect(layerById(style, 'route-line-sea-course-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-sea-course')?.source).toBe('route')
    expect(layerById(style, 'route-line-sea-waypoints')?.source).toBe('route')
    expect(layerById(style, 'route-line-sea-course-shadow')?.paint?.['line-color']).toBe('#1D2A36')
    expect(layerById(style, 'route-line-sea-course-shadow')?.paint?.['line-width']).toBe(6.7)
    expect(layerById(style, 'route-line-sea-course-shadow')?.paint?.['line-opacity']).toBeCloseTo(0.2112)
    expect(layerById(style, 'route-line-sea-course-shadow')?.paint?.['line-blur']).toBe(0.8)
    expect(layerById(style, 'route-line-sea-course')?.paint?.['line-color']).toBe('#A6245D')
    expect(layerById(style, 'route-line-sea-course')?.paint?.['line-width']).toBe(3.5)
    expect(layerById(style, 'route-line-sea-course')?.paint?.['line-opacity']).toBeCloseTo(0.8832)
    expect(layerById(style, 'route-line-sea-course')?.paint?.['line-dasharray']).toEqual([1.2, 2.8])
    expect(layerById(style, 'route-line-sea-waypoints')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-sea-waypoints')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-sea-waypoints')?.layout?.['symbol-spacing']).toBe(44)
    expect(layerById(style, 'route-line-sea-waypoints')?.layout?.['text-field']).toBe('•')
    expect(layerById(style, 'route-line-sea-waypoints')?.layout?.['text-size']).toBe(16)
    expect(layerById(style, 'route-line-sea-waypoints')?.paint?.['text-color']).toBe('#A6245D')
    expect(layerById(style, 'route-line-sea-waypoints')?.paint?.['text-opacity']).toBe(0.9408)
    expect(layerById(style, 'route-line-sea-waypoints')?.paint?.['text-halo-color']).toBe('#E4EDE7')
    expect(layerById(style, 'route-line-sea-waypoints')?.paint?.['text-halo-width']).toBe(1.2)
    expect(layerById(style, 'route-line')?.paint?.['line-dasharray']).toBeUndefined()
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0)
    expect(layerById(style, 'route-line-casing')?.paint?.['line-opacity']).toBe(0)
    expect(layerIndex(style, 'route-line-sea-course-shadow')).toBeLessThan(layerIndex(style, 'route-line-sea-course'))
    expect(layerIndex(style, 'route-line-sea-course')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-sea-waypoints'))
  })

  it('applies Shaded Relief map tokens as the terrain print contract', () => {
    coverSemanticMapTokens('relief-shaded')
    const theme = getThemeDefinition('relief-shaded')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-natural')
    expect(config.composition).toBe('editorial-tall')
    expect(config.font_family).toBe('Newsreader')
    expect(config.body_font_family).toBe('Source Sans 3')
    expect(config.base_tile_style).toBe('maptiler-topo')
    expect(config.tile_effect).toBe('layer-color')
    expect(config.tile_grain).toBe(0.10)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(true)
    expect(config.hillshade_intensity).toBe(0.22)
    expect(config.hillshade_highlight).toBe(0.18)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.route_color).toBe('#14110D')
    expect(config.route_width).toBe(5.1)
    expect(config.route_opacity).toBe(0.96)
    expect(config.contour_detail).toBe(3)
    expect(config.contour_opacity).toBe(0.42)
    expect(config.contour_color).toBe('#B9AA86')
    expect(config.contour_major_color).toBe('#8D7654')
    expect(config.water_color).toBe('#9FBDB3')
    expect(config.land_color).toBe('#E6D8B7')
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#E6D8B7')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-color']).toBe('#E6D8B7')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-opacity']).toBe(0.74)
    expect(layerById(style, 'radmaps-natural-park')?.paint?.['fill-color']).toBe('#D7C28D')
    expect(layerById(style, 'radmaps-natural-park')?.paint?.['fill-opacity']).toBe(0.20)
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-color']).toBe('#B8C8B6')
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-opacity']).toBe(0.20)
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-color']).toBe('#9BB0A7')
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-opacity']).toBe(0.24)
    expect(layerById(style, 'radmaps-natural-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-poi-labels')).toBeUndefined()
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-shadow-color']).toBe('#9B845F')
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-highlight-color']).toBe('#FFF7DE')
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-accent-color']).toBe('#D8C08C')
    expect(layerById(style, 'hillshade')?.paint?.['hillshade-exaggeration']).toBe(0.22)
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#B9AA86')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.34, 14, 0.34 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.54 * 0.8, 14, 0.54,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#8D7654')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.58)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#14110D')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(5.1)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
  })

  it('applies Sea Chart map tokens as the nautical chart contract', () => {
    coverSemanticMapTokens('sea-chart')
    const theme = getThemeDefinition('sea-chart')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.composition).toBe('sea-chart')
    expect(config.font_family).toBe('Libre Baskerville')
    expect(config.body_font_family).toBe('IBM Plex Sans')
    expect(config.background_color).toBe('#E4EDE7')
    expect(config.label_bg_color).toBe('#E4EDE7')
    expect(config.label_text_color).toBe('#1D2A36')
    expect(config.tile_grain).toBe(0.08)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#A6245D')
    expect(config.route_width).toBe(3.5)
    expect(config.route_opacity).toBe(0.96)
    expect(config.place_labels_color).toBe('#315C65')
    expect(config.place_labels_opacity).toBe(0)
    expect(config.grid_scope).toBe('map')
    expect(config.grid_opacity).toBe(0.08)
    expect(config.grid_spacing).toBe(12)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#E4EDE7')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#E4EDE7')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-opacity']).toBe(0.99)
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-color']).toBe('#C7DDD7')
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-opacity']).toBe(0.56)
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-color']).toBe('#5F9286')
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-opacity']).toBe(0.48)
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#6C9A8F')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.42, 14, 0.42 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.72 * 0.8, 14, 0.72,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#2B625A')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.58)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.05 * 1.5, 14, 1.05 * 2.5,
    ])
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#A6245D')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3.5)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0)
  })

  it('applies Cartouche Place map tokens as the engraved place-frame contract', () => {
    coverSemanticMapTokens('cartouche-place')
    const theme = getThemeDefinition('cartouche-place')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-alidade')
    expect(config.composition).toBe('place-frame')
    expect(config.font_family).toBe('Playfair Display')
    expect(config.body_font_family).toBe('Source Serif 4')
    expect(config.base_tile_style).toBe('carto-light')
    expect(config.tile_effect).toBe('none')
    expect(config.tile_grain).toBe(0.12)
    expect(config.show_roads).toBe(true)
    expect(config.roads_color).toBe('#C5C0AF')
    expect(config.roads_opacity).toBe(0.10)
    expect(config.show_place_labels).toBe(false)
    expect(config.place_labels_color).toBe('#5C513F')
    expect(config.place_labels_opacity).toBe(0)
    expect(config.show_poi_labels).toBe(false)
    expect(config.poi_labels_color).toBe('#6F604A')
    expect(config.poi_labels_opacity).toBe(0)
    expect(config.show_contours).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(true)
    expect(config.grid_scope).toBe('map')
    expect(config.grid_opacity).toBe(0.16)
    expect(config.water_color).toBe('#D2D8CE')
    expect(config.land_color).toBe('#E2E2D9')
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.show_primary_route).toBe(false)
    expect(config.route_color).toBe('#9A3B27')
    expect(config.route_width).toBe(2.8)
    expect(config.route_opacity).toBe(0.86)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#E2E2D9')
    expect(layerById(style, 'radmaps-alidade-landcover')?.paint?.['fill-color']).toBe('#E2E2D9')
    expect(layerById(style, 'radmaps-alidade-water')?.paint?.['fill-color']).toBe('#D2D8CE')
    expect(layerById(style, 'radmaps-alidade-water')?.paint?.['fill-opacity']).toBe(0.42)
    expect(layerById(style, 'radmaps-alidade-waterway')?.paint?.['line-color']).toBe('#B3BDAF')
    expect(layerById(style, 'radmaps-alidade-waterway')?.paint?.['line-opacity']).toBe(0.30)
    expect(layerById(style, 'radmaps-alidade-roads-major')?.paint?.['line-color']).toBe('#8F8874')
    expect(layerById(style, 'radmaps-alidade-roads-major')?.paint?.['line-opacity']).toBe(0.10)
    expect(layerById(style, 'radmaps-alidade-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')).toBeUndefined()
    expect(layerById(style, 'contours-major')).toBeUndefined()
    expect(layerById(style, 'route-line')).toBeUndefined()
    expect(layerById(style, 'route-line-casing')).toBeUndefined()
  })

  it('applies Transit Diagram map tokens as the simplified diagram base contract', () => {
    coverSemanticMapTokens('transit-diagram')
    const theme = getThemeDefinition('transit-diagram')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-simple-contour')
    expect(config.composition).toBe('transit-diagram')
    expect(config.font_family).toBe('Outfit')
    expect(config.body_font_family).toBe('IBM Plex Sans')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_contours).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(true)
    expect(config.grid_scope).toBe('map')
    expect(config.grid_opacity).toBe(0.09)
    expect(config.grid_weight).toBe(1)
    expect(config.grid_spacing).toBe(8)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#7A1FA2')
    expect(config.route_width).toBe(7)
    expect(config.route_opacity).toBe(0.96)
    expect(config.route_smooth).toBe(2)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#F7F5F0')
    expect(layerById(style, 'radmaps-simple-contour-landcover')?.paint?.['fill-color']).toBe('#F7F5F0')
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-color']).toBe('#D8E5E7')
    expect(layerById(style, 'radmaps-simple-contour-water')?.paint?.['fill-opacity']).toBe(0.24)
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-color']).toBe('#BCCFD2')
    expect(layerById(style, 'radmaps-simple-contour-waterway')?.paint?.['line-opacity']).toBe(0.18)
    expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')).toBeUndefined()
    expect(layerById(style, 'contours-major')).toBeUndefined()
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#7A1FA2')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(7)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
  })

  it('renders Contour Wash routes as GPX-source washed contour echoes', () => {
    const theme = getThemeDefinition('contour-wash')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(3)
    expect(config.route_color).toBe('#303538')
    expect(config.route_opacity).toBe(0.98)
    expect(layerById(style, 'route-line-contour-wash-field')?.source).toBe('route')
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.source).toBe('route')
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.source).toBe('route')
    expect(layerById(style, 'route-line-contour-wash-field')?.paint?.['line-color']).toBe('#C9D6D3')
    expect(layerById(style, 'route-line-contour-wash-field')?.paint?.['line-width']).toBe(14)
    expect(layerById(style, 'route-line-contour-wash-field')?.paint?.['line-opacity']).toBeCloseTo(0.294)
    expect(layerById(style, 'route-line-contour-wash-field')?.paint?.['line-blur']).toBe(4.2)
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.paint?.['line-color']).toBe('#B7C0BD')
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.paint?.['line-width']).toBe(4.8500000000000005)
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.paint?.['line-opacity']).toBeCloseTo(0.5096)
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.paint?.['line-translate']).toEqual([-3.1, 2.2])
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.paint?.['line-color']).toBe('#8B9B96')
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.paint?.['line-width']).toBe(4.5)
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.paint?.['line-opacity']).toBeCloseTo(0.5684)
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.paint?.['line-translate']).toEqual([2.6, -2.6])
    expect(layerById(style, 'route-line-contour-wash-echo-low')?.paint?.['line-dasharray']).toEqual([3.8, 2.8])
    expect(layerById(style, 'route-line-contour-wash-echo-high')?.paint?.['line-dasharray']).toEqual([2.2, 3.6])
    expect(layerIndex(style, 'route-line-contour-wash-field')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line-casing')).toBeLessThan(layerIndex(style, 'route-line'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-contour-wash-echo-low'))
    expect(layerIndex(style, 'route-line-contour-wash-echo-low')).toBeLessThan(layerIndex(style, 'route-line-contour-wash-echo-high'))
  })

  it('applies Contour Wash map tokens as the style contract', () => {
    coverSemanticMapTokens('contour-wash')
    const theme = getThemeDefinition('contour-wash')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-contour-wash')
    expect(config.composition).toBe('art-wash')
    expect(config.font_family).toBe('Space Grotesk')
    expect(config.body_font_family).toBe('Source Sans 3')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#303538')
    expect(config.route_width).toBe(5.2)
    expect(config.route_opacity).toBe(0.98)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#ECEAE6')
    expect(layerById(style, 'radmaps-contour-wash-landcover')?.paint?.['fill-color']).toBe('#ECEAE6')
    expect(layerById(style, 'radmaps-contour-wash-landcover')?.paint?.['fill-opacity']).toBe(0.96)
    expect(layerById(style, 'radmaps-contour-wash-park')?.paint?.['fill-color']).toBe('#DDE3DF')
    expect(layerById(style, 'radmaps-contour-wash-park')?.paint?.['fill-opacity']).toBe(0.18)
    expect(layerById(style, 'radmaps-contour-wash-water')?.paint?.['fill-color']).toBe('#C9D6D3')
    expect(layerById(style, 'radmaps-contour-wash-water')?.paint?.['fill-opacity']).toBe(0.28)
    expect(layerById(style, 'radmaps-contour-wash-waterway')?.paint?.['line-color']).toBe('#AEBBB7')
    expect(layerById(style, 'radmaps-contour-wash-waterway')?.paint?.['line-opacity']).toBe(0.34)
    expect(layerById(style, 'radmaps-contour-wash-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-contour-wash-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-contour-wash-trails')).toBeUndefined()
    expect(layerById(style, 'radmaps-contour-wash-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-contour-wash-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-ghost-texture')?.paint?.['line-opacity']).toBe(0.08)
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#B7C0BD')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.54, 14, 0.54 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 2.05 * 0.8, 14, 2.05,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#8B9B96')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.74)
    expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.16 * 1.5, 14, 1.16 * 2.5,
    ])
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#303538')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(5.2)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.98)
  })

  it('renders Mid-Century travel routes as solid GPX-source poster ink', () => {
    for (const themeId of ['midcentury-travel', 'ranch-ochre', 'daybreak-trace'] as const) {
      const theme = getThemeDefinition(themeId)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token')

      expect(config.route_width).toBeGreaterThan(3.8)
      expect(config.route_opacity).toBe(themeId === 'daybreak-trace' ? 0.94 : 0.9)
      expect(layerIndex(style, 'route-line-casing')).toBeLessThan(layerIndex(style, 'route-line'))
      expect(layerById(style, 'route-line')?.source).toBe('route')
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(config.route_width)
      expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(config.route_opacity)
      expect(layerById(style, 'route-line-travel-shadow')).toBeUndefined()
      expect(layerById(style, 'route-line-travel-highlight')).toBeUndefined()
      expect(layerById(style, 'route-line-travel-register-cuts')).toBeUndefined()
      expect(layerById(style, 'route-line-travel-waypoints')).toBeUndefined()
    }
  })

  it('applies Mid-Century travel family map tokens as the shared style contract', () => {
    coverSemanticMapTokens('midcentury-travel', 'ranch-ochre', 'daybreak-trace')
    const cases = [
      {
        id: 'midcentury-travel',
        route: '#2A2018',
        routeWidth: 5.4,
        routeOpacity: 0.9,
        pin: '#2A2018',
        grain: 0.12,
        land: '#E8CC93',
        landOpacity: 0,
        water: '#83A79D',
        waterOpacity: 0.30,
        waterway: '#6E9A94',
        waterwayOpacity: 0.38,
        minorContour: '#D8A85F',
        majorContour: '#B06A2A',
        minorOpacity: 0.22,
        majorOpacity: 0.48,
      },
      {
        id: 'ranch-ochre',
        route: '#3A2414',
        routeWidth: 5.4,
        routeOpacity: 0.9,
        pin: '#3A2414',
        grain: 0.16,
        land: '#E9CD95',
        landOpacity: 0,
        water: '#EFDEC0',
        waterOpacity: 0,
        waterway: '#A3733C',
        waterwayOpacity: 0,
        minorContour: '#A3733C',
        majorContour: '#684620',
        minorOpacity: 0.20,
        majorOpacity: 0.46,
      },
      {
        id: 'daybreak-trace',
        route: '#3A2630',
        routeWidth: 5.0,
        routeOpacity: 0.94,
        pin: '#3A2630',
        grain: 0.1,
        land: '#F4D8CF',
        landOpacity: 0.96,
        water: '#F4D8CF',
        waterOpacity: 0,
        waterway: '#E19A82',
        waterwayOpacity: 0,
        minorContour: '#E19A82',
        majorContour: '#BE624A',
        minorOpacity: 0.22,
        majorOpacity: 0.50,
      },
    ] as const

    for (const expected of cases) {
      const theme = getThemeDefinition(expected.id)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      expect(config.preset).toBe('radmaps-simple-contour')
      expect(config.composition).toBe('travel-banner')
      expect(config.font_family).toBe('Oswald')
      expect(config.body_font_family).toBe('Source Sans 3')
      expect(config.tile_grain).toBe(expected.grain)
      expect(config.show_roads).toBe(false)
      expect(config.show_place_labels).toBe(false)
      expect(config.show_poi_labels).toBe(false)
      expect(config.show_hillshade).toBe(false)
      expect(config.contour_detail).toBe(2)
      expect(config.show_grid).toBe(false)
      expect(config.show_start_pin).toBe(true)
      expect(config.show_finish_pin).toBe(true)
      expect(config.pin_color).toBe(expected.pin)
      expect(config.pin_opacity).toBe(1)
      expect(config.route_color).toBe(expected.route)
      expect(config.route_width).toBe(expected.routeWidth)
      expect(config.route_opacity).toBe(expected.routeOpacity)
      expect(layerById(style, 'background')?.paint?.['background-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-simple-contour-landcover')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-water')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-waterway')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-roads-major')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-roads-minor')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-trails')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-place-labels')).toBeUndefined()
      expect(layerById(style, 'radmaps-simple-contour-poi-labels')).toBeUndefined()
      expect(layerById(style, 'contours-ghost-texture')).toBeUndefined()
      expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe(expected.minorContour)
      expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, expected.minorOpacity, 14, expected.minorOpacity * 0.9,
      ])
      expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, 0.64 * 0.8, 14, 0.64,
      ])
      expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe(expected.majorContour)
      expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(expected.majorOpacity)
      expect(layerById(style, 'contours-major')?.paint?.['line-width']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, 0.5 * 1.5, 14, 0.5 * 2.5,
      ])
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(expected.route)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(expected.routeWidth)
      expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(expected.routeOpacity)
      expect(layerById(style, 'route-line-travel-waypoints')).toBeUndefined()
    }
  })

  it('renders Electric Atlas routes as GPX-source neon pulse linework', () => {
    const theme = getThemeDefinition('electric-atlas')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(4)
    expect(layerById(style, 'route-line-electric-glow-wide')?.source).toBe('route')
    expect(layerById(style, 'route-line-electric-glow-hot')?.source).toBe('route')
    expect(layerById(style, 'route-line-electric-offset')?.source).toBe('route')
    expect(layerById(style, 'route-line-electric-pulse')?.source).toBe('route')
    expect(layerById(style, 'route-line-electric-glow-wide')?.paint?.['line-color']).toBe('#0DE8FF')
    expect(layerById(style, 'route-line-electric-glow-wide')?.paint?.['line-width']).toBe(14.2)
    expect(layerById(style, 'route-line-electric-glow-wide')?.paint?.['line-opacity']).toBe(0.162)
    expect(layerById(style, 'route-line-electric-glow-wide')?.paint?.['line-blur']).toBe(6)
    expect(layerById(style, 'route-line-electric-glow-hot')?.paint?.['line-color']).toBe('#FA498E')
    expect(layerById(style, 'route-line-electric-glow-hot')?.paint?.['line-width']).toBe(8.8)
    expect(layerById(style, 'route-line-electric-glow-hot')?.paint?.['line-opacity']).toBe(0.324)
    expect(layerById(style, 'route-line-electric-glow-hot')?.paint?.['line-blur']).toBe(2.4)
    expect(layerById(style, 'route-line-electric-offset')?.paint?.['line-color']).toBe('#35F3FF')
    expect(layerById(style, 'route-line-electric-offset')?.paint?.['line-width']).toBeCloseTo(3.05, 6)
    expect(layerById(style, 'route-line-electric-offset')?.paint?.['line-opacity']).toBe(0.522)
    expect(layerById(style, 'route-line-electric-offset')?.paint?.['line-translate']).toEqual([1.7, 1.2])
    expect(layerById(style, 'route-line-electric-pulse')?.paint?.['line-color']).toBe('#5FC3DD')
    expect(layerById(style, 'route-line-electric-pulse')?.paint?.['line-width']).toBe(1.2)
    expect(layerById(style, 'route-line-electric-pulse')?.paint?.['line-opacity']).toBe(0.648)
    expect(layerById(style, 'route-line-electric-pulse')?.paint?.['line-dasharray']).toEqual([0.5, 7.2])
    expect(layerIndex(style, 'route-line-electric-glow-wide')).toBeLessThan(layerIndex(style, 'route-line-electric-glow-hot'))
    expect(layerIndex(style, 'route-line-electric-glow-hot')).toBeLessThan(layerIndex(style, 'route-line-electric-offset'))
    expect(layerIndex(style, 'route-line-electric-offset')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-electric-pulse'))
  })

  it('renders Trail Blueprint routes as clean GPX-source data linework', () => {
    const theme = getThemeDefinition('blueprint-strava')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')
    const routeLayerIds = ((style as { layers?: TestLayer[] }).layers ?? [])
      .map(layer => layer.id)
      .filter(id => id.startsWith('route-line'))

    expect(config.route_color).toBe('#3DDC97')
    expect(config.route_width).toBe(3)
    expect(config.route_opacity).toBe(0.9)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(routeLayerIds).toEqual(['route-line-casing', 'route-line'])
    expect(layerById(style, 'route-line-casing')?.source).toBe('route')
    expect(layerById(style, 'route-line-casing')?.paint?.['line-color']).toBe(config.label_bg_color)
    expect(layerById(style, 'route-line-casing')?.paint?.['line-width']).toBe(config.route_width + 2.8)
    expect(layerById(style, 'route-line-casing')?.paint?.['line-opacity']).toBe(config.route_opacity)
    expect(layerById(style, 'route-line')?.source).toBe('route')
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#3DDC97')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(3)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.9)
    expect(layerIndex(style, 'route-line-casing')).toBeLessThan(layerIndex(style, 'route-line'))
    expect(layerById(style, 'route-line-electric-glow-wide')).toBeUndefined()
    expect(layerById(style, 'route-line-electric-pulse')).toBeUndefined()
    expect(layerById(style, 'route-line-blueprint-drafting-offset')).toBeUndefined()
    expect(layerById(style, 'route-line-performance-checkpoints')).toBeUndefined()
  })

  it('applies Blueprint-Strava composition map tokens as technical performance contracts', () => {
    coverSemanticMapTokens('blueprint-strava', 'electric-atlas')
    const cases = [
      {
        id: 'blueprint-strava',
        font: 'Space Grotesk',
        route: '#3DDC97',
        routeWidth: 3,
        routeOpacity: 0.9,
        grain: 0.04,
        gridOpacity: 0.14,
        gridSpacing: 8,
        land: '#0B1A15',
        landOpacity: 0.94,
        park: '#0F241D',
        parkOpacity: 0.18,
        water: '#071B16',
        waterOpacity: 0.52,
        waterway: '#1F4F43',
        waterwayOpacity: 0.32,
        minorContour: '#3A6A5E',
        majorContour: '#91BFAE',
        minorOpacity: 0.34,
        majorOpacity: 0.48,
      },
      {
        id: 'electric-atlas',
        font: 'Big Shoulders Display',
        route: '#FA498E',
        routeWidth: 4.2,
        routeOpacity: 0.9,
        grain: 0.08,
        gridOpacity: 0.16,
        gridSpacing: 6,
        land: '#0B0E1A',
        landOpacity: 0.96,
        park: '#10152C',
        parkOpacity: 0.20,
        water: '#08172A',
        waterOpacity: 0.50,
        waterway: '#182A56',
        waterwayOpacity: 0.34,
        minorContour: '#4A49A2',
        majorContour: '#7772EA',
        minorOpacity: 0.44,
        majorOpacity: 0.62,
      },
    ] as const

    for (const expected of cases) {
      const theme = getThemeDefinition(expected.id)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      expect(config.preset).toBe('radmaps-alidade-dark')
      expect(config.composition).toBe('blueprint-strava')
      expect(config.font_family).toBe(expected.font)
      expect(config.body_font_family).toBe('IBM Plex Sans')
      expect(config.base_tile_style).toBe('carto-dark')
      expect(config.tile_effect).toBe('none')
      expect(config.tile_grain).toBe(expected.grain)
      expect(config.show_roads).toBe(false)
      expect(config.show_place_labels).toBe(false)
      expect(config.show_poi_labels).toBe(false)
      expect(config.show_hillshade).toBe(false)
      expect(config.show_grid).toBe(true)
      expect(config.grid_scope).toBe('map')
      expect(config.grid_opacity).toBe(expected.gridOpacity)
      expect(config.grid_weight).toBe(1)
      expect(config.grid_spacing).toBe(expected.gridSpacing)
      expect(config.show_start_pin).toBe(false)
      expect(config.show_finish_pin).toBe(false)
      expect(config.route_color).toBe(expected.route)
      expect(config.route_width).toBe(expected.routeWidth)
      expect(config.route_opacity).toBe(expected.routeOpacity)
      expect(layerById(style, 'background')?.paint?.['background-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-alidade-dark-landcover')?.paint?.['fill-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-alidade-dark-landcover')?.paint?.['fill-opacity']).toBe(expected.landOpacity)
      expect(layerById(style, 'radmaps-alidade-dark-park')?.paint?.['fill-color']).toBe(expected.park)
      expect(layerById(style, 'radmaps-alidade-dark-park')?.paint?.['fill-opacity']).toBe(expected.parkOpacity)
      expect(layerById(style, 'radmaps-alidade-dark-water')?.paint?.['fill-color']).toBe(expected.water)
      expect(layerById(style, 'radmaps-alidade-dark-water')?.paint?.['fill-opacity']).toBe(expected.waterOpacity)
      expect(layerById(style, 'radmaps-alidade-dark-waterway')?.paint?.['line-color']).toBe(expected.waterway)
      expect(layerById(style, 'radmaps-alidade-dark-waterway')?.paint?.['line-opacity']).toBe(expected.waterwayOpacity)
      expect(layerById(style, 'radmaps-alidade-dark-roads-major')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-roads-minor')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-trails')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-place-labels')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-poi-labels')).toBeUndefined()
      expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe(expected.minorContour)
      expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, expected.minorOpacity, 14, expected.minorOpacity * 0.9,
      ])
      expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe(expected.majorContour)
      expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(expected.majorOpacity)
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(expected.route)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(expected.routeWidth)
      expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(expected.routeOpacity)
    }
  })

  it('renders Trail Profile routes as GPX-source split timing linework', () => {
    for (const themeId of ['splits-stats', 'night-ride'] as const) {
      const theme = getThemeDefinition(themeId)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token')

      expect(config.route_width).toBeGreaterThan(3)
      expect(config.route_opacity).toBe(0.94)
      expect(layerById(style, 'route-line-performance-glow')?.source).toBe('route')
      expect(layerById(style, 'route-line-performance-shadow')?.source).toBe('route')
      expect(layerById(style, 'route-line-performance-split-cuts')?.source).toBe('route')
      expect(layerById(style, 'route-line-performance-checkpoints')?.source).toBe('route')
      expect(layerById(style, 'route-line-performance-glow')?.paint?.['line-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line-performance-glow')?.paint?.['line-width']).toBe(config.route_width + 5.4)
      expect(layerById(style, 'route-line-performance-glow')?.paint?.['line-opacity']).toBeCloseTo(0.188)
      expect(layerById(style, 'route-line-performance-glow')?.paint?.['line-blur']).toBe(1.15)
      expect(layerById(style, 'route-line-performance-shadow')?.paint?.['line-color']).toBe(config.background_color)
      expect(layerById(style, 'route-line-performance-shadow')?.paint?.['line-width']).toBe(config.route_width + 2.2)
      expect(layerById(style, 'route-line-performance-shadow')?.paint?.['line-opacity']).toBeCloseTo(0.7332)
      expect(layerById(style, 'route-line-performance-shadow')?.paint?.['line-translate']).toEqual([1.1, 1.1])
      expect(layerById(style, 'route-line-performance-split-cuts')?.paint?.['line-color']).toBe(config.background_color)
      expect(layerById(style, 'route-line-performance-split-cuts')?.paint?.['line-width']).toBeCloseTo(config.route_width - 1.25)
      expect(layerById(style, 'route-line-performance-split-cuts')?.paint?.['line-opacity']).toBeCloseTo(0.6016)
      expect(layerById(style, 'route-line-performance-split-cuts')?.paint?.['line-dasharray']).toEqual([0.34, 4.8])
      expect(layerById(style, 'route-line-performance-checkpoints')?.type).toBe('symbol')
      expect(layerById(style, 'route-line-performance-checkpoints')?.layout?.['symbol-placement']).toBe('line')
      expect(layerById(style, 'route-line-performance-checkpoints')?.layout?.['symbol-spacing']).toBe(84)
      expect(layerById(style, 'route-line-performance-checkpoints')?.layout?.['text-field']).toBe('●')
      expect(layerById(style, 'route-line-performance-checkpoints')?.layout?.['text-size']).toBe(9)
      expect(layerById(style, 'route-line-performance-checkpoints')?.paint?.['text-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line-performance-checkpoints')?.paint?.['text-opacity']).toBeCloseTo(0.6768)
      expect(layerById(style, 'route-line-performance-checkpoints')?.paint?.['text-halo-color']).toBe(config.background_color)
      expect(layerById(style, 'route-line-performance-checkpoints')?.paint?.['text-halo-width']).toBe(1.15)
      expect(layerIndex(style, 'route-line-performance-glow')).toBeLessThan(layerIndex(style, 'route-line-performance-shadow'))
      expect(layerIndex(style, 'route-line-performance-shadow')).toBeLessThan(layerIndex(style, 'route-line-casing'))
      expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-performance-split-cuts'))
      expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-performance-checkpoints'))
    }
  })

  it('applies Trail Profile family map tokens as performance contracts', () => {
    coverSemanticMapTokens('splits-stats', 'night-ride')
    const cases = [
      {
        id: 'splits-stats',
        font: 'Space Grotesk',
        route: '#FF5A36',
        routeWidth: 3.45,
        grain: 0.08,
        grid: true,
        gridOpacity: 0.10,
        profileHeight: 17,
        land: '#141619',
        water: '#0E1720',
        minorContour: '#282D33',
        majorContour: '#596168',
        minorOpacity: 0.30,
        majorOpacity: 0.30,
      },
      {
        id: 'night-ride',
        font: 'Oswald',
        route: '#28D6D6',
        routeWidth: 3.35,
        grain: 0.1,
        grid: false,
        gridOpacity: 0.2,
        profileHeight: 10,
        land: '#101417',
        water: '#0B1A23',
        minorContour: '#222F34',
        majorContour: '#52666A',
        minorOpacity: 0.32,
        majorOpacity: 0.48,
      },
    ] as const

    for (const expected of cases) {
      const theme = getThemeDefinition(expected.id)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      expect(config.preset).toBe('radmaps-alidade-dark')
      expect(config.composition).toBe('splits-grid')
      expect(config.font_family).toBe(expected.font)
      expect(config.body_font_family).toBe('IBM Plex Sans')
      expect(config.tile_grain).toBe(expected.grain)
      expect(config.show_roads).toBe(false)
      expect(config.show_place_labels).toBe(false)
      expect(config.show_poi_labels).toBe(false)
      expect(config.show_hillshade).toBe(false)
      expect(config.show_grid).toBe(expected.grid)
      if (expected.grid) expect(config.grid_scope).toBe('map')
      expect(config.grid_opacity).toBe(expected.gridOpacity)
      expect(config.show_elevation_profile).toBe(true)
      expect(config.elevation_profile_position).toBe('separate-band')
      expect(config.elevation_profile_height).toBe(expected.profileHeight)
      expect(config.route_color).toBe(expected.route)
      expect(config.route_width).toBe(expected.routeWidth)
      expect(config.route_opacity).toBe(0.94)
      expect(config.show_start_pin).toBe(false)
      expect(config.show_finish_pin).toBe(false)
      expect(layerById(style, 'background')?.paint?.['background-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-alidade-dark-landcover')?.paint?.['fill-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-alidade-dark-water')?.paint?.['fill-color']).toBe(expected.water)
      expect(layerById(style, 'radmaps-alidade-dark-roads-major')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-roads-minor')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-place-labels')).toBeUndefined()
      expect(layerById(style, 'radmaps-alidade-dark-poi-labels')).toBeUndefined()
      expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe(expected.minorContour)
      expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, expected.minorOpacity, 14, expected.minorOpacity * 0.9,
      ])
      expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe(expected.majorContour)
      expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(expected.majorOpacity)
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(expected.route)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(expected.routeWidth)
      expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.94)
    }
  })

  it('renders Dark Sky routes as GPX-source constellation linework', () => {
    for (const themeId of ['dark-sky', 'copper-night'] as const) {
      const theme = getThemeDefinition(themeId)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token')

      expect(config.route_width).toBeGreaterThan(3)
      expect(config.route_opacity).toBe(0.9)
      expect(layerById(style, 'route-line-darksky-glow-wide')?.source).toBe('route')
      expect(layerById(style, 'route-line-darksky-glow-core')?.source).toBe('route')
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.source).toBe('route')
      expect(layerById(style, 'route-line-darksky-constellation')?.source).toBe('route')
      expect(layerById(style, 'route-line-darksky-star-crosses')?.source).toBe('route')
      expect(layerById(style, 'route-line-darksky-glow-wide')?.paint?.['line-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line-darksky-glow-wide')?.paint?.['line-width']).toBe(config.route_width + 8)
      expect(layerById(style, 'route-line-darksky-glow-wide')?.paint?.['line-opacity']).toBeCloseTo(0.162)
      expect(layerById(style, 'route-line-darksky-glow-wide')?.paint?.['line-blur']).toBe(5.2)
      expect(layerById(style, 'route-line-darksky-glow-core')?.paint?.['line-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line-darksky-glow-core')?.paint?.['line-width']).toBe(config.route_width + 3.2)
      expect(layerById(style, 'route-line-darksky-glow-core')?.paint?.['line-opacity']).toBeCloseTo(0.252)
      expect(layerById(style, 'route-line-darksky-glow-core')?.paint?.['line-blur']).toBe(1.8)
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.paint?.['line-translate']).toEqual([1.6, -1.3])
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.paint?.['line-dasharray']).toEqual([0.55, 6.4])
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.paint?.['line-color']).toBe(config.label_text_color)
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.paint?.['line-width']).toBeCloseTo(config.route_width - 1.25)
      expect(layerById(style, 'route-line-darksky-offset-starpath')?.paint?.['line-opacity']).toBeCloseTo(0.306)
      expect(layerById(style, 'route-line-darksky-constellation')?.type).toBe('symbol')
      expect(layerById(style, 'route-line-darksky-constellation')?.layout?.['symbol-placement']).toBe('line')
      expect(layerById(style, 'route-line-darksky-constellation')?.layout?.['symbol-spacing']).toBe(76)
      expect(layerById(style, 'route-line-darksky-constellation')?.layout?.['text-field']).toBe('•')
      expect(layerById(style, 'route-line-darksky-constellation')?.paint?.['text-color']).toBe(config.label_text_color)
      expect(layerById(style, 'route-line-darksky-constellation')?.paint?.['text-opacity']).toBeCloseTo(0.738)
      expect(layerById(style, 'route-line-darksky-constellation')?.paint?.['text-halo-color']).toBe(config.background_color)
      expect(layerById(style, 'route-line-darksky-star-crosses')?.type).toBe('symbol')
      expect(layerById(style, 'route-line-darksky-star-crosses')?.layout?.['symbol-placement']).toBe('line')
      expect(layerById(style, 'route-line-darksky-star-crosses')?.layout?.['symbol-spacing']).toBe(142)
      expect(layerById(style, 'route-line-darksky-star-crosses')?.layout?.['text-field']).toBe('✦')
      expect(layerById(style, 'route-line-darksky-star-crosses')?.paint?.['text-color']).toBe(config.route_color)
      expect(layerById(style, 'route-line-darksky-star-crosses')?.paint?.['text-opacity']).toBeCloseTo(0.468)
      expect(layerById(style, 'route-line-darksky-star-crosses')?.paint?.['text-halo-color']).toBe(config.background_color)
      expect(layerIndex(style, 'route-line-darksky-glow-wide')).toBeLessThan(layerIndex(style, 'route-line-darksky-glow-core'))
      expect(layerIndex(style, 'route-line-darksky-glow-core')).toBeLessThan(layerIndex(style, 'route-line-darksky-offset-starpath'))
      expect(layerIndex(style, 'route-line-darksky-offset-starpath')).toBeLessThan(layerIndex(style, 'route-line-casing'))
      expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-darksky-constellation'))
      expect(layerIndex(style, 'route-line-darksky-constellation')).toBeLessThan(layerIndex(style, 'route-line-darksky-star-crosses'))
    }
  })

  it('applies Dark Sky family map tokens as nocturne contracts', () => {
    coverSemanticMapTokens('dark-sky', 'copper-night')
    const cases = [
      {
        id: 'dark-sky',
        background: '#070C1E',
        text: '#E7ECFB',
        route: '#E8C66A',
        routeWidth: 4.05,
        grain: 0.22,
        land: '#101A38',
        landOpacity: 0,
        park: '#101A38',
        parkOpacity: 0,
        water: '#071024',
        waterOpacity: 0,
        waterway: '#18294C',
        waterwayOpacity: 0,
        minorContour: '#22325D',
        majorContour: '#50689C',
        contourDetail: 1,
        minorOpacity: 0.06,
        majorOpacity: 0.34,
      },
      {
        id: 'copper-night',
        background: '#100B08',
        text: '#F0D9BF',
        route: '#F0B15F',
        routeWidth: 3.85,
        grain: 0.24,
        land: '#15100C',
        landOpacity: 0,
        park: '#15100C',
        parkOpacity: 0,
        water: '#1B202A',
        waterOpacity: 0,
        waterway: '#2E3440',
        waterwayOpacity: 0,
        minorContour: '#493021',
        majorContour: '#9C6741',
        contourDetail: 1,
        minorOpacity: 0.08,
        majorOpacity: 0.36,
        footerDistanceUnit: 'km',
        footerDateFormat: 'month-year',
      },
    ] as const

    for (const expected of cases) {
      const theme = getThemeDefinition(expected.id)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      expect(config.preset).toBe('radmaps-night-relief')
      expect(config.composition).toBe('darksky-stars')
      expect(config.font_family).toBe('Cormorant Garamond')
      expect(config.body_font_family).toBe('Source Sans 3')
      expect(config.background_color).toBe(expected.background)
      expect(config.label_bg_color).toBe(expected.background)
      expect(config.label_text_color).toBe(expected.text)
      expect(config.tile_grain).toBe(expected.grain)
      expect(config.show_roads).toBe(false)
      expect(config.show_place_labels).toBe(false)
      expect(config.show_poi_labels).toBe(false)
      expect(config.show_hillshade).toBe(false)
      expect(config.show_grid).toBe(false)
      expect(config.contour_detail).toBe(expected.contourDetail)
      if ('footerDistanceUnit' in expected) {
        expect(config.composition_footer_distance_unit).toBe(expected.footerDistanceUnit)
        expect(config.composition_footer_date_format).toBe(expected.footerDateFormat)
      } else {
        expect(config.composition_footer_distance_unit).toBeUndefined()
        expect(config.composition_footer_date_format).toBeUndefined()
      }
      expect(config.show_start_pin).toBe(false)
      expect(config.show_finish_pin).toBe(false)
      expect(config.tile_effect).toBe('layer-color')
      expect(config.route_color).toBe(expected.route)
      expect(config.route_width).toBe(expected.routeWidth)
      expect(config.route_opacity).toBe(0.9)
      expect(layerById(style, 'background')?.paint?.['background-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-night-relief-landcover')?.paint?.['fill-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-night-relief-landcover')?.paint?.['fill-opacity']).toBe(expected.landOpacity)
      expect(layerById(style, 'radmaps-night-relief-park')?.paint?.['fill-color']).toBe(expected.park)
      expect(layerById(style, 'radmaps-night-relief-park')?.paint?.['fill-opacity']).toBe(expected.parkOpacity)
      expect(layerById(style, 'radmaps-night-relief-water')?.paint?.['fill-color']).toBe(expected.water)
      expect(layerById(style, 'radmaps-night-relief-water')?.paint?.['fill-opacity']).toBe(expected.waterOpacity)
      expect(layerById(style, 'radmaps-night-relief-waterway')?.paint?.['line-color']).toBe(expected.waterway)
      expect(layerById(style, 'radmaps-night-relief-waterway')?.paint?.['line-opacity']).toBe(expected.waterwayOpacity)
      expect(layerById(style, 'radmaps-night-relief-roads-major')).toBeUndefined()
      expect(layerById(style, 'radmaps-night-relief-roads-minor')).toBeUndefined()
      expect(layerById(style, 'radmaps-night-relief-roads-trails')).toBeUndefined()
      expect(layerById(style, 'radmaps-night-relief-place-labels')).toBeUndefined()
      expect(layerById(style, 'radmaps-night-relief-poi-labels')).toBeUndefined()
      expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe(expected.minorContour)
      expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, expected.minorOpacity, 14, expected.minorOpacity * 0.9,
      ])
      expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe(expected.majorContour)
      expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(expected.majorOpacity)
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(expected.route)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(expected.routeWidth)
    }
  })

  it('renders Marathon Bib routes as GPX-source race course ink with mile ticks', () => {
    const theme = getThemeDefinition('marathon-bib')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(4.5)
    expect(config.route_color).toBe('#E0322C')
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'route-line-bib-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-bib-knockout')?.source).toBe('route')
    expect(layerById(style, 'route-line-bib-mile-dashes')?.source).toBe('route')
    expect(layerById(style, 'route-line-bib-mile-ticks')?.source).toBe('route')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.source).toBe('route')
    expect(layerById(style, 'route-line-bib-shadow')?.paint?.['line-color']).toBe('#14264A')
    expect(layerById(style, 'route-line-bib-shadow')?.paint?.['line-width']).toBe(8.399999999999999)
    expect(layerById(style, 'route-line-bib-shadow')?.paint?.['line-opacity']).toBeCloseTo(0.117)
    expect(layerById(style, 'route-line-bib-shadow')?.paint?.['line-blur']).toBe(1.1)
    expect(layerById(style, 'route-line-bib-shadow')?.paint?.['line-translate']).toEqual([1.2, 1.2])
    expect(layerById(style, 'route-line-bib-knockout')?.paint?.['line-color']).toBe('#F0EDE5')
    expect(layerById(style, 'route-line-bib-knockout')?.paint?.['line-width']).toBe(6.8)
    expect(layerById(style, 'route-line-bib-knockout')?.paint?.['line-opacity']).toBeCloseTo(0.738)
    expect(layerById(style, 'route-line-bib-mile-dashes')?.paint?.['line-color']).toBe('#14264A')
    expect(layerById(style, 'route-line-bib-mile-dashes')?.paint?.['line-width']).toBe(1.35)
    expect(layerById(style, 'route-line-bib-mile-dashes')?.paint?.['line-opacity']).toBeCloseTo(0.504)
    expect(layerById(style, 'route-line-bib-mile-dashes')?.paint?.['line-dasharray']).toEqual([0.35, 8])
    expect(layerById(style, 'route-line-bib-mile-ticks')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-bib-mile-ticks')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-bib-mile-ticks')?.layout?.['symbol-spacing']).toBe(82)
    expect(layerById(style, 'route-line-bib-mile-ticks')?.layout?.['text-field']).toBe('|')
    expect(layerById(style, 'route-line-bib-mile-ticks')?.layout?.['text-size']).toBe(15)
    expect(layerById(style, 'route-line-bib-mile-ticks')?.layout?.['text-rotate']).toBe(90)
    expect(layerById(style, 'route-line-bib-mile-ticks')?.paint?.['text-color']).toBe('#14264A')
    expect(layerById(style, 'route-line-bib-mile-ticks')?.paint?.['text-opacity']).toBeCloseTo(0.432)
    expect(layerById(style, 'route-line-bib-mile-ticks')?.paint?.['text-halo-color']).toBe('#F0EDE5')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.layout?.['symbol-spacing']).toBe(168)
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.layout?.['text-field']).toBe('●')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.layout?.['text-size']).toBe(15)
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.paint?.['text-color']).toBe('#F0EDE5')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.paint?.['text-opacity']).toBeCloseTo(0.855)
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.paint?.['text-halo-color']).toBe('#E0322C')
    expect(layerById(style, 'route-line-bib-checkpoint-dots')?.paint?.['text-halo-width']).toBe(2.8)
    expect(layerIndex(style, 'route-line-bib-shadow')).toBeLessThan(layerIndex(style, 'route-line-bib-knockout'))
    expect(layerIndex(style, 'route-line-bib-knockout')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-bib-mile-ticks'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-bib-mile-dashes'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-bib-checkpoint-dots'))
  })

  it('applies Marathon Bib map tokens as the race-poster contract', () => {
    coverSemanticMapTokens('marathon-bib')
    const theme = getThemeDefinition('marathon-bib')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-alidade')
    expect(config.composition).toBe('bib-numerals')
    expect(config.font_family).toBe('Bebas Neue')
    expect(config.body_font_family).toBe('Atkinson Hyperlegible Next')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.pin_color).toBe('#E0322C')
    expect(config.pin_opacity).toBe(1)
    expect(config.route_color).toBe('#E0322C')
    expect(config.route_width).toBe(4.6)
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#F0ECE2')
    expect(layerById(style, 'radmaps-alidade-landcover')?.paint?.['fill-color']).toBe('#F0ECE2')
    expect(layerById(style, 'radmaps-alidade-landcover')?.paint?.['fill-opacity']).toBe(0.96)
    expect(layerById(style, 'radmaps-alidade-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-alidade-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#D8D0C2')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.34, 14, 0.34 * 0.9,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#A59A86')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.44)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#E0322C')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(4.6)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.9)
  })

  it('renders Botanical routes as GPX-source specimen linework', () => {
    const theme = getThemeDefinition('botanical')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(4)
    expect(layerById(style, 'route-line-botanical-pressed')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-vein')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-stem-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-ink-vein')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-leaf-cuts')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.source).toBe('route')
    expect(layerById(style, 'route-line-botanical-pressed')?.paint?.['line-color']).toBe('#B7C6A8')
    expect(layerById(style, 'route-line-botanical-pressed')?.paint?.['line-width']).toBe(10.95)
    expect(layerById(style, 'route-line-botanical-pressed')?.paint?.['line-opacity']).toBeCloseTo(0.1128)
    expect(layerById(style, 'route-line-botanical-vein')?.paint?.['line-color']).toBe('#31512B')
    expect(layerById(style, 'route-line-botanical-vein')?.paint?.['line-width']).toBeCloseTo(4, 6)
    expect(layerById(style, 'route-line-botanical-stem-shadow')?.paint?.['line-color']).toBe('#2D3F22')
    expect(layerById(style, 'route-line-botanical-ink-vein')?.paint?.['line-color']).toBe('#31512B')
    expect(layerById(style, 'route-line-botanical-ink-vein')?.paint?.['line-width']).toBe(1.35)
    expect(layerById(style, 'route-line-botanical-leaf-cuts')?.paint?.['line-dasharray']).toEqual([0.22, 5.4])
    expect(layerById(style, 'route-line-botanical-leaf-cuts')?.paint?.['line-color']).toBe('#EEF1E8')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.type).toBe('symbol')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.layout?.['symbol-placement']).toBe('line')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.layout?.['text-field']).toBe('·')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.paint?.['text-color']).toBe('#31512B')
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.paint?.['text-opacity']).toBe(0.3008)
    expect(layerById(style, 'route-line-botanical-specimen-dots')?.paint?.['text-halo-color']).toBe('#EEF1E8')
    expect(layerIndex(style, 'route-line-botanical-pressed')).toBeLessThan(layerIndex(style, 'route-line-botanical-vein'))
    expect(layerIndex(style, 'route-line-botanical-vein')).toBeLessThan(layerIndex(style, 'route-line-botanical-stem-shadow'))
    expect(layerIndex(style, 'route-line-botanical-stem-shadow')).toBeLessThan(layerIndex(style, 'route-line-casing'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-botanical-ink-vein'))
    expect(layerIndex(style, 'route-line-botanical-ink-vein')).toBeLessThan(layerIndex(style, 'route-line-botanical-leaf-cuts'))
    expect(layerIndex(style, 'route-line-botanical-leaf-cuts')).toBeLessThan(layerIndex(style, 'route-line-botanical-specimen-dots'))
    expect(layerIndex(style, 'route-line')).toBeLessThan(layerIndex(style, 'route-line-botanical-specimen-dots'))
  })

  it('applies Botanical map tokens as the engraved plate contract', () => {
    coverSemanticMapTokens('botanical')
    const theme = getThemeDefinition('botanical')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-natural')
    expect(config.composition).toBe('botanical-plate')
    expect(config.font_family).toBe('Cormorant Garamond')
    expect(config.body_font_family).toBe('Source Serif 4')
    expect(config.tile_grain).toBe(0.18)
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(true)
    expect(config.show_finish_pin).toBe(true)
    expect(config.pin_color).toBe('#31512B')
    expect(config.pin_opacity).toBe(1)
    expect(config.contour_detail).toBe(2)
    expect(config.contour_color).toBe('#8F9F6D')
    expect(config.contour_major_color).toBe('#536737')
    expect(config.water_color).toBe('#B7C6A8')
    expect(config.land_color).toBe('#EEF1E8')
    expect(config.route_color).toBe('#31512B')
    expect(config.route_width).toBe(4.35)
    expect(config.route_opacity).toBe(0.94)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#EEF1E8')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-color']).toBe('#EEF1E8')
    expect(layerById(style, 'radmaps-natural-landcover')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-natural-park')?.paint?.['fill-color']).toBe('#EEF1E8')
    expect(layerById(style, 'radmaps-natural-park')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-color']).toBe('#EEF1E8')
    expect(layerById(style, 'radmaps-natural-water')?.paint?.['fill-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-color']).toBe('#A9B897')
    expect(layerById(style, 'radmaps-natural-waterway')?.paint?.['line-opacity']).toBe(0)
    expect(layerById(style, 'radmaps-natural-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-natural-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#8F9F6D')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.04, 14, 0.04 * 0.9,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#536737')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.68)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#31512B')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(4.35)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.94)
  })

  it('renders Modernist routes as clean GPX-source graphic linework', () => {
    const theme = getThemeDefinition('bold-modern')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(4)
    expect(config.route_color).toBe('#D04D40')
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'route-line-modernist-trap')).toBeUndefined()
    expect(layerById(style, 'route-line-modernist-knockout')).toBeUndefined()
    expect(layerById(style, 'route-line-modernist-register')).toBeUndefined()
    expect(layerById(style, 'route-line')?.source).toBe('route')
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#D04D40')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(4.2)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
    expect(layerIndex(style, 'route-line-casing')).toBeLessThan(layerIndex(style, 'route-line'))
  })

  it('renders Blackline routes as a clean GPX-source mono Modernist colorway', () => {
    const theme = getThemeDefinition('blackline')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThanOrEqual(4)
    expect(config.route_color).toBe('#0C0C0C')
    expect(config.route_opacity).toBe(0.9)
    expect(layerById(style, 'route-line-blackline-plate')?.source).toBe('route')
    expect(layerById(style, 'route-line-blackline-knockout')?.source).toBe('route')
    expect(layerById(style, 'route-line-blackline-plate')?.paint?.['line-color']).toBe('#11100E')
    expect(layerById(style, 'route-line-blackline-plate')?.paint?.['line-width']).toBe(6.6)
    expect(layerById(style, 'route-line-blackline-plate')?.paint?.['line-opacity']).toBeCloseTo(0.1536)
    expect(layerById(style, 'route-line-blackline-plate')?.paint?.['line-translate']).toEqual([1.5, 1.5])
    expect(layerById(style, 'route-line-blackline-knockout')?.paint?.['line-color']).toBe('#FFFFFF')
    expect(layerById(style, 'route-line-blackline-knockout')?.paint?.['line-width']).toBe(5.6)
    expect(layerById(style, 'route-line-blackline-knockout')?.paint?.['line-opacity']).toBeCloseTo(0.8256)
    expect(layerById(style, 'route-line-blackline-register-cuts')).toBeUndefined()
    expect(layerById(style, 'route-line-blackline-register')).toBeUndefined()
    expect(layerById(style, 'route-line-modernist-register')).toBeUndefined()
    expect(layerById(style, 'route-line-modernist-trap')).toBeUndefined()
    expect(layerIndex(style, 'route-line-blackline-plate')).toBeLessThan(layerIndex(style, 'route-line-blackline-knockout'))
    expect(layerIndex(style, 'route-line-blackline-knockout')).toBeLessThan(layerIndex(style, 'route-line-casing'))
  })

  it('applies Modernist family map tokens as graphic poster contracts', () => {
    coverSemanticMapTokens('bold-modern', 'blackline')
    const cases = [
      {
        id: 'bold-modern',
        body: 'DM Sans',
        route: '#D04D40',
        width: 4.2,
        pin: '#D04D40',
        land: '#E5C3BB',
        minorContour: '#D6D0C7',
        majorContour: '#191614',
        minorOpacity: 0.22,
        majorOpacity: 0.58,
      },
      {
        id: 'blackline',
        body: 'IBM Plex Sans',
        route: '#0C0C0C',
        width: 4,
        pin: '#0C0C0C',
        land: '#F6F6F3',
        minorContour: '#D7D7D2',
        majorContour: '#11100E',
        minorOpacity: 0.42,
        majorOpacity: 0.92,
      },
    ] as const

    for (const expected of cases) {
      const theme = getThemeDefinition(expected.id)
      expect(theme).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
      const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

      expect(config.preset).toBe('radmaps-toner-light')
      expect(config.composition).toBe('modernist-block')
      expect(config.font_family).toBe('Big Shoulders Display')
      expect(config.body_font_family).toBe(expected.body)
      expect(config.show_roads).toBe(false)
      expect(config.show_place_labels).toBe(false)
      expect(config.show_poi_labels).toBe(false)
      expect(config.show_hillshade).toBe(false)
      expect(config.show_grid).toBe(false)
      expect(config.show_start_pin).toBe(true)
      expect(config.show_finish_pin).toBe(true)
      expect(config.pin_color).toBe(expected.pin)
      expect(config.pin_opacity).toBe(1)
      expect(config.route_color).toBe(expected.route)
      expect(config.route_width).toBe(expected.width)
      expect(config.route_opacity).toBe(0.9)
      expect(layerById(style, 'background')?.paint?.['background-color']).toBe(expected.land)
      expect(layerById(style, 'radmaps-toner-light-landcover')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-water')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-waterway')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-roads-major')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-roads-minor')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-place-labels')).toBeUndefined()
      expect(layerById(style, 'radmaps-toner-light-poi-labels')).toBeUndefined()
      expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe(expected.minorContour)
      expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
        'interpolate', ['linear'], ['zoom'], 5, expected.minorOpacity, 14, expected.minorOpacity * 0.9,
      ])
      expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe(expected.majorContour)
      expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(expected.majorOpacity)
      expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe(expected.route)
      expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(expected.width)
      expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
    }
  })

  it('renders Brutalist routes as GPX-source slab linework without route proof marks', () => {
    const theme = getThemeDefinition('brutalist')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token')

    expect(config.route_width).toBeGreaterThan(4.5)
    expect(layerById(style, 'route-line-brutalist-slab-shadow')?.source).toBe('route')
    expect(layerById(style, 'route-line-brutalist-cement-cut')?.source).toBe('route')
    expect(layerById(style, 'route-line-brutalist-proof-dashes')).toBeUndefined()
    expect(layerById(style, 'route-line-brutalist-proof-bars')).toBeUndefined()
    expect(layerIndex(style, 'route-line-brutalist-slab-shadow')).toBeLessThan(layerIndex(style, 'route-line-brutalist-cement-cut'))
    expect(layerIndex(style, 'route-line-brutalist-cement-cut')).toBeLessThan(layerIndex(style, 'route-line-casing'))
  })

  it('applies Brutalist map tokens as the concrete slab contract', () => {
    coverSemanticMapTokens('brutalist')
    const theme = getThemeDefinition('brutalist')
    expect(theme).toBeTruthy()

    const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)
    const style = buildMapStyle(config, 'mapbox-test-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(config.preset).toBe('radmaps-toner-light')
    expect(config.composition).toBe('brutalist-slab')
    expect(config.font_family).toBe('Bebas Neue')
    expect(config.body_font_family).toBe('IBM Plex Sans')
    expect(config.show_roads).toBe(false)
    expect(config.show_place_labels).toBe(false)
    expect(config.show_poi_labels).toBe(false)
    expect(config.show_hillshade).toBe(false)
    expect(config.show_grid).toBe(false)
    expect(config.show_start_pin).toBe(false)
    expect(config.show_finish_pin).toBe(false)
    expect(config.route_color).toBe('#FF3B00')
    expect(config.route_width).toBe(5.2)
    expect(config.route_opacity).toBe(0.96)
    expect(layerById(style, 'background')?.paint?.['background-color']).toBe('#D7D3CA')
    expect(layerById(style, 'radmaps-toner-light-landcover')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-water')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-waterway')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-park')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-roads-major')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-roads-minor')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-place-labels')).toBeUndefined()
    expect(layerById(style, 'radmaps-toner-light-poi-labels')).toBeUndefined()
    expect(layerById(style, 'contours-minor')?.paint?.['line-color']).toBe('#C2BFB5')
    expect(layerById(style, 'contours-minor')?.paint?.['line-opacity']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.22, 14, 0.22 * 0.9,
    ])
    expect(layerById(style, 'contours-minor')?.paint?.['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 0.62 * 0.8, 14, 0.62,
    ])
    expect(layerById(style, 'contours-major')?.paint?.['line-color']).toBe('#4C4740')
    expect(layerById(style, 'contours-major')?.paint?.['line-opacity']).toBe(0.42)
    expect(layerById(style, 'route-line')?.paint?.['line-color']).toBe('#FF3B00')
    expect(layerById(style, 'route-line')?.paint?.['line-width']).toBe(5.2)
    expect(layerById(style, 'route-line')?.paint?.['line-opacity']).toBe(0.96)
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
