import type { StyleConfig } from '~/types'

/**
 * Build a MapLibre GL Style JSON object from a StyleConfig.
 * This same function is used in:
 *   1. The browser MapPreview component (reactive preview)
 *   2. The server render worker (Puppeteer headless render)
 * Keeping a single source of truth ensures WYSIWYG fidelity.
 *
 * Mapbox sources used (all require MAPBOX_TOKEN):
 *   • Outdoors v12 raster tiles  — base terrain map
 *   • Terrain DEM v1             — raster-dem for hillshade layer
 *   • Terrain v2 vector tiles    — contour lines with elevation values
 *
 * IMPORTANT: MapLibre GL JS does NOT resolve mapbox:// URL schemes.
 * All tile URLs must be explicit https:// endpoints.
 */
export function buildMapStyle(
  config: StyleConfig,
  mapboxToken?: string,
): object {
  if (config.preset === 'topographic') {
    return buildTopographicStyle(config, mapboxToken)
  }
  return buildMinimalistStyle(config, mapboxToken)
}

// ─── Conditional Mapbox sources ─────────────────────────────────────────────
// Only include each source when its feature is actually enabled.
// MapLibre fetches TileJSON metadata for every defined source, so unused
// sources still generate network requests (and 401s with a scoped token).

function mapboxDemSource(token: string) {
  return {
    'mapbox-dem': {
      type: 'raster-dem' as const,
      tiles: [
        `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.webp?access_token=${token}`,
      ],
      tileSize: 512,
      maxzoom: 14,
      encoding: 'mapbox' as const,
      attribution: '© Mapbox',
    },
  }
}

function mapboxTerrainV2Source(token: string) {
  return {
    'mapbox-terrain-v2': {
      type: 'vector' as const,
      tiles: [
        `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${token}`,
      ],
      // Contour features only exist in Mapbox tiles from zoom 9 onward.
      // Setting minzoom: 9 tells MapLibre to underzoom those tiles for lower map views
      // so contours remain visible regardless of how far the user zooms out.
      minzoom: 9,
      maxzoom: 15,
      attribution: '© Mapbox',
    },
  }
}

// ─── Hillshade layers ─────────────────────────────────────────────────────────

function hillshadeLayers(config: StyleConfig) {
  if (!config.show_hillshade) return []
  return [
    {
      id: 'hillshade',
      type: 'hillshade' as const,
      source: 'mapbox-dem',
      paint: {
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#FFFFFF',
        'hillshade-accent-color': '#000000',
        'hillshade-illumination-direction': 335, // NNW light source — classic cartographic convention
        'hillshade-exaggeration': config.hillshade_intensity,
      },
    },
  ]
}

// ─── Contour line layers ──────────────────────────────────────────────────────

function contourLayers(config: StyleConfig) {
  if (!config.show_contours) return []

  const layers: object[] = [
    // Minor contours (index = 1): thin — full opacity at all zoom levels
    {
      id: 'contours-minor',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': config.contour_opacity * 0.7,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 14, 0.9],
      },
    },
    // Intermediate contours (index = 5)
    {
      id: 'contours-mid',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 5],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': config.contour_opacity * 0.85,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 14, 1.2],
      },
    },
    // Major contours (index = 10): bold
    {
      id: 'contours-major',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 10],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_major_color,
        'line-opacity': config.contour_opacity,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 2.0],
      },
    },
  ]

  // Elevation labels on major contours
  if (config.show_elevation_labels) {
    layers.push({
      id: 'contours-labels',
      type: 'symbol',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 10],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        // Mapbox-hosted fonts — resolved via the glyphs URL in the style spec
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 14, 11],
        'text-letter-spacing': 0.05,
        'text-padding': 2,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.5,
        'text-opacity': config.contour_opacity,
      },
    })
  }

  return layers
}

// ─── Route layers (shared) ───────────────────────────────────────────────────

function routeLayers(config: StyleConfig) {
  return [
    {
      id: 'route-line-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': config.route_width + 4,
        'line-opacity': config.route_opacity,
      },
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.route_color,
        'line-width': config.route_width,
        'line-opacity': config.route_opacity,
      },
    },
  ]
}

// ─── Minimalist Style ────────────────────────────────────────────────────────

function buildMinimalistStyle(config: StyleConfig, mapboxToken?: string): object {
  const token = mapboxToken || ''
  const dark = (config.base_tile_style ?? 'carto-light') === 'carto-dark'
  const tileSubdomain = (s: string) =>
    ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}.png`)

  const tiles = dark ? tileSubdomain('dark_all') : tileSubdomain('light_all')
  const tileOpacity = dark ? 0.45 : 0.55

  return {
    version: 8,
    name: 'TrailMaps Minimalist',
    // Use Mapbox fonts when a token is present; fall back to free MapLibre demo glyphs
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'carto-base': {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap contributors',
      },
      ...(config.show_hillshade ? mapboxDemSource(token) : {}),
      ...(config.show_contours ? mapboxTerrainV2Source(token) : {}),
      route: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': config.background_color },
      },
      {
        id: 'base-tiles',
        type: 'raster',
        source: 'carto-base',
        paint: { 'raster-opacity': tileOpacity },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config),
      ...routeLayers(config),
    ],
  }
}

// ─── Topographic Style ───────────────────────────────────────────────────────

function buildTopographicStyle(config: StyleConfig, mapboxToken?: string): object {
  const token = mapboxToken || ''

  return {
    version: 8,
    name: 'TrailMaps Topographic',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      /**
       * Mapbox Outdoors v12 — base raster tiles (roads, trails, land cover, labels).
       * Using the Mapbox Styles API tile endpoint (not mapbox:// scheme) so MapLibre
       * can resolve it without Mapbox GL JS's custom URL loading.
       */
      'mapbox-outdoors': {
        type: 'raster',
        tiles: [
          `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`,
        ],
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...(config.show_hillshade ? mapboxDemSource(token) : {}),
      ...(config.show_contours ? mapboxTerrainV2Source(token) : {}),
      route: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': config.background_color },
      },
      {
        id: 'outdoors-tiles',
        type: 'raster',
        source: 'mapbox-outdoors',
        paint: {
          // Slightly reduce saturation so hillshade / contours read clearly over the base map
          'raster-opacity': config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': config.show_hillshade ? -0.15 : 0,
        },
      },
      // Hillshade sits above the base raster so terrain depth is visible through it
      ...hillshadeLayers(config),
      // Contour lines on top of everything except the route
      ...contourLayers(config),
      ...routeLayers(config),
    ],
  }
}
