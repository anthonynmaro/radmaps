# Render Pipeline v4 — Handoff Document

**Project:** RadMaps render-worker-v4
**Status as of:** 2026-05-04
**Hand-off audience:** the engineering team taking ownership of v4 from this point forward.

This document is the single source of truth for the current state. Read it before you read anything else. The architectural spec it implements is `RadMaps_Render_Pipeline_Plan_v4.md` (parent directory of this repo).

---

## TL;DR

- **Goal:** replace the production Puppeteer-based renderer (`render-worker/`) with a more stable, faster, parity-preserving pipeline based on **MapLibre Native** (map raster) + **Sharp/librsvg** (chrome compositor) + a **Postgres `FOR UPDATE SKIP LOCKED` job queue** + **per-Stripe-session immutable snapshots**.
- **Architectural status:** the design is sound and locked. See `RadMaps_Render_Pipeline_Plan_v4.md` for decisions and rationale.
- **Operational status:** the system has **never run end-to-end in any environment**. Every render that has ever been performed by v4 was via the local test harness `scripts/test-render.ts` against two production maps. The HTTP server has not been exercised. The queue consumer has never been booted against a real DB row. The migration has not been applied to staging.
- **Visible parity to the editor:** structurally close on the two test fixtures, with three known gaps: (1) leader-line labels overflowing the left edge, (2) map terrain detail looks thinner in v4 than in editor, (3) branding cluster sizes feel off. Coverage is 2 maps × 1 print size × 2 themes — the combinatorial space (17 themes × 5 sizes × many toggle combinations) is **wholly untested**.
- **Production is still served by the legacy `render-worker/` (Puppeteer)**, with feature flags (`RENDER_PIPELINE_V4_ENABLED`, `RENDER_PIPELINE_V4_QUEUE_ENABLED`) gated OFF.
- **Recommended first action:** apply the migration to staging and verify rollback. Until that lands, none of the rest of v4 can be exercised end-to-end.

---

## 1. The vision in one screen

Legacy `render-worker/` (still in production) has three concrete failure modes:
1. **WebGL/GPU instability** in headless Chromium. Last week alone produced five WebGL/Mesa workaround commits (`27c1835` Mesa libs, `27761e3` `--in-process-gpu`, `3f9d084` `--enable-unsafe-swiftshader`, `b4e90fb` Mapbox token gate, `6c5cfe6` route deletion). Each is a band-aid.
2. **Proof-vs-print drift.** The chrome was authored twice — once in `MapPreview.vue` (browser editor) and once in the Puppeteer HTML template — and the two diverge silently every time the editor changes.
3. **Multi-session order race.** Snapshots are keyed on `order_id`; concurrent Stripe Checkout sessions for the same map design can clobber each other's snapshot.

v4 fixes each of these:
1. Replaces headless Chromium for the **map** with **MapLibre Native** (libmaplibre-native, no GPU). Faster, deterministic.
2. Compositor consumes the **same shared modules** the editor uses (`utils/posterData.ts`, `utils/render/*`). New chrome behavior must land in shared utilities first; both editor and worker consume from the same place.
3. Snapshots are keyed on `stripe_session_id` (immutable per checkout session) and stored once at webhook time.

Map render → Sharp/librsvg chrome compositor → JPEG (proof) or JPEG/PDF (print). Two-layer hash model (`map_content_hash` + `chrome_hash`) drives a content-addressable render cache.

---

## 2. Repository orientation

```
trailmaps-app/
├── render-worker/                    # LEGACY — still in production. Do not delete.
│
├── render-worker-v4/                 # THIS PROJECT
│   ├── HANDOFF.md                    # ← you are here
│   ├── package.json
│   ├── Dockerfile                    # HTTP server image (proof renders)
│   ├── Dockerfile.queue              # Queue consumer image (final renders)
│   ├── index.ts                      # HTTP server (Express) — `/render-proof`
│   ├── queue.ts                      # Queue consumer entry point
│   ├── fonts/                        # Bundled TTFs — see fontRegistry.ts
│   ├── outputs/                      # Local artefacts from scripts/test-render.ts
│   ├── scripts/
│   │   ├── test-render.ts            # ← THE main test harness; renders two prod maps
│   │   ├── capture-editor.ts         # Playwright capture of editor for comparison
│   │   ├── diff-3way.ts              # editor / v4 / legacy 3-way visual diff
│   │   ├── diff-vs-editor.ts
│   │   └── debug-printscale.ts
│   ├── src/
│   │   ├── chrome/
│   │   │   ├── svgTemplate.ts        # ← chrome SVG generator (~736 lines)
│   │   │   ├── compositor.ts         # Sharp pipeline that overlays SVG on map raster
│   │   │   └── logoFetch.ts          # SSRF-validated logo fetcher
│   │   ├── renderer/
│   │   │   ├── index.ts              # dispatcher: native vs browser fallback
│   │   │   ├── native.ts             # MapLibre Native binding
│   │   │   ├── browser.ts            # browser fallback (out of v1 scope, contingency)
│   │   │   └── tileCache.ts          # disk-bounded LRU tile cache
│   │   ├── queue/
│   │   │   ├── consumer.ts           # SELECT ... FOR UPDATE SKIP LOCKED loop
│   │   │   ├── processJob.ts         # the per-job pipeline
│   │   │   ├── gelato.ts             # Gelato submission stub
│   │   │   └── manualReview.ts       # routes failed renders to a review queue
│   │   ├── cache.ts                  # render_cache table reader/writer
│   │   ├── validation.ts             # output sanity checks
│   │   ├── storage.ts                # Supabase Storage upload helpers
│   │   ├── db.ts                     # pg pool
│   │   ├── log.ts                    # structured JSON logging
│   │   ├── config.ts                 # env validation
│   │   └── types.ts
│   └── tests/                        # vitest — 39/39 passing as of 2026-05-04
│       ├── compositor.test.ts        # chrome paint band brightness check
│       ├── processJob.test.ts        # queue orchestration (renderer stubbed)
│       ├── svgTemplate.test.ts       # chrome SVG structural assertions
│       ├── tileCache.test.ts
│       └── validation.test.ts
│
├── utils/
│   ├── posterData.ts                 # SHARED: typography + layout profiles (17 themes)
│   ├── print/
│   │   ├── printFraming.ts           # SHARED: trim/bleed/safe-area math
│   │   └── providerProfile.ts        # SHARED: Gelato print product profiles + maxDpi
│   └── render/                       # SHARED rendering modules (anti-drift)
│       ├── overlayLayout.ts          # pin + leader-line layout (used by both editor + worker)
│       ├── routeSmoothing.ts         # geojson smoothing (extracted from MapPreview.vue)
│       ├── posterFormatters.ts       # stat number formatting, coords DMS
│       ├── textHalo.ts               # 9-direction text-shadow recipe (editor) ↔ SVG paint-order
│       ├── brandingMark.ts           # the "RAD MAPS" mountain icon SVG
│       ├── fontRegistry.ts           # font inventory + clampWeightToAvailable()
│       ├── presetRenderer.ts         # preset-specific helpers
│       ├── printScale.ts             # DPI scaling for line widths and label sizes
│       ├── hashVersion.ts            # version pins (renderer / chrome template / fonts)
│       ├── hash.ts                   # map_content_hash / chrome_hash / render_cache_key
│       ├── fieldLayer.ts             # FIELD_LAYER classification (anti-drift compile-time check)
│       └── storagePaths.ts
│
├── components/map/MapPreview.vue     # 2,202 lines; the editor canvas
├── server/
│   ├── utils/snapshot.ts             # writes order_snapshots
│   └── api/orders/
│       ├── checkout.post.ts          # Stripe Checkout — feature-flagged v4 path
│       └── webhook.post.ts           # Stripe webhook → snapshot → queue insert
└── supabase/migrations/
    ├── 2026_04_render_pipeline_v4.sql       # ← UNAPPLIED in any environment
    └── 2026_04_render_pipeline_v4_down.sql  # ← rollback, also unapplied
```

Roughly 6,083 LoC of v4-specific TypeScript across `src/` + `index.ts` + `queue.ts` + `scripts/` + `tests/`, plus ~12 shared modules in `utils/render/`.

---

## 3. Status by phase (canonical)

| Phase | Description | Status | Blocker |
|-------|-------------|--------|---------|
| 0 | Foundation utilities + DB migration draft + Native spike scaffold | ✅ COMPLETE | — |
| 1 | Snapshot freeze + idempotent webhook + event dedup | ⚠️ STAGED, flag OFF | Migration unapplied |
| 2 | MapLibre Native spike (HARD GATE) | ❌ NEVER RUN END-TO-END | Spine never executed |
| 3 | Render worker — Native + LRU tile cache + oversized viewport + camera | ⚠️ PARTIAL | `/render-proof` HTTP path untested |
| 4 | Browser fallback | ✅ OUT OF V1 SCOPE | — (contingency parachute) |
| 5 | SVG chrome compositor | ⚠️ PARTIAL | Pins + leader legend rendering; structurally close but visible gaps remain (see §6) |
| 6 | Render cache integration | ⚠️ STAGED | Untested (no DB) |
| 7 | Output validation | ⚠️ PARTIAL | severity levels not formalized |
| 8 | Print queue consumer | ⚠️ SCAFFOLDED | Never booted; no stale-claim sweep |
| 9 | Observability | ⚠️ ~6/15 metrics | Aggregations missing |
| 10 | Nuxt frontend integration | ⚠️ STAGED, flag OFF | Migration unapplied |
| 11 | Cutover | — | Gated on Phases 1, 2, 3, 5 |

The v4 architectural spec marks several rows "Complete" that are actually scaffolded-but-untested. **This table is authoritative.**

---

## 4. What is actually proven to work

### Proven via `scripts/test-render.ts` (real prod data, local Mac):

- MapLibre Native renders the `stadia-watercolor` (Whiskey Off-Road) and `minimalist` (Kickapoo) presets at 18×24" / 300 DPI.
- Sharp produces dimensionally correct sRGB JPEGs with embedded ICC profile, < 5 MB each, well under Gelato's 200 MB limit.
- Total render time on M-series Mac: ~1.0–1.5s map raster + ~5.9–7.1s chrome composition = ~7–9s end-to-end at 300 DPI.
- Memory peak per render: ~900 MB – 1.2 GB RSS. The plan's 2 GB ceiling holds at proof DPI; **untested at final DPI on the production worker (Railway with constrained memory).**
- Tile fetching with the per-worker LRU disk cache works; Stadia 0-byte 200 OK responses are substituted with 1×1 transparent PNG and not cached.
- Custom font bundle loads via CoreText on macOS after `~/Library/Fonts/` install + `killall fontd`. **The Docker image's font installation has not been verified in a built container.**
- 39/39 unit tests pass.

### Proven via unit tests:

- `tests/compositor.test.ts` — chrome paint produces non-black bands.
- `tests/svgTemplate.test.ts` — chrome SVG has expected title text, multiple bg rects, escapes XML, and emits border at 14px inset with 1px/2px stroke per editor parity.
- `tests/tileCache.test.ts` — LRU eviction by mtime when > budget; coalescing of in-flight requests for same key.
- `tests/validation.test.ts` — pixel sanity checks pass for healthy renders (one false-positive was diagnosed and fixed).
- `tests/processJob.test.ts` — orchestration paths (renderer stubbed, not real).

---

## 5. What is NOT proven and where the risk lives

### Never executed end-to-end:
- **Database migration applied to any environment.** `supabase/migrations/2026_04_render_pipeline_v4.sql` exists; rollback exists; neither has run. This is the #1 blocker.
- **End-to-end staged order.** Stripe test → snapshot → webhook event dedup → queue insert → worker claim → render → product_renders row → Gelato submission stub. Zero successful runs.
- **Queue consumer booted against a real DB row.** The `consumer.ts` `SELECT ... FOR UPDATE SKIP LOCKED` loop has never observed a real `print_render_jobs` row.
- **`/render-proof` HTTP path** in `index.ts`. The test harness bypasses HTTP. Auth, request validation, error responses, timeout — none are exercised.
- **Webhook idempotency.** Plan target: same Stripe event fired 5× ⇒ exactly 1 row in `processed_stripe_events` AND exactly 1 row in `print_render_jobs`. Not tested.
- **Snapshot collision on same `order_id`.** Concurrent Stripe sessions, two snapshots, both render correctly. Not tested.
- **Stale-job reclaim.** A worker dying mid-render should leave its `print_render_jobs` row in `status='rendering'` with stale `claimed_at`; a sweep should return it to `queued`. The sweep code does not exist.
- **Cross-session artifact reuse.** Two checkout sessions for the same map design — the second session's `print_hash` should hit an existing `product_renders.artifact_path`. Most common production scenario for popular maps. Never exercised.
- **Gelato submission failure path.** A failed submit must move the order to `manual_review`. Not tested.

### Untested visual coverage:
- Only **2 maps × 1 print size (18×24") × 2 themes (`dark-topo`, `minimalist`)** have ever been rendered.
- 17 color themes exist in `THEME_TYPOGRAPHY` (`utils/posterData.ts`); 15 are unrendered.
- 5 print sizes exist; 4 are unrendered. We previously attempted 24×36" and saw blurry text from tile zoom mismatch — the issue was deferred, not fixed.
- 4 logo positions exist (`map-top-right`, `header-right`, `footer-left`, `footer-right`); none have been rendered with a real customer logo.
- Maps with no segments / many segments / very long titles / non-ASCII characters / extreme `title_scale` values — all unrendered.
- Border style `none`/`thin`/`thick` — only `thin` has been seen in real output.

### Operational/scale unknowns:
- **Concurrency.** 4 workers × 100 jobs, exactly-once consumption, no deadlocks — never tested.
- **Tile cache pressure.** Burst load, dedup, coalescing under contention — untested.
- **librsvg at large dimensions.** 32×48" / 200 DPI = ~6,400×9,600 px. Sharp's libvips can OOM.
- **Stadia rate-limit (429) behavior under burst.** Defined in plan, not tested.
- **Worker dies mid-render.** Stale-claim sweep doesn't exist (see above).

---

## 6. Visible chrome parity — current state

The two test fixtures are at `outputs/whiskey-off-road.final.jpg` and `outputs/kickapoo-mtb.final.jpg`. Side-by-side comparison images live at `outputs/{label}.3way.png` (editor / v4 / legacy).

### Whiskey Off-Road (18×24, `dark-topo` preset, `titlePosition: 'bottom'`)

**Matches editor:**
- Title band sits between map and footer (correct band order).
- "WHISKEY OFF-ROAD" (white serif), date subtitle, footer with red occasion text "50 PROOF · TEAM · FINISHER" centered, RAD MAPS branding right.
- Pin label "WHISKEY ROW" rendered.
- 14px border frame.

**Visible gaps:**
1. **Map terrain detail.** Editor shows rich topographic line detail across the whole canvas; v4 looks flatter and darker. Likely a mapStyle.ts contour/hillshade layer ordering or scaling issue, NOT a chrome issue. Investigate `applyPrintScaleToStyle` and the contour layer paint properties at 300 DPI.
2. **Branding cluster sizes.** v4's RAD MAPS + mountain icon look noticeably bigger than editor's. The icon is rendering at 4cqh per spec, but the editor's `.mark-svg { width: 4cqh; height: 4cqh; }` produces something visually smaller. Worth measuring rendered pixel sizes both sides and comparing — a CSS-vs-SVG metric mismatch is plausible.

### Kickapoo Mountain Bike Trails (18×24, `minimalist` preset, `titlePosition: 'top'`, 17 segments)

**Matches editor:**
- Title at top: "KICKAPOO MOUNTAIN BIKE TRAILS".
- Footer: 45.3 MILES, 6,237 FT GAIN, AKA "CHURCH" subtitle centered, RAD MAPS branding right.
- START/FINISH pins.
- Leader lines connecting to trail segments.

**Visible gaps:**
1. **Leader-line labels clipped on the left edge.** "HAUL ROAD" → "AUL ROAD", "DEVIL'S GULCH" → "IL'S GULCH". `utils/render/overlayLayout.ts` is computing label X positions outside the safe zone (negative or <pad px). This is a critical **print blocker** for any map with leader labels on the left side. Editor MapPreview.vue clamps these, the worker's `overlayLayout.ts` does not.
2. **Map terrain detail** — same issue as Whiskey. Editor shows visible topo lines, v4 looks muddier.
3. **Footer stats positioning** — editor is more compact; v4's stat blocks have slightly more inter-block spacing. The cause is in `svgTemplate.ts`'s `approxTextW(text, sizePx, 0.55)` heuristic for advancing the cursor between blocks. This char-width factor is reasonable for sans-serif uppercase + digits but can drift for condensed fonts. Plausible improvement: replace with a real shaping pass via Pango or a static measurement table per (font family × weight).

### Architectural note on parity

The chrome compositor (`render-worker-v4/src/chrome/svgTemplate.ts`) is preset-agnostic — it consumes `getPosterTypography(styleConfig)` and `getPosterLayout(styleConfig)` for **all 17 themes**. There are no `if Whiskey then X` branches. But the system has been **tested** with only 2 themes. The combinatorial space (17 themes × 5 sizes × dozens of toggle combinations) is wholly unverified; expect surprises.

For 99% editor parity coverage, you need a **matrix render harness** that produces fixtures across the full grid and runs perceptual diffs. None exists today.

---

## 7. Critical decisions baked in (so you don't re-litigate them)

| Decision | Rationale |
|----------|-----------|
| MapLibre Native (not Chromium) for the **map raster** | Eliminates the WebGL/Mesa instability that plagued the legacy worker. Native is faster (~250–700 ms at proof DPI on Mac). |
| Sharp + librsvg (not Chromium) for the **chrome compositor** | Headless Chromium dependency was the goal we were eliminating. librsvg has quirks (see §8) but is deterministic and lightweight. |
| Per-Stripe-session immutable snapshots, keyed on `stripe_session_id` | Fixes the legacy multi-session order race where two checkout sessions on the same `order_id` could clobber each other. |
| Postgres `FOR UPDATE SKIP LOCKED` job queue | Boring, exactly-once via DB primitives. Avoids running a separate broker. |
| Two-layer hash model: `map_content_hash` + `chrome_hash` (+ `proof_render_hash`, `print_hash`, `render_cache_key`) | Edits to chrome (typography, occasion text, etc.) reuse the cached map; edits to the map reuse cached chrome where possible. |
| All shared rendering behavior lives in `utils/render/*.ts`, consumed by both editor (`MapPreview.vue`) and worker (`render-worker-v4/`) | The legacy worker had a parallel HTML template that drifted from the editor every release. Single-source-of-truth fixes the drift category at the system level. |
| All custom fonts pinned in `utils/render/fontRegistry.ts` and bundled into Docker image | librsvg/CoreText doesn't synthesize faux-bold; missing weights produce wrong-family fallback. Clamping requested weight to nearest available file (`clampWeightToAvailable`) is the only reliable path. |
| Browser fallback (`src/renderer/browser.ts`) is **scaffolded but disabled** | Contingency parachute if a future preset can't be matched by Native. Current presets all route to Native. |
| No PDF/X-4 in v1 | Stretch goal. Gelato accepts JPEG today; revisit only after they accept a test PDF zero-warning. |

The full list of locked decisions lives in `RadMaps_Render_Pipeline_Plan_v4.md`.

---

## 8. librsvg / CoreText quirks the next team must know

Each of these took hours to discover and is a permanent gotcha:

1. **`dominant-baseline="middle"` is silently ignored.** SVG `<text y="...">` is the baseline. The current code manually offsets y by `0.35 × fontSize` for middle alignment (pin/leader labels) and by `0.8 × fontSize` for `text-before-edge` (text overlays). Browsers honor `dominant-baseline`; librsvg falls back to default baseline.
2. **`textLength` + `lengthAdjust` is a no-op.** Cannot use SVG's built-in shrink-to-fit. The current code does NOT shrink the title; if it overflows the band the customer sees it in proof and accepts/edits before ordering. The editor doesn't shrink either.
3. **`<tspan x="...">` resets text-anchor.** Multi-line text overlays must emit one `<text>` element per line; otherwise the second line ignores the requested anchor and renders mid-aligned.
4. **CoreText (macOS) does NOT scan `~/Library/Fonts/` subdirectories or follow symlinks.** Fonts must be **copied** (not symlinked) to `~/Library/Fonts/` root, and `killall fontd` invoked so CoreText re-scans. See `scripts/install-fonts.sh`.
5. **CoreText uses Pango, NOT fontconfig.** `FONTCONFIG_FILE` and `XDG_DATA_HOME` are red herrings on macOS. The Linux Docker image uses fontconfig — different code path, separate verification needed.
6. **CoreText doesn't synthesize faux-bold.** A request for `font-weight: 700` against a family that only has 400 yields **a different family entirely** (e.g. Helvetica Bold). Browsers synthesize. Clamping (`clampWeightToAvailable`) is mandatory.
7. **Stadia tile API returns 200 OK + zero bytes for out-of-coverage tiles.** Cached as poison would render a transparent square; substitute a 1×1 transparent PNG and don't write to disk cache. See `src/renderer/native.ts` request handler.
8. **Sharp's `.extract().stats()` chain returns wrong stats.** The pipeline reset from `.extract()` is dropped. Materialize via `.toBuffer()` between `.extract()` and `.stats()`.
9. **Database trail names sometimes arrive wrapped in `\n`.** `'\nTrail 10\n'` is real. With `text-anchor="end"`, leading/trailing whitespace shifts visible glyphs. `esc()` in `svgTemplate.ts` collapses-then-trims.

These are all in the code today. If you refactor `svgTemplate.ts`, do not silently drop the workarounds.

---

## 9. Known critical issues (priority ordered)

### P0 — blockers to running v4 anywhere
1. **Migration unapplied.** Apply `supabase/migrations/2026_04_render_pipeline_v4.sql` to staging Supabase. Verify rollback (`_down.sql`) on a scratch DB. Without this, NOTHING else in v4 can be exercised.
2. **`/render-proof` HTTP path untested.** Add an integration test that POSTs a real fixture against the running worker; assert correct framing dims and auth handling. (`tests/integration/renderProof.test.ts` does not exist.)
3. **Queue consumer never booted.** Run `queue.ts` against a manually-inserted `print_render_jobs` row; observe `consumer.claimed { job_id, stripe_session_id }` log line.

### P0 — blockers to printing safely
4. **Stale-job reclaim sweep does not exist.** A periodic sweep that returns `status='rendering' AND claimed_at < now() - interval '5 minutes'` rows back to `queued` with `last_error='reclaimed: presumed worker crash'`. SQL is in the v4 plan; no code yet. Without this, a worker crash mid-render = silently stuck order.
5. **Webhook idempotency not tested.** Same Stripe event fired 5× must produce exactly 1 `processed_stripe_events` row and exactly 1 `print_render_jobs` row.
6. **Logo fetch is nondeterministic** (`src/chrome/logoFetch.ts`). Currently fetched once per worker boot, cached in memory with TTL. For paid orders, freeze logo bytes at snapshot creation and render from immutable copy. See `RadMaps_Render_Pipeline_Plan_v4.md` §8.5.

### P0 — blockers to editor parity for production designs
7. **Leader-line labels overflow the left edge** in `utils/render/overlayLayout.ts`. Editor `MapPreview.vue:recomputeOverlays` clamps label X to the safe area; the shared module does not. Critical for any Kickapoo-shaped map.
8. **Map terrain detail thinner in v4 than editor.** Both Whiskey and Kickapoo show this. Investigate `utils/render/printScale.ts` and contour/hillshade layer ordering. NOT a chrome bug.
9. **Branding cluster sizing visibly larger than editor.** Compare rendered pixel dimensions of `.mark-svg` (editor) vs the SVG `<g>` (worker) and reconcile.

### P1 — visible gaps that will surface as production designs are exercised
10. **Footer stat-block X-cursor uses a single char-width heuristic** (`approxTextW(..., 0.55)`). For condensed fonts it's a poor approximation. Consider Pango shaping or a static font-metric table.
11. **`recomputeOverlays` (~145 lines, screen-space pin/leader projection) is locked inside `MapPreview.vue:1095-1239`** as private logic. The shared `overlayLayout.ts` was extracted but the editor's reactive composable wrapper (`composables/useOverlayLayout.ts`) does not exist. The two paths can drift again.
12. **Title shrink-to-fit was REMOVED.** Long titles with `title_scale > 1.0` will overflow the header band. Editor doesn't shrink either, so this is editor-parity-correct, but is a UX cliff.

### P1 — coverage debt
13. **No matrix render harness.** Two test renders is wholly insufficient evidence of editor parity. A matrix harness covering 17 themes × 5 sizes × content edge cases (long title, no occasion, no stats, all logo positions, border styles, scale extremes) is the only way to credibly claim 99% parity.
14. **`scripts/test-render.ts` is not in CI.** It hits prod Supabase live. The plan calls for "recorded tile fixtures committed to repo" so the harness is deterministic and can run on every PR. Tile fixtures don't exist yet.
15. **Output validation lacks severity levels.** Currently a binary errors/warnings array. Spec calls for `blockingErrors / warnings / diagnostics`. Important: validation must NEVER block a healthy fixture (a former false-positive was the reason the test was added).

### P2 — operational hardening
16. Tile response policy unimplemented (the spec defines normalized handling for 200-zero / 404 / 429 / 5xx across all four providers). Today the code substitutes for 0-byte; everything else is loosely handled.
17. Fidelity-freeze fields in `order_snapshots` (renderer_version, chrome_template_version, font_bundle_version, tile_url_templates, etc.) are partially captured. Without these, "my print doesn't match my proof" support tickets are unsolvable.
18. Observability: ~6 of 15 planned metrics emit; aggregations missing.
19. Browser fallback is scaffolded but disabled. If a future preset fails Native parity, this is the parachute. It calls the legacy `render-worker/` over HTTP — unwise long-term.

---

## 10. How to run things locally

### Prerequisites
- Node 20–24 (see `package.json` engines).
- Sharp's bundled libvips/librsvg comes with the npm install — no extra steps.
- Postgres connection (Supabase pooler or local).
- Custom fonts. On macOS run `bash scripts/install-fonts.sh` after `npm install`. **The install script and Dockerfile font path are believed correct but the Docker image's fonts have not been verified post-build.**
- `.env` file at `render-worker-v4/.env` (see `.env.example`).
- Root `.env` (one directory up) for `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `MAPBOX_TOKEN`, `MAPTILER_TOKEN`, `STADIA_API_KEY`.

### Two prod-data smoke renders against your local machine

```bash
cd render-worker-v4
npm install
RENDER_CLASS=final npx tsx --env-file=../.env scripts/test-render.ts
```

Outputs land in `outputs/{label}.final.jpg`. This is the harness that has produced every successful v4 render to date. It bypasses the HTTP server, the render cache, and Storage upload — pure pipeline test.

### Capture fresh editor reference + 3-way diff

```bash
# Requires the Nuxt dev server running on port 3000:
ulimit -n 32768 && CHOKIDAR_USEPOLLING=true npm run dev   # in trailmaps-app/

# Then in render-worker-v4/:
npx tsx scripts/capture-editor.ts     # captures editor PNG via Playwright
npx tsx scripts/diff-3way.ts          # writes outputs/{label}.3way.png
```

### Run unit tests

```bash
cd render-worker-v4
npm test   # 39/39 passing as of 2026-05-04
```

### Boot the HTTP server (UNTESTED)

```bash
cd render-worker-v4
npm run dev    # serves /render-proof on PORT=3002
```

There is currently no integration test that exercises this path with a real request payload.

### Boot the queue consumer (UNTESTED)

```bash
cd render-worker-v4
npm run dev:queue
```

Requires the migration to be applied first. If the consumer starts but no `print_render_jobs` rows exist, it polls quietly. Insert a row by hand to observe end-to-end behavior:

```sql
-- See migration file for the schema. The job needs a valid order_snapshots row to reference.
INSERT INTO print_render_jobs (...) VALUES (...);
```

### Production deployment (UNTESTED)

The Dockerfiles (`Dockerfile`, `Dockerfile.queue`) are believed buildable but have not been deployed to Railway or any other host as v4. The legacy worker continues to serve production traffic.

---

## 11. Recommended next-30-days plan

The strict gate-driven order from the v4 plan, distilled:

### Week 1 — make the spine work
1. Apply `2026_04_render_pipeline_v4.sql` to staging Supabase. Verify down-migration on a scratch DB.
2. Boot the queue consumer locally against staging; manually insert a `print_render_jobs` row and observe a successful claim → render → product_renders write.
3. Add an integration test for `/render-proof` HTTP path.
4. Implement and test the stale-job reclaim sweep (cron or in-process timer).
5. Webhook idempotency test (5× same event ⇒ 1 job row).

### Week 2 — close the visible parity gaps
6. Fix leader-label left-edge clamping in `utils/render/overlayLayout.ts`.
7. Diagnose terrain-detail thinness — is it `printScale` line widths, contour layer minzoom, or hillshade compositing? Fix at the layer-style level.
8. Reconcile branding cluster size between editor `.mark-svg` and SVG `<g>`.
9. Build a matrix render harness covering 17 themes × 5 sizes; run perceptual diffs vs. editor capture for each. Track failures by category.

### Week 3 — operational hardening
10. Implement tile response policy (200-zero / 404 / 429 / 5xx) per spec §8.1.
11. Implement validation severity levels (`blockingErrors` / `warnings` / `diagnostics`).
12. Logo immutability at snapshot time (spec §8.5).
13. Fidelity-freeze fields in `order_snapshots` (spec §8.4).

### Week 4 — staging soak
14. Drive 7 consecutive days of staging traffic with `RENDER_PIPELINE_V4_ENABLED=true` (proof path only). Zero validation-error escapes to Gelato. At least one observed cross-session artifact reuse. Manual review caught at least one synthetic failure (deliberately injected).

Cutover to production happens only after week 4 is clean. **No earlier.**

---

## 12. Honest postmortem of recent work

The compositor work between 2026-04-28 and 2026-05-04 (the period covered by this handoff) accumulated significant rework. A few patterns the next team should know about so they can avoid them:

- **Phase 2 was a "hard pass/fail gate" in the original plan, and we built phases 5–10 anyway.** This produced ~2,500 LoC whose first contact with a real database row would be in production. The strict ordering `migration → spine → fidelity → cutover` was repeatedly violated. **Restore that ordering.**
- **Visual fidelity work was iterated on optimistically.** Several rounds claimed convergence with the editor when fundamental issues remained (wrong font metrics, wrong baseline math, wrong band order). The right pattern is: render at production dimensions, capture editor at the same aspect, perceptual-diff, fix root cause, repeat. The current 3-way diff harness (`scripts/diff-3way.ts`) supports this — use it.
- **Don't hand-tune pixel offsets in `svgTemplate.ts`.** The compositor must consume the editor's exact layout values via `getPosterTypography`/`getPosterLayout`. When something looks off, the fix is almost always upstream (in `posterData.ts`, `printScale.ts`, or `overlayLayout.ts`), not in the SVG generator.
- **Footer Y position was wrong for `titlePosition='bottom'`** until the very end of this work cycle. The spec is unambiguous: footer is ALWAYS `order: 2` (at the bottom). Only the header band swaps with the map. If a layout looks visually broken, double-check this first.
- **`approxTextW(text, sizePx, 0.55)` is a heuristic** for advancing the X cursor in the footer stats cluster. It works for sans-serif uppercase + digits at typical content lengths but will drift for condensed fonts or unusual content. A real Pango-shaping pass or per-font measurement table is the correct fix.

Bullet items 1 and 2 are the structural failures of the recent cycle. The plan was correct; we drifted from it.

---

## 13. Files cleaned up at handoff time

The following stale artifacts have been removed to reduce confusion for the next team:

- `trailmaps-app/design_handoff_style_panel/` — old JSX mockups, marked "scheduled for deletion" in `CLAUDE.md`. Removed.
- `trailmaps/RadMaps_Render_Pipeline_Plan.md` (v3.4) — explicitly superseded by `RadMaps_Render_Pipeline_Plan_v4.md`. Removed.
- `trailmaps/RadMaps_Render_Pipeline_Plan.docx` — older Word version of the same. Removed.
- `trailmaps/CHROME_PARITY_INSTRUCTIONS.md` — kept; this was the user-authored spec that drove the most recent compositor rewrite. Useful evidence of intent.

The following documents are still authoritative and should remain:

- `trailmaps/RadMaps_Render_Pipeline_Plan_v4.md` — the architectural spec.
- `trailmaps-app/CLAUDE.md` — codebase orientation for AI agents.
- `trailmaps-app/REMEDIATION.md` — open security + reliability issues, separate track.
- `trailmaps-app/render-worker-v4/HANDOFF.md` — this document.

The old plan file at `trailmaps-app/render-worker-native-spike/` is an early Native exploration that predates `render-worker-v4/`. It is not referenced by current code. Recommend the next team read it briefly for historical context, then delete it.

---

## 14. Where to find help

- **Architectural decisions and rationale:** `RadMaps_Render_Pipeline_Plan_v4.md` (parent dir).
- **Codebase orientation:** `trailmaps-app/CLAUDE.md`.
- **Editor source of truth:** `components/map/MapPreview.vue` (lines 753–907 are the band style objects; 1095–1239 is `recomputeOverlays`).
- **Shared rendering modules:** `utils/render/*.ts`, `utils/posterData.ts`, `utils/print/*.ts`.
- **Open security issues:** `trailmaps-app/REMEDIATION.md`.
- **The two test fixtures:** prod Supabase IDs `50bf79ce-7a6b-47f5-bc7a-3fd5690f5c8e` (Whiskey Off-Road, `dark-topo`, bottom title, has text overlays) and `6844d3ac-b1bc-45de-acbc-8d91f2c4d7ff` (Kickapoo MTB, `minimalist`, top title, 17 segments).

---

## 15. One-page status card

```
Architecture            : sound, locked, documented in RadMaps_Render_Pipeline_Plan_v4.md
Schema migration        : drafted, NOT applied to any environment ← #1 blocker
HTTP server             : built, NEVER served a real request
Queue consumer          : built, NEVER claimed a real job
End-to-end staged order : NEVER run
Map render (Native)     : works on 2 maps, 1 size, locally on Mac
Chrome compositor       : structurally close to editor on 2 fixtures; 3 visible gaps remain
Editor-vs-worker parity : ~85% on 2 fixtures; UNVERIFIED for 15 themes × 4 sizes
Test coverage           : 39 unit tests pass (orchestration + structural)
Real-data CI            : NONE — scripts/test-render.ts hits prod live, not in CI
Production traffic      : still served by legacy render-worker/ (Puppeteer)
Feature flags           : RENDER_PIPELINE_V4_ENABLED=false, RENDER_PIPELINE_V4_QUEUE_ENABLED=false
                          (defaults in nuxt.config.ts)

Next concrete action    : apply 2026_04_render_pipeline_v4.sql to staging Supabase
                          and prove the rollback on a scratch DB.
```
