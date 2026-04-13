<template>
  <!-- Outer: fills parent, centers the poster canvas -->
  <div class="w-full h-full flex items-center justify-center overflow-hidden" style="background:#e8e5e0">

    <!-- Poster canvas — maintains print aspect ratio -->
    <div
      class="poster-canvas relative flex flex-col shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
      :style="posterCanvasStyle"
    >

      <!-- ── Inset frame (optional) ───────────────────────────────────────── -->
      <div
        v-if="styleConfig.border_style !== 'none'"
        class="absolute z-20 pointer-events-none"
        :style="frameStyle"
      />

      <!-- ── HEADER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-header shrink-0" :style="headerBandStyle">

        <!-- Trail name — the typographic centrepiece -->
        <h1 class="poster-trail-name" :style="trailNameStyle">
          {{ trailName }}
        </h1>

        <!-- Location / elevation line -->
        <p v-if="locationLine" class="poster-location-line" :style="locationLineStyle">
          {{ locationLine }}
        </p>

        <!-- Thin rule -->
        <div class="poster-rule" :style="ruleStyle" />
      </div>

      <!-- ── MAP (hero — takes all remaining height) ─────────────────────── -->
      <div ref="mapContainer" class="relative flex-1 overflow-hidden">
        <!-- Loading placeholder -->
        <div
          v-if="!mapReady"
          class="absolute inset-0 flex items-center justify-center z-10"
          :style="{ backgroundColor: styleConfig.background_color }"
        >
          <svg class="w-12 h-12 opacity-10" viewBox="0 0 48 48" fill="none" :stroke="styleConfig.label_text_color">
            <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
            <path d="M10 28 Q18 25 24 27 Q30 29 38 26" stroke-width="0.7" opacity="0.4"/>
          </svg>
        </div>
      </div>

      <!-- ── FOOTER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-footer shrink-0" :style="footerBandStyle">

        <!-- Stat blocks (left) -->
        <div class="poster-stats">
          <div v-if="styleConfig.labels.show_distance && formattedDistance" class="stat-block">
            <span class="stat-number" :style="statNumberStyle">{{ formattedDistance }}</span>
            <span class="stat-unit" :style="statUnitStyle">miles</span>
          </div>

          <div
            v-if="styleConfig.labels.show_distance && styleConfig.labels.show_elevation_gain && formattedDistance && formattedGain"
            class="stat-divider"
            :style="dividerStyle"
          />

          <div v-if="styleConfig.labels.show_elevation_gain && formattedGain" class="stat-block">
            <span class="stat-number" :style="statNumberStyle">{{ formattedGain }}</span>
            <span class="stat-unit" :style="statUnitStyle">ft gain</span>
          </div>

          <div v-if="coords" class="stat-divider" :style="dividerStyle" />

          <div v-if="coords" class="stat-block stat-block--coords">
            <span :style="coordStyle">{{ coords.lat }}</span>
            <span :style="coordStyle">{{ coords.lng }}</span>
          </div>
        </div>

        <!-- Occasion / subtitle (centre, optional) -->
        <p v-if="occasionText" class="poster-occasion" :style="occasionStyle">
          {{ occasionText }}
        </p>

        <!-- Rad Maps mark (right) -->
        <div class="poster-mark">
          <svg viewBox="0 0 32 32" fill="none" class="mark-svg" :style="{ color: styleConfig.label_text_color, opacity: '0.4' }">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
            <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
          </svg>
          <span class="mark-label" :style="markLabelStyle">RAD MAPS</span>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle } from '~/utils/mapStyle'
import { PRINT_SIZES } from '~/types'
import type { StyleConfig, TrailMap } from '~/types'

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
  height: '100%',
  maxWidth: '100%',
  containerType: 'size',
}))

// ── Theme typography personalities ────────────────────────────────────────────
// Each color theme has its own typographic voice.
// The user-selected font_family will override the theme default when set.

interface TypographyProfile {
  titleFont: string
  titleWeight: string
  titleTracking: string
  titleCase: string
  titleSize: string
  titleLineHeight: string
  subFont: string
  subWeight: string
  subTracking: string
  subSize: string
  statsFont: string
  statsWeight: string
}

const THEME_TYPOGRAPHY: Record<string, TypographyProfile> = {
  // Swiss-editorial minimalism — clean, light, very wide tracking
  chalk: {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '300',
    titleTracking: '0.38em',
    titleCase: 'uppercase',
    titleSize: '3.4cqh',
    titleLineHeight: '1.15',
    subFont: "'Work Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: '1.0cqh',
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '500',
  },
  // Modern outdoor brand — geometric, confident, energetic
  topaz: {
    titleFont: "'Space Grotesk', sans-serif",
    titleWeight: '700',
    titleTracking: '0.06em',
    titleCase: 'uppercase',
    titleSize: '4.4cqh',
    titleLineHeight: '1.05',
    subFont: "'Space Grotesk', sans-serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: '1.05cqh',
    statsFont: "'Space Grotesk', sans-serif",
    statsWeight: '600',
  },
  // Heritage expedition — serif elegance, warm, literary
  dusk: {
    titleFont: "'DM Serif Display', serif",
    titleWeight: '400',
    titleTracking: '0.03em',
    titleCase: 'none',
    titleSize: '4.8cqh',
    titleLineHeight: '1.1',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: '1.0cqh',
    statsFont: "'DM Sans', sans-serif",
    statsWeight: '500',
  },
  // Dark luxury — monumental scale, high contrast, bold
  obsidian: {
    titleFont: "'Big Shoulders Display', sans-serif",
    titleWeight: '800',
    titleTracking: '-0.01em',
    titleCase: 'uppercase',
    titleSize: '5.8cqh',
    titleLineHeight: '0.95',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.35em',
    subSize: '1.0cqh',
    statsFont: "'Big Shoulders Display', sans-serif",
    statsWeight: '700',
  },
  // Field guide, tactical — structured, condensed, precise
  forest: {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '600',
    titleTracking: '0.08em',
    titleCase: 'uppercase',
    titleSize: '4.6cqh',
    titleLineHeight: '1.05',
    subFont: "'Oswald', sans-serif",
    subWeight: '300',
    subTracking: '0.22em',
    subSize: '1.0cqh',
    statsFont: "'Oswald', sans-serif",
    statsWeight: '500',
  },
  // Nautical expedition — tall condensed letterforms, cold authority
  midnight: {
    titleFont: "'Fjalla One', sans-serif",
    titleWeight: '400',
    titleTracking: '0.12em',
    titleCase: 'uppercase',
    titleSize: '4.8cqh',
    titleLineHeight: '1.05',
    subFont: "'DM Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.32em',
    subSize: '1.0cqh',
    statsFont: "'Fjalla One', sans-serif",
    statsWeight: '400',
  },
}

const THEME_DEFAULT_FONTS = ['Work Sans', 'Space Grotesk', 'DM Serif Display', 'Big Shoulders Display', 'Oswald', 'Fjalla One', 'DM Sans']

const typography = computed((): TypographyProfile => {
  const base = THEME_TYPOGRAPHY[props.styleConfig.color_theme ?? 'chalk'] ?? THEME_TYPOGRAPHY.chalk
  const override = props.styleConfig.font_family
  // Only override if user has explicitly picked something other than theme defaults
  if (override && !THEME_DEFAULT_FONTS.includes(override as string)) {
    const f = `'${override}', sans-serif`
    return { ...base, titleFont: f, subFont: f, statsFont: f }
  }
  return base
})

// ── Poster content ────────────────────────────────────────────────────────────

const trailName = computed(() =>
  props.styleConfig.trail_name || props.map.title || 'Your Trail',
)

const locationLine = computed(() => {
  const parts: string[] = []
  const loc = props.styleConfig.location_text || props.map.stats?.location
  if (loc) parts.push(loc.toUpperCase())
  const elev = props.map.stats?.max_elevation_m
  if (elev) parts.push(`${Math.round(elev).toLocaleString()} M ELEV.`)
  return parts.join('  ·  ')
})

const occasionText = computed(() => props.styleConfig.occasion_text || '')

// Formatted centre-point coordinates from bbox — adds cartographic authenticity
const coords = computed(() => {
  const b = props.map.bbox
  if (!b) return null
  const lat = (b[1] + b[3]) / 2
  const lng = (b[0] + b[2]) / 2
  const fmt = (v: number, pos: string, neg: string) => {
    const d = Math.abs(Math.floor(v))
    const m = Math.round((Math.abs(v) - d) * 60)
    return `${d}°${m.toString().padStart(2, '0')}'${v >= 0 ? pos : neg}`
  }
  return { lat: fmt(lat, 'N', 'S'), lng: fmt(lng, 'E', 'W') }
})

const formattedDistance = computed(() => {
  const km = props.map.stats?.distance_km ?? 0
  return km ? (km * 0.621371).toFixed(1) : ''
})

const formattedGain = computed(() => {
  const m = props.map.stats?.elevation_gain_m ?? 0
  return m ? Math.round(m * 3.28084).toLocaleString() : ''
})

// ── Style objects ─────────────────────────────────────────────────────────────

const fg = computed(() => props.styleConfig.label_text_color || '#1C1917')
const bg = computed(() => props.styleConfig.label_bg_color || props.styleConfig.background_color)
const borderW = computed(() =>
  props.styleConfig.border_style === 'thick' ? '2px'
  : props.styleConfig.border_style === 'thin' ? '1px' : '0',
)

const headerBandStyle = computed(() => ({
  backgroundColor: props.styleConfig.background_color,
  color: fg.value,
  padding: '3cqh 7cqw 2.2cqh',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '1.1cqh',
}))

const trailNameStyle = computed(() => ({
  fontFamily: typography.value.titleFont,
  fontWeight: typography.value.titleWeight,
  letterSpacing: typography.value.titleTracking,
  textTransform: typography.value.titleCase === 'uppercase' ? 'uppercase' as const : 'none' as const,
  fontSize: typography.value.titleSize,
  lineHeight: typography.value.titleLineHeight,
  color: fg.value,
  textAlign: 'center' as const,
  margin: '0',
  padding: '0',
}))

const locationLineStyle = computed(() => ({
  fontFamily: typography.value.subFont,
  fontWeight: typography.value.subWeight,
  letterSpacing: typography.value.subTracking,
  fontSize: typography.value.subSize,
  color: fg.value,
  opacity: '0.5',
  textTransform: 'uppercase' as const,
  textAlign: 'center' as const,
  margin: '0',
  padding: '0',
}))

const ruleStyle = computed(() => ({
  width: '100%',
  height: '1px',
  backgroundColor: fg.value,
  opacity: '0.12',
  marginTop: '0.4cqh',
  flexShrink: '0',
}))

const footerBandStyle = computed(() => ({
  backgroundColor: bg.value,
  color: fg.value,
  padding: '1.8cqh 7cqw',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative' as const,
  borderTop: borderW.value !== '0' ? `${borderW.value} solid ${fg.value}1a` : `1px solid ${fg.value}0d`,
}))

const statNumberStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: typography.value.statsWeight,
  fontSize: '2.6cqh',
  letterSpacing: '-0.01em',
  lineHeight: '1',
  color: fg.value,
  display: 'block',
}))

const statUnitStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '400',
  fontSize: '0.8cqh',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: fg.value,
  opacity: '0.45',
  display: 'block',
  marginTop: '0.55cqh',
}))

const coordStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: typography.value.statsWeight,
  fontSize: '1.2cqh',
  letterSpacing: '0.04em',
  lineHeight: '1.45',
  color: fg.value,
  opacity: '0.65',
  display: 'block',
}))

const dividerStyle = computed(() => ({
  width: '1px',
  height: '3cqh',
  backgroundColor: fg.value,
  opacity: '0.15',
  alignSelf: 'center',
  flexShrink: '0',
}))

const occasionStyle = computed(() => ({
  fontFamily: typography.value.subFont,
  fontWeight: typography.value.subWeight,
  fontSize: '0.95cqh',
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: fg.value,
  opacity: '0.5',
  textAlign: 'center' as const,
  position: 'absolute' as const,
  left: '50%',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap' as const,
}))

const markLabelStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '700',
  fontSize: '0.55cqh',
  letterSpacing: '0.22em',
  color: fg.value,
  opacity: '0.4',
  textTransform: 'uppercase' as const,
}))

const frameStyle = computed(() => ({
  inset: '14px',
  border: `${borderW.value !== '0' ? borderW.value : '1px'} solid ${fg.value}`,
  opacity: '0.18',
}))

// ── Map lifecycle ─────────────────────────────────────────────────────────────

const FULL_RELOAD_KEYS: (keyof StyleConfig)[] = [
  'preset', 'base_tile_style',
  'show_contours', 'show_hillshade', 'show_elevation_labels',
  'contour_color', 'contour_major_color', 'contour_opacity', 'contour_detail',
  'hillshade_intensity', 'hillshade_highlight',
]

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  const style = buildMapStyle(props.styleConfig, config.public.mapboxToken, config.public.maptilerToken) as maplibregl.StyleSpecification

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

  resizeObserver = new ResizeObserver(() => mapInstance?.resize())
  resizeObserver.observe(mapContainer.value)
})

// ── Chaikin corner-cutting smoothing ─────────────────────────────────────────

function chaikinSmooth(coords: number[][], iterations: number): number[][] {
  if (iterations === 0 || coords.length < 2) return coords
  let pts = coords
  for (let i = 0; i < iterations; i++) {
    const out: number[][] = [pts[0]]
    for (let j = 0; j < pts.length - 1; j++) {
      const p0 = pts[j], p1 = pts[j + 1]
      out.push(p0.map((v, k) => 0.75 * v + 0.25 * p1[k]))
      out.push(p0.map((v, k) => 0.25 * v + 0.75 * p1[k]))
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

function smoothGeojson(geojson: GeoJSON.FeatureCollection, iterations: number): GeoJSON.FeatureCollection {
  if (iterations === 0) return geojson
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return { ...feature, geometry: { ...g, coordinates: chaikinSmooth(g.coordinates, iterations) } }
      }
      if (g.type === 'MultiLineString') {
        return { ...feature, geometry: { ...g, coordinates: g.coordinates.map(line => chaikinSmooth(line, iterations)) } }
      }
      return feature
    }),
  }
}

function populateRouteSource() {
  if (!mapInstance) return
  const raw = props.map.geojson as GeoJSON.FeatureCollection
  const iterations = props.styleConfig.route_smooth ?? 0
  const geojson = smoothGeojson(raw, iterations)
  const src = mapInstance.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(geojson)
  else mapInstance.addSource('route', { type: 'geojson', data: geojson })
}

function setPaintBackground() {
  if (!mapInstance) return
  if (mapInstance.getLayer('background')) {
    mapInstance.setPaintProperty('background', 'background-color', props.styleConfig.background_color)
  }
}

watch(
  () => props.styleConfig,
  (newConfig, oldConfig) => {
    if (!mapInstance || !mapReady.value) return

    const needsFullReload = FULL_RELOAD_KEYS.some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      mapReady.value = false
      const newStyle = buildMapStyle(newConfig, config.public.mapboxToken, config.public.maptilerToken) as maplibregl.StyleSpecification
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => { populateRouteSource(); mapReady.value = true })
      return
    }

    if (newConfig.background_color !== oldConfig?.background_color) setPaintBackground()

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

// Dedicated watcher for route_smooth — watches a primitive directly, avoiding
// the old/new reference aliasing issue that can affect deep object watchers.
watch(
  () => props.styleConfig.route_smooth,
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

// Refit bounds when padding changes so the route zoom updates live.
watch(
  () => props.styleConfig.padding_factor,
  (val) => {
    if (!mapInstance || !mapReady.value || !mapContainer.value) return
    mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
      padding: Math.round(mapContainer.value.offsetHeight * (val ?? 0.15)),
    })
  },
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

.poster-stats {
  display: flex;
  align-items: flex-start;
  gap: 2.4cqw;
}

.stat-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stat-block--coords {
  gap: 0;
}

.poster-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5cqh;
  flex-shrink: 0;
}

.mark-svg {
  width: 4cqh;
  height: 4cqh;
}
</style>
