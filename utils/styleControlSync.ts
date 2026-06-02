import type { StyleConfig, TrailSegment } from '~/types'

export type RouteLineControlField =
  | 'route_color'
  | 'route_width'
  | 'route_opacity'
  | 'route_smooth'
  | 'route_color_mode'

function segmentPatchForRouteLineControl<K extends RouteLineControlField>(
  key: K,
  value: StyleConfig[K],
): Partial<TrailSegment> {
  if (key === 'route_color') return { color: String(value) }
  if (key === 'route_width') return { width: Number(value) }
  if (key === 'route_opacity') return { opacity: Number(value) }
  if (key === 'route_smooth') return { smooth: Number(value) }
  if (key === 'route_color_mode') return { color_mode: value === 'gradient' ? 'gradient' : 'solid' }
  return {}
}

export function applyRouteLineControl<K extends RouteLineControlField>(
  config: StyleConfig,
  key: K,
  value: StyleConfig[K],
): StyleConfig {
  const next = {
    ...config,
    [key]: value,
  } as StyleConfig

  if (!config.trail_segments?.length) return next

  const segmentPatch = segmentPatchForRouteLineControl(key, value)
  return {
    ...next,
    trail_segments: config.trail_segments.map(segment => ({
      ...segment,
      ...segmentPatch,
    })),
  }
}
