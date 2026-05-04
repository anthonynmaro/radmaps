// render-worker-v4/src/types.ts
//
// Request/response shapes + worker-internal types. The shared StyleConfig +
// RouteStats live in the repo root's types/index.ts; we re-export the slices
// we need so callers don't reach across the path boundary.

import { z } from 'zod'

import type {
  StyleConfig,
  RouteStats,
} from '../../types'

// Phase 10: PRESET_RENDERER + getRendererForPreset live in the shared
// utils/render/presetRenderer.ts so the Nuxt server (render endpoint)
// and the worker can never drift on which backend serves which preset.
import {
  PRESET_RENDERER,
  getRendererForPreset,
  type RenderBackend,
} from '../../utils/render/presetRenderer.js'

export type { StyleConfig, RouteStats, RenderBackend }
export { PRESET_RENDERER }

export type RenderClass = 'proof' | 'final'

/**
 * `pickBackend` is the worker-internal alias for `getRendererForPreset`
 * — kept for naming continuity inside this package. New code should
 * prefer `getRendererForPreset` from the shared module.
 */
export function pickBackend(preset: string | undefined, override?: RenderBackend): RenderBackend {
  return getRendererForPreset(preset, override)
}

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

// ─── Zod schemas for request bodies ──────────────────────────────────────────

const bboxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .describe('[minLng, minLat, maxLng, maxLat]')

const geojsonSchema = z
  .object({ type: z.string(), features: z.array(z.any()) })
  .passthrough()

const statsSchema = z.object({}).passthrough()

const styleConfigSchema = z
  .object({
    preset: z.string().optional(),
    print_size: z.string().optional(),
    map_zoom: z.number().optional(),
    map_center: z.tuple([z.number(), z.number()]).optional(),
    map_editor_width: z.number().optional(),
    show_logo: z.boolean().optional(),
    logo_url: z.string().optional(),
  })
  .passthrough()

export const renderProofRequestSchema = z.object({
  map_id: z.string().uuid(),
  style_config: styleConfigSchema,
  geojson: geojsonSchema,
  stats: statsSchema,
  bbox: bboxSchema,
  product_uid: z.string(),
  render_class: z.literal('proof'),
  render_backend: z.enum(['native', 'browser']).optional(),
  map_content_hash: z.string(),
  chrome_hash: z.string(),
  skip_map_render: z.boolean().optional(),
})

export type RenderProofRequest = z.infer<typeof renderProofRequestSchema>

export const renderFinalRequestSchema = z.object({
  stripe_session_id: z.string(),
  print_hash: z.string(),
})

export type RenderFinalRequest = z.infer<typeof renderFinalRequestSchema>

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
