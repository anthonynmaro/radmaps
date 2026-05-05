# TrailMaps App

Turn GPX tracks, Strava activities, and Trailforks routes into beautiful print-quality maps — powered by **Nuxt 3**, **Supabase**, **MapLibre GL JS**, **Browserless**, **Gelato Print API**, and **Claude AI**.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in your keys
cp .env.example .env

# 3. Push the database schema
supabase db push   # or paste supabase/schema.sql into the Supabase SQL editor

# 4. Start dev server
pnpm dev
```

## Project Structure

```
trailmaps-app/
├── components/
│   └── map/
│       └── MapPreview.vue          # MapLibre GL JS interactive preview
├── composables/
│   ├── useMap.ts                   # Reactive map state + API persistence
│   ├── useMapRenderer.ts           # Trigger + poll render jobs
│   └── useStyleAgent.ts           # AI styling agent (Claude) + SSE streaming
├── middleware/
│   └── auth.ts                     # Route auth guard
├── pages/
│   ├── create/[mapId]/style.vue   # Main styling page (map + agent chat)
│   └── ...
├── server/api/
│   ├── maps/                       # Map CRUD + render trigger
│   ├── render/payload.get.ts        # Server-only render payload for signed tickets
│   ├── orders/checkout.post.ts     # Stripe Checkout
│   ├── orders/webhook.post.ts      # Stripe webhook → print queue / Gelato
│   ├── gelato/webhook.post.ts      # Gelato webhook → order status updates
│   ├── strava/callback.get.ts      # Strava OAuth callback
│   └── agent/style.post.ts         # Claude AI streaming agent
├── supabase/
│   └── schema.sql                  # Full database schema + RLS policies
├── types/index.ts                  # Shared TypeScript types
├── utils/
│   ├── gpx.ts                      # GPX → GeoJSON parser
│   ├── mapStyle.ts                 # StyleConfig → MapLibre Style JSON
│   ├── products.ts                 # 2:3 Gelato product catalogue + pricing
│   ├── print/                      # Print framing, bleed, safe area, DPI profiles
│   └── render/                     # Render tickets, hashes, shared render utilities
├── pages/render/                   # Browserless-only render routes
└── render-worker-v4/               # Railway queue worker for final print renders
```

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| **Nuxt App** | **Vercel** | `nitro.preset: 'vercel'` already configured. Auto-deploy from `main`. |
| Browser Screenshot Service | Browserless | Chromium screenshots for proof and final print renders. |
| Final Render Worker | Railway | Queue orchestrator that calls Browserless, validates, uploads, and submits to Gelato. |
| Database | Supabase | Free tier dev, Pro for production. |
| File Storage | Supabase Storage | Private bucket for PDFs, public for thumbnails. |

## Key Integrations

| Service | Purpose | Docs |
|---------|---------|------|
| Supabase | Auth, DB, Storage | https://supabase.com/docs |
| Stripe | Payments + webhooks | https://stripe.com/docs |
| **Gelato** | **Global print fulfilment** | **https://dashboard.gelato.com/docs** |
| Strava | Route import | https://developers.strava.com |
| MapLibre GL JS | Map rendering | https://maplibre.org/maplibre-gl-js |
| Anthropic Claude | AI styling agent | https://docs.anthropic.com |
| Resend | Transactional email | https://resend.com/docs |

## Rendering

RadMaps uses Browserless/Chromium to screenshot the real Nuxt poster render. [MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue) is the single source of truth for editor, proof, and final print output.

The full operational guide is [docs/RENDERING.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/RENDERING.md). The latest renderer cleanup and risk review is [docs/ARCHITECTURE_SECURITY_REVIEW.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/ARCHITECTURE_SECURITY_REVIEW.md). Read both before changing renderer code, product sizes, aspect ratio, print framing, or Gelato product UIDs.

Important invariants:

- The editor is fixed to a 2:3 poster shape.
- Product choices must stay 2:3 unless the editor is explicitly rebuilt for multiple aspect families.
- Use `getPrintFraming(productUid, renderClass)` for all proof/final pixel dimensions, bleed boxes, trim boxes, safe boxes, and DPI.
- Final `24x36` with 3 mm bleed is roughly `7271x10871` pixels, not `7200x10800`.
- Final renders are queued through `render-worker-v4`; do not launch unbounded paid-order screenshots from a Vercel request.

## Gelato Print Formats

Gelato handles printing and global shipping via 130+ fulfilment facilities in 32 countries. Product UIDs must be verified from your Gelato dashboard or `/api/gelato/catalog` before enabling a product for production.

Current sellable formats are a single 2:3 family:

| Size | Materials | Final DPI |
|------|-----------|----------:|
| 8×12" | poster, wall hanging, canvas, framed, digital | 300 |
| 12×18" | poster, wall hanging, canvas, framed, digital | 300 |
| 16×24" | poster, wall hanging, canvas, framed, digital | 300 |
| 20×30" | canvas, digital | 300 |
| 24×36" | poster, wall hanging, canvas, framed, digital | 300 |
| 32×48" | poster, framed, digital | 200 |

Bleed, safe margin, provider caps, and concrete product UID normalization live in `utils/print/providerProfile.ts`.

## Environment Variables

See `.env.example` for the full list. Key vars:
- `GELATO_API_KEY` — get from https://dashboard.gelato.com/settings/api
- `GELATO_ORDER_TYPE` — use `draft` for local/full E2E tests; use `order` only for intentional physical fulfillment
- `GELATO_WEBHOOK_SECRET` — from Gelato Dashboard > Settings > Webhooks
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard > Webhooks; Stripe's documented sandbox key prefixes are `sk_test_` and `pk_test_`
- `BROWSERLESS_TOKEN` — Browserless API token
- `BROWSERLESS_ENDPOINT` — e.g. `https://production-sfo.browserless.io`
- `BROWSERLESS_TIMEOUT_MS` — currently `60000`
- `RENDER_TICKET_SECRET` — long random secret for signed render URLs
- `NUXT_PUBLIC_SITE_URL` — public URL Browserless can reach for render pages
- `DATABASE_URL` — Supabase pooler URL for the final print queue consumer

For local full E2E, run the queue worker from the repo root with
`npm run print-worker:dev`; it merges root `.env` with optional
`render-worker-v4/.env` overrides. The worker is still required for final paid
orders, but it calls Browserless rather than maintaining a separate renderer.

To validate Browserless final rendering and Gelato draft submission without
Stripe, run `npm run gelato:draft-bypass -- --map-id=<map-uuid>` with
`GELATO_ORDER_TYPE=draft`. This creates synthetic order/snapshot/job rows and
executes the same worker `processJob` path, but it does not validate Stripe
Checkout or webhook metadata.

To validate the signed local Stripe webhook path without hosted Checkout, run
`npm run stripe:webhook-sim -- --map-id=<map-uuid>`. This signs a sandbox
`checkout.session.completed` payload, posts it to `/api/orders/webhook`, and
lets the normal final queue create a Gelato draft order.
