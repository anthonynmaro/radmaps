import type { StyleConfig } from '~/types'

/**
 * Theme-ownership registry — the data contract for what survives a theme switch.
 *
 * Spec: docs/STYLE_SYSTEM_EVOLUTION.md § "Theme switching must preserve user intent".
 *
 * Classifications:
 * - `theme-owned` — aesthetics the new theme may overwrite/reset on switch (that's the
 *   point of switching). Note: theme-owned does NOT force a reset; a field is only
 *   touched on switch if the legacy theme patch (THEME_RESET_FIELDS, top-level theme
 *   fields, or `theme.map_defaults`) writes it. Theme-owned just means the registry
 *   does not shield it.
 * - `user-owned` — always survives a theme switch when the editor-v2 behavior
 *   (FLAGS.EDITOR_V2) is enabled: user content, geometry edits, product choices,
 *   overlays, camera/freeze state.
 * - `sticky` — survives IF the current value differs from the OUTGOING theme's default
 *   (i.e. the user manually changed it since the last theme apply); otherwise it resets
 *   to the incoming theme's value.
 *
 * Bump THEME_FIELD_OWNERSHIP_VERSION whenever a classification changes — downstream
 * consumers (render hashing per spec invariant 4, migration tooling) key off it.
 */
export const THEME_FIELD_OWNERSHIP_VERSION = 1

export type ThemeFieldOwnership = 'theme-owned' | 'user-owned' | 'sticky'

/**
 * `map_element_overrides` (spec Domain 2, planned for E5) does not exist on StyleConfig
 * yet — it is pre-registered here as user-owned so the override class can never ship
 * unclassified. Guarded at apply time: only restored when the key actually exists on
 * the config object.
 */
export type ThemeOwnershipField = keyof StyleConfig | 'map_element_overrides'

/**
 * Exhaustive over StyleConfig by construction: the `Record<ThemeOwnershipField, …>`
 * type errors at compile time if a StyleConfig field is added without classification.
 */
export const THEME_FIELD_OWNERSHIP: Record<ThemeOwnershipField, ThemeFieldOwnership> = {
  // ── Theme-owned: base map look ─────────────────────────────────────────────
  preset: 'theme-owned',
  background_color: 'theme-owned',
  base_tile_style: 'theme-owned',
  atlas_manifest_id: 'theme-owned',
  atlas_style_id: 'theme-owned',
  toner_variant: 'theme-owned',
  base_map_mode: 'theme-owned',
  atlas_layers: 'theme-owned',
  atlas_layer_settings: 'theme-owned',
  watercolor_seed: 'theme-owned',
  water_color: 'theme-owned',
  land_color: 'theme-owned',
  color_theme: 'theme-owned',
  composition: 'theme-owned',
  audience: 'theme-owned',
  dark: 'theme-owned',

  // ── Theme-owned: terrain / contours / hillshade ────────────────────────────
  show_contours: 'theme-owned',
  contour_color: 'theme-owned',
  contour_major_color: 'theme-owned',
  contour_opacity: 'theme-owned',
  contour_detail: 'theme-owned',
  contour_minor_width: 'theme-owned',
  contour_major_width: 'theme-owned',
  show_elevation_labels: 'theme-owned',
  show_hillshade: 'theme-owned',
  hillshade_intensity: 'theme-owned',
  hillshade_highlight: 'theme-owned',

  // ── Theme-owned: typography & poster chrome geometry ───────────────────────
  font_family: 'theme-owned',
  body_font_family: 'theme-owned',
  title_size: 'theme-owned',
  subtitle_size: 'theme-owned',
  title_scale: 'theme-owned',
  occasion_scale: 'theme-owned',
  subtitle_scale: 'theme-owned',
  label_position: 'theme-owned',
  border_style: 'theme-owned',
  padding_factor: 'theme-owned',

  // ── Theme-owned: roads / labels / POIs ─────────────────────────────────────
  show_roads: 'theme-owned',
  roads_color: 'theme-owned',
  roads_opacity: 'theme-owned',
  show_place_labels: 'theme-owned',
  place_labels_color: 'theme-owned',
  place_labels_opacity: 'theme-owned',
  place_labels_scale: 'theme-owned',
  show_poi_labels: 'theme-owned',
  poi_labels_color: 'theme-owned',
  poi_labels_opacity: 'theme-owned',

  // ── Theme-owned: pins (positions/labels flagged for review — see HANDOFF) ──
  show_start_pin: 'theme-owned',
  show_finish_pin: 'theme-owned',
  start_pin_lnglat: 'theme-owned',
  finish_pin_lnglat: 'theme-owned',
  start_label_lnglat: 'theme-owned',
  finish_label_lnglat: 'theme-owned',
  start_pin_label: 'theme-owned',
  finish_pin_label: 'theme-owned',
  pin_color: 'theme-owned',
  pin_opacity: 'theme-owned',
  pin_font_family: 'theme-owned',

  // ── Theme-owned: route rendering style (non-sticky parts) ──────────────────
  route_smooth: 'theme-owned',
  route_color_mode: 'theme-owned',

  // ── Theme-owned: segment/leader presentation ───────────────────────────────
  trail_label_style: 'theme-owned',
  segment_casing_width: 'theme-owned',
  segment_casing_color: 'theme-owned',
  segment_dot_size: 'theme-owned',
  leader_label_scale: 'theme-owned',
  leader_label_auto_fit: 'theme-owned',
  leader_label_font_family: 'theme-owned',

  // ── Theme-owned: elevation profile ─────────────────────────────────────────
  show_elevation_profile: 'theme-owned',
  elevation_profile_color: 'theme-owned',
  elevation_profile_opacity: 'theme-owned',
  elevation_profile_height: 'theme-owned',
  elevation_profile_position: 'theme-owned',
  elevation_profile_relief: 'theme-owned',

  // ── Theme-owned: tile effects / vignette ───────────────────────────────────
  tile_effect: 'theme-owned',
  tile_duotone_strength: 'theme-owned',
  tile_posterize_levels: 'theme-owned',
  tile_grain: 'theme-owned',
  tile_contrast: 'theme-owned',
  tile_saturation: 'theme-owned',
  tile_hue_rotate: 'theme-owned',
  tile_shadow_color: 'theme-owned',
  tile_midtone_color: 'theme-owned',
  tile_highlight_color: 'theme-owned',
  show_vignette: 'theme-owned',
  vignette_intensity: 'theme-owned',

  // ── Theme-owned: 3D / camera look (frozen view state is user-owned below) ──
  map_3d: 'theme-owned',
  map_pitch: 'theme-owned',
  map_bearing: 'theme-owned',
  terrain_exaggeration: 'theme-owned',

  // ── Sticky: survives if manually changed from the outgoing theme's default ─
  route_color: 'sticky',
  route_width: 'sticky',
  route_opacity: 'sticky',
  label_text_color: 'sticky',
  label_bg_color: 'sticky',
  show_grid: 'sticky',
  grid_scope: 'sticky',
  grid_color: 'sticky',
  grid_opacity: 'sticky',
  grid_weight: 'sticky',
  grid_spacing: 'sticky',
  // Theme-settable via map_defaults but user-meaningful — sticky as the safe middle.
  show_primary_route: 'sticky',
  composition_footer_distance_unit: 'sticky',
  composition_footer_date_format: 'sticky',

  // ── User-owned: poster text content ────────────────────────────────────────
  trail_name: 'user-owned',
  occasion_text: 'user-owned',
  location_text: 'user-owned',
  labels: 'user-owned',
  poster_text_overrides: 'user-owned',
  poster_layout: 'user-owned',

  // ── User-owned: product / branding / logo ──────────────────────────────────
  print_size: 'user-owned',
  show_branding: 'user-owned',
  show_logo: 'user-owned',
  logo_url: 'user-owned',
  logo_position: 'user-owned',
  logo_size: 'user-owned',

  // ── User-owned: route geometry edits ───────────────────────────────────────
  route_crop_start: 'user-owned',
  route_crop_end: 'user-owned',
  route_deleted_ranges: 'user-owned',

  // ── User-owned: overlays & segments ────────────────────────────────────────
  text_overlays: 'user-owned',
  image_overlays: 'user-owned',
  icon_overlays: 'user-owned',
  trail_segments: 'user-owned',
  trail_legend: 'user-owned',
  trail_show_stats: 'user-owned',
  trail_show_elevation_gain: 'user-owned',

  // ── User-owned: frozen viewport / editor state ─────────────────────────────
  map_zoom: 'user-owned',
  map_center: 'user-owned',
  map_frozen: 'user-owned',
  map_editor_width: 'user-owned',

  // ── User-owned: planned map element overrides (E5; guarded — see type docs) ─
  map_element_overrides: 'user-owned',
}

function fieldsWithOwnership(ownership: ThemeFieldOwnership): ThemeOwnershipField[] {
  return (Object.keys(THEME_FIELD_OWNERSHIP) as ThemeOwnershipField[])
    .filter(field => THEME_FIELD_OWNERSHIP[field] === ownership)
}

export const USER_OWNED_STYLE_FIELDS: readonly ThemeOwnershipField[] = fieldsWithOwnership('user-owned')
export const STICKY_STYLE_FIELDS: readonly ThemeOwnershipField[] = fieldsWithOwnership('sticky')
export const THEME_OWNED_STYLE_FIELDS: readonly ThemeOwnershipField[] = fieldsWithOwnership('theme-owned')

export function getThemeFieldOwnership(field: string): ThemeFieldOwnership | undefined {
  return THEME_FIELD_OWNERSHIP[field as ThemeOwnershipField]
}
