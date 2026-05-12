<template>
  <main class="min-h-screen bg-stone-200 p-6">
    <div class="mx-auto" :style="fixtureFrameStyle">
      <MapPreview
        :map="sampleMap"
        :style-config="styleConfig"
        :editable="editable"
        :render-mode="renderMode"
        :print-context="printContext"
        @overlay-updated="onOverlayUpdated"
        @poster-text-override="onPosterTextOverride"
        @poster-text-reset="onPosterTextReset"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import MapPreview from '~/components/map/MapPreview.vue'
import { DEFAULT_STYLE_CONFIG, type PosterTextOverride, type PosterTextSlot, type StyleConfig, type TextOverlay, type TrailMap } from '~/types'
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
const gridScope = route.query.gridScope === 'map' || route.query.gridScope === 'poster'
  ? route.query.gridScope
  : undefined
const width = typeof route.query.width === 'string' ? Number.parseInt(route.query.width, 10) : 520
const height = typeof route.query.height === 'string' ? Number.parseInt(route.query.height, 10) : 780
const renderMode = route.query.print === 'final' ? 'print' : 'editor'
const printScale = typeof route.query.printScale === 'string' ? Number.parseFloat(route.query.printScale) : 10
const editable = route.query.editable === 'true' || route.query.editable === '1'
const withOverlay = route.query.overlay === 'true' || route.query.overlay === '1'

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
  show_start_pin: false,
  show_finish_pin: false,
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
}

const styleConfig = ref<StyleConfig>(initialStyleConfig)

function onOverlayUpdated(payload: { id: string; patch: Partial<TextOverlay> }) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(overlay => overlay.id === payload.id ? { ...overlay, ...payload.patch } : overlay),
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

const sampleRoute = [
  [-87.733, 41.905],
  [-87.71, 41.91],
  [-87.698, 41.89],
  [-87.682, 41.898],
  [-87.664, 41.875],
  [-87.647, 41.884],
  [-87.628, 41.861],
  [-87.609, 41.875],
  [-87.592, 41.842],
]

const sampleMap: TrailMap = {
  id: 'style-browser-fixture',
  user_id: 'dev',
  title: 'Kickapoo Endurance Race',
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
  bbox: [-87.75, 41.83, -87.58, 41.92],
  stats: {
    distance_km: 30.7,
    elevation_gain_m: 1320,
    elevation_loss_m: 1280,
    min_elevation_m: 180,
    max_elevation_m: 390,
    date: '2026-05-11',
    location: 'Kickapoo State Park',
  },
  style_config: initialStyleConfig,
  status: 'draft',
  created_at: '2026-05-11T00:00:00.000Z',
  updated_at: '2026-05-11T00:00:00.000Z',
}
</script>
