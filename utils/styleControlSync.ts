import type { StyleConfig, TrailSegment } from '~/types'

export type RouteLineControlField =
  | 'route_color'
  | 'route_width'
  | 'route_opacity'
  | 'route_smooth'
  | 'route_color_mode'

export interface RouteLineControlOptions {
  /**
   * Editor-v2 (FLAGS.EDITOR_V2) sticky-segment semantics, mirroring the E1
   * theme-ownership value-comparison pattern (utils/themeFieldOwnership.ts):
   * a route-control change propagates to a segment ONLY while that segment's
   * corresponding field still matches what bulk sync would have given it —
   * i.e. it is unset (inheriting) or equals the OUTGOING global value. A
   * segment the user styled individually (E4 segment toolbar) no longer
   * matches and is left untouched. No marker field, no schema change: the
   * "individually styled" signal is derived purely by value comparison.
   *
   * Default (false / flag off) keeps the legacy bulk overwrite byte-identical.
   */
  stickySegments?: boolean
}

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

/** True while the segment's field still tracks the outgoing global value (never individually styled). */
function segmentFollowsRouteControl(
  segment: TrailSegment,
  outgoingPatch: Partial<TrailSegment>,
): boolean {
  return (Object.keys(outgoingPatch) as Array<keyof TrailSegment>).every((field) => {
    const current = segment[field]
    return current == null || current === outgoingPatch[field]
  })
}

export function applyRouteLineControl<K extends RouteLineControlField>(
  config: StyleConfig,
  key: K,
  value: StyleConfig[K],
  options: RouteLineControlOptions = {},
): StyleConfig {
  const next = {
    ...config,
    [key]: value,
  } as StyleConfig

  if (!config.trail_segments?.length) return next

  const segmentPatch = segmentPatchForRouteLineControl(key, value)

  if (!options.stickySegments) {
    return {
      ...next,
      trail_segments: config.trail_segments.map(segment => ({
        ...segment,
        ...segmentPatch,
      })),
    }
  }

  const outgoingPatch = segmentPatchForRouteLineControl(key, config[key])
  return {
    ...next,
    trail_segments: config.trail_segments.map(segment =>
      segmentFollowsRouteControl(segment, outgoingPatch)
        ? { ...segment, ...segmentPatch }
        : segment,
    ),
  }
}
