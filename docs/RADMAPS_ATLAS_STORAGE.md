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
Current base archive:
`atlas/v1/base/driftless/2026-05-15/radmaps-driftless-planetiler.pmtiles`

Current contour archive:
`atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles`

Current production manifest:
`atlas/v1/manifests/production.json`

The manifest is the preferred app entry point. Direct PMTiles URLs are retained
as local development and emergency fallbacks:

```bash
NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/manifests/production.json
NUXT_PUBLIC_RADMAPS_ATLAS_PMTILES_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/base/driftless/2026-05-15/radmaps-driftless-planetiler.pmtiles
NUXT_PUBLIC_RADMAPS_CONTOUR_PMTILES_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev/atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles
ATLAS_PUBLIC_BASE_URL=https://pub-9d309719b5ba4334974a164f41db2a76.r2.dev
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

Manifest verification:

```bash
curl "$NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL"
```

Expected result:
- valid JSON
- `schemaVersion` is `radmaps-atlas-v1`
- `artifacts.base.url` and `artifacts.contours.url` point at immutable PMTiles
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
- `tiles.radmaps.studio` is the desired production tile hostname.
- It cannot be attached until `radmaps.studio` is present as a Cloudflare zone
  in this account.
- Use the R2-managed production domain until DNS is moved or delegated.

## Budget Posture

Monthly budget: `$30`.

Current choice: Cloudflare R2.

Why R2 is preferred for production PMTiles:
- PMTiles relies on many HTTP range reads.
- R2 has free egress for standard storage.
- R2 is S3-compatible, so the build/upload path remains portable.

Why not Vercel Blob for primary tile archives:
- It is convenient, but blob data transfer is billable.
- Large PMTiles and repeated map preview/render traffic can make tile delivery
  scale with usage faster than storage cost.

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

The R2 upload path:
- writes immutable PMTiles objects into `radmaps-atlas-prod` or
  `radmaps-atlas-staging`
- uploads with long-lived cache headers
- verifies public range requests before printing the URL
- updates `public/atlas/manifests/*.json` and the matching R2 manifest object
  after all referenced artifacts pass verification

Create least-privilege R2 S3 credentials for local/build-worker uploads:

```bash
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

Do not commit upload tokens or R2 access keys.

## Publishing Rules

- Treat PMTiles archives as immutable. Publish a new object path for every
  rebuild.
- Treat atlas manifests as mutable pointers to immutable artifacts. Update a
  manifest only after all referenced PMTiles exist and have passed range-read
  verification.
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
- Attach `tiles.radmaps.studio` after moving/delegating DNS to Cloudflare.
- Add a permanent least-privilege R2 upload credential for build automation.
- Run `.github/workflows/atlas-build.yml` on a larger GitHub runner or
  short-lived self-hosted cloud VM with enough scratch disk for Planetiler.
