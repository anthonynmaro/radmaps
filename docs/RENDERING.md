# RadMaps Rendering And Print Sizes

This is the canonical human-facing guide for the current RadMaps render pipeline.
It is intentionally practical: if you are changing renderer behavior, product
sizes, aspect ratio, or print geometry, start here.

For the current renderer cleanup notes, DRY decisions, and security follow-ups,
also read [docs/ARCHITECTURE_SECURITY_REVIEW.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/ARCHITECTURE_SECURITY_REVIEW.md).

## Current Renderer

RadMaps renders posters by screenshotting the real Nuxt/Vue/MapLibre poster in
Chromium. Proof and premade thumbnail renders still use the configured
Browserless-compatible screenshot HTTP API. Final order renders can either call
Browserless or run Playwright Chromium inside the AWS/ECS worker with
`RENDER_BACKEND=local-chromium`.

The key decision is that [MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue) is the only poster renderer. The editor and print render path must share the same Vue/MapLibre component instead of maintaining a separate SVG, Sharp, native, or worker-only poster template.

### Graph-Driven Map Styles

[utils/mapStyle.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/mapStyle.ts) keeps the public `buildMapStyle(config, ...)` API, but style construction now flows through [utils/styleLayerGraph.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/styleLayerGraph.ts).

`StyleConfig` stores user intent. The layer graph decides which intent is
supported, consumed, required, hidden, or ignored for the active preset. This is
important for raster tile presets: CARTO, Mapbox Outdoors, Stadia, and MapTiler
tiles can bake roads, water, place labels, or POIs into the image. A saved field
like `roads_opacity` must not become a fake UI control when the active preset
cannot independently style those baked pixels.

MapLibre layers should be assembled in canonical slot order:

```text
background -> base -> water-land-buildings -> terrain -> contours -> editable-roads -> route-casing -> route -> labels-pois -> segments-handles
```

Route linework renders below map labels by default so labels stay readable in editor previews, proofs, and final print renders. Interactive segment handles and editing overlays remain above labels.

The editor, render pages, and Chromium screenshot output must all use the same
graph-derived effective config. Do not special-case render pages to show controls
or layers that the editor graph would hide.

Viewport scaling is also graph-driven. Layers that scale with the saved editor
viewport carry `metadata.radmaps.scale`, and
[utils/render/viewportScale.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/render/viewportScale.ts)
uses that metadata rather than layer-ID regexes.

### Composition-Driven Poster Chrome

Refined theme layouts are implemented in the same renderer through
[utils/posterCompositions.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/posterCompositions.ts).
`StyleConfig.composition` selects a profile that controls poster chrome around
the MapLibre canvas: title position, alignment, map margins, borders, footer
style, stat emphasis, paper texture, star fields, and side rails. Grid is a
style-controlled overlay, not an implicit composition layer; themes can default
it on, and users can target it to the poster or map only with configurable
color, opacity, and line weight.

Old maps without `composition` use the internal `legacy-classic` fallback. New
refined themes resolve their default composition from
[utils/themes/refined.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themes/refined.ts).

Do not add a separate React/SVG/native composition renderer for print. The
editor, proof renders, premade thumbnails, and final browser screenshot renders must
all screenshot `MapPreview.vue` so map pixels and poster chrome stay in parity.

The dev-only `/style-browser-fixture` route exists for Playwright coverage. It is
excluded from Supabase auth redirects locally and returns 404 outside dev builds.

### Render Paths

Proof renders:

1. [server/api/maps/[id]/render.post.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/server/api/maps/[id]/render.post.ts) authenticates the user and computes proof framing.
2. It creates a short-lived signed render ticket with [utils/render/renderTicket.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/render/renderTicket.ts).
3. It asks Browserless to screenshot `/render/map/[id]?ticket=...`.
4. [pages/render/map/[id].vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/pages/render/map/[id].vue) loads only the server-approved payload from `/api/render/payload`.
5. The JPEG is validated, uploaded to Supabase Storage, and the map row is updated with proof render metadata.
6. The same proof URL is written to `proof_render_url`, `thumbnail_url`, and `render_url`. In the current Browserless pipeline, the proof render is the canonical user-facing thumbnail.

Admin premade preview generation uses the same signed Nuxt/MapLibre render
component at web-thumbnail dimensions. If a staff-created premade draft has
`needs_preview = true`, `/admin/premade` calls
`POST /api/admin/premade/:id/generate-preview`, which screenshots
`/render/premade/:id` at `720x1080` and writes the resulting low-res JPEG to
`premade_maps.preview_image_url`. This renders directly from the `premade_maps`
row so each style variant gets its own correct thumbnail. It does not write to
`premade_maps.render_url`, which is reserved for print-ready premade assets.

Final order renders:

1. Stripe checkout stores the selected concrete product UID.
2. [server/utils/snapshot.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/server/utils/snapshot.ts) writes an immutable snapshot keyed by `stripe_session_id`.
3. The Stripe webhook inserts a `print_render_jobs` row.
4. The `render-worker-v4` queue consumer calls [renderFinalScreenshot.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/render-worker-v4/src/queue/renderFinalScreenshot.ts).
5. The configured screenshot backend captures `/render/session/[stripeSessionId]?ticket=...`.
6. The worker validates dimensions and image health, uploads the artifact, inserts `product_renders`, then submits to Gelato.

`render-worker-v4` is not a second poster renderer anymore. It is the bounded
final-order orchestrator: claim queued jobs, call the configured browser
screenshot backend, validate/upload, write product render rows, and submit to
Gelato. Do not remove it without replacing the queue/orchestration layer.

Product mockups:

Product mockups are merchandising previews, not print artifacts. They are
sourced from saved Gelato template exports in `assets/product_mockup_templates`.
RadMaps composites the current proof/premade artwork into the matching template
asset, uploads the JPEG to `renders/mockups/...`, and stores the durable URL in
`product_mockups`. Checkout can render multiple saved scene variants for the
selected product and shows those mockups alongside the plain proof/premade map
in the product preview gallery. They do not replace the Browserless/worker print
path, and Gelato still receives the existing final print render. See
[docs/PRODUCT_MOCKUPS.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/PRODUCT_MOCKUPS.md)
for the template policy, cache key, API, and backfill workflow.

### Thumbnails And Sharing

Homepage/dashboard thumbnails, checkout previews, Stripe checkout images, and
public share cards should all prefer the latest Browserless proof render. Use
this ordering when displaying a map preview:

1. `proof_render_url`
2. `thumbnail_url`
3. `render_url`

The editor refreshes this thumbnail at bounded moments:

- after style changes settle for 7 seconds,
- at most once every 30 seconds during continuous editing,
- immediately before copying a public share link,
- after the user confirms a checkout product, through the checkout proof render.

Before rendering a thumbnail, the editor persists the current `StyleConfig` so
the screenshot represents the saved poster state. Sharing also marks the map
`is_public = true` after the fresh render succeeds, so `/map/:id` and its
Open Graph/Twitter image metadata point at the same approved poster image the
user just copied.

Do not create a separate thumbnail renderer or crop a dashboard thumbnail from
editor DOM. Thumbnail drift is avoided by routing all preview artifacts through
the same signed Browserless proof render path.

Premade draft creation uses source-map assets only as an initial preview seed:
`proof_render_url -> thumbnail_url -> render_url`. Drafts without any source
preview are immediately eligible for low-res premade thumbnail generation. Admin
creation, premade style saves, the "Generate preview" action, and
`npm run premade:backfill-thumbnails` all use the signed `/render/premade/:id`
thumbnail path. Print-ready premade files remain separate from catalog
thumbnails.

Checkout is intentionally product-first. The product selector must be visible
beside or below the live poster preview, not floating over it. Do not start the
checkout proof render until the user confirms the size/material; while that
selected-product proof is rendering, show the live `MapPreview.vue` state rather
than an older `thumbnail_url`/`render_url`.

### Readiness Contract

Browserless must wait for the render page to be truly ready, not just loaded.

[MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue) owns the readiness signal in print mode:

- `renderMode="print"` removes editor chrome, shadows, background padding, and interactivity.
- `printContext` supplies exact framing, render class, and device scale.
- The component sets `window.__RENDER_READY === true` only after MapLibre, route data, style reloads, tiles, fonts, logos/images, overlays, and render diagnostics are ready.
- For the `radmaps-watercolor` preset, the MapLibre tile set includes the server-rendered `/api/watercolor/tiles/base/{z}/{x}/{y}.png` art tiles. Any missing or failed watercolor tile must surface through render diagnostics; proof/final capture should hard-fail rather than screenshot a partially painted map.
- The component also writes `window.__RADMAPS_RENDER_STATUS` so the caller can diagnose internal render failures.

The screenshot caller should wait on:

```js
window.__RENDER_READY === true && !window.__RADMAPS_RENDER_STATUS?.errors?.length
```

Do not replace this with `networkidle`, a fixed sleep, or a CSS selector alone.

## Print Geometry

[utils/print/printFraming.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/print/printFraming.ts) is the source of truth for:

- trim dimensions,
- bleed,
- safe margin,
- proof vs final DPI,
- final output pixel dimensions,
- the map viewport and safe boxes passed to render pages.

[utils/print/providerProfile.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/print/providerProfile.ts) is the source of truth for:

- supported RadMaps size keys,
- Gelato provider profiles,
- `maxDpi` caps,
- legacy size aliases,
- concrete Gelato `product_uid` normalization.

Do not hand-compute render dimensions in checkout pages, render routes, workers, or tests. Use `getPrintFraming(productUid, renderClass)`.

## Current Size Policy

The editor is intentionally fixed to a single 2:3 poster shape. Users choose among multiple products at that same aspect ratio so the map never reframes between editor, proof, checkout, and final print.

Supported `PrintSize` values:

| Size | Aspect | Final DPI | Notes |
|---|---:|---:|---|
| `8x12` | 2:3 | 300 | poster, wall hanging, aluminum, framed, digital |
| `12x18` | 2:3 | 300 | wall hanging, aluminum, acrylic, framed, digital |
| `16x24` | 2:3 | 300 | poster, wall hanging, aluminum, acrylic, digital |
| `20x30` | 2:3 | 300 | aluminum, acrylic, digital |
| `24x36` | 2:3 | 300 | poster, wall hanging, aluminum, acrylic, framed, digital |
| `32x48` | 2:3 | 200 | no current template-backed physical SKU |

The legacy size aliases are preserved only so old rows and stale hashes fail gracefully:

| Legacy | Canonical |
|---|---|
| `8x10` | `8x12` |
| `11x14` | `12x18` |
| `16x20` | `16x24` |
| `18x24` | `24x36` |

Do not reintroduce mixed-aspect product choices while the editor is single-aspect. A mixed-aspect checkout option would either crop, stretch, letterbox, or silently reframe the route after the user has approved the design.

## Pixel Dimensions

The final render includes bleed. For example, `24x36` with 3 mm bleed at 300 DPI renders to approximately `7271x10871` pixels, not `7200x10800`.

This odd pixel count is expected because 3 mm does not convert to an even number of pixels at 300 DPI. Proof and final renders keep the browser CSS layout close to the saved editor map width, then use `deviceScaleFactor` to reach the required print pixels. Print mode also compensates zoom-dependent MapLibre style stops so labels and minor-detail layers evaluate at the editor-equivalent zoom, not the high-resolution screenshot zoom. That keeps MapLibre label density and collision behavior aligned with the editor/product preview instead of changing it at large product viewport widths. The renderer then normalizes the screenshot JPEG back to the exact `getPrintFraming(...)` dimensions before validation/upload. For odd bleed dimensions, this means cropping a small right/bottom surplus after capture. Do not remove this normalization or validate/upload the raw screenshot buffer.

Proof renders use lower DPI through `getPrintFraming(productUid, 'proof')`.

## Environment Variables

Required for screenshot rendering:

```bash
BROWSERLESS_TOKEN=...
BROWSERLESS_ENDPOINT=https://zfwtsxbyy2.us-east-2.awsapprunner.com
BROWSERLESS_TIMEOUT_MS=60000
PROOF_RENDER_ALLOWED_ORIGINS=https://radmaps.studio
RENDER_BACKEND=local-chromium
RENDER_TIMEOUT_MS=180000
RENDER_TICKET_SECRET=...
GELATO_API_KEY=...
GELATO_ORDER_TYPE=draft
NUXT_PUBLIC_SITE_URL=https://radmaps.studio
DATABASE_URL=...
```

Local testing through ngrok should point `NUXT_PUBLIC_SITE_URL` at the ngrok URL so Browserless can reach your dev server. Vite must allow that host. Prefer a bot User-Agent over `ngrok-skip-browser-warning` headers when testing Google fonts, because the ngrok header can trigger CORS preflight behavior.

`BROWSERLESS_ENDPOINT` is kept as the app-facing screenshot endpoint name for
compatibility, but production should point it at the AWS proof renderer unless
we intentionally fall back to Browserless. For Browserless-backed renders, keep
`BROWSERLESS_TIMEOUT_MS=60000` unless the provider plan/API limit changes. For
AWS local-Chromium final renders, use `RENDER_TIMEOUT_MS` to control the
Playwright navigation/readiness timeout. Large final renders must stay on the
saved-editor-width DPR path and normalized screenshot output.

The AWS proof renderer is public but token-gated. It also restricts screenshot
targets to `PROOF_RENDER_ALLOWED_ORIGINS`; the CloudFormation stack sets this to
`APP_URL` by default so the renderer screenshots RadMaps render pages only.

`RENDER_TICKET_SECRET` must be a long random secret, generated independently from Browserless and Stripe secrets. Use `openssl rand -hex 32`.

For local full E2E, root `.env` is the source of truth. The queue worker may
inherit it through:

```bash
npm run print-worker:dev
```

Use `render-worker-v4/.env` only for local worker-specific overrides, or when
running the worker as a standalone Railway service. Standalone deployments must
still define the same shared values in the worker service environment.

### AWS Final Worker

The AWS render infrastructure is defined in
[infra/aws/render-worker](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/infra/aws/render-worker).
It provisions ECR, ECS/Fargate, CloudWatch logs, Secrets Manager wiring, and an
optional CodeBuild image builder. It also provisions an App Runner proof
renderer at the `ProofRendererUrl` stack output. The App Runner service exposes a
Browserless-compatible `/screenshot?token=...` endpoint over HTTPS, so the Nuxt
proof, share, checkout, dashboard thumbnail, and premade thumbnail flows can
switch off Browserless by setting `BROWSERLESS_ENDPOINT` to that URL.

The ECS task runs the same `render-worker-v4` queue consumer with
`RENDER_BACKEND=local-chromium`, so final orders no longer need Browserless
units.

Use:

```bash
npm run aws:render-worker:sync-secrets
npm run aws:render-worker:deploy-infra
npm run aws:render-worker:build
```

The stack defaults to `DesiredCount=0`; scale the ECS service to `1` only when
you are ready for the AWS worker to claim queued final print jobs.

Before a faux Stripe transaction or Gelato test order, run:

```bash
npm run e2e:readiness
```

Use Stripe test/sandbox keys for faux payments. Stripe's documented sandbox key
prefixes are `sk_test_...` and `pk_test_...`; treat `sk_live_...` and
`pk_live_...` as live-money credentials unless you have verified otherwise in
the Stripe Dashboard. For Gelato, set `GELATO_ORDER_TYPE=draft` when you want
validation without physical fulfillment. Gelato's v4 create-order API supports
`orderType: "draft"`; draft orders can be edited in the dashboard and do not go
into production until converted. Use `GELATO_ORDER_TYPE=order` only when you
intentionally want physical fulfillment.

### Local Full E2E Trial

Run the trial with test payments and Gelato draft orders:

1. Set Stripe test keys in `.env`: `sk_test_...` and `pk_test_...`.
2. Run Nuxt locally on `3001`: `npm run dev`.
3. Start a public tunnel to Nuxt, for example `ngrok http 3001`, then set `NUXT_PUBLIC_SITE_URL` to that `https://...ngrok...` URL.
4. Run Stripe CLI locally: `stripe listen --forward-to localhost:3001/api/orders/webhook`, then copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
5. Set `RENDER_BACKEND=local-chromium`, `RENDER_TICKET_SECRET`, `GELATO_API_KEY`, `GELATO_ORDER_TYPE=draft`, and a Supabase pooler `DATABASE_URL`. Use `BROWSERLESS_TOKEN` only when the final worker is configured with `RENDER_BACKEND=browserless`.
6. Run `npm run e2e:readiness`.
7. In a second terminal, run `npm run print-worker:dev`.
8. Click through checkout and pay with Stripe test card `4242 4242 4242 4242`.

Expected result: Stripe sends the local webhook, the webhook inserts
`print_render_jobs`, the queue worker captures the final Browserless print file,
uploads it, inserts `product_renders`, and creates a Gelato draft order.

### Gelato Draft Bypass

When you need to validate the final print file and Gelato draft submission
without Stripe, use the local bypass script:

```bash
npm run gelato:draft-bypass -- --map-id=<map-uuid>
```

Optional:

```bash
npm run gelato:draft-bypass -- --map-id=<map-uuid> --product-uid=<gelato-product-uid>
```

The script creates a synthetic checkout session, order snapshot, and
`print_render_jobs` row, then calls the same `render-worker-v4` `processJob`
function used by Railway. It still requires `GELATO_ORDER_TYPE=draft`,
`DATABASE_URL`, `RENDER_TICKET_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`GELATO_API_KEY`, and a public `APP_URL` or `NUXT_PUBLIC_SITE_URL` that the
browser backend can reach. `BROWSERLESS_TOKEN` is required only when
`RENDER_BACKEND=browserless`.

This bypass is for preflight only. It proves final browser rendering,
Supabase Storage upload, `product_renders`, order status updates, and Gelato
draft submission. It does not prove Stripe Checkout, Stripe webhooks, or
payment metadata mapping.

### Signed Stripe Webhook Simulation

When the local browser is not authenticated or you want a repeatable webhook
smoke test without completing Checkout, run:

```bash
npm run stripe:webhook-sim -- --map-id=<map-uuid>
```

Optional:

```bash
npm run stripe:webhook-sim -- --map-id=<map-uuid> --product-uid=<gelato-product-uid>
```

The simulator creates an `order_snapshots` row, signs a
`checkout.session.completed` payload with `STRIPE_WEBHOOK_SECRET`, posts it to
the local Nuxt webhook route, and lets the normal `print_render_jobs` queue take
over. This validates raw-body signature handling, order creation, queue enqueue,
Browserless final rendering, Supabase Storage upload, `product_renders`, and
Gelato draft submission.

This still does not validate the hosted Stripe Checkout page itself. For that,
log into the local app, run `npm run print-worker:dev`, complete Checkout with
Stripe test card `4242 4242 4242 4242`, and confirm the sandbox webhook endpoint
or Stripe CLI forwards to `/api/orders/webhook`.

## Updating Product Sizes

Use this checklist whenever adding, removing, renaming, or changing sizes.

1. Confirm the product exists in Gelato and record the exact `product_uid`.
2. Confirm the trim size, bleed, safe margin, accepted formats, and max file size from Gelato templates or API docs.
3. Preserve a single aspect ratio unless you are intentionally doing the full mixed-aspect project described below.
4. Update `PrintSize`, `DEFAULT_STYLE_CONFIG.print_size`, and any constants in [types/index.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/types/index.ts).
5. Update [utils/products.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/products.ts): `SIZES`, `PRODUCTS`, `size_label`, `aspect_ratio`, prices, and recommended trim pixels.
6. Update [utils/print/providerProfile.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/print/providerProfile.ts): `GELATO_PROFILES`, aliases if needed, `maxDpi`, bleed, and safe margin.
7. Update checkout defaults and any premade-map defaults that reference a size.
8. Update tests in [tests/print-framing.test.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/print-framing.test.ts), [tests/render-hash.test.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/render-hash.test.ts), and render-worker-v4 tests that assert framing.
9. Render acceptance samples at the smallest size, the default size, and the largest size.
10. Order physical samples before enabling the new size for paid production orders.

## Changing Aspect Ratio Later

Changing aspect ratio is not a catalog-only change. Treat it as a product project.

Minimum required work:

- Decide whether the editor remains single-aspect or becomes aspect-selectable.
- If aspect-selectable, add explicit editor state for the chosen aspect and make the aspect visible before styling starts.
- Update [MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue) so editor and print render use the same chosen aspect.
- Update route fit, frozen camera behavior, overlay positions, text overlays, title/footer safe boxes, logo placement, and proof thumbnails for the new aspect.
- Update `StyleConfig.print_size` and probably add a separate `aspect_ratio` or `format_family` field so size and shape are not overloaded.
- Update `getProviderProfile` and `getPrintFraming` to reject products whose aspect does not match the approved editor aspect.
- Version hashes in [utils/render/hashVersion.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/render/hashVersion.ts) so stale 2:3 artifacts cannot be reused.
- Build visual regression fixtures for each aspect family.
- Run physical sample prints for each aspect family and material.

Until that work is complete, keep all sellable products at 2:3.

## Validation Requirements

Browser screenshots can still fail. Keep validation.

Required checks:

- output dimensions exactly match `getPrintFraming`,
- JPEG or PNG is readable and non-empty,
- file size is inside the provider cap,
- color space is acceptable sRGB,
- render page reported no readiness errors,
- map canvas is not blank,
- route pixels are present, or the page explicitly reports route source/layers rendered,
- when contours or hillshade are enabled, the render status reports contour/DEM
  source completion or an explicit terrain wait timeout,
- fonts and requested logos/images loaded.

Before production cutover or any major renderer change, test at least `8x12`, `24x36`, and `32x48` if enabled, with topographic contours at detail `0-5`, hillshade, labels, route segments, logos, text overlays, long titles, and long routes. Atlas presets should use the same browser-generated contour path in the editor and Browserless print pages unless a future cached contour service is explicitly selected.

## Concurrency Notes

Browserless is scalable, but it is still a bounded browser pool. The app should not fire unbounded final renders from request/response paths.

Current posture:

- proof renders run from the Nuxt API route and should be rate-limited before public launch,
- final renders stay in the `print_render_jobs` queue,
- the worker orchestrates Browserless, validation, upload, cache/product row writes, and Gelato submission,
- queue concurrency should be tuned to the Browserless plan and observed render time,
- failed or timed-out jobs should retry and eventually move to manual review.

Hundreds of concurrent users are fine if most are editing and only a bounded number are rendering at once. Hundreds of simultaneous 24x36 final screenshots should be queued, not launched all at once.
