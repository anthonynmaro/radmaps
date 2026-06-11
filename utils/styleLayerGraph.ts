import type { StyleConfig, StylePreset } from '~/types'

export type LayerFeatureSupport = 'editable-vector' | 'baked-raster' | 'required' | 'unsupported'
export type StyleUpdateMode = 'full-reload' | 'paint' | 'source' | 'chrome' | 'ignored'

/**
 * Editor map-element selection support per canonical slot (editor-v2 E3,
 * docs/STYLE_SYSTEM_EVOLUTION.md "Domain 2").
 * - 'feature': individual rendered features are selectable (labels, segments).
 * - 'layer': the slot selects as one element (the route).
 * - false: not selectable — selection mode must show no affordance at all.
 */
export type SlotSelectability = 'feature' | 'layer' | false

export type LayerSlot =
  | 'background'
  | 'base'
  | 'water-land-buildings'
  | 'terrain'
  | 'contours'
  | 'editable-roads'
  | 'labels-pois'
  | 'route-casing'
  | 'route'
  | 'segments-handles'

export type ScaledMapLibreProperty =
  | 'line-width'
  | 'line-dasharray'
  | 'circle-radius'
  | 'circle-stroke-width'
  | 'text-size'
  | 'text-halo-width'

export interface LayerGraphFeatureSet {
  baseRaster: LayerFeatureSupport
  water: LayerFeatureSupport
  roads: LayerFeatureSupport
  placeLabels: LayerFeatureSupport
  pois: LayerFeatureSupport
  contours: LayerFeatureSupport
  hillshade: LayerFeatureSupport
  rasterEffects: LayerFeatureSupport
  routeCasing: LayerFeatureSupport
  route: LayerFeatureSupport
  trailSegments: LayerFeatureSupport
}

export interface LayerGraphControl {
  visible: boolean
  update: StyleUpdateMode
  reason?: string
}

export interface LayerGraphLayer {
  id: string
  slot: LayerSlot
  source?: string
  consumes?: Array<keyof StyleConfig>
  scale?: ScaledMapLibreProperty[]
}

export interface LayerGraph {
  preset: StylePreset
  features: LayerGraphFeatureSet
  requiredFields: Partial<Pick<StyleConfig, 'show_contours' | 'show_roads' | 'show_place_labels' | 'show_poi_labels'>>
  ignoredFields: Array<keyof StyleConfig>
  consumedFields: Array<keyof StyleConfig>
  controls: Partial<Record<keyof StyleConfig, LayerGraphControl>>
  sources: string[]
  layers: LayerGraphLayer[]
  /** Slots that support map-element selection. Absent slot = not selectable. */
  selectableSlots: Partial<Record<LayerSlot, Exclude<SlotSelectability, false>>>
}

export const ALL_STYLE_PRESETS: readonly StylePreset[] = [
  'minimalist',
  'topographic',
  'route-only',
  'road-network',
  'contour-art',
  'natural-topo',
  'stadia-watercolor',
  'stadia-toner',
  'native-toner',
  'native-watercolor',
  'alidade-smooth',
  'alidade-smooth-dark',
  'radmaps-minimalist',
  'radmaps-topographic',
  'radmaps-natural',
  'radmaps-toner-light',
  'radmaps-toner-dark',
  'radmaps-toner',
  'radmaps-field-topo',
  'radmaps-contour-wash',
  'radmaps-simple-contour',
  'radmaps-night-relief',
  'radmaps-watercolor',
  'radmaps-watercolor-classic',
  'radmaps-watercolor-pigment-wash',
  'radmaps-watercolor-paper',
  'radmaps-watercolor-brush-ink',
  'radmaps-alidade',
  'radmaps-alidade-dark',
] as const

export const CANONICAL_LAYER_SLOT_ORDER: readonly LayerSlot[] = [
  'background',
  'base',
  'water-land-buildings',
  'terrain',
  'contours',
  'editable-roads',
  'route-casing',
  'route',
  'labels-pois',
  'segments-handles',
] as const

export const ROUTE_SCALE_PROPERTIES: ScaledMapLibreProperty[] = ['line-width']
export const LINE_SCALE_PROPERTIES: ScaledMapLibreProperty[] = ['line-width', 'line-dasharray']
export const SYMBOL_SCALE_PROPERTIES: ScaledMapLibreProperty[] = ['text-size', 'text-halo-width']
export const CIRCLE_SCALE_PROPERTIES: ScaledMapLibreProperty[] = ['circle-radius', 'circle-stroke-width']

const routeFields: Array<keyof StyleConfig> = [
  'route_color',
  'route_width',
  'route_opacity',
  'route_color_mode',
  'show_primary_route',
]

const segmentFields: Array<keyof StyleConfig> = [
  'trail_segments',
  'segment_casing_width',
  'segment_casing_color',
  'segment_dot_size',
  'leader_label_scale',
  'leader_label_font_family',
  'trail_show_stats',
  'trail_show_elevation_gain',
  'trail_label_style',
]

const contourFields: Array<keyof StyleConfig> = [
  'show_contours',
  'contour_color',
  'contour_major_color',
  'contour_opacity',
  'contour_detail',
  'contour_minor_width',
  'contour_major_width',
  'show_elevation_labels',
]

const hillshadeFields: Array<keyof StyleConfig> = [
  'show_hillshade',
  'hillshade_intensity',
]

const roadFields: Array<keyof StyleConfig> = [
  'show_roads',
  'roads_color',
  'roads_opacity',
]

const labelFields: Array<keyof StyleConfig> = [
  'show_place_labels',
  'place_labels_color',
  'place_labels_opacity',
  'place_labels_scale',
]

const poiFields: Array<keyof StyleConfig> = [
  'show_poi_labels',
  'poi_labels_color',
  'poi_labels_opacity',
]

const rasterEffectFields: Array<keyof StyleConfig> = [
  'tile_effect',
  'tile_duotone_strength',
  'tile_posterize_levels',
  'tile_contrast',
  'tile_saturation',
  'tile_hue_rotate',
  'tile_shadow_color',
  'tile_midtone_color',
  'tile_highlight_color',
]

const chromeEffectFields: Array<keyof StyleConfig> = [
  'show_vignette',
  'vignette_intensity',
  'tile_grain',
]

const atlasFields: Array<keyof StyleConfig> = [
  'atlas_manifest_id',
  'atlas_style_id',
  'atlas_layers',
  'atlas_layer_settings',
]
const tonerAtlasFields: Array<keyof StyleConfig> = [...atlasFields, 'toner_variant']

function isTonerAtlasPreset(preset: StylePreset | string | undefined): boolean {
  return preset === 'radmaps-toner-light'
    || preset === 'radmaps-toner-dark'
    || preset === 'radmaps-toner'
}

function isAtlasWatercolorPreset(preset: StylePreset | string | undefined): boolean {
  return typeof preset === 'string' && preset.includes('watercolor')
}

function slotIndex(slot: LayerSlot): number {
  return CANONICAL_LAYER_SLOT_ORDER.indexOf(slot)
}

function baseControls(): Partial<Record<keyof StyleConfig, LayerGraphControl>> {
  return {
    preset: { visible: true, update: 'full-reload' },
    base_tile_style: { visible: true, update: 'full-reload' },
    background_color: { visible: true, update: 'paint' },
    route_color: { visible: true, update: 'paint' },
    route_width: { visible: true, update: 'paint' },
    route_opacity: { visible: true, update: 'paint' },
    route_smooth: { visible: true, update: 'source' },
    route_crop_start: { visible: true, update: 'source' },
    route_crop_end: { visible: true, update: 'source' },
    route_deleted_ranges: { visible: true, update: 'source' },
    route_color_mode: { visible: true, update: 'full-reload' },
    show_primary_route: { visible: false, update: 'full-reload', reason: 'Primary route visibility is automatic when trail segments exist; saved overrides are render-only intent.' },
    map_3d: { visible: true, update: 'full-reload' },
    map_pitch: { visible: true, update: 'paint' },
    map_bearing: { visible: true, update: 'paint' },
    terrain_exaggeration: { visible: true, update: 'paint' },
    hillshade_highlight: { visible: false, update: 'ignored', reason: 'Hillshade highlight is stored legacy intent but is not currently rendered.' },
    ...Object.fromEntries(segmentFields.map(field => [field, { visible: true, update: 'full-reload' as const }])),
    ...Object.fromEntries(chromeEffectFields.map(field => [field, { visible: true, update: 'chrome' as const }])),
  }
}

function featureControls(opts: {
  roads?: LayerFeatureSupport
  labels?: LayerFeatureSupport
  pois?: LayerFeatureSupport
  contours?: LayerFeatureSupport
  hillshade?: LayerFeatureSupport
  rasterEffects?: LayerFeatureSupport
  labelToggleCanSwitchBakedTiles?: boolean
  water?: LayerFeatureSupport
}): Partial<Record<keyof StyleConfig, LayerGraphControl>> {
  const controls: Partial<Record<keyof StyleConfig, LayerGraphControl>> = {}

  const waterVisible = opts.water === 'editable-vector'
  controls.water_color = waterVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `Water color is ${opts.water ?? 'unsupported'} for this preset.` }
  controls.land_color = { visible: false, update: 'ignored', reason: 'Land color is not exposed as an editable map-layer control.' }

  const roadsVisible = opts.roads === 'editable-vector'
  controls.show_roads = roadsVisible
    ? { visible: true, update: 'full-reload' }
    : { visible: false, update: 'ignored', reason: `Road styling is ${opts.roads ?? 'unsupported'} for this preset.` }
  controls.roads_color = roadsVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `Road styling is ${opts.roads ?? 'unsupported'} for this preset.` }
  controls.roads_opacity = roadsVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `Road styling is ${opts.roads ?? 'unsupported'} for this preset.` }

  const labelsVisible = opts.labels === 'editable-vector'
  const labelToggleVisible = labelsVisible || opts.labelToggleCanSwitchBakedTiles === true
  controls.show_place_labels = labelToggleVisible
    ? { visible: true, update: 'full-reload' }
    : { visible: false, update: 'ignored', reason: `Place labels are ${opts.labels ?? 'unsupported'} for this preset.` }
  controls.place_labels_color = labelsVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `Place-label styling is ${opts.labels ?? 'unsupported'} for this preset.` }
  controls.place_labels_opacity = labelsVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `Place-label styling is ${opts.labels ?? 'unsupported'} for this preset.` }
  controls.place_labels_scale = labelsVisible
    ? { visible: true, update: 'full-reload' }
    : { visible: false, update: 'ignored', reason: `Place-label styling is ${opts.labels ?? 'unsupported'} for this preset.` }

  const poiVisible = opts.pois === 'editable-vector'
  controls.show_poi_labels = poiVisible
    ? { visible: true, update: 'full-reload' }
    : { visible: false, update: 'ignored', reason: `POIs are ${opts.pois ?? 'unsupported'} for this preset.` }
  controls.poi_labels_color = poiVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `POIs are ${opts.pois ?? 'unsupported'} for this preset.` }
  controls.poi_labels_opacity = poiVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: `POIs are ${opts.pois ?? 'unsupported'} for this preset.` }

  const contoursSupported = opts.contours === 'editable-vector' || opts.contours === 'required'
  for (const field of contourFields) {
    const isRequiredToggle = field === 'show_contours' && opts.contours === 'required'
    const paintOnly = field === 'contour_color' || field === 'contour_major_color' || field === 'contour_opacity'
    controls[field] = contoursSupported && !isRequiredToggle
      ? { visible: true, update: paintOnly ? 'paint' : 'full-reload' }
      : contoursSupported
        ? { visible: false, update: 'ignored', reason: 'Contours are required by this preset.' }
        : { visible: false, update: 'ignored', reason: 'Contours are not available for this preset.' }
  }
  if (contoursSupported) {
    controls.contour_minor_width = { visible: true, update: 'paint' }
    controls.contour_major_width = { visible: true, update: 'paint' }
  }

  const hillshadeVisible = opts.hillshade === 'editable-vector'
  controls.show_hillshade = hillshadeVisible
    ? { visible: true, update: 'full-reload' }
    : { visible: false, update: 'ignored', reason: 'Hillshade is not available for this preset.' }
  controls.hillshade_intensity = hillshadeVisible
    ? { visible: true, update: 'paint' }
    : { visible: false, update: 'ignored', reason: 'Hillshade is not available for this preset.' }

  const rasterEffectsVisible = opts.rasterEffects === 'editable-vector'
  for (const field of rasterEffectFields) {
    const paintOnly = field === 'tile_contrast' || field === 'tile_saturation' || field === 'tile_hue_rotate'
    controls[field] = rasterEffectsVisible
      ? { visible: true, update: paintOnly ? 'paint' : 'full-reload' }
      : { visible: false, update: 'ignored', reason: 'Tile effects require an editable raster tile layer.' }
  }

  return controls
}

function commonRouteLayers(): LayerGraphLayer[] {
  return [
    { id: 'route-line-casing', slot: 'route-casing', source: 'route', consumes: routeFields, scale: ROUTE_SCALE_PROPERTIES },
    { id: 'route-line', slot: 'route', source: 'route', consumes: routeFields, scale: ROUTE_SCALE_PROPERTIES },
    { id: 'route-gradient-line', slot: 'route', source: 'route', consumes: routeFields, scale: ROUTE_SCALE_PROPERTIES },
    { id: 'route-gradient-line-legacy', slot: 'route', source: 'route', consumes: routeFields, scale: ROUTE_SCALE_PROPERTIES },
    { id: 'trail-segments', slot: 'segments-handles', source: 'route', consumes: segmentFields, scale: LINE_SCALE_PROPERTIES },
    { id: 'segment-handles', slot: 'segments-handles', source: 'route', consumes: segmentFields, scale: CIRCLE_SCALE_PROPERTIES },
  ]
}

function optionalTerrainLayers(contours: LayerFeatureSupport, hillshade: LayerFeatureSupport): LayerGraphLayer[] {
  const layers: LayerGraphLayer[] = []
  if (hillshade === 'editable-vector') {
    layers.push({ id: 'hillshade', slot: 'terrain', source: 'mapbox-dem', consumes: hillshadeFields })
  }
  if (contours === 'editable-vector' || contours === 'required') {
    layers.push(
      { id: 'contours-minor', slot: 'contours', source: 'contours', consumes: contourFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'contours-major', slot: 'contours', source: 'contours', consumes: contourFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'contours-labels', slot: 'contours', source: 'contours', consumes: contourFields, scale: SYMBOL_SCALE_PROPERTIES },
    )
  }
  return layers
}

function editableRoadLayers(features: Pick<LayerGraphFeatureSet, 'roads' | 'placeLabels' | 'pois'>): LayerGraphLayer[] {
  const layers: LayerGraphLayer[] = []
  if (features.roads === 'editable-vector') {
    layers.push(
    { id: 'roads-minor', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
    { id: 'roads-primary', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
    { id: 'roads-major', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
    )
  }
  if (features.placeLabels === 'editable-vector') {
    layers.push({ id: 'roads-place-labels', slot: 'labels-pois', source: 'mapbox-streets', consumes: labelFields, scale: SYMBOL_SCALE_PROPERTIES })
  }
  if (features.pois === 'editable-vector') {
    layers.push({ id: 'roads-poi-labels', slot: 'labels-pois', source: 'mapbox-streets', consumes: poiFields, scale: SYMBOL_SCALE_PROPERTIES })
  }
  return layers
}

// E3 map-element selection (docs/STYLE_SYSTEM_EVOLUTION.md "Domain 2"):
// baked-raster presets declare NOTHING selectable — their labels are pixels,
// and per the no-fake-controls rule selection mode shows no affordance at all
// there (route/segments included, so the feature is all-or-nothing per preset).
// Vector presets select the route as one element and segments per feature;
// label slots are selectable only when the preset actually renders vector
// label layers. Pins are DOM markers (maplibregl.Marker), not rendered map
// features, so they are app-owned selection targets outside the graph.
function computeSelectableSlots(features: LayerGraphFeatureSet): LayerGraph['selectableSlots'] {
  if (features.baseRaster === 'baked-raster') return {}
  const selectable: LayerGraph['selectableSlots'] = {
    'route': 'layer',
    'segments-handles': 'feature',
  }
  if (features.placeLabels === 'editable-vector' || features.pois === 'editable-vector') {
    selectable['labels-pois'] = 'feature'
  }
  return selectable
}

function makeGraph(opts: {
  preset: StylePreset
  features: LayerGraphFeatureSet
  sources: string[]
  controls?: Partial<Record<keyof StyleConfig, LayerGraphControl>>
  layers?: LayerGraphLayer[]
  includeDefaultRoadLayers?: boolean
  requiredFields?: LayerGraph['requiredFields']
}): LayerGraph {
  const controls = {
    ...baseControls(),
    ...featureControls({
      roads: opts.features.roads,
      labels: opts.features.placeLabels,
      pois: opts.features.pois,
      contours: opts.features.contours,
      hillshade: opts.features.hillshade,
      rasterEffects: opts.features.rasterEffects,
      labelToggleCanSwitchBakedTiles: opts.preset === 'stadia-toner',
      water: opts.features.water,
    }),
    ...opts.controls,
  }
  const layers = [
    ...(opts.layers ?? []),
    ...optionalTerrainLayers(opts.features.contours, opts.features.hillshade),
    ...((opts.includeDefaultRoadLayers ?? true) && (opts.features.roads === 'editable-vector' || opts.features.placeLabels === 'editable-vector' || opts.features.pois === 'editable-vector')
      ? editableRoadLayers(opts.features)
      : []),
    ...commonRouteLayers(),
  ].sort((a, b) => slotIndex(a.slot) - slotIndex(b.slot))
  const consumedFields = Array.from(new Set([
    ...Object.entries(controls)
      .filter(([, control]) => control.visible && control.update !== 'ignored')
      .map(([field]) => field as keyof StyleConfig),
    ...layers.flatMap(layer => layer.consumes ?? []),
  ]))
  const ignoredFields = (Object.entries(controls) as Array<[keyof StyleConfig, LayerGraphControl]>)
    .filter(([, control]) => control.update === 'ignored')
    .map(([field]) => field)

  return {
    preset: opts.preset,
    features: opts.features,
    requiredFields: opts.requiredFields ?? {},
    ignoredFields,
    consumedFields,
    controls,
    sources: opts.sources,
    layers,
    selectableSlots: computeSelectableSlots(opts.features),
  }
}

const rasterPresetFeatures: LayerGraphFeatureSet = {
  baseRaster: 'baked-raster',
  water: 'baked-raster',
  roads: 'baked-raster',
  placeLabels: 'baked-raster',
  pois: 'baked-raster',
  contours: 'editable-vector',
  hillshade: 'editable-vector',
  rasterEffects: 'editable-vector',
  routeCasing: 'required',
  route: 'required',
  trailSegments: 'editable-vector',
}

const vectorRouteFeatures: LayerGraphFeatureSet = {
  baseRaster: 'unsupported',
  water: 'unsupported',
  roads: 'editable-vector',
  placeLabels: 'editable-vector',
  pois: 'editable-vector',
  contours: 'editable-vector',
  hillshade: 'editable-vector',
  rasterEffects: 'unsupported',
  routeCasing: 'required',
  route: 'required',
  trailSegments: 'editable-vector',
}

const atlasVectorFeatures: LayerGraphFeatureSet = {
  baseRaster: 'unsupported',
  water: 'editable-vector',
  roads: 'editable-vector',
  placeLabels: 'editable-vector',
  pois: 'editable-vector',
  contours: 'editable-vector',
  hillshade: 'editable-vector',
  rasterEffects: 'unsupported',
  routeCasing: 'required',
  route: 'required',
  trailSegments: 'editable-vector',
}

const watercolorArtTileFeatures: LayerGraphFeatureSet = {
  baseRaster: 'baked-raster',
  water: 'baked-raster',
  roads: 'baked-raster',
  placeLabels: 'editable-vector',
  pois: 'editable-vector',
  contours: 'unsupported',
  hillshade: 'unsupported',
  rasterEffects: 'unsupported',
  routeCasing: 'required',
  route: 'required',
  trailSegments: 'editable-vector',
}

function atlasGraph(preset: StylePreset, options: {
  contours?: LayerFeatureSupport
  hillshade?: LayerFeatureSupport
  requiredFields?: LayerGraph['requiredFields']
} = {}) {
  const layerFields = preset === 'radmaps-toner' ? tonerAtlasFields : atlasFields
  const waterEdgeLayerId = isAtlasWatercolorPreset(preset)
    ? `${preset}-water-edge-bloom`
    : `${preset}-water-edge-soften`
  const waterwaySoftLayerId = isAtlasWatercolorPreset(preset)
    ? `${preset}-waterway-bloom`
    : `${preset}-waterway-soften`
  return makeGraph({
    preset,
    features: {
      ...atlasVectorFeatures,
      contours: options.contours ?? 'editable-vector',
      hillshade: options.hillshade ?? 'editable-vector',
    },
    sources: ['radmaps-atlas-base', 'radmaps-atlas-poi', 'radmaps-atlas-outdoor-routes', 'contours', 'mapbox-dem', 'route'],
    includeDefaultRoadLayers: false,
    requiredFields: options.requiredFields,
    controls: {
      atlas_manifest_id: { visible: false, update: 'full-reload' },
      atlas_style_id: { visible: false, update: 'full-reload' },
      atlas_layers: { visible: true, update: 'full-reload' },
      atlas_layer_settings: { visible: true, update: 'paint' },
    },
    layers: [
      { id: `${preset}-landcover`, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields },
      ...(isTonerAtlasPreset(preset)
        ? [{ id: `${preset}-natural-dots`, slot: 'water-land-buildings' as const, source: 'radmaps-atlas-base', consumes: layerFields }]
        : []),
      { id: `${preset}-park`, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields },
      ...(isTonerAtlasPreset(preset)
        ? [{ id: `${preset}-park-dots`, slot: 'water-land-buildings' as const, source: 'radmaps-atlas-base', consumes: layerFields }]
        : []),
      { id: waterEdgeLayerId, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-water`, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields },
      { id: waterwaySoftLayerId, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-waterway`, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-building`, slot: 'water-land-buildings', source: 'radmaps-atlas-base', consumes: layerFields },
      { id: `${preset}-roads-minor`, slot: 'editable-roads', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-roads-major`, slot: 'editable-roads', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-roads-trails`, slot: 'editable-roads', source: 'radmaps-atlas-base', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-outdoor-routes`, slot: 'editable-roads', source: 'radmaps-atlas-outdoor-routes', consumes: layerFields, scale: LINE_SCALE_PROPERTIES },
      { id: `${preset}-place-labels`, slot: 'labels-pois', source: 'radmaps-atlas-base', consumes: layerFields, scale: SYMBOL_SCALE_PROPERTIES },
      { id: `${preset}-poi-labels`, slot: 'labels-pois', source: 'radmaps-atlas-base', consumes: layerFields, scale: SYMBOL_SCALE_PROPERTIES },
      { id: `${preset}-poi-overlay-labels`, slot: 'labels-pois', source: 'radmaps-atlas-poi', consumes: layerFields, scale: SYMBOL_SCALE_PROPERTIES },
      { id: `${preset}-outdoor-route-labels`, slot: 'labels-pois', source: 'radmaps-atlas-outdoor-routes', consumes: layerFields, scale: SYMBOL_SCALE_PROPERTIES },
      ...((options.contours ?? 'editable-vector') === 'unsupported'
        ? []
        : [{ id: 'contours-mid', slot: 'contours' as const, source: 'contours', consumes: contourFields, scale: LINE_SCALE_PROPERTIES }]),
    ],
  })
}

function watercolorArtTileGraph(): LayerGraph {
  const artTileFields: Array<keyof StyleConfig> = [
    ...atlasFields,
    'watercolor_seed',
    'show_roads',
    'water_color',
    'land_color',
    'roads_color',
  ]
  return makeGraph({
    preset: 'radmaps-watercolor',
    features: watercolorArtTileFeatures,
    sources: ['radmaps-watercolor-base', 'radmaps-atlas-base', 'route'],
    includeDefaultRoadLayers: false,
    controls: {
      atlas_manifest_id: { visible: false, update: 'full-reload' },
      atlas_style_id: { visible: false, update: 'full-reload' },
      atlas_layers: { visible: true, update: 'full-reload' },
      atlas_layer_settings: { visible: true, update: 'full-reload' },
      watercolor_seed: { visible: false, update: 'full-reload' },
      show_roads: { visible: true, update: 'full-reload' },
    },
    layers: [
      { id: 'radmaps-watercolor-base', slot: 'base', source: 'radmaps-watercolor-base', consumes: artTileFields },
      { id: 'radmaps-watercolor-place-labels', slot: 'labels-pois', source: 'radmaps-atlas-base', consumes: [...atlasFields, ...labelFields], scale: SYMBOL_SCALE_PROPERTIES },
      { id: 'radmaps-watercolor-poi-labels', slot: 'labels-pois', source: 'radmaps-atlas-base', consumes: [...atlasFields, ...poiFields], scale: SYMBOL_SCALE_PROPERTIES },
    ],
  })
}

const graphs: Record<StylePreset, LayerGraph> = {
  minimalist: makeGraph({
    preset: 'minimalist',
    features: { ...rasterPresetFeatures, roads: 'baked-raster', placeLabels: 'baked-raster', pois: 'baked-raster' },
    sources: ['carto-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  topographic: makeGraph({
    preset: 'topographic',
    features: rasterPresetFeatures,
    sources: ['mapbox-outdoors-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'route-only': makeGraph({
    preset: 'route-only',
    features: vectorRouteFeatures,
    sources: ['mapbox-streets', 'mapbox-dem', 'contours', 'route'],
  }),
  'road-network': makeGraph({
    preset: 'road-network',
    features: {
      ...vectorRouteFeatures,
      water: 'editable-vector',
      placeLabels: 'unsupported',
      pois: 'unsupported',
      contours: 'unsupported',
      hillshade: 'unsupported',
    },
    sources: ['mapbox-streets', 'route'],
    includeDefaultRoadLayers: false,
    layers: [
      { id: 'rn-water', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['water_color'] },
      { id: 'rn-waterways', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['water_color'], scale: LINE_SCALE_PROPERTIES },
      { id: 'rn-landuse', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['land_color'] },
      { id: 'rn-service', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'rn-street', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'rn-secondary', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'rn-motorway', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
    ],
  }),
  'contour-art': makeGraph({
    preset: 'contour-art',
    features: {
      ...vectorRouteFeatures,
      water: 'editable-vector',
      roads: 'editable-vector',
      placeLabels: 'editable-vector',
      pois: 'editable-vector',
      contours: 'required',
      hillshade: 'editable-vector',
    },
    sources: ['mapbox-dem', 'contours', 'mapbox-streets', 'route'],
    requiredFields: { show_contours: true },
    layers: [
      { id: 'contour-art-water', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['water_color'] },
      { id: 'contour-art-waterways', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['water_color'], scale: LINE_SCALE_PROPERTIES },
    ],
  }),
  'natural-topo': makeGraph({
    preset: 'natural-topo',
    features: rasterPresetFeatures,
    sources: ['maptiler-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'stadia-watercolor': makeGraph({
    preset: 'stadia-watercolor',
    features: rasterPresetFeatures,
    sources: ['stadia-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'stadia-toner': makeGraph({
    preset: 'stadia-toner',
    features: { ...rasterPresetFeatures, placeLabels: 'baked-raster' },
    sources: ['stadia-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'native-toner': makeGraph({
    preset: 'native-toner',
    features: {
      ...vectorRouteFeatures,
      baseRaster: 'unsupported',
      water: 'required',
      roads: 'editable-vector',
      placeLabels: 'unsupported',
      pois: 'unsupported',
      rasterEffects: 'unsupported',
    },
    sources: ['mapbox-streets', 'route'],
    includeDefaultRoadLayers: false,
    layers: [
      { id: 'nt-water', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['label_text_color', 'background_color'] },
      { id: 'nt-waterways', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['label_text_color', 'background_color'], scale: LINE_SCALE_PROPERTIES },
      { id: 'nt-landuse', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['label_text_color', 'background_color'] },
      { id: 'nt-buildings', slot: 'water-land-buildings', source: 'mapbox-streets', consumes: ['label_text_color', 'background_color'] },
      { id: 'nt-service', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'nt-street', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'nt-secondary', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
      { id: 'nt-motorway', slot: 'editable-roads', source: 'mapbox-streets', consumes: roadFields, scale: LINE_SCALE_PROPERTIES },
    ],
  }),
  'native-watercolor': makeGraph({
    preset: 'native-watercolor',
    features: rasterPresetFeatures,
    sources: ['carto-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'alidade-smooth': makeGraph({
    preset: 'alidade-smooth',
    features: rasterPresetFeatures,
    sources: ['maptiler-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'alidade-smooth-dark': makeGraph({
    preset: 'alidade-smooth-dark',
    features: rasterPresetFeatures,
    sources: ['maptiler-raster', 'mapbox-dem', 'contours', 'route'],
  }),
  'radmaps-minimalist': atlasGraph('radmaps-minimalist', { hillshade: 'unsupported' }),
  'radmaps-topographic': atlasGraph('radmaps-topographic'),
  'radmaps-natural': atlasGraph('radmaps-natural'),
  'radmaps-toner-light': atlasGraph('radmaps-toner-light'),
  'radmaps-toner-dark': atlasGraph('radmaps-toner-dark'),
  'radmaps-toner': atlasGraph('radmaps-toner'),
  'radmaps-field-topo': atlasGraph('radmaps-field-topo'),
  'radmaps-contour-wash': atlasGraph('radmaps-contour-wash', { hillshade: 'unsupported' }),
  'radmaps-simple-contour': atlasGraph('radmaps-simple-contour', { hillshade: 'unsupported' }),
  'radmaps-night-relief': atlasGraph('radmaps-night-relief'),
  'radmaps-watercolor': watercolorArtTileGraph(),
  'radmaps-watercolor-classic': atlasGraph('radmaps-watercolor-classic'),
  'radmaps-watercolor-pigment-wash': atlasGraph('radmaps-watercolor-pigment-wash'),
  'radmaps-watercolor-paper': atlasGraph('radmaps-watercolor-paper'),
  'radmaps-watercolor-brush-ink': atlasGraph('radmaps-watercolor-brush-ink'),
  'radmaps-alidade': atlasGraph('radmaps-alidade', { hillshade: 'unsupported' }),
  'radmaps-alidade-dark': atlasGraph('radmaps-alidade-dark', { hillshade: 'unsupported' }),
}

export function getPresetGraph(preset: StylePreset | string | undefined): LayerGraph {
  return graphs[(preset as StylePreset) || 'minimalist'] ?? graphs.minimalist
}

export function getVisibleStyleControls(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string): Partial<Record<keyof StyleConfig, LayerGraphControl>> {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  const graph = getPresetGraph(preset)
  return graph.controls
}

export function getLayerGraphLayerIds(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string): string[] {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  return getPresetGraph(preset).layers.map(layer => layer.id)
}

export function styleUsesField(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string, field: keyof StyleConfig): boolean {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  const graph = getPresetGraph(preset)
  const control = graph.controls[field]
  return graph.consumedFields.includes(field)
    || (control != null && control.update !== 'ignored')
    || Object.prototype.hasOwnProperty.call(graph.requiredFields, field)
}

export function styleFieldUpdateMode(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string, field: keyof StyleConfig): StyleUpdateMode {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  return getPresetGraph(preset).controls[field]?.update ?? 'ignored'
}

export function getGraphFullReloadFields(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string): Array<keyof StyleConfig> {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  return (Object.entries(getPresetGraph(preset).controls) as Array<[keyof StyleConfig, LayerGraphControl]>)
    .filter(([, control]) => control.update === 'full-reload')
    .map(([field]) => field)
}

/** Slots supporting map-element selection for the active preset. {} = nothing selectable. */
export function getSelectableLayerSlots(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string): LayerGraph['selectableSlots'] {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  return getPresetGraph(preset).selectableSlots
}

export function getSlotSelectability(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string, slot: LayerSlot): SlotSelectability {
  return getSelectableLayerSlots(configOrPreset)[slot] ?? false
}

/** Canonical graph layer ids declared for a slot (used to scope selection hit-tests). */
export function getGraphSlotLayerIds(configOrPreset: Pick<StyleConfig, 'preset'> | StylePreset | string, slot: LayerSlot): string[] {
  const preset = typeof configOrPreset === 'string' ? configOrPreset : configOrPreset.preset
  return getPresetGraph(preset).layers.filter(layer => layer.slot === slot).map(layer => layer.id)
}

export function styleGraphUsesContours(config: Pick<StyleConfig, 'preset' | 'show_contours'>): boolean {
  const graph = getPresetGraph(config.preset)
  return graph.features.contours === 'required'
    || (graph.features.contours === 'editable-vector' && config.show_contours === true)
}

export function effectiveStyleConfig<T extends StyleConfig>(config: T): T {
  const graph = getPresetGraph(config.preset)
  const effective = { ...config }

  for (const [field, value] of Object.entries(graph.requiredFields) as Array<[keyof StyleConfig, unknown]>) {
    ;(effective as Record<keyof StyleConfig, unknown>)[field] = value
  }

  if (graph.features.roads !== 'editable-vector' && graph.preset !== 'radmaps-watercolor') effective.show_roads = false
  if (graph.features.placeLabels !== 'editable-vector' && graph.preset !== 'stadia-toner') effective.show_place_labels = false
  if (graph.features.pois !== 'editable-vector') effective.show_poi_labels = false
  if (graph.features.contours === 'unsupported') effective.show_contours = false
  if (graph.features.hillshade !== 'editable-vector') effective.show_hillshade = false
  if (graph.features.rasterEffects !== 'editable-vector') effective.tile_effect = 'none'

  return effective
}

export function assertGraphSlotOrder(graph: LayerGraph): boolean {
  let previous = -1
  for (const layer of graph.layers) {
    const current = slotIndex(layer.slot)
    if (current < previous) return false
    previous = current
  }
  return true
}
