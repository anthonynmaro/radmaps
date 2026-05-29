// utils/render/hashVersion.ts
//
// Phase 0 foundation: scoped HASH_VERSION constants.
//
// HASH_VERSION participates in every content hash so we can invalidate
// caches deterministically when render-pipeline internals change without
// having to migrate Supabase Storage manually.
//
// Scoped per layer per the v4 plan §"Two-layer model":
//
//   - HASH_VERSION.map fields participate in `map_content_hash`. Bumping
//     any of these invalidates proof/final screenshots that include the map.
//
//   - HASH_VERSION.chrome fields participate in `chrome_hash`. Bumping
//     any of these invalidates `proof_render_hash` and downstream prints
//     but NOT the map-image cache. This is the whole point of two-layer
//     hashing — chrome iteration shouldn't waste 90% of cache hits.
//
//   - HASH_VERSION.print fields participate in `print_hash` only.
//     Bumping any of these invalidates `product_renders` artifacts but
//     leaves the proof + map caches intact.
//
// Bump conventions:
//   - {category}-v{N} where N increments on a breaking change.
//   - fontBundle uses the SHA-256 short-hash of all fonts/*.ttf bytes
//     (computed by scripts/validate-fonts.ts). Bumping fonts/ without
//     updating this hash leaves chrome cache stale on next render.

export const HASH_VERSION = {
  map: {
    /** Map renderer engine and its major version. */
    renderer: 'chromium-maplibre-gl-v1',
    /** mapStyle.ts compiler revision. */
    styleCompiler: 'style-v17',
    /** DPI tiering policy (currently per-product via maxDpi). */
    dpiPolicy: 'dpi-tiered-v1',
    /** Pixel-density and oversized-viewport math. */
    printScaling: 'browser-screenshot-dpr-v7',
    /** Tile fetch + LRU disk-cache pipeline. */
    tilePipeline: 'browser-tiles-v1',
    /** First-party watercolor art-tile compositor revision. */
    watercolorRenderer: 'watercolor-art-compositor-v5',
    /** First-party watercolor texture/artwork pack revision. */
    watercolorTexturePack: 'watercolor-asset-pack-v2-dev',
  },
  chrome: {
    /** Vue/MapPreview poster chrome template. */
    chromeTemplate: 'vue-map-preview-v1',
    /** Self-hosted font bundle revision. SHA-256 short-hash of fonts/*.ttf
     *  bytes. Auto-computed by scripts/validate-fonts.ts; if you change
     *  any TTF, re-run the script and copy the new hash here. */
    fontBundle: 'fonts-ea0503b68d9d',
  },
  print: {
    /** Provider profile schema (bleed/safe/maxDpi semantics). */
    printProfile: 'gelato-poster-v1',
    /** Final artifact format + color profile. */
    outputFormat: 'jpeg-srgb-v1',
  },
} as const

export type HashVersion = typeof HASH_VERSION
