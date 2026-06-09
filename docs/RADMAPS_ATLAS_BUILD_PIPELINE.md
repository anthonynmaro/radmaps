# RadMaps Atlas Build Pipeline

This is the deployable build path for owned RadMaps PMTiles. It is designed to
run on cloud compute with large scratch storage, not on the local development
machine.

## Deployed Runner

The GitHub Actions workflow lives at:

`.github/workflows/atlas-build.yml`

Regional terrain packs are built by:

`.github/workflows/atlas-terrain-pack.yml`

It is manually dispatched with:

- `region`: `driftless-lab`, `us-midwest`, `us-contiguous`,
  `north-america`, `patagonia-andes`, `northern-spain-camino`,
  `honshu-japan`, `mount-fuji-japan`, or `new-zealand-outdoor`
- `environment`: `staging` or `production`
- `stage`: `all` or a comma-separated subset such as `preflight,download,base`
- `atlas_version`: optional explicit manifest version
- `runner_label`: `ubuntu-latest` for dry runs, or a larger/self-hosted atlas
  runner for real production builds
- `dry_run`: defaults to `true`

Environment naming: `staging` and `production` in this pipeline refer to Atlas
R2 buckets/manifests and QA state, not separate Nuxt deployments. RadMaps
currently has local development and production app deployments only. Local
Atlas Lab should use the `staging` Atlas manifest when validating new tile data.

Use a self-hosted runner or larger GitHub runner with at least:

- 120GB free scratch for regional builds
- 500GB free scratch for the first full U.S. base build
- Docker
- Node 22

## Required GitHub Secrets

Set these as GitHub Actions repository secrets before turning off `dry_run`:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_SESSION_TOKEN
ATLAS_PROD_PUBLIC_BASE_URL
ATLAS_STAGING_PUBLIC_BASE_URL
```

`R2_SESSION_TOKEN` is only required when the build uses temporary Cloudflare R2
credentials. Permanent least-privilege R2 keys do not need it.

The R2 key should be least-privilege and scoped to object reads/writes for:

- `radmaps-atlas-prod`
- `radmaps-atlas-staging`

## Region Registry

Build regions are declared in:

`atlas/regions.json`

Current entries:

- `driftless-lab`: validates and republishes the current regional lab pack.
- `us-midwest`: first larger regional base-build target.
- `us-contiguous`: first full U.S. base-build target. Staging build
  `2026.05.17-us.1` produced a validated `9,593,839,310` byte PMTiles archive
  and published it to R2.
- `north-america`: U.S., Canada, Mexico, Greenland, and surrounding North
  America coverage. AWS build `north-america-base-20260521T203307Z` produced a
  validated `20,296,668,015` byte PMTiles archive and published it to the
  staging R2 manifest as artifact `radmaps-north-america-base`.
- `patagonia-andes`: first South America proof pack for Torres del Paine,
  Patagonia hiking/vacation maps, and Carretera Austral-style bikepacking.
  Staging build `2026.05.27-patagonia-andes.1` produced a validated
  `234,649,027` byte PMTiles archive and published it to R2 as artifact
  `radmaps-patagonia-andes-base`.
- `northern-spain-camino`: Europe proof pack for Camino product coverage;
  intentionally uses the Spain extract to keep cost small and defers the French
  start segment to a later Pyrenees multi-extract or Europe run. Staging build
  `2026.05.27-northern-spain-camino.1` produced a validated `396,275,576` byte
  PMTiles archive and published it to R2 as artifact
  `radmaps-northern-spain-camino-base`.
- `honshu-japan`: wider first Asia proof pack for Mount Fuji and Japan
  hiking/vacation maps. The first `ubuntu-latest` real build failed with
  exit `137` during archive generation, so split regions or use a larger runner
  before retrying.
- `mount-fuji-japan`: narrower Japan proof pack for Mount Fuji. Staging build
  `2026.05.27-mount-fuji-japan.1` produced a validated `47,255,485` byte
  PMTiles archive and published it to R2 as artifact
  `radmaps-mount-fuji-japan-base`.
- `new-zealand-outdoor`: outdoor/vacation proof pack for Queenstown, Rotorua,
  Great Walks, and bikepacking. Staging build
  `2026.05.27-new-zealand-outdoor.1` produced a validated `403,714,835` byte
  PMTiles archive and published it to R2 as artifact
  `radmaps-new-zealand-outdoor-base`.
- `western-alps-dolomites`: global-hotspot proof pack for Chamonix, Zermatt,
  Innsbruck, Dolomites, Finale Ligure, and Lake Garda. Staging build
  `2026.06.09-western-alps-dolomites.1` produced a validated
  `1,201,969,253` byte PMTiles archive and published it to R2 as artifact
  `radmaps-western-alps-dolomites-base`.
- `atlantic-islands-portugal`: bounded Portugal extract for Madeira/Azores.
  Staging build `2026.06.09-atlantic-islands-portugal.1` produced a validated
  `25,126,505` byte PMTiles archive and published it to R2 as artifact
  `radmaps-atlantic-islands-portugal-base`.
- `atlantic-islands-canaries`: Canary Islands proof pack. Staging build
  `2026.06.09-atlantic-islands-canaries.1` produced a validated `44,801,019`
  byte PMTiles archive and published it to R2 as artifact
  `radmaps-atlantic-islands-canaries-base`.
- `andes-peru`: Peru Andes proof pack for Salkantay, Sacred Valley, Cordillera
  Blanca, and bikepacking/vacation fixtures. Staging build
  `2026.06.09-andes-peru.1` produced a validated `356,714,058` byte PMTiles
  archive and published it to R2 as artifact `radmaps-andes-peru-base`.
- `andes-ecuador`: Ecuador Andes proof pack for Cotopaxi, Quilotoa, and
  highland vacation fixtures. Staging build `2026.06.09-andes-ecuador.1`
  produced a validated `141,561,515` byte PMTiles archive and published it to
  R2 as artifact `radmaps-andes-ecuador-base`.
- `nepal-himalaya`: Nepal Himalaya proof pack for Everest Base Camp,
  Annapurna, Langtang, and Mustang fixtures. Staging build
  `2026.06.09-nepal-himalaya.1` produced a validated `323,016,649` byte
  PMTiles archive and published it to R2 as artifact
  `radmaps-nepal-himalaya-base`.
- `iceland-adventure`: Iceland proof pack for Laugavegur and Ring Road
  fixtures. Staging build `2026.06.09-iceland-adventure.1` produced a
  validated `165,636,294` byte PMTiles archive and published it to R2 as
  artifact `radmaps-iceland-adventure-base`.
- `scotland-adventure`: Scotland proof pack for West Highland Way, Skye, and
  Cairngorms fixtures. The first run failed because the source URL returned
  HTML; the corrected rerun `27206657696` used
  `https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf`
  and produced a validated `302,811,086` byte PMTiles archive as artifact
  `radmaps-scotland-adventure-base`.
- `costa-rica-central-america`: Costa Rica vacation-trail proof pack for
  Arenal, Monteverde, Nicoya, Osa, and Rincon de la Vieja fixtures. Staging
  build `2026.06.09-costa-rica-central-america.1` produced a validated
  `57,846,574` byte PMTiles archive and published it to R2 as artifact
  `radmaps-costa-rica-central-america-base`.

The broader product queue is tracked in `atlas/coverage-targets.json`. Targets
may be marked `production-live` for base coverage while Overture Places `poi`
and OSM `outdoorRoutes` overlays remain separate, budget-gated follow-up
artifacts.

The full U.S. source is the Geofabrik United States OSM PBF:

`https://download.geofabrik.de/north-america/us-latest.osm.pbf`

Geofabrik lists that extract as about 11GB, so the build runner needs enough
scratch for the source, Planetiler working files, PMTiles output, validation,
and upload retries.

The current North America source is the Geofabrik North America OSM PBF:

`https://download.geofabrik.de/north-america-latest.osm.pbf`

The first successful run used an AWS `c7i.8xlarge` build instance with large
ephemeral scratch, uploaded the finished archive to the private AWS build
bucket, then used a short-lived in-region transfer runner to copy the object to
Cloudflare R2. That avoided local laptop disk pressure and long residential
upload times.

Run policy for new coverage targets:

- Start with `workflow_dispatch` or `npm run atlas:pipeline -- --dry-run`.
- Keep `dry_run=true` until source size, runner shape, and scratch storage are
  reviewed.
- For any non-dry-run heavyweight build stage, pass `--estimated-cost-usd`.
  The pipeline checks this against `atlas/coverage-targets.json` v2 and blocks
  runs that would exceed the `$200` total coverage-build ceiling.
- Do not run any target marked `deferred-*` in `atlas/coverage-targets.json`
  until the cost/demand gate has been explicitly cleared.
- Keep cached contours disabled for these new base packs unless AWS renderer
  render metrics show runtime contours are unreliable or too slow.

Overlay build contract:

- `base` artifacts remain the Planetiler/OSM source for roads, water,
  landcover, buildings, places, base POIs, and basic trail/path geometry in the
  `transportation` source layer.
- Overture Places enrichment is written as a separate PMTiles overlay under the
  existing manifest key `poi`, with source layer `poi`, bbox-filtered to the
  target hotspot mesh and built to z16.
- Named outdoor route enrichment is written under the manifest key
  `outdoorRoutes`, with source layer `outdoor_route`, extracted only from OSM
  relations where `route=hiking`, `route=bicycle`, or `route=mtb`, and built to
  z16.
- Overlay object paths stay immutable, for example
  `atlas/v1/poi/{target}/{date}/radmaps-poi-{target}.pmtiles` and
  `atlas/v1/outdoorRoutes/{target}/{date}/radmaps-outdoor-routes-{target}.pmtiles`.
- Every overlay run starts with `npm run atlas:pipeline -- --dry-run` or the
  equivalent overlay dry-run, records estimated cost before a real build, and
  updates `atlas/coverage-targets.json` actual cost fields after completion.
- Promote overlays by merging the generated artifact into the existing manifest
  with `npm run atlas:merge-manifest-artifact`; never replace the full manifest
  with a single overlay build output.

## Current Progress Snapshot

As of 2026-06-09:

- Staging R2 has full contiguous-U.S. base coverage, North America base
  coverage, New Zealand outdoor, Northern Spain/Camino, Mount Fuji/Japan,
  Patagonia Andes, Western Alps/Dolomites, Atlantic islands, Peru/Ecuador
  Andes, Nepal Himalaya, Iceland, Scotland, and Costa Rica proof-pack base
  artifacts.
- Staging R2 has 177 verified `us-terrain-phase1` contour PMTiles shards for
  selected U.S. terrain regions. These are retained for QA/history and optional
  cached coverage, not treated as the default global contour strategy.
- Production R2 now has the Driftless lab pack plus approved U.S., North
  America, New Zealand outdoor, Northern Spain/Camino, Mount Fuji/Japan,
  Patagonia Andes, Western Alps/Dolomites, Atlantic islands, Peru/Ecuador
  Andes, Nepal Himalaya, Iceland, Scotland, and Costa Rica base artifacts. The
  active production manifest is `2026.06.09-global-hotspots-production.1` with
  `16` base artifacts and `1` contour artifact. The global-hotspot production
  promotion completed in workflow run `27209290643`.
- The current staging manifest is a composite manifest. Do not overwrite it
  with a single build runner manifest; merge new artifacts into it so existing
  contour shards remain available.

North America build details:

| Field | Value |
|---|---|
| Build id | `north-america-base-20260521T203307Z` |
| AWS build artifact | `s3://radmaps-atlas-build-470337544102-us-east-2/north-america/north-america-base-20260521T203307Z/radmaps-base-north-america.pmtiles` |
| R2 object | `atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles` |
| R2 public URL | `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/base/north-america/2026-05-21/radmaps-base-north-america.pmtiles` |
| Size | `20,296,668,015` bytes (`18.9 GiB`) |
| SHA-256 | `b0409e5c1a02e32f6ecc4c522b09500f80ce7185388abd8f8ad67eaff908118f` |
| Bounds | `[-170, 5, -50, 84]` |
| Zooms | `0-14` |
| Verified range read | HTTP `206 Partial Content`, `Content-Range: bytes 0-1023/20296668015` |

Patagonia Andes build details:

| Field | Value |
|---|---|
| Workflow run | `26489887144` |
| Duration | `15m30s` |
| Atlas version | `2026.05.27-patagonia-andes.1` |
| Artifact id | `radmaps-patagonia-andes-base` |
| Source | `https://download.geofabrik.de/south-america-latest.osm.pbf` |
| R2 object | `atlas/v1/base/patagonia-andes/2026-05-27/radmaps-base-patagonia-andes.pmtiles` |
| Size | `234,649,027` bytes (`224 MiB`) |
| ETag | `397eab9eb30cefa9c1935aab89ad1c30` |
| Bounds | `[-76.2, -55.2, -68, -40]` |
| Zooms | `0-14` |
| Live tile check | `/tiles/staging/radmaps-patagonia-andes-base/8/76/170.mvt` -> `29,676` bytes |
| Rendered review artifact | `artifacts/atlas-review/patagonia-andes-field-topo.png` |

New Zealand build details:

| Field | Value |
|---|---|
| Workflow run | `26487267646` |
| Atlas version | `2026.05.27-new-zealand-outdoor.1` |
| Artifact id | `radmaps-new-zealand-outdoor-base` |
| Source | `https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf` |
| R2 object | `atlas/v1/base/new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles` |
| Size | `403,714,835` bytes (`385 MiB`) |
| ETag | `d8a1c1e2b4bdb190e4916cbd056a33b3` |
| Bounds | `[166, -47.4, 179, -34]` |
| Zooms | `0-14` |
| Live tile check | `/tiles/staging/radmaps-new-zealand-outdoor-base/8/247/164.mvt` -> `90,428` bytes |
| Rendered review artifact | `artifacts/atlas-review/queenstown-new-zealand-field-topo.png` |

Northern Spain/Camino build details:

| Field | Value |
|---|---|
| Workflow run | `26487824348` |
| Duration | `12m8s` |
| Atlas version | `2026.05.27-northern-spain-camino.1` |
| Artifact id | `radmaps-northern-spain-camino-base` |
| Source | `https://download.geofabrik.de/europe/spain-latest.osm.pbf` |
| R2 object | `atlas/v1/base/northern-spain-camino/2026-05-27/radmaps-base-northern-spain-camino.pmtiles` |
| Size | `396,275,576` bytes (`378 MiB`) |
| ETag | `4fea855986806ff343573599869a0fa7` |
| Bounds | `[-9.4, 41.7, -0.7, 43.6]` |
| Zooms | `0-14` |
| Live tile check | `/tiles/staging/radmaps-northern-spain-camino-base/8/124/94.mvt` -> `97,251` bytes |
| Rendered review artifact | `artifacts/atlas-review/camino-northern-spain-field-topo.png` |

Mount Fuji/Japan build details:

| Field | Value |
|---|---|
| Workflow run | `26489256148` |
| Duration | `9m28s` |
| Atlas version | `2026.05.27-mount-fuji-japan.1` |
| Artifact id | `radmaps-mount-fuji-japan-base` |
| Source | `https://download.geofabrik.de/asia/japan-latest.osm.pbf` |
| R2 object | `atlas/v1/base/mount-fuji-japan/2026-05-27/radmaps-base-mount-fuji-japan.pmtiles` |
| Size | `47,255,485` bytes (`45 MiB`) |
| ETag | `c9064f3ad83d7693ce564ab0f56e1974` |
| Bounds | `[138.35, 34.95, 139.3, 35.75]` |
| Zooms | `0-14` |
| Live tile check | `/tiles/staging/radmaps-mount-fuji-japan-base/8/226/101.mvt` -> `114,160` bytes |
| Rendered review artifact | `artifacts/atlas-review/mount-fuji-japan-field-topo.png` |

Wider Honshu/Japan build attempt:

| Field | Value |
|---|---|
| Workflow run | `26488700331` |
| Duration | `13m16s` |
| Result | Failed before upload/manifest publication |
| Failure | Docker/Planetiler exited `137` during archive generation on `ubuntu-latest`, consistent with runner memory exhaustion |
| Next action | Split Honshu into smaller regional proof packs or rerun on a larger/self-hosted atlas runner |

Current staged manifest details:

| Field | Value |
|---|---|
| URL | `https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/manifests/staging.json` |
| Atlas version | `2026.05.27-patagonia-andes.1` |
| Base artifacts | `6` (`radmaps-us-base`, `radmaps-north-america-base`, `radmaps-new-zealand-outdoor-base`, `radmaps-northern-spain-camino-base`, `radmaps-mount-fuji-japan-base`, `radmaps-patagonia-andes-base`) |
| Contour artifacts | `177` |
| Coverage label | `north-america` |

Current production manifest details:

| Field | Value |
|---|---|
| URL | `https://tiles.radmaps.studio/manifests/production.json` |
| Atlas version | `2026.06.09-global-hotspots-production.1` |
| Base artifacts | `16` (`radmaps-driftless-planetiler`, `radmaps-us-base`, `radmaps-north-america-base`, `radmaps-new-zealand-outdoor-base`, `radmaps-northern-spain-camino-base`, `radmaps-mount-fuji-japan-base`, `radmaps-patagonia-andes-base`, `radmaps-western-alps-dolomites-base`, `radmaps-atlantic-islands-portugal-base`, `radmaps-atlantic-islands-canaries-base`, `radmaps-andes-peru-base`, `radmaps-andes-ecuador-base`, `radmaps-nepal-himalaya-base`, `radmaps-iceland-adventure-base`, `radmaps-scotland-adventure-base`, `radmaps-costa-rica-central-america-base`) |
| Contour artifacts | `1` |
| Promotion workflow run | `27209290643` |
| Verification | Production manifest returned `200`; all nine new PMTiles returned HTTP `206` with `PMTiles` magic bytes; `/tiles/production/{artifactId}/8/{x}/{y}.mvt` returned `200` with matching `X-RadMaps-Atlas-Artifact` headers for all nine new artifacts. |

What remains for the New Zealand proof pack:

- Render Rotorua, Great Walks, and bikepacking fixtures across the same house
  styles used for North America QA.
- Confirm runtime contour readiness on dense mountain views and coastal views.
- Decide whether New Zealand stays staging-only or is copied/promoted with the
  next production manifest after North America passes.

What remains for the Patagonia Andes proof pack:

- Render El Chalten/Fitz Roy, Bariloche/Nahuel Huapi, Ushuaia, and Carretera
  Austral fixtures.
- Confirm sparse-road/trail density, glacier/lake labeling, runtime contour
  legibility, and South America extract costs before any broader Andes build.

What remains for the Northern Spain/Camino proof pack:

- Render Picos de Europa, Basque Country, and Galicia coast fixtures.
- Decide whether the Saint-Jean-Pied-de-Port start needs an immediate Pyrenees
  multi-extract or can wait for a later Europe build.
- Confirm Camino labels/road/trail density in Field Topo, Simple Contour, and
  Watercolor review renders.

What remains for the Mount Fuji/Japan proof pack:

- Render Hakuba/Nagano, Nikko, Kyoto/Nara, and Shimanami fixtures after the
  wider Japan coverage is split or moved to a larger runner.
- Confirm Japanese place labels, dense transportation geometry, and runtime
  contours in Field Topo, Simple Contour, and Watercolor review renders.

## Planetiler Operating Model

Planetiler is not a hosted tile service. It is an open-source build tool that
RadMaps runs in Docker/Java/GitHub Actions to convert source geodata into vector
tile archives. The official Planetiler project describes it as a tool for
generating vector tiles from OpenStreetMap and other geographic data, with
output support for MBTiles and PMTiles.

Cost posture:

- No Planetiler usage fee is expected for RadMaps builds.
- Planetiler itself is Apache-2.0 licensed.
- Our costs are build compute, scratch disk, source-data transfer, R2 storage,
  R2/API operations, and QA/render verification.
- Planetiler licensing is separate from source-data licensing. OSM-derived
  tiles still require OSM attribution and ODbL-aware handling.

Primary references:

- https://github.com/onthegomap/planetiler
- https://github.com/onthegomap/planetiler/blob/main/LICENSE

## Pipeline Stages

Run locally in dry-run mode:

```bash
npm run atlas:pipeline -- \
  --region us-contiguous \
  --environment staging \
  --stage all \
  --dry-run
```

Stages:

- `preflight`: verifies Docker and scratch disk.
- `download`: downloads the configured OSM PBF.
- `base`: runs Planetiler in Docker and writes base PMTiles.
- `contours`: runs the contour builder when a region supports it.
- `validate`: validates PMTiles headers, zoom range, tile type, and metadata.
- `upload`: uploads immutable PMTiles artifacts to R2.
- `manifest`: generates the mutable environment manifest.
- `publish`: uploads the manifest to R2.

Large PMTiles uploads use S3 multipart upload through
`scripts/upload-atlas-object.mjs`; the first full-US upload used `36` parts.

After publish, production delivery is verified through the hosted tile edge:

```bash
curl https://tiles.radmaps.studio/manifests/staging.json
curl -I https://tiles.radmaps.studio/tiles/staging/radmaps-us-base/8/44/97.mvt
```

The tile edge only serves artifacts listed in the R2 manifest. It rejects
unknown artifact ids, out-of-range z/x/y, tiles outside artifact bounds, and
raw URL lookups. This keeps the customer tile path stable while allowing the
manifest to move between immutable PMTiles releases. Today the public hostname
uses the Vercel/Nuxt shim; the Cloudflare Worker is deployed and verified on
workers.dev and remains the preferred long-term edge.

Repository tests that protect this workflow:

- `tests/atlas-manifest.test.ts` verifies artifact resolution, including
  overlapping U.S. and North America base artifacts.
- `tests/atlas-merge-manifest-artifact.test.ts` verifies that publishing a new
  large base artifact preserves existing contour coverage and rewrites public
  R2 URLs correctly.
- `tests/atlas-sync-terrain-manifest.test.ts` verifies terrain shard manifest
  generation from the terrain pack registry.

## Map Update And PMTiles Refresh Process

PMTiles archives are immutable snapshots. We do not sync updates into an
existing PMTiles object in place. To receive map updates, build a new PMTiles
archive from newer source data, publish it under a new object path, then move
the manifest pointer after validation.

Recommended base-atlas refresh flow:

1. Choose a source snapshot.
   - Base atlas: Geofabrik regional extract or planet-scale OSM PBF.
   - Terrain atlas: configured DEM source and terrain-region definition.
   - Record source URL, source date, expected coverage, and checksums where
     available.
2. Run a staging dry run:

   ```bash
   npm run atlas:pipeline -- \
     --region us-contiguous \
     --environment staging \
     --stage all \
     --dry-run
   ```

3. Run the real staging build from a cloud runner with `dry_run=false`.
4. Validate the generated PMTiles:
   - header and magic bytes
   - tile type
   - min/max zoom
   - bounds
   - required layer names
   - representative rendered sample tiles
5. Upload the PMTiles to a new immutable R2 object path:

   ```text
   atlas/v1/base/us/<yyyy-mm-dd>/radmaps-base-us.pmtiles
   ```

6. Verify public HTTP range reads:

   ```bash
   curl -I -H 'Range: bytes=0-16383' <pmtiles-url>
   ```

   Expected: `206 Partial Content`, `Content-Range`, and readable PMTiles
   header bytes.
7. Publish the `staging` Atlas manifest so local Atlas Lab points at the new
   archive.
8. Verify the Worker manifest and tile routes against staging artifacts.
9. QA Atlas Lab plus representative print renders across all house styles.
10. Promote approved staging artifacts with server-side R2 copy, then publish
   the production manifest:

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

11. Keep the previous object and manifest metadata for rollback.

Rollback is a manifest change, not a rebuild. If a new archive has bad geometry,
missing layers, or style regressions, republish the previous production manifest
or a corrected manifest that points at the last known-good PMTiles objects.

Recommended cadence:

- Base atlas: monthly while usage is early; tighten to weekly only if map
  freshness becomes product-critical.
- Terrain/contours: runtime-generated in editor and AWS renderer by default.
  Precompute/cache only specific regions that are slow, failure-prone, or
  proven by search/render/order demand. Do not schedule global high-detail
  contour PMTiles as a routine build.
- Emergency corrections: rebuild only the affected regional pack where possible,
  then publish a new manifest version.

Future option: incremental OSM diff processing. Do not assume we have it today.
Planetiler can be part of a fast full-rebuild strategy, but minute/hourly
updates usually require additional diff ingestion, a database-backed tile stack,
or a custom regional patch workflow.

## First Production Run

Start with staging and a dry run:

```bash
npm run atlas:pipeline -- \
  --region us-contiguous \
  --environment staging \
  --stage all \
  --dry-run
```

Then run the real staging base build from a cloud runner with `dry_run=false`.

Only promote production after:

- PMTiles validation passes.
- R2 public range reads return `206 Partial Content`.
- Atlas Lab can load the staging manifest.
- Acceptance screenshots render all house styles.

For large AWS-built base atlases, do not replace the whole staging manifest with
the runner's single-region manifest. Download the runner manifest, copy the
PMTiles object into the matching immutable R2 path, then merge the base artifact
into the existing staging manifest with `npm run atlas:merge-manifest-artifact`.
That keeps already-verified terrain shard entries available while adding the
new base coverage.

Known handoff notes from the first North America build:

- Direct laptop S3-to-R2 streaming was abandoned because the local machine had
  too little free disk and the transfer was too slow. Use an AWS in-region
  transfer runner or future automation for large artifacts.
- Prefix-scoped temporary R2 credentials worked for object upload but returned
  an internal error when replacing the staging manifest. Exact-object temporary
  credentials for `atlas/v1/manifests/staging.json` succeeded. Prefer
  least-privilege permanent CI credentials or exact-object temp credentials for
  manifest publication.
- Keep the AWS build bucket as the durable handoff until the R2 object and
  public range reads have been verified.

## Remaining Plan

The owned atlas is useful but not production-complete. The remaining work is:

1. **Production tile service verification**
   - Deploy or verify `workers/atlas-tiles` against the staging manifest.
   - Confirm `tiles.radmaps.studio` or the interim Worker URL serves manifests
     and known tiles by artifact id.
   - Keep the Nuxt tile proxy as local/admin fallback only.
2. **Atlas Lab and editor QA**
   - Validate North America base coverage in Atlas Lab across U.S., Canada,
     Mexico, Alaska, and coastal edge cases.
   - Run house-style visual checks for Toner, Field Topo, Watercolor,
     Night Relief, and Simple Contour.
   - Confirm AWS renderer proof/final renders match the editor at `8x12`,
     `24x36`, and `32x48`.
3. **Production editor integration**
   - Move Atlas styles from Atlas Lab into the shared style builder path.
   - Add the Atlas-only Map Layers section to `StylePanel.vue`.
   - Gate customer access behind a feature flag until print QA and attribution
     behavior are verified.
4. **Automation**
   - Convert the AWS build, S3 handoff, R2 transfer, manifest merge, and
     manifest publish steps into a repeatable workflow with budget checks.
   - Record checksums, build logs, source dates, object bytes, and manifest
     versions every time.
5. **Coverage expansion**
   - Keep building base coverage first: North America staging is complete;
     globe base is next when cost is acceptable.
   - Keep high-detail contours runtime-generated through `maplibre-contour` for
     editor and AWS renderer output. Add cached contour PMTiles only where usage
     or reliability proves the need.
   - Add richer overlays for public lands, Overture Places `poi`, OSM
     `outdoorRoutes`, boundaries, parks, and destination-specific upgrades.

## Contours

The current full-U.S. base pipeline deliberately does not build one monolithic
U.S. contour archive. Full terrain should be built as regional terrain packs so
we can control compute, detail, storage, and update cadence.

The contour builder is now used for:

- DEM fetch/cache
- contour vector generation
- PMTiles validation
- R2 upload
- showcase style wiring in Atlas Lab

Current deployed showcase packs:

| Region | Workflow input | Output |
|---|---|---|
| Yosemite | `terrain_region=yosemite` | `atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles` |
| Rocky Mountain | `terrain_region=rocky-mountain` | `atlas/v1/terrain/rocky-mountain/2026-05-17/radmaps-rocky-mountain-contours.pmtiles` |
| Smokies | `terrain_region=smokies` | `atlas/v1/terrain/smokies/2026-05-17/radmaps-smokies-contours.pmtiles` |
| North Shore | `terrain_region=superior` | `atlas/v1/terrain/superior/2026-05-17/radmaps-superior-contours.pmtiles` |

The all-showcase dispatch is:

```bash
gh workflow run atlas-terrain-pack.yml \
  --repo anthonynmaro/radmaps \
  --ref main \
  -f terrain_region=all-showcase \
  -f environment=staging \
  -f dry_run=false
```

Next terrain deployment step: expand regional contour pack configs around the
premade catalog and the highest-intent sales geographies before attempting any
monolithic U.S. terrain archive.
