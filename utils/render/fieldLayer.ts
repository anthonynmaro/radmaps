// utils/render/fieldLayer.ts
//
// Phase 0 foundation: StyleConfig → ('map' | 'chrome') classification.
//
// ─── The satisfies invariant ─────────────────────────────────────────────────
//
// FIELD_LAYER is declared with `satisfies Record<keyof StyleConfig,
// 'map' | 'chrome'>`. Combined with the StyleConfig definition in
// types/index.ts this gives us a compile-time guarantee:
//
//   Adding a new field to StyleConfig without classifying it here is
//   a TypeScript error. Period.
//
// This is critical because the two-layer hash model
// (map_content_hash vs chrome_hash) depends on every field being
// assigned to exactly one layer. An unclassified field would silently
// fail to participate in either hash, causing cache-key drift bugs
// that are nearly impossible to detect at runtime.
//
// ─── Classification rules ────────────────────────────────────────────────────
//
// 'map'    — anything that affects the MapLibre map view:
//            tiles, route geometry/style, contours, hillshade, pins,
//            segments, tile post-processing effects, camera state,
//            preset, color theme (because it drives water/land/contour
//            colors that bake into the tile raster).
//
// 'chrome' — anything rendered by the poster chrome in MapPreview.vue:
//            title bar, footer, stats, location,
//            border, label position, branding, logo, label band fonts
//            and colors, print size (drives canvas dimensions but the
//            map area is a fixed full-bleed viewport).
//
// `label_position` is CHROME because it changes poster layout, not route data.
//
// `text_overlays` and `trail_legend` are currently 'map' because they
// burn into the MapLibre style today. They are PENDING reclassification
// to 'chrome' once interactjs-driven HTML overlays land. When that migration
// happens, bump HASH_VERSION.chrome.chromeTemplate and
// HASH_VERSION.map.styleCompiler to invalidate rendered artifacts.

import type { StyleConfig } from '~/types'

export type FieldLayer = 'map' | 'chrome'

export const FIELD_LAYER = {
  // ── Map preset / base tiles ────────────────────────────────────────────────
  preset: 'map',
  base_tile_style: 'map',
  atlas_manifest_id: 'map',
  atlas_style_id: 'map',
  toner_variant: 'map',
  base_map_mode: 'map',
  atlas_layers: 'map',
  atlas_layer_settings: 'map',
  watercolor_seed: 'map',

  // ── Background (paints the canvas behind the map; chrome layer concern) ────
  background_color: 'chrome',

  // ── Route geometry & style ────────────────────────────────────────────────
  route_color: 'map',
  route_width: 'map',
  route_opacity: 'map',
  route_smooth: 'map',
  route_crop_start: 'map',
  route_crop_end: 'map',
  route_deleted_ranges: 'map',
  route_color_mode: 'map',

  // ── Contours ───────────────────────────────────────────────────────────────
  show_contours: 'map',
  contour_color: 'map',
  contour_major_color: 'map',
  contour_opacity: 'map',
  contour_detail: 'map',
  contour_minor_width: 'map',
  contour_major_width: 'map',
  show_elevation_labels: 'map',

  // ── Hillshade ──────────────────────────────────────────────────────────────
  show_hillshade: 'map',
  hillshade_intensity: 'map',
  hillshade_highlight: 'map',

  // ── Base map colours (bake into tile raster) ──────────────────────────────
  water_color: 'map',
  land_color: 'map',

  // ── Typography (chrome — used for title/footer text bands) ────────────────
  font_family: 'chrome',
  body_font_family: 'chrome',
  title_size: 'chrome',
  subtitle_size: 'chrome',
  labels: 'chrome',
  // v4 locked decision: label_position is CHROME. Map viewport is oversized.
  label_position: 'chrome',
  border_style: 'chrome',
  padding_factor: 'chrome',

  // ── Theme + sizing ─────────────────────────────────────────────────────────
  // color_theme drives water/land/contour colours which bake into the raster.
  color_theme: 'map',
  // composition controls poster chrome layout; map preset/layers remain separate.
  composition: 'chrome',
  audience: 'chrome',
  dark: 'map',
  composition_footer_distance_unit: 'chrome',
  composition_footer_date_format: 'chrome',
  show_grid: 'chrome',
  grid_scope: 'chrome',
  grid_color: 'chrome',
  grid_opacity: 'chrome',
  grid_weight: 'chrome',
  grid_spacing: 'chrome',
  // print_size drives canvas dimensions — chrome layer concern (the map
  // raster itself is rendered at an oversized fixed viewport).
  print_size: 'chrome',

  // ── Poster text ───────────────────────────────────────────────────────────
  trail_name: 'chrome',
  occasion_text: 'chrome',
  location_text: 'chrome',
  poster_text_overrides: 'chrome',
  poster_layout: 'chrome',
  label_text_color: 'chrome',
  label_bg_color: 'chrome',

  // ── Branding ──────────────────────────────────────────────────────────────
  show_branding: 'chrome',

  // ── Logo ──────────────────────────────────────────────────────────────────
  show_logo: 'chrome',
  logo_url: 'chrome',
  logo_position: 'chrome',
  logo_size: 'chrome',
  image_overlays: 'chrome',
  icon_overlays: 'chrome',

  // ── Roads / place / POI labels (rendered into the map raster) ─────────────
  show_roads: 'map',
  roads_color: 'map',
  roads_opacity: 'map',
  show_place_labels: 'map',
  place_labels_color: 'map',
  place_labels_opacity: 'map',
  place_labels_scale: 'map',
  show_poi_labels: 'map',
  poi_labels_color: 'map',
  poi_labels_opacity: 'map',

  // ── Pins (drawn on the map raster) ────────────────────────────────────────
  show_start_pin: 'map',
  show_finish_pin: 'map',
  start_pin_lnglat: 'map',
  finish_pin_lnglat: 'map',
  start_label_lnglat: 'map',
  finish_label_lnglat: 'map',
  start_pin_label: 'map',
  finish_pin_label: 'map',
  pin_color: 'map',
  pin_opacity: 'map',
  pin_font_family: 'map',

  // ── Per-field text scale multipliers (chrome typography) ──────────────────
  title_scale: 'chrome',
  occasion_scale: 'chrome',
  subtitle_scale: 'chrome',

  // ── Text overlays / trail legend ──────────────────────────────────────────
  // PENDING: these are currently 'map' because they bake into the MapLibre
  // style today. Will reclassify to 'chrome' when they migrate to HTML
  // overlays via interactjs (see CLAUDE.md "Planned next work" + the v4
  // plan §"Open questions" #1). On migration, bump both
  // HASH_VERSION.chrome.chromeTemplate AND HASH_VERSION.map.styleCompiler.
  text_overlays: 'map',
  trail_segments: 'map',
  show_primary_route: 'map',
  trail_legend: 'map',
  trail_label_style: 'map',
  segment_casing_width: 'map',
  segment_casing_color: 'map',
  segment_dot_size: 'map',
  leader_label_scale: 'map',
  leader_label_auto_fit: 'map',
  leader_label_font_family: 'map',
  trail_show_stats: 'map',
  trail_show_elevation_gain: 'map',

  // ── Elevation profile (drawn in the map/profile visual layer) ─────────────
  show_elevation_profile: 'map',
  elevation_profile_color: 'map',
  elevation_profile_opacity: 'map',
  elevation_profile_height: 'map',
  elevation_profile_position: 'map',
  elevation_profile_relief: 'map',

  // ── Tile post-processing effects ──────────────────────────────────────────
  tile_effect: 'map',
  tile_duotone_strength: 'map',
  tile_posterize_levels: 'map',
  tile_grain: 'map',
  tile_contrast: 'map',
  tile_saturation: 'map',
  tile_hue_rotate: 'map',
  tile_shadow_color: 'map',
  tile_midtone_color: 'map',
  tile_highlight_color: 'map',

  // ── Vignette ──────────────────────────────────────────────────────────────
  // The vignette overlays the rendered map raster; it's part of the map
  // image, not the chrome bands.
  show_vignette: 'map',
  vignette_intensity: 'map',

  // ── 3D terrain + camera authority ─────────────────────────────────────────
  // v4 locked decision #3: camera authority is the browser; map_center
  // and map_zoom are persisted to StyleConfig and consumed verbatim.
  // These are obviously 'map' fields.
  map_3d: 'map',
  map_pitch: 'map',
  map_bearing: 'map',
  terrain_exaggeration: 'map',
  map_zoom: 'map',
  map_center: 'map',
  map_frozen: 'map',
  // Width of the editor's map container when zoom was saved. The render
  // worker uses this in a logarithmic zoom correction at print resolution:
  //   effectiveZoom = map_zoom + log2(renderWidth / map_editor_width)
  // Render-affecting → 'map'. Confirmed via Phase-0 user audit.
  map_editor_width: 'map',
} as const satisfies Record<keyof StyleConfig, FieldLayer>
