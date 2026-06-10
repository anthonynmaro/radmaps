/**
 * Order snapshot helper — freezes a per-Stripe-session immutable snapshot
 * of the design the customer just approved.
 *
 * Plan v4 §"Snapshot lifecycle". Insert-once, never updated. Keyed by
 * stripe_session_id so multiple checkout sessions for the same cart cannot
 * collide.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { getPrintFraming } from '~/utils/print/printFraming'
import {
  computeMapContentHash,
  computeChromeHash,
  computeProofRenderHash,
} from '~/utils/render/hash'
import { HASH_VERSION } from '~/utils/render/hashVersion'

export interface FreezeSnapshotInput {
  stripeSessionId: string
  mapId: string
  productUid: string
  userId: string | null            // null for guest flow
}

export interface FreezeSnapshotResult {
  stripeSessionId: string
  mapContentHash: string
  chromeHash: string
  proofRenderHash: string
}

/**
 * Insert a frozen snapshot row at Stripe Checkout session creation time.
 *
 * Reads the current `maps` row, computes the layered hashes, and writes
 * them along with the design payload to `order_snapshots`. The webhook
 * handler will read the snapshot back by `stripe_session_id` rather than
 * re-reading the (mutable) maps row.
 *
 * Idempotent: if the row already exists for this `stripe_session_id`,
 * does nothing and returns the existing hashes. (In practice this should
 * never happen — Stripe session IDs are unique per session — but we
 * defend against it anyway.)
 */
export async function freezeOrderSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: FreezeSnapshotInput,
): Promise<FreezeSnapshotResult> {
  const { stripeSessionId, mapId, productUid, userId } = input

  // 1. Load the design — this is what the customer just approved.
  const { data: map, error: mapError } = await supabase
    .from('maps')
    .select('id, user_id, style_config, geojson, stats, bbox, render_url, proof_render_url, location_label, location_city, location_region, location_country, location_lng, location_lat')
    .eq('id', mapId)
    .single()

  if (mapError || !map) {
    throw new Error(`freezeOrderSnapshot: map ${mapId} not found: ${mapError?.message ?? 'no row'}`)
  }

  // 2. Resolve the framing (drives the printSize-dependent render dimensions)
  //    and provider profile (drives bleed, max DPI, accepted formats).
  const providerProfile = getProviderProfile(productUid)
  const framing = getPrintFraming(productUid, 'final')

  // 3. Compute the layered hashes. mapContentHash includes the geojson +
  //    framing dimensions; chromeHash includes the stats. Both incorporate
  //    HASH_VERSION so a renderer/style/template bump invalidates the cache.
  const mapContentHash = computeMapContentHash(map.style_config, map.geojson, framing, map)
  const chromeHash = computeChromeHash(map.style_config, map.stats, map)
  const proofRenderHash = computeProofRenderHash(mapContentHash, chromeHash)

  // 4. Pick the "proof" URL we point the customer at. Until the v4 render
  //    endpoint is rolled out, the legacy `render_url` is the proof. Once
  //    `proof_render_url` is being populated, prefer that.
  const proofRenderUrl = map.proof_render_url ?? map.render_url
  if (!proofRenderUrl) {
    throw new Error(
      `freezeOrderSnapshot: map ${mapId} has no render_url — cannot freeze a snapshot for an unrendered map`,
    )
  }

  // 5. Insert. ON CONFLICT DO NOTHING in case a webhook fired faster than
  //    the checkout endpoint returned (extremely unlikely but possible).
  const payload = {
    stripe_session_id: stripeSessionId,
    order_id: null,                                        // populated by webhook when order row is created
    user_id: userId,
    map_id: mapId,
    product_uid: productUid,
    style_config: map.style_config,
    geojson: map.geojson,
    stats: map.stats,
    bbox: map.bbox,
    proof_render_hash: proofRenderHash,
    proof_render_url: proofRenderUrl,
    map_content_hash: mapContentHash,
    chrome_hash: chromeHash,
    hash_version: HASH_VERSION,
    provider_profile: providerProfile,
  }

  const { error } = await supabase
    .from('order_snapshots')
    .upsert(payload, { onConflict: 'stripe_session_id', ignoreDuplicates: true })

  if (error) {
    throw new Error(`freezeOrderSnapshot: insert failed: ${error.message}`)
  }

  return { stripeSessionId, mapContentHash, chromeHash, proofRenderHash }
}

/**
 * Look up a previously-frozen snapshot. Webhook handlers and the print
 * render queue consumer call this; they MUST NOT read live `maps` data
 * for the same fields.
 */
export async function loadOrderSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  stripeSessionId: string,
) {
  const { data, error } = await supabase
    .from('order_snapshots')
    .select('*')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle()

  if (error) throw new Error(`loadOrderSnapshot: ${error.message}`)
  return data
}
