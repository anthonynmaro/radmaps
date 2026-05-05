// render-worker-v4/src/types.ts
//
// Worker-internal types. The shared StyleConfig + RouteStats live in the repo
// root's types/index.ts; we re-export the slices we need so callers don't reach
// across the path boundary.

import type {
  StyleConfig,
  RouteStats,
} from '../../types'

export type { StyleConfig, RouteStats }

// ─── BBox type ───────────────────────────────────────────────────────────────
// [minLng, minLat, maxLng, maxLat]
export type BBox = [number, number, number, number]

// ─── Validation result ───────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  check: string
  severity: ValidationSeverity
  message: string
  details?: Record<string, unknown>
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  checked_at: string
  validator_version: 'print-validator-v1'
  passed: boolean
}

// ─── Worker-internal: the project of a snapshot the renderer consumes ───────

export interface OrderSnapshot {
  stripe_session_id: string
  order_id: string | null
  user_id: string | null
  map_id: string | null
  product_uid: string
  style_config: StyleConfig
  geojson: GeoJSON.FeatureCollection
  stats: RouteStats
  bbox: BBox
  proof_render_hash: string
  proof_render_url: string
  map_content_hash: string
  chrome_hash: string
  hash_version: Record<string, unknown>
  provider_profile: Record<string, unknown>
  frozen_at: string
}
