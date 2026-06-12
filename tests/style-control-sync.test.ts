import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig, type TrailSegment } from '~/types'
import { applyRouteLineControl } from '~/utils/styleControlSync'

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
