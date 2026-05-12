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

function layerById(style: object, id: string): { metadata?: { radmaps?: { scale?: string[] } } } | undefined {
  return (style as { layers?: Array<{ id: string; metadata?: { radmaps?: { scale?: string[] } } }> }).layers?.find(layer => layer.id === id)
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
    expect(styleFieldUpdateMode('native-toner', 'roads_opacity')).toBe('full-reload')
    expect(styleFieldUpdateMode('native-toner', 'tile_effect')).toBe('ignored')
    expect(styleFieldUpdateMode('minimalist', 'route_width')).toBe('paint')
    expect(getGraphFullReloadFields('contour-art')).toContain('contour_color')
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
