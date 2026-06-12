import type { AtlasLayerSettings, StyleConfig, TrailSegment } from '~/types'

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

// ─── Contour control sync (editor-v2 E6a: one write path for two stores) ──────
//
// Contour styling intent lives in TWO StyleConfig stores:
//   1. legacy top-level `contour_*` fields + `show_elevation_labels`
//   2. `atlas_layer_settings.contour.*`
//
// The legacy fields are GENUINELY consumed by buildMapStyle — directly for the
// non-atlas presets (topographic/art contour layers read config.contour_* with
// no atlas fallback), and as the explicit-override branch of atlas style
// resolution (mapStyle.ts resolveAtlas*: an explicit non-default contour_*
// value beats atlas_layer_settings.contour). They therefore cannot be demoted
// to a read-only mirror without a render change, and per the
// effectiveStyleConfig posture saved fields are preserved, never deleted.
// Resolution: keep writing both stores, but ONLY from the paired functions
// below — StylePanel's terrain card and atlas layer card both route through
// them, so the two stores can no longer drift (drift previously let a stale
// explicit legacy value silently override fresh atlas-card edits).

export type ContourControlField =
  | 'contour_color'
  | 'contour_major_color'
  | 'contour_opacity'
  | 'contour_minor_width'
  | 'contour_major_width'

export type AtlasContourSettings = NonNullable<AtlasLayerSettings['contour']>

export interface ContourControlOptions {
  /** Atlas preset active → mirror the change into atlas_layer_settings.contour. */
  atlasActive?: boolean
}

/** Legacy contour field → atlas_layer_settings.contour patch (exact legacy StylePanel mapping). */
function atlasContourPatchForContourControl<K extends ContourControlField>(
  key: K,
  value: StyleConfig[K],
): Partial<AtlasContourSettings> {
  if (key === 'contour_color') return { minor_color: value as string }
  if (key === 'contour_major_color') return { major_color: value as string, index_color: value as string }
  if (key === 'contour_opacity') return { minor_opacity: value as number, major_opacity: value as number }
  if (key === 'contour_minor_width') return { minor_width: value as number }
  if (key === 'contour_major_width') return { major_width: value as number, index_width: value as number }
  return {}
}

function withAtlasContourPatch(config: StyleConfig, patch: Partial<AtlasContourSettings>): StyleConfig {
  return {
    ...config,
    atlas_layer_settings: {
      ...(config.atlas_layer_settings ?? {}),
      contour: {
        ...(config.atlas_layer_settings?.contour ?? {}),
        ...patch,
      },
    },
  }
}

/** Terrain-card direction: legacy `contour_*` field write + atlas mirror when an atlas preset is active. */
export function applyContourControl<K extends ContourControlField>(
  config: StyleConfig,
  key: K,
  value: StyleConfig[K],
  options: ContourControlOptions = {},
): StyleConfig {
  const next = { ...config, [key]: value } as StyleConfig
  if (!options.atlasActive) return next
  return withAtlasContourPatch(next, atlasContourPatchForContourControl(key, value))
}

/** Terrain-card elevation labels toggle: `show_elevation_labels` + atlas `labels` mirror. */
export function applyContourLabelsControl(
  config: StyleConfig,
  enabled: boolean,
  options: ContourControlOptions = {},
): StyleConfig {
  const next = { ...config, show_elevation_labels: enabled }
  if (!options.atlasActive) return next
  return withAtlasContourPatch(next, { labels: enabled })
}

/** atlas_layer_settings.contour patch → legacy field mirror (reverse direction). */
function legacyPatchForAtlasContourSettings(patch: Partial<AtlasContourSettings>): Partial<StyleConfig> {
  const legacy: Partial<StyleConfig> = {}
  if (patch.minor_color !== undefined) legacy.contour_color = patch.minor_color
  const majorColor = patch.major_color ?? patch.index_color
  if (majorColor !== undefined) legacy.contour_major_color = majorColor
  if (patch.minor_opacity !== undefined) legacy.contour_opacity = patch.minor_opacity
  if (patch.minor_width !== undefined) legacy.contour_minor_width = patch.minor_width
  const majorWidth = patch.major_width ?? patch.index_width
  if (majorWidth !== undefined) legacy.contour_major_width = majorWidth
  if (patch.labels !== undefined) legacy.show_elevation_labels = patch.labels
  return legacy
}

/**
 * Atlas-card direction (FLAGS.EDITOR_V2): write atlas_layer_settings.contour
 * AND keep the consumed legacy fields in sync, so explicit-override resolution
 * in buildMapStyle reflects the user's latest edit instead of a stale value.
 */
export function applyAtlasContourSettings(
  config: StyleConfig,
  patch: Partial<AtlasContourSettings>,
): StyleConfig {
  return withAtlasContourPatch(
    { ...config, ...legacyPatchForAtlasContourSettings(patch) },
    patch,
  )
}
