// render-worker-v4/src/cache.ts
//
// Read/write helpers around `product_renders` and `order_snapshots`.

import { getSupabase } from './db.js'
import type { ValidationResult } from './types.js'

// ─── product_renders ────────────────────────────────────────────────────────

export interface ProductRenderRow {
  id: string
  stripe_session_id: string
  product_uid: string
  trim_width_in: number
  trim_height_in: number
  dpi: number
  bleed_mm: number
  render_backend: 'browser'
  map_content_hash: string
  chrome_hash: string
  print_hash: string
  artifact_path: string
  validation_result: ValidationResult
  created_at: string
}

export async function lookupProductRender(input: {
  stripe_session_id: string
  product_uid: string
  print_hash: string
}): Promise<ProductRenderRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('product_renders')
    .select('*')
    .eq('stripe_session_id', input.stripe_session_id)
    .eq('product_uid', input.product_uid)
    .eq('print_hash', input.print_hash)
    .maybeSingle()
  if (error) {
    throw new Error(`product_renders lookup failed: ${error.message}`)
  }
  return data as ProductRenderRow | null
}

export async function insertProductRender(row: Omit<ProductRenderRow, 'id' | 'created_at'>): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('product_renders')
    .upsert(row, {
      onConflict: 'stripe_session_id,product_uid,print_hash',
      ignoreDuplicates: true,
    })
  if (error) {
    throw new Error(`product_renders insert failed: ${error.message}`)
  }
}

// ─── order_snapshots reader (Phase 8 final-print path) ──────────────────────

export interface OrderSnapshotRow {
  stripe_session_id: string
  order_id: string | null
  user_id: string | null
  map_id: string | null
  product_uid: string
  style_config: unknown
  geojson: unknown
  stats: unknown
  bbox: number[]
  proof_render_hash: string
  proof_render_url: string
  map_content_hash: string
  chrome_hash: string
  hash_version: Record<string, unknown>
  provider_profile: Record<string, unknown>
  location_label: string | null
  location_city: string | null
  location_region: string | null
  location_country: string | null
  location_lng: number | null
  location_lat: number | null
  location_elevation_m: number | null
  location_metadata_source: string | null
  location_metadata_enriched_at: string | null
  frozen_at: string
}

export async function loadOrderSnapshot(stripeSessionId: string): Promise<OrderSnapshotRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('order_snapshots')
    .select('*')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle()
  if (error) {
    throw new Error(`order_snapshots lookup failed: ${error.message}`)
  }
  return data as OrderSnapshotRow | null
}
