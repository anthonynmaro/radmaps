/**
 * Pure functions encoding all StylePanel section-visibility rules.
 * Kept separate so they can be unit-tested without a DOM or Vue runtime.
 *
 * The template uses a `sections` computed that calls `computeSectionVisibility`,
 * so these functions are the single source of truth for every v-if in the panel.
 */

import type { StyleConfig, ThemeEditableField } from '~/types'
import { getPresetGraph, getVisibleStyleControls, styleGraphUsesContours } from '~/utils/styleLayerGraph'

export interface GatingInput {
  hasRoute: boolean
  hasElevationData: boolean
  preset: string
  showHillshade: boolean
  showContours: boolean
  tileEffect: string | undefined
  showVignette: boolean
  logoUrl: string | undefined
  showLogo: boolean
  logoAssetCount?: number
  trailSegmentCount: number
  showRoads: boolean
  showElevationProfile: boolean
  showStartPin: boolean
  showFinishPin: boolean
  editableFields?: readonly ThemeEditableField[]
}

export interface SectionVisibility {
  // Quick tab
  routeLineQuick: boolean
  routeColorControl: boolean
  routeWidthControl: boolean
  routeOpacityControl: boolean
  routeAdvancedControls: boolean
  // Map tab
  minimalistTileStyles: boolean
  naturalTopoTileStyles: boolean
  routeMapCard: boolean
  hillshadeToggle: boolean
  hillshadeDetails: boolean
  contourToggle: boolean
  contourDetails: boolean
  mapDetailCard: boolean
  roadsToggle: boolean
  roadColorControl: boolean
  roadOpacityControl: boolean
  placeLabelsToggle: boolean
  placeLabelDetails: boolean
  poiToggle: boolean
  poiDetails: boolean
  roadsExpanded: boolean
  elevationProfileToggle: boolean   // show/hide the toggle itself
  elevationProfileExpanded: boolean // show sub-controls when enabled
  rasterEffectControls: boolean
  tonerVariantControls: boolean
  duotoneControls: boolean
  posterizeControls: boolean
  layerColorControls: boolean
  vignetteIntensity: boolean
  // Map tab — pins
  pinControls: boolean
  // Text tab
  logoUploadArea: boolean
  logoExistingControls: boolean
  logoPositionControls: boolean
  trailSegmentsCard: boolean
  trailLegendControls: boolean
  waterCard: boolean
  waterColorControl: boolean
  waterBakedNotice: boolean
  waterThemeLockedNotice: boolean
  contourStyleControls: boolean
  effectsCard: boolean
  vignetteControls: boolean
  grainControl: boolean
  terrainCard: boolean
  terrain3dControls: boolean
  gridControls: boolean
  globalColorControls: boolean
  typographyControls: boolean
  frameControls: boolean
}

export function computeSectionVisibility(input: GatingInput): SectionVisibility {
  const hasLogo = !!(input.logoUrl && input.logoUrl.length > 0) || (input.logoAssetCount ?? 0) > 0
  const controls = getVisibleStyleControls(input.preset)
  const graph = getPresetGraph(input.preset)
  const isAtlasPreset = graph.preset.startsWith('radmaps-')
  const isVisible = (field: keyof StyleConfig) => controls[field]?.visible === true
  const hasThemeAllowlist = Array.isArray(input.editableFields)
  const themeAllows = (field: ThemeEditableField) => !hasThemeAllowlist || input.editableFields!.includes(field)
  const routeColorControl = input.hasRoute && themeAllows('route_color')
  const routeWidthControl = input.hasRoute && !hasThemeAllowlist
  const routeOpacityControl = input.hasRoute && !hasThemeAllowlist
  const routeAdvancedControls = input.hasRoute && !hasThemeAllowlist
  const contourToggle = isVisible('show_contours') && themeAllows('show_contours')
  const contourStyleControls = !hasThemeAllowlist
  const hillshadeToggle = isVisible('show_hillshade') && themeAllows('show_hillshade')
  const roadsToggle = isVisible('show_roads') && themeAllows('show_roads')
  const placeLabelsToggle = isVisible('show_place_labels') && themeAllows('show_place_labels')
  const poiToggle = isVisible('show_poi_labels') && themeAllows('show_poi_labels')
  const waterColorControl = isVisible('water_color') && !hasThemeAllowlist
  const rasterEffectControls = isVisible('tile_effect') && !hasThemeAllowlist
  const gridControls = !hasThemeAllowlist
  const globalColorControls = !hasThemeAllowlist
  const typographyControls = !hasThemeAllowlist
  const frameControls = !hasThemeAllowlist
  const terrain3dControls = !hasThemeAllowlist
  const contourActive = styleGraphUsesContours({
    preset: graph.preset,
    show_contours: input.showContours,
  })
  const roadsExpanded = input.showRoads && !hasThemeAllowlist && (isVisible('roads_color') || isVisible('roads_opacity'))
  const placeLabelDetails = input.showRoads && input.showRoads && !hasThemeAllowlist && isVisible('place_labels_color')
  const poiDetails = input.showRoads && !hasThemeAllowlist && isVisible('poi_labels_color')
  const waterFeature = graph.features.water
  const mapDetailCard = !isAtlasPreset && (roadsToggle
    || (!hasThemeAllowlist && isVisible('roads_color'))
    || placeLabelsToggle
    || poiToggle)
  const elevationProfileToggle = input.hasElevationData && input.hasRoute && themeAllows('show_elevation_profile')
  const elevationProfileExpanded = input.showElevationProfile && input.hasRoute && input.hasElevationData && themeAllows('show_elevation_profile')
  const effectsCard = rasterEffectControls || !hasThemeAllowlist
  const trailSegmentsCard = input.hasRoute
  const trailLegendControls = trailSegmentsCard && input.trailSegmentCount > 0

  return {
    // Quick tab
    routeLineQuick: input.hasRoute && (routeColorControl || routeWidthControl),
    routeColorControl,
    routeWidthControl,
    routeOpacityControl,
    routeAdvancedControls,

    // Map tab
    minimalistTileStyles: input.preset === 'minimalist',
    naturalTopoTileStyles: input.preset === 'natural-topo',
    routeMapCard: input.hasRoute,
    hillshadeToggle,
    hillshadeDetails: input.showHillshade && hillshadeToggle,
    contourToggle,
    contourDetails: contourActive && (contourStyleControls || contourToggle),
    mapDetailCard,
    roadsToggle,
    roadColorControl: isVisible('roads_color') && !hasThemeAllowlist,
    roadOpacityControl: isVisible('roads_opacity') && !hasThemeAllowlist,
    placeLabelsToggle,
    placeLabelDetails,
    poiToggle,
    poiDetails,
    roadsExpanded,
    elevationProfileToggle,
    elevationProfileExpanded,
    rasterEffectControls,
    tonerVariantControls: isVisible('toner_variant') && !hasThemeAllowlist,
    duotoneControls: isVisible('tile_duotone_strength') && input.tileEffect === 'duotone' && !hasThemeAllowlist,
    posterizeControls: isVisible('tile_posterize_levels') && input.tileEffect === 'posterize' && !hasThemeAllowlist,
    layerColorControls: isVisible('tile_shadow_color') && input.tileEffect === 'layer-color' && !hasThemeAllowlist,
    vignetteIntensity: input.showVignette && !hasThemeAllowlist,

    // Pins
    pinControls: !hasThemeAllowlist && (input.showStartPin || input.showFinishPin),

    // Text tab
    logoUploadArea: !hasLogo,
    logoExistingControls: hasLogo,
    logoPositionControls: hasLogo && input.showLogo,
    trailSegmentsCard,
    trailLegendControls,
    waterCard: !isAtlasPreset && (waterColorControl || waterFeature === 'baked-raster' || waterFeature === 'required'),
    waterColorControl,
    waterBakedNotice: waterFeature === 'baked-raster',
    waterThemeLockedNotice: waterFeature === 'required',
    contourStyleControls,
    effectsCard,
    vignetteControls: !hasThemeAllowlist,
    grainControl: !hasThemeAllowlist,
    terrainCard: terrain3dControls || hillshadeToggle || (input.showHillshade && hillshadeToggle),
    terrain3dControls,
    gridControls,
    globalColorControls,
    typographyControls,
    frameControls,
  }
}
