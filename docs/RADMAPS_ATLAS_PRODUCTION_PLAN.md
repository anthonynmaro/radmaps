# RadMaps Atlas Production Plan

RadMaps Atlas is the owned map pipeline for print-quality poster maps. The
goal is to move from provider-specific map presets to a versioned atlas system
where tiles, layers, styles, editor controls, renderer inputs, attribution, and
usage accounting all share one contract.

## Product Goals

- Let users build a map style by adding/removing individual RadMaps layers.
- Support simple contour-first maps as a first-class product.
- Preserve high-quality print rendering for 24x36 and larger posters.
- Reduce third-party basemap dependencies first; keep browser-generated terrain
  until usage proves that cached/self-hosted contours are worth the compute.
- Track usage by layer, style, atlas artifact, proof render, final render, and
  order so we know what users like and what each map costs.
- Keep the system global-ready without blocking near-term U.S. sales.

## Current Status

As of 2026-05-27, the owned atlas has crossed the first real coverage
milestone, but it is not fully production-integrated.

Completed:

- Contiguous-U.S. base PMTiles exist in staging R2 as `radmaps-us-base`.
- North America base PMTiles exist in staging R2 as
  `radmaps-north-america-base`, covering `[-170, 5, -50, 84]` at z0-14.
- The North America archive is `20,296,668,015` bytes and verified
  range-readable from R2.
- The staging manifest is a composite manifest that preserves the verified
  `us-terrain-phase1` contour shard set while new base artifacts are merged in.
- New Zealand outdoor PMTiles exist in staging R2 as
  `radmaps-new-zealand-outdoor-base`, covering `[166, -47.4, 179, -34]` at
  z0-14.
- The New Zealand archive is `403,714,835` bytes and verified through
  `tiles.radmaps.studio` tile checks.
- The staging manifest is now `2026.05.27-new-zealand-outdoor.1` with `3` base
  artifacts and `177` contour artifacts.
- Atlas styles, watercolor, route-under-label ordering, manifest
  resolution, usage-event hardening, hosted tile-service code, and
  documentation/catalog pages have been added on the Atlas branch.
- `https://tiles.radmaps.studio` now serves the hosted tile contract through
  the Cloudflare Worker custom domain backed by R2 staging and production
  manifests. The Vercel/Nuxt shim remains available as a fallback path.
- The Worker is deployed and verified at
  `https://radmaps-atlas-tiles.radmaps-atlas.workers.dev`.
- The production strategy for contours has pivoted to browser/Browserless
  `maplibre-contour` generation plus terrain illusion layers, avoiding
  expensive global high-detail contour PMTiles for now.
- The customer editor now exposes the owned Atlas presets in the map picker and
  has an Atlas-only **Map Layers** panel for `contour`, `water`, `waterway`,
  `park`, `landcover`, `transportation`, `building`, `place`, and `poi`.
  Local development always shows these controls; production customer access is
  gated by `radmaps_atlas_editor`.
- Atlas layer visibility and v1 style settings now flow into `buildMapStyle()`,
  so local editor tests can turn layers off and tune water, roads/trails,
  labels, landcover, parks, buildings, and contour styling from saved
  `StyleConfig` JSON.

Not done yet:

- Production still uses the older Driftless atlas manifest until staging QA is
  complete and the production manifest is promoted.
- Production promotion of North America needs the large staging PMTiles copied
  into `radmaps-atlas-prod` or an approved production manifest strategy; do not
  publish a production manifest that points at objects missing from the prod
  bucket.
- The Cloudflare Worker is attached to `tiles.radmaps.studio`; some resolvers
  may briefly cache the prior Vercel wildcard address during DNS transition.
- The customer editor has first-pass Atlas style presets and layer controls,
  but `radmaps_atlas_editor` should remain disabled for broad customer traffic
  until Browserless print QA and attribution checks pass.
- Browserless print QA across large sizes and house styles is still required.
- Public lands, richer recreation POIs, and destination-specific overlay packs
  are not complete.
- Build/transfer/manifest publication is documented and scripted in pieces,
  but should be automated into one budget-guarded workflow.

## Coverage Rollout

### Crawl: United States

Ship U.S. coverage first because it is the most immediately sellable and has
strong elevation/public-land source data.

Initial priority regions:
- Upper Midwest / Driftless / Great Lakes
- Rockies
- Sierra / Northern California
- Pacific Northwest
- Utah / Arizona / Southwest desert
- Appalachians
- New England

The first U.S. release should include:
- nationwide base map
- browser/Browserless-generated high-detail contours using the current
  `maplibre-contour` fidelity path
- optional prewarmed/cached contour artifacts for priority regions only when
  render reliability or volume justifies them
- national/state parks and major public lands
- trailheads, peaks, campsites, viewpoints, parking, and water POIs
- house styles: Simple Contour, Field Topo, Toner, Night Relief, Watercolor

### Walk: North America

Expand to Canada and Mexico with consistent base map coverage and global DEM
terrain first. Enrich with national/provincial datasets where licensing and
quality justify it.

North America release should include:
- base map for U.S., Canada, Mexico, Alaska, Greenland, and surrounding North
  America areas. The first staging artifact already exists as
  `radmaps-north-america-base`.
- browser-generated contour coverage wherever Terrarium/global DEM coverage is available
- terrain illusion layers for visual richness without global contour precompute
- richer U.S. public lands
- selected Canadian parks/public lands
- popular destination upgrades based on search/render/order demand

### Run: Globe

Global coverage should be a product platform, not a single all-or-nothing
artifact. Start with global base + global terrain fallback, then promote popular
regions into higher-detail packs.

Global release should include:
- global basemap artifacts
- browser-rendered contours as the default high-detail terrain path
- destination-specific cached/high-detail packs only for proven demand or reliability gaps
- usage-driven rebuild priorities
- per-country attribution/license registry

First global proof-pack queue:
- New Zealand outdoor is live in staging and ready for broader visual review.
- Patagonia Andes, Northern Spain/Camino, and Honshu/Japan have passed dry-run
  build dispatch and remain the next small real builds.

## Artifact Storage

Production storage should use immutable PMTiles archives on S3-compatible object
storage with HTTP range request support. Cloudflare R2 is the preferred
production target. Supabase Storage can remain staging/dev while usage is low.

Preferred production delivery is through the Cloudflare Worker in
`workers/atlas-tiles`, deployed at
`https://radmaps-atlas-tiles.radmaps-atlas.workers.dev` and attached to
`tiles.radmaps.studio` as a custom domain. The Nuxt routes on Vercel,
`server/routes/manifests/*`, `server/routes/tiles/*`, and shared logic in
`server/utils/atlasPublicTileService.ts`, remain as a fallback shim. The Nuxt
`/api/atlas/tiles` route is retained as a local/admin/editor fallback and
resolves the same R2 manifests.

Hosted tile routes:

```text
GET /manifests/staging.json
GET /manifests/production.json
GET /tiles/:environment/:artifactId/:z/:x/:y.mvt
```

Tile-edge requirements now implemented in code:
- serve by approved manifest artifact id, not raw caller-supplied URLs
- load manifests from R2 at `atlas/v1/manifests/{environment}.json`
- validate environment, artifact id, z/x/y matrix, zoom range, and bounds
- read PMTiles from R2 by byte range through the PMTiles source API
- cache hot tile responses with immutable HTTP cache headers; Cloudflare Cache
  API support remains Worker-specific
- return MVT headers and immutable cache headers
- expose manifests with artifact counts and the tile URL template

Canonical object layout:

```text
tiles.radmaps.studio/
  atlas/
    v1/
      manifests/
        production.json
        staging.json
      base/
        us/2026-05-15/radmaps-base-us.pmtiles
        north-america/2026-07-01/radmaps-base-north-america.pmtiles
        new-zealand-outdoor/2026-05-27/radmaps-base-new-zealand-outdoor.pmtiles
        globe/2026-09-01/radmaps-base-globe.pmtiles
      terrain/
        cache/...
        experiments/...
        # High-detail global contours are not a default production artifact.
        # Browserless/editor contours are generated from DEM at render time.
      overlays/
        public-lands/us/2026-05-15/radmaps-public-lands-us.pmtiles
        poi/us/2026-05-15/radmaps-poi-us.pmtiles
```

Rules:
- Never overwrite artifacts used by proofs, final renders, or published styles.
- Publish a new path for every rebuild.
- Move production by changing the manifest, not by replacing tiles.
- Keep active artifact URLs out of component code. Load them from a manifest.
- Record the exact manifest version on every proof and final render.

## Atlas Manifest

The app should load a single environment-selected manifest. The manifest tells
the editor and renderer which layer packs are active.

Example:

```json
{
  "atlasVersion": "2026.05.15-us.1",
  "coverage": "us",
  "schemaVersion": "radmaps-atlas-v1",
  "createdAt": "2026-05-15T00:00:00Z",
  "artifacts": {
    "base": [
      {
        "id": "radmaps-us-base",
        "kind": "base",
        "url": "https://tiles.radmaps.studio/atlas/v1/base/us/2026-05-15/radmaps-base-us.pmtiles",
        "objectPath": "atlas/v1/base/us/2026-05-15/radmaps-base-us.pmtiles",
        "minzoom": 0,
        "maxzoom": 14,
        "bounds": [-125, 24.4, -66.8, 49.5],
        "layers": ["water", "transportation", "place", "poi"],
        "bytes": 9593839310,
        "sourceLicenses": ["OpenStreetMap ODbL"],
        "createdAt": "2026-05-15T00:00:00Z"
      }
    ],
    "contours": [
      {
        "id": "radmaps-yosemite-contours",
        "kind": "contours",
        "url": "https://tiles.radmaps.studio/atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles",
        "objectPath": "atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles",
        "minzoom": 8,
        "maxzoom": 14,
        "bounds": [-120.4, 37.4, -118.9, 38.2],
        "layers": ["contour"],
        "sourceLicenses": ["USGS 3DEP"],
        "createdAt": "2026-05-17T00:00:00Z"
      }
    ],
    "hillshade": [],
    "publicLands": [],
    "poi": []
  },
  "attribution": [
    {
      "source": "OpenStreetMap contributors",
      "appliesTo": ["base", "transportation", "poi", "place"]
    },
    {
      "source": "USGS 3DEP",
      "appliesTo": ["contours", "hillshade"]
    }
  ]
}
```

Artifact arrays are intentional. A national base can be one artifact while
terrain, public lands, and POI packs are regional shards. The resolver in
`utils/atlasManifest.ts` selects the national base plus only artifacts that
intersect the requested map bbox.

## RadMaps Layer Contract

The editor should expose RadMaps layers, not provider layers. The user can add
or remove these layers from the Style Panel.

Initial layer catalog:

| Layer ID | User Label | Data Type | Main Artifact | Default Slot | Typical Controls |
|---|---|---:|---|---|---|
| `contour` | Contours | line/symbol | terrain | terrain | visibility, interval, minor/index/major color, opacity, weight, labels |
| `water` | Water Bodies | fill | base | water-land-buildings | visibility, color, opacity, shoreline emphasis |
| `waterway` | Rivers & Streams | line/symbol | base | water-land-buildings | visibility, color, opacity, width, labels |
| `park` | Parks | fill/symbol | base/public lands | water-land-buildings | visibility, color, opacity, labels |
| `landcover` | Landcover | fill | base | water-land-buildings | visibility, color, opacity, texture intensity |
| `transportation` | Roads & Trails | line/symbol | base | editable-roads | visibility, road density, trail emphasis, color, labels |
| `building` | Buildings | fill/line | base | water-land-buildings | visibility, fill, outline, opacity, min zoom |
| `poi` | Points of Interest | symbol/circle | poi | labels-pois | visibility, categories, density, icon style, labels |
| `place` | Place Labels | symbol | base | labels-pois | visibility, label density, color, halo, size |

Future layer IDs:
- `hillshade`
- `public_land`
- `boundary`
- `peak`
- `trailhead`
- `route`
- `mile_marker`
- `custom_label`
- `grid`
- `paper_texture`
- `watercolor_wash`

## Layer Data Schema

Each atlas layer should have stable properties that survive source changes.

### `contour`

```ts
type ContourFeature = {
  elevation_m: number
  elevation_ft: number
  label: string
  interval_class: 'minor' | 'index' | 'major'
  interval_m?: number
  interval_ft?: number
  label_rank: number
  source_dem: string
  source_resolution_m: number
  atlas_version: string
}
```

Contour requirements:
- support simple contour-only maps
- separate minor/index/major styling
- optional labels independent from lines
- imperial and metric labels
- high-detail regional builds where print quality matters
- simplified lower zooms and detailed upper zooms

### `water`

```ts
type WaterFeature = {
  class: 'lake' | 'reservoir' | 'riverbank' | 'ocean' | 'pond' | 'wetland'
  name?: string
  area_rank?: number
  label_rank?: number
}
```

### `waterway`

```ts
type WaterwayFeature = {
  class: 'river' | 'stream' | 'canal' | 'drain'
  name?: string
  intermittent?: boolean
  label_rank?: number
}
```

### `park`

```ts
type ParkFeature = {
  class: 'national_park' | 'state_park' | 'local_park' | 'preserve' | 'recreation_area'
  name?: string
  operator?: string
  protection_rank?: number
  label_rank?: number
}
```

### `landcover`

```ts
type LandcoverFeature = {
  class: 'forest' | 'wood' | 'grass' | 'scrub' | 'wetland' | 'bare' | 'glacier'
  density_rank?: number
}
```

### `transportation`

```ts
type TransportationFeature = {
  class:
    | 'motorway'
    | 'trunk'
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'minor'
    | 'service'
    | 'track'
    | 'path'
    | 'cycleway'
    | 'trail'
  name?: string
  surface?: string
  access?: string
  route_ref?: string
  trail_rank?: number
  road_rank?: number
  label_rank?: number
}
```

### `building`

```ts
type BuildingFeature = {
  class?: 'residential' | 'commercial' | 'industrial' | 'public' | 'other'
  height_m?: number
  minzoom?: number
}
```

### `poi`

```ts
type PoiFeature = {
  category:
    | 'trailhead'
    | 'peak'
    | 'viewpoint'
    | 'campground'
    | 'shelter'
    | 'parking'
    | 'water'
    | 'toilet'
    | 'visitor_center'
    | 'food'
    | 'lodging'
    | 'bike'
    | 'ski'
    | 'other'
  name?: string
  importance_rank: number
  icon?: string
  label_rank?: number
}
```

### `place`

```ts
type PlaceFeature = {
  class: 'country' | 'state' | 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood'
  name: string
  name_en?: string
  population?: number
  label_rank: number
}
```

## Style System

Styles should be recipes that consume the layer catalog. A style can support all
layers or only a subset.

```ts
type AtlasLayerId =
  | 'contour'
  | 'water'
  | 'waterway'
  | 'park'
  | 'landcover'
  | 'transportation'
  | 'building'
  | 'poi'
  | 'place'

type AtlasStyleRecipe = {
  id: string
  name: string
  atlasSchemaVersion: 'radmaps-atlas-v1'
  supportedLayers: AtlasLayerId[]
  defaultLayers: AtlasLayerId[]
  requiredLayers: AtlasLayerId[]
  layerDefaults: Record<AtlasLayerId, AtlasLayerStyleDefaults>
  printProfiles: Record<PrintSize, AtlasPrintStyleTuning>
}
```

Example style defaults:

```ts
{
  id: 'radmaps-simple-contour',
  name: 'RadMaps Simple Contour',
  supportedLayers: ['contour', 'water', 'waterway', 'place', 'transportation'],
  defaultLayers: ['contour', 'water', 'waterway', 'place'],
  requiredLayers: ['contour'],
  layerDefaults: {
    contour: {
      visible: true,
      minorOpacity: 0.28,
      indexOpacity: 0.62,
      majorOpacity: 0.86,
      labels: false
    },
    transportation: {
      visible: false,
      density: 'minimal'
    }
  }
}
```

House style roles:

| Style | Primary Purpose | Required Layers | Optional Layers |
|---|---|---|---|
| Simple Contour | minimal elevation poster | contour | water, waterway, place, route |
| Field Topo | general outdoor topo | contour, water, transportation | park, landcover, poi, place |
| Toner | crisp urban/trail linework | transportation, water, place | building, poi, contour |
| Watercolor | artistic poster | water, landcover, park | transportation, place, route, paper texture |
| Night Relief | premium dark terrain | contour, water, transportation | building, poi, place, hillshade |

## Style Panel UX

Add a "Map Layers" section in `StylePanel.vue`.

User flow:
1. User chooses a house style.
2. Style declares available layers and defaults.
3. User opens Map Layers.
4. User toggles individual layers:
   - Contours
   - Water Bodies
   - Rivers & Streams
   - Parks
   - Landcover
   - Roads & Trails
   - Buildings
   - Points of Interest
   - Place Labels
5. Expanding a layer reveals controls relevant to that layer and style.

Layer control examples:

### Contours

- Show contours
- Interval: automatic / 20 ft / 40 ft / 100 ft / metric
- Minor color / opacity / weight
- Index color / opacity / weight
- Major color / opacity / weight
- Show contour labels
- Label units: ft / m

### Transportation

- Show roads and trails
- Density: minimal / balanced / detailed
- Road color
- Trail color
- Major road emphasis
- Trail emphasis
- Show road labels

### POI

- Show POIs
- Density: sparse / balanced / detailed
- Categories:
  - trailheads
  - peaks
  - viewpoints
  - campsites
  - parking
  - water
  - toilets
  - visitor centers
- Show POI labels

### Parks / Public Lands

- Show parks
- Show public lands
- Fill color
- Boundary emphasis
- Label toggle

### Water

- Show water bodies
- Show waterways
- Water color
- Shoreline emphasis
- Water labels

## StyleConfig Additions

Add a typed layer state object instead of scattering new booleans.

```ts
type AtlasLayerVisibility = Record<AtlasLayerId, boolean>

type AtlasLayerSettings = {
  contour?: {
    interval?: 'auto' | '20ft' | '40ft' | '100ft' | '10m' | '20m'
    minor_color?: string
    index_color?: string
    major_color?: string
    minor_opacity?: number
    index_opacity?: number
    major_opacity?: number
    labels?: boolean
    units?: 'ft' | 'm'
  }
  transportation?: {
    density?: 'minimal' | 'balanced' | 'detailed'
    road_color?: string
    trail_color?: string
    labels?: boolean
  }
  poi?: {
    density?: 'sparse' | 'balanced' | 'detailed'
    categories?: string[]
    labels?: boolean
  }
}

type StyleConfig = {
  atlas_manifest_id?: string
  atlas_style_id?: string
  atlas_layers?: AtlasLayerVisibility
  atlas_layer_settings?: AtlasLayerSettings
}
```

Existing booleans like `show_contours`, `show_hillshade`, and
`show_elevation_labels` can be migrated into this shape later, but must remain
backward-compatible during rollout.

## Style Layer Graph Integration

Extend `utils/styleLayerGraph.ts` so graph entries include atlas layers.

Each preset should declare:
- supported atlas layer IDs
- default enabled atlas layer IDs
- required atlas layer IDs
- controls exposed per layer
- render slots consumed
- reload fields
- runtime-update fields
- baked-only controls that should be hidden

Canonical slot order remains:

```text
background
base
water-land-buildings
terrain
contours
editable-roads
route-casing
route
labels-pois
segments-handles
```

Route linework should render below map labels by default so place, road, water,
POI, and contour labels stay readable. Interactive segment handles and editing
overlays remain above labels.

`contour` should have its own canonical slot or a terrain subslot so it can be
styled independently from hillshade.

## MapLibre Builder

`buildMapStyle()` should consume:
- active atlas manifest
- selected atlas style recipe
- user layer visibility
- user layer settings
- route/source data

The builder should:
- add only required PMTiles sources
- include only enabled layer groups
- preserve style-specific defaults
- apply user overrides last
- avoid provider-specific conditionals in components

Layer source pattern:

```ts
sources: {
  'radmaps-base': {
    type: 'vector',
    url: `pmtiles://${manifest.artifacts.base.url}`
  },
  'radmaps-terrain': {
    type: 'vector',
    url: `pmtiles://${manifest.artifacts.contours.url}`
  },
  'radmaps-poi': {
    type: 'vector',
    url: `pmtiles://${manifest.artifacts.poi.url}`
  }
}
```

## Rendering Pipeline

The renderer remains `MapPreview.vue` plus Browserless screenshots. The atlas
system must not create a second poster renderer.

Requirements:
- final render loads the same atlas manifest as the editor
- final render records `atlas_manifest_id`, artifact URLs, and style recipe ID
- final render has no live commercial tile provider dependency for owned styles
- fonts and glyphs should be self-hosted for production
- proof/final hashes should include atlas manifest and layer settings
- render readiness still uses `window.__RENDER_READY`

Print quality:
- verify `24x36` and `32x48`
- test route readability over every layer combination
- test simple contour maps with roads off
- run visual fixtures for mountain/desert/forest/urban/water-heavy regions

## Build Pipeline

Production build stages:

1. Fetch source data.
2. Normalize to RadMaps schema.
3. Build base PMTiles with Planetiler.
4. Build contour PMTiles from DEMs.
5. Build overlay PMTiles for public lands and POIs.
6. Validate PMTiles headers, bounds, metadata, layer names, and sample tiles.
7. Render acceptance screenshots for each house style.
8. Upload immutable artifacts.
9. Register artifacts and manifest in Supabase.
10. Promote staging manifest to production.

The deployable runner implementation is now documented in
`docs/RADMAPS_ATLAS_BUILD_PIPELINE.md` and wired through
`.github/workflows/atlas-build.yml`.

Build validation must check:
- every required layer exists
- layer property schema matches `radmaps-atlas-v1`
- sample z/x/y tiles decode
- PMTiles supports range reads after upload
- metadata includes source and attribution
- file sizes and tile counts are recorded

## Supabase Accounting

Tables to add later:

```sql
atlas_builds
atlas_artifacts
atlas_manifests
atlas_manifest_artifacts
atlas_source_licenses
atlas_usage_events
```

Usage events:
- editor style selected
- layer toggled
- layer setting changed
- proof render requested
- final render completed
- checkout completed
- order placed

Event properties:
- `atlas_manifest_id`
- `atlas_style_id`
- `enabled_layers`
- `print_size`
- `render_class`
- `map_id`
- `order_id`
- `artifact_ids`

This lets us answer:
- Which styles sell?
- Which layers sell?
- Are POIs worth their tile/build/storage cost?
- Are contour-only maps popular?
- Which regions need higher-detail terrain?
- Which artifact versions are still used by live maps?

## Implementation Milestones

### Milestone 1: Manifest And Layer Contract

- Add typed atlas manifest model.
- Add layer catalog constants.
- Add layer visibility/settings to `StyleConfig`.
- Load atlas sources from manifest instead of direct env URLs.
- Keep current lab PMTiles as the dev manifest.

### Milestone 2: Editor Layer Controls

- Status: first local integration pass complete.
- `StylePanel.vue` includes an Atlas-only Map Layers section.
- `buildMapStyle()` consumes `atlas_layers` and `atlas_layer_settings` for
  visibility, color, opacity, width, and label controls.
- Unit coverage confirms disabled Atlas layers are removed from MapLibre style
  JSON and v1 settings update water, roads, and label paint properties.
- Remaining work: make the controls richer and cleaner, add category/density
  controls for POIs/roads, wire layer-specific live `setPaintProperty` updates
  where possible, and gate the public editor with `radmaps_atlas_editor`.

### Milestone 3: Simple Contour Product

- Add `radmaps-simple-contour` style.
- Make `contour` required and most other layers optional/off by default.
- Add contour label support.
- Verify 24x36 print readability.

### Milestone 4: Production Storage

- Move production atlas artifacts to R2.
- Keep Supabase Storage for staging if useful.
- Add upload/promote scripts.
- Add manifest registration.

### Milestone 5: U.S. Regional Production Build

- Build one high-detail priority region with:
  - base
  - contours
  - parks/public lands
  - POIs
- Render acceptance fixtures for all house styles.
- Use this as the first sellable owned-atlas pack.

### Milestone 6: U.S. Complete Build

- Full U.S. base coverage.
- Browser-rendered high-detail contours for editor, proof, and final renders.
- Optional cached terrain overlays only for priority areas that need reliability or speed.
- Usage tracking.
- Style editor controls available to customers behind a feature flag.

### Milestone 7: North America And Globe

- Expand base coverage first. North America staging base coverage is complete;
  the next base milestone is production promotion after QA, followed by small
  regional proof packs for premade and high-intent global destinations.
- Use `atlas/coverage-targets.json` as the coverage queue and cost gate. The
  first runnable non-North-America targets are `patagonia-andes`,
  `northern-spain-camino`, `honshu-japan`, and `new-zealand-outdoor`.
- Use browser-generated contours and terrain illusion layers globally where DEM coverage allows.
- Promote popular or failure-prone regions into cached contour artifacts based on actual usage.
- Do not start a full-globe base archive until the regional proof packs and
  manifest-promotion workflow are boring.

## Near-Term Decision

Build the next slice around `radmaps-simple-contour`.

That forces the system to solve the most important hard problem first:
high-quality contour rendering in editor and Browserless without paying to
precompute global terrain. The implementation benchmark is the existing
`maplibre-contour` detail path, supplemented with hillshade, slope/wash,
hachure, paper grain, and ghost-contour texture where styles need more terrain
presence.

## Next Phase Execution Plan

The next phase should turn the staging atlas into a sellable production path.

1. **Verify infrastructure**
   - Deploy or confirm the Cloudflare Worker tile service.
   - Test `/manifests/staging.json` and representative
     `/tiles/staging/{artifactId}/{z}/{x}/{y}.mvt` requests for both the U.S.
     and North America base artifacts.
   - Keep `/api/atlas/tiles` for local/admin fallback and reject raw external
     tile URLs in customer paths.
2. **QA the staging manifest**
   - Build an Atlas Lab coverage matrix for Yosemite, Rockies, Smokies,
     Driftless, Chicago, Seattle/Cascades, Moab, Acadia, Vancouver/Whistler,
     Banff, Baja, Mexico City, Alaska, and Greenland edge coverage.
   - For each house style, confirm base layers, labels, route order, water,
     roads/trails, parks, POIs, and runtime contours render together.
3. **Print proofing**
   - Render Browserless proofs/finals for `8x12`, `24x36`, and `32x48`.
   - Measure render time with contours disabled, contour detail levels `0-5`,
     and terrain illusion layers enabled.
   - Fail render readiness if DEM/contour tiles are still pending.
4. **Editor integration**
   - Move Atlas Lab style recipes into shared `utils/atlasStyles.ts` and
     `utils/atlasStyleBuilder.ts`.
   - Add first-class Atlas presets to `StylePreset`.
   - Add an Atlas-only "Map Layers" section to `StylePanel.vue` for contour,
     water, waterway, park, landcover, transportation, building, POI, and
     place.
   - Gate customer access with `radmaps_atlas_editor`.
5. **Promotion**
   - Publish a production manifest only after Worker, Atlas Lab, editor,
     Browserless, attribution, and analytics checks pass.
   - Record the manifest version and artifact ids on proofs/finals/orders.
   - Keep the previous production manifest and PMTiles objects for rollback.
6. **Scale**
   - Automate AWS build -> S3 handoff -> R2 transfer -> manifest merge ->
     manifest publish with cost logging.
   - Add public lands and recreation POI overlay artifacts.
   - Build a global base archive when the North America QA/promotion path is
     proven. Keep global high-detail contour PMTiles deferred unless render
     reliability or paid demand requires a cache.

## Local Integration Testing

Use local development against the Atlas `staging` manifest until production
promotion passes. The goal is to prove the real app/render path, not only the
Atlas Lab cards.

1. Start Nuxt locally:

   ```bash
   npm run dev -- --host 127.0.0.1 --port 3002
   ```

2. Open `/admin/atlas-lab` and check the coverage matrix. U.S. showcase
   regions should show cached terrain shard availability where present; Banff,
   Vancouver, Baja, Mexico City, and Anchorage should show base coverage plus
   browser-generated contours.
3. Exercise the real `MapPreview` path with the dev fixture:

   ```text
   /style-browser-fixture?preset=radmaps-field-topo&region=chicago
   /style-browser-fixture?preset=radmaps-field-topo&region=banff
   /style-browser-fixture?preset=radmaps-night-relief&region=mexico
   /style-browser-fixture?surface=1&preset=radmaps-field-topo&region=banff&width=1180&height=820
   ```

4. Verify the local tile API can serve approved composite coverage without a
   raw URL:

   ```bash
   curl -s -o /tmp/radmaps-chicago.mvt \
     -w 'chicago status=%{http_code} bytes=%{size_download}\n' \
     'http://127.0.0.1:3002/api/atlas/tiles/base/8/65/95.mvt?environment=staging'

   curl -s -o /tmp/radmaps-banff.mvt \
     -w 'banff status=%{http_code} bytes=%{size_download}\n' \
     'http://127.0.0.1:3002/api/atlas/tiles/base/8/45/85.mvt?environment=staging'

   curl -s -o /tmp/radmaps-mexico-city.mvt \
     -w 'mexico status=%{http_code} bytes=%{size_download}\n' \
     'http://127.0.0.1:3002/api/atlas/tiles/base/8/57/113.mvt?environment=staging'
   ```

The local tile endpoint now selects the first manifest artifact that supports
the requested tile. That keeps U.S. routes on the smaller U.S. base artifact
while automatically serving Canada, Mexico, Alaska, and other North America
coverage from `radmaps-north-america-base`.
