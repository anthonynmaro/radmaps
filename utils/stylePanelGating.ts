/**
 * Pure functions encoding all StylePanel section-visibility rules.
 * Kept separate so they can be unit-tested without a DOM or Vue runtime.
 *
 * The template uses a `sections` computed that calls `computeSectionVisibility`,
 * so these functions are the single source of truth for every v-if in the panel.
 */

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
  hillshadeDetails: boolean
  contourDetails: boolean
  roadsExpanded: boolean
  elevationProfileToggle: boolean   // show/hide the toggle itself
  elevationProfileExpanded: boolean // show sub-controls when enabled
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
}

export function computeSectionVisibility(input: GatingInput): SectionVisibility {
  const hasLogo = !!(input.logoUrl && input.logoUrl.length > 0)

  return {
    // Quick tab
    routeLineQuick: input.hasRoute,

    // Map tab
    minimalistTileStyles: input.preset === 'minimalist',
    naturalTopoTileStyles: input.preset === 'natural-topo',
    routeMapCard: input.hasRoute,
    hillshadeDetails: input.showHillshade,
    contourDetails: input.showContours,
    roadsExpanded: input.showRoads,
    elevationProfileToggle: input.hasElevationData && input.hasRoute,
    elevationProfileExpanded: input.showElevationProfile && input.hasRoute && input.hasElevationData,
    duotoneControls: input.tileEffect === 'duotone',
    posterizeControls: input.tileEffect === 'posterize',
    layerColorControls: input.tileEffect === 'layer-color',
    vignetteIntensity: input.showVignette,

    // Pins
    pinControls: input.showStartPin || input.showFinishPin,

    // Text tab
    logoUploadArea: !hasLogo,
    logoExistingControls: hasLogo,
    logoPositionControls: hasLogo && input.showLogo,
    trailSegmentsCard: input.hasRoute,
    trailLegendControls: input.trailSegmentCount > 0,
  }
}
