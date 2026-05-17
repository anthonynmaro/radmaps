# RadMaps Atlas Build Pipeline

This is the deployable build path for owned RadMaps PMTiles. It is designed to
run on cloud compute with large scratch storage, not on the local development
machine.

## Deployed Runner

The GitHub Actions workflow lives at:

`.github/workflows/atlas-build.yml`

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

The existing Driftless contour builder remains the proving path for:

- DEM fetch/cache
- contour vector generation
- PMTiles validation
- R2 upload
- manifest attachment

Next terrain deployment step: add regional contour pack configs and run them
against priority sales regions.
