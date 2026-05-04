// render-worker-v4/src/cache.ts
//
// Read/write helpers around `render_cache` and `product_renders`.
//
// `render_cache_key` includes `render_backend` per locked decision #4:
// Native and Browser caches are separate namespaces.

import { getSupabase } from './db.js'
import { logCacheLookup } from './log.js'
import type { RenderBackend, RenderClass, ValidationResult } from './types.js'

// ─── render_cache ───────────────────────────────────────────────────────────

export interface RenderCacheRow {
  render_cache_key: string
  map_content_hash: string
  render_class: RenderClass
  render_backend: RenderBackend
  map_image_path: string
  width_px: number
  height_px: number
  dpi: number
  render_ms: number | null
  created_at: string
  last_used_at: string
  use_count: number
}

export async function lookupRenderCache(renderCacheKey: string): Promise<RenderCacheRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('render_cache')
    .select('*')
    .eq('render_cache_key', renderCacheKey)
    .maybeSingle()
  if (error) {
    throw new Error(`render_cache lookup failed: ${error.message}`)
  }
  logCacheLookup({ cache: 'render_cache', hit: !!data, key: renderCacheKey })
  return data as RenderCacheRow | null
}

export async function touchRenderCache(renderCacheKey: string): Promise<void> {
  const supabase = getSupabase()
  // Atomically bump last_used_at and use_count on a hit so the LRU eviction
  // job has a usable signal.
  const { error } = await supabase.rpc('touch_render_cache', {
    p_key: renderCacheKey,
  })
  if (error) {
    // Soft-fail: a missing RPC shouldn't abort the render. Fall back to a
    // direct UPDATE.
    const { error: updateError } = await supabase
      .from('render_cache')
      .update({ last_used_at: new Date().toISOString() })
      .eq('render_cache_key', renderCacheKey)
    if (updateError) {
      // Log but don't throw — the cache is best-effort, not authoritative.
      // Caller already has the row content.
    }
  }
}

export async function insertRenderCache(row: {
  render_cache_key: string
  map_content_hash: string
  render_class: RenderClass
  render_backend: RenderBackend
  map_image_path: string
  width_px: number
  height_px: number
  dpi: number
  render_ms: number
}): Promise<void> {
  const supabase = getSupabase()
  // ON CONFLICT DO NOTHING semantics via upsert + ignoreDuplicates.
  const { error } = await supabase
    .from('render_cache')
    .upsert(row, { onConflict: 'render_cache_key', ignoreDuplicates: true })
  if (error) {
    throw new Error(`render_cache insert failed: ${error.message}`)
  }
}

// ─── product_renders ────────────────────────────────────────────────────────

export interface ProductRenderRow {
  id: string
  stripe_session_id: string
  product_uid: string
  trim_width_in: number
  trim_height_in: number
  dpi: number
  bleed_mm: number
  render_backend: RenderBackend
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

// ─── maps row updater (proof URL + hashes) ──────────────────────────────────

export async function updateMapProofUrl(input: {
  map_id: string
  proof_render_url: string
  proof_render_hash: string
  map_content_hash: string
  chrome_hash: string
}): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('maps')
    .update({
      proof_render_url: input.proof_render_url,
      proof_render_hash: input.proof_render_hash,
      map_content_hash: input.map_content_hash,
      chrome_hash: input.chrome_hash,
    })
    .eq('id', input.map_id)
  if (error) {
    throw new Error(`maps proof update failed: ${error.message}`)
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
