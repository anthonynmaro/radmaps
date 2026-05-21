import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import {
  ALL_STYLE_PRESETS,
  assertGraphSlotOrder,
  effectiveStyleConfig,
  getGraphFullReloadFields,
  getPresetGraph,
  getVisibleStyleControls,
  styleFieldUpdateMode,
  styleUsesField,
} from '../utils/styleLayerGraph'
import { buildMapStyle } from '../utils/mapStyle'

function layerIds(style: object): string[] {
  return ((style as { layers?: Array<{ id?: string }> }).layers ?? []).map(layer => String(layer.id))
}

function graphLayerIds(preset: string): string[] {
  return getPresetGraph(preset).layers.map(layer => layer.id)
}

function layerById(style: object, id: string): { metadata?: { radmaps?: { scale?: string[] } } } | undefined {
  return (style as { layers?: Array<{ id: string; metadata?: { radmaps?: { scale?: string[] } } }> }).layers?.find(layer => layer.id === id)
}

function sourceIds(style: object): string[] {
  return Object.keys((style as { sources?: Record<string, unknown> }).sources ?? {})
}

describe('style layer graph contracts', () => {
  it('declares a graph for every current style preset', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      expect(getPresetGraph(preset).preset).toBe(preset)
    }
  })

  it('keeps every graph in canonical layer slot order', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      expect(assertGraphSlotOrder(getPresetGraph(preset))).toBe(true)
    }
  })

  it('keeps visible controls mapped to consumed or intentionally handled fields', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      const controls = getVisibleStyleControls(preset)
      for (const [field, control] of Object.entries(controls) as Array<[keyof StyleConfig, { visible: boolean }]>) {
        if (control.visible) {
          expect(styleUsesField(preset, field), `${preset}.${field}`).toBe(true)
        }
      }
    }
  })

  it('does not expose baked-only or unsupported map-detail controls', () => {
    expect(getVisibleStyleControls('topographic').roads_opacity?.visible).toBe(false)
    expect(getVisibleStyleControls('topographic').place_labels_opacity?.visible).toBe(false)
    expect(getVisibleStyleControls('topographic').water_color?.visible).toBe(false)
    expect(getVisibleStyleControls('native-watercolor').show_poi_labels?.visible).toBe(false)
    expect(getVisibleStyleControls('minimalist').show_poi_labels?.visible).toBe(false)
    expect(getVisibleStyleControls('contour-art').show_roads?.visible).toBe(true)
  })

  it('does not expose destructive toggles for required preset features', () => {
    const controls = getVisibleStyleControls('contour-art')
    expect(controls.show_contours?.visible).toBe(false)

    const effective = effectiveStyleConfig({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_contours: false,
    })
    expect(effective.show_contours).toBe(true)
  })

  it('exposes hillshade for contour art presets', () => {
    const controls = getVisibleStyleControls('contour-art')
    expect(controls.show_hillshade?.visible).toBe(true)
    expect(styleFieldUpdateMode('contour-art', 'show_hillshade')).toBe('full-reload')
    expect(controls.hillshade_intensity?.visible).toBe(true)
    expect(styleFieldUpdateMode('contour-art', 'hillshade_intensity')).toBe('paint')
    expect(controls.hillshade_highlight?.visible).toBe(false)
    expect(styleFieldUpdateMode('contour-art', 'hillshade_highlight')).toBe('ignored')
  })

  it('ignores unsupported saved values without deleting the stored intent', () => {
    const saved: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'topographic',
      show_roads: true,
      roads_opacity: 0.2,
      show_poi_labels: true,
    }
    const effective = effectiveStyleConfig(saved)

    expect(saved.show_roads).toBe(true)
    expect(saved.roads_opacity).toBe(0.2)
    expect(saved.show_poi_labels).toBe(true)
    expect(effective.show_roads).toBe(false)
    expect(effective.show_poi_labels).toBe(false)
  })

  it('resolves dependency update modes from the graph', () => {
    expect(styleFieldUpdateMode('native-toner', 'show_roads')).toBe('full-reload')
    expect(styleFieldUpdateMode('native-toner', 'roads_opacity')).toBe('paint')
    expect(styleFieldUpdateMode('native-toner', 'tile_effect')).toBe('ignored')
    expect(styleFieldUpdateMode('minimalist', 'route_width')).toBe('paint')
    expect(styleFieldUpdateMode('natural-topo', 'hillshade_intensity')).toBe('paint')
    expect(styleFieldUpdateMode('contour-art', 'contour_color')).toBe('paint')
    expect(styleFieldUpdateMode('contour-art', 'contour_major_color')).toBe('paint')
    expect(styleFieldUpdateMode('contour-art', 'contour_opacity')).toBe('paint')
    expect(styleFieldUpdateMode('contour-art', 'contour_detail')).toBe('full-reload')
    expect(getGraphFullReloadFields('contour-art')).not.toContain('hillshade_intensity')
    expect(getGraphFullReloadFields('contour-art')).not.toContain('contour_color')
  })

  it('keeps paint-only controls out of full reload dependencies', () => {
    const paintOnlyFields: Array<keyof StyleConfig> = [
      'roads_color',
      'roads_opacity',
      'place_labels_color',
      'place_labels_opacity',
      'poi_labels_color',
      'poi_labels_opacity',
      'water_color',
      'contour_color',
      'contour_major_color',
      'contour_opacity',
      'contour_minor_width',
      'contour_major_width',
      'hillshade_intensity',
      'tile_contrast',
      'tile_saturation',
      'tile_hue_rotate',
    ]

    for (const preset of ALL_STYLE_PRESETS) {
      const reloadFields = getGraphFullReloadFields(preset)
      for (const field of paintOnlyFields) {
        if (styleFieldUpdateMode(preset, field) === 'paint') {
          expect(reloadFields, `${preset}.${field}`).not.toContain(field)
        }
      }
    }
  })

  it('declares waterway layers only for vector-water presets', () => {
    expect(graphLayerIds('contour-art')).toContain('contour-art-waterways')
    expect(graphLayerIds('road-network')).toContain('rn-waterways')
    expect(graphLayerIds('native-toner')).toContain('nt-waterways')

    for (const preset of ALL_STYLE_PRESETS) {
      if (getPresetGraph(preset).features.water === 'editable-vector' || getPresetGraph(preset).features.water === 'required') continue
      expect(graphLayerIds(preset).filter(id => id.includes('waterway')), preset).toEqual([])
    }
  })

  it('keeps waterway styling inside existing water controls', () => {
    expect(getVisibleStyleControls('contour-art').water_color?.visible).toBe(true)
    expect(getVisibleStyleControls('road-network').water_color?.visible).toBe(true)
    expect(getVisibleStyleControls('native-toner').water_color?.visible).toBe(false)
    expect(styleUsesField('contour-art', 'water_color')).toBe(true)
    expect(styleUsesField('road-network', 'water_color')).toBe(true)
  })
})

describe('style JSON matrix', () => {
  it('removes unsupported vector overlays from baked raster presets', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'topographic',
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: true,
    }, 'mapbox-token')

    expect(layerIds(style)).not.toContain('roads-major')
    expect(layerIds(style)).not.toContain('roads-place-labels')
    expect(layerIds(style)).not.toContain('roads-poi-labels')
  })

  it('keeps editable roads for vector presets that genuinely own those layers', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'native-toner',
      show_roads: true,
      roads_opacity: 0.5,
    }, 'mapbox-token')

    expect(layerIds(style)).toContain('nt-street')
    expect(layerIds(style)).toContain('nt-motorway')
  })

  it('keeps contour art contours even when saved intent says they are hidden', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_contours: false,
    }, 'mapbox-token')

    expect(layerIds(style)).toContain('contours-minor')
    expect(layerIds(style)).toContain('contours-major')
  })

  it('uses browser-generated contours for Atlas presets when MapPreview provides the contour protocol', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'radmaps-field-topo',
      show_contours: true,
      show_elevation_labels: true,
    }, 'mapbox-token', undefined, 'contour://dem/{z}/{x}/{y}')

    expect(sourceIds(style)).toContain('contours')
    expect(sourceIds(style)).not.toContain('radmaps-atlas-contours')
    expect(sourceIds(style)).not.toContain('mapbox-terrain-v2')
    expect(layerIds(style)).toContain('contours-ghost-texture')
    expect(layerIds(style)).toContain('contours-minor')
    expect(layerIds(style)).toContain('contours-mid')
    expect(layerIds(style)).toContain('contours-major')
  })

  it('keeps optional roads, labels, and POIs editable for contour art presets', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_roads: true,
      show_place_labels: true,
      show_poi_labels: true,
    }, 'mapbox-token')

    expect(layerIds(style)).toContain('roads-major')
    expect(layerIds(style)).toContain('roads-place-labels')
    expect(layerIds(style)).toContain('roads-poi-labels')
  })

  it('lets contour art labels remain independent from the road-line toggle', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_roads: false,
      show_place_labels: true,
      show_poi_labels: true,
    }, 'mapbox-token')

    expect(layerIds(style)).not.toContain('roads-major')
    expect(layerIds(style)).toContain('roads-place-labels')
    expect(layerIds(style)).toContain('roads-poi-labels')
  })

  it('renders contour art hillshade when enabled', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'contour-art',
      show_hillshade: true,
      hillshade_intensity: 0.8,
    }, 'mapbox-token')

    expect(layerIds(style)).toContain('hillshade')
  })

  it('keeps graph hillshade support in sync with generated style layers', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      const graph = getPresetGraph(preset)
      const style = buildMapStyle({
        ...DEFAULT_STYLE_CONFIG,
        preset,
        show_hillshade: true,
      }, 'mapbox-token')
      const rendersHillshade = layerIds(style).includes('hillshade')
      expect(rendersHillshade, preset).toBe(graph.features.hillshade === 'editable-vector')
    }
  })

  it('keeps declared graph layers in sync with generated style layers', () => {
    for (const preset of ALL_STYLE_PRESETS) {
      const graph = getPresetGraph(preset)
      const style = buildMapStyle({
        ...DEFAULT_STYLE_CONFIG,
        preset,
        show_contours: true,
        show_hillshade: true,
        show_roads: true,
        show_place_labels: true,
        show_poi_labels: true,
        show_elevation_labels: true,
      }, 'mapbox-token')
      const generatedLayerIds = layerIds(style)
      for (const graphLayer of graph.layers) {
        if (graphLayer.source === 'route') continue
        expect(generatedLayerIds, `${preset}.${graphLayer.id}`).toContain(graphLayer.id)
      }
    }
  })

  it('writes viewport scale metadata from graph layer declarations', () => {
    const style = buildMapStyle({
      ...DEFAULT_STYLE_CONFIG,
      preset: 'road-network',
      show_roads: true,
    }, 'mapbox-token')

    expect(layerById(style, 'rn-street')?.metadata?.radmaps?.scale).toContain('line-width')
    expect(layerById(style, 'route-line')?.metadata?.radmaps?.scale).toContain('line-width')
  })
})
