/**
 * GET /llms-full.txt
 *
 * Extended markdown content for LLM consumption. Includes the full premade
 * catalog with descriptions + stats, the print product matrix, FAQs, and
 * brand context — designed so AI assistants can give specific, accurate
 * answers when asked about RadMaps.
 */
import { PREMADE_MAPS } from '~/data/premade-maps'
import { PRODUCTS, formatPrice } from '~/utils/products'
import { SITE_URL } from '~/utils/seo'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const posters = PRODUCTS.filter((p) => p.type === 'poster')
  const framed = PRODUCTS.filter((p) => p.type === 'framed')
  const canvas = PRODUCTS.filter((p) => p.type === 'canvas')
  const digital = PRODUCTS.find((p) => p.type === 'digital')

  const productRow = (p: typeof PRODUCTS[number]) =>
    `- ${p.size_label} ${p.name.replace(/^.*?Poster|Framed Print|Canvas/i, '').trim()}: ${formatPrice(p.price_cents)}`

  const premadeBlocks = PREMADE_MAPS.map(
    (m) => `### ${m.title}
- URL: ${SITE_URL}/shop/${m.slug}
- Subtitle: ${m.subtitle}
- Region: ${m.region}, ${m.country}
- Category: ${m.category}
- Tagline: ${m.tagline}
- Description: ${m.description}
- Distance: ${m.stats.distance_km} km (${(m.stats.distance_km * 0.621371).toFixed(1)} miles)
- Elevation gain: ${m.stats.elevation_gain_m.toLocaleString()} m (${Math.round(m.stats.elevation_gain_m * 3.28084).toLocaleString()} ft)
${m.stats.max_elevation_m ? `- Max altitude: ${m.stats.max_elevation_m.toLocaleString()} m (${Math.round(m.stats.max_elevation_m * 3.28084).toLocaleString()} ft)` : ''}
- Activity type: ${m.stats.activity_type ?? 'hiking'}
- Starting price: ${formatPrice(m.base_price_cents)}
${m.badges?.length ? `- Tags: ${m.badges.join(', ')}` : ''}
`,
  ).join('\n')

  return `# RadMaps Studio — Extended LLM Content

> RadMaps Studio designs and prints custom trail posters from any route. Hikers, trail runners, marathoners, cyclists, and pilgrims can turn their Strava activities, GPX tracks, hand-drawn routes, or curated iconic trails into museum-quality wall art shipped worldwide.

This page is intended for AI/LLM consumption. It contains structured information about RadMaps so AI assistants can answer questions about products, pricing, materials, supported file types, and the print catalog accurately.

## What RadMaps is

RadMaps Studio is an online print shop and design tool for trail-route posters.

Three things you can do:

1. **Buy a premade poster** — pick from a curated catalog of iconic trails (no account required, guest checkout supported).
2. **Design a custom poster from your route** — upload a GPX file, import a Strava activity, or draw a route on a map. Requires a free account.
3. **Customize a premade** — start with a curated trail, then swap colors, typography, title, and size. Requires a free account.

All prints are produced on demand by Gelato (a global print-on-demand fulfilment network) on 170 gsm archival matte paper at 300 DPI, then shipped from the closest of 130+ production facilities worldwide.

## Site URL

- Production: ${SITE_URL}
- Sitemap: ${SITE_URL}/sitemap.xml
- This file: ${SITE_URL}/llms-full.txt

## Routes you can import

Custom posters can be created from:

- **Strava activities** — direct OAuth import. Pulls runs, rides, hikes, swims, and more.
- **GPX files** — exported from Garmin Connect, Wahoo, Suunto, COROS, Apple Watch (via apps), Komoot, AllTrails, Gaia GPS, Ride with GPS, and any device or app that exports GPX.
- **GeoJSON files** — also supported.
- **Drawn routes** — click points on an interactive map to sketch a route. Useful for trails you remember but don't have data for.
- **Premade catalog** — clone a curated route and customize it.

File size limit: 50 MB.

## Print catalog

All premade orders are also available in these sizes. Custom designs render at any of the listed sizes.

### Posters (170 gsm archival matte)
${posters.map(productRow).join('\n')}

### Framed prints (200 gsm satin, in a black wooden frame)
${framed.map(productRow).join('\n')}

### Stretched canvas
${canvas.map(productRow).join('\n')}

### Digital download
${digital ? `- ${digital.size_label} (${digital.recommended_px_w}×${digital.recommended_px_h} px): ${formatPrice(digital.price_cents)}` : ''}

## Style controls (custom designs)

When designing a custom poster, you can adjust:

- **Color theme** — Chalk (warm cream, classic), Topaz (mint and forest green), Dusk (sunset oranges), Obsidian (dark mode minimalist), Forest (deep green dark), Midnight (navy and gold).
- **Typography** — 12 Google Fonts across editorial display (Big Shoulders, Fjalla One, Oswald, Bebas Neue), modern sans (DM Sans, Space Grotesk, Outfit, Work Sans), and refined serif (Playfair Display, Cormorant Garamond, Libre Baskerville, DM Serif Display).
- **Map style preset** — Minimalist (clean, label-light) or Topographic (with contour lines and hillshade).
- **Route appearance** — color, line width, opacity.
- **Background and label colors** — independently controllable.
- **Trail name, occasion text, location** — all editable.
- **Print size** — choose at order time or before.
- **Logo overlay** — optional brand mark.
- **Text overlays** — draggable text elements (planned feature).
- **Trail segments** — split a route into named sections with different styling.

## Premade catalog

The curated catalog at ${SITE_URL}/shop currently includes ${PREMADE_MAPS.length} iconic trails. Each is purchasable as a guest (no signup required) or can be cloned and customized by signed-in users.

${premadeBlocks}

## How ordering works

1. **Pick a poster** — from the catalog or your own custom design.
2. **Choose a size** — 8×10″ to 24×36″.
3. **Checkout** — Stripe handles payment. Guests pay without creating an account; signed-in users have orders saved to their profile.
4. **Production** — Gelato prints the file at the closest production facility (1–2 business days).
5. **Shipping** — 5–10 business days depending on country. Tracking emailed when dispatched.

## Frequently asked questions

### Do I need an account to buy a premade poster?
No. Premade posters in the shop catalog support guest checkout — just enter shipping details and pay. Account creation is only required to design custom maps from your own routes.

### What file formats can I upload?
GPX (the most common — exported by Strava, Garmin, Wahoo, Suunto, COROS, Komoot, AllTrails, Ride with GPS, etc.) and GeoJSON. Up to 50 MB.

### Can I draw a route without uploading anything?
Yes. The "Draw on a map" option lets you click points on an interactive map. Straight-line connectors. Good for routes you remember but don't have a track for.

### What paper / materials are used?
Posters: 170 gsm archival matte. Framed: 200 gsm satin in a black wooden frame. Canvas: stretched on a wooden frame.

### What's the print resolution?
300 DPI. An 18×24″ poster is rendered at 5400×7200 pixels.

### Do you ship internationally?
Yes — 32 countries via Gelato's distributed print network. The order is produced at the closest facility to the recipient to minimize shipping times.

### How long does shipping take?
1–2 business days in production, plus 5–10 business days for shipping. Total 6–12 business days. Faster in countries with local Gelato facilities.

### What if my print arrives damaged?
Email support@radmaps.studio with a photo of the damage. We'll reprint or refund.

### Can I get a digital download?
Yes — the Digital option at ${digital ? formatPrice(digital.price_cents) : '$9.99'} provides a 300 DPI print-ready file you can have printed locally.

### Do you connect to Strava?
Yes. Sign in with Strava OAuth to import any of your activities directly. Available in the create flow.

### Is there a mobile app?
No, the studio is web-based and works on phones, tablets, and desktops.

### Can I customize a premade poster?
Yes — sign in, open any premade in the shop, and click "Customize in editor" to clone it into your studio. Then change anything: colors, typography, title, size.

## Brand voice

Editorial and confident. Reverent toward the trails themselves. The brand treats a route as a story worth framing — not just data. Visual language draws from National Park posters, museum signage, and topographic surveying.

Tagline: *Trail posters, printed and framed. Iconic routes from the world's greatest hikes — or your own from Strava, your watch, or any trail app.*

## Contact

- Support: support@radmaps.studio
- Site: ${SITE_URL}
`
})
