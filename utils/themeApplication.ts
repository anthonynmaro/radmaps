import { DEFAULT_STYLE_CONFIG, DEFAULT_TRAIL_SEGMENT_WIDTH, type FontFamily, type PosterTextOverride, type PosterTextOverrides, type StyleConfig, type ThemeDefinition } from '~/types'
import { STICKY_STYLE_FIELDS, USER_OWNED_STYLE_FIELDS } from '~/utils/themeFieldOwnership'
import { getThemeDefinition } from '~/utils/themes/refined'

const FONT_PAIRINGS: Record<FontFamily, FontFamily> = {
  'Source Sans 3': 'Source Sans 3',
  'Source Serif 4': 'Source Sans 3',
  'IBM Plex Sans': 'IBM Plex Sans',
  'IBM Plex Mono': 'IBM Plex Mono',
  'Atkinson Hyperlegible Next': 'Atkinson Hyperlegible Next',
  'Newsreader': 'Source Serif 4',
  'Big Shoulders Display': 'DM Sans',
  'Fjalla One': 'Work Sans',
  'Oswald': 'Work Sans',
  'Bebas Neue': 'DM Sans',
  'DM Sans': 'DM Sans',
  'Space Grotesk': 'Space Grotesk',
  'Outfit': 'Outfit',
  'Work Sans': 'Work Sans',
  'Playfair Display': 'Libre Baskerville',
  'Cormorant Garamond': 'Libre Baskerville',
  'Libre Baskerville': 'Libre Baskerville',
  'DM Serif Display': 'DM Sans',
}

// Exported so the theme-ownership registry tests can prove every reset field is
// classified (tests/theme-field-ownership.test.ts). Do not add a field here without
// classifying it in utils/themeFieldOwnership.ts.
export const THEME_RESET_FIELDS = {
  roads_color: undefined,
  place_labels_color: undefined,
  poi_labels_color: undefined,
  pin_color: undefined,
  pin_opacity: undefined,
  pin_font_family: undefined,
  start_pin_lnglat: undefined,
  finish_pin_lnglat: undefined,
  start_label_lnglat: undefined,
  finish_label_lnglat: undefined,
  start_pin_label: undefined,
  finish_pin_label: undefined,
  show_elevation_profile: false,
  elevation_profile_color: undefined,
  elevation_profile_opacity: undefined,
  elevation_profile_height: undefined,
  elevation_profile_position: undefined,
  elevation_profile_relief: undefined,
  trail_label_style: undefined,
  leader_label_scale: undefined,
  leader_label_auto_fit: undefined,
  leader_label_font_family: undefined,
  segment_casing_color: undefined,
  segment_casing_width: undefined,
  route_smooth: undefined,
  route_color_mode: 'solid',
  tile_shadow_color: undefined,
  tile_midtone_color: undefined,
  tile_highlight_color: undefined,
  tile_effect: 'none',
  tile_duotone_strength: undefined,
  tile_posterize_levels: undefined,
  tile_grain: DEFAULT_STYLE_CONFIG.tile_grain,
  tile_contrast: undefined,
  tile_saturation: undefined,
  tile_hue_rotate: undefined,
  show_vignette: false,
  vignette_intensity: undefined,
  map_3d: false,
  map_pitch: DEFAULT_STYLE_CONFIG.map_pitch,
  map_bearing: DEFAULT_STYLE_CONFIG.map_bearing,
  terrain_exaggeration: DEFAULT_STYLE_CONFIG.terrain_exaggeration,
  toner_variant: undefined,
  atlas_layers: undefined,
  atlas_layer_settings: undefined,
  grid_color: undefined,
  grid_opacity: 0.2,
  grid_weight: 1,
  grid_spacing: DEFAULT_STYLE_CONFIG.grid_spacing,
  grid_scope: 'poster',
  title_scale: 1,
  occasion_scale: 1,
  subtitle_scale: 1,
  show_start_pin: false,
  show_finish_pin: false,
  poster_layout: undefined,
} satisfies Partial<StyleConfig>

function stripThemeOwnedTextOverride(override: PosterTextOverride): PosterTextOverride | undefined {
  const next: PosterTextOverride = {}
  if (override.text != null) next.text = override.text
  if (override.approved_placeholder != null) next.approved_placeholder = override.approved_placeholder
  if (override.approved_placeholder_at != null) next.approved_placeholder_at = override.approved_placeholder_at
  return Object.keys(next).length ? next : undefined
}

export function stripThemeOwnedTextOverrides(overrides?: PosterTextOverrides): PosterTextOverrides | undefined {
  if (!overrides) return undefined

  const next: PosterTextOverrides = {}
  for (const [slot, override] of Object.entries(overrides)) {
    if (!override) continue
    const textOnly = stripThemeOwnedTextOverride(override)
    if (textOnly) next[slot as keyof PosterTextOverrides] = textOnly
  }

  return Object.keys(next).length ? next : undefined
}

function stripThemeOwnedTrailSegmentState(segments?: StyleConfig['trail_segments']): StyleConfig['trail_segments'] | undefined {
  if (!segments?.length) return segments
  return segments.map(segment => {
    const { label_lnglat: _labelLngLat, ...rest } = segment
    return rest
  })
}

export interface ApplyThemeOptions {
  /**
   * FLAGS.EDITOR_V2 behavior (docs/STYLE_SYSTEM_EVOLUTION.md "Theme switching must
   * preserve user intent"): user-owned fields always survive, sticky fields survive
   * when manually changed from the outgoing theme's default. Default false = exact
   * legacy clobber behavior.
   */
  preserveUserIntent?: boolean
  /**
   * Explicit outgoing theme for sticky comparisons. Defaults to looking up
   * `current.color_theme`; unknown/missing themes fall back to DEFAULT_STYLE_CONFIG
   * as the baseline (which preserves any value that differs from stock defaults).
   */
  previousTheme?: ThemeDefinition
}

export interface ThemeApplicationResult {
  config: StyleConfig
  /** Fields the user had customized that survived the switch (flag-on only). */
  preservedFields: string[]
  /** Fields whose value changed as part of applying the new theme. */
  resetFields: string[]
}

/**
 * Legacy theme application: resets every THEME_RESET_FIELDS entry, strips per-slot
 * visual text overrides and dragged segment labels, then applies the theme patch.
 * This is the flag-off behavior and the basis of `resetAllToTheme()`.
 */
function buildLegacyThemedConfig(current: StyleConfig, theme: ThemeDefinition): StyleConfig {
  const trailSegments = stripThemeOwnedTrailSegmentState(current.trail_segments)
  const patch: Partial<StyleConfig> = {
    ...THEME_RESET_FIELDS,
    color_theme: theme.id,
    background_color: theme.background_color,
    label_bg_color: theme.label_bg_color,
    label_text_color: theme.label_text_color,
    route_color: theme.route_color,
    water_color: theme.water_color,
    land_color: theme.land_color,
    base_tile_style: theme.base_tile_style,
    contour_color: theme.contour_color,
    contour_major_color: theme.contour_major_color,
    composition: theme.composition,
    audience: theme.audience,
    dark: theme.dark,
    show_grid: theme.show_grid,
    trail_segments: trailSegments,
    poster_text_overrides: stripThemeOwnedTextOverrides(current.poster_text_overrides),
    title_size: DEFAULT_STYLE_CONFIG.title_size,
    subtitle_size: DEFAULT_STYLE_CONFIG.subtitle_size,
    ...theme.map_defaults,
  }

  if (theme.font_family) {
    patch.font_family = theme.font_family
    patch.body_font_family = theme.body_font_family ?? FONT_PAIRINGS[theme.font_family] ?? theme.font_family
  }
  if (theme.border_style !== undefined) patch.border_style = theme.border_style
  if (theme.tile_grain !== undefined) patch.tile_grain = theme.tile_grain
  if (theme.id === 'dark-sky' && trailSegments?.length) {
    patch.trail_segments = trailSegments.map(segment => {
      return {
        ...segment,
        color: theme.route_color,
        color_mode: 'solid',
        width: DEFAULT_TRAIL_SEGMENT_WIDTH,
      }
    })
  }

  return { ...current, ...patch }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function asRecord(config: StyleConfig): Record<string, unknown> {
  return config as unknown as Record<string, unknown>
}

function changedFields(before: StyleConfig, after: StyleConfig): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(key => !valuesEqual(asRecord(before)[key], asRecord(after)[key])).sort()
}

/**
 * Apply a theme and report what survived vs reset.
 *
 * Flag off (`preserveUserIntent` falsy): byte-identical to the historical behavior.
 * Flag on: consults utils/themeFieldOwnership.ts —
 * - user-owned fields are restored from `current` verbatim (including segment label
 *   drags and full poster text overrides);
 * - sticky fields are restored only when their current value differs from the
 *   OUTGOING theme's default (approximated as that theme legacy-applied to
 *   DEFAULT_STYLE_CONFIG);
 * - theme-owned fields take the new theme's values, exactly as legacy.
 */
export function applyThemeToStyleConfigWithMeta(
  current: StyleConfig,
  theme: ThemeDefinition,
  options: ApplyThemeOptions = {},
): ThemeApplicationResult {
  const legacyNext = buildLegacyThemedConfig(current, theme)
  if (!options.preserveUserIntent) {
    return { config: legacyNext, preservedFields: [], resetFields: changedFields(current, legacyNext) }
  }

  const outgoingTheme = options.previousTheme
    ?? (current.color_theme ? getThemeDefinition(current.color_theme) : undefined)
  const outgoingBaseline = outgoingTheme
    ? buildLegacyThemedConfig(DEFAULT_STYLE_CONFIG, outgoingTheme)
    : DEFAULT_STYLE_CONFIG

  const config = asRecord({ ...legacyNext })
  const currentRecord = asRecord(current)
  const baselineRecord = asRecord(outgoingBaseline)

  for (const field of USER_OWNED_STYLE_FIELDS) {
    // Guards fields that may not exist on StyleConfig yet (e.g. map_element_overrides).
    if (!(field in currentRecord)) continue
    config[field] = currentRecord[field]
  }

  for (const field of STICKY_STYLE_FIELDS) {
    if (!(field in currentRecord) && !(field in config)) continue
    if (!valuesEqual(currentRecord[field], baselineRecord[field])) {
      config[field] = currentRecord[field]
    }
  }

  const next = config as unknown as StyleConfig
  const resetFields = changedFields(current, next)
  const preservedFields = changedFields(current, legacyNext)
    .filter(field => !resetFields.includes(field))

  return { config: next, preservedFields, resetFields }
}

export function applyThemeToStyleConfig(
  current: StyleConfig,
  theme: ThemeDefinition,
  options: ApplyThemeOptions = {},
): StyleConfig {
  return applyThemeToStyleConfigWithMeta(current, theme, options).config
}

/**
 * Pure helper for the future "Reset all to theme" toast action: the full legacy
 * clobber, discarding preserved user customizations in favor of the theme's values.
 */
export function resetAllToTheme(config: StyleConfig, theme: ThemeDefinition): StyleConfig {
  return buildLegacyThemedConfig(config, theme)
}

export function pairedBodyFont(fontName: FontFamily): FontFamily {
  return FONT_PAIRINGS[fontName] ?? fontName
}
