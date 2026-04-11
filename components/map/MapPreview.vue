<template>
  <!-- Outer: fills parent, centers the poster canvas -->
  <div class="w-full h-full flex items-center justify-center overflow-hidden bg-gray-200">

    <!-- Poster canvas — maintains print aspect ratio -->
    <div
      class="poster-canvas relative flex flex-col shadow-2xl"
      :style="posterCanvasStyle"
    >
      <!-- ── Border frame overlay ────────────────────────────────────────── -->
      <div
        v-if="styleConfig.border_style !== 'none'"
        class="absolute inset-0 pointer-events-none z-20"
        :style="borderFrameStyle"
      />

      <!-- ── Title band (top) ───────────────────────────────────────────── -->
      <div
        class="poster-title-band shrink-0 flex flex-col items-center justify-center"
        :style="titleBandStyle"
      >
        <p class="poster-title leading-none tracking-widest uppercase text-center">
          {{ styleConfig.trail_name || map.title }}
        </p>
        <p
          v-if="map.subtitle || styleConfig.occasion_text"
          class="poster-subtitle uppercase tracking-wider text-center mt-[0.4cqh] opacity-70"
        >
          {{ styleConfig.occasion_text || map.subtitle }}
        </p>
      </div>

      <!-- ── Map area (middle) ─────────────────────────────────────────── -->
      <div ref="mapContainer" class="relative flex-1 overflow-hidden">
        <div
          v-if="!mapReady"
          class="absolute inset-0 flex items-center justify-center z-10"
          :style="{ backgroundColor: styleConfig.background_color }"
        >
          <UIcon name="i-heroicons-map" class="w-10 h-10 opacity-20" :style="{ color: styleConfig.label_text_color }" />
        </div>
      </div>

      <!-- ── Footer band (bottom) ──────────────────────────────────────── -->
      <div
        class="poster-footer-band shrink-0 flex items-center justify-between"
        :style="footerBandStyle"
      >
        <!-- Left: stats -->
        <div class="flex flex-col gap-[0.3cqh]">
          <div class="flex items-baseline gap-[1cqw]">
            <span
              v-if="styleConfig.labels.show_distance"
              class="poster-stat"
            >{{ formattedDistance }} mi</span>
            <span
              v-if="styleConfig.labels.show_distance && styleConfig.labels.show_elevation_gain"
              class="opacity-30 poster-stat-sep">·</span>
            <span
              v-if="styleConfig.labels.show_elevation_gain"
              class="poster-stat"
            >{{ formattedGain }} ft gain</span>
          </div>
          <span
            v-if="styleConfig.labels.show_location && (styleConfig.location_text || map.stats?.location)"
            class="poster-meta opacity-60 uppercase tracking-widest"
          >{{ styleConfig.location_text || map.stats?.location }}</span>
          <span
            v-if="styleConfig.labels.show_date && map.stats?.date"
            class="poster-meta opacity-50 uppercase tracking-widest"
          >{{ formattedDate }}</span>
        </div>

        <!-- Right: badge placeholder -->
        <div
          class="poster-badge flex items-center justify-center shrink-0"
          :style="badgeStyle"
        >
          <svg viewBox="0 0 48 48" class="w-full h-full opacity-40" fill="none">
            <polygon points="24,4 44,16 44,32 24,44 4,32 4,16" :stroke="styleConfig.label_text_color" stroke-width="1.5" fill="none"/>
            <text x="24" y="28" text-anchor="middle" :fill="styleConfig.label_text_color" font-size="10" font-weight="700" letter-spacing="1">TM</text>
          </svg>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CONTOUR_THRESHOLDS } from '~/utils/mapStyle'
import { PRINT_SIZES } from '~/types'
import type { StyleConfig, TrailMap } from '~/types'

// ── maplibre-contour setup ────────────────────────────────────────────────────
// Dynamic import — maplibre-contour uses Web Workers and must never be evaluated
// during SSR (it would crash the Vite Node process with "IPC connection closed").
// The singleton is initialised lazily on first browser call and cached thereafter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _demSource: any | null = null

async function getDemSource() {
  if (!import.meta.client) return null
  if (!_demSource) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mlContour = await import('maplibre-contour') as any
    const DemSource = mlContour.default?.DemSource ?? mlContour.DemSource
    _demSource = new DemSource({
      url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      encoding: 'terrarium',
      maxzoom: 13,
      worker: true,
      cacheSize: 200,
    })
    _demSource.setupMaplibre(maplibregl)
  }
  return _demSource
}

async function getContourTileUrl(styleConfig: StyleConfig): Promise<string | undefined> {
  if (!styleConfig.show_contours) return undefined
  const detail = Math.max(0, Math.min(4, Math.round(styleConfig.contour_detail ?? 3)))
  const thresholds = CONTOUR_THRESHOLDS[detail]
  const demSource = await getDemSource()
  if (!demSource) return undefined
  return demSource.contourProtocol({
    thresholds,
    elevationKey: 'ele',
    levelKey: 'level',
    contourLayer: 'contours',
    overzoom: 1,
  })
}

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)
let mapInstance: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null

// ── Print canvas ─────────────────────────────────────────────────────────────

const printSize = computed(() =>
  PRINT_SIZES.find(s => s.id === props.styleConfig.print_size) ?? PRINT_SIZES[0],
)

const posterCanvasStyle = computed(() => ({
  aspectRatio: `${printSize.value.width_in} / ${printSize.value.height_in}`,
  backgroundColor: props.styleConfig.background_color,
  // height: 100% fills the flex container; aspect-ratio derives the width;
  // max-width: 100% prevents overflow if the container is too narrow.
  height: '100%',
  maxWidth: '100%',
  containerType: 'size',
}))

// ── Band styles ───────────────────────────────────────────────────────────────

const titleBandStyle = computed(() => ({
  backgroundColor: props.styleConfig.background_color,
  color: props.styleConfig.label_text_color,
  fontFamily: props.styleConfig.font_family,
  padding: '2.5cqh 6cqw 2cqh',
  borderBottom: props.styleConfig.border_style !== 'none'
    ? `${props.styleConfig.border_style === 'thick' ? '2px' : '1px'} solid ${props.styleConfig.label_text_color}22`
    : 'none',
}))

const footerBandStyle = computed(() => ({
  backgroundColor: props.styleConfig.label_bg_color,
  color: props.styleConfig.label_text_color,
  fontFamily: props.styleConfig.font_family,
  padding: '1.8cqh 6cqw',
  borderTop: props.styleConfig.border_style !== 'none'
    ? `${props.styleConfig.border_style === 'thick' ? '2px' : '1px'} solid ${props.styleConfig.label_text_color}22`
    : 'none',
}))

const badgeStyle = computed(() => ({
  width: '6cqh',
  height: '6cqh',
}))

const borderFrameStyle = computed(() => {
  const w = props.styleConfig.border_style === 'thick' ? '3px' : '1px'
  return {
    border: `${w} solid ${props.styleConfig.label_text_color}`,
    opacity: 0.25,
    margin: '8px',
    pointerEvents: 'none' as const,
  }
})

// ── Formatted stats ───────────────────────────────────────────────────────────

const formattedDistance = computed(() => {
  const km = props.map.stats?.distance_km ?? 0
  return (km * 0.621371).toFixed(1)
})

const formattedGain = computed(() => {
  const m = props.map.stats?.elevation_gain_m ?? 0
  return Math.round(m * 3.28084).toLocaleString()
})

const formattedDate = computed(() => {
  const d = props.map.stats?.date
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// ── FULL_RELOAD_KEYS: changes that require rebuilding the MapLibre style spec ─

const FULL_RELOAD_KEYS: (keyof StyleConfig)[] = [
  'preset', 'base_tile_style',
  'show_contours', 'show_hillshade', 'show_elevation_labels',
  'contour_color', 'contour_major_color', 'contour_opacity', 'contour_detail',
  'hillshade_intensity', 'hillshade_highlight',
]

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  const style = buildMapStyle(
    props.styleConfig,
    config.public.mapboxToken,
    config.public.maptilerToken,
    await getContourTileUrl(props.styleConfig),
  ) as maplibregl.StyleSpecification

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style,
    bounds: props.map.bbox,
    fitBoundsOptions: {
      padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)),
    },
    attributionControl: false,
    interactive: true,
  })

  mapInstance.on('load', () => {
    populateRouteSource()
    setPaintBackground()
    mapReady.value = true
  })

  // Resize MapLibre whenever the container size changes (print size toggle, panel resize)
  resizeObserver = new ResizeObserver(() => {
    mapInstance?.resize()
  })
  resizeObserver.observe(mapContainer.value)
})

// ── Route source ──────────────────────────────────────────────────────────────

function populateRouteSource() {
  if (!mapInstance) return
  const geojson = props.map.geojson as GeoJSON.FeatureCollection
  const source = mapInstance.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (source) {
    source.setData(geojson)
  } else {
    mapInstance.addSource('route', { type: 'geojson', data: geojson })
  }
}

function setPaintBackground() {
  if (!mapInstance) return
  if (mapInstance.getLayer('background')) {
    mapInstance.setPaintProperty('background', 'background-color', props.styleConfig.background_color)
  }
}

// ── Style config watcher ──────────────────────────────────────────────────────

watch(
  () => props.styleConfig,
  async (newConfig, oldConfig) => {
    if (!mapInstance || !mapReady.value) return

    const needsFullReload = FULL_RELOAD_KEYS.some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      mapReady.value = false
      const newStyle = buildMapStyle(
        newConfig,
        config.public.mapboxToken,
        config.public.maptilerToken,
        await getContourTileUrl(newConfig),
      ) as maplibregl.StyleSpecification
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        mapReady.value = true
      })
      return
    }

    // Background colour — paint-only
    if (newConfig.background_color !== oldConfig?.background_color) {
      setPaintBackground()
    }

    // Route paint — no reload needed
    if (mapInstance.getLayer('route-line')) {
      mapInstance.setPaintProperty('route-line', 'line-color', newConfig.route_color)
      mapInstance.setPaintProperty('route-line', 'line-width', newConfig.route_width)
      mapInstance.setPaintProperty('route-line', 'line-opacity', newConfig.route_opacity)
      mapInstance.setPaintProperty('route-line-casing', 'line-width', newConfig.route_width + 4)
      mapInstance.setPaintProperty('route-line-casing', 'line-opacity', newConfig.route_opacity)
    }
  },
  { deep: true },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
  mapInstance?.remove()
  mapInstance = null
})
</script>

<style scoped>
.poster-canvas {
  container-type: size;
}

/* Typography scales with poster height via cqh units */
.poster-title     { font-size: 3.8cqh; font-weight: 800; }
.poster-subtitle  { font-size: 1.8cqh; font-weight: 500; }
.poster-stat      { font-size: 2.0cqh; font-weight: 700; }
.poster-stat-sep  { font-size: 2.0cqh; }
.poster-meta      { font-size: 1.3cqh; font-weight: 400; }
</style>
