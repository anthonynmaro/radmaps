# RadMaps — Codex Context

## What this is
RadMaps converts GPX tracks and Strava activities into print-quality trail map posters. Users upload a GPX file, style a poster (theme, fonts, terrain overlays), then order a physical print via Gelato.

## Deployment
- **Prod URL:** https://radmaps.studio
- **Vercel project:** https://vercel.com/anthonynmaros-projects/radmaps
- **Vercel preview URL:** https://radmaps-9cip7xn4y-anthonynmaros-projects.vercel.app
- **GitHub repo:** https://github.com/anthonynmaro/radmaps (`main` branch → auto-deploys to Vercel)
- **Renderer:** Browserless/Chromium screenshots of the real Nuxt render pages; final jobs orchestrated by Railway `render-worker-v4/`
- **Database:** Supabase (`jzwpiifddtgxbfmdfqco.supabase.co`)

## Tech stack
- **Nuxt 3** (Nitro server, Vue 3, Vite) — `nuxt.config.ts`
- **@nuxt/ui** v2 — Tailwind-based component library (UButton, UAlert, UTabs, UBadge etc.)
- **@nuxtjs/supabase** — auth + DB client, SSR-safe
- **MapLibre GL JS** — map rendering in browser
- **CARTO tiles** (free, no auth) — base map tiles for minimalist preset
- **Mapbox Terrain DEM v1** — hillshade raster-dem (requires `MAPBOX_TOKEN`)
- **Mapbox Terrain v2** — vector contour lines (requires `MAPBOX_TOKEN`)
- **Stripe** — payments (live keys in `.env`)
- **Gelato** — print fulfillment API
- **Browserless** — managed Chromium screenshot API for proof and final print renders

## Project structure
```
├── components/map/
│   ├── MapPreview.vue       — poster canvas (title + MapLibre map + footer)
│   ├── StylePanel.vue       — right-side editor panel (11 collapsible sections)
│   ├── FreezeControl.vue    — freeze/unfreeze map pan & zoom
│   └── InlineEditSheet.vue  — mobile bottom-sheet for editing poster text
├── composables/
│   ├── useMap.ts            — Supabase fetch/save for a single TrailMap record
│   ├── useMapRenderer.ts    — trigger + poll proof render jobs (3s flat interval)
│   ├── useSavedThemes.ts    — localStorage-backed theme presets
│   ├── useSeo.ts            — meta tag helpers
│   └── useStyleAgent.ts     — Codex AI style assistant (SSE streaming, gated by feature flag)
├── pages/
│   ├── index.vue            — landing page
│   ├── dashboard/           — user's map list
│   ├── create/index.vue     — GPX upload + parse
│   ├── create/[mapId]/
│   │   ├── style.vue        — main editor (MapPreview + StylePanel)
│   │   ├── checkout.vue     — Stripe checkout
│   │   └── success.vue      — post-order confirmation
│   └── shop/                — premade map purchase flow
├── server/api/
│   ├── maps/index.post.ts             — create map (JSON or multipart/form-data)
│   ├── maps/[id]/render.post.ts       — trigger render worker (fire-and-forget)
│   ├── render/payload.get.ts           — server-only payload for signed render tickets
│   ├── maps/[id]/logo.post.ts         — upload poster logo to Supabase Storage
│   ├── maps/[id]/versions.*.ts        — map version history
│   ├── maps/public/[id].get.ts        — public map share (⚠ IDOR — see REMEDIATION.md)
│   ├── orders/checkout.post.ts        — create Stripe Checkout session
│   ├── orders/webhook.post.ts         — Stripe webhook → Gelato order placement
│   ├── gelato/webhook.post.ts         — Gelato fulfillment status updates
│   ├── agent/style.post.ts            — Codex AI styling agent (SSE)
│   ├── shop/checkout.post.ts          — premade map Stripe checkout
│   ├── shop/customize.post.ts         — premade map customization
│   └── strava/                        — Strava OAuth + activity import
├── utils/
│   ├── mapStyle.ts          — builds MapLibre style JSON for browser previews/renders
│   ├── styleLayerGraph.ts   — preset capability graph for layers, controls, dependencies
│   ├── gpx.ts               — GPX parser with size/entity guards
│   ├── products.ts          — premade map catalog helpers
│   ├── trail.ts             — trail segment slicing utilities
│   ├── seo.ts               — SEO metadata helpers
│   ├── print/               — print framing, bleed, safe area, DPI/provider profiles
│   └── render/              — render tickets, hashes, shared render utilities
├── data/
│   └── premade-maps.ts      — static premade map catalog
├── types/index.ts           — all shared types (StyleConfig, TrailMap, Order, etc.)
├── pages/render/            — Browserless-only render pages for proof/final screenshots
├── render-worker-v4/        — Railway queue worker for final Browserless renders
├── supabase/
│   ├── schema.sql           — full DB schema
│   └── migrations/          — incremental migrations
├── tests/                   — vitest/playwright tests, including style graph contracts
└── REMEDIATION.md           — full security + architecture remediation plan
```

## Database change policy
- Any DB change must include both the forward migration/change script and a matching rollback script in the same PR/change set.
- Rollback scripts should be executable SQL wherever possible, named so they clearly pair with the forward migration, and should undo schema, policy, index, trigger, function, and data backfill changes made by the forward script.
- If a DB change is intentionally irreversible, document why in the migration notes and provide the safest practical mitigation script instead of leaving rollback behavior unspecified.
- Keep `supabase/schema.sql` in sync with applied migrations whenever the canonical schema changes.

## Core data model

### StyleConfig (types/index.ts)
Everything that records the user's poster intent. Serialized as JSONB in the `maps.style_config` column.

`StyleConfig` is not direct renderer truth. [utils/styleLayerGraph.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/styleLayerGraph.ts) interprets that intent for the active preset and decides which fields are supported, consumed, required, ignored, or hidden. Unsupported saved fields must be preserved in JSON and ignored through `effectiveStyleConfig()`, not deleted.

Key fields:
- `preset`: `'minimalist' | 'topographic'` — which map style builder to use
- `base_tile_style`: `'carto-light' | 'carto-dark'` — CARTO tile variant
- `color_theme`: one of 6 presets (chalk/topaz/dusk/obsidian/forest/midnight)
- `print_size`: `'8x12' | '12x18' | '16x24' | '20x30' | '24x36' | '32x48'`
- `font_family`: 10 Google Fonts options
- `show_contours / show_hillshade / show_elevation_labels`: Mapbox terrain features
- `trail_name / occasion_text / location_text`: user-editable poster text
- `label_text_color / label_bg_color`: poster band colors
- `route_color / route_width / route_opacity`: GPX track styling
- `text_overlays: TextOverlay[]`: **planned** — draggable text elements (not yet built)
- `composition?: CompositionId`, `audience?: string`, `dark?: boolean`, plus grid controls (`show_grid`, `grid_scope`, `grid_color`, `grid_opacity`, `grid_weight`): additive refined-theme fields. Grid defaults to 20% opacity and can target the whole poster or map only. These are optional during Phase 0 and must not change current defaults.

### Refined themes
The refined design registry lives in [utils/themes/refined.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themes/refined.ts). It defines 13 new theme recipes with composition, audience, palette, typography, and graph-friendly map defaults. Existing theme IDs stay valid; legacy theme definitions declare `migration_target` but user maps are not migrated in Phase 0.

Poster composition routing lives in [utils/posterCompositions.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/posterCompositions.ts). `MapPreview.vue` uses those profiles for real editor/render chrome; do not add a second poster renderer for refined themes. The dev-only `/style-browser-fixture` route exists for Playwright coverage and should remain excluded from production behavior.

### TrailMap record
Stored in `maps` table. `geojson` (route), `bbox`, `stats` (distance/elevation), `style_config`, `status` (draft/rendered/ordered).

## Map rendering pipeline

### Browser preview (MapPreview.vue)
1. `buildMapStyle(styleConfig, token)` → MapLibre style JSON
2. `new maplibregl.Map({ bounds: map.bbox, fitBoundsOptions: { padding } })`
3. On load: `populateRouteSource()` → `source.setData(geojson)`
4. Style config watcher asks the layer graph for reload dependencies, then uses `mapInstance.setStyle(newStyle)` only when required; route geometry/source updates and segment updates remain explicit data paths.

### Style layer graph
[utils/styleLayerGraph.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/styleLayerGraph.ts) has one graph per `StylePreset`. The graph declares feature support, required fields, ignored fields, consumed fields, sources, canonical layer slots, update modes, and viewport scaling metadata.

Canonical slot order:
`background → base → water-land-buildings → terrain → contours → editable-roads → labels-pois → route-casing → route → segments-handles`

Map controls must be graph-gated. Do not show controls for baked-only or unsupported features, and do not expose destructive toggles for required features. Use `getVisibleStyleControls()`, `styleUsesField()`, `effectiveStyleConfig()`, and `getGraphFullReloadFields()` instead of hardcoded preset checks.

### Screenshot render (Browserless + render-worker-v4)
The current renderer screenshots the real Nuxt/Vue/MapLibre poster in Chromium. `MapPreview.vue` is the only poster renderer.

Proof path:
1. `server/api/maps/[id]/render.post.ts` resolves proof framing with `getPrintFraming`.
2. It signs a short-lived render ticket with `utils/render/renderTicket.ts`.
3. Browserless screenshots `/render/map/[id]?ticket=...`.
4. `/api/render/payload` validates the ticket and returns only the exact map payload the page may render.
5. The proof image is validated, uploaded, and stored on the map row as `proof_render_url`, `thumbnail_url`, and `render_url`.

Final path:
1. Checkout stores the selected concrete Gelato `product_uid`.
2. `server/utils/snapshot.ts` writes an immutable snapshot keyed by `stripe_session_id`.
3. The Stripe webhook inserts a `print_render_jobs` row.
4. `render-worker-v4/src/queue/processJob.ts` calls `renderFinalScreenshot.ts`.
5. Browserless screenshots `/render/session/[stripeSessionId]?ticket=...`.
6. The worker validates, uploads, inserts `product_renders`, and submits to Gelato.

`render-worker-v4` is not a separate poster renderer; it is the final print queue consumer/orchestrator. It still must run for paid custom orders because it bounds Browserless concurrency, writes final artifacts, and submits Gelato orders.

Readiness is explicit. Browserless waits for `window.__RENDER_READY === true` and checks `window.__RADMAPS_RENDER_STATUS`; do not replace this with a fixed sleep or selector-only wait.

The human renderer guide is `docs/RENDERING.md`; update it whenever renderer behavior, product sizes, aspect ratios, or provider geometry changes. The cleanup/security review lives in `docs/ARCHITECTURE_SECURITY_REVIEW.md`; update it when removing renderer paths, changing queue boundaries, or accepting/defering renderer-adjacent security risks.

### Thumbnail/share preview policy
Proof renders are the canonical thumbnails. Dashboard/home previews, checkout previews, Stripe checkout images, and public share metadata should prefer `proof_render_url → thumbnail_url → render_url`.

The editor schedules thumbnail refreshes only after style changes sit idle for 7 seconds, throttled to once every 30 seconds during continuous editing. Clicking Share forces a latest-state proof render first, then marks the map public and copies the link. Do not build a second thumbnail renderer; use the signed Browserless proof path so shared/social images match the approved editor state.

Checkout is product-first: users choose size/material before Browserless proof rendering starts. While that selected proof is rendering, checkout should show the live `MapPreview.vue` poster state and hide older proof/thumbnail URLs until the current product render is ready.

## mapStyle.ts patterns
- `buildMapStyle()` keeps the public API but renders from `effectiveStyleConfig(config)` so saved unsupported fields are ignored without migration.
- Layer order follows the graph's canonical slots: `background → base → water-land-buildings → terrain → contours → editable-roads → labels-pois → route-casing → route → segments-handles`.
- Viewport scaling is graph metadata-driven through `metadata.radmaps.scale`; do not reintroduce layer-ID regex scaling.
- CARTO tiles used for minimalist preset (free, no auth required)
- Mapbox DEM/terrain sources only included in style when their feature is enabled (avoid unnecessary TileJSON fetches and 401s)
- `mapboxTerrainV2Source` has `minzoom: 9` — MapLibre uses those tiles underzoomed so contours appear at any zoom level
- Both style builders include `glyphs` URL (Mapbox fonts via token) so elevation labels work
- Elevation label font: `['DIN Offc Pro Medium', 'Arial Unicode MS Regular']`

## Poster canvas layout (MapPreview.vue)
CSS container queries (`container-type: size`) on `.poster-canvas` enable `cqh`/`cqw` units that scale all typography proportionally. The editor canvas is intentionally fixed to `aspect-ratio: 2 / 3`; print render mode uses exact dimensions from `printContext`.

Structure: title band (shrink-0) → MapLibre map area (flex-1) → footer band (shrink-0).

## Print Sizes And Aspect Ratio

RadMaps currently sells only one aspect family: 2:3. The editor, proof, checkout products, and final render must all stay in that shape so the route does not crop, stretch, letterbox, or silently reframe after the user approves the design.

Supported sizes: `8x12`, `12x18`, `16x24`, `20x30`, `24x36`, `32x48`.

Source-of-truth files:
- `types/index.ts` — `PrintSize` union and `DEFAULT_STYLE_CONFIG.print_size`
- `utils/products.ts` — visible catalog, prices, material availability, Gelato product UIDs
- `utils/print/providerProfile.ts` — provider geometry, bleed, safe margin, max DPI, legacy aliases
- `utils/print/printFraming.ts` — proof/final DPI and pixel boxes

Important details:
- `24x36` is the default style size.
- `32x48` is capped at 200 DPI.
- final renders include bleed; `24x36` with 3 mm bleed at 300 DPI is about `7271x10871`, not `7200x10800`.
- final renders use half-size CSS viewport pixels with `deviceScaleFactor: 2`; `render-worker-v4/src/queue/normalizeFinalScreenshot.ts` crops DPR rounding surplus back to exact provider pixels before validation/upload.
- legacy aliases exist only for old rows and stale requests: `8x10→8x12`, `11x14→12x18`, `16x20→16x24`, `18x24→24x36`.

Changing aspect ratio later is a product project, not a catalog tweak. Add explicit editor aspect state, update MapPreview/editor frozen camera/overlays/thumbnails/checkout, separate aspect family from size if needed, update hashes, build visual regression fixtures, and order physical samples before enabling production sales.

## StylePanel.vue patterns
- Local reactive copy of `modelValue` (StyleConfig)
- All changes go through `set(key, value)` which emits `update:modelValue`
- Map-style controls are shown only when `computeSectionVisibility()` and the layer graph say the active preset consumes them.
- Baked raster features, such as labels in CARTO/Mapbox/Stadia raster tiles, must not expose fake color/opacity/density controls. `stadia-toner` may expose its label toggle because it switches tile families.
- Sub-components defined as `defineComponent` render functions at bottom of `<script setup>`
- `applyTheme(theme)` batch-applies all theme colors at once
- Section accordion via hand-rolled `Section` component with `ref(true)` toggle

## Editor state (style.vue)
- `styleConfig` ref initialized from `DEFAULT_STYLE_CONFIG`, merged with DB record on load
- Deep watcher debounces saves to DB (600ms)
- `useMap()` composable handles fetch + `updateStyle()` optimistic saves
- Layout: `h-screen flex flex-col` → header (sticky) + `flex-1 flex` → main (MapPreview) + aside (StylePanel, w-[320px])

## Feature flags and admin gating
RadMaps has a first-party Supabase-backed feature flag system. Use it for new
feature rollout, beta access, staff-only previews, environment-scoped behavior,
and reversible UI/API gates.

Source-of-truth files:
- `utils/knownFlags.ts` — typed flag constants. Add keys here and use
  `FLAGS.SOME_FLAG`, never raw string literals like `'some_flag'` in app code.
- `utils/featureFlags.ts` — pure validation/evaluation logic.
- `server/utils/featureFlags.ts` — server-side Supabase lookup/cache and
  `isFeatureEnabled(event, flagKey, opts)`.
- `composables/useFeatureFlags.ts` + `plugins/feature-flags.ts` — Nuxt
  server-prefetched client state and `useFeatureFlag(flagKey)`.
- `/admin/flags` + `/api/admin/flags/*` — admin management surface, gated by
  `flags:manage`.

Default rule: **do not hardcode role checks for feature visibility or rollout**.
If the question is "who should see this feature while we test or launch it?",
use a feature flag. Client UI should call `useFeatureFlag(FLAGS.X)` and server
handlers should call `requireStaff`/auth first, then `isFeatureEnabled`.

Feature flags are **not authorization boundaries**. Keep hardcoded business
permissions in code for critical admin/security invariants: staff management,
super-admin bootstrap/protection, `requireStaff(event, 'action')` checks,
payment/webhook/order ownership, render-ticket validation, and destructive or
privileged mutations. In short: permissions decide whether an operation is
allowed; feature flags decide whether an otherwise-allowed feature is available.

Flag behavior details:
- Runtime environment resolves `FEATURE_FLAG_ENV → VERCEL_ENV → NODE_ENV`.
- Public `/api/flags` returns only enabled flags as `Record<string, true>`;
  disabled/missing/archived all mean false.
- Archived flags are ignored but kept for history; do not delete flag rows.
- Every admin mutation writes `feature_flag_events` audit history.

## Webhook URLs (production)
| Service | URL |
|---|---|
| Stripe | `https://radmaps.studio/api/orders/webhook` |
| Gelato | `https://radmaps.studio/api/gelato/webhook` |
| Strava OAuth callback | `https://radmaps.studio/auth/strava-callback` |
| Supabase auth redirect | `https://radmaps.studio/auth/confirm` |

## Planned next work (Phase 2+)
- **Pinia store** for editor state (`useEditorStore`): `styleConfig`, `textOverlays`, `activeOverlayId`, `isDirty`
- **`text_overlays: TextOverlay[]`** in StyleConfig — draggable/resizable text elements using `interactjs`
- **UTabs** top-level panel split: Map Style / Text / Export
- **`@nuxtjs/google-fonts`** for self-hosted fonts (removes Google CDN dep from render worker)
- **Rate limiting + queue tuning** for Browserless proof/final render concurrency
- **Scout / `useStyleAgent`** enhancements beyond the current feature-flagged admin entry point

## Open Security & Reliability Issues
> Full details and sprint plan: `REMEDIATION.md`

**CRITICAL (fix before next user-facing release):**
- `maps/public/[id].get.ts` — **IDOR**: public endpoint uses service key, bypasses RLS, returns any user's private map data. Fix: add `is_public` column + query only public maps.
- Logo/image rendering — **SSRF / remote asset risk**: logos and future user-provided images must be whitelisted or copied to trusted storage before print rendering.
- `orders/webhook.post.ts` — **Duplicate orders**: no Stripe event deduplication; webhook retries place duplicate Gelato orders. Fix: `processed_stripe_events` table.

**HIGH:**
- `gelato/webhook.post.ts` — conditional secret check silently allows unsigned webhooks when `GELATO_WEBHOOK_SECRET` is not set.
- `maps/[id]/render.post.ts` — proof renders need rate limiting and abuse protection (spam → Browserless exhaustion).
- `orders/webhook.post.ts` — Gelato placement failure still marks order `in_production`.
- `maps/[id]/logo.post.ts` — client-controlled MIME type can be spoofed; `mapId` in storage path not validated as UUID (path traversal).
- `maps/index.post.ts` — no GeoJSON size limit (huge uploads crash render worker OOM).

## Environment variables
All vars in `.env` (gitignored). Production values set in Vercel dashboard.
See `.env.example` for the full list with comments. Key ones:
- `SUPABASE_*` — database + auth
- `MAPBOX_TOKEN` — Mapbox terrain tiles (must have terrain + raster scopes)
- `STADIA_API_KEY` / optional `NUXT_PUBLIC_STADIA_API_KEY` — Stadia/Stamen raster tiles for Watercolor/Toner presets; client-visible, restrict by domain in Stadia
- `STRIPE_*` — payments; Stripe's documented sandbox prefixes are `sk_test_` and `pk_test_`
- `GELATO_API_KEY` — print fulfillment
- `GELATO_ORDER_TYPE` — use `draft` for local/full E2E tests; use `order` only for intentional physical fulfillment
- `BROWSERLESS_TOKEN` / `BROWSERLESS_ENDPOINT` / `BROWSERLESS_TIMEOUT_MS` — screenshot provider
- `RENDER_TICKET_SECRET` — short-lived signed render URL secret
- `DATABASE_URL` — Supabase pooler URL for the final print queue consumer
- `ANTHROPIC_API_KEY` — AI styling agent

For local full E2E, run the final queue from the repo root with `npm run print-worker:dev`. That launcher merges root `.env` with optional `render-worker-v4/.env` overrides so Browserless/Gelato/render-ticket secrets do not need to be duplicated locally. Standalone Railway worker deployments still need their own service env configured.

## Known gotchas
- MapLibre does NOT resolve `mapbox://` scheme URLs — always use explicit `https://api.mapbox.com/...` endpoints
- Mapbox terrain-v2 vector tiles only have contour data from zoom 9+. Source `minzoom: 9` fixes this by causing MapLibre to underzoom those tiles
- `container-type: size` on the poster canvas is required for `cqh` units to work
- `height: 100%` (not `max-height: 100%`) is needed on the poster canvas div so `aspect-ratio` has a concrete dimension to derive from
- The editor aspect ratio is deliberately fixed to 2:3; do not reintroduce mixed-aspect product choices without rebuilding the editor aspect flow
- Use `getPrintFraming(productUid, renderClass)` for every print/proof dimension; never hand-compute size tables in routes or workers
- Proof renders double as thumbnails and social previews; keep `proof_render_url`, `thumbnail_url`, and `render_url` aligned for user-facing map previews
- Signed render tickets protect server-only payloads; never put shared secrets directly in third-party screenshot URLs
- Browserless render readiness must wait on `window.__RENDER_READY`, not a fixed delay
- For Gelato draft preflight without Stripe, use `npm run gelato:draft-bypass -- --map-id=<map-uuid>` with `GELATO_ORDER_TYPE=draft`; this exercises the same `render-worker-v4` `processJob` path but does not validate Stripe Checkout/webhooks
- For signed webhook smoke tests without hosted Checkout, use `npm run stripe:webhook-sim -- --map-id=<map-uuid>`; this creates a snapshot, signs a local `checkout.session.completed` payload, and lets the normal final queue submit a Gelato draft
- Browserless timeout is capped at `BROWSERLESS_TIMEOUT_MS=60000` on the current plan; large final renders rely on DPR 2 screenshot normalization to stay under that cap
- Supabase `serverSupabaseUser` vs `serverSupabaseClient` — always use these in server routes, never raw env vars
- The style page uses `layout: false` (no default layout wrapper) so it can control its own full-height flex layout
- **StyleConfig has 3 sources of truth** (DB, `useMap` composable, local ref in `style.vue`) until Pinia store is implemented — watcher debounce is 600ms in `useMap.ts`
- **`render-worker-v4/` owns final queue orchestration** — it should call Browserless, validate, upload, insert `product_renders`, and submit to Gelato
- `useStyleAgent` is available through the feature-flagged Scout admin surface; keep server auth + feature flag checks together
- `TextOverlay[]` type is defined in `types/index.ts` but the UI for creating/editing text overlays is not implemented
