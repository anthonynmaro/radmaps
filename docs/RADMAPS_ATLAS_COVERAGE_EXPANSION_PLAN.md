# RadMaps Atlas Coverage Expansion Plan

This is the execution plan for expanding owned RadMaps tile coverage after the
first hosted PMTiles deployments. It turns the current North America staging
artifact into a sellable production path before paying for broader global
builds.

## Current Baseline

- Staging R2 has contiguous U.S., North America, New Zealand, Northern
  Spain/Camino, Mount Fuji/Japan, Patagonia Andes, Western Alps/Dolomites,
  Atlantic islands, Peru/Ecuador Andes, Nepal Himalaya, Iceland, Scotland, and
  Costa Rica proof-pack base PMTiles.
- The active staging manifest is `2026.06.09-global-hotspots.1`.
- Production is now promoted to `2026.06.09-global-hotspots-production.1` with
  the Driftless lab pack plus approved U.S., North America, New Zealand,
  Northern Spain/Camino, Mount Fuji/Japan, Patagonia Andes, Western
  Alps/Dolomites, Atlantic islands, Peru/Ecuador Andes, Nepal Himalaya,
  Iceland, Scotland, and Costa Rica base artifacts.
- High-detail terrain remains generated at render time through
  `maplibre-contour` in the editor and AWS renderer; precomputed contour PMTiles
  are retained for QA/cache experiments only.
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
- `northern-spain-camino` completed a real staging build in workflow run
  `26487824348`.
- Northern Spain artifact details:
  - artifact id: `radmaps-northern-spain-camino-base`
  - atlas version: `2026.05.27-northern-spain-camino.1`
  - object path:
    `atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles`
  - size: `396,275,576` bytes
  - bounds: `[-9.4, 41.7, -0.7, 43.6]`
  - zooms: `0-14`
- Public tile checks through `tiles.radmaps.studio`:
  - `/tiles/staging/radmaps-northern-spain-camino-base/8/124/94.mvt` ->
    `97,251` bytes.
  - `/tiles/staging/radmaps-northern-spain-camino-base/10/499/378.mvt` ->
    `25,960` bytes.
- Rendered review artifact:
  `artifacts/atlas-review/camino-northern-spain-field-topo.png`.

## 2026-06-09 Global Hotspot Execution Log

- Added runnable split regions in `atlas/regions.json` for
  `western-alps-dolomites`, `atlantic-islands-portugal`,
  `atlantic-islands-canaries`, `andes-peru`, `andes-ecuador`,
  `nepal-himalaya`, `iceland-adventure`, `scotland-adventure`, and
  `costa-rica-central-america`.
- Kept total planned build estimate at `$130` against the `$200` coverage
  budget gate. The Scotland rerun raised conservative run accounting to `$145`,
  still under the `$196.25` remaining budget recorded from the AWS billing
  screenshot.
- Built the nine new base PMTiles on the short-lived AWS EC2 runner
  `i-0da4f63b939fd99d1`; the runner was terminated after validation.
- The first Scotland run failed because the Geofabrik URL returned HTML. The
  URL was corrected to
  `https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf`,
  the bad source/output files were removed, and rerun `27206657696` succeeded.
- Published corrected staging manifest `2026.06.09-global-hotspots.1` with
  `15` base artifacts and `177` contour artifacts through GitHub Actions run
  `27207092680`.
- Promoted production manifest
  `2026.06.09-global-hotspots-production.1` through GitHub Actions run
  `27209290643`; production now has `16` base artifacts and `1` contour
  artifact.
- Production verification passed:
  - live production manifest returned `200` and included all nine new
    artifacts.
  - each new production PMTiles object returned HTTP `206` and `PMTiles`
    magic bytes.
  - each new `/tiles/production/{artifactId}/8/{x}/{y}.mvt` probe returned
    HTTP `200` with the matching `X-RadMaps-Atlas-Artifact` response header.
- Remaining work is publishing z16 `poi` overlays from Overture Places and
  z16 `outdoorRoutes` overlays from named OSM hiking/bicycle/MTB relations
  across every hotspot target, then completing AWS-rendered `24x36` print QA
  for every new global-hotspot fixture before broad customer marketing.
- Overlay execution now has a dedicated builder:
  `npm run atlas:build-overlays -- --target <target|all> --kind <all|poi|outdoorRoutes>`.
  It reads `atlas/overlay-targets.json`, enforces the shared `$200` coverage
  budget gate, filters Overture Places for print-useful POIs, extracts named
  OSM outdoor route relations through Overpass, validates PMTiles metadata, and
  writes mergeable manifests.
- The wider `honshu-japan` staging build failed in workflow run `26488700331`
  after `13m16s` with Docker/Planetiler exit `137` during archive generation,
  consistent with an `ubuntu-latest` runner memory kill. No partial artifact was
  published.
- `mount-fuji-japan` was added as the narrower Japan proof pack and completed a
  real staging build in workflow run `26489256148`.
- Mount Fuji artifact details:
  - artifact id: `radmaps-mount-fuji-japan-base`
  - atlas version: `2026.05.27-mount-fuji-japan.1`
  - object path:
    `atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles`
  - size: `47,255,485` bytes
  - bounds: `[138.35, 34.95, 139.3, 35.75]`
  - zooms: `0-14`
- Public tile checks through `tiles.radmaps.studio`:
  - `/tiles/staging/radmaps-mount-fuji-japan-base/8/226/101.mvt` ->
    `114,160` bytes.
  - `/tiles/staging/radmaps-mount-fuji-japan-base/10/906/404.mvt` ->
    `64,442` bytes.
- Rendered review artifact:
  `artifacts/atlas-review/mount-fuji-japan-field-topo.png`.
- `patagonia-andes` completed a real staging build in workflow run
  `26489887144`.
- Patagonia artifact details:
  - artifact id: `radmaps-patagonia-andes-base`
  - atlas version: `2026.05.27-patagonia-andes.1`
  - object path:
    `atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles`
  - size: `234,649,027` bytes
  - bounds: `[-76.2, -55.2, -68, -40]`
  - zooms: `0-14`
- Public tile checks through `tiles.radmaps.studio`:
  - `/tiles/staging/radmaps-patagonia-andes-base/8/76/170.mvt` ->
    `29,676` bytes.
  - `/tiles/staging/radmaps-patagonia-andes-base/10/304/681.mvt` ->
    `20,159` bytes.
- Rendered review artifact:
  `artifacts/atlas-review/patagonia-andes-field-topo.png`.
- Production promotion completed in GitHub Actions workflow run `26519815247`
  after the approved staging base PMTiles were copied server-side from
  `radmaps-atlas-staging` to `radmaps-atlas-prod`.
- `GET /manifests/production.json` through `tiles.radmaps.studio` returns
  `2026.05.27-approved-coverage.1` with `7` base artifacts and `1` contour
  artifact.
- Production tile checks through `tiles.radmaps.studio`:
  - `/tiles/production/radmaps-us-base/8/65/95.mvt` -> `148,765` bytes.
  - `/tiles/production/radmaps-north-america-base/8/45/85.mvt` -> `100,166`
    bytes.
  - `/tiles/production/radmaps-north-america-base/8/57/113.mvt` -> `121,538`
    bytes.
  - `/tiles/production/radmaps-new-zealand-outdoor-base/8/247/164.mvt` ->
    `90,428` bytes.
  - `/tiles/production/radmaps-northern-spain-camino-base/8/124/94.mvt` ->
    `97,251` bytes.
  - `/tiles/production/radmaps-mount-fuji-japan-base/8/226/101.mvt` ->
    `114,160` bytes.
  - `/tiles/production/radmaps-patagonia-andes-base/8/76/170.mvt` ->
    `29,676` bytes.

## Coverage Target Matrix

The operational coverage queue lives in `atlas/coverage-targets.json` v2. It
keeps premade-map anchors, sport/audience priorities, global vacation hotspots,
artifact kinds, z16 overlay caps, 24x36 print QA requirements, cost guards,
actual cost fields, build status, and next actions in one machine-readable file.

Current priority order:

1. Keep production atlas QA focused on approved U.S., North America, New
   Zealand, Northern Spain/Camino, Mount Fuji/Japan, and Patagonia Andes
   coverage now that those artifacts are live.
2. Split wider Japan/Honshu or run it on a larger runner only after proof-pack
   QA justifies it.
3. Defer Alps/Dolomites, Atlantic islands, Peru/Ecuador Andes, Nepal,
   Iceland/Scotland, and Costa Rica until source selection, DEM QA, or demand
   justifies the spend.

Cost policy:

- Treat `$200` as the total coverage-build ceiling until we explicitly raise it.
- Require a dry run before any real build.
- Require `--estimated-cost-usd` before any non-dry-run heavyweight build stage.
- Require manual approval for source extracts above `20 GB`, estimated single
  runs above `$25` unless the target carries a higher cap, cached terrain
  outside measured AWS renderer reliability/demand, any full-globe base
  artifact, or any projected run that would push actual plus estimated coverage
  spend above `$200`.
- Log actual AWS cost, instance hours, scratch storage, S3 bytes, R2 bytes,
  object paths, and manifest versions after each real run.
- Keep runtime contours as the default terrain strategy; only cache terrain
  where render data proves it is worth it.

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
- Keep the AWS renderer waiting on explicit render readiness, not fixed sleeps.

Acceptance:
- Rendered maps are available for human review.
- Large-size renders complete with the same atlas sources as the editor.

### 4. Product Coverage Overlays

Goal: expand what users notice before expanding geography.

- Keep `base` artifacts responsible for Planetiler/OSM roads, water, landcover,
  buildings, places, base POIs, and basic trail/path geometry from
  `transportation`.
- Use the existing `poi` artifact key for bbox-filtered Overture Places
  overlays. Do not introduce a second generic POI model.
- Add `outdoorRoutes` only for named OSM route relations and semantic route
  metadata from `route=hiking`, `route=bicycle`, and `route=mtb`; do not create
  a duplicate trail base layer.
- Prioritize public lands, national/state/provincial parks, trailheads, peaks,
  viewpoints, campsites, parking, water, recreation boundaries, vacation POIs,
  and higher-value outdoor route labels.
- Store overlays as manifest-managed artifacts so base coverage and overlays
  can update independently.
- Build hotspot `poi` and `outdoorRoutes` overlays to z16 for 24x36 print
  readability.
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
  AWS renderer outputs.
- Cache contour PMTiles only for regions with measured render latency,
  AWS renderer timeout risk, DEM availability gaps, or paid-order demand.
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
