// utils/render/hash.ts
//
// Phase 0 foundation: pure SHA-256 helpers for the two-layer hash model.
//
// All helpers are pure functions of their inputs. There is no global
// state, no I/O, no caching — same inputs MUST always produce the
// same hex digest. The tests in tests/render-hash.test.ts enforce
// this property.
//
// We use Node's built-in `crypto` module (no extra deps) and a tiny
// `stableStringify` helper so that JS object key-order changes don't
// produce hash drift.

import { createHash } from 'node:crypto'

import type { StyleConfig, RouteStats } from '~/types'
import { FIELD_LAYER, type FieldLayer } from './fieldLayer'
import { HASH_VERSION } from './hashVersion'
import type { PrintFraming } from '../print/printFraming'
import { buildThemeDataContext, themeDataContextSignature, type ThemeDataContextInput } from '../themeDataContract'

// ─── Stable JSON serialization ───────────────────────────────────────────────
//
// `JSON.stringify` preserves the insertion order of object keys in V8.
// That means rebuilding an object with reordered properties (e.g. by
// running it through a deserializer) can produce a different string,
// and therefore a different hash, despite logical equivalence.
//
// `stableStringify` walks the value recursively and serializes objects
// with sorted keys at every depth. Arrays preserve their order
// (semantically meaningful). Primitives are handed off to
// JSON.stringify directly.
//
// This avoids pulling in an external dep like `json-stable-stringify`.

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts: string[] = []
  for (const k of keys) {
    const v = obj[k]
    // Skip undefined values to mirror JSON.stringify behaviour for
    // optional fields. Without this, { a: undefined } and {} hash
    // differently, which would defeat optional-field stability.
    if (v === undefined) continue
    parts.push(JSON.stringify(k) + ':' + stableStringify(v))
  }
  return '{' + parts.join(',') + '}'
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// ─── Layer projection ────────────────────────────────────────────────────────
//
// `pickLayer` returns a new object containing only the StyleConfig
// fields whose FIELD_LAYER classification matches `layer`. Used by
// computeMapContentHash and computeChromeHash so each hash sees only
// its own slice.

function pickLayer(styleConfig: StyleConfig, layer: FieldLayer): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const cfg = styleConfig as unknown as Record<string, unknown>
  // Iterate FIELD_LAYER (not styleConfig) so the projected set is
  // deterministic regardless of which optional StyleConfig fields
  // happen to be present on a given input.
  for (const [key, classification] of Object.entries(FIELD_LAYER) as Array<[string, FieldLayer]>) {
    if (classification !== layer) continue
    // Skip undefined values for the same reason as stableStringify.
    if (cfg[key] === undefined) continue
    result[key] = cfg[key]
  }
  return result
}

// ─── Hash inputs ─────────────────────────────────────────────────────────────

/**
 * `map_content_hash` — sha256 over every 'map' StyleConfig field plus
 * the route geojson, framing dimensions, and HASH_VERSION.map.
 *
 * Framing is included because rendering at a different canvas size or
 * DPI produces a different pixel image; conversely, two products that
 * would happen to share dimensions can share the cache row.
 */
export function computeMapContentHash(
  styleConfig: StyleConfig,
  geojson: GeoJSON.FeatureCollection,
  framing: PrintFraming,
  dataContextInput: ThemeDataContextInput = {},
): string {
  const mapFields = pickLayer(styleConfig, 'map')
  const themeDataContext = themeDataContextSignature(buildThemeDataContext({
    ...dataContextInput,
    styleConfig,
    geojson,
  }))
  const framingDims = {
    fullWidthPx: framing.fullWidthPx,
    fullHeightPx: framing.fullHeightPx,
    dpi: framing.dpi,
    bleedIn: framing.bleedIn,
    trimWidthIn: framing.trimWidthIn,
    trimHeightIn: framing.trimHeightIn,
  }
  const payload = stableStringify({
    mapFields,
    geojson,
    themeDataContext,
    framing: framingDims,
    hashVersion: HASH_VERSION.map,
  })
  return sha256(payload)
}

/**
 * `chrome_hash` — sha256 over every 'chrome' StyleConfig field plus
 * the computed RouteStats and HASH_VERSION.chrome.
 *
 * Stats appear here because chrome bands display distance/elevation
 * etc. — they don't change the map raster but they do change the
 * composited proof/final.
 */
export function computeChromeHash(
  styleConfig: StyleConfig,
  stats: RouteStats,
  dataContextInput: ThemeDataContextInput = {},
): string {
  const chromeFields = pickLayer(styleConfig, 'chrome')
  const themeDataContext = themeDataContextSignature(buildThemeDataContext({
    ...dataContextInput,
    styleConfig,
    stats,
  }))
  const payload = stableStringify({
    chromeFields,
    stats,
    themeDataContext,
    hashVersion: HASH_VERSION.chrome,
  })
  return sha256(payload)
}

/**
 * `proof_render_hash` — composition of map + chrome.
 *
 * Used as the storage key for `renders/proof/{map_id}/{...}.jpg`.
 * If two maps produce the same map_content_hash AND chrome_hash they
 * will produce the same composited proof, so they share the same key.
 */
export function computeProofRenderHash(mapContentHash: string, chromeHash: string): string {
  return sha256(stableStringify({ mapContentHash, chromeHash }))
}

/**
 * `print_hash` — final-print artifact key.
 *
 * Includes provider product UID, DPI, and bleed_mm so different
 * products with the same design produce different print files (e.g.
 * 18×24 vs 24×36 of the same poster). Includes HASH_VERSION.print so
 * a print-format bump invalidates final artifacts but not proofs.
 */
export function computePrintHash(input: {
  mapContentHash: string
  chromeHash: string
  productUid: string
  dpi: number
  bleedMm: number
}): string {
  return sha256(
    stableStringify({
      mapContentHash: input.mapContentHash,
      chromeHash: input.chromeHash,
      productUid: input.productUid,
      dpi: input.dpi,
      bleedMm: input.bleedMm,
      hashVersion: HASH_VERSION.print,
    }),
  )
}
