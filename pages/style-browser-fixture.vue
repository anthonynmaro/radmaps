<template>
  <main class="min-h-screen bg-stone-200 p-6">
    <div v-if="themePickerFixture && !themePickerClosed" class="mx-auto bg-stone-100" :style="editorSurfaceFrameStyle">
      <ThemeLineupStep
        :model-value="styleConfig"
        :map="sampleMap"
        @apply-theme="onThemePickerApply"
        @design-myself="themePickerClosed = true"
      />
    </div>
    <div v-else-if="templateEditorFixture" class="mx-auto bg-stone-100" :style="templateEditorFrameStyle">
      <FixedPosterTemplateEditor
        v-model="styleConfig"
        :map="sampleMap"
      />
    </div>
    <div v-else-if="surfaceFixture" class="mx-auto bg-stone-100" :style="editorSurfaceFrameStyle">
      <MapEditorSurface
        v-model="styleConfig"
        :map="sampleMap"
        :saving="false"
      />
    </div>
    <div v-else class="mx-auto" :style="fixtureFrameStyle">
      <MapPreview
        :map="sampleMap"
        :style-config="styleConfig"
        :editable="editable"
        :chrome-editing="chromeEditing"
        :poster-elements-editing="posterElementsEditor"
        :poster-tier2-editor="posterTier2Editor"
        :poster-editor-mode="posterEditorMode"
        :poster-guides-visible="posterGuidesVisible"
        :selected-poster-element-id="selectedPosterElementId"
        :editable-text-slots="posterEditableTextSlots"
        :guided-poster-editor="posterElementsEditor"
        :render-mode="renderMode"
        :print-context="printContext"
        @overlay-updated="onOverlayUpdated"
        @asset-moved="onAssetMoved"
        @poster-element-selected="selectedPosterElementId = $event"
        @poster-element-patched="onPosterElementPatched"
        @poster-text-override="onPosterTextOverride"
        @poster-text-reset="onPosterTextReset"
        @poster-layout-updated="onPosterLayoutUpdated"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import MapEditorSurface from '~/components/map/MapEditorSurface.vue'
import MapPreview from '~/components/map/MapPreview.vue'
import FixedPosterTemplateEditor from '~/components/map/FixedPosterTemplateEditor.vue'
import ThemeLineupStep from '~/components/map/ThemeLineupStep.vue'
import { DEFAULT_STYLE_CONFIG, type PartialPosterLayout, type PosterTextOverride, type PosterTextSlot, type RouteStats, type StyleConfig, type TextOverlay, type TonerVariant, type TrailMap } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'
import { COMPOSITION_OPTIONS } from '~/utils/posterCompositions'
import { getPrintFraming, type RenderClass } from '~/utils/print/printFraming'
import { patchPosterEditorElement, type PosterEditorElementPatch } from '~/utils/posterEditorElements'
import { posterEditorAllowlistForStyle } from '~/utils/posterEditorAllowlist'
import { SAMPLE_REGIONS } from '~/utils/styleBrowserFixtures'

definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const route = useRoute()

// Playwright determinism: `?flags=editor_v2,foo` enables only those flags;
// omitted `flags` and explicit `?flags=` both mean no flags. This keeps the
// dev-only fixture independent from local/Supabase flag rows on both SSR and
// client render.
const fixtureFlags = typeof route.query.flags === 'string' ? route.query.flags : ''
const flagState = useState<Record<string, true>>('feature-flags', () => ({}))
flagState.value = Object.fromEntries(
  fixtureFlags.split(',').map(key => key.trim()).filter(Boolean).map(key => [key, true as const]),
)
const templateEditorFixture = route.query.templateEditor === 'true'
  || route.query.templateEditor === '1'
const composition = typeof route.query.composition === 'string'
  ? route.query.composition
  : 'editorial-tall'
const themeId = typeof route.query.theme === 'string'
  ? route.query.theme
  : 'editorial-minimal'
const preset = typeof route.query.preset === 'string'
  ? route.query.preset as StyleConfig['preset']
  : undefined
const region = typeof route.query.region === 'string'
  ? route.query.region
  : 'chicago'
const routeShape = typeof route.query.routeShape === 'string'
  ? route.query.routeShape
  : region
const gridScope = route.query.gridScope === 'map' || route.query.gridScope === 'poster'
  ? route.query.gridScope
  : undefined
const width = typeof route.query.width === 'string' ? Number.parseInt(route.query.width, 10) : 520
const height = typeof route.query.height === 'string' ? Number.parseInt(route.query.height, 10) : 780
const printRenderClass: RenderClass | null = route.query.print === 'proof' || route.query.print === 'final'
  ? route.query.print
  : null
const renderMode = printRenderClass ? 'print' : 'editor'
const printScale = typeof route.query.printScale === 'string' ? Number.parseFloat(route.query.printScale) : 10
const editable = route.query.editable === 'true' || route.query.editable === '1'
const chromeEditing = route.query.chrome === 'true' || route.query.chrome === '1'
const posterElementsEditor = route.query.posterEditor === 'true' || route.query.posterEditor === '1'
const posterTier2Editor = posterElementsEditor && (route.query.posterTier2 === 'true' || route.query.posterTier2 === '1' || route.query.tier2Editor === 'true' || route.query.tier2Editor === '1')
const posterEditorMode = typeof route.query.posterMode === 'string'
  ? route.query.posterMode as 'layout' | 'select' | 'text' | 'image' | 'icon' | 'guides'
  : 'layout'
const posterGuidesVisible = posterEditorMode === 'guides' || queryFlag(route.query.guides, false)
const surfaceFixture = route.query.surface === 'true' || route.query.surface === '1'
const themePickerFixture = route.query.themePicker === 'true' || route.query.themePicker === '1'
const withUnsafeOverlay = route.query.unsafeOverlay === 'true' || route.query.unsafeOverlay === '1'
const withSafeOverlay = route.query.safeOverlay === 'true' || route.query.safeOverlay === '1'
const withOverlay = route.query.overlay === 'true' || route.query.overlay === '1' || withUnsafeOverlay || withSafeOverlay
const withAsset = route.query.asset === 'true' || route.query.asset === '1' || withUnsafeOverlay || withSafeOverlay
const withIcon = route.query.icon === 'true' || route.query.icon === '1'
const withPins = route.query.pins === 'true' || route.query.pins === '1'
const withElevationData = route.query.elevation === 'true' || route.query.elevation === '1'
const withRoute = route.query.route !== 'false' && route.query.route !== '0'
const hasFixtureRoadsOverride = hasQueryFlag(route.query.roads)
const hasFixtureLabelsOverride = hasQueryFlag(route.query.labels)
const hasFixturePoisOverride = hasQueryFlag(route.query.pois)
const showFixtureRoads = queryFlag(route.query.roads, false)
const showFixtureLabels = queryFlag(route.query.labels, false)
const showFixturePois = queryFlag(route.query.pois, false)
const fixtureTonerVariant = parseTonerVariant(route.query.tonerVariant)
const fixtureTrailName = typeof route.query.title === 'string' ? route.query.title : undefined
const fixtureLocationText = typeof route.query.location === 'string' ? route.query.location : undefined
const fixtureOccasionText = typeof route.query.occasion === 'string' ? route.query.occasion : undefined
const fixtureCompositionKickerText = typeof route.query.compositionKicker === 'string' ? route.query.compositionKicker : undefined
const fixtureCompositionMetaText = typeof route.query.compositionMeta === 'string' ? route.query.compositionMeta : undefined
const fixtureCompositionFooterText = typeof route.query.compositionFooter === 'string' ? route.query.compositionFooter : undefined
const fixtureDistanceKm = typeof route.query.distanceKm === 'string'
  ? Number.parseFloat(route.query.distanceKm)
  : undefined
const fixtureGainM = typeof route.query.gainM === 'string'
  ? Number.parseFloat(route.query.gainM)
  : undefined
const fixtureDurationSeconds = typeof route.query.durationSeconds === 'string'
  ? Number.parseFloat(route.query.durationSeconds)
  : undefined
const fixtureDate = typeof route.query.date === 'string' ? route.query.date : undefined

const theme = getThemeDefinition(themeId)
const selectedComposition = COMPOSITION_OPTIONS.some(option => option.id === composition)
  ? composition as NonNullable<StyleConfig['composition']>
  : 'editorial-tall'

const baseConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  trail_name: 'Kickapoo Endurance Race',
  location_text: 'Kickapoo State Park',
  occasion_text: 'Complete trail network',
  labels: {
    ...DEFAULT_STYLE_CONFIG.labels,
    show_date: true,
  },
  show_roads: showFixtureRoads,
  show_place_labels: showFixtureLabels,
  show_poi_labels: showFixturePois,
  show_contours: true,
  show_start_pin: withPins,
  show_finish_pin: withPins,
  map_frozen: false,
}

const initialStyleConfig: StyleConfig = {
  ...baseConfig,
  ...(theme
    ? {
        color_theme: theme.id,
        background_color: theme.background_color,
        label_bg_color: theme.label_bg_color,
        label_text_color: theme.label_text_color,
        route_color: theme.route_color,
        water_color: theme.water_color,
        land_color: theme.land_color,
        base_tile_style: theme.base_tile_style,
        contour_color: theme.contour_color,
        contour_major_color: theme.contour_major_color,
        font_family: theme.font_family ?? baseConfig.font_family,
        body_font_family: theme.body_font_family ?? baseConfig.body_font_family,
        border_style: theme.border_style ?? baseConfig.border_style,
        tile_grain: theme.tile_grain ?? baseConfig.tile_grain,
        audience: theme.audience,
        dark: theme.dark,
        show_grid: theme.show_grid ?? theme.map_defaults?.show_grid ?? baseConfig.show_grid,
        grid_scope: gridScope ?? theme.map_defaults?.grid_scope ?? baseConfig.grid_scope,
        ...theme.map_defaults,
      }
    : {}),
  composition: selectedComposition,
  ...(preset ? { preset } : {}),
  ...(gridScope ? { show_grid: true, grid_scope: gridScope } : {}),
  ...(withOverlay
    ? {
        text_overlays: [{
          id: 'fixture-overlay-label',
          content: 'Concrete',
          x: withUnsafeOverlay ? 2 : withSafeOverlay ? 50 : 12,
          y: withUnsafeOverlay ? 2 : withSafeOverlay ? 50 : 65,
          font_size: withUnsafeOverlay ? 0.1 : withSafeOverlay ? 1 : 1.4,
          color: withUnsafeOverlay ? '#FFFFFF' : withSafeOverlay ? '#FFFFFF' : theme?.route_color ?? '#E85D75',
          font_family: theme?.body_font_family ?? baseConfig.body_font_family,
          alignment: 'left',
          opacity: 1,
          bold: true,
          italic: false,
          ...(withUnsafeOverlay ? { bg_color: '#FFFFFF' } : withSafeOverlay ? { bg_color: '#111111' } : {}),
        }],
      }
    : {}),
  ...(withAsset
    ? {
        image_overlays: [{
          id: 'fixture-logo-asset',
          kind: 'logo',
          source_url: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20160%2080%22%3E%3Crect%20width=%22160%22%20height=%2280%22%20rx=%2212%22%20fill=%22%23ffffff%22/%3E%3Ccircle%20cx=%2240%22%20cy=%2240%22%20r=%2222%22%20fill=%22%232D6A4F%22/%3E%3Cpath%20d=%22M86%2053l12-27%2012%2027%22%20fill=%22none%22%20stroke=%22%232D6A4F%22%20stroke-width=%228%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E',
          render_url: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20160%2080%22%3E%3Crect%20width=%22160%22%20height=%2280%22%20rx=%2212%22%20fill=%22%23ffffff%22/%3E%3Ccircle%20cx=%2240%22%20cy=%2240%22%20r=%2222%22%20fill=%22%232D6A4F%22/%3E%3Cpath%20d=%22M86%2053l12-27%2012%2027%22%20fill=%22none%22%20stroke=%22%232D6A4F%22%20stroke-width=%228%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E',
          mime_type: 'image/png',
          width_px: withUnsafeOverlay ? 800 : withSafeOverlay ? 2400 : 1600,
          height_px: withUnsafeOverlay ? 600 : withSafeOverlay ? 1600 : 800,
          file_size_bytes: 4096,
          x: withUnsafeOverlay ? 1 : withSafeOverlay ? 20 : 42,
          y: withUnsafeOverlay ? 1 : withSafeOverlay ? 30 : 48,
          width: withUnsafeOverlay ? 80 : withSafeOverlay ? 10 : 16,
          height: withUnsafeOverlay ? 60 : withSafeOverlay ? 8 : 5.33,
          rotation: 0,
          opacity: 1,
          z_index: 40,
          quality_status: 'excellent',
        }],
        show_logo: true,
      }
    : {}),
  ...(withIcon
    ? {
        icon_overlays: [{
          id: 'fixture-icon',
          icon: 'mountain',
          x: 62,
          y: 24,
          width: 9,
          height: 9,
          color: theme?.route_color ?? '#2D6A4F',
          opacity: 0.92,
          rotation: -8,
          z_index: 45,
          constrain_to_safe_area: true,
        }],
      }
    : {}),
}

const fixturePresetIsRadMapsToner = initialStyleConfig.preset === 'radmaps-toner'
  || initialStyleConfig.preset === 'radmaps-toner-light'
  || initialStyleConfig.preset === 'radmaps-toner-dark'
const hasFixtureLayerOverrides = showFixtureRoads || showFixtureLabels || showFixturePois
const baseFixtureLayerSettings = fixturePresetIsRadMapsToner ? undefined : initialStyleConfig.atlas_layer_settings
const fixtureLayerSettings: StyleConfig['atlas_layer_settings'] = {
  ...(baseFixtureLayerSettings ?? {}),
  ...(showFixtureRoads
    ? {
        transportation: {
          ...baseFixtureLayerSettings?.transportation,
          opacity: 0.9,
          show_major: true,
          show_minor: true,
          show_trails: true,
          major_width: 3.3,
          minor_width: 1.2,
          trail_width: 1.5,
          ...(fixturePresetIsRadMapsToner
            ? {}
            : {
                major_color: '#314256',
                minor_color: '#52677A',
                trail_color: '#2D6A4F',
              }),
        },
      }
    : {}),
  ...(showFixtureLabels
    ? {
        place: {
          ...baseFixtureLayerSettings?.place,
          label_opacity: 0.82,
          font_size: 13,
          ...(fixturePresetIsRadMapsToner
            ? {}
            : {
                label_color: '#263746',
                halo_color: initialStyleConfig.land_color ?? initialStyleConfig.background_color,
              }),
        },
      }
    : {}),
  ...(showFixturePois
    ? {
        poi: {
          ...baseFixtureLayerSettings?.poi,
          label_opacity: 0.74,
        },
      }
    : {}),
}
const fixtureQueryOverrides: Partial<StyleConfig> = {
  ...(hasFixtureRoadsOverride ? { show_roads: showFixtureRoads } : {}),
  ...(hasFixtureLabelsOverride ? { show_place_labels: showFixtureLabels } : {}),
  ...(hasFixturePoisOverride ? { show_poi_labels: showFixturePois } : {}),
  ...(fixtureTonerVariant ? { toner_variant: fixtureTonerVariant } : {}),
  ...(showFixtureRoads ? { roads_opacity: 0.9 } : {}),
  ...(hasFixtureLayerOverrides ? { atlas_layer_settings: fixtureLayerSettings } : {}),
}

const styleConfig = ref<StyleConfig>({
  ...initialStyleConfig,
  ...fixtureQueryOverrides,
  ...(fixtureTrailName ? { trail_name: fixtureTrailName } : {}),
  ...(fixtureLocationText ? { location_text: fixtureLocationText } : {}),
  ...(fixtureOccasionText ? { occasion_text: fixtureOccasionText } : {}),
  ...(fixtureCompositionKickerText || fixtureCompositionMetaText || fixtureCompositionFooterText
    ? {
        poster_text_overrides: {
          ...(initialStyleConfig.poster_text_overrides ?? {}),
          ...(fixtureCompositionKickerText
            ? {
                composition_kicker: {
                  ...(initialStyleConfig.poster_text_overrides?.composition_kicker ?? {}),
                  text: fixtureCompositionKickerText,
                },
              }
            : {}),
          ...(fixtureCompositionMetaText
            ? {
                composition_meta: {
                  ...(initialStyleConfig.poster_text_overrides?.composition_meta ?? {}),
                  text: fixtureCompositionMetaText,
                },
              }
            : {}),
          ...(fixtureCompositionFooterText
            ? {
                composition_footer: {
                  ...(initialStyleConfig.poster_text_overrides?.composition_footer ?? {}),
                  text: fixtureCompositionFooterText,
                },
              }
            : {}),
        },
      }
    : {}),
})
const posterEditableTextSlots = computed(() =>
  posterElementsEditor ? posterEditorAllowlistForStyle(styleConfig.value).textSlots : null,
)
const selectedPosterElementId = ref<string | null>(
  typeof route.query.selectedPosterElement === 'string' ? route.query.selectedPosterElement : null,
)
const themePickerClosed = ref(false)

function installStyleFixture() {
  ;(window as unknown as {
    __RADMAPS_STYLE_FIXTURE__?: {
      getStyle: () => StyleConfig
      setStyle: (patch: Partial<StyleConfig>) => void
      patchPosterElement: (id: string, patch: PosterEditorElementPatch) => void
    }
  }).__RADMAPS_STYLE_FIXTURE__ = {
    getStyle: () => styleConfig.value,
    setStyle: (patch) => {
      styleConfig.value = { ...styleConfig.value, ...patch }
    },
    patchPosterElement: (id, patch) => {
      onPosterElementPatched({ id, patch })
    },
  }
}

if (import.meta.client) installStyleFixture()

onMounted(() => {
  installStyleFixture()
})

onUnmounted(() => {
  delete (window as unknown as {
    __RADMAPS_STYLE_FIXTURE__?: {
      getStyle: () => StyleConfig
      setStyle: (patch: Partial<StyleConfig>) => void
      patchPosterElement: (id: string, patch: PosterEditorElementPatch) => void
    }
  }).__RADMAPS_STYLE_FIXTURE__
})

function onOverlayUpdated(payload: { id: string; patch: Partial<TextOverlay> }) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(overlay => overlay.id === payload.id ? { ...overlay, ...payload.patch } : overlay),
  }
}

function onAssetMoved(payload: { id: string; x: number; y: number }) {
  const assets = styleConfig.value.image_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    image_overlays: assets.map(asset => asset.id === payload.id ? { ...asset, x: payload.x, y: payload.y } : asset),
  }
}

function onPosterElementPatched(payload: { id: string; patch: PosterEditorElementPatch }) {
  styleConfig.value = patchPosterEditorElement(styleConfig.value, payload.id, payload.patch)
}

function onPosterTextOverride(payload: { slot: PosterTextSlot; patch: PosterTextOverride }) {
  const current = styleConfig.value.poster_text_overrides ?? {}
  const existing = current[payload.slot] ?? {}
  styleConfig.value = {
    ...styleConfig.value,
    poster_text_overrides: {
      ...current,
      [payload.slot]: { ...existing, ...payload.patch },
    },
  }
}

function onPosterTextReset(slot: PosterTextSlot) {
  const current = { ...(styleConfig.value.poster_text_overrides ?? {}) }
  delete current[slot]
  styleConfig.value = {
    ...styleConfig.value,
    poster_text_overrides: Object.keys(current).length ? current : undefined,
  }
}

function onPosterLayoutUpdated(value: PartialPosterLayout | undefined) {
  styleConfig.value = {
    ...styleConfig.value,
    poster_layout: value,
  }
}

function onThemePickerApply(payload: { styleConfig: StyleConfig }) {
  styleConfig.value = payload.styleConfig
  themePickerClosed.value = true
}

function queryFlag(value: unknown, fallback = false): boolean {
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return fallback
}

function hasQueryFlag(value: unknown): boolean {
  return value === 'true' || value === '1' || value === 'false' || value === '0'
}

function parseTonerVariant(value: unknown): TonerVariant | undefined {
  return value === 'auto' || value === 'light' || value === 'dark' ? value : undefined
}

const printFraming = printRenderClass
  ? getPrintFraming(styleConfig.value.print_size ?? '24x36', printRenderClass)
  : null
const printContext = renderMode === 'print'
  ? {
      framing: printFraming!,
      cssWidthPx: Math.round(printFraming!.fullWidthPx / printScale),
      cssHeightPx: Math.round(printFraming!.fullHeightPx / printScale),
      deviceScaleFactor: printScale,
    }
  : undefined

const fixtureFrameStyle = computed(() => {
  if (renderMode === 'print' && printContext) {
    return {
      width: `${printContext.cssWidthPx}px`,
      height: `${printContext.cssHeightPx}px`,
    }
  }
  return {
    width: `${Number.isFinite(width) ? width : 520}px`,
    height: `${Number.isFinite(height) ? height : 780}px`,
    maxWidth: '100%',
  }
})

const editorSurfaceFrameStyle = computed(() => ({
  width: `${Number.isFinite(width) ? Math.max(width, 960) : 1180}px`,
  height: `${Number.isFinite(height) ? Math.max(height, 720) : 820}px`,
  maxWidth: '100%',
  overflow: 'hidden',
}))

const templateEditorFrameStyle = computed(() => ({
  width: `${Number.isFinite(width) ? width : 1180}px`,
  height: `${Number.isFinite(height) ? height : 820}px`,
  maxWidth: '100%',
  overflow: 'hidden',
}))


const sampleRegion = SAMPLE_REGIONS[region] ?? SAMPLE_REGIONS.chicago
const routeRegion = SAMPLE_REGIONS[routeShape] ?? sampleRegion
function bboxFromRoute(route: number[][]): [number, number, number, number] | null {
  const points = route.filter(point =>
    typeof point[0] === 'number' &&
    Number.isFinite(point[0]) &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[1]),
  )
  if (!points.length) return null

  let minLng = points[0][0]
  let minLat = points[0][1]
  let maxLng = points[0][0]
  let maxLat = points[0][1]
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }

  return [minLng, minLat, maxLng, maxLat]
}

const sampleRoute = withRoute ? routeRegion.route : []
const sampleMapBbox = bboxFromRoute(sampleRoute) ?? routeRegion.bbox ?? sampleRegion.bbox
const sampleStats = routeRegion.stats ?? sampleRegion.stats ?? SAMPLE_REGIONS.chicago.stats ?? {}
if (region !== 'chicago') {
  styleConfig.value = {
    ...styleConfig.value,
    trail_name: fixtureTrailName ?? sampleRegion.title,
    location_text: fixtureLocationText ?? sampleRegion.location,
    occasion_text: fixtureOccasionText ?? '',
  }
}
const sampleRouteWithElevation = withElevationData
  ? withFixtureElevation(densifyRoute(sampleRoute), sampleStats)
  : sampleRoute

const sampleMap: TrailMap = {
  id: 'style-browser-fixture',
  user_id: 'dev',
  title: sampleRegion.title,
  geojson: {
    type: 'FeatureCollection',
    features: sampleRouteWithElevation.length > 1 ? [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: sampleRouteWithElevation,
      },
    }] : [],
  },
  bbox: sampleMapBbox,
  stats: {
    distance_km: typeof fixtureDistanceKm === 'number' && Number.isFinite(fixtureDistanceKm)
      ? fixtureDistanceKm
      : sampleStats.distance_km ?? 30.7,
    elevation_gain_m: typeof fixtureGainM === 'number' && Number.isFinite(fixtureGainM)
      ? fixtureGainM
      : sampleStats.elevation_gain_m ?? 1320,
    elevation_loss_m: sampleStats.elevation_loss_m ?? sampleStats.elevation_gain_m ?? 1280,
    min_elevation_m: sampleStats.min_elevation_m ?? 180,
    max_elevation_m: sampleStats.max_elevation_m ?? 390,
    duration_seconds: typeof fixtureDurationSeconds === 'number' && Number.isFinite(fixtureDurationSeconds)
      ? fixtureDurationSeconds
      : sampleStats.duration_seconds ?? 14_832,
    date: fixtureDate ?? '2026-05-11',
    location: sampleRegion.location,
  },
  style_config: initialStyleConfig,
  status: 'draft',
  created_at: '2026-05-11T00:00:00.000Z',
  updated_at: '2026-05-11T00:00:00.000Z',
}

function densifyRoute(route: number[][]): number[][] {
  const out: number[][] = []
  for (let index = 0; index < route.length; index += 1) {
    const current = route[index]
    const next = route[index + 1]
    out.push(current)
    if (next) {
      for (let step = 1; step < 8; step += 1) {
        const t = step / 8
        out.push([
          current[0] + ((next[0] - current[0]) * t),
          current[1] + ((next[1] - current[1]) * t),
        ])
      }
    }
  }
  return out
}

function withFixtureElevation(route: number[][], stats: Partial<RouteStats>): number[][] {
  const minElevation = stats.min_elevation_m ?? 120
  const maxElevation = stats.max_elevation_m ?? minElevation + 420
  const range = Math.max(80, maxElevation - minElevation)
  const count = Math.max(1, route.length - 1)
  return route.map(([lng, lat], index) => {
    const t = index / count
    if (styleConfig.value.color_theme === 'splits-stats') {
      const jag =
        (Math.sin(Math.PI * 13.5 * t) * 0.018) +
        (Math.sin((Math.PI * 29 * t) + 0.8) * 0.012) +
        (((index % 3) - 1) * 0.008)
      const normalized = Math.min(0.56, Math.max(0.18, 0.26 + (0.18 * t) + jag))
      return [
        lng,
        lat,
        Math.round(minElevation + (range * normalized)),
      ]
    }
    const wave =
      0.48 +
      (Math.sin((Math.PI * 2.1 * t) - 0.7) * 0.24) +
      (Math.sin((Math.PI * 6.4 * t) + 0.35) * 0.14) +
      (Math.sin((Math.PI * 15.5 * t) - 0.2) * 0.045)
    const taper = 0.1 * Math.sin(Math.PI * t)
    const normalized = Math.min(0.98, Math.max(0.04, wave + taper))
    return [
      lng,
      lat,
      Math.round(minElevation + (range * normalized)),
    ]
  })
}
</script>
