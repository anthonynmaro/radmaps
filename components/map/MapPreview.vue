<template>
  <!-- Outer: fills parent, centers the poster canvas -->
  <div class="w-full h-full flex items-center justify-center overflow-hidden" style="background:#e8e5e0">

    <!-- Inline text edit sheet (mobile only) -->
    <InlineEditSheet
      v-if="activeEditField"
      :field="activeEditField.field"
      :value="activeEditField.value"
      @update:value="applyInlineEdit"
      @close="activeEditField = null"
    />

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

      <!-- ── Logo: header-right position ──────────────────────────────────── -->
      <img
        v-if="styleConfig.show_logo && styleConfig.logo_url && styleConfig.logo_position === 'header-right'"
        :src="styleConfig.logo_url"
        alt=""
        class="logo-header-right"
        :style="logoHeaderStyle"
      />

      <!-- ── HEADER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-header shrink-0" :style="headerBandStyle">

        <!-- Trail name — static or editable -->
        <h1
          v-if="!editable"
          class="poster-trail-name"
          :style="trailNameStyle"
        >{{ trailName }}</h1>
        <h1
          v-else
          class="poster-trail-name editable-text"
          :style="trailNameStyle"
          :contenteditable="!isMobile"
          :suppressContentEditableWarning="true"
          @blur="onTrailNameBlur"
          @click="onTextClick('trail_name', trailName)"
        >{{ trailName }}</h1>

        <!-- Location / elevation line -->
        <p
          v-if="locationLine && !editable"
          class="poster-location-line"
          :style="locationLineStyle"
        >{{ locationLine }}</p>
        <p
          v-else-if="locationLine && editable"
          class="poster-location-line editable-text"
          :style="locationLineStyle"
          :contenteditable="!isMobile"
          :suppressContentEditableWarning="true"
          @blur="onLocationBlur"
          @click="onTextClick('location_text', styleConfig.location_text)"
        >{{ locationLine }}</p>

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

        <!-- ── Logo: map-top-right position ─────────────────────────────── -->
        <img
          v-if="styleConfig.show_logo && styleConfig.logo_url && (styleConfig.logo_position === 'map-top-right' || !styleConfig.logo_position)"
          :src="styleConfig.logo_url"
          alt=""
          class="logo-map"
          :style="logoMapStyle"
        />

        <!-- ── Trail Legend ───────────────────────────────────────────────── -->
        <div
          v-if="showTrailLegend"
          class="trail-legend"
          :style="trailLegendStyle"
        >
          <div
            v-for="seg in visibleNamedSegments"
            :key="seg.id"
            class="legend-item"
          >
            <div class="legend-swatch" :style="{ backgroundColor: seg.color }" />
            <span class="legend-label" :style="legendLabelStyle">{{ seg.name }}</span>
          </div>
        </div>

        <!-- ── Text overlays ─────────────────────────────────────────────── -->
        <div
          v-if="(styleConfig.text_overlays ?? []).length > 0"
          class="overlay-layer"
        >
          <div
            v-for="overlay in styleConfig.text_overlays"
            :key="overlay.id"
            :data-overlay-id="overlay.id"
            class="text-overlay"
            :class="{ 'is-editable': editable }"
            :style="overlayStyle(overlay)"
            @click="editable ? onOverlayClick(overlay.id) : undefined"
          >{{ overlay.content }}</div>
        </div>
      </div>

      <!-- ── FOOTER BAND ─────────────────────────────────────────────────── -->
      <div class="poster-footer shrink-0" :style="footerBandStyle">

        <!-- Logo: footer-left position -->
        <img
          v-if="styleConfig.show_logo && styleConfig.logo_url && styleConfig.logo_position === 'footer-left'"
          :src="styleConfig.logo_url"
          alt=""
          :style="logoFooterStyle"
        />

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
        <p
          v-if="occasionText && !editable"
          class="poster-occasion"
          :style="occasionStyle"
        >{{ occasionText }}</p>
        <p
          v-else-if="editable"
          class="poster-occasion editable-text"
          :style="{ ...occasionStyle, minWidth: '4cqw', minHeight: '1.2cqh' }"
          :contenteditable="!isMobile"
          :suppressContentEditableWarning="true"
          @blur="onOccasionBlur"
          @click="onTextClick('occasion_text', styleConfig.occasion_text)"
        >{{ occasionText }}</p>

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
          <span v-if="styleConfig.show_branding !== false" class="branding-note" :style="brandingNoteStyle">radmaps.studio</span>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CONTOUR_THRESHOLDS } from '~/utils/mapStyle'
import { sliceRouteByPercent, trailSourceId } from '~/utils/trail'
import { PRINT_SIZES } from '~/types'
import type { StyleConfig, TrailMap, TextOverlay } from '~/types'

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
  editable?: boolean
}>()

const emit = defineEmits<{
  'update:trailName': [value: string]
  'update:occasionText': [value: string]
  'update:locationText': [value: string]
  'overlay-moved': [payload: { id: string; x: number; y: number }]
  'overlay-selected': [id: string]
  'edit-requested': [payload: { field: 'trail_name' | 'occasion_text' | 'location_text'; value: string }]
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)
let mapInstance: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null
let interactInstances: Array<{ unset: () => void }> = []

// ── maplibre-contour protocol ─────────────────────────────────────────────────
// Set up once per component mount. The DemSource registers a custom
// "dem-contour://" tile protocol with MapLibre that generates vector contour
// tiles on-the-fly from free AWS terrarium DEM tiles at any elevation interval.

let mlDemSource: any = null

async function ensureContourProtocol() {
  if (mlDemSource) return
  const mlContour = await import('maplibre-contour') as any
  mlDemSource = new mlContour.DemSource({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium',
    maxzoom: 15,
    worker: true,
  })
  mlDemSource.setupMaplibre(maplibregl)
}

function getContourTileUrl(cfg: StyleConfig): string | undefined {
  if (!cfg.show_contours || !mlDemSource) return undefined
  const detail = Math.round(cfg.contour_detail ?? 3)
  const thresholds = CONTOUR_THRESHOLDS[detail] ?? CONTOUR_THRESHOLDS[3]
  return mlDemSource.contourProtocolUrl({ thresholds, overzoom: 1 })
}

// Detect mobile for conditional contenteditable behavior
const isMobile = ref(false)
onMounted(() => {
  isMobile.value = window.matchMedia('(max-width: 767px)').matches
  const mq = window.matchMedia('(max-width: 767px)')
  mq.addEventListener('change', (e) => { isMobile.value = e.matches })
})

// Mobile text editing sheet state
const activeEditField = ref<{ field: 'trail_name' | 'occasion_text' | 'location_text'; value: string } | null>(null)

function onTextClick(field: 'trail_name' | 'occasion_text' | 'location_text', value: string) {
  if (!isMobile.value) return // desktop uses contenteditable directly
  activeEditField.value = { field, value }
  emit('edit-requested', { field, value })
}

function applyInlineEdit(value: string) {
  if (!activeEditField.value) return
  const field = activeEditField.value.field
  if (field === 'trail_name') emit('update:trailName', value)
  else if (field === 'occasion_text') emit('update:occasionText', value)
  else if (field === 'location_text') emit('update:locationText', value)
  activeEditField.value = null
}

function onTrailNameBlur(e: FocusEvent) {
  emit('update:trailName', (e.target as HTMLElement).innerText.trim())
}
function onLocationBlur(e: FocusEvent) {
  emit('update:locationText', (e.target as HTMLElement).innerText.trim())
}
function onOccasionBlur(e: FocusEvent) {
  emit('update:occasionText', (e.target as HTMLElement).innerText.trim())
}

function onOverlayClick(id: string) {
  emit('overlay-selected', id)
}

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
  position: 'relative' as const,
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
  outline: 'none',
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
  outline: 'none',
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
  outline: 'none',
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

const brandingNoteStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '400',
  fontSize: '0.42cqh',
  letterSpacing: '0.14em',
  color: fg.value,
  opacity: '0.28',
  textTransform: 'lowercase' as const,
}))

const frameStyle = computed(() => ({
  inset: '14px',
  border: `${borderW.value !== '0' ? borderW.value : '1px'} solid ${fg.value}`,
  opacity: '0.18',
}))

// ── Logo styles ───────────────────────────────────────────────────────────────

const logoSize = computed(() => `${props.styleConfig.logo_size ?? 8}cqh`)

const logoMapStyle = computed(() => ({
  position: 'absolute' as const,
  top: '2%',
  right: '2%',
  maxHeight: logoSize.value,
  maxWidth: '15%',
  zIndex: 10,
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
}))

const logoHeaderStyle = computed(() => ({
  position: 'absolute' as const,
  top: '50%',
  right: '7cqw',
  transform: 'translateY(-50%)',
  maxHeight: logoSize.value,
  maxWidth: '12%',
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
  zIndex: 5,
}))

const logoFooterStyle = computed(() => ({
  maxHeight: '4cqh',
  maxWidth: '10%',
  objectFit: 'contain' as const,
  pointerEvents: 'none' as const,
  flexShrink: '0',
}))

// ── Text overlay styles ────────────────────────────────────────────────────────

function overlayStyle(o: TextOverlay): Record<string, string> {
  const xOffset = o.alignment === 'center' ? '-50%' : o.alignment === 'right' ? '-100%' : '0%'
  return {
    position: 'absolute',
    left: `${o.x}%`,
    top: `${o.y}%`,
    fontFamily: `'${o.font_family}', sans-serif`,
    fontSize: `${o.font_size}cqh`,
    color: o.color,
    textAlign: o.alignment,
    opacity: String(o.opacity),
    fontWeight: o.bold ? '700' : '400',
    transform: `translateX(${xOffset})`,
    whiteSpace: 'pre-wrap',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: '8',
    ...(o.bg_color ? {
      backgroundColor: o.bg_color,
      padding: '0.3cqh 0.8cqh',
      borderRadius: '0.4cqh',
    } : {}),
  }
}

// ── Trail legend ──────────────────────────────────────────────────────────────

const visibleNamedSegments = computed(() =>
  (props.styleConfig.trail_segments ?? []).filter(s => s.visible && s.name),
)

const showTrailLegend = computed(() =>
  props.styleConfig.trail_legend?.show !== false &&
  visibleNamedSegments.value.length > 0,
)

const trailLegendStyle = computed(() => {
  const pos = props.styleConfig.trail_legend?.position ?? 'bottom-left'
  const posStyles: Record<string, string> = {
    'bottom-left': 'bottom: 2%; left: 2%;',
    'bottom-right': 'bottom: 2%; right: 2%;',
    'top-left': 'top: 2%; left: 2%;',
    'top-right': 'top: 2%; right: 2%;',
  }
  const parts = posStyles[pos]?.split(';').filter(Boolean) ?? []
  const style: Record<string, string> = {
    position: 'absolute',
    zIndex: '9',
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: '0.6cqh',
    padding: '0.8cqh 1.2cqw',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5cqh',
    pointerEvents: 'none',
  }
  for (const part of parts) {
    const [k, v] = part.split(':').map(s => s.trim())
    if (k && v) style[k] = v
  }
  return style
})

const legendLabelStyle = computed(() => ({
  fontFamily: typography.value.statsFont,
  fontWeight: '500',
  fontSize: '0.75cqh',
  letterSpacing: '0.06em',
  color: fg.value,
  opacity: '0.85',
}))

// ── Map lifecycle ─────────────────────────────────────────────────────────────

const FULL_RELOAD_KEYS: (keyof StyleConfig)[] = [
  'preset', 'base_tile_style',
  'show_contours', 'show_hillshade', 'show_elevation_labels',
  'contour_color', 'contour_major_color', 'contour_opacity', 'contour_detail',
  'hillshade_intensity', 'hillshade_highlight',
  'trail_segments',
]

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  if (props.styleConfig.show_contours) await ensureContourProtocol()
  const style = buildMapStyle(props.styleConfig, config.public.mapboxToken, config.public.maptilerToken, getContourTileUrl(props.styleConfig)) as maplibregl.StyleSpecification

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
    populateSegmentSources()
    setPaintBackground()
    mapReady.value = true
    if (props.editable) initOverlayDrag()
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

function populateSegmentSources() {
  if (!mapInstance) return
  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible) continue
    const sliced = sliceRouteByPercent(props.map.geojson as GeoJSON.FeatureCollection, seg.section_start, seg.section_end)
    const src = mapInstance.getSource(trailSourceId(seg)) as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(sliced)
  }
}

function setPaintBackground() {
  if (!mapInstance) return
  if (mapInstance.getLayer('background')) {
    mapInstance.setPaintProperty('background', 'background-color', props.styleConfig.background_color)
  }
}

// ── interactjs drag for text overlays ────────────────────────────────────────

async function initOverlayDrag() {
  if (!props.editable || !mapContainer.value) return
  // Clean up previous instances
  for (const inst of interactInstances) inst.unset()
  interactInstances = []

  const { default: interact } = await import('interactjs')

  const container = mapContainer.value
  const overlays = container.querySelectorAll<HTMLElement>('.text-overlay.is-editable')
  overlays.forEach(el => {
    const inst = interact(el).draggable({
      listeners: {
        move(event: { dx: number; dy: number; target: HTMLElement }) {
          const containerRect = container.getBoundingClientRect()
          const currentLeft = parseFloat(el.style.left) || 0
          const currentTop = parseFloat(el.style.top) || 0
          const newLeft = currentLeft + (event.dx / containerRect.width) * 100
          const newTop = currentTop + (event.dy / containerRect.height) * 100
          el.style.left = `${Math.max(0, Math.min(100, newLeft))}%`
          el.style.top = `${Math.max(0, Math.min(100, newTop))}%`
        },
        end(event: { target: HTMLElement }) {
          const id = event.target.dataset.overlayId
          if (!id) return
          const containerRect = container.getBoundingClientRect()
          const rect = event.target.getBoundingClientRect()
          const x = Math.round(((rect.left - containerRect.left) / containerRect.width) * 100)
          const y = Math.round(((rect.top - containerRect.top) / containerRect.height) * 100)
          emit('overlay-moved', { id, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
        },
      },
    })
    interactInstances.push(inst)
  })
}

// ── Style config watcher ──────────────────────────────────────────────────────

// Track previous trail_segments for smart diffing
let prevSegmentIds: string[] = []
let prevSegmentCount = 0

watch(
  () => props.styleConfig,
  async (newConfig, oldConfig) => {
    if (!mapInstance || !mapReady.value) return

    const needsFullReload = FULL_RELOAD_KEYS.some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      // Check if only segment geometry/paint changed (same IDs, same count)
      const newSegs = newConfig.trail_segments ?? []
      const oldSegs = oldConfig?.trail_segments ?? []
      const newIds = newSegs.map(s => s.id).join(',')
      const oldIds = oldSegs.map(s => s.id).join(',')

      if (
        newIds === prevSegmentIds.join(',') &&
        newSegs.length === prevSegmentCount &&
        newIds === oldIds &&
        newConfig.preset === oldConfig?.preset &&
        newConfig.base_tile_style === oldConfig?.base_tile_style &&
        newConfig.show_contours === oldConfig?.show_contours &&
        newConfig.show_hillshade === oldConfig?.show_hillshade &&
        newConfig.show_elevation_labels === oldConfig?.show_elevation_labels &&
        newConfig.contour_color === oldConfig?.contour_color &&
        newConfig.contour_major_color === oldConfig?.contour_major_color &&
        newConfig.contour_opacity === oldConfig?.contour_opacity &&
        newConfig.contour_detail === oldConfig?.contour_detail &&
        newConfig.hillshade_intensity === oldConfig?.hillshade_intensity &&
        newConfig.hillshade_highlight === oldConfig?.hillshade_highlight
      ) {
        // Only segment data changed — update sources + paint properties without full reload
        populateSegmentSources()
        for (const seg of newSegs) {
          if (!seg.visible) continue
          const lineId = `trail-seg-line-${seg.id}`
          const casingId = `trail-seg-casing-${seg.id}`
          const width = seg.width ?? newConfig.route_width ?? 2
          if (mapInstance.getLayer(lineId)) {
            mapInstance.setPaintProperty(lineId, 'line-color', seg.color)
            mapInstance.setPaintProperty(lineId, 'line-width', width)
            mapInstance.setPaintProperty(lineId, 'line-opacity', seg.opacity ?? 0.9)
            mapInstance.setPaintProperty(casingId, 'line-width', width + 3)
          }
        }
        return
      }

      // Full reload needed
      mapReady.value = false
      prevSegmentIds = (newConfig.trail_segments ?? []).map(s => s.id)
      prevSegmentCount = newConfig.trail_segments?.length ?? 0
      if (newConfig.show_contours) await ensureContourProtocol()
      const newStyle = buildMapStyle(newConfig, config.public.mapboxToken, config.public.maptilerToken, getContourTileUrl(newConfig)) as maplibregl.StyleSpecification
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        mapReady.value = true
        if (props.editable) nextTick(() => initOverlayDrag())
      })
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

watch(
  () => props.styleConfig.route_smooth,
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

watch(
  () => props.styleConfig.padding_factor,
  (val) => {
    if (!mapInstance || !mapReady.value || !mapContainer.value) return
    mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
      padding: Math.round(mapContainer.value.offsetHeight * (val ?? 0.15)),
    })
  },
)

// Re-init drag when text_overlays change (new overlays added)
watch(
  () => (props.styleConfig.text_overlays ?? []).length,
  () => {
    if (props.editable && mapReady.value) nextTick(() => initOverlayDrag())
  },
)

onUnmounted(() => {
  for (const inst of interactInstances) inst.unset()
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
  gap: 0.4cqh;
  flex-shrink: 0;
}

.mark-svg {
  width: 4cqh;
  height: 4cqh;
}

/* Editable text: subtle hover indicator */
.editable-text:hover {
  outline: 1.5px dashed rgba(45, 106, 79, 0.35);
  border-radius: 2px;
  cursor: text;
}
.editable-text:focus {
  outline: 1.5px dashed rgba(45, 106, 79, 0.6);
  border-radius: 2px;
}

/* Text overlay layer */
.overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
}

.text-overlay.is-editable {
  pointer-events: auto !important;
  cursor: move !important;
}

.text-overlay.is-editable:hover {
  outline: 1.5px dashed rgba(45, 106, 79, 0.4);
  border-radius: 2px;
}

/* Trail legend */
.trail-legend {
  pointer-events: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.8cqw;
}

.legend-swatch {
  width: 2.2cqw;
  height: 0.35cqh;
  border-radius: 2px;
  flex-shrink: 0;
}

.logo-map {
  pointer-events: none;
}
</style>
