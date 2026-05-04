// utils/render/storagePaths.ts
//
// Phase 0 foundation: Supabase Storage path builders.
//
// The exact path layout (per v4 §"Storage paths"):
//
//   renders/cache/map/{render_cache_key}.png
//   renders/proof/{map_id}/{proof_render_hash}.jpg
//   renders/final/{stripe_session_id}/{product_uid}/{print_hash}.jpg
//
// v4 locked decision #5: final-print path is keyed on
// `stripe_session_id`, NOT `order_id`. Each Stripe Checkout session
// gets its own immutable snapshot (including its own final artifact)
// so that historical sessions remain valid when a customer creates a
// new session for the same order.

/** `renders/cache/map/{render_cache_key}.png` — raw map (oversized, no chrome). */
export function getMapCachePath(renderCacheKey: string): string {
  return `renders/cache/map/${renderCacheKey}.png`
}

/** `renders/proof/{map_id}/{proof_render_hash}.jpg` — proof composite. */
export function getProofPath(mapId: string, proofRenderHash: string): string {
  return `renders/proof/${mapId}/${proofRenderHash}.jpg`
}

/**
 * `renders/final/{stripe_session_id}/{product_uid}/{print_hash}.jpg`
 *
 * Note: keyed on stripe_session_id per v4, not order_id.
 */
export function getFinalPrintPath(
  stripeSessionId: string,
  productUid: string,
  printHash: string,
): string {
  return `renders/final/${stripeSessionId}/${productUid}/${printHash}.jpg`
}
