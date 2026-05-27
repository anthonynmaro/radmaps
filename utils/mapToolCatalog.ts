export type MapToolStatus = 'active' | 'beta' | 'candidate' | 'planned'
export type MapToolCostModel = 'free-public' | 'usage-based' | 'paid-plan' | 'enterprise' | 'self-hosted'

export interface MapToolCatalogItem {
  id: string
  name: string
  provider: string
  status: MapToolStatus
  costModel: MapToolCostModel
  appNames: string[]
  usedByPresets: string[]
  runtimeSurfaces: string[]
  sources: string[]
  capabilities: string[]
  layerAttributes: string[]
  attribution: string
  spendRisk: string
  trackingKeys: string[]
  notes: string
}

export interface MapBuildTrack {
  id: string
  title: string
  posture: string
  goal: string
  automation: string[]
  unlocks: string[]
  risks: string[]
}

export const MAP_TOOL_CATALOG: MapToolCatalogItem[] = [
  {
    id: 'carto-basemaps',
    name: 'CARTO Basemaps',
    provider: 'CARTO + OpenStreetMap',
    status: 'active',
    costModel: 'enterprise',
    appNames: ['carto-light', 'carto-dark', 'Minimalist', 'Native Watercolor fallback'],
    usedByPresets: ['minimalist', 'native-watercolor', 'native-toner fallback'],
    runtimeSurfaces: ['Editor MapPreview', 'Browserless proof/final renders', 'Theme previews'],
    sources: ['Raster XYZ tiles from basemaps.cartocdn.com'],
    capabilities: ['Retina raster base tiles', 'Light/dark baked labels', 'Baked roads', 'Baked water and landuse'],
    layerAttributes: ['tile_effect', 'tile_contrast', 'tile_saturation', 'tile_hue_rotate', 'tile_grain'],
    attribution: 'Requires CARTO and OpenStreetMap attribution; commercial use needs CARTO Enterprise terms.',
    spendRisk: 'Default usage means spend/licensing exposure can grow with every proof, checkout, and final render.',
    trackingKeys: ['provider_id', 'preset', 'base_tile_style', 'render_class', 'tile_effect', 'proof_render_count', 'final_render_count'],
    notes: 'Good default visual baseline, but the commercial-license dependency makes it a candidate to replace with RadMaps-owned vector/raster outputs.',
  },
  {
    id: 'mapbox',
    name: 'Mapbox Maps, Streets, Terrain, Fonts',
    provider: 'Mapbox + OpenStreetMap + terrain suppliers',
    status: 'active',
    costModel: 'usage-based',
    appNames: ['topographic', 'Mapbox Outdoors', 'Mapbox Streets overlay', 'Mapbox Terrain v2 fallback'],
    usedByPresets: ['topographic', 'route-only', 'road-network', 'contour-art', 'native-toner', 'optional overlays across raster presets'],
    runtimeSurfaces: ['Editor MapPreview', 'Browserless render worker fallback contours', 'Glyph loading'],
    sources: ['Mapbox Outdoors raster style tiles', 'mapbox-streets-v8 vector tiles', 'mapbox-terrain-v2 vector tiles', 'Mapbox font glyphs'],
    capabilities: ['Editable vector roads', 'Editable vector water', 'Place labels', 'POI labels', 'Terrain contours fallback', 'Glyphs for contour labels'],
    layerAttributes: ['show_roads', 'roads_color', 'roads_opacity', 'water_color', 'show_place_labels', 'place_labels_color', 'place_labels_scale', 'show_poi_labels', 'contour_*'],
    attribution: 'Requires Mapbox and OpenStreetMap attribution; satellite tiles may add Maxar or other imagery credits.',
    spendRisk: 'High leverage dependency because it backs both visible styles and fallback terrain/vector overlays.',
    trackingKeys: ['provider_id', 'preset', 'uses_roads', 'uses_labels', 'uses_pois', 'uses_contours', 'uses_hillshade', 'render_class'],
    notes: 'Best current source for editable vector overlays, but also the dependency we most want to shrink with a RadMaps vector atlas.',
  },
  {
    id: 'maptiler',
    name: 'MapTiler Raster Styles',
    provider: 'MapTiler + OpenStreetMap/OpenMapTiles',
    status: 'active',
    costModel: 'paid-plan',
    appNames: ['maptiler-outdoor', 'maptiler-topo', 'maptiler-winter', 'Alidade', 'Alidade Dark'],
    usedByPresets: ['minimalist optional base', 'natural-topo', 'alidade-smooth', 'alidade-smooth-dark'],
    runtimeSurfaces: ['Editor MapPreview', 'Browserless proof/final renders'],
    sources: ['MapTiler raster style tiles via api.maptiler.com'],
    capabilities: ['Outdoor/topographic raster art', 'Winter styling', 'Baked water', 'Baked roads', 'Baked labels/POIs depending on style'],
    layerAttributes: ['base_tile_style', 'tile_effect', 'tile_contrast', 'tile_saturation', 'tile_hue_rotate', 'tile_grain'],
    attribution: 'Requires MapTiler and OpenStreetMap attribution unless custom written terms and non-OSM data remove parts of it.',
    spendRisk: 'Moderate to high if natural/topo themes become popular; commercial poster resale may need custom terms.',
    trackingKeys: ['provider_id', 'preset', 'base_tile_style', 'render_class', 'tile_effect'],
    notes: 'Strong visual quality and MapLibre fit, but baked raster limits theme-level control.',
  },
  {
    id: 'stadia-stamen',
    name: 'Stadia Maps Stamen Styles',
    provider: 'Stadia Maps + Stamen Design + OpenStreetMap/OpenMapTiles',
    status: 'active',
    costModel: 'paid-plan',
    appNames: ['stadia-watercolor', 'stadia-toner', 'Watercolor', 'Toner'],
    usedByPresets: ['stadia-watercolor', 'stadia-toner'],
    runtimeSurfaces: ['Editor MapPreview', 'Browserless proof/final renders'],
    sources: ['Stadia raster tile API for Stamen Watercolor/Toner'],
    capabilities: ['Illustrative watercolor raster', 'High-contrast toner raster', 'Toner label/no-label tile family switch'],
    layerAttributes: ['show_place_labels for toner tile family', 'tile_effect', 'tile_contrast', 'tile_saturation', 'tile_hue_rotate', 'tile_grain'],
    attribution: 'Requires Stadia, Stamen, and source-data attribution; commercial use requires Stadia licensing.',
    spendRisk: 'Useful as a premium style, but every proof/final render calls a paid third-party raster source.',
    trackingKeys: ['provider_id', 'preset', 'show_place_labels', 'render_class', 'tile_effect'],
    notes: 'A good style reference for RadMaps-owned watercolor/toner generation, not the ideal long-term core dependency.',
  },
  {
    id: 'aws-mapzen-dem',
    name: 'AWS Terrain Tiles / Mapzen DEM',
    provider: 'Mapzen terrain tiles + OpenStreetMap contributors',
    status: 'active',
    costModel: 'free-public',
    appNames: ['mapbox-dem source name', 'Browser contour DEM', 'Hillshade DEM'],
    usedByPresets: ['All presets with hillshade, 3D, or browser-generated contours'],
    runtimeSurfaces: ['Editor MapPreview', 'Browser contour protocol'],
    sources: ['Terrarium raster-dem tiles from elevation-tiles-prod'],
    capabilities: ['Hillshade', 'Browser-generated vector contours through maplibre-contour', 'Terrain exaggeration'],
    layerAttributes: ['show_hillshade', 'hillshade_intensity', 'show_contours', 'contour_detail', 'map_3d', 'terrain_exaggeration'],
    attribution: 'Requires Mapzen/OpenStreetMap attribution where the DEM-derived layer is visible.',
    spendRisk: 'Low direct cost, but external availability and attribution still need accounting.',
    trackingKeys: ['uses_hillshade', 'uses_contours', 'uses_3d', 'contour_detail', 'render_class'],
    notes: 'Prime candidate to replace with our own DEM pipeline and prebuilt contour/hillshade tiles.',
  },
  {
    id: 'radmaps-open-vector-atlas',
    name: 'RadMaps Open Vector Atlas',
    provider: 'RadMaps generated from OSM/OpenStreetMap-compatible open data',
    status: 'beta',
    costModel: 'self-hosted',
    appNames: ['radmaps-vector', 'radmaps-roads', 'radmaps-water', 'radmaps-labels', 'RadMaps Toner', 'RadMaps Field Topo', 'RadMaps Contour Wash', 'RadMaps Watercolor', 'RadMaps Night Relief', 'RadMaps Simple Contour'],
    usedByPresets: ['Atlas Lab house styles', 'Future default for route-only', 'road-network', 'contour-art', 'native-toner', 'new house styles'],
    runtimeSurfaces: ['Hosted tiles.radmaps.studio edge', 'Admin Atlas Lab live PMTiles previews through /api/atlas/tiles', 'Editor MapPreview', 'Browserless proof/final renders', 'Analytics attribution ledger'],
    sources: ['Cloudflare R2 PMTiles generated by Planetiler, Protomaps, or Tilemaker', 'Hosted /tiles/{environment}/{artifactId}/{z}/{x}/{y}.mvt contract backed by PMTiles range reads', 'Same-origin MVT tile endpoint fallback backed by the same R2 manifests'],
    capabilities: ['Separate water polygons', 'Waterways', 'Road/transportation polygons with line fallback styling', 'Trails/paths', 'Buildings', 'Landuse', 'Parks/forests', 'Place labels', 'POI classes', 'Noto Sans glyphs for Atlas Lab labels'],
    layerAttributes: ['Full vector paint/layout control for roads, water, labels, POIs, landcover, buildings, trail overlays', 'transportation geometry type must be documented per atlas version before style promotion'],
    attribution: 'OSM attribution remains unless source data is non-OSM or attribution-free.',
    spendRisk: 'Converts variable tile API spend into storage/CDN/build costs.',
    trackingKeys: ['atlas_version', 'tile_schema_version', 'bbox_hash', 'preset', 'enabled_layers', 'render_class', 'atlas_manifest_id', 'atlas_style_id'],
    notes: 'Staging now has validated contiguous-US, North America, New Zealand, Northern Spain/Camino, Mount Fuji/Japan, and Patagonia Andes Planetiler PMTiles base atlases in R2. tiles.radmaps.studio is live through the Cloudflare Worker custom domain, with the Vercel shim retained as fallback during DNS cache transition. The next coverage queue is tracked in atlas/coverage-targets.json: promote North America after QA, review the live global proof packs, and keep larger Europe/global work behind source-size and demand gates. The wider Honshu/Japan attempt needs a larger runner or smaller regional splits after exit 137 on ubuntu-latest. Production still points at Driftless until Atlas Lab, editor, Browserless, attribution, analytics, and rollback QA pass. This is the strategic replacement for most commercial vector/raster basemap dependency.',
  },
  {
    id: 'radmaps-watercolor-tile-compositor',
    name: 'RadMaps Watercolor Geometry Painter',
    provider: 'RadMaps generated from RadMaps Open Vector Atlas',
    status: 'beta',
    costModel: 'self-hosted',
    appNames: ['watercolortile://', '/api/watercolor/tiles/base', 'RadMaps Watercolor'],
    usedByPresets: ['radmaps-watercolor'],
    runtimeSurfaces: ['Server PNG watercolor tile endpoint', 'Editor MapPreview', 'Browserless proof/final renders'],
    sources: ['Same-origin RadMaps Atlas base MVT tiles', 'First-party deterministic generated/scanned paper/pigment/drybrush/edge/splash texture pack'],
    capabilities: ['Geometry-first feature painting', 'World-aligned texture sampling', 'Brush-painted road/trail/waterway strokes', 'Sketched building and boundary outlines', 'Water/park pigment washes and sparse splashes', 'Crisp vector labels and route above watercolor raster base'],
    layerAttributes: ['watercolor_seed', 'atlas_layers', 'atlas_layer_settings', 'water_color', 'land_color', 'roads_color', 'show_roads', 'show_place_labels', 'show_poi_labels'],
    attribution: 'Inherits RadMaps Atlas/OpenStreetMap attribution; no Stamen/Stadia raster assets are shipped by this compositor.',
    spendRisk: 'Moves watercolor rendering cost into first-party server CPU, tile cache, and Browserless tile waits; no per-tile third-party watercolor API spend.',
    trackingKeys: ['atlas_version', 'watercolor_renderer_version', 'watercolor_texture_pack_version', 'watercolor_recipe_id', 'watercolor_seed_present', 'render_class', 'tile_count', 'tile_render_ms_p95'],
    notes: 'V3 renders one canonical Atlas watercolor recipe through server-generated PNG tiles wrapped by watercolortile:// for bounded encoded-tile caches and readiness diagnostics. Legacy radmaps-watercolor-* preset ids remain hidden aliases for saved maps. Labels, POIs, route collision, and GPX route linework remain vector MapLibre layers above the raster watercolor base.',
  },
  {
    id: 'radmaps-terrain-atlas',
    name: 'RadMaps Terrain Atlas',
    provider: 'RadMaps generated from DEM, hydro, landcover, and open vector sources',
    status: 'beta',
    costModel: 'self-hosted',
    appNames: ['radmaps-terrain', 'radmaps-contours', 'radmaps-hillshade', 'radmaps-landcover', 'RadMaps Simple Contour'],
    usedByPresets: ['Atlas Lab house styles', 'Future contour-art', 'natural-topo successor', 'field-journal', 'topographic successor'],
    runtimeSurfaces: ['Admin Atlas Lab live PMTiles previews', 'Editor MapPreview', 'Browserless renders', 'Tile build workers'],
    sources: ['Browser-generated maplibre-contour output from Terrarium DEM for editor and Browserless renders', 'Generated contour vector PMTiles for Driftless, Yosemite, Rocky Mountain, Smokies, North Shore, and us-terrain-phase1 QA/cache experiments', 'Configured Midwest and US phase-one terrain packs in atlas/terrain-regions.json', 'Future COG DEM mosaics', 'Future hillshade raster tiles', 'Hydrography and landcover layers'],
    capabilities: ['Runtime high-detail contour generation', 'Regional contour cache packs at z8-14 where reliability or demand justifies them', 'Lowland 10-20 ft minor contour targets', 'Mountain/canyon 40 ft minor contour targets', 'Contour intervals by print scale', 'Hillshade intensity/color art direction', 'Slope/aspect textures', 'Tree/landcover masks', 'Water/shoreline enhancement'],
    layerAttributes: ['contour_*', 'elevation_ft', 'elevation_m', 'interval_class', 'terrain_zone', 'source_dem', 'hillshade_*', 'terrain_exaggeration', 'land_color', 'water_color', 'tile_effect'],
    attribution: 'Depends on selected DEM/landcover sources; prefer public-domain or permissive datasets.',
    spendRisk: 'Mostly compute/storage; enables vendor-independent terrain-heavy products.',
    trackingKeys: ['terrain_atlas_version', 'dem_source', 'contour_interval', 'hillshade_style', 'render_class', 'atlas_manifest_id', 'atlas_style_id'],
    notes: 'Runtime contours are the default scale strategy. Staging also has 177 us-terrain-phase1 contour shard artifacts for QA/cache experiments, while older Driftless/Yosemite/Rocky Mountain/Smokies/North Shore packs are retained as fallback/history. Do not build global high-detail contour PMTiles unless Browserless reliability or paid demand proves the cache is worth it.',
  },
  {
    id: 'naip-aerial',
    name: 'NAIP Aerial Imagery',
    provider: 'USDA/USGS public-domain NAIP',
    status: 'candidate',
    costModel: 'self-hosted',
    appNames: ['naip-aerial-us', 'Aerial Edition USA'],
    usedByPresets: ['Future satellite/aerial preset for US routes'],
    runtimeSurfaces: ['Editor MapPreview', 'Browserless proof/final renders', 'Regional tile builder'],
    sources: ['USGS/USDA NAIP GeoTIFF/JP2/COG imagery for the conterminous US'],
    capabilities: ['0.6m to 1m aerial imagery where available', 'Natural-color raster base', 'Potential infrared/vegetation art variants'],
    layerAttributes: ['imagery_opacity', 'imagery_saturation', 'imagery_contrast', 'imagery_tint', 'route overlays', 'vector label overlays'],
    attribution: 'Public domain, but crediting USDA/USGS/NAIP is still a good product and data-lineage practice.',
    spendRisk: 'No per-tile licensing cost, but preprocessing, storage, CDN bandwidth, and coverage freshness are real costs.',
    trackingKeys: ['imagery_provider', 'imagery_year', 'state', 'coverage_status', 'render_class'],
    notes: 'A rare chance to offer high-quality aerial posters without Google/Bing/Esri retail-goods restrictions.',
  },
]

export const MAP_BUILD_TRACKS: MapBuildTrack[] = [
  {
    id: 'open-vector-atlas',
    title: 'Self-hosted OSM vector atlas',
    posture: 'Start with regional PMTiles, then scale to country/planet builds.',
    goal: 'Replace Mapbox Streets and baked raster dependencies for roads, water, labels, parks, POIs, and buildings.',
    automation: [
      'Nightly or weekly import job downloads Geofabrik extracts or planet snapshots.',
      'Planetiler or Protomaps profile emits a RadMaps schema into PMTiles.',
      'Schema contract tests verify required layers before publishing a new atlas_version.',
      'A CDN/object-storage promotion step flips stable aliases only after visual regression checks pass.',
    ],
    unlocks: [
      'Per-layer styling for water, roads, labels, trails, POIs, landuse, and buildings.',
      'Fixed storage/CDN cost instead of per-provider render calls.',
      'Theme-specific layer blending without raster color hacks.',
    ],
    risks: [
      'OSM attribution remains mandatory.',
      'Tile schema drift must be versioned carefully.',
      'Planet-scale builds need serious CPU/RAM planning; start regional.',
    ],
  },
  {
    id: 'terrain-atlas',
    title: 'RadMaps Terrain Atlas',
    posture: 'Build as a print-first cartographic product, not a web-map clone.',
    goal: 'Own contours, hillshade, land texture, hydro emphasis, and terrain art direction.',
    automation: [
      'Tile build worker ingests DEM COGs and outputs hillshade rasters plus vector contour PMTiles.',
      'Preset profiles define contour intervals, smoothing, line hierarchy, label density, and shaded-relief palette.',
      'Route bbox determines which terrain tiles are pulled into proof/final render jobs.',
      'Regression fixtures compare mountain, desert, forest, urban, and coastal routes across print sizes.',
    ],
    unlocks: [
      'Signature topographic looks that competitors cannot copy by changing a Mapbox style.',
      'Print-scale contour generalization rather than web-zoom defaults.',
      'A single terrain source for editor, proof, checkout, and final render.',
    ],
    risks: [
      'DEM source choice determines attribution and coverage.',
      'Preprocessing needs careful cache invalidation and tile completeness checks.',
      'Terrain labels and contours can clutter small posters without scale-aware rules.',
    ],
  },
  {
    id: 'naip-aerial',
    title: 'NAIP Aerial Edition USA',
    posture: 'Treat as a premium US-only imagery mode with vector labels above it.',
    goal: 'Provide high-resolution public-domain aerial posters without depending on Google/Bing/Esri retail terms.',
    automation: [
      'Coverage index maps route bbox to NAIP state/year availability before the option is shown.',
      'COG/JP2 preprocessing normalizes imagery into Web Mercator raster tiles or COG-backed dynamic tiles.',
      'A label-overlay style pulls from the RadMaps vector atlas instead of baked provider labels.',
      'Analytics records imagery year, state, tile count, and render class for cost and popularity analysis.',
    ],
    unlocks: [
      'High-quality aerial style for US trails with no per-image licensing fee.',
      'Season/year-aware poster variants.',
      'False-color or muted editorial aerial treatments for premium themes.',
    ],
    risks: [
      'US-only coverage unless paired with commercial or lower-resolution global imagery.',
      'Large storage footprint and preprocessing complexity.',
      'Source services can be slow, so RadMaps should cache or own production-ready tiles.',
    ],
  },
]
