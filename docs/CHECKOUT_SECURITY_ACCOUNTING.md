# Checkout Security Accounting

Last updated: 2026-06-02

This is the production checkout map for RadMaps. Any future purchase path must either appear here or be removed.

## Production Invariants

- `utils/products.ts` is the only application catalog source.
- Customer selection is limited to product UID, material/format, size, quantity, and shipping/contact details.
- Physical product price is resolved server-side from `gelato_product_prices`.
- Digital product price is fixed server-side at `$9.99`.
- Physical shipping is resolved server-side from Gelato quote data and passed through as a separate Stripe shipping line.
- Stripe `unit_amount` is created only by `/api/checkout/session`.
- Client-submitted `print_size`, unit price, subtotal, shipping price, total, Gelato cost, and markup are never trusted.
- Stripe Checkout session metadata must include either `user_id` or normalized
  `guest_email`, so the Stripe webhook can create an order with the same buyer
  identity used by RLS and support lookups.
- Physical quote claims are compare-and-set: `/api/checkout/session` only marks
  a quote `used` if its status still matches the status that was validated
  before Stripe session creation.
- If local checkout setup fails after Stripe creates a new session, the session
  is expired, coupon reservations are released, and any quote claimed by that
  request is returned to `selected`.
- A paid physical order without matching checkout attempt, pricing lock, and shipping quote is held for manual review and never submitted to Gelato automatically.

## Active Customer Surfaces

| Surface | Purpose | Server authority |
| --- | --- | --- |
| `components/map/ProductSelector.vue` | Shared Format -> Material/Paper -> Size picker | Emits product UID only; availability comes from `PRODUCTS` |
| `pages/create/[mapId]/checkout.vue` | Custom map checkout | Requires owned map, selected proof render, Gelato quote, `/api/checkout/session` |
| `pages/shop/[slug]/checkout.vue` | Premade checkout | Requires published premade map, Gelato quote, `/api/checkout/session` |
| `pages/shop/[slug]/index.vue` | Premade discovery page | No purchase mutation; links to checkout |
| `components/views/ShopView.vue` | Shop listing | Shows public retail estimates only |
| `components/views/DashboardView.vue` | Dashboard/order listing | Reads user-owned orders through Supabase client/RLS |

## Active Public APIs

| Route | Status | Trust boundary |
| --- | --- | --- |
| `GET /api/product-prices` | Public read | Returns retail prices only; Gelato costs remain private |
| `POST /api/checkout/quote` | Customer write | Validates cart ownership/source, normalizes address, locks pricing snapshot, stores checkout attempt and Gelato shipping quotes |
| `POST /api/checkout/session` | Customer write | Revalidates map/premade ownership, quote, checkout attempt, address hash, product UID, quantity, and pricing before creating Stripe |
| `POST /api/coupons/validate` | Public preview | Preview only; final discount is recalculated/reserved in `/api/checkout/session` |
| `POST /api/orders/lookup` | Public read | Requires email and at least 8 chars of order UUID; returns sanitized status only |
| `POST /api/orders/webhook` | Stripe-only write | Verifies Stripe signature, deduplicates events, inserts orders, blocks fulfillment on quote/pricing mismatch |
| `POST /api/gelato/webhook` | Gelato-only write | Requires configured Authorization secret before updating fulfillment status; escapes webhook-provided tracking fields before email output |

## Admin And Scheduled APIs

| Route | Status | Trust boundary |
| --- | --- | --- |
| `GET /api/cron/gelato-pricing-sync` | Vercel Cron | Requires `Authorization: Bearer ${CRON_SECRET}` |
| `POST /api/admin/pricing/sync` | Staff only | Requires `pricing:manage`; syncs Gelato price snapshots |
| `GET /api/gelato/catalog` | Staff only | Requires `pricing:manage`; returns Gelato catalog/price verification payloads |
| `/api/admin/orders/*` | Staff only | Requires staff permissions per action |
| `/api/admin/coupons/*` | Staff only | Requires `coupon:manage` |

## Removed Purchase Paths

- `POST /api/orders/checkout` was removed. Custom checkout now uses only `/api/checkout/session`.
- `POST /api/shop/checkout` was removed. Premade checkout now uses only `/api/checkout/session`.

These routes previously created Stripe sessions without a locked Gelato shipping quote, so keeping them callable would leave a stale physical checkout path.

## Checkout State Locks

`checkout_attempts` stores:

- cart source
- user or guest email
- map or premade slug
- product UID
- canonical print size derived from catalog
- quantity
- normalized shipping address and address hash
- selected quote ID
- pricing snapshot fields
- Stripe session/customer IDs
- attempt status

`shipping_quotes` stores:

- checkout attempt ID
- cart source and buyer identity
- map or premade slug
- product UID
- quantity
- normalized shipping address and address hash
- Gelato shipment method UID/name
- pass-through shipping amount
- quote expiration/status
- raw Gelato payload

`orders` stores the paid snapshot copied from Stripe, checkout attempt, quote, and pricing lock. Fulfillment reads `orders`, `order_snapshots`, `product_renders`, and `fulfillment_jobs`; it must not recompute retail pricing from the browser.

## UI Consistency

- Shipping phone is optional in both custom and premade checkout. The server
  accepts missing phone values and Gelato receives an empty string when the
  customer leaves it blank.
- Custom checkout renders the selected proof before collecting shipping for a
  physical print. Custom and premade checkout ask `/api/mockups/templates` for
  saved scene metadata and immediately compose the current map into the template
  in the browser; `/api/mockups/render` only warms the durable cached JPEG for
  the selected scene and lazily for other selected scenes. Mockup failures are
  merchandising-only and must not block payment.
- Checkout session errors should stay inline on the page, preserving server
  messages such as quote conflicts. Avoid generic browser alerts that hide
  actionable recovery text.

## Operational Readiness

Before enabling production traffic:

- Run Gelato pricing sync for all enabled physical products and supported countries.
- Confirm `/api/product-prices?country=US` returns all enabled products without `estimated: true` in production.
- Confirm Stripe webhook secret, Gelato webhook secret, `CRON_SECRET`, `GELATO_API_KEY`, and Stripe live keys are set in Vercel.
- Confirm every published premade physical product has a production-ready `render_url`; otherwise paid premade orders are held for manual review.
- Run `npm run mockups:audit-gelato-templates` after changing template assets
  or product offerings.
- Run focused checkout tests and browser smoke for custom and premade checkout after any catalog or pricing change.
