# RadMaps — Claude Context

## What this is
RadMaps converts GPX tracks and Strava activities into print-quality trail map posters. Users upload a GPX file, style a poster (theme, fonts, terrain overlays), then order a physical print via Gelato.

## Deployment
- **Prod URL:** https://radmaps.studio
- **Vercel project:** https://vercel.com/anthonynmaros-projects/radmaps
- **Vercel preview URL:** https://radmaps-9cip7xn4y-anthonynmaros-projects.vercel.app
- **GitHub repo:** https://github.com/anthonynmaro/radmaps (`main` branch → auto-deploys to Vercel)
- **Render worker:** separate Railway service (Puppeteer headless renderer, see `render-worker/`)
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
- **Puppeteer** — headless render to 300 DPI JPEG/PDF in `render-worker/`

## Project structure
```
├── components/map/
│   ├── MapPreview.vue     — poster canvas (title + MapLibre map + footer)
│   └── StylePanel.vue     — right-side editor panel (11 collapsible sections)
├── composables/
│   ├── useMap.ts          — Supabase fetch/save for a single TrailMap record
│   ├── useMapRenderer.ts  — trigger + poll the Puppeteer render worker
│   └── useStyleAgent.ts   — Claude AI style assistant (SSE streaming, not yet wired in UI)
├── pages/
│   ├── index.vue          — landing page
│   ├── dashboard/         — user's map list
│   ├── create/index.vue   — GPX upload + parse
│   └── create/[mapId]/
│       ├── style.vue      — main editor (MapPreview + StylePanel)
│       ├── checkout.vue   — Stripe checkout
│       └── success.vue    — post-order confirmation
├── server/api/
│   ├── maps/index.post.ts         — create map (JSON or multipart/form-data)
│   ├── maps/[id]/render.post.ts   — trigger render worker
│   ├── orders/checkout.post.ts    — create Stripe PaymentIntent
│   ├── orders/webhook.post.ts     — Stripe webhook handler
│   ├── gelato/webhook.post.ts     — Gelato fulfillment webhooks
│   ├── agent/style.post.ts        — Claude AI styling agent (SSE)
│   └── strava/callback.get.ts     — Strava OAuth callback
├── utils/
│   ├── mapStyle.ts        — builds MapLibre style JSON (shared browser + worker)
│   └── gpx.ts             — server-side GPX parser
├── types/index.ts         — all shared types (StyleConfig, TrailMap, Order, etc.)
├── render-worker/         — standalone Node/Puppeteer service for high-res renders
└── supabase/schema.sql    — DB schema
```

## Core data model

### StyleConfig (types/index.ts)
Everything that controls the poster's appearance. Serialized as JSONB in the `maps.style_config` column.

Key fields:
- `preset`: `'minimalist' | 'topographic'` — which map style builder to use
- `base_tile_style`: `'carto-light' | 'carto-dark'` — CARTO tile variant
- `color_theme`: one of 6 presets (chalk/topaz/dusk/obsidian/forest/midnight)
- `print_size`: `'18x24' | '24x36' | '16x20' | '11x14' | '8x10'`
- `font_family`: 10 Google Fonts options
- `show_contours / show_hillshade / show_elevation_labels`: Mapbox terrain features
- `trail_name / occasion_text / location_text`: user-editable poster text
- `label_text_color / label_bg_color`: poster band colors
- `route_color / route_width / route_opacity`: GPX track styling
- `text_overlays: TextOverlay[]`: **planned** — draggable text elements (not yet built)

### TrailMap record
Stored in `maps` table. `geojson` (route), `bbox`, `stats` (distance/elevation), `style_config`, `status` (draft/rendered/ordered).

## Map rendering pipeline

### Browser preview (MapPreview.vue)
1. `buildMapStyle(styleConfig, token)` → MapLibre style JSON
2. `new maplibregl.Map({ bounds: map.bbox, fitBoundsOptions: { padding } })`
3. On load: `populateRouteSource()` → `source.setData(geojson)`
4. Style config watcher: `FULL_RELOAD_KEYS` → `mapInstance.setStyle(newStyle)`, otherwise `setPaintProperty()` for paint-only changes (route color/width, background)

### FULL_RELOAD_KEYS (triggers full MapLibre style rebuild)
`preset, base_tile_style, show_contours, show_hillshade, show_elevation_labels, contour_color, contour_major_color, contour_opacity, hillshade_intensity, hillshade_highlight`

Paint-only (no reload): `route_color, route_width, route_opacity, background_color`

### Print render (render-worker/)
Puppeteer headless Chrome renders the same HTML template using `buildMapStyle` at full DPI. Text overlays must be serialized as absolute-positioned inline-style HTML (% based, not px) so they scale to 5400×7200px correctly.

## mapStyle.ts patterns
- CARTO tiles used for minimalist preset (free, no auth required)
- Mapbox DEM/terrain sources only included in style when their feature is enabled (avoid unnecessary TileJSON fetches and 401s)
- `mapboxTerrainV2Source` has `minzoom: 9` — MapLibre uses those tiles underzoomed so contours appear at any zoom level
- Both style builders include `glyphs` URL (Mapbox fonts via token) so elevation labels work
- Elevation label font: `['DIN Offc Pro Medium', 'Arial Unicode MS Regular']`

## Poster canvas layout (MapPreview.vue)
CSS container queries (`container-type: size`) on `.poster-canvas` enable `cqh`/`cqw` units that scale all typography proportionally regardless of print size. The canvas uses `height: 100%; max-width: 100%; aspect-ratio: W/H` to fill its flex container while maintaining print proportions.

Structure: title band (shrink-0) → MapLibre map area (flex-1) → footer band (shrink-0).

## StylePanel.vue patterns
- Local reactive copy of `modelValue` (StyleConfig)
- All changes go through `set(key, value)` which emits `update:modelValue`
- Sub-components defined as `defineComponent` render functions at bottom of `<script setup>`
- `applyTheme(theme)` batch-applies all theme colors at once
- Section accordion via hand-rolled `Section` component with `ref(true)` toggle

## Editor state (style.vue)
- `styleConfig` ref initialized from `DEFAULT_STYLE_CONFIG`, merged with DB record on load
- Deep watcher debounces saves to DB (600ms)
- `useMap()` composable handles fetch + `updateStyle()` optimistic saves
- Layout: `h-screen flex flex-col` → header (sticky) + `flex-1 flex` → main (MapPreview) + aside (StylePanel, w-[320px])

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
- **`useStyleAgent`** wire-up in the editor UI (currently built but unused)

## Environment variables
All vars in `.env` (gitignored). Production values set in Vercel dashboard.
See `.env.example` for the full list with comments. Key ones:
- `SUPABASE_*` — database + auth
- `MAPBOX_TOKEN` — Mapbox terrain tiles (must have terrain + raster scopes)
- `STRIPE_*` — payments (live keys)
- `GELATO_API_KEY` — print fulfillment
- `RENDER_WORKER_URL` / `RENDER_WORKER_SECRET` — Railway Puppeteer service
- `ANTHROPIC_API_KEY` — AI styling agent

## Known gotchas
- MapLibre does NOT resolve `mapbox://` scheme URLs — always use explicit `https://api.mapbox.com/...` endpoints
- Mapbox terrain-v2 vector tiles only have contour data from zoom 9+. Source `minzoom: 9` fixes this by causing MapLibre to underzoom those tiles
- `container-type: size` on the poster canvas is required for `cqh` units to work
- `height: 100%` (not `max-height: 100%`) is needed on the poster canvas div so `aspect-ratio` has a concrete dimension to derive from
- Supabase `serverSupabaseUser` vs `serverSupabaseClient` — always use these in server routes, never raw env vars
- The style page uses `layout: false` (no default layout wrapper) so it can control its own full-height flex layout
