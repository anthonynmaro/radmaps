# RadMaps Atlas Coverage Expansion Plan

This is the execution plan for expanding owned RadMaps tile coverage after the
first hosted PMTiles deployments. It turns the current North America staging
artifact into a sellable production path before paying for broader global
builds.

## Current Baseline

- Staging R2 has contiguous U.S., North America, and New Zealand base PMTiles.
- The active staging manifest is `2026.05.27-new-zealand-outdoor.1`.
- Production still points at the Driftless manifest until tile routing,
  Browserless rendering, attribution, analytics, and rollback checks pass.
- High-detail terrain remains browser/Browserless-generated through
  `maplibre-contour`; precomputed contour PMTiles are retained for QA/cache
  experiments only.
- `radmaps.studio` DNS is now delegated to Cloudflare, and
  `tiles.radmaps.studio` is attached to the Cloudflare Worker custom domain.

## 2026-05-26 Execution Log

- `tiles.radmaps.studio` is live through the Cloudflare Worker custom domain
  and backed by the R2 staging/production manifests. The Vercel/Nuxt shim
  remains available as fallback while resolver caches expire.
- `workers/atlas-tiles` is deployed at
  `https://radmaps-atlas-tiles.radmaps-atlas.workers.dev` with R2 bindings for
  `radmaps-atlas-staging` and `radmaps-atlas-prod`.
- Cloudflare nameserver delegation is active for `radmaps.studio`; public
  resolvers now return `gabe.ns.cloudflare.com` and
  `lindsey.ns.cloudflare.com`.
- `GET /manifests/staging.json` returns `2026.05.21-staging-composite.1` with
  `2` base artifacts and `177` contour artifacts.
- `GET /manifests/production.json` returns the Driftless production manifest
  with `1` base artifact and `1` contour artifact.
- `HEAD /manifests/staging.json` and
  `HEAD /tiles/staging/radmaps-us-base/8/65/95.mvt` return `200`.
- Tile byte checks through the public hostname:
  - U.S. sample:
    `/tiles/staging/radmaps-us-base/8/65/95.mvt` -> `148,765` bytes.
  - Canada/Banff sample:
    `/tiles/staging/radmaps-north-america-base/8/45/85.mvt` -> `100,166`
    bytes.
  - Mexico sample:
    `/tiles/staging/radmaps-north-america-base/8/57/113.mvt` -> `121,538`
    bytes.
- The same tile byte checks pass through the Worker hostname and Cloudflare
  custom domain with `X-RadMaps-Atlas-Delivery: cloudflare-worker`.
- Rendered review artifacts were generated with explicit render readiness:
  - `artifacts/atlas-review/chicago-us-field-topo.png`
  - `artifacts/atlas-review/banff-north-america-field-topo.png`
  - `artifacts/atlas-review/mexico-city-contour-wash.png`

## 2026-05-27 Execution Log

- Dry-run GitHub Actions builds passed for `patagonia-andes`,
  `northern-spain-camino`, `honshu-japan`, and `new-zealand-outdoor` on the
  pushed `codex/atlas-coverage-expansion` branch.
- The pipeline now generates a per-region manifest and merges it into the
  active environment manifest before publishing, so adding a base artifact does
  not drop existing base or contour artifacts.
- `new-zealand-outdoor` completed a real staging build in workflow run
  `26487267646`.
- New Zealand artifact details:
  - artifact id: `radmaps-new-zealand-outdoor-base`
  - atlas version: `2026.05.27-new-zealand-outdoor.1`
  - object path:
    `atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles`
  - size: `403,714,835` bytes
  - bounds: `[166, -47.4, 179, -34]`
  - zooms: `0-14`
- Public tile checks through `tiles.radmaps.studio`:
  - `/tiles/staging/radmaps-new-zealand-outdoor-base/8/247/164.mvt` -> `90,428`
    bytes.
  - `/tiles/staging/radmaps-new-zealand-outdoor-base/10/991/659.mvt` -> `11,954`
    bytes.
- Rendered review artifact:
  `artifacts/atlas-review/queenstown-new-zealand-field-topo.png`.

## Coverage Target Matrix

The operational coverage queue lives in `atlas/coverage-targets.json`. It keeps
premade-map anchors, sport/audience priorities, global vacation hotspots, cost
guards, build status, and next actions in one machine-readable file.

Current priority order:

1. Promote the already-built North America base atlas after QA.
2. Build small global proof packs for current premade regions:
   Patagonia, Northern Spain/Camino, and Honshu/Japan.
3. Review the live New Zealand staging proof pack across Queenstown, Rotorua,
   Great Walks, and bikepacking fixtures.
4. Defer Alps/Dolomites, Atlantic islands, Peru/Ecuador Andes, Nepal,
   Iceland/Scotland, and Costa Rica until source selection, DEM QA, or demand
   justifies the spend.

Cost policy:

- Treat `$300/month` as the AWS experiment guardrail.
- Require a dry run before any real build.
- Require manual approval for source extracts above `20 GB`, estimated single
  runs above `$50`, cached terrain outside measured reliability/demand, or any
  full-globe base artifact.
- Log actual AWS cost, instance hours, scratch storage, S3 bytes, R2 bytes,
  object paths, and manifest versions after each real run.
- Keep browser/Browserless runtime contours as the default terrain strategy;
  only cache terrain where render data proves it is worth it.

## Execution Tracks

### 1. Hosted Tile Edge

Goal: make `https://tiles.radmaps.studio` serve the stable atlas contract.

- Serve manifests at `/manifests/staging.json` and
  `/manifests/production.json`.
- Serve approved vector tiles at
  `/tiles/{environment}/{artifactId}/{z}/{x}/{y}.mvt`.
- Resolve tiles by manifest artifact id only; never accept raw customer tile
  URLs.
- Keep the existing Nuxt `/api/atlas/tiles` endpoint as local/admin fallback.
- Preferred edge is `workers/atlas-tiles` on Cloudflare Worker + R2.
- Vercel remains a fallback shim for cache-transition and break-glass recovery.

Acceptance:
- `tiles.radmaps.studio/manifests/staging.json` returns the composite staging
  manifest.
- A known U.S. tile and a known North America tile return valid MVT bytes.
- Unknown artifact ids, out-of-range tiles, and unsupported environments fail.

### 2. North America Production QA

Goal: prove the existing North America base artifact before building more base
coverage.

- Validate U.S., Canada, Mexico, Alaska, Greenland/coastal, and ocean-heavy
  map bboxes in Atlas Lab or the style fixture.
- Check house styles: Simple Contour, Field Topo, Toner, Night Relief, and
  Watercolor.
- Confirm route linework sits below labels and remains readable.
- Confirm runtime contours and terrain illusion layers load before render
  readiness completes.

Acceptance:
- Representative maps render without missing base tiles or label/route ordering
  regressions.
- The staging manifest can be promoted by pointer change, with the previous
  production manifest retained for rollback.

### 3. Print Proofing

Goal: prove customer-visible output, not just browser previews.

- Render proof/final-style screenshots for `8x12`, `24x36`, and `32x48`.
- Cover at least U.S., Canada, and Mexico fixtures.
- Record render time, console errors, failed tile loads, and readiness status.
- Keep Browserless/Chromium waiting on explicit render readiness, not fixed
  sleeps.

Acceptance:
- Rendered maps are available for human review.
- Large-size renders complete with the same atlas sources as the editor.

### 4. Product Coverage Overlays

Goal: expand what users notice before expanding geography.

- Prioritize public lands, national/state/provincial parks, trailheads, peaks,
  viewpoints, campsites, parking, water, recreation boundaries, and higher-
  value destination POIs.
- Store overlays as manifest-managed artifacts so base coverage and overlays
  can update independently.
- Add attribution/license metadata per overlay source.

Acceptance:
- Overlay candidates are ranked by customer geography, licensing clarity, and
  print value.
- New overlay artifacts follow the same immutable-object + manifest-pointer
  release model.

### 5. Terrain Strategy

Goal: avoid expensive global contour precompute until the data proves it is
needed.

- Keep `maplibre-contour` as the default high-detail terrain path in editor and
  Browserless renders.
- Cache contour PMTiles only for regions with measured render latency,
  Browserless timeout risk, DEM availability gaps, or paid-order demand.
- Track `dem_source`, `contour_detail`, `contour_interval`, render class, and
  timeout/failure metadata on renders.

Acceptance:
- No monolithic U.S./global contour build is scheduled by default.
- Cached terrain work is driven by real render/order evidence.

### 6. Scale To Globe Base

Goal: make global coverage a staged product platform, not a single risky jump.

- Automate AWS build -> S3 handoff -> R2 transfer -> manifest merge ->
  manifest publish with budget logging.
- Record source URL/date, checksum, object bytes, build logs, validation
  output, manifest version, and rollback pointer for every build.
- Build a global base PMTiles artifact only after the North America tile path
  and render QA are proven.
- Promote higher-detail regional packs by usage, search/render/order demand,
  and reliability gaps.

Acceptance:
- The next global base build can be run repeatably from documented automation.
- Production promotion remains a manifest change, not an in-place object
  replacement.
