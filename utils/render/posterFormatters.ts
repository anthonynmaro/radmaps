// utils/render/posterFormatters.ts
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
    const d = Math.abs(Math.floor(v))
    const m = Math.round((Math.abs(v) - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }

  return { lat: fmt(lat, 'N', 'S'), lng: fmt(lng, 'E', 'W') }
}

export function formatCoordsFromPoint(coords: { lat: number, lng: number } | null | undefined): FormattedCoords | null {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null

  const fmt = (v: number, pos: string, neg: string) => {
    const d = Math.abs(Math.floor(v))
    const m = Math.round((Math.abs(v) - d) * 60)
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
