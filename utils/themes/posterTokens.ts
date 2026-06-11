/**
 * Poster chrome tokens — the shared typography/spacing vocabulary for poster
 * compositions and theme chrome.
 *
 * Before this layer, every composition profile and chrome recipe carried its
 * own literal numbers, so a spacing or type-scale polish fix improved exactly
 * one composition. Tokens name the tiers that genuinely recur:
 *
 *  - type scale ratios (title/subtitle/eyebrow/meta/stat relationships used by
 *    utils/posterLayout.ts chrome recipes),
 *  - band height tiers (header/footer % of poster height),
 *  - poster edge margins (cqw) and band padding builders (the exact
 *    `calc(... + var(--print-bleed, 0px))` strings used by
 *    utils/posterCompositions.ts),
 *  - rule weights/ink strengths for map frames,
 *  - letter-spacing tiers (utils/posterData.ts refined typography).
 *
 * RULES:
 *  - Only values that recur across compositions/themes get a token. Genuinely
 *    bespoke values stay inline at the call site with a comment — do not
 *    force-fit them into a tier.
 *  - This is a naming layer, not a redesign: resolved CSS strings and numbers
 *    must stay byte-identical (pinned by tests/theme-resolution-snapshot.test.ts).
 *  - Changing a token is an intentional multi-composition polish pass: review
 *    every affected theme via golden diff + theme matrix first.
 */

// ─── Type scale ───────────────────────────────────────────────────────────────
// Unitless multipliers relative to each band's base text size, consumed by the
// chrome recipes in utils/posterLayout.ts.

export const CHROME_TYPE_SCALE = {
  kicker: {
    standard: 0.8,
    /** Technical/data compositions run the eyebrow smaller. */
    technical: 0.7,
  },
  meta: {
    standard: 0.72,
    technical: 0.62,
  },
  title: {
    standard: 1,
  },
  subtitle: {
    standard: 0.8,
    /** Compact deck line under oversized display titles. */
    deck: 0.66,
  },
  occasion: {
    standard: 0.75,
  },
  stat: {
    standard: 1.35,
    /** Editorial/travel chrome keeps stats understated. */
    quiet: 1.14,
    /** Data-forward footers push stats up. */
    data: 1.42,
    /** Display/commemorative footers (bib, brutalist slab). */
    display: 1.56,
  },
  date: {
    standard: 1.05,
  },
  coords: {
    standard: 0.9,
    quiet: 0.7,
  },
  note: {
    standard: 0.68,
    quiet: 0.62,
    technical: 0.54,
    display: 0.52,
  },
  /** RADMAPS brand mark in the footer. */
  brand: 0.58,
} as const

// ─── Band heights ─────────────────────────────────────────────────────────────
// Percent of poster height, consumed by chrome recipes (clamped at the band
// editing layer by CHROME_BAND_HEIGHT_BOUNDS).

export const CHROME_BAND_HEIGHTS = {
  header: {
    /** Banner header for bottom-title travel chrome. */
    banner: 17,
    /** Data header (blueprint-strava / splits). */
    data: 19,
    /** Over-map titleblock chrome (place-frame, bib). */
    titleblock: 21,
    standard: 22,
    tall: 23,
    /** Modernist hero block (max band height). */
    hero: 34.2,
  },
  footer: {
    hidden: 0,
    slim: 12.5,
    compact: 13,
    standard: 14,
    data: 16,
  },
} as const

// ─── Edge margins ─────────────────────────────────────────────────────────────
// Horizontal poster margins in cqw. Compositions with bespoke gutters keep
// their literal value at the call site.

export const POSTER_EDGE_MARGINS = {
  /** Tight banner gutters (travel-banner, blueprint-grid). */
  banner: 4.8,
  /** Technical data gutters (blueprint-strava). */
  data: 5.2,
  standard: 6,
  /** Wide editorial gutters (editorial-tall, splits, transit). */
  wide: 6.8,
} as const

// ─── Band padding builders ────────────────────────────────────────────────────
// The poster bleeds into the physical print edge; padding on the outermost
// band edge must therefore grow by var(--print-bleed). These builders produce
// the exact CSS strings used across composition profiles.

const BLEED = 'var(--print-bleed, 0px)'

/** Padding for a band on the TOP poster edge: bleed on top + sides. */
export function topBandPadding(topCqh: number, xCqw: number, bottomCqh: number): string {
  return `calc(${topCqh}cqh + ${BLEED}) calc(${xCqw}cqw + ${BLEED}) ${bottomCqh}cqh`
}

/** Padding for a band on the BOTTOM poster edge: bleed on bottom + sides. */
export function bottomBandPadding(topCqh: number, xCqw: number, bottomCqh: number): string {
  return `${topCqh}cqh calc(${xCqw}cqw + ${BLEED}) calc(${bottomCqh}cqh + ${BLEED})`
}

/** Padding for an interior band: bleed only on the sides. */
export function innerBandPadding(topCqh: number, xCqw: number, bottomCqh: number): string {
  return `${topCqh}cqh calc(${xCqw}cqw + ${BLEED}) ${bottomCqh}cqh`
}

// ─── Map frame rules ──────────────────────────────────────────────────────────

/** Rule weights in px for map frames and band rules. */
export const RULE_WEIGHTS = {
  hairline: 1,
  fine: 1.5,
  /** Brutalist slab frame. */
  slab: 5,
} as const

/** Ink strength (percent of currentColor) for color-mix frame rules. */
export const RULE_INK = {
  whisper: 22,
  faint: 24,
  soft: 32,
  strong: 45,
} as const

/** A current-color frame rule at a given weight and ink strength. */
export function inkRule(weightPx: number, inkPercent: number): string {
  return `${weightPx}px solid color-mix(in srgb, currentColor ${inkPercent}%, transparent)`
}

// ─── Letter-spacing tiers ─────────────────────────────────────────────────────
// Consumed by the refined theme typography in utils/posterData.ts. Display
// tiers apply to titles; meta tiers to subtitles/stats/eyebrows. One-off
// tracking values stay inline in the typography table with a comment.

export const TRACKING = {
  none: '0',
  /** Mixed-case serif display titles. */
  serifDisplay: '0.01em',
  /** Tight display caps/grotesks. */
  displayTight: '0.015em',
  /** Slightly opened display (cormorant night titles). */
  displaySnug: '0.02em',
  /** Compact caps display (bib, moonstone, splits). */
  capsCompact: '0.04em',
  /** Standard caps display (oswald travel titles). */
  capsStandard: '0.06em',
  /** Roomy caps display (blueprint, ranch, daybreak). */
  capsRoomy: '0.07em',
  /** Serif meta/subtitle (editorial, cartouche). */
  metaSerif: '0.08em',
  metaTight: '0.12em',
  metaStandard: '0.14em',
  metaWide: '0.16em',
  metaAiry: '0.18em',
} as const
