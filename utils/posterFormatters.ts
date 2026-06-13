// utils/posterFormatters.ts
//
// Shared formatters for poster chrome text (coordinates, distance,
// elevation gain). Extracted from MapPreview.vue:710-734 so editor and
// worker produce identical text. Pure functions.

/** [minLng, minLat, maxLng, maxLat] */
export type Bbox = [number, number, number, number]

export interface FormattedCoords {
  lat: string // e.g. "34°32'N"
  lng: string // e.g. "113°-29'W"
}

export interface PosterLocationContext {
  coords?: { lat: number, lng: number } | null
  label?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
}

/**
 * Format a bbox center as a degree/minute string (DMS without seconds),
 * matching the editor's footer-band coords output.
 */
export function formatCoordsFromBbox(bbox: Bbox | null | undefined): FormattedCoords | null {
  if (!bbox) return null
  const lat = (bbox[1] + bbox[3]) / 2
  const lng = (bbox[0] + bbox[2]) / 2

  const fmt = (v: number, pos: string, neg: string) => {
    const abs = Math.abs(v)
    const d = Math.floor(abs)
    const m = Math.round((abs - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }

  return { lat: fmt(lat, 'N', 'S'), lng: fmt(lng, 'E', 'W') }
}

export function formatCoordsFromPoint(coords: { lat: number, lng: number } | null | undefined): FormattedCoords | null {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null

  const fmt = (v: number, pos: string, neg: string) => {
    const abs = Math.abs(v)
    const d = Math.floor(abs)
    const m = Math.round((abs - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }

  return { lat: fmt(coords.lat, 'N', 'S'), lng: fmt(coords.lng, 'E', 'W') }
}

export function formatPosterRegion(context: PosterLocationContext): string {
  return context.region || context.city || context.country || context.label || ''
}

export function formatPosterLocationLine(context: PosterLocationContext): string {
  const parts = [context.label, context.region ?? context.city, context.country]
    .map(part => typeof part === 'string' ? part.trim() : '')
    .filter(Boolean)
  return Array.from(new Set(parts)).join(', ')
}

/**
 * Distance in miles, one decimal, matching editor's footer band.
 * Accepts either distance_km (km) or distance_mi (mi) on the stats blob.
 * Returns '' when no distance is known.
 */
export function formatDistanceMiles(stats: {
  distance_km?: number
  distance_mi?: number
}): string {
  if (stats.distance_mi != null) return stats.distance_mi.toFixed(1)
  if (stats.distance_km != null) return (stats.distance_km * 0.621371).toFixed(1)
  return ''
}

/**
 * Elevation gain in feet, locale-aware thousand separator, matching
 * editor's footer band. Accepts elevation_gain_m, elevation_gain_ft, or
 * ascent_ft. Returns '' when no gain is known.
 */
export function formatElevationGainFeet(stats: {
  elevation_gain_m?: number
  elevation_gain_ft?: number
  ascent_ft?: number
}): string {
  if (stats.elevation_gain_ft != null) {
    return Math.round(stats.elevation_gain_ft).toLocaleString()
  }
  if (stats.ascent_ft != null) {
    return Math.round(stats.ascent_ft).toLocaleString()
  }
  if (stats.elevation_gain_m != null) {
    return Math.round(stats.elevation_gain_m * 3.28084).toLocaleString()
  }
  return ''
}

export function formatPointElevationFeet(elevationM: number | null | undefined): string {
  if (typeof elevationM !== 'number' || !Number.isFinite(elevationM)) return ''
  return Math.round(elevationM * 3.28084).toLocaleString()
}

export function formatPointElevationMeters(elevationM: number | null | undefined): string {
  if (typeof elevationM !== 'number' || !Number.isFinite(elevationM)) return ''
  return Math.round(elevationM).toLocaleString()
}

// ── Hero-title dedupe rule ────────────────────────────────────────────────────
//
// Hero-title compositions (riso-stack, brutalist-slab, modernist-block, …) own
// the poster title. Derived decor/slot defaults (kickers, captions, footer
// notes) historically used the trail name as a terminal fallback, so a real
// map with only a trail name (no occasion/location) rendered the title twice.
// The rule, applied at the text-resolution layer so editor and print agree by
// construction: a DERIVED value may never resolve to the same normalized
// string as the hero title — it resolves to its next fallback or drops
// ephemerally (the data contract's `ifMissing: 'remove'` posture). Explicit
// user text (`poster_text_overrides`, typed slot values rendered in their own
// slots) is user intent and is not subject to this rule.

/** Normalized comparison form: collapsed whitespace, trimmed, case-folded. */
export function normalizePosterText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLowerCase() : ''
}

/** True when a derived value would visually duplicate the hero title. */
export function duplicatesPosterTitle(
  value: string | null | undefined,
  titleText: string | null | undefined,
): boolean {
  const normalized = normalizePosterText(value)
  const title = normalizePosterText(titleText)
  return normalized !== '' && title !== '' && normalized === title
}

/**
 * First candidate with visible text that does not duplicate the hero title.
 * Returns '' (drop ephemerally) when every candidate is empty or a duplicate.
 */
export function firstPosterTextWithoutTitle(
  candidates: Array<string | null | undefined>,
  titleText: string | null | undefined,
): string {
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (text && !duplicatesPosterTitle(text, titleText)) return text
  }
  return ''
}

/**
 * Occasion strings that are placeholder-ish boilerplate, not a real occasion.
 * (The style-browser fixture default lives here; treated as missing.)
 */
export const GENERIC_OCCASION_TEXTS: ReadonlySet<string> = new Set(['complete trail network'])

/**
 * riso-stack footer caption: the occasion line above the location line.
 * Contract posture for occasion_text is `ifMissing: 'remove'`, so a missing,
 * generic, or title-duplicating occasion drops the line — it must never fall
 * back to the trail name (the composition already renders it as the hero).
 */
export function resolveRisoCaptionText(
  occasionText: string | null | undefined,
  titleText: string | null | undefined,
): string {
  const occasion = typeof occasionText === 'string' ? occasionText.trim() : ''
  const candidate = occasion && !GENERIC_OCCASION_TEXTS.has(occasion.toLowerCase()) ? occasion : ''
  return duplicatesPosterTitle(candidate, titleText) ? '' : candidate
}

/**
 * Occasion-over-location note (brutalist-slab footer note shape). Each line is
 * an independent derived value: lines that are empty or duplicate the hero
 * title are dropped; the title is never substituted.
 */
export function resolveOccasionLocationNote(
  occasionText: string | null | undefined,
  locationText: string | null | undefined,
  titleText: string | null | undefined,
): string {
  return [
    firstPosterTextWithoutTitle([occasionText], titleText),
    firstPosterTextWithoutTitle([locationText], titleText),
  ].filter(Boolean).join('\n')
}
