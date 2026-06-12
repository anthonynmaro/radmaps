import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig, type TrailSegment } from '~/types'
import {
  applyAtlasContourSettings,
  applyContourControl,
  applyContourLabelsControl,
  applyRouteLineControl,
} from '~/utils/styleControlSync'

function segment(patch: Partial<TrailSegment> = {}): TrailSegment {
  return {
    id: patch.id ?? 'segment-1',
    name: patch.name ?? 'Segment',
    color: patch.color ?? '#C1121F',
    visible: patch.visible ?? true,
    section_start: patch.section_start ?? 0,
    section_end: patch.section_end ?? 100,
    width: patch.width,
    opacity: patch.opacity,
    smooth: patch.smooth,
    color_mode: patch.color_mode,
  }
}

function config(patch: Partial<StyleConfig> = {}): StyleConfig {
  return {
    ...DEFAULT_STYLE_CONFIG,
    ...patch,
    labels: {
      ...DEFAULT_STYLE_CONFIG.labels,
      ...patch.labels,
    },
  }
}

describe('style control synchronization', () => {
  it('updates the root route width when no named trail segments are present', () => {
    const input = config({ route_width: 2, trail_segments: undefined })

    const next = applyRouteLineControl(input, 'route_width', 4)

    expect(next.route_width).toBe(4)
    expect(next.trail_segments).toBeUndefined()
    expect(input.route_width).toBe(2)
  })

  it('propagates route width changes to visible named segment linework', () => {
    const input = config({
      route_width: 2,
      trail_segments: [
        segment({ id: 'a', width: 6 }),
        segment({ id: 'b', width: 3 }),
      ],
    })

    const next = applyRouteLineControl(input, 'route_width', 1.5)

    expect(next.route_width).toBe(1.5)
    expect(next.trail_segments?.map(s => s.width)).toEqual([1.5, 1.5])
    expect(input.trail_segments?.map(s => s.width)).toEqual([6, 3])
  })

  it('keeps the global route color and opacity controls visible on segmented maps', () => {
    const input = config({
      route_color: '#111111',
      route_opacity: 0.4,
      trail_segments: [
        segment({ id: 'a', color: '#C1121F', opacity: 0.7 }),
        segment({ id: 'b', color: '#2D6A4F', opacity: 0.5 }),
      ],
    })

    const colored = applyRouteLineControl(input, 'route_color', '#F4B942')
    const faded = applyRouteLineControl(colored, 'route_opacity', 0.82)

    expect(colored.route_color).toBe('#F4B942')
    expect(colored.trail_segments?.map(s => s.color)).toEqual(['#F4B942', '#F4B942'])
    expect(faded.route_opacity).toBe(0.82)
    expect(faded.trail_segments?.map(s => s.opacity)).toEqual([0.82, 0.82])
  })

  it('keeps route smooth and gradient controls visible on segmented maps', () => {
    const input = config({
      route_smooth: 0,
      route_color_mode: 'solid',
      trail_segments: [
        segment({ id: 'a', smooth: 0, color_mode: 'solid' }),
        segment({ id: 'b', smooth: 2, color_mode: 'solid' }),
      ],
    })

    const smoothed = applyRouteLineControl(input, 'route_smooth', 5)
    const gradient = applyRouteLineControl(smoothed, 'route_color_mode', 'gradient')

    expect(smoothed.route_smooth).toBe(5)
    expect(smoothed.trail_segments?.map(s => s.smooth)).toEqual([5, 5])
    expect(gradient.route_color_mode).toBe('gradient')
    expect(gradient.trail_segments?.map(s => s.color_mode)).toEqual(['gradient', 'gradient'])
  })
})

// Editor-v2 (FLAGS.EDITOR_V2) sticky-segment semantics: segments are user-owned;
// route controls only propagate to segments still tracking the global value.
describe('sticky segment synchronization (editor-v2)', () => {
  const sticky = { stickySegments: true } as const

  it('flag off stays the exact legacy bulk overwrite (default options)', () => {
    const input = config({
      route_color: '#111111',
      trail_segments: [segment({ id: 'a', color: '#C1121F' }), segment({ id: 'b', color: '#111111' })],
    })

    const next = applyRouteLineControl(input, 'route_color', '#F4B942')

    expect(next.trail_segments?.map(s => s.color)).toEqual(['#F4B942', '#F4B942'])
  })

  it('still bulk-syncs segments that track the outgoing global value', () => {
    const input = config({
      route_width: 2,
      trail_segments: [
        segment({ id: 'in-sync', width: 2 }),
        segment({ id: 'unset', width: undefined }),
      ],
    })

    const next = applyRouteLineControl(input, 'route_width', 4, sticky)

    expect(next.route_width).toBe(4)
    expect(next.trail_segments?.map(s => s.width)).toEqual([4, 4])
  })

  it('an individually-recolored segment survives a route color change', () => {
    const input = config({
      route_color: '#111111',
      trail_segments: [
        segment({ id: 'custom', color: '#7B3F8D' }), // E4 toolbar recolor
        segment({ id: 'in-sync', color: '#111111' }),
      ],
    })

    const next = applyRouteLineControl(input, 'route_color', '#F4B942', sticky)

    expect(next.route_color).toBe('#F4B942')
    expect(next.trail_segments?.map(s => s.color)).toEqual(['#7B3F8D', '#F4B942'])
  })

  it('stickiness is per-field: custom color does not block width sync', () => {
    const input = config({
      route_color: '#111111',
      route_width: 2,
      trail_segments: [segment({ id: 'custom-color', color: '#7B3F8D', width: 2 })],
    })

    const widthChanged = applyRouteLineControl(input, 'route_width', 3.5, sticky)
    const colorChanged = applyRouteLineControl(widthChanged, 'route_color', '#F4B942', sticky)

    expect(widthChanged.trail_segments?.[0].width).toBe(3.5)
    expect(widthChanged.trail_segments?.[0].color).toBe('#7B3F8D')
    expect(colorChanged.trail_segments?.[0].color).toBe('#7B3F8D')
  })

  it('individually-set opacity, smooth, and color mode survive route control changes', () => {
    const input = config({
      route_opacity: 0.9,
      route_smooth: 0,
      route_color_mode: 'solid',
      trail_segments: [
        segment({ id: 'custom', opacity: 0.4, smooth: 7, color_mode: 'gradient' }),
        segment({ id: 'in-sync', opacity: 0.9, smooth: 0, color_mode: 'solid' }),
      ],
    })

    const faded = applyRouteLineControl(input, 'route_opacity', 0.6, sticky)
    const smoothed = applyRouteLineControl(faded, 'route_smooth', 3, sticky)
    const gradient = applyRouteLineControl(smoothed, 'route_color_mode', 'gradient', sticky)

    expect(gradient.trail_segments?.[0]).toMatchObject({ opacity: 0.4, smooth: 7, color_mode: 'gradient' })
    expect(gradient.trail_segments?.[1]).toMatchObject({ opacity: 0.6, smooth: 3, color_mode: 'gradient' })
  })

  it('a synced-then-customized segment stops following later changes', () => {
    const input = config({
      route_color: '#111111',
      trail_segments: [segment({ id: 'a', color: '#111111' })],
    })

    // Follows the first global change while in sync…
    const first = applyRouteLineControl(input, 'route_color', '#F4B942', sticky)
    expect(first.trail_segments?.[0].color).toBe('#F4B942')

    // …user recolors it individually (E4 toolbar)…
    const customized = {
      ...first,
      trail_segments: first.trail_segments!.map(s => ({ ...s, color: '#2D6A4F' })),
    }

    // …and it no longer follows the global control.
    const second = applyRouteLineControl(customized, 'route_color', '#3A7CA5', sticky)
    expect(second.route_color).toBe('#3A7CA5')
    expect(second.trail_segments?.[0].color).toBe('#2D6A4F')
  })

  it('always updates the root route fields even when every segment is custom', () => {
    const input = config({
      route_width: 2,
      trail_segments: [segment({ id: 'a', width: 6 })],
    })

    const next = applyRouteLineControl(input, 'route_width', 1.5, sticky)

    expect(next.route_width).toBe(1.5)
    expect(next.trail_segments?.[0].width).toBe(6)
    expect(input.trail_segments?.[0].width).toBe(6)
  })
})

// E6a: contour intent has two StyleConfig stores (legacy contour_* fields +
// atlas_layer_settings.contour) because buildMapStyle genuinely consumes both.
// These functions are the ONLY write path; both StylePanel cards route here.
describe('contour control synchronization', () => {
  it('writes only the legacy field when no atlas preset is active (legacy terrain-card behavior)', () => {
    const input = config({ contour_color: '#111111', atlas_layer_settings: undefined })

    const next = applyContourControl(input, 'contour_color', '#8B875E')

    expect(next.contour_color).toBe('#8B875E')
    expect(next.atlas_layer_settings).toBeUndefined()
    expect(input.contour_color).toBe('#111111')
  })

  it('mirrors terrain-card edits into atlas_layer_settings.contour with the exact legacy key mapping', () => {
    const atlas = { atlasActive: true } as const
    let next = config({ atlas_layer_settings: { contour: { interval: 'auto' as const } } })

    next = applyContourControl(next, 'contour_color', '#8B875E', atlas)
    next = applyContourControl(next, 'contour_major_color', '#68653F', atlas)
    next = applyContourControl(next, 'contour_opacity', 0.42, atlas)
    next = applyContourControl(next, 'contour_minor_width', 0.8, atlas)
    next = applyContourControl(next, 'contour_major_width', 1.6, atlas)

    expect(next).toMatchObject({
      contour_color: '#8B875E',
      contour_major_color: '#68653F',
      contour_opacity: 0.42,
      contour_minor_width: 0.8,
      contour_major_width: 1.6,
    })
    expect(next.atlas_layer_settings?.contour).toEqual({
      interval: 'auto', // untouched settings preserved
      minor_color: '#8B875E',
      major_color: '#68653F',
      index_color: '#68653F',
      minor_opacity: 0.42,
      major_opacity: 0.42, // contour_opacity maps to minor+major only (legacy parity, no index_opacity)
      minor_width: 0.8,
      major_width: 1.6,
      index_width: 1.6,
    })
  })

  it('syncs the elevation labels toggle into atlas labels only when atlas is active', () => {
    const input = config({ show_elevation_labels: false, atlas_layer_settings: undefined })

    const plain = applyContourLabelsControl(input, true)
    expect(plain.show_elevation_labels).toBe(true)
    expect(plain.atlas_layer_settings).toBeUndefined()

    const atlas = applyContourLabelsControl(input, true, { atlasActive: true })
    expect(atlas.show_elevation_labels).toBe(true)
    expect(atlas.atlas_layer_settings?.contour?.labels).toBe(true)
  })

  it('atlas-card edits mirror back into the consumed legacy fields (editor-v2 single write path)', () => {
    const input = config({
      contour_color: '#STALE1',
      contour_major_color: '#STALE2',
      contour_opacity: 0.9,
      atlas_layer_settings: { water: { fill_color: '#79B7C8' }, contour: { minor_width: 0.7 } },
    })

    const next = applyAtlasContourSettings(input, {
      minor_color: '#8B875E',
      major_color: '#68653F',
      index_color: '#68653F',
      minor_opacity: 0.42,
      index_opacity: 0.42,
      major_opacity: 0.42,
    })

    // Atlas store written, untouched layers/settings preserved
    expect(next.atlas_layer_settings?.water).toEqual({ fill_color: '#79B7C8' })
    expect(next.atlas_layer_settings?.contour).toMatchObject({ minor_width: 0.7, minor_color: '#8B875E', major_opacity: 0.42 })
    // Legacy mirror updated so explicit-override resolution can't go stale
    expect(next.contour_color).toBe('#8B875E')
    expect(next.contour_major_color).toBe('#68653F')
    expect(next.contour_opacity).toBe(0.42)
    expect(input.contour_color).toBe('#STALE1')
  })

  it('atlas-card label and width edits mirror to show_elevation_labels and contour widths', () => {
    const input = config({ show_elevation_labels: true, contour_minor_width: 1, contour_major_width: 1.2 })

    const next = applyAtlasContourSettings(input, { labels: false, minor_width: 0.6, major_width: 2, index_width: 2 })

    expect(next.show_elevation_labels).toBe(false)
    expect(next.contour_minor_width).toBe(0.6)
    expect(next.contour_major_width).toBe(2)
  })

  it('partial atlas patches leave unrelated legacy fields untouched', () => {
    const input = config({ contour_color: '#111111', contour_opacity: 0.5, show_elevation_labels: true })

    const next = applyAtlasContourSettings(input, { minor_color: '#8B875E' })

    expect(next.contour_color).toBe('#8B875E')
    expect(next.contour_opacity).toBe(0.5)
    expect(next.show_elevation_labels).toBe(true)
  })
})
