# Product And Pricing Strategy

Last updated: 2026-06-02

## Product Principles

RadMaps has one sellable product catalog. Custom maps and premade maps use the same catalog, the same product selector, the same product pricing resolver, and the same checkout quote/session APIs. The only difference between custom and premade carts is the artwork source:

- `custom`: user-owned `maps` row, product-specific proof render required before physical checkout.
- `premade`: published `premade_maps` row, existing premade render/preview used for checkout and fulfillment.

The shop detail page is a discovery page. Product configuration belongs in checkout so we do not maintain a separate premade selector flow.

## Catalog Source Of Truth

`utils/products.ts` is the only supported application catalog source. UI availability must be derived from actual `PRODUCTS` entries, not from a separate size/type matrix.

Every physical product must have:

- a concrete Gelato `product_uid`
- `type`
- `size_label`
- dimensions and 2:3 aspect ratio
- material metadata when the format has a material choice
- a static fallback price for local development only

Formats are ordered as:

1. Poster
2. Framed
3. Wall Hanging
4. Aluminum
5. Acrylic
6. Digital

Material choices are exposed only where they are meaningful:

- Poster: `Archival Matte 250 gsm`
- Framed: black, white, or natural wood
- Wall Hanging: archival or silk paper with black, white, natural, or dark wood rails
- Aluminum: `Matte Aluminum`
- Acrylic: `Gloss Acrylic`

Unsupported combinations stay visible as disabled size choices with a short reason. Do not silently hide the global 2:3 size family.

## Current Enabled Matrix

| Format | Materials | Enabled sizes |
| --- | --- | --- |
| Poster | Archival Matte 250 gsm | 8x12, 16x24, 24x36 |
| Framed | Black, white, natural wood frames | 8x12, 12x18, 24x36 |
| Wall Hanging | Archival or silk paper with black, white, natural, or dark wood rails | 8x12, 12x18, 16x24, 24x36 |
| Aluminum | Matte Aluminum | 8x12, 12x18, 16x24, 20x30, 24x36 |
| Acrylic | Gloss Acrylic | 12x18, 16x24, 20x30, 24x36 |
| Digital | Digital Download | fixed download product |

`32x48` currently has no template-backed physical SKU. `12x16` and `40x60` template exports exist but are not enabled in the catalog.

## Default Product

The default physical product is:

`16x24 Poster, Archival Matte 250 gsm`

This default is used for estimates and initial selector state only. Checkout must still persist the exact selected product UID.

## Pricing Policy

Physical retail product price is destination-based and computed from Gelato production/product cost only:

`retail_price_cents = Math.round((gelato_cost_cents * 1.5) / 100) * 100`

Rules:

- Markup is 50%, represented as `markup_bps = 5000`.
- Rounding rule is `nearest_dollar`.
- Currency is USD for this pass.
- Shipping is never marked up by product pricing. Shipping remains a separate Gelato quote passed through to the customer.
- Digital download remains fixed at `$9.99`.
- Public APIs may expose retail prices only. Gelato costs stay server/admin private.

## Pricing Snapshots

Checkout must not call Gelato product pricing live. Checkout resolves a stored `gelato_product_prices` snapshot by product UID, buyer destination country, currency, and quantity.

Each quote/session/order must lock:

- `pricing_snapshot_id`
- destination `pricing_country_code`
- `gelato_product_cost_cents`
- `retail_unit_price_cents`
- `pricing_markup_bps`
- `pricing_rounding_rule`
- `pricing_synced_at`

Production fails closed when a fresh snapshot is missing or stale. Local development may fall back to static catalog prices, and those public prices must be marked `estimated: true`.

## Sync Policy

Gelato product pricing sync includes every non-digital `PRODUCTS` entry across the supported shipping-country union. Sync is available through:

- daily Vercel Cron: `/api/cron/gelato-pricing-sync`
- admin manual endpoint: `/api/admin/pricing/sync`

Both paths write the same snapshot rows and use the same 50% markup computation.

## Checkout Flow

There is one checkout concept:

1. Product: `Format -> Material/Paper -> Size`
2. Shipping/contact
3. Stripe payment

Custom checkout and premade checkout may use different routes for ownership and guest-checkout reasons, but they must share:

- `MapProductSelector`
- `PRODUCTS`
- public retail price API
- `/api/checkout/quote`
- `/api/checkout/session`
- checkout attempt/order pricing locks

Legacy direct Stripe checkout endpoints are not part of production checkout. Physical checkout must go through `/api/checkout/quote` first and `/api/checkout/session` second so product price, destination country, shipping, quantity, and cart identity are locked server-side before Stripe is created.

`/api/checkout/session` also conditionally claims the selected quote by status
before redirecting to Stripe. If a newly-created Stripe session cannot be fully
attached to the local checkout attempt, snapshot, quote, and coupon state, it is
expired and local reservations are released.

## Verification Requirements

Before enabling or committing catalog changes:

- Every enabled physical UID must return a Gelato US product price.
- Static fallback price must equal 50% markup plus nearest-dollar rounding from Gelato US cost.
- Disabled combinations must have regression tests.
- Digital must remain `$9.99`.
- Browser smoke must verify custom and premade checkout product selection.
- Run `npm run mockups:audit-gelato-templates` when changing template-backed
  offerings.
