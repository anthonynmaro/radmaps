/**
 * Pure functions encoding all StylePanel section-visibility rules.
 * Kept separate so they can be unit-tested without a DOM or Vue runtime.
 *
 * The template uses a `sections` computed that calls `computeSectionVisibility`,
 * so these functions are the single source of truth for every v-if in the panel.
 */

import type { StyleConfig } from '~/types'
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
}

export interface SectionVisibility {
  // Quick tab
  routeLineQuick: boolean
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
}

export function computeSectionVisibility(input: GatingInput): SectionVisibility {
  const hasLogo = !!(input.logoUrl && input.logoUrl.length > 0) || (input.logoAssetCount ?? 0) > 0
  const controls = getVisibleStyleControls(input.preset)
  const graph = getPresetGraph(input.preset)
  const isVisible = (field: keyof StyleConfig) => controls[field]?.visible === true
  const contourActive = styleGraphUsesContours({
    preset: graph.preset,
    show_contours: input.showContours,
  })
  const roadsExpanded = input.showRoads && (isVisible('roads_color') || isVisible('roads_opacity'))
  const placeLabelDetails = input.showRoads && input.showRoads && isVisible('place_labels_color')
  const poiDetails = input.showRoads && isVisible('poi_labels_color')
  const waterFeature = graph.features.water
  const waterColorControl = isVisible('water_color')
  const mapDetailCard = isVisible('show_roads')
    || isVisible('roads_color')
    || isVisible('show_place_labels')
    || isVisible('show_poi_labels')

  return {
    // Quick tab
    routeLineQuick: input.hasRoute,

    // Map tab
    minimalistTileStyles: input.preset === 'minimalist',
    naturalTopoTileStyles: input.preset === 'natural-topo',
    routeMapCard: input.hasRoute,
    hillshadeToggle: isVisible('show_hillshade'),
    hillshadeDetails: input.showHillshade,
    contourToggle: isVisible('show_contours'),
    contourDetails: contourActive,
    mapDetailCard,
    roadsToggle: isVisible('show_roads'),
    roadColorControl: isVisible('roads_color'),
    roadOpacityControl: isVisible('roads_opacity'),
    placeLabelsToggle: isVisible('show_place_labels'),
    placeLabelDetails,
    poiToggle: isVisible('show_poi_labels'),
    poiDetails,
    roadsExpanded,
    elevationProfileToggle: input.hasElevationData && input.hasRoute,
    elevationProfileExpanded: input.showElevationProfile && input.hasRoute && input.hasElevationData,
    rasterEffectControls: isVisible('tile_effect'),
    duotoneControls: isVisible('tile_duotone_strength') && input.tileEffect === 'duotone',
    posterizeControls: isVisible('tile_posterize_levels') && input.tileEffect === 'posterize',
    layerColorControls: isVisible('tile_shadow_color') && input.tileEffect === 'layer-color',
    vignetteIntensity: input.showVignette,

    // Pins
    pinControls: input.showStartPin || input.showFinishPin,

    // Text tab
    logoUploadArea: !hasLogo,
    logoExistingControls: hasLogo,
    logoPositionControls: hasLogo && input.showLogo,
    trailSegmentsCard: input.hasRoute,
    trailLegendControls: input.trailSegmentCount > 0,
    waterCard: waterColorControl || waterFeature === 'baked-raster' || waterFeature === 'required',
    waterColorControl,
    waterBakedNotice: waterFeature === 'baked-raster',
    waterThemeLockedNotice: waterFeature === 'required',
  }
}
