# RadMaps Atlas Storage

RadMaps owned atlas archives are immutable PMTiles files. They must be stored
where MapLibre can make public HTTP range requests.

The broader production rollout, layer contract, style editor model, contour
requirements, and analytics plan live in
`docs/RADMAPS_ATLAS_PRODUCTION_PLAN.md`.

The cloud build/deploy workflow lives in
`docs/RADMAPS_ATLAS_BUILD_PIPELINE.md`.

## Current Storage

Provider: Cloudflare R2  
Production bucket: `radmaps-atlas-prod`  
Staging bucket: `radmaps-atlas-staging`  
Production public domain: `pub-9d309719b5ba4334974a164f41db2a76.r2.dev`  
Staging public domain: `pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev`  
Visibility: public through R2-managed domains  
Current staging base archive:
`atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles`

Current staging manifest:
`atlas/v1/manifests/staging.json`

Current staging North America base archive:
`atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles`

Current staging New Zealand outdoor base archive:
`atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles`

Current staging Northern Spain/Camino base archive:
`atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles`

Current staging Mount Fuji/Japan base archive:
`atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles`

Current staging Patagonia Andes base archive:
`atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles`

The checked-in staging manifest includes the contiguous-US base atlas, the
North America base atlas, the New Zealand outdoor base atlas, the Northern
Spain/Camino base atlas, the Mount Fuji/Japan proof-pack base atlas, the
Patagonia Andes proof-pack base atlas, and the verified `us-terrain-phase1`
contour shard set from the successful 2026-05-18 build. Those contour shards
are retained for QA, history, and optional cached coverage experiments. They
are no longer the default strategy for scaling high-detail terrain globally.

Production direction: keep approved base archives in R2, but keep high-detail
terrain generated through `maplibre-contour` in both editor and AWS renderer
outputs. Only add/cache contour PMTiles for regions where usage, reliability,
or render latency proves the extra compute is worth it.

Overlay direction: `poi` remains the existing manifest key for additive
Overture Places overlays. `outdoorRoutes` is the only new overlay artifact kind
for named OSM `route=hiking`, `route=bicycle`, and `route=mtb` relations. Basic
trail/path geometry stays in the base `transportation` source layer. Overlay
PMTiles should use immutable paths such as
`atlas/v1/poi/{target}/{date}/radmaps-poi-{target}.pmtiles` and
`atlas/v1/outdoorRoutes/{target}/{date}/radmaps-outdoor-routes-{target}.pmtiles`,
with z16 max zoom, source date, bytes, checksum, cost, and print QA status
recorded before promotion.

Current production tile service code:
- Preferred edge: `workers/atlas-tiles`
- Live Worker verification URL:
  `https://radmaps-atlas-tiles.radmaps-atlas.workers.dev`
- Active `tiles.radmaps.studio` custom domain:
  `workers/atlas-tiles`
- Fallback Vercel/Nuxt shim:
  `server/routes/manifests/*`, `server/routes/tiles/*`, and
  `server/utils/atlasPublicTileService.ts`

Preferred production service shape:

```text
https://tiles.radmaps.studio/manifests/production.json
https://tiles.radmaps.studio/tiles/production/{artifactId}/{z}/{x}/{y}.mvt
```

The hosted tile edge reads approved manifest and PMTiles objects from R2. App
code should address artifacts by `artifactId`, not by raw PMTiles URL. Direct
public PMTiles URLs remain useful for validation, local development, and
break-glass recovery, but they are not the desired customer-facing contract.

Important environment naming note: RadMaps currently has a local app and a
production app. There is not a separate deployed staging app. In Atlas docs,
`staging` means the R2 bucket/manifest/data environment used by local Atlas Lab,
CI validation, and pre-production tile QA before a manifest is promoted to
`production`.

Current production base archive:
`atlas/v1/base/driftless/2026-05-15/radmaps-driftless-planetiler.pmtiles`

Current promoted production base archives:
- `atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles`
- `atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles`
- `atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles`
- `atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles`
- `atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles`
- `atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles`

Current production contour archive:
`atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles`

Current production manifest:
`atlas/v1/manifests/production.json`

Current staging terrain coverage:

| Region | Object | Bytes | Notes |
|---|---:|---:|---|
| `us-terrain-phase1` | 177 contour shard artifacts in `public/atlas/manifests/staging.json` | Manifest-derived | Verified 2026-05-18 staging contour coverage for Sierra/Yosemite, Colorado Front Range, Smokies/Appalachia, Moab/Canyonlands, Cascades/Seattle, and Acadia. |
| `us-terrain-backbone` | 136 contour shard artifacts from the 2026-05-18 build | Manifest-sync candidate | Successful broader terrain build; sync to staging when those areas are needed in Atlas Lab or editor QA. |
| Yosemite | `atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles` | `9,978,006` | Mountain contour showcase, z8-14. |
| Rocky Mountain | `atlas/v1/terrain/rocky-mountain/2026-05-17/radmaps-rocky-mountain-contours.pmtiles` | `11,662,164` | High-relief contour showcase, z8-14. |
| Smokies | `atlas/v1/terrain/smokies/2026-05-17/radmaps-smokies-contours.pmtiles` | `16,111,631` | Eastern mountain contour showcase, z8-14. |
| North Shore | `atlas/v1/terrain/superior/2026-05-17/radmaps-superior-contours.pmtiles` | `4,390,525` | Midwest/North Shore contour showcase, z8-14. |

The 2026-05-17 single-region objects are retained as fallback/history. The
primary Atlas Lab model is now manifest artifact resolution, not a hardcoded
small contour preview box.

The manifest is the preferred app entry point. Direct PMTiles URLs are retained
as local development and emergency fallbacks:

```bash
NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/manifests/production.json
NUXT_PUBLIC_RADMAPS_ATLAS_PMTILES_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/base/driftless/2026-05-15/radmaps-driftless-planetiler.pmtiles
NUXT_PUBLIC_RADMAPS_CONTOUR_PMTILES_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles
ATLAS_PUBLIC_BASE_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev
```

For Atlas Lab staging against the full contiguous-US base:

```bash
NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL=https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/manifests/staging.json
```

Verification performed:

```bash
curl -H 'Range: bytes=0-16383' "$NUXT_PUBLIC_RADMAPS_ATLAS_PMTILES_URL"
curl -H 'Range: bytes=0-16383' "$NUXT_PUBLIC_RADMAPS_CONTOUR_PMTILES_URL"
```

Expected result:
- HTTP `206 Partial Content`
- `Content-Range` header
- first bytes decode to `PMTiles`

Full-US staging verification on 2026-05-17:
- `atlasVersion`: `2026.05.17-us.1`
- object: `atlas/v1/base/us/2026-05-17/radmaps-base-us.pmtiles`
- bytes: `9,593,839,310`
- bounds: `[-125, 24.4, -66.8, 49.5]`
- zooms: `0-14`
- upload mode: R2 multipart, `36` parts
- public range check: HTTP `206 Partial Content`

North America staging verification on 2026-05-21:
- source build id: `north-america-base-20260521T203307Z`
- AWS build object:
  `s3://radmaps-atlas-build-470337544102-us-east-2/north-america/north-america-base-20260521T203307Z/radmaps-base-north-america.pmtiles`
- R2 object:
  `atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles`
- public URL:
  `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles`
- bytes: `20,296,668,015`
- SHA-256:
  `b0409e5c1a02e32f6ecc4c522b09500f80ce7185388abd8f8ad67eaff908118f`
- bounds: `[-170, 5, -50, 84]`
- zooms: `0-14`
- public range check: HTTP `206 Partial Content`
- staging manifest version: `2026.05.21-staging-composite.1`
- staging manifest counts: `2` base artifacts, `177` contour artifacts

New Zealand outdoor staging verification on 2026-05-27:
- workflow run: `26487267646`
- R2 object:
  `atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles`
- public URL:
  `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles`
- bytes: `403,714,835`
- ETag: `d8a1c1e2b4bdb190e4916cbd056a33b3`
- bounds: `[166, -47.4, 179, -34]`
- zooms: `0-14`
- tile checks through `tiles.radmaps.studio`:
  `/tiles/staging/radmaps-new-zealand-outdoor-base/8/247/164.mvt` -> `90,428`
  bytes and `/tiles/staging/radmaps-new-zealand-outdoor-base/10/991/659.mvt`
  -> `11,954` bytes
- staging manifest version: `2026.05.27-new-zealand-outdoor.1`
- staging manifest counts: `3` base artifacts, `177` contour artifacts

Northern Spain/Camino staging verification on 2026-05-27:
- workflow run: `26487824348`
- R2 object:
  `atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles`
- public URL:
  `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles`
- bytes: `396,275,576`
- ETag: `4fea855986806ff343573599869a0fa7`
- bounds: `[-9.4, 41.7, -0.7, 43.6]`
- zooms: `0-14`
- tile checks through `tiles.radmaps.studio`:
  `/tiles/staging/radmaps-northern-spain-camino-base/8/124/94.mvt` -> `97,251`
  bytes and `/tiles/staging/radmaps-northern-spain-camino-base/10/499/378.mvt`
  -> `25,960` bytes
- staging manifest version: `2026.05.27-northern-spain-camino.1`
- staging manifest counts: `4` base artifacts, `177` contour artifacts

Mount Fuji/Japan staging verification on 2026-05-27:
- workflow run: `26489256148`
- R2 object:
  `atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles`
- public URL:
  `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles`
- bytes: `47,255,485`
- ETag: `c9064f3ad83d7693ce564ab0f56e1974`
- bounds: `[138.35, 34.95, 139.3, 35.75]`
- zooms: `0-14`
- tile checks through `tiles.radmaps.studio`:
  `/tiles/staging/radmaps-mount-fuji-japan-base/8/226/101.mvt` -> `114,160`
  bytes and `/tiles/staging/radmaps-mount-fuji-japan-base/10/906/404.mvt`
  -> `64,442` bytes
- staging manifest version: `2026.05.27-mount-fuji-japan.1`
- staging manifest counts: `5` base artifacts, `177` contour artifacts

Patagonia Andes staging verification on 2026-05-27:
- workflow run: `26489887144`
- R2 object:
  `atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles`
- public URL:
  `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles`
- bytes: `234,649,027`
- ETag: `397eab9eb30cefa9c1935aab89ad1c30`
- bounds: `[-76.2, -55.2, -68, -40]`
- zooms: `0-14`
- tile checks through `tiles.radmaps.studio`:
  `/tiles/staging/radmaps-patagonia-andes-base/8/76/170.mvt` -> `29,676`
  bytes and `/tiles/staging/radmaps-patagonia-andes-base/10/304/681.mvt`
  -> `20,159` bytes
- staging manifest version: `2026.05.27-patagonia-andes.1`
- staging manifest counts: `6` base artifacts, `177` contour artifacts

Regional terrain showcase verification on 2026-05-17:
- workflow: `.github/workflows/atlas-terrain-pack.yml`
- run: `25985273254`
- environment: `staging`
- regions: `yosemite`, `rocky-mountain`, `smokies`, `superior`
- public range checks: HTTP `206 Partial Content`
- first bytes decode to `PMTiles`

Manifest verification:

```bash
curl "$NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL"
```

Expected result:
- valid JSON
- `schemaVersion` is `radmaps-atlas-v1`
- `artifacts.base[]` and `artifacts.contours[]` point at immutable PMTiles
- artifact `etag`, `bytes`, `bounds`, zoom range, and layer names match the
  uploaded archives

## Bucket Configuration

Both R2 buckets have CORS allowing PMTiles/MapLibre reads from:

- `https://radmaps.studio`
- `https://www.radmaps.studio`
- `https://*.vercel.app`
- local dev origins on ports `3000`, `3001`, and `3002`

Allowed methods are `GET` and `HEAD`. Exposed headers include
`Accept-Ranges`, `Content-Range`, `Content-Length`, `ETag`, and
`Cache-Control`.

Custom domain status:
- `tiles.radmaps.studio` is active and publicly serves manifests and MVT tiles
  through the Cloudflare Worker custom domain.
- `workers/atlas-tiles` is deployed on workers.dev and the custom domain, and
  verified against the staging R2 manifest.
- During DNS transition, some resolvers may briefly use the prior Vercel
  wildcard address; the Vercel/Nuxt shim keeps those requests healthy.
- Use the hosted tile route for product-facing checks and the R2-managed
  domains for range-read validation and break-glass recovery.

## Immutability, Manifests, And Sync

PMTiles objects are immutable release artifacts. Do not overwrite an existing
object path to "sync" map updates. A refresh creates a new PMTiles object path
and then updates the environment manifest after validation.

Why:

- Browser, CDN, and render-worker caches can safely keep old immutable objects.
- Rollback is fast because the manifest can point back to the previous archive.
- Usage analytics can attribute renders to an exact `atlas_version` and object
  path.
- Failed builds do not corrupt the currently working atlas.

Manifest responsibilities:

- `atlas/v1/manifests/staging.json` points Atlas Lab and staging tests at the
  current candidate archives.
- `atlas/v1/manifests/production.json` points production editor/proof/final
  renders at the last approved archives.
- Manifests should include artifact URL, object path, bytes, etag, bounds,
  zoom range, source layers, source-data date, and atlas version.

Storage refresh checklist:

1. Upload new PMTiles to a dated object key.
2. Verify R2 `GET`/`HEAD` and HTTP range reads.
3. Generate/update the staging manifest.
4. Verify Atlas Lab loads from staging manifest.
5. Render representative samples.
6. Publish production manifest only after QA passes.
7. Retain at least the previous production PMTiles and manifest for rollback.

When a large atlas is built on a short-lived AWS runner, treat AWS S3 as the
durable build handoff and R2 as the serving origin:

1. The runner uploads the raw PMTiles and generated build manifest to the
   private AWS build bucket.
2. Copy the PMTiles from AWS S3 to the immutable R2 key declared by the build
   manifest, for example
   `atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles`.
3. Merge only the new artifact into the active staging manifest so existing
   contour shards and other validated artifacts remain listed:

```bash
npm run atlas:merge-manifest-artifact -- \
  --source /tmp/north-america-staging.json \
  --target public/atlas/manifests/staging.json \
  --kind base \
  --public-base-url https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev
```

4. Publish `public/atlas/manifests/staging.json` to
   `atlas/v1/manifests/staging.json` only after the new R2 PMTiles object is
   present and range-readable.

Current operational lesson: for large atlas builds, the Mac is not the right
data plane. It is fine as the control plane for kicking off AWS, checking logs,
and editing manifests, but the heavy PMTiles bytes should move from AWS S3 to
R2 inside the cloud. The first North America archive was 18.9 GiB; attempting
to stream that through the laptop was slow and failed under local disk pressure.

## Production Promotion Checklist

Production promotion for the approved May 2026 base coverage completed in
workflow run `26519815247`. Future promotions should not run until all of these
are true:

- The hosted tile route serves the staging manifest and at least one known
  U.S. and North America base tile by artifact id through
  `tiles.radmaps.studio`.
- Atlas Lab proves base coverage in U.S., Canada, Mexico, Alaska, and at least
  one coastal/ocean-heavy map.
- AWS renderer proof and final renders complete for `8x12`, `24x36`, and
  `32x48` using Atlas styles.
- Route linework renders below labels and remains readable across house styles.
- Runtime contours from `maplibre-contour` load before render readiness marks
  final screenshots complete.
- Attribution text and manifest source licenses are present for OSM-derived
  base data and DEM-derived terrain.
- Usage analytics can record `atlas_version`, `artifact_ids`,
  `atlas_style_id`, enabled layers, render class, and print size.
- The prior production manifest remains available for rollback.

## Budget Posture

AWS atlas experiment guardrail: `$300/month`.

Current choice: Cloudflare R2.

Why R2 is preferred for production PMTiles:
- PMTiles relies on many HTTP range reads.
- R2 has free egress for standard storage.
- R2 is S3-compatible, so the build/upload path remains portable.

Why not Vercel Blob for primary tile archives:
- It is convenient, but blob data transfer is billable.
- Large PMTiles and repeated map preview/render traffic can make tile delivery
  scale with usage faster than storage cost.

Build compute is separate from tile serving. The first North America base build
ran on temporary AWS compute and should be treated as a one-off build expense,
not a monthly serving expense. The observed path was low single-digit dollars
for compute/temporary transfer at this scale, but future global builds must log
the exact instance hours, attached storage, S3 bytes, and transfer runner time
before and after every run. Keep the `$300` AWS budget guardrail active for
atlas experiments and prefer explicit stop/terminate verification after each
runner.

## Upload Workflow

Upload the current local archive:

```bash
npm run atlas:upload-pmtiles
```

Upload a specific archive:

```bash
npm run atlas:upload-pmtiles -- \
  --source public/atlas/my-region.pmtiles \
  --object atlas/v1/base/my-region/2026-05-15/my-region.pmtiles
```

Publish the production manifest after all artifacts verify:

```bash
npm run atlas:publish-manifest
```

Publish a staging or production manifest through GitHub Actions when local R2
credentials are not available:

```bash
gh workflow run "Atlas Publish Manifest" --ref main -f environment=staging
```

Promote approved staging base artifacts to production with server-side R2 copy:

```bash
gh workflow run atlas-build.yml \
  --ref <branch-or-main> \
  -f region=north-america \
  -f environment=production \
  -f stage=promote-approved \
  -f atlas_version=<yyyy.mm.dd-approved-coverage.n> \
  -f runner_label=ubuntu-latest \
  -f dry_run=false
```

The R2 upload path:
- writes immutable PMTiles objects into `radmaps-atlas-prod` or
  `radmaps-atlas-staging`
- uses S3 multipart upload for large PMTiles archives beyond single PUT limits
- uploads with long-lived cache headers
- verifies public range requests before printing the URL
- updates `public/atlas/manifests/*.json` and the matching R2 manifest object
  after all referenced artifacts pass verification

Create least-privilege R2 S3 credentials for local/build-worker uploads:

```bash
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
# only for temporary R2 credentials
R2_SESSION_TOKEN=...
```

Do not commit upload tokens or R2 access keys.

## Publishing Rules

- Treat PMTiles archives as immutable. Publish a new object path for every
  rebuild.
- Treat atlas manifests as mutable pointers to immutable artifacts. Update a
  manifest only after all referenced PMTiles exist and have passed range-read
  verification.
- Publish manifests to R2 at `atlas/v1/manifests/{environment}.json` so the
  Cloudflare Worker can serve them.
- Include `id`, `kind`, `url`, `objectPath`, `bounds`, `minzoom`, `maxzoom`,
  `layers`, `bytes`, `etag` or checksum when available, `sourceLicenses`, and
  `createdAt` on every artifact.
- Include source, region, and date/version in the object path.
- Do not overwrite an archive used by proofs, final renders, or catalog previews
  unless the replacement is byte-for-byte equivalent.
- Store the active manifest URL in `NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL`.
- Keep `NUXT_PUBLIC_RADMAPS_ATLAS_PMTILES_URL` and
  `NUXT_PUBLIC_RADMAPS_CONTOUR_PMTILES_URL` available as fallbacks for local
  tests and break-glass recovery.
- Track future production usage by `atlas_version`, object path, provider,
  render class, and map/style preset.

## Next Infrastructure Step

For full US builds, use external build/storage capacity rather than this laptop.
The local disk is too tight for a US Planetiler extract plus temp files.

Target options:
- Keep `tiles.radmaps.studio` on the Cloudflare Worker edge and retain the
  Vercel shim for break-glass recovery.
- Point `NUXT_PUBLIC_RADMAPS_ATLAS_TILE_BASE_URL` at the Worker/custom domain
  in local dev while using the `staging` Atlas manifest/data environment.
- Add a permanent least-privilege R2 upload credential for build automation.
- Run `.github/workflows/atlas-build.yml` on a larger GitHub runner or
  short-lived self-hosted cloud VM with enough scratch disk for Planetiler.
