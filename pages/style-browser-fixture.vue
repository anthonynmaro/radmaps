<template>
  <main class="min-h-screen bg-stone-200 p-6">
    <div v-if="surfaceFixture" class="mx-auto bg-stone-100" :style="editorSurfaceFrameStyle">
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
        :render-mode="renderMode"
        :print-context="printContext"
        @overlay-updated="onOverlayUpdated"
        @asset-moved="onAssetMoved"
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
import { DEFAULT_STYLE_CONFIG, type PartialPosterLayout, type PosterTextOverride, type PosterTextSlot, type StyleConfig, type TextOverlay, type TrailMap } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'
import { COMPOSITION_OPTIONS } from '~/utils/posterCompositions'
import { getPrintFraming } from '~/utils/print/printFraming'

definePageMeta({ layout: false })

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const route = useRoute()
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
const gridScope = route.query.gridScope === 'map' || route.query.gridScope === 'poster'
  ? route.query.gridScope
  : undefined
const width = typeof route.query.width === 'string' ? Number.parseInt(route.query.width, 10) : 520
const height = typeof route.query.height === 'string' ? Number.parseInt(route.query.height, 10) : 780
const renderMode = route.query.print === 'final' ? 'print' : 'editor'
const printScale = typeof route.query.printScale === 'string' ? Number.parseFloat(route.query.printScale) : 10
const editable = route.query.editable === 'true' || route.query.editable === '1'
const chromeEditing = route.query.chrome === 'true' || route.query.chrome === '1'
const surfaceFixture = route.query.surface === 'true' || route.query.surface === '1'
const withOverlay = route.query.overlay === 'true' || route.query.overlay === '1'
const withAsset = route.query.asset === 'true' || route.query.asset === '1'
const withPins = route.query.pins === 'true' || route.query.pins === '1'

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
  show_roads: false,
  show_place_labels: false,
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
}

const styleConfig = ref<StyleConfig>(initialStyleConfig)

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
if (region !== 'chicago') {
  styleConfig.value = {
    ...styleConfig.value,
    trail_name: sampleRegion.title,
    location_text: sampleRegion.location,
    occasion_text: '',
  }
}
const sampleRoute = sampleRegion.route

const sampleMap: TrailMap = {
  id: 'style-browser-fixture',
  user_id: 'dev',
  title: sampleRegion.title,
  geojson: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: sampleRoute,
      },
    }],
  },
  bbox: sampleRegion.bbox,
  stats: {
    distance_km: 30.7,
    elevation_gain_m: 1320,
    elevation_loss_m: 1280,
    min_elevation_m: 180,
    max_elevation_m: 390,
    date: '2026-05-11',
    location: sampleRegion.location,
  },
  style_config: initialStyleConfig,
  status: 'draft',
  created_at: '2026-05-11T00:00:00.000Z',
  updated_at: '2026-05-11T00:00:00.000Z',
}
</script>
