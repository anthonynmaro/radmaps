# User Data Security Audit

**Date:** 2026-05-09  
**Scope:** user GPS uploads, Strava OAuth/imports, map storage, public sharing,
rendering, checkout/order storage, Supabase RLS/storage, and third-party data
flows.

## Executive Summary

RadMaps handles highly sensitive location data. A user's GPX track or Strava
activity can reveal home/work addresses, daily routines, travel history, race
performance, and in some contexts health-adjacent data such as speed, elevation,
duration, and activity type.

The core private `maps` table is protected by Supabase RLS, and most user-owned
server routes use `serverSupabaseClient(event)` plus `user_id` filters. That is
good. The larger risk is data proliferation after import:

- raw GPX files are uploaded to `gpx-uploads` before validation and are not
  deleted after parsing;
- full routes are stored in `maps.geojson`;
- full routes are duplicated into `order_snapshots.geojson` for checkout;
- proofs/final renders are treated as public storage URLs in multiple paths;
- public share pages return the full route GeoJSON to any viewer;
- Strava OAuth tokens are stored as plaintext database fields;
- Strava activity browsing calls third-party geocoders with precise start
  coordinates on every list/import request.

The recommended posture is: store precise GPS only when the user explicitly
creates a map; never persist Strava browsing data or GPS streams except the map
the user imported; keep proofs/final artifacts private by default; make public
sharing image-first unless the user explicitly opts into exposing route geometry.

## Data Inventory

| Data | Current storage/flow | Sensitivity | Notes |
| --- | --- | --- | --- |
| Account profile | `profiles.email`, `profiles.full_name` | Personal data | RLS restricts users to own profile. Staff APIs use service role behind `requireStaff`. |
| Strava OAuth tokens | `strava_tokens.access_token`, `refresh_token`, `expires_at`, `athlete_id` | Secret + personal data | RLS exists, but tokens are plaintext and service-role-readable. |
| Activity list | fetched live from Strava in `server/api/strava/activities.get.ts` | Sensitive summary data | Not persisted today, but start coordinates are sent to BigDataCloud. |
| Activity photos | proxied from Strava in `activities/[id]/photos.get.ts` | Potential personal data | Returned as Strava-hosted URLs. Not persisted by RadMaps. |
| Imported GPS route | `maps.geojson`, `bbox`, `stats`, `location_*` | Highly sensitive location data | Core product data. RLS protects private rows. |
| Raw GPX file | `gpx-uploads/{user.id}/{timestamp}.gpx` | Highly sensitive location data | Duplicates route data and currently has no retention/delete path. |
| Poster style | `maps.style_config`, `map_versions.style_config` | Low to medium, can include labels/logo URL | `style_config.logo_url` can drive Browserless image fetches during render. |
| Proof/final images | Supabase Storage `maps/renders/...`, URLs stored in `maps`, `order_snapshots`, `product_renders`, `orders.print_file_url` | Sensitive route image | Code uses `getPublicUrl`, so these are treated as externally accessible. |
| Public share | `/api/maps/public/:id` returns `geojson`, `bbox`, `stats`, `style_config`, render URLs | Public data after share | A share exposes full route geometry, not just a poster image. |
| Shipping/order data | `orders.shipping_address`, Stripe metadata, Gelato order payload | Personal data | Needed for fulfillment, but full address is also put in Stripe metadata. |
| Checkout snapshot | `order_snapshots.geojson`, `style_config`, `stats`, `bbox`, proof URL | Highly sensitive location data | Immutable by design, but no retention/deletion policy. |
| Worker queue/errors | `print_render_jobs.last_error`, logs | Operational data | Can contain IDs and occasional provider errors. Avoid embedding secrets/URLs in errors. |

## Current Protections

- RLS is enabled on core public-schema tables: `profiles`, `maps`, `orders`,
  `strava_tokens`, `map_versions`, render queue tables, feature flags, and
  premade/admin tables.
- User map reads/writes generally go through Supabase user sessions and filter by
  `user_id`.
- Public map sharing now requires `maps.is_public = true`.
- Render payloads require signed, expiring HMAC tickets before service-role data
  is returned to Browserless render pages.
- GPX parsing rejects files over 5 MB and rejects `DOCTYPE`/`ENTITY` before XML
  parsing.
- Stripe and Gelato webhooks verify signatures/secrets.
- Final print orders use immutable snapshots instead of reading mutable map rows
  after checkout.

## Critical Findings

### 1. Render artifacts are treated as public route-data URLs

Evidence:

- `server/api/maps/[id]/render.post.ts` uploads proof images to the `maps` bucket
  and stores `adminClient.storage.from('maps').getPublicUrl(proofPath)`.
- `render-worker-v4/src/storage.ts` uploads final images to the same bucket and
  returns `getPublicUrl(path)`.
- Stripe Checkout receives `map.render_url` as a product image.
- Gelato receives final print URLs for fulfillment.

Impact: Anyone who obtains a proof/final URL can view a user's route image. If
the `maps` bucket is public, this bypasses row-level map privacy. If the bucket
is private, these URLs are internally inconsistent and some provider integrations
may fail.

Fix:

- Split storage by intent:
  - `private-map-renders`: proof and final files, private bucket.
  - `public-share-images`: only explicitly public/share-safe thumbnails.
  - `premade-public-renders`: curated public catalog images.
- Use signed URLs for Stripe/Gelato with narrow TTLs.
- Store object paths in DB, not permanent public URLs, for private artifacts.
- On share, copy or render a separate public image into the public bucket.

### 2. Public share exposes full GPS geometry, not just a poster preview

Evidence:

- `/api/maps/public/:id` selects and returns `geojson`, `bbox`, `stats`, and
  `style_config` for any `is_public = true` map.
- `pages/map/[id].vue` renders `MapPreview`, which requires raw GeoJSON client-side.
- `copyShareLink()` sets `is_public = true` without an explicit geometry warning.

Impact: A user may believe they are sharing a poster preview, but the API exposes
the exact route geometry to every viewer and crawler able to fetch the share URL.

Fix:

- Make public shares image-first by default: return title, public proof image,
  coarse stats, and maybe a coarse bbox, not `geojson`.
- Add an explicit "Share interactive route geometry" opt-in if full geometry is
  ever needed.
- Add `is_public` controls to unshare a map.
- Add a public-share consent message that says exact route data can reveal
  private locations.

### 3. Strava OAuth requests a broad scope and lacks OAuth state validation

Evidence:

- `server/api/strava/connect.get.ts` requests `scope: 'activity:read_all'`.
- It does not generate/store an OAuth `state`.
- `server/api/strava/callback.get.ts` accepts any `code` and does not validate
  a state nonce before exchanging tokens.

Impact: `activity:read_all` can access private activities and privacy-zone data
per Strava's documentation. Missing OAuth state also leaves the flow open to
login CSRF/account-confusion issues.

Fix:

- Request `activity:read` by default.
- Add a separate, explicit "Import private activities" consent path for
  `activity:read_all`.
- Generate a cryptographically random OAuth state, store it in an HTTP-only,
  same-site cookie or server session, and validate it in the callback.
- Use configured `siteUrl` for redirect origins in production instead of trusting
  forwarded host headers.

### 4. Raw GPX uploads are persisted before validation and never cleaned up

Evidence:

- `server/api/maps/index.post.ts` uploads `gpxFile` to `gpx-uploads` before
  parsing it.
- If parsing fails, the uploaded raw file remains.
- The route is also stored as normalized GeoJSON in `maps.geojson`.

Impact: Raw GPX doubles the quantity of sensitive route data, may include device
metadata not needed by RadMaps, and has no visible retention policy.

Fix:

- Do not persist raw GPX by default. Parse in memory, insert normalized map data,
  then discard.
- If raw uploads are needed for debugging, store them only under an explicit
  user/support flag, encrypt them, and expire them automatically.
- If keeping the bucket, add lifecycle cleanup and a deletion path tied to map
  deletion/account deletion.

### 5. Strava tokens are plaintext long-lived secrets

Evidence:

- `strava_tokens` stores `access_token` and `refresh_token` as `TEXT`.
- Server routes refresh and update tokens in place.
- `disconnect.delete.ts` deletes the row but does not call Strava token
  deauthorization.

Impact: A database/service-role compromise exposes refresh tokens that can keep
accessing Strava until revoked. Staff or tooling with service role can read them.

Fix:

- Encrypt tokens at rest with a key outside the database, or use Supabase Vault
  where operationally appropriate.
- Never expose token fields to client-readable policies. Consider revoking
  `authenticated` grants on `strava_tokens` and using server routes only.
- On disconnect, call Strava deauthorization, then delete local tokens and any
  Strava activity cache.
- Add token-access logging around refresh/import routes.

## High Findings

### 6. Activity browsing sends start coordinates to third-party geocoders

Evidence:

- Activity list calls BigDataCloud reverse geocoding for each activity with
  `start_latlng`.
- Import calls Nominatim reverse geocoding for the selected activity start.

Impact: Even without persisting activity lists, RadMaps discloses precise-ish
activity starts to third parties. For home-starting runs/rides, this is sensitive.

Fix:

- Do not reverse geocode Strava list rows by default.
- If location labels are needed, derive coarse labels from a truncated geohash or
  route bbox after import.
- Cache geocoding by coarse geohash, not exact lat/lng, with no user id attached.
- Disclose geocoder use in the privacy policy if retained.

### 7. No application-level rate limiting on sensitive/costly routes

Routes needing limits:

- `/api/maps/:id/render`
- `/api/maps`
- `/api/strava/activities`
- `/api/strava/activities/:id/import`
- `/api/strava/activities/:id/photos`
- `/api/orders/lookup`
- `/api/agent/style`

Impact: Abuse can exhaust Browserless/Strava/provider quotas, create unwanted
copies of sensitive data, or support order-status enumeration.

Fix:

- Add per-user and per-IP rate limits.
- Add per-map render cool-downs using the existing proof hash cache.
- Clamp Strava `page`/`per_page`.
- Add lock/idempotency for imports of the same `activity_id`.

### 8. Order snapshots retain full routes indefinitely

Evidence:

- `order_snapshots` stores `geojson`, `stats`, `bbox`, `style_config`, and proof
  URLs keyed by `stripe_session_id`.
- Map deletion blocks ordered maps, so users currently cannot delete ordered GPS
  data without support intervention.

Impact: A purchase converts editable map data into a long-lived immutable route
copy. This is useful for fulfillment and disputes, but it needs a retention
policy and a user-facing explanation.

Fix:

- Define retention classes:
  - unpaid/expired checkout snapshots: delete after 7 to 30 days;
  - paid order snapshots: keep only as long as needed for fulfillment, reprints,
    fraud/dispute windows, and tax/accounting needs;
  - after retention, keep order metadata but purge `geojson` and private proof
    files where possible.
- Add an account/data deletion workflow that handles maps, tokens, raw GPX,
  private storage objects, snapshots, and caches.

### 9. Public RLS policy on `maps` exposes every public map row via Data API

Evidence:

- `CREATE POLICY "Public map share" ON public.maps FOR SELECT USING
  (is_public = true)`.
- Supabase public-schema tables can be reachable via Data API depending on grants.

Impact: Even if `/api/maps/public/:id` is later sanitized, direct Supabase REST
queries may still expose all columns for `is_public` maps if table grants allow
anon/authenticated SELECT.

Fix:

- Revoke anon access to `maps` if compatible with the app.
- Prefer a `public_map_shares` table or sanitized RPC/view containing only fields
  intended for public viewers.
- If using a view, ensure it does not bypass RLS unexpectedly and grant only the
  intended columns.

### 10. Stripe metadata contains full shipping address JSON

Evidence:

- Checkout writes `metadata.shipping_address = JSON.stringify(shipping_address)`.
- Stripe already collects customer/payment details, and checkout can provide
  shipping details through first-class fields.

Impact: Full address data is copied into Stripe metadata, broadening where PII is
stored and surfaced in dashboards/logs/webhooks.

Fix:

- Use Stripe Checkout shipping/customer fields as the source of truth.
- Keep metadata to non-PII identifiers: `user_id`, `map_id`,
  `product_uid`, `quantity`, `coupon_redemption_id`.
- In the webhook, read shipping details from the Stripe session object after
  expanding/using first-class fields.

## Medium Findings

- Logo upload checks client-reported MIME type, but not magic bytes or image
  dimensions. Add server-side image sniffing and pixel/dimension limits.
- JSON map creation validates GeoJSON size and bbox, but not coordinate
  finiteness, geometry type, or point count. Add a strict GeoJSON schema and
  max coordinate count.
- `orders/lookup` uses email plus partial order id and service role. Return data
  is mostly sanitized, but add rate limiting and require a longer id fragment.
- Privacy policy is a placeholder and claims users can delete account data "at
  any time", but the app does not appear to provide a complete deletion/export
  flow.
- `map_versions` stores only style snapshots today, which is good. If future
  versions include route geometry, apply the same retention/deletion policy as
  `maps.geojson`.

## Recommended Strava Caching Strategy

Goal: reduce Strava and geocoder requests without creating another durable PII
store.

### What not to cache

- Do not persist full Strava stream data (`latlng`, `altitude`, `time`) except as
  the created `maps.geojson` after the user clicks Import.
- Do not persist heart rate, power, zones, calories, suffer score, or other
  health/performance streams. The current code does not request them; keep it
  that way.
- Do not store raw Strava API responses wholesale.

### Activity list cache

Use a short-lived server-side cache:

- key: `strava:activities:v1:{user_id}:{athlete_id}:{page}:{per_page}`
- TTL: 5 to 15 minutes
- value: a sanitized list containing only fields used by the picker:
  `id`, `name`, `sport_type`, `distance`, `total_elevation_gain`, `start_date`,
  `moving_time`, `elapsed_time`, `summary_polyline`, `total_photo_count`, and
  optionally a Strava thumbnail URL.
- avoid exact `start_latlng` in the cached value unless the UI truly needs it;
  if cached, encrypt the value and keep the TTL short.

Prefer Redis/Vercel KV/Upstash with per-value encryption if the app runs on
stateless serverless infrastructure. In-memory cache is acceptable only as a dev
fallback.

### Import cache/lock

For `POST /api/strava/activities/:id/import`:

- add an idempotency/lock key: `strava:import-lock:{user_id}:{activity_id}` with
  a 1 to 5 minute TTL;
- do not cache streams durably;
- optionally keep the fetched stream in encrypted memory for a few minutes only
  to retry transient map insert failures;
- add a `strava_activity_imports` table with `user_id`, `athlete_id`,
  `activity_id`, `map_id`, `imported_at` to avoid duplicate map creation without
  storing Strava stream payloads.

### Geocoding cache

If reverse geocoding remains:

- compute a coarse geohash from the route bbox center or start point, precision
  5 or 6 depending on acceptable privacy;
- cache only `city`, `region`, `country`, not exact lat/lng;
- key by coarse geohash, not user id;
- TTL: 30 to 90 days;
- do not call geocoders for every activity list row.

### Disconnect behavior

On Strava disconnect:

- call Strava deauthorization;
- delete `strava_tokens`;
- delete activity-list/import cache keys for the user;
- keep already imported maps only because they are user-created RadMaps records,
  and make this clear in the UI.

## Remediation Plan

## Implementation Progress

Implemented on 2026-05-09:

- Strava OAuth now validates a same-site state cookie and requests
  `activity:read` by default. `?private=1` is the explicit path for
  `activity:read_all`.
- Strava access/refresh tokens are encrypted before storage, and legacy
  plaintext rows are encrypted the next time they are read/refreshed.
- Strava disconnect attempts upstream deauthorization before deleting the local
  token row.
- Strava activity browsing uses a short-lived sanitized server cache and no
  longer includes exact `start_latlng` in the API response.
- Strava import uses an import lock, validates activity IDs, avoids durable
  stream caching, and no longer reverse-geocodes exact start coordinates.
- GPX uploads are parsed in memory and are no longer persisted to
  `gpx-uploads` by default.
- Server-side GeoJSON validation now rejects non-line geometry, out-of-range
  coordinates, non-finite elevations, and routes over 50,000 points.
- Public map shares now return an image-first payload; `geojson`, `bbox`, and
  `style_config` are no longer returned by `/api/maps/public/:id`.
- Basic in-process rate limiting was added for map creation, proof rendering,
  Strava list/import/photos, and public order lookup.
- Custom Stripe Checkout no longer copies private route preview URLs into
  Stripe product image metadata.
- Final print worker uploads now return signed Supabase Storage URLs for Gelato
  handoff instead of constructing permanent public final-artifact URLs.

Still pending:

- Full private-bucket migration for proof thumbnails and dashboard/share image
  handling. Proof URLs are still stored in existing `maps.*_url` columns.
- Durable distributed rate limiting, preferably backed by Redis/KV rather than
  in-process memory.
- A persistent `strava_activity_imports` idempotency table.
- Coarse geohash-based location labeling.
- Account/data export and deletion workflow.
- Retention cleanup jobs for old snapshots, private artifacts, and caches.

### Phase 0 - Immediate launch blockers

1. Make render storage private by default and stop storing permanent public URLs
   for private proofs/finals.
2. Change public shares to image-only, or add explicit geometry-sharing consent.
3. Remove raw GPX persistence or delete raw files immediately after successful
   parse; cleanup failed uploads.
4. Add OAuth state validation and reduce default Strava scope to `activity:read`.
5. Encrypt Strava tokens and revoke them on disconnect.

### Phase 1 - Abuse and minimization

1. Add rate limits for render, upload, Strava list/import/photos, order lookup,
   and AI agent routes.
2. Add short-lived sanitized Strava activity cache.
3. Remove per-row activity-list reverse geocoding; replace with coarse cached
   geocoding after import.
4. Add strict GeoJSON validation.
5. Add image magic-byte/dimension validation for logos.

### Phase 2 - Retention and user rights

1. Build a real data deletion/export workflow.
2. Add retention cleanup jobs for raw GPX, expired snapshots, private render
   artifacts, and caches.
3. Add an ordered-map privacy mode that can purge route geometry after fulfillment
   while retaining required order records and optionally the final poster image.
4. Replace placeholder privacy policy with a policy that names Strava, Stripe,
   Gelato, Browserless, Supabase, Resend, and any geocoding providers.

## Reference Notes

- Supabase documents that service-role keys bypass RLS and must never be exposed
  to clients.
- Supabase Storage access is controlled through storage RLS; service keys bypass
  these policies.
- Strava documents `activity:read_all` as broader than `activity:read`,
  including private activities/privacy-zone data.
- Strava rate-limit guidance recommends caching/webhooks rather than polling
  heavily.

Sources:

- https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/rate-limits/
