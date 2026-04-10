# TrailMaps App

Turn GPX tracks, Strava activities, and Trailforks routes into beautiful print-quality maps — powered by **Nuxt 3**, **Supabase**, **MapLibre GL JS**, **Gelato Print API**, and **Claude AI**.

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
│   ├── orders/checkout.post.ts     # Stripe Checkout
│   ├── orders/webhook.post.ts      # Stripe webhook → Gelato order creation
│   ├── gelato/webhook.post.ts      # Gelato webhook → order status updates
│   ├── strava/callback.get.ts      # Strava OAuth callback
│   └── agent/style.post.ts         # Claude AI streaming agent
├── supabase/
│   └── schema.sql                  # Full database schema + RLS policies
├── types/index.ts                  # Shared TypeScript types
├── utils/
│   ├── gpx.ts                      # GPX → GeoJSON parser
│   ├── mapStyle.ts                 # StyleConfig → MapLibre Style JSON
│   └── products.ts                 # Gelato product catalogue + pricing
└── render-worker/                  # Separate Railway service
    ├── index.js                    # Fastify + Puppeteer render service
    └── package.json
```

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| **Nuxt App** | **Vercel** | `nitro.preset: 'vercel'` already configured. Auto-deploy from `main`. |
| Render Worker | Railway | Separate Fastify + Puppeteer service. 2 GB RAM minimum. |
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

## Gelato Print Formats

Gelato handles printing and global shipping via 130+ fulfilment facilities in 32 countries. Product UIDs must be verified from your Gelato dashboard (GET /v4/products) — the UIDs in `utils/products.ts` are illustrative.

| Format | Size | Price | Gelato API |
|--------|------|-------|------------|
| Matte Poster | 5×7" | $19.99 | `/v4/orders` with `flat_product_pf_5x7_...` |
| Matte Poster | 8×10" | $29.99 | `/v4/orders` with `flat_product_pf_8x10_...` |
| Matte Poster | 12×16" | $39.99 | `/v4/orders` with `flat_product_pf_12x16_...` |
| Matte Poster | 18×24" | $54.99 | `/v4/orders` with `flat_product_pf_18x24_...` |
| Matte Poster | 24×36" | $74.99 | `/v4/orders` with `flat_product_pf_24x36_...` |
| Framed Print | 8×10"–18×24" | $59.99–$109.99 | `/v4/orders` with `framed_product_...` |
| Canvas | 8×10"–24×36" | $69.99–$149.99 | `/v4/orders` with `canvas_product_...` |
| Digital Download | — | $9.99 | Supabase signed URL |

**Note:** Gelato recommends a 3mm bleed on all sides for print products.

## Environment Variables

See `.env.example` for the full list. Key vars:
- `GELATO_API_KEY` — get from https://dashboard.gelato.com/settings/api
- `GELATO_WEBHOOK_SECRET` — from Gelato Dashboard > Settings > Webhooks
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard > Webhooks
