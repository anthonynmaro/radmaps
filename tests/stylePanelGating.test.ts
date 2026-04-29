import { describe, it, expect } from 'vitest'
import { computeSectionVisibility, type GatingInput } from '../utils/stylePanelGating'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Baseline: a map with a route, plain preset, all toggles off, no extras */
const base: GatingInput = {
  hasRoute: true,
  hasElevationData: false,
  preset: 'minimalist',
  showHillshade: false,
  showContours: false,
  tileEffect: 'none',
  showVignette: false,
  logoUrl: undefined,
  showLogo: false,
  trailSegmentCount: 0,
  showRoads: false,
  showElevationProfile: false,
  showStartPin: true,
  showFinishPin: true,
}

function vis(overrides: Partial<GatingInput>) {
  return computeSectionVisibility({ ...base, overrides } as unknown as GatingInput)
}

// Proper override helper
function compute(overrides: Partial<GatingInput>) {
  return computeSectionVisibility({ ...base, ...overrides })
}

// ── Route sections ─────────────────────────────────────────────────────────────

describe('routeLineQuick — Quick-tab route line card', () => {
  it('shows when hasRoute is true', () => {
    expect(compute({ hasRoute: true }).routeLineQuick).toBe(true)
  })

  it('hides when hasRoute is false', () => {
    expect(compute({ hasRoute: false }).routeLineQuick).toBe(false)
  })
})

describe('routeMapCard — Map-tab route card', () => {
  it('shows when hasRoute is true', () => {
    expect(compute({ hasRoute: true }).routeMapCard).toBe(true)
  })

  it('hides when hasRoute is false', () => {
    expect(compute({ hasRoute: false }).routeMapCard).toBe(false)
  })
})

describe('trailSegmentsCard — Text-tab trail segments card', () => {
  it('shows when hasRoute is true', () => {
    expect(compute({ hasRoute: true }).trailSegmentsCard).toBe(true)
  })

  it('hides when hasRoute is false', () => {
    expect(compute({ hasRoute: false }).trailSegmentsCard).toBe(false)
  })

  it('all three route sections gate together on hasRoute', () => {
    const noRoute = compute({ hasRoute: false })
    expect(noRoute.routeLineQuick).toBe(false)
    expect(noRoute.routeMapCard).toBe(false)
    expect(noRoute.trailSegmentsCard).toBe(false)

    const withRoute = compute({ hasRoute: true })
    expect(withRoute.routeLineQuick).toBe(true)
    expect(withRoute.routeMapCard).toBe(true)
    expect(withRoute.trailSegmentsCard).toBe(true)
  })
})

// ── Preset tile-style pickers ──────────────────────────────────────────────────

describe('minimalistTileStyles', () => {
  it('shows under minimalist preset', () => {
    expect(compute({ preset: 'minimalist' }).minimalistTileStyles).toBe(true)
  })

  it('hides under topographic preset', () => {
    expect(compute({ preset: 'topographic' }).minimalistTileStyles).toBe(false)
  })

  it('hides under natural-topo preset', () => {
    expect(compute({ preset: 'natural-topo' }).minimalistTileStyles).toBe(false)
  })

  it('hides under route-only preset', () => {
    expect(compute({ preset: 'route-only' }).minimalistTileStyles).toBe(false)
  })
})

describe('naturalTopoTileStyles', () => {
  it('shows under natural-topo preset', () => {
    expect(compute({ preset: 'natural-topo' }).naturalTopoTileStyles).toBe(true)
  })

  it('hides under minimalist preset', () => {
    expect(compute({ preset: 'minimalist' }).naturalTopoTileStyles).toBe(false)
  })

  it('hides under topographic preset', () => {
    expect(compute({ preset: 'topographic' }).naturalTopoTileStyles).toBe(false)
  })

  it('exactly one tile-style picker is visible at a time for known presets', () => {
    const minimalist = compute({ preset: 'minimalist' })
    expect(minimalist.minimalistTileStyles).toBe(true)
    expect(minimalist.naturalTopoTileStyles).toBe(false)

    const naturalTopo = compute({ preset: 'natural-topo' })
    expect(naturalTopo.minimalistTileStyles).toBe(false)
    expect(naturalTopo.naturalTopoTileStyles).toBe(true)

    const topographic = compute({ preset: 'topographic' })
    expect(topographic.minimalistTileStyles).toBe(false)
    expect(topographic.naturalTopoTileStyles).toBe(false)
  })
})

// ── Terrain sub-sections ───────────────────────────────────────────────────────

describe('hillshadeDetails', () => {
  it('shows when showHillshade is true', () => {
    expect(compute({ showHillshade: true }).hillshadeDetails).toBe(true)
  })

  it('hides when showHillshade is false', () => {
    expect(compute({ showHillshade: false }).hillshadeDetails).toBe(false)
  })
})

describe('contourDetails', () => {
  it('shows when showContours is true', () => {
    expect(compute({ showContours: true }).contourDetails).toBe(true)
  })

  it('hides when showContours is false', () => {
    expect(compute({ showContours: false }).contourDetails).toBe(false)
  })

  it('hillshade and contour details are independent', () => {
    const both = compute({ showHillshade: true, showContours: true })
    expect(both.hillshadeDetails).toBe(true)
    expect(both.contourDetails).toBe(true)

    const neitherOn = compute({ showHillshade: false, showContours: false })
    expect(neitherOn.hillshadeDetails).toBe(false)
    expect(neitherOn.contourDetails).toBe(false)

    const onlyHillshade = compute({ showHillshade: true, showContours: false })
    expect(onlyHillshade.hillshadeDetails).toBe(true)
    expect(onlyHillshade.contourDetails).toBe(false)

    const onlyContours = compute({ showHillshade: false, showContours: true })
    expect(onlyContours.hillshadeDetails).toBe(false)
    expect(onlyContours.contourDetails).toBe(true)
  })
})

// ── Tile-effect sub-sections ───────────────────────────────────────────────────

describe('duotoneControls', () => {
  it('shows when tileEffect is duotone', () => {
    expect(compute({ tileEffect: 'duotone' }).duotoneControls).toBe(true)
  })

  it('hides for other effects', () => {
    expect(compute({ tileEffect: 'none' }).duotoneControls).toBe(false)
    expect(compute({ tileEffect: 'posterize' }).duotoneControls).toBe(false)
    expect(compute({ tileEffect: 'layer-color' }).duotoneControls).toBe(false)
  })

  it('hides when tileEffect is undefined', () => {
    expect(compute({ tileEffect: undefined }).duotoneControls).toBe(false)
  })
})

describe('posterizeControls', () => {
  it('shows when tileEffect is posterize', () => {
    expect(compute({ tileEffect: 'posterize' }).posterizeControls).toBe(true)
  })

  it('hides for other effects', () => {
    expect(compute({ tileEffect: 'none' }).posterizeControls).toBe(false)
    expect(compute({ tileEffect: 'duotone' }).posterizeControls).toBe(false)
    expect(compute({ tileEffect: 'layer-color' }).posterizeControls).toBe(false)
  })
})

describe('layerColorControls', () => {
  it('shows when tileEffect is layer-color', () => {
    expect(compute({ tileEffect: 'layer-color' }).layerColorControls).toBe(true)
  })

  it('hides for other effects', () => {
    expect(compute({ tileEffect: 'none' }).layerColorControls).toBe(false)
    expect(compute({ tileEffect: 'duotone' }).layerColorControls).toBe(false)
    expect(compute({ tileEffect: 'posterize' }).layerColorControls).toBe(false)
  })
})

describe('tile effect sections — mutual exclusivity', () => {
  it('only one effect sub-section is visible at a time', () => {
    const effects = ['none', 'duotone', 'posterize', 'layer-color'] as const
    for (const active of effects) {
      const s = compute({ tileEffect: active })
      const activeCount = [s.duotoneControls, s.posterizeControls, s.layerColorControls].filter(Boolean).length
      expect(activeCount).toBe(active === 'none' ? 0 : 1)
    }
  })
})

// ── Vignette ───────────────────────────────────────────────────────────────────

describe('vignetteIntensity', () => {
  it('shows when showVignette is true', () => {
    expect(compute({ showVignette: true }).vignetteIntensity).toBe(true)
  })

  it('hides when showVignette is false', () => {
    expect(compute({ showVignette: false }).vignetteIntensity).toBe(false)
  })
})

// ── Logo section ───────────────────────────────────────────────────────────────

describe('logoUploadArea vs logoExistingControls — mutual exclusivity', () => {
  it('shows upload area when no logo URL', () => {
    const s = compute({ logoUrl: undefined, showLogo: false })
    expect(s.logoUploadArea).toBe(true)
    expect(s.logoExistingControls).toBe(false)
  })

  it('shows existing controls when logo URL is set', () => {
    const s = compute({ logoUrl: 'https://cdn.example.com/logo.png', showLogo: false })
    expect(s.logoUploadArea).toBe(false)
    expect(s.logoExistingControls).toBe(true)
  })

  it('treats empty string as no logo', () => {
    const s = compute({ logoUrl: '', showLogo: false })
    expect(s.logoUploadArea).toBe(true)
    expect(s.logoExistingControls).toBe(false)
  })

  it('upload area and existing controls are never both true simultaneously', () => {
    const scenarios: Array<Partial<GatingInput>> = [
      { logoUrl: undefined },
      { logoUrl: '' },
      { logoUrl: 'https://example.com/img.png' },
    ]
    for (const overrides of scenarios) {
      const s = compute(overrides)
      expect(s.logoUploadArea && s.logoExistingControls).toBe(false)
    }
  })
})

describe('logoPositionControls', () => {
  it('shows when logo is uploaded AND show_logo is true', () => {
    expect(compute({ logoUrl: 'https://cdn.example.com/logo.png', showLogo: true }).logoPositionControls).toBe(true)
  })

  it('hides when logo is uploaded but show_logo is false', () => {
    expect(compute({ logoUrl: 'https://cdn.example.com/logo.png', showLogo: false }).logoPositionControls).toBe(false)
  })

  it('hides when no logo URL regardless of showLogo', () => {
    expect(compute({ logoUrl: undefined, showLogo: true }).logoPositionControls).toBe(false)
    expect(compute({ logoUrl: '', showLogo: true }).logoPositionControls).toBe(false)
  })
})

// ── Trail legend ───────────────────────────────────────────────────────────────

describe('trailLegendControls', () => {
  it('hides when no trail segments exist', () => {
    expect(compute({ trailSegmentCount: 0 }).trailLegendControls).toBe(false)
  })

  it('shows when at least one segment exists', () => {
    expect(compute({ trailSegmentCount: 1 }).trailLegendControls).toBe(true)
    expect(compute({ trailSegmentCount: 5 }).trailLegendControls).toBe(true)
  })
})

// ── Always-visible sections (smoke test — never gated) ─────────────────────────

describe('always-visible sections are not accidentally gated', () => {
  it('tile effect enum controls only care about tileEffect — not hasRoute or toggles', () => {
    const noRoute = compute({ hasRoute: false, tileEffect: 'duotone' })
    expect(noRoute.duotoneControls).toBe(true)
  })

  it('hillshade does not depend on hasRoute', () => {
    expect(compute({ hasRoute: false, showHillshade: true }).hillshadeDetails).toBe(true)
  })

  it('contour does not depend on hasRoute', () => {
    expect(compute({ hasRoute: false, showContours: true }).contourDetails).toBe(true)
  })

  it('vignette does not depend on hasRoute', () => {
    expect(compute({ hasRoute: false, showVignette: true }).vignetteIntensity).toBe(true)
  })
})

// ── Combinatorial edge cases ───────────────────────────────────────────────────

describe('combined state snapshots', () => {
  it('fresh map (no route, no logo, all off) hides expected sections', () => {
    const s = compute({
      hasRoute: false,
      showHillshade: false,
      showContours: false,
      showVignette: false,
      tileEffect: 'none',
      logoUrl: undefined,
      showLogo: false,
      trailSegmentCount: 0,
      preset: 'minimalist',
    })
    expect(s.routeLineQuick).toBe(false)
    expect(s.routeMapCard).toBe(false)
    expect(s.trailSegmentsCard).toBe(false)
    expect(s.hillshadeDetails).toBe(false)
    expect(s.contourDetails).toBe(false)
    expect(s.duotoneControls).toBe(false)
    expect(s.posterizeControls).toBe(false)
    expect(s.layerColorControls).toBe(false)
    expect(s.vignetteIntensity).toBe(false)
    expect(s.logoUploadArea).toBe(true)
    expect(s.logoExistingControls).toBe(false)
    expect(s.logoPositionControls).toBe(false)
    expect(s.trailLegendControls).toBe(false)
    expect(s.minimalistTileStyles).toBe(true)
    expect(s.naturalTopoTileStyles).toBe(false)
  })

  it('fully-configured map exposes all relevant sections', () => {
    const s = compute({
      hasRoute: true,
      showHillshade: true,
      showContours: true,
      showVignette: true,
      tileEffect: 'duotone',
      logoUrl: 'https://cdn.example.com/logo.png',
      showLogo: true,
      trailSegmentCount: 3,
      preset: 'topographic',
    })
    expect(s.routeLineQuick).toBe(true)
    expect(s.routeMapCard).toBe(true)
    expect(s.trailSegmentsCard).toBe(true)
    expect(s.hillshadeDetails).toBe(true)
    expect(s.contourDetails).toBe(true)
    expect(s.duotoneControls).toBe(true)
    expect(s.vignetteIntensity).toBe(true)
    expect(s.logoUploadArea).toBe(false)
    expect(s.logoExistingControls).toBe(true)
    expect(s.logoPositionControls).toBe(true)
    expect(s.trailLegendControls).toBe(true)
    // topographic preset: neither tile picker shows
    expect(s.minimalistTileStyles).toBe(false)
    expect(s.naturalTopoTileStyles).toBe(false)
  })
})

// ── Additional coverage ────────────────────────────────────────────────────────

describe('pinControls', () => {
  it('hides when both start and finish pins are off', () => {
    expect(compute({ showStartPin: false, showFinishPin: false }).pinControls).toBe(false)
  })

  it('shows when only start pin is on', () => {
    expect(compute({ showStartPin: true, showFinishPin: false }).pinControls).toBe(true)
  })

  it('shows when only finish pin is on', () => {
    expect(compute({ showStartPin: false, showFinishPin: true }).pinControls).toBe(true)
  })

  it('shows when both pins are on', () => {
    expect(compute({ showStartPin: true, showFinishPin: true }).pinControls).toBe(true)
  })
})

describe('logoPositionControls — additional', () => {
  it('returns false when logoUrl is a URL but showLogo is false', () => {
    const s = compute({ logoUrl: 'https://cdn.example.com/logo.png', showLogo: false })
    expect(s.logoPositionControls).toBe(false)
  })

  it('returns true only when BOTH logoUrl is set AND showLogo is true', () => {
    const both = compute({ logoUrl: 'https://cdn.example.com/logo.png', showLogo: true })
    expect(both.logoPositionControls).toBe(true)
    const noUrl = compute({ logoUrl: undefined, showLogo: true })
    expect(noUrl.logoPositionControls).toBe(false)
  })
})

describe('elevationProfileToggle and elevationProfileExpanded boundary conditions', () => {
  it('toggle hides when hasElevationData is false even with a route', () => {
    expect(compute({ hasRoute: true, hasElevationData: false }).elevationProfileToggle).toBe(false)
  })

  it('toggle hides when hasRoute is false even with elevation data', () => {
    expect(compute({ hasRoute: false, hasElevationData: true }).elevationProfileToggle).toBe(false)
  })

  it('toggle shows only when both hasRoute and hasElevationData are true', () => {
    expect(compute({ hasRoute: true, hasElevationData: true }).elevationProfileToggle).toBe(true)
  })

  it('expanded hides when showElevationProfile is false', () => {
    const s = compute({ hasRoute: true, hasElevationData: true, showElevationProfile: false })
    expect(s.elevationProfileExpanded).toBe(false)
  })

  it('expanded shows when all three conditions met', () => {
    const s = compute({ hasRoute: true, hasElevationData: true, showElevationProfile: true })
    expect(s.elevationProfileExpanded).toBe(true)
  })
})

describe('trailLegendControls — boundary at segment count', () => {
  it('hides at 0 segments', () => {
    expect(compute({ trailSegmentCount: 0 }).trailLegendControls).toBe(false)
  })

  it('shows at exactly 1 segment', () => {
    expect(compute({ trailSegmentCount: 1 }).trailLegendControls).toBe(true)
  })

  it('shows at many segments', () => {
    expect(compute({ trailSegmentCount: 10 }).trailLegendControls).toBe(true)
  })
})

describe('preset matrix — tile style pickers', () => {
  const presetsWithNoTilePicker = ['topographic', 'route-only', 'road-network', 'contour-art'] as const

  it('only minimalist shows minimalistTileStyles', () => {
    expect(compute({ preset: 'minimalist' }).minimalistTileStyles).toBe(true)
    for (const p of presetsWithNoTilePicker) {
      expect(compute({ preset: p }).minimalistTileStyles).toBe(false)
    }
  })

  it('only natural-topo shows naturalTopoTileStyles', () => {
    expect(compute({ preset: 'natural-topo' }).naturalTopoTileStyles).toBe(true)
    for (const p of presetsWithNoTilePicker) {
      expect(compute({ preset: p }).naturalTopoTileStyles).toBe(false)
    }
  })
})
