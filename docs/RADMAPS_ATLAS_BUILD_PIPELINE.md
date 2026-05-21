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

- `region`: `driftless-lab`, `us-midwest`, or `us-contiguous`
- `environment`: `staging` or `production`
- `stage`: `all` or a comma-separated subset such as `preflight,download,base`
- `atlas_version`: optional explicit manifest version
- `runner_label`: `ubuntu-latest` for dry runs, or a larger/self-hosted atlas
  runner for real production builds
- `dry_run`: defaults to `true`

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

The full U.S. source is the Geofabrik United States OSM PBF:

`https://download.geofabrik.de/north-america/us-latest.osm.pbf`

Geofabrik lists that extract as about 11GB, so the build runner needs enough
scratch for the source, Planetiler working files, PMTiles output, validation,
and upload retries.

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
7. Publish the staging manifest so Atlas Lab points at the new archive.
8. QA Atlas Lab plus representative print renders across all house styles.
9. Promote by publishing the production manifest to the same immutable artifact
   only after QA passes.
10. Keep the previous object and manifest metadata for rollback.

Rollback is a manifest change, not a rebuild. If a new archive has bad geometry,
missing layers, or style regressions, republish the previous production manifest
or a corrected manifest that points at the last known-good PMTiles objects.

Recommended cadence:

- Base atlas: monthly while usage is early; tighten to weekly only if map
  freshness becomes product-critical.
- Terrain/contours: region-driven, prioritized by sales geography and premade
  catalog coverage.
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
