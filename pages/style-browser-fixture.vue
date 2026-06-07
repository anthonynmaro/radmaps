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
    <div v-else-if="templateEditorFixture" class="mx-auto bg-stone-100" :style="layoutSpikeFrameStyle">
      <FixedPosterTemplateEditor
        v-model="styleConfig"
        :map="sampleMap"
      />
    </div>
    <div v-else-if="puckReferenceFixture" class="mx-auto bg-stone-100" :style="layoutSpikeFrameStyle">
      <ClientOnly>
        <PuckPosterSpike
          v-model="styleConfig"
          :map="sampleMap"
        />
      </ClientOnly>
    </div>
    <div v-else-if="layoutSpikeFixture" class="mx-auto bg-stone-100" :style="layoutSpikeFrameStyle">
      <PosterLayoutSpike
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
        :poster-editor-mode="posterEditorMode"
        :poster-guides-visible="posterGuidesVisible"
        :selected-poster-element-id="selectedPosterElementId"
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
import PosterLayoutSpike from '~/components/map/PosterLayoutSpike.vue'
import PuckPosterSpike from '~/components/map/PuckPosterSpike.client.vue'
import ThemeLineupStep from '~/components/map/ThemeLineupStep.vue'
import { DEFAULT_STYLE_CONFIG, type PartialPosterLayout, type PosterTextOverride, type PosterTextSlot, type StyleConfig, type TextOverlay, type TonerVariant, type TrailMap } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'
import { COMPOSITION_OPTIONS } from '~/utils/posterCompositions'
import { getPrintFraming } from '~/utils/print/printFraming'
import { patchPosterEditorElement, type PosterEditorElementPatch } from '~/utils/posterEditorElements'

definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const route = useRoute()
const layoutSpikeFixture = route.query.layoutSpike === 'true' || route.query.layoutSpike === '1'
const templateEditorFixture = route.query.templateEditor === 'true'
  || route.query.templateEditor === '1'
  || route.query.puckSpike === 'true'
  || route.query.puckSpike === '1'
const puckReferenceFixture = route.query.puckReference === 'true' || route.query.puckReference === '1'
const builderReferenceFixture = layoutSpikeFixture || puckReferenceFixture
const composition = typeof route.query.composition === 'string'
  ? (builderReferenceFixture ? 'editorial-tall' : route.query.composition)
  : 'editorial-tall'
const themeId = typeof route.query.theme === 'string'
  ? (builderReferenceFixture ? 'editorial-minimal' : route.query.theme)
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
const renderMode = route.query.print === 'final' ? 'print' : 'editor'
const printScale = typeof route.query.printScale === 'string' ? Number.parseFloat(route.query.printScale) : 10
const editable = route.query.editable === 'true' || route.query.editable === '1'
const chromeEditing = route.query.chrome === 'true' || route.query.chrome === '1'
const posterElementsEditor = route.query.posterEditor === 'true' || route.query.posterEditor === '1'
const posterEditorMode = typeof route.query.posterMode === 'string'
  ? route.query.posterMode as 'layout' | 'select' | 'text' | 'image' | 'icon' | 'guides'
  : 'layout'
const posterGuidesVisible = posterEditorMode === 'guides' || queryFlag(route.query.guides, false)
const surfaceFixture = route.query.surface === 'true' || route.query.surface === '1'
const themePickerFixture = route.query.themePicker === 'true' || route.query.themePicker === '1'
const withOverlay = route.query.overlay === 'true' || route.query.overlay === '1'
const withAsset = route.query.asset === 'true' || route.query.asset === '1'
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
          x: 12,
          y: 65,
          font_size: 1.4,
          color: theme?.route_color ?? '#E85D75',
          font_family: theme?.body_font_family ?? baseConfig.body_font_family,
          alignment: 'left',
          opacity: 1,
          bold: true,
          italic: false,
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
          width_px: 1600,
          height_px: 800,
          file_size_bytes: 4096,
          x: 42,
          y: 48,
          width: 16,
          height: 5.33,
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
})
const selectedPosterElementId = ref<string | null>(
  typeof route.query.selectedPosterElement === 'string' ? route.query.selectedPosterElement : null,
)
const themePickerClosed = ref(false)

onMounted(() => {
  ;(window as unknown as {
    __RADMAPS_STYLE_FIXTURE__?: {
      getStyle: () => StyleConfig
      setStyle: (patch: Partial<StyleConfig>) => void
    }
  }).__RADMAPS_STYLE_FIXTURE__ = {
    getStyle: () => styleConfig.value,
    setStyle: (patch) => {
      styleConfig.value = { ...styleConfig.value, ...patch }
    },
  }
})

onUnmounted(() => {
  delete (window as unknown as {
    __RADMAPS_STYLE_FIXTURE__?: {
      getStyle: () => StyleConfig
      setStyle: (patch: Partial<StyleConfig>) => void
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

const finalFraming = getPrintFraming(styleConfig.value.print_size ?? '24x36', 'final')
const printContext = renderMode === 'print'
  ? {
      framing: finalFraming,
      cssWidthPx: Math.round(finalFraming.fullWidthPx / printScale),
      cssHeightPx: Math.round(finalFraming.fullHeightPx / printScale),
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

const layoutSpikeFrameStyle = computed(() => ({
  width: `${Number.isFinite(width) ? width : 1180}px`,
  height: `${Number.isFinite(height) ? height : 820}px`,
  maxWidth: '100%',
  overflow: 'hidden',
}))

const sampleRegions: Record<string, {
  title: string
  location: string
  bbox: [number, number, number, number]
  route: number[][]
}> = {
  chicago: {
    title: 'Kickapoo Endurance Race',
    location: 'Chicago, Illinois',
    bbox: [-87.75, 41.83, -87.58, 41.92],
    route: [
      [-87.733, 41.905],
      [-87.71, 41.91],
      [-87.698, 41.89],
      [-87.682, 41.898],
      [-87.664, 41.875],
      [-87.647, 41.884],
      [-87.628, 41.861],
      [-87.609, 41.875],
      [-87.592, 41.842],
    ],
  },
  whitney: {
    title: 'Mount Whitney',
    location: 'Sierra Nevada, California',
    bbox: [-118.37, 36.51, -118.17, 36.69],
    route: [
      [-118.333, 36.592],
      [-118.315, 36.602],
      [-118.295, 36.609],
      [-118.280, 36.617],
      [-118.268, 36.610],
      [-118.276, 36.598],
      [-118.284, 36.580],
      [-118.276, 36.562],
      [-118.254, 36.548],
      [-118.226, 36.540],
      [-118.202, 36.539],
    ],
  },
  rainier: {
    title: 'Wonderland',
    location: 'Mount Rainier, Washington',
    bbox: [-121.95, 46.72, -121.58, 46.98],
    route: [
      [-121.840, 46.802],
      [-121.805, 46.828],
      [-121.758, 46.858],
      [-121.705, 46.890],
      [-121.640, 46.918],
      [-121.622, 46.900],
      [-121.692, 46.870],
      [-121.760, 46.840],
      [-121.824, 46.770],
    ],
  },
  'rainier-riso': {
    title: 'Wonderland',
    location: 'Mount Rainier, Washington',
    bbox: [-121.95, 46.72, -121.58, 46.98],
    route: [
      [-121.840, 46.875],
      [-121.780, 46.902],
      [-121.685, 46.924],
      [-121.624, 46.919],
      [-121.646, 46.904],
      [-121.756, 46.872],
      [-121.838, 46.802],
    ],
  },
  'whitney-blueprint': {
    title: 'Mount Whitney',
    location: 'Sierra Nevada, California',
    bbox: [-118.34, 36.475, -118.215, 36.635],
    route: [
      [-118.350, 36.540],
      [-118.338, 36.548],
      [-118.322, 36.552],
      [-118.305, 36.548],
      [-118.288, 36.535],
      [-118.272, 36.515],
      [-118.260, 36.497],
      [-118.254, 36.482],
      [-118.249, 36.480],
      [-118.245, 36.488],
      [-118.247, 36.516],
      [-118.250, 36.543],
      [-118.247, 36.566],
      [-118.240, 36.590],
      [-118.257, 36.604],
    ],
  },
  dolomites: {
    title: 'Tre Cime',
    location: 'Dolomiti, Italia',
    bbox: [12.18, 46.54, 12.42, 46.72],
    route: [
      [12.217, 46.6186],
      [12.234, 46.642],
      [12.250, 46.674],
      [12.270, 46.690],
      [12.294, 46.662],
      [12.318, 46.625],
      [12.348, 46.588],
      [12.386, 46.602],
      [12.350, 46.574],
      [12.306, 46.562],
      [12.282, 46.585],
    ],
  },
  'dolomites-copper': {
    title: 'Tre Cime',
    location: 'Dolomiti, Italia',
    bbox: [12.18, 46.54, 12.42, 46.72],
    route: [
      [12.214, 46.586],
      [12.246, 46.594],
      [12.283, 46.592],
      [12.316, 46.587],
      [12.344, 46.575],
      [12.365, 46.552],
      [12.380, 46.584],
      [12.394, 46.618],
    ],
  },
  moab: {
    title: 'Moab',
    location: 'Sand Flats, Utah',
    bbox: [-109.65, 38.49, -109.42, 38.66],
    route: [
      [-109.604, 38.548],
      [-109.575, 38.568],
      [-109.562, 38.602],
      [-109.535, 38.628],
      [-109.494, 38.618],
      [-109.474, 38.586],
      [-109.507, 38.556],
      [-109.553, 38.535],
    ],
  },
  napa: {
    title: 'Napa Valley',
    location: 'Calistoga · Napa · California',
    bbox: [-122.68, 38.42, -122.34, 38.78],
    route: [
      [-122.618, 38.718],
      [-122.570, 38.684],
      [-122.540, 38.642],
      [-122.497, 38.596],
      [-122.470, 38.550],
      [-122.438, 38.492],
    ],
  },
  boston: {
    title: 'Boston',
    location: 'Boston, Massachusetts',
    bbox: [-71.18, 42.27, -70.98, 42.40],
    route: [
      [-71.147, 42.3601],
      [-71.124, 42.372],
      [-71.101, 42.352],
      [-71.079, 42.364],
      [-71.058, 42.342],
      [-71.035, 42.352],
      [-71.012, 42.323],
    ],
  },
  scotland: {
    title: 'The Cobbler',
    location: 'Argyll, Scotland',
    bbox: [-4.86, 56.15, -4.70, 56.29],
    route: [
      [-4.815, 56.182],
      [-4.792, 56.197],
      [-4.775, 56.218],
      [-4.768, 56.242],
      [-4.748, 56.263],
      [-4.724, 56.254],
    ],
  },
  cdmx: {
    title: 'Centro Histórico',
    location: 'Mexico City, Mexico',
    bbox: [-99.158, 19.420, -99.115, 19.452],
    route: [
      [-99.151, 19.432],
      [-99.144, 19.438],
      [-99.136, 19.435],
      [-99.130, 19.441],
      [-99.123, 19.436],
    ],
  },
  banff: {
    title: 'Banff Ridge Traverse',
    location: 'Banff, Alberta',
    bbox: [-115.66, 51.14, -115.49, 51.23],
    route: [
      [-115.625, 51.158],
      [-115.600, 51.168],
      [-115.574, 51.181],
      [-115.548, 51.193],
      [-115.522, 51.205],
    ],
  },
  mexico: {
    title: 'Volcanic Valley Run',
    location: 'Mexico City, Mexico',
    bbox: [-99.19, 19.40, -99.07, 19.47],
    route: [
      [-99.176, 19.412],
      [-99.154, 19.422],
      [-99.132, 19.434],
      [-99.110, 19.446],
      [-99.086, 19.456],
    ],
  },
  patagonia: {
    title: 'Torres del Paine W Trek',
    location: 'Patagonia, Chile',
    bbox: [-73.18, -51.08, -72.75, -50.88],
    route: [
      [-73.139, -50.964],
      [-73.071, -50.976],
      [-73.006, -50.944],
      [-72.941, -50.970],
      [-72.870, -50.927],
      [-72.792, -50.942],
    ],
  },
  camino: {
    title: 'Camino Frances',
    location: 'Northern Spain',
    bbox: [-2.55, 42.38, -1.55, 42.9],
    route: [
      [-1.644, 42.812],
      [-1.814, 42.672],
      [-2.031, 42.672],
      [-2.192, 42.552],
      [-2.445, 42.466],
    ],
  },
  fuji: {
    title: 'Mount Fuji Ascent',
    location: 'Fuji-Hakone, Japan',
    bbox: [138.62, 35.28, 138.84, 35.46],
    route: [
      [138.731, 35.365],
      [138.727, 35.377],
      [138.724, 35.389],
      [138.728, 35.401],
      [138.735, 35.412],
      [138.742, 35.421],
    ],
  },
  newzealand: {
    title: 'Queenstown High Country',
    location: 'Queenstown, New Zealand',
    bbox: [168.55, -45.10, 168.78, -44.94],
    route: [
      [168.594, -45.046],
      [168.622, -45.031],
      [168.653, -45.010],
      [168.684, -44.989],
      [168.724, -44.965],
    ],
  },
}

const sampleRegion = sampleRegions[region] ?? sampleRegions.chicago
const routeRegion = sampleRegions[routeShape] ?? sampleRegion
const sampleMapBbox = routeRegion.bbox ?? sampleRegion.bbox
if (region !== 'chicago') {
  styleConfig.value = {
    ...styleConfig.value,
    trail_name: fixtureTrailName ?? sampleRegion.title,
    location_text: fixtureLocationText ?? sampleRegion.location,
    occasion_text: fixtureOccasionText ?? '',
  }
}
const sampleRoute = withRoute ? routeRegion.route : []
const sampleRouteWithElevation = withElevationData
  ? densifyRoute(sampleRoute).map(([lng, lat], index) => [
      lng,
      lat,
      180 + Math.round(Math.sin(index * 0.9) * 42 + index * 18),
    ])
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
      : 30.7,
    elevation_gain_m: typeof fixtureGainM === 'number' && Number.isFinite(fixtureGainM)
      ? fixtureGainM
      : 1320,
    elevation_loss_m: 1280,
    min_elevation_m: 180,
    max_elevation_m: 390,
    duration_seconds: typeof fixtureDurationSeconds === 'number' && Number.isFinite(fixtureDurationSeconds)
      ? fixtureDurationSeconds
      : 14_832,
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
      out.push([
        (current[0] + next[0]) / 2,
        (current[1] + next[1]) / 2,
      ])
    }
  }
  return out
}
</script>
