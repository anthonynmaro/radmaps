# RadMaps Atlas Tiles Worker

Production tile edge for owned RadMaps PMTiles.

Routes:

- `GET /manifests/staging.json`
- `GET /manifests/production.json`
- `GET /tiles/:environment/:artifactId/:z/:x/:y.mvt`

The Worker serves by approved manifest artifact id, never by caller-supplied URL. Manifests live in R2 at `atlas/v1/manifests/{environment}.json`; artifacts must include an `objectPath`, zoom range, bounds, and layer metadata. Tile requests validate environment, artifact id, `z/x/y`, artifact zoom range, and artifact bounds before reading byte ranges from R2.

Local/dev:

```bash
npx wrangler dev --config workers/atlas-tiles/wrangler.jsonc
```

Deploy:

```bash
npx wrangler deploy --config workers/atlas-tiles/wrangler.jsonc
```

Required R2 buckets:

- `radmaps-atlas-staging`
- `radmaps-atlas-prod`
