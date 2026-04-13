import type { StyleConfig, TrailSegment } from '~/types'

/**
 * Build a MapLibre GL Style JSON object from a StyleConfig.
 * Used in both the browser MapPreview and the server render worker.
 *
 * Contour strategy (two paths):
 *   Browser  → contourTileUrl is provided by MapPreview.vue (maplibre-contour protocol)
 *              Generates contours on-the-fly from free AWS terrarium DEM tiles.
 *              Supports configurable meter intervals via contour_detail.
 *   Worker   → contourTileUrl is undefined; falls back to Mapbox terrain-v2 vector tiles.
 *
 * Base tile options (base_tile_style):
 *   carto-light / carto-dark  — free CARTO raster tiles (no token)
 *   maptiler-outdoor/topo/winter — MapTiler raster tiles (requires MAPTILER_TOKEN)
 *   topographic preset        — Mapbox Outdoors v12 (requires MAPBOX_TOKEN)
 */
export function buildMapStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  if (config.preset === 'topographic') {
    return buildTopographicStyle(config, mapboxToken, contourTileUrl)
  }
  return buildMinimalistStyle(config, mapboxToken, maptilerToken, contourTileUrl)
}

// ─── Contour thresholds for maplibre-contour ─────────────────────────────────
// Per-detail-level thresholds: { mapZoom: [minorIntervalMeters, majorIntervalMeters] }
// These are used in MapPreview.vue to generate the contourTileUrl.
// Exported so MapPreview can build the URL without duplicating the table.
//
// maplibre-contour's getOptionsForZoom picks the HIGHEST key ≤ current map
// zoom. If no key qualifies, levels=[] and nothing is drawn. Start at zoom 1
// as a universal fallback — the library fetches DEM tiles at zoom+overzoom
// (overzooming from higher-res tiles) so contours are accurate even when the
// map is zoomed out. Key 1 covers any poster zoom below the first named key.
export const CONTOUR_THRESHOLDS: Record<number, Record<number, [number, number]>> = {
  0: { 1: [1000, 5000], 7: [500, 2000], 8: [500, 2000], 9: [300, 1500], 10: [200, 1000], 11: [200, 1000], 12: [200, 1000], 13: [100, 500],  14: [50,  200] },
  1: { 1: [500,  2000], 7: [300, 1500], 8: [200, 1000], 9: [100, 500],  10: [100, 500],  11: [100, 500],  12: [100, 500],  13: [50,  200],  14: [20,  100] },
  2: { 1: [200,  1000], 7: [200, 1000], 8: [100, 500],  9: [50,  250],  10: [50,  200],  11: [50,  200],  12: [50,  200],  13: [20,  100],  14: [10,  50]  },
  3: { 1: [100,  500],  7: [100, 500],  8: [50,  250],  9: [30,  150],  10: [20,  100],  11: [20,  100],  12: [20,  100],  13: [10,  50],   14: [5,   20]  }, // default
  4: { 1: [50,   250],  7: [50,  250],  8: [30,  150],  9: [20,  100],  10: [10,  50],   11: [10,  50],   12: [10,  50],   13: [5,   20],   14: [5,   10]  },
}

// ─── DEM source (hillshade) ───────────────────────────────────────────────────
// AWS Terrain Tiles (Tilezen/Terrarium) — free, no auth, terrarium encoding.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function demSource(_token: string) {
  return {
    'mapbox-dem': {
      type: 'raster-dem' as const,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium' as const,
      attribution: '© Mapzen, © OpenStreetMap contributors',
    },
  }
}

// ─── Contour sources ──────────────────────────────────────────────────────────

// Browser path: maplibre-contour generates vector contours from the DEM tiles.
// The tileUrl is a custom "contour://" protocol URL produced by DemSource.contourProtocol().
function mlContourSource(tileUrl: string) {
  return {
    'contours': {
      type: 'vector' as const,
      tiles: [tileUrl],
      minzoom: 0,
      maxzoom: 14,
    },
  }
}

// Fallback path (render worker): Mapbox terrain-v2 vector tiles.
function terrainV2Source(token: string) {
  return {
    'mapbox-terrain-v2': {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 10,
      maxzoom: 15,
      attribution: '© Mapbox',
    },
  }
}

function contourSource(token: string, contourTileUrl?: string) {
  return contourTileUrl ? mlContourSource(contourTileUrl) : terrainV2Source(token)
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
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': config.hillshade_intensity,
      },
    },
  ]
}

// ─── Contour line layers ──────────────────────────────────────────────────────

function contourLayers(config: StyleConfig, usingMlContour: boolean) {
  if (!config.show_contours) return []

  // ── maplibre-contour path ───────────────────────────────────────────────────
  // Source layer: 'contours'  |  level: 0 = minor, 1 = major
  if (usingMlContour) {
    const layers: object[] = [
      {
        id: 'contours-minor',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['!=', ['get', 'level'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_color,
          'line-opacity': ['interpolate', ['linear'], ['zoom'],
            5, config.contour_opacity,
            14, config.contour_opacity * 0.9,
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1.0],
        },
      },
      {
        id: 'contours-major',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_major_color,
          'line-opacity': config.contour_opacity,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.5],
        },
      },
    ]

    if (config.show_elevation_labels) {
      layers.push({
        id: 'contours-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 500,
          'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
          'text-letter-spacing': 0.06,
          'text-padding': 4,
          'text-pitch-alignment': 'viewport',
          // viewport keeps labels horizontal — far more legible than map-aligned
          // which tilts text to follow the contour curve
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': config.contour_major_color,
          // Use the poster background colour as the halo so it reads on both
          // light (chalk/topaz) and dark (obsidian/midnight) themes
          'text-halo-color': config.background_color,
          'text-halo-width': 2,
          'text-opacity': config.contour_opacity,
        },
      })
    }

    return layers
  }

  // ── terrain-v2 fallback (render worker) ─────────────────────────────────────
  // Source layer: 'contour'  |  index: 5 = mid, 10 = major
  const detail = Math.round(config.contour_detail ?? 2)

  const layers: object[] = []

  if (detail >= 2) {
    layers.push({
      id: 'contours-minor',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ['interpolate', ['linear'], ['zoom'],
          5, config.contour_opacity,
          14, config.contour_opacity * 0.9,
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1.0],
      },
    })
  }

  if (detail >= 1) {
    layers.push({
      id: 'contours-mid',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 5],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': config.contour_opacity,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 14, 1.5],
      },
    })
  }

  layers.push({
    id: 'contours-major',
    type: 'line',
    source: 'mapbox-terrain-v2',
    'source-layer': 'contour',
    filter: ['==', ['get', 'index'], 10],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': config.contour_major_color,
      'line-opacity': config.contour_opacity,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.5],
    },
  })

  if (config.show_elevation_labels) {
    layers.push({
      id: 'contours-labels',
      type: 'symbol',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 10],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 500,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
        'text-letter-spacing': 0.06,
        'text-padding': 4,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': config.background_color,
        'text-halo-width': 2,
        'text-opacity': config.contour_opacity,
      },
    })
  }

  return layers
}

// ─── Trail segment sources/layers ────────────────────────────────────────────

export function trailSegmentSources(segments: TrailSegment[] = []): Record<string, object> {
  const sources: Record<string, object> = {}
  for (const seg of segments) {
    if (!seg.visible) continue
    sources[`trail-seg-${seg.id}`] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    }
  }
  return sources
}

export function trailSegmentLayers(segments: TrailSegment[] = [], config: StyleConfig): object[] {
  const layers: object[] = []
  for (const seg of segments) {
    if (!seg.visible) continue
    const width = seg.width ?? config.route_width ?? 2
    const opacity = seg.opacity ?? 0.9
    const dashArray = seg.dash ? [4, 3] : undefined

    layers.push({
      id: `trail-seg-casing-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': width + 3,
        'line-opacity': opacity,
      },
    })

    const lineLayer: Record<string, unknown> = {
      id: `trail-seg-line-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        ...(dashArray ? { 'line-dasharray': dashArray } : {}),
      },
      paint: {
        'line-color': seg.color,
        'line-width': width,
        'line-opacity': opacity,
      },
    }
    layers.push(lineLayer)
  }
  return layers
}

// ─── Pin source + layers ──────────────────────────────────────────────────────

export function pinSource(): object {
  return {
    'route-pins': {
      type: 'geojson' as const,
      data: { type: 'FeatureCollection', features: [] },
    },
  }
}

export function pinLayers(config: StyleConfig): object[] {
  const startVis = config.show_start_pin !== false ? 'visible' : 'none'
  const finishVis = config.show_finish_pin !== false ? 'visible' : 'none'

  return [
    // ── Start pin: white halo → route_color disk → white center (open ring look) ──
    {
      id: 'route-pin-start-halo',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'start'],
      layout: { visibility: startVis },
      paint: { 'circle-radius': 13, 'circle-color': '#FFFFFF', 'circle-opacity': 0.88, 'circle-blur': 0.18 },
    },
    {
      id: 'route-pin-start-ring',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'start'],
      layout: { visibility: startVis },
      paint: { 'circle-radius': 9, 'circle-color': config.route_color, 'circle-opacity': 1 },
    },
    {
      id: 'route-pin-start-center',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'start'],
      layout: { visibility: startVis },
      paint: { 'circle-radius': 4, 'circle-color': '#FFFFFF', 'circle-opacity': 1 },
    },
    // ── Finish pin: white halo → route_color solid disk (closed look) ────────────
    {
      id: 'route-pin-finish-halo',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'finish'],
      layout: { visibility: finishVis },
      paint: { 'circle-radius': 13, 'circle-color': '#FFFFFF', 'circle-opacity': 0.88, 'circle-blur': 0.18 },
    },
    {
      id: 'route-pin-finish',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'finish'],
      layout: { visibility: finishVis },
      paint: { 'circle-radius': 10, 'circle-color': config.route_color, 'circle-opacity': 1 },
    },
    {
      id: 'route-pin-finish-dot',
      type: 'circle',
      source: 'route-pins',
      filter: ['==', ['get', 'type'], 'finish'],
      layout: { visibility: finishVis },
      paint: { 'circle-radius': 3.5, 'circle-color': '#FFFFFF', 'circle-opacity': 1 },
    },
  ]
}

// ─── Route layers ─────────────────────────────────────────────────────────────

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

// ─── Minimalist Style ─────────────────────────────────────────────────────────

function buildMinimalistStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const maptilerTk = maptilerToken || ''
  const base = config.base_tile_style ?? 'carto-light'
  const usingMlContour = !!contourTileUrl

  // ── Resolve base tiles ─────────────────────────────────────────────────────
  let baseTileSource: object
  let baseTileOpacity: number
  let baseTileAttribution: string

  if (base === 'maptiler-outdoor' || base === 'maptiler-topo' || base === 'maptiler-winter') {
    const styleMap: Record<string, string> = {
      'maptiler-outdoor': 'outdoor-v2',
      'maptiler-topo': 'topo-v2',
      'maptiler-winter': 'winter-v2',
    }
    baseTileSource = {
      type: 'raster' as const,
      tiles: [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`],
      tileSize: 512,
    }
    baseTileOpacity = 0.85
    baseTileAttribution = '© MapTiler © OpenStreetMap contributors'
  } else {
    const dark = base === 'carto-dark'
    const sub = (s: string) =>
      ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}.png`)
    baseTileSource = {
      type: 'raster' as const,
      tiles: dark ? sub('dark_all') : sub('light_all'),
      tileSize: 256,
    }
    baseTileOpacity = base === 'carto-dark' ? 0.45 : 0.55
    baseTileAttribution = '© CARTO © OpenStreetMap contributors'
  }

  return {
    version: 8,
    name: 'RadMaps Minimalist',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': { ...baseTileSource, attribution: baseTileAttribution },
      ...(config.show_hillshade ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      ...trailSegmentSources(config.trail_segments),
      ...pinSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
      { id: 'base-tiles', type: 'raster', source: 'base-tiles', paint: { 'raster-opacity': baseTileOpacity } },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...trailSegmentLayers(config.trail_segments, config),
      ...routeLayers(config),
      ...pinLayers(config),
    ],
  }
}

// ─── Topographic Style ────────────────────────────────────────────────────────

function buildTopographicStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Topographic',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      'mapbox-outdoors': {
        type: 'raster' as const,
        tiles: [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`],
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...(config.show_hillshade ? demSource(token) : {}),
      ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
      route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      ...trailSegmentSources(config.trail_segments),
      ...pinSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
      {
        id: 'outdoors-tiles',
        type: 'raster',
        source: 'mapbox-outdoors',
        paint: {
          'raster-opacity': config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': config.show_hillshade ? -0.15 : 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...trailSegmentLayers(config.trail_segments, config),
      ...routeLayers(config),
      ...pinLayers(config),
    ],
  }
}
