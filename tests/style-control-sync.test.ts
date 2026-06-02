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
