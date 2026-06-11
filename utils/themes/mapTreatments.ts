import type { ColorTheme, StyleConfig } from '~/types'

/**
 * Named map treatments — the contour/relief primitives shared across the
 * refined theme recipes.
 *
 * During theme parity, several distinct map looks emerged (even concentric
 * rings, bold index over faint minors, the night tonal-band mound, painterly
 * wash, shaded relief, recessed data grids) but their parameters were scattered
 * as per-theme settings in utils/themes/refined.ts and per-theme id checks in
 * utils/mapStyle.ts. That meant a polish fix improved exactly one theme.
 *
 * This module names those primitives. Each treatment owns:
 *  - `behavior`: how the adaptive contour/relief pipeline in utils/mapStyle.ts
 *    responds to route stats (smoothing/overzoom, detail clamps, sea-level
 *    suppression, high-relief clamp tables, low-relief opacity floors).
 *  - `recipe_defaults`: the StyleConfig intent fields every member theme sets
 *    identically. Recipes reference their treatment and override sparingly;
 *    palette-specific values (colors, widths, opacities) stay in the recipe.
 *
 * BEHAVIOR CONTRACT: this is a naming refactor, not a redesign. The resolved
 * output for every theme must stay byte-identical — pinned by
 * tests/theme-resolution-snapshot.test.ts. Changing a treatment value is an
 * intentional multi-theme polish pass: review every member theme via the
 * golden diff + theme matrix before regenerating the snapshot.
 *
 * Bespoke notes (deliberately NOT force-fit into a cluster):
 *  - `sea-chart` keeps its nautical depth-curve contour settings inline in
 *    refined.ts; its adaptive behavior is stock default and its parameters
 *    match no cluster.
 *  - Per-theme route ornament stacks (riso overprint, dark-sky constellation,
 *    bib mile ticks, etc.) live in utils/mapStyle.ts routeLayers(); they are a
 *    separate route-treatment axis, out of scope here.
 */

// ─── Adaptive relief response tables ─────────────────────────────────────────

export interface HighReliefContourResponseStep {
  /** Reserved (currently unused by the resolver — kept for table fidelity). */
  opacityFactor: number
  /** Opacity ceiling applied to contour/minor opacity at this adaptive detail. */
  minorMax: number
  /** Opacity ceiling applied to major/index opacity at this adaptive detail. */
  majorMax: number
  /** Width multiplier applied to contour widths at this adaptive detail. */
  widthFactor: number
}

/** Keyed by adaptive contour detail 0–3 (only high/extreme relief routes). */
export type HighReliefContourResponse = Record<0 | 1 | 2 | 3, HighReliefContourResponseStep>

/**
 * How a treatment responds when a route has serious relief (adaptive detail
 * 0–3): `recede-standard` fades contours out of the route's way; the `hold-*`
 * profiles keep the treatment's authored character legible instead.
 */
export const HIGH_RELIEF_CONTOUR_RESPONSES = {
  /** Default: progressively recede contours as relief grows. */
  'recede-standard': {
    0: { opacityFactor: 0.34, minorMax: 0.10, majorMax: 0.38, widthFactor: 0.54 },
    1: { opacityFactor: 0.48, minorMax: 0.16, majorMax: 0.46, widthFactor: 0.68 },
    2: { opacityFactor: 0.68, minorMax: 0.24, majorMax: 0.56, widthFactor: 0.82 },
    3: { opacityFactor: 0.82, minorMax: 0.30, majorMax: 0.62, widthFactor: 0.90 },
  },
  /** Bold graphic index lines stay assertive (bold-modern). */
  'hold-bold-index': {
    0: { opacityFactor: 1, minorMax: 0.18, majorMax: 0.78, widthFactor: 1 },
    1: { opacityFactor: 1, minorMax: 0.20, majorMax: 0.82, widthFactor: 1 },
    2: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.86, widthFactor: 1 },
    3: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.88, widthFactor: 1 },
  },
  /** Hairline gallery rings stay quiet but present (editorial-minimal). */
  'hold-hairline': {
    0: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.34, widthFactor: 0.9 },
    1: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.36, widthFactor: 0.95 },
    2: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.38, widthFactor: 1 },
    3: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.40, widthFactor: 1 },
  },
  /** Concrete slab linework holds its weight (brutalist). */
  'hold-slab': {
    0: { opacityFactor: 1, minorMax: 0.34, majorMax: 0.88, widthFactor: 1 },
    1: { opacityFactor: 1, minorMax: 0.36, majorMax: 0.88, widthFactor: 1 },
    2: { opacityFactor: 1, minorMax: 0.38, majorMax: 0.88, widthFactor: 1 },
    3: { opacityFactor: 1, minorMax: 0.40, majorMax: 0.88, widthFactor: 1 },
  },
  /** Botanical plate index lines stay etched (botanical). */
  'hold-plate-index': {
    0: { opacityFactor: 1, minorMax: 0.16, majorMax: 0.72, widthFactor: 1 },
    1: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.78, widthFactor: 1 },
    2: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.80, widthFactor: 1 },
    3: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.82, widthFactor: 1 },
  },
  /** Dark performance glow keeps mid-strength contour light (night-ride). */
  'hold-dark-glow': {
    0: { opacityFactor: 1, minorMax: 0.22, majorMax: 0.54, widthFactor: 0.86 },
    1: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.56, widthFactor: 0.9 },
    2: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.58, widthFactor: 0.94 },
    3: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.60, widthFactor: 1 },
  },
  /** Travel-poster index stays warm and readable (mid-century family). */
  'hold-travel-index': {
    0: { opacityFactor: 1, minorMax: 0.24, majorMax: 0.62, widthFactor: 1 },
    1: { opacityFactor: 1, minorMax: 0.26, majorMax: 0.66, widthFactor: 1 },
    2: { opacityFactor: 1, minorMax: 0.28, majorMax: 0.68, widthFactor: 1 },
    3: { opacityFactor: 1, minorMax: 0.30, majorMax: 0.70, widthFactor: 1 },
  },
} as const satisfies Record<string, HighReliefContourResponse>

export type HighReliefResponseId = keyof typeof HIGH_RELIEF_CONTOUR_RESPONSES

export interface LowReliefContourFloor {
  contour: number
  minor: number
  major: number
}

/**
 * Opacity floors applied when a route is genuinely flat (adaptive detail 5,
 * low band) so dense low-relief contours still read as intentional art.
 */
export const LOW_RELIEF_CONTOUR_FLOORS = {
  standard: { contour: 0.34, minor: 0.24, major: 0.42 },
  /** Brutalist slab: minors stay restrained, index lines stay heavy. */
  slab: { contour: 0.26, minor: 0.30, major: 0.72 },
  /** Travel-poster family: barely-there minors under a warm index. */
  'travel-faint': { contour: 0.14, minor: 0.055, major: 0.28 },
  /** Daybreak: even fainter sunrise linework. */
  'sunrise-faint': { contour: 0.12, minor: 0.06, major: 0.22 },
} as const satisfies Record<string, LowReliefContourFloor>

export type LowReliefFloorId = keyof typeof LOW_RELIEF_CONTOUR_FLOORS

/** Which low-relief interval table to use ('dense-slab' = brutalist 5/20m). */
export type LowReliefThresholdsId = 'standard' | 'dense-slab'

// ─── Adaptive contour behavior ────────────────────────────────────────────────

export interface AdaptiveContourBehavior {
  /** Request smoothed contours (DEM overzoom 2 instead of 0). */
  smoothContours: boolean
  /** Floor for adaptive contour detail (keeps rings concentric on big relief). */
  minContourDetail: number | null
  /** Ceiling for adaptive contour detail (keeps data themes quiet). */
  maxContourDetail: number | null
  /** Ceiling applied only outside the low-relief band. */
  nonLowReliefMaxContourDetail: number | null
  /** Keep the authored detail when adaptive resolution would raise it (non-low relief). */
  preserveAuthoredDetailOutsideLowRelief: boolean
  /** Keep the authored detail when adaptive resolution would raise it to 5 (low relief). */
  preserveAuthoredDetailInLowRelief: boolean
  /** Hide contour features at/below sea level (ele <= 0). */
  suppressSeaLevelContours: boolean
  highReliefResponse: HighReliefResponseId
  lowReliefFloor: LowReliefFloorId
  lowReliefThresholds: LowReliefThresholdsId
}

export const DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR: AdaptiveContourBehavior = {
  smoothContours: false,
  minContourDetail: null,
  maxContourDetail: null,
  nonLowReliefMaxContourDetail: null,
  preserveAuthoredDetailOutsideLowRelief: false,
  preserveAuthoredDetailInLowRelief: false,
  suppressSeaLevelContours: false,
  highReliefResponse: 'recede-standard',
  lowReliefFloor: 'standard',
  lowReliefThresholds: 'standard',
}

// ─── Treatments ───────────────────────────────────────────────────────────────

export type MapTreatmentId =
  | 'even-concentric'
  | 'two-tier-index'
  | 'travel-poster-index'
  | 'dark-data-quiet'
  | 'night-glow-mound'
  | 'wash-echo'
  | 'shaded-relief'
  | 'no-contour'

export interface MapTreatment {
  id: MapTreatmentId
  label: string
  description: string
  /** Defaults over DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR; per-theme overrides win. */
  behavior: Partial<AdaptiveContourBehavior>
  /**
   * StyleConfig intent fields shared verbatim by every member recipe.
   * STRICT RULE: only keys that every member already set to the identical
   * value may live here — adding a key changes member output and breaks the
   * snapshot. Palette-specific values stay in the recipe.
   */
  recipe_defaults: Partial<StyleConfig>
}

export const MAP_TREATMENTS: Record<MapTreatmentId, MapTreatment> = {
  'even-concentric': {
    id: 'even-concentric',
    label: 'Even concentric rings',
    description: 'Smoothed, evenly spaced contour rings as quiet gallery art; detail floor keeps big-relief routes concentric instead of sparse.',
    behavior: {
      smoothContours: true,
      minContourDetail: 2,
    },
    recipe_defaults: {
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
    },
  },
  'two-tier-index': {
    id: 'two-tier-index',
    label: 'Two-tier index',
    description: 'Bold index (major) contour over faint minors — vintage survey cartography; authored detail is honored outside flat routes.',
    behavior: {
      preserveAuthoredDetailOutsideLowRelief: true,
    },
    recipe_defaults: {
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
      tile_effect: 'none',
    },
  },
  'travel-poster-index': {
    id: 'travel-poster-index',
    label: 'Travel-poster index',
    description: 'Two-tier index with smoothing, warm low-relief floors, and pins on — the mid-century travel family.',
    behavior: {
      smoothContours: true,
      highReliefResponse: 'hold-travel-index',
      lowReliefFloor: 'travel-faint',
    },
    recipe_defaults: {
      preset: 'radmaps-simple-contour',
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
      pin_opacity: 1,
      show_start_pin: true,
      show_finish_pin: true,
      tile_effect: 'none',
      show_grid: false,
      atlas_layers: {
        contour: true,
        landcover: false,
        water: false,
        waterway: false,
        park: false,
        transportation: false,
        building: false,
        place: false,
        poi: false,
      },
    },
  },
  'dark-data-quiet': {
    id: 'dark-data-quiet',
    label: 'Dark data, quiet terrain',
    description: 'Recessed contour texture under data chrome on a dark field; smoothed, detail-capped, sea-level contours suppressed.',
    behavior: {
      smoothContours: true,
      maxContourDetail: 4,
      suppressSeaLevelContours: true,
    },
    recipe_defaults: {
      preset: 'radmaps-alidade-dark',
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
      tile_effect: 'none',
    },
  },
  'night-glow-mound': {
    id: 'night-glow-mound',
    label: 'Night glow mound',
    description: 'Radial tonal-band night mound (radmaps-night-relief) with near-invisible minors and a faint glowing index overlay.',
    behavior: {},
    recipe_defaults: {
      preset: 'radmaps-night-relief',
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
      padding_factor: 0.04,
      show_start_pin: false,
      show_finish_pin: false,
      tile_effect: 'layer-color',
      show_grid: false,
    },
  },
  'wash-echo': {
    id: 'wash-echo',
    label: 'Wash / echo',
    description: 'Soft painterly field with dense balanced contours; route character comes from wash/echo ornament layers.',
    behavior: {},
    recipe_defaults: {
      show_roads: false,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: true,
      show_grid: false,
    },
  },
  'shaded-relief': {
    id: 'shaded-relief',
    label: 'Shaded relief',
    description: 'Hillshade-lit terrain with a two-tier contour overlay and relief-textured landcover.',
    behavior: {},
    recipe_defaults: {
      show_roads: false,
      show_place_labels: false,
      show_poi_labels: false,
      show_hillshade: true,
      show_contours: true,
      tile_effect: 'layer-color',
      show_grid: false,
    },
  },
  'no-contour': {
    id: 'no-contour',
    label: 'Diagrammatic (no contours)',
    description: 'Contour-free diagram look: grid on the map area, labels and pins off; the route/place chrome carries the design.',
    behavior: {},
    recipe_defaults: {
      show_place_labels: false,
      place_labels_opacity: 0,
      show_poi_labels: false,
      show_hillshade: false,
      show_contours: false,
      show_start_pin: false,
      show_finish_pin: false,
      show_grid: true,
      grid_scope: 'map',
      grid_spacing: 8,
      tile_effect: 'none',
    },
  },
}

// ─── Theme → treatment assignments ────────────────────────────────────────────

export interface ThemeMapTreatmentAssignment {
  treatment: MapTreatmentId
  /** Small per-theme behavior deviations. Each one is a polish candidate. */
  behavior?: Partial<AdaptiveContourBehavior>
}

/**
 * Single source of truth for which theme uses which treatment. Recipes in
 * utils/themes/refined.ts pull their shared recipe defaults from here (via
 * `treatmentRecipeDefaults`), and utils/mapStyle.ts derives all of its
 * per-theme adaptive contour handling from `resolveAdaptiveContourBehavior`.
 *
 * Theme ids absent from this table (legacy themes, `sea-chart` bespoke) get
 * stock DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR — exactly the pre-refactor behavior.
 */
export const THEME_MAP_TREATMENTS: Partial<Record<ColorTheme, ThemeMapTreatmentAssignment>> = {
  // even concentric rings
  'editorial-minimal': { treatment: 'even-concentric', behavior: { highReliefResponse: 'hold-hairline' } },
  'contour-wash': { treatment: 'even-concentric' },
  'classic-trail': { treatment: 'even-concentric' },
  'blueprint': { treatment: 'even-concentric' },
  'bold-modern': { treatment: 'even-concentric', behavior: { highReliefResponse: 'hold-bold-index' } },

  // two-tier bold index over faint minors
  // NOTE: usgs-vintage keeps the detail floor but never opted into smoothing
  // or authored-detail preservation; blackline (colorway of bold-modern) has
  // no adaptive opt-ins at all. Both look like polish candidates — see
  // docs/THEME_BUILDING.md — but are preserved exactly.
  'usgs-vintage': { treatment: 'two-tier-index', behavior: { preserveAuthoredDetailOutsideLowRelief: false, minContourDetail: 2 } },
  'botanical': { treatment: 'two-tier-index', behavior: { highReliefResponse: 'hold-plate-index' } },
  'blackline': { treatment: 'two-tier-index', behavior: { preserveAuthoredDetailOutsideLowRelief: false } },
  'brutalist': { treatment: 'two-tier-index', behavior: { highReliefResponse: 'hold-slab', lowReliefFloor: 'slab', lowReliefThresholds: 'dense-slab' } },
  'moonstone': { treatment: 'two-tier-index' },

  // travel-poster index family
  'midcentury-travel': { treatment: 'travel-poster-index' },
  'ranch-ochre': { treatment: 'travel-poster-index' },
  'daybreak-trace': { treatment: 'travel-poster-index', behavior: { maxContourDetail: 3, lowReliefFloor: 'sunrise-faint' } },

  // dark data, quiet terrain
  // NOTE: night-ride (colorway of splits-stats) opts out of nearly the whole
  // cluster behavior — preserved exactly, flagged as a polish candidate.
  'blueprint-strava': { treatment: 'dark-data-quiet' },
  'splits-stats': { treatment: 'dark-data-quiet' },
  'electric-atlas': { treatment: 'dark-data-quiet', behavior: { maxContourDetail: 3 } },
  'night-ride': {
    treatment: 'dark-data-quiet',
    behavior: {
      smoothContours: false,
      maxContourDetail: null,
      suppressSeaLevelContours: false,
      nonLowReliefMaxContourDetail: 0,
      highReliefResponse: 'hold-dark-glow',
    },
  },

  // night glow mound
  'dark-sky': { treatment: 'night-glow-mound' },
  'copper-night': { treatment: 'night-glow-mound' },

  // wash / echo
  'plein-air': { treatment: 'wash-echo' },
  'field-journal': { treatment: 'wash-echo' },
  'marathon-bib': { treatment: 'wash-echo' },
  'risograph': { treatment: 'wash-echo' },

  // shaded relief
  'relief-shaded': { treatment: 'shaded-relief' },

  // diagrammatic, contour-free
  'transit-diagram': { treatment: 'no-contour' },
  'cartouche-place': { treatment: 'no-contour' },

  // 'sea-chart' is intentionally bespoke: nautical depth-curve contours kept
  // inline in refined.ts; stock adaptive behavior.
}

/** Refined theme ids that intentionally keep their map settings inline. */
export const BESPOKE_MAP_TREATMENT_THEME_IDS = ['sea-chart'] as const

// ─── Resolution helpers ───────────────────────────────────────────────────────

export function getThemeMapTreatmentAssignment(themeId: string | undefined): ThemeMapTreatmentAssignment | undefined {
  if (!themeId) return undefined
  return THEME_MAP_TREATMENTS[themeId as ColorTheme]
}

/**
 * Resolved adaptive contour behavior for a theme id:
 * defaults ← treatment behavior ← per-theme overrides.
 */
export function resolveAdaptiveContourBehavior(themeId: string | undefined): AdaptiveContourBehavior {
  const assignment = getThemeMapTreatmentAssignment(themeId)
  if (!assignment) return DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR
  return {
    ...DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR,
    ...MAP_TREATMENTS[assignment.treatment].behavior,
    ...assignment.behavior,
  }
}

/** Shared recipe defaults for a theme's treatment (empty for bespoke/legacy ids). */
export function treatmentRecipeDefaults(themeId: ColorTheme): Partial<StyleConfig> {
  const assignment = THEME_MAP_TREATMENTS[themeId]
  return assignment ? MAP_TREATMENTS[assignment.treatment].recipe_defaults : {}
}
