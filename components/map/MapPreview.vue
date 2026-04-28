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

      <!-- ── Freeze control (poster-level, top-right) ──────────────────────── -->
      <FreezeControl
        v-if="editable && mapReady"
        :frozen="styleConfig.map_frozen ?? false"
        :map-hovered="mapHovered"
        @freeze="freezeView"
        @unfreeze="unfreezeView"
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

        <!-- Thin rule at top — only for bottom-positioned header -->
        <div v-if="layout.titlePosition === 'bottom'" class="poster-rule" :style="ruleStyle" />

        <!-- Trail name — static or editable -->
        <h1
          v-if="!editable && styleConfig.labels?.show_title !== false"
          class="poster-trail-name"
          :style="trailNameStyle"
        >{{ trailName }}</h1>
        <h1
          v-else-if="editable"
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

        <!-- Thin rule at bottom — only for top-positioned header -->
        <div v-if="layout.titlePosition === 'top'" class="poster-rule" :style="ruleStyle" />
      </div>

      <!-- ── MAP (hero — takes all remaining height) ─────────────────────── -->
      <div ref="mapContainer" class="relative flex-1 overflow-hidden" :style="mapAreaStyle"
        @mouseenter="mapHovered = true" @mouseleave="mapHovered = false"
      >
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
          :style="{ pointerEvents: editable && selectedOverlayId ? 'auto' : 'none' }"
          @click.self="selectedOverlayId = null"
        >
          <div
            v-for="overlay in styleConfig.text_overlays"
            :key="overlay.id"
            :data-overlay-id="overlay.id"
            class="text-overlay"
            :class="{ 'is-editable': editable }"
            :style="overlayStyle(overlay)"
            @click.stop="editable ? onOverlayClick(overlay.id) : undefined"
          >
            {{ overlay.content }}
            <template v-if="editable && selectedOverlayId === overlay.id">
              <!-- Delete button -->
              <button
                class="overlay-delete-btn"
                title="Remove"
                @click.stop="onOverlayDelete(overlay.id)"
                @pointerdown.stop
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              <!-- Resize handle -->
              <div
                class="overlay-resize-handle"
                title="Drag to resize"
                @pointerdown.stop.prevent="onResizeStart($event, overlay.id)"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="9" height="9">
                  <path d="M13.5 6.5L17 10l-3.5 3.5V6.5zM6.5 13.5L3 10l3.5-3.5v7z" opacity="0.8"/>
                </svg>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Vignette overlay ──────────────────────────────────────────── -->
        <div
          v-if="styleConfig.show_vignette"
          class="absolute inset-0 pointer-events-none"
          style="z-index: 11;"
          :style="vignetteStyle"
        />

        <!-- ── Film grain overlay ────────────────────────────────────────── -->
        <svg
          v-if="grainOpacity > 0"
          class="absolute inset-0 w-full h-full pointer-events-none"
          style="z-index: 11; mix-blend-mode: overlay;"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noiseOut"/>
            <feColorMatrix type="saturate" values="0" in="noiseOut"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-noise)" :opacity="grainOpacity"/>
        </svg>
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

          <div v-if="coords && styleConfig.labels?.show_location !== false" class="stat-divider" :style="dividerStyle" />

          <div v-if="coords && styleConfig.labels?.show_location !== false" class="stat-block stat-block--coords">
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
import FreezeControl from '~/components/map/FreezeControl.vue'

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
  'overlay-deleted': [id: string]
  'overlay-resized': [payload: { id: string; font_size: number }]
  'edit-requested': [payload: { field: 'trail_name' | 'occasion_text' | 'location_text'; value: string }]
  // Emitted when the user freezes/unfreezes the view from the FreezeControl widget
  'freeze-changed': [payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number] }]
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)
const liveZoom = ref<number | undefined>(undefined)
const mapHovered = ref(false)
let mapInstance: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null
let interactInstances: Array<{ unset: () => void }> = []

// ── Tile effect protocol (styledtile://) ──────────────────────────────────────
// Intercepts raster tile fetches and applies per-pixel colour transforms:
//   duotone   — remaps luminance to the poster's shadow + highlight colours
//   posterize — quantises each channel to N discrete levels
//
// URL format: styledtile://{effect},{...params}|{realTileUrl}
// Params are baked into the URL so MapLibre cache-busts on any config change.

let tileEffectProtocolRegistered = false

// Per-session cache: keyed by the full styledtile:// URL (includes all effect params).
// Stable when zoom is frozen — same tile coords → same URL → cache hit.
const _tileCache = new Map<string, ArrayBuffer>()

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function ensureTileEffectProtocol() {
  if (tileEffectProtocolRegistered) return
  tileEffectProtocolRegistered = true

  maplibregl.addProtocol('styledtile', async (params: { url: string }, abortController: AbortController) => {
    // Check cache first — avoids re-processing the same tile when params haven't changed
    const cached = _tileCache.get(params.url)
    if (cached) return { data: cached }

    const withoutScheme = params.url.slice('styledtile://'.length)
    const pipeIdx = withoutScheme.indexOf('|')
    if (pipeIdx === -1) throw new Error('Invalid styledtile URL: missing | separator')

    const effectPart = withoutScheme.slice(0, pipeIdx)
    const realUrl    = withoutScheme.slice(pipeIdx + 1)
    const [effect, ...args] = effectPart.split(',')

    const res = await fetch(realUrl, { signal: abortController.signal })
    if (!res.ok) throw new Error(`Tile fetch failed: ${res.status}`)

    const blob = await res.blob()
    const img  = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(img.width, img.height)
    const ctx  = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imgData = ctx.getImageData(0, 0, img.width, img.height)
    const d = imgData.data

    if (effect === 'duotone') {
      // args: [shadowHex, highlightHex, strengthPercent]
      const sh = args[0], hi = args[1]
      const strength = parseInt(args[2]) / 100
      const sr = parseInt(sh.slice(0, 2), 16), sg = parseInt(sh.slice(2, 4), 16), sb = parseInt(sh.slice(4, 6), 16)
      const hr = parseInt(hi.slice(0, 2), 16), hg = parseInt(hi.slice(2, 4), 16), hb = parseInt(hi.slice(4, 6), 16)
      for (let i = 0; i < d.length; i += 4) {
        // Perceptual luminance
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
        // Lerp from shadow to highlight, then blend with original by strength
        d[i]     = Math.round(d[i]     + (sr + (hr - sr) * lum - d[i])     * strength)
        d[i + 1] = Math.round(d[i + 1] + (sg + (hg - sg) * lum - d[i + 1]) * strength)
        d[i + 2] = Math.round(d[i + 2] + (sb + (hb - sb) * lum - d[i + 2]) * strength)
        // alpha unchanged
      }
    } else if (effect === 'posterize') {
      // args: [levels]
      const levels = Math.max(2, parseInt(args[0]))
      const step = 255 / (levels - 1)
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = Math.round(Math.round(d[i]     / step) * step)
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step)
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step)
      }
    } else if (effect === 'layer-color') {
      // args: [shadowHex, midHex, highlightHex]
      // Trilinear luminance-band mapping:
      //   L → 0   : pure shadow colour
      //   L → 0.5 : pure midtone colour
      //   L → 1   : pure highlight colour
      const sr = hexToRgb(args[0]), mr = hexToRgb(args[1]), hr = hexToRgb(args[2])
      for (let i = 0; i < d.length; i += 4) {
        const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        const sw = Math.max(0, 1 - L * 2)           // 1 at L=0, 0 at L≥0.5
        const hw = Math.max(0, (L - 0.5) * 2)        // 0 at L≤0.5, 1 at L=1
        const mw = 1 - sw - hw                        // peaks at L=0.5
        d[i]     = Math.round(sr.r * sw + mr.r * mw + hr.r * hw)
        d[i + 1] = Math.round(sr.g * sw + mr.g * mw + hr.g * hw)
        d[i + 2] = Math.round(sr.b * sw + mr.b * mw + hr.b * hw)
        // alpha unchanged
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const resultBlob = await canvas.convertToBlob({ type: 'image/png' })
    const buffer = await resultBlob.arrayBuffer()

    // Cache the result (bounded to ~200 tiles to avoid unbounded memory growth)
    if (_tileCache.size < 200) _tileCache.set(params.url, buffer)

    return { data: buffer }
  })
}

// ── maplibre-contour protocol ─────────────────────────────────────────────────
// Set up once per component mount. The DemSource registers a custom
// "dem-contour://" tile protocol with MapLibre that generates vector contour
// tiles on-the-fly from free AWS terrarium DEM tiles at any elevation interval.

let mlDemSource: any = null

async function ensureContourProtocol() {
  if (mlDemSource) return
  const mlContour = await import('maplibre-contour') as any
  // UMD module: DemSource lives on .default under ESM interop, fall back to root
  const { DemSource } = mlContour.default ?? mlContour
  mlDemSource = new DemSource({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: 'terrarium',
    maxzoom: 15,
    // worker: true — DEM decoding runs in its own thread; the ArrayBuffer it
    // returns to MapLibre is always clean (never double-transferred), which
    // fixes the DataCloneError / blank tile that worker:false caused.
    worker: true,
  })
  mlDemSource.setupMaplibre(maplibregl)
}

function getContourTileUrl(cfg: StyleConfig): string | undefined {
  if (!cfg.show_contours || !mlDemSource) return undefined
  const detail = Math.round(cfg.contour_detail ?? 3)
  const thresholds = CONTOUR_THRESHOLDS[detail] ?? CONTOUR_THRESHOLDS[3]
  // overzoom: 2 — fetch DEM tiles 2 zoom levels higher than the map zoom,
  // giving accurate contours even when the poster is zoomed out to fit a long route.
  return mlDemSource.contourProtocolUrl({ thresholds, overzoom: 2 })
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

const selectedOverlayId = ref<string | null>(null)
const resizePreview = ref<{ id: string; font_size: number } | null>(null)

function onOverlayClick(id: string) {
  selectedOverlayId.value = id
  emit('overlay-selected', id)
}

function onOverlayDelete(id: string) {
  selectedOverlayId.value = null
  emit('overlay-deleted', id)
}

function onResizeStart(e: PointerEvent, id: string) {
  const overlay = props.styleConfig.text_overlays?.find(o => o.id === id)
  if (!overlay || !mapContainer.value) return
  e.preventDefault()

  const startY = e.clientY
  const startSize = overlay.font_size
  const containerH = mapContainer.value.offsetHeight

  resizePreview.value = { id, font_size: startSize }

  function onMove(e: PointerEvent) {
    const dy = e.clientY - startY
    const newSize = Math.max(0.5, Math.min(10, startSize + (dy / containerH) * 10))
    resizePreview.value = { id, font_size: newSize }
  }

  function onUp() {
    if (resizePreview.value) {
      emit('overlay-resized', { id, font_size: parseFloat(resizePreview.value.font_size.toFixed(2)) })
    }
    resizePreview.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
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
  // ── Family B ──────────────────────────────────────────────────────────────
  editorial: {
    titleFont: "'Playfair Display', serif",
    titleWeight: '400',
    titleTracking: '0.02em',
    titleCase: 'none',
    titleSize: '5.0cqh',
    titleLineHeight: '1.1',
    subFont: "'Playfair Display', serif",
    subWeight: '400',
    subTracking: '0.18em',
    subSize: '1.0cqh',
    statsFont: "'Libre Baskerville', serif",
    statsWeight: '400',
  },
  bauhaus: {
    titleFont: "'Big Shoulders Display', sans-serif",
    titleWeight: '900',
    titleTracking: '-0.02em',
    titleCase: 'uppercase',
    titleSize: '6.8cqh',
    titleLineHeight: '0.9',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: '0.95cqh',
    statsFont: "'Big Shoulders Display', sans-serif",
    statsWeight: '700',
  },
  vintage: {
    titleFont: "'DM Serif Display', serif",
    titleWeight: '400',
    titleTracking: '0.04em',
    titleCase: 'none',
    titleSize: '5.2cqh',
    titleLineHeight: '1.08',
    subFont: "'DM Serif Display', serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: '1.0cqh',
    statsFont: "'DM Sans', sans-serif",
    statsWeight: '400',
  },
  brutalist: {
    titleFont: "'Bebas Neue', sans-serif",
    titleWeight: '400',
    titleTracking: '0.07em',
    titleCase: 'uppercase',
    titleSize: '7.2cqh',
    titleLineHeight: '0.92',
    subFont: "'DM Sans', sans-serif",
    subWeight: '700',
    subTracking: '0.35em',
    subSize: '0.9cqh',
    statsFont: "'Bebas Neue', sans-serif",
    statsWeight: '400',
  },
  risograph: {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '500',
    titleTracking: '0.10em',
    titleCase: 'uppercase',
    titleSize: '5.0cqh',
    titleLineHeight: '1.0',
    subFont: "'Oswald', sans-serif",
    subWeight: '300',
    subTracking: '0.25em',
    subSize: '1.0cqh',
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '500',
  },
  blueprint: {
    titleFont: "'Space Grotesk', sans-serif",
    titleWeight: '700',
    titleTracking: '0.14em',
    titleCase: 'uppercase',
    titleSize: '4.2cqh',
    titleLineHeight: '1.05',
    subFont: "'Space Grotesk', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: '0.9cqh',
    statsFont: "'Space Grotesk', sans-serif",
    statsWeight: '600',
  },
  kertok: {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '200',
    titleTracking: '0.06em',
    titleCase: 'none',
    titleSize: '4.6cqh',
    titleLineHeight: '1.12',
    subFont: "'Work Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.20em',
    subSize: '0.95cqh',
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '300',
  },
  'mid-century': {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '400',
    titleTracking: '0.16em',
    titleCase: 'uppercase',
    titleSize: '4.4cqh',
    titleLineHeight: '1.05',
    subFont: "'Work Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.30em',
    subSize: '0.95cqh',
    statsFont: "'Oswald', sans-serif",
    statsWeight: '400',
  },
  'topo-art': {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '400',
    titleTracking: '0.28em',
    titleCase: 'uppercase',
    titleSize: '3.6cqh',
    titleLineHeight: '1.15',
    subFont: "'Work Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.22em',
    subSize: '0.95cqh',
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '400',
  },
  'dark-sky': {
    titleFont: "'Fjalla One', sans-serif",
    titleWeight: '400',
    titleTracking: '0.08em',
    titleCase: 'uppercase',
    titleSize: '5.4cqh',
    titleLineHeight: '1.0',
    subFont: "'DM Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.35em',
    subSize: '1.0cqh',
    statsFont: "'Fjalla One', sans-serif",
    statsWeight: '400',
  },
}

interface LayoutProfile {
  titleAlign: 'center' | 'left'
  titlePosition: 'top' | 'bottom'
}

const THEME_LAYOUT: Record<string, LayoutProfile> = {
  // Family A — classic centered top
  chalk:         { titleAlign: 'center', titlePosition: 'top' },
  topaz:         { titleAlign: 'center', titlePosition: 'top' },
  dusk:          { titleAlign: 'center', titlePosition: 'top' },
  obsidian:      { titleAlign: 'center', titlePosition: 'top' },
  forest:        { titleAlign: 'center', titlePosition: 'top' },
  midnight:      { titleAlign: 'center', titlePosition: 'top' },
  // Family B — varied layouts
  editorial:     { titleAlign: 'left',   titlePosition: 'top' },    // magazine — left-aligned masthead
  bauhaus:       { titleAlign: 'left',   titlePosition: 'bottom' }, // Bauhaus poster — title anchored at base
  vintage:       { titleAlign: 'center', titlePosition: 'top' },    // vintage national park — centered crown
  brutalist:     { titleAlign: 'left',   titlePosition: 'bottom' }, // raw/stark — title slammed to bottom-left
  risograph:     { titleAlign: 'left',   titlePosition: 'top' },    // printmaking — left-block header
  blueprint:     { titleAlign: 'left',   titlePosition: 'bottom' }, // technical drawing — title block at foot
  kertok:        { titleAlign: 'left',   titlePosition: 'top' },    // spare minimal — left-flush top
  'mid-century': { titleAlign: 'center', titlePosition: 'bottom' }, // retro poster — centered title foot
  'topo-art':    { titleAlign: 'center', titlePosition: 'top' },    // art print — centred crown
  'dark-sky':    { titleAlign: 'center', titlePosition: 'bottom' }, // dramatic — text at bottom, sky above
}

const SERIF_FONTS = new Set(['Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'DM Serif Display'])

function toFontStack(family: string) {
  return `'${family}', ${SERIF_FONTS.has(family) ? 'serif' : 'sans-serif'}`
}

const typography = computed((): TypographyProfile => {
  const base = THEME_TYPOGRAPHY[props.styleConfig.color_theme ?? 'chalk'] ?? THEME_TYPOGRAPHY.chalk
  const titleOverride = props.styleConfig.font_family
  if (titleOverride) {
    const bodyOverride = props.styleConfig.body_font_family ?? titleOverride
    return {
      ...base,
      titleFont: toFontStack(titleOverride as string),
      subFont: toFontStack(bodyOverride as string),
      statsFont: toFontStack(bodyOverride as string),
    }
  }
  return base
})

const layout = computed((): LayoutProfile =>
  THEME_LAYOUT[props.styleConfig.color_theme ?? 'chalk'] ?? THEME_LAYOUT.chalk,
)

// ── Poster content ────────────────────────────────────────────────────────────

const trailName = computed(() =>
  props.styleConfig.trail_name || props.map.title || 'Your Trail',
)

const locationLine = computed(() => {
  const parts: string[] = []
  if (props.styleConfig.labels?.show_location !== false) {
    const loc = props.styleConfig.location_text || props.map.stats?.location
    if (loc) parts.push(loc.toUpperCase())
  }
  if (props.styleConfig.labels?.show_elevation_gain !== false) {
    const elev = props.map.stats?.max_elevation_m
    if (elev) parts.push(`${Math.round(elev).toLocaleString()} M ELEV.`)
  }
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
  padding: layout.value.titlePosition === 'bottom' ? '2.4cqh 7cqw 3.5cqh' : '5cqh 7cqw 2.8cqh',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: layout.value.titleAlign === 'left' ? 'flex-start' : 'center',
  justifyContent: 'center',
  gap: '1.1cqh',
  position: 'relative' as const,
  order: layout.value.titlePosition === 'top' ? '0' : '1',
}))

const trailNameStyle = computed(() => ({
  fontFamily: typography.value.titleFont,
  fontWeight: typography.value.titleWeight,
  letterSpacing: typography.value.titleTracking,
  textTransform: typography.value.titleCase === 'uppercase' ? 'uppercase' as const : 'none' as const,
  fontSize: typography.value.titleSize,
  lineHeight: typography.value.titleLineHeight,
  color: fg.value,
  textAlign: layout.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
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
  textAlign: layout.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
  margin: '0',
  padding: '0',
  outline: 'none',
}))

const ruleStyle = computed(() => ({
  width: '100%',
  height: '1px',
  backgroundColor: fg.value,
  opacity: '0.12',
  marginTop: layout.value.titlePosition === 'bottom' ? '0' : '0.4cqh',
  flexShrink: '0',
}))

const footerBandStyle = computed(() => ({
  backgroundColor: bg.value,
  color: fg.value,
  paddingTop: props.styleConfig.border_style !== 'none' ? 'calc(1.8cqh + 14px)' : '1.8cqh',
  paddingBottom: props.styleConfig.border_style !== 'none' ? 'calc(1.8cqh + 14px)' : '1.8cqh',
  paddingLeft: '7cqw',
  paddingRight: '7cqw',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative' as const,
  borderTop: borderW.value !== '0' ? `${borderW.value} solid ${fg.value}1a` : `1px solid ${fg.value}0d`,
  order: '2',
}))

const mapAreaStyle = computed(() => ({
  order: layout.value.titlePosition === 'top' ? '1' : '0',
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
  const fontSize = resizePreview.value?.id === o.id ? resizePreview.value.font_size : o.font_size
  const isSelected = props.editable && selectedOverlayId.value === o.id
  return {
    position: 'absolute',
    left: `${o.x}%`,
    top: `${o.y}%`,
    fontFamily: toFontStack(o.font_family),
    fontSize: `${fontSize}cqh`,
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
    ...(isSelected ? { outline: '1.5px dashed rgba(45,106,79,0.7)', borderRadius: '2px' } : {}),
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
  const hasBorder = props.styleConfig.border_style !== 'none'
  const edge = hasBorder ? 'calc(2% + 20px)' : '2%'
  const posStyles: Record<string, string> = {
    'bottom-left': `bottom: ${edge}; left: ${edge};`,
    'bottom-right': `bottom: ${edge}; right: ${edge};`,
    'top-left': `top: ${edge}; left: ${edge};`,
    'top-right': `top: ${edge}; right: ${edge};`,
  }
  const parts = posStyles[pos]?.split(';').filter(Boolean) ?? []
  const style: Record<string, string> = {
    position: 'absolute',
    zIndex: '9',
    background: bg.value,
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

// ── Vignette + grain computed values ─────────────────────────────────────────

const vignetteStyle = computed(() => {
  const intensity = props.styleConfig.vignette_intensity ?? 0.45
  // Dark themes get a pure-black vignette; light themes get a softer version
  const isDark = ['obsidian', 'forest', 'midnight'].includes(props.styleConfig.color_theme ?? '')
  const alpha = isDark ? intensity : intensity * 0.65
  return {
    background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${alpha.toFixed(2)}) 100%)`,
  }
})

const grainOpacity = computed(() => props.styleConfig.tile_grain ?? 0)

// ── Map lifecycle ─────────────────────────────────────────────────────────────

const FULL_RELOAD_KEYS: (keyof StyleConfig)[] = [
  'preset', 'base_tile_style',
  'show_contours', 'show_hillshade', 'show_elevation_labels',
  'contour_color', 'contour_major_color', 'contour_opacity', 'contour_detail',
  'hillshade_intensity', 'hillshade_highlight',
  'show_roads',
  // trail_segments intentionally absent — segment ID changes are detected below,
  // and data-only changes (section_start/end, color, width) use the fast path.
  'tile_effect',
  'route_color_mode',
  'map_3d',
]

// Computes a cache key for all parameters baked into the styledtile:// URL.
// When this key changes, MapLibre needs a full style reload to re-fetch tiles.
function effectiveTileKey(cfg: StyleConfig): string {
  const effect = cfg.tile_effect ?? 'none'
  if (effect === 'duotone') {
    const shadow    = cfg.label_text_color ?? '#1C1917'
    const highlight = cfg.background_color ?? '#F7F4EF'
    const strength  = Math.round((cfg.tile_duotone_strength ?? 0.9) * 100)
    return `duo:${shadow}:${highlight}:${strength}`
  }
  if (effect === 'posterize') {
    return `post:${cfg.tile_posterize_levels ?? 4}`
  }
  if (effect === 'layer-color') {
    const shadow    = cfg.tile_shadow_color    ?? cfg.label_text_color  ?? '#1C1917'
    const highlight = cfg.tile_highlight_color ?? cfg.background_color  ?? '#F7F4EF'
    const mid       = cfg.tile_midtone_color   ?? 'auto'
    return `lc:${shadow}:${mid}:${highlight}`
  }
  return 'none'
}

onMounted(async () => {
  await nextTick()
  if (!mapContainer.value) return

  // Register tile effect protocol unconditionally — cheap and avoids
  // conditional logic when the user enables duotone/posterize later.
  ensureTileEffectProtocol()
  if (props.styleConfig.show_contours) await ensureContourProtocol()
  const style = buildMapStyle(props.styleConfig, config.public.mapboxToken, config.public.maptilerToken, getContourTileUrl(props.styleConfig)) as maplibregl.StyleSpecification

  const frozen = props.styleConfig.map_frozen && props.styleConfig.map_zoom != null && props.styleConfig.map_center != null

  if (frozen) {
    // Restore saved view state — exact zoom + center from when the user froze the frame.
    mapInstance = new maplibregl.Map({
      container: mapContainer.value,
      style,
      center: props.styleConfig.map_center as [number, number],
      zoom: props.styleConfig.map_zoom as number,
      attributionControl: false,
      interactive: false,
    })
  } else {
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
  }

  mapInstance.on('load', () => {
    populateRouteSource()
    populateSegmentSources()
    placePinMarkers()
    setPaintBackground()
    apply3DTerrain()
    mapReady.value = true
    liveZoom.value = mapInstance!.getZoom()
    if (props.editable) initOverlayDrag()
  })

  mapInstance.on('zoom', () => {
    liveZoom.value = mapInstance?.getZoom()
  })

  resizeObserver = new ResizeObserver(() => mapInstance?.resize())
  resizeObserver.observe(mapContainer.value)
})

// ── Route smoothing (moving-window average) ───────────────────────────────────
// Chaikin corner-cutting is ineffective on dense GPS tracks because individual
// corner cuts are sub-pixel. A moving window average instead drags each point
// toward the mean of its neighborhood — this visibly rounds GPS jitter at any
// point density.

const SMOOTH_PRESETS = [
  null,                        // 0 — Off
  { radius: 3,  passes: 2 },  // 1 — Light
  { radius: 6,  passes: 3 },  // 2 — Gentle
  { radius: 10, passes: 4 },  // 3 — Medium
  { radius: 16, passes: 5 },  // 4 — Strong
  { radius: 25, passes: 6 },  // 5 — Max
]

function smoothLine(coords: number[][], strength: number): number[][] {
  const preset = SMOOTH_PRESETS[strength]
  if (!preset || coords.length < 3) return coords

  const { radius, passes } = preset
  let pts = coords.map(c => c.slice())

  for (let p = 0; p < passes; p++) {
    const out = pts.map(c => c.slice())
    for (let i = 1; i < pts.length - 1; i++) {
      const lo = Math.max(0, i - radius)
      const hi = Math.min(pts.length - 1, i + radius)
      const n = hi - lo + 1
      out[i] = pts[i].map((_, dim) => {
        let sum = 0
        for (let j = lo; j <= hi; j++) sum += pts[j][dim]
        return sum / n
      })
    }
    pts = out
    // Always keep the start and finish points anchored
    pts[0] = coords[0].slice()
    pts[pts.length - 1] = coords[coords.length - 1].slice()
  }

  return pts
}

function smoothGeojson(geojson: GeoJSON.FeatureCollection, strength: number): GeoJSON.FeatureCollection {
  if (strength === 0) return geojson
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return { ...feature, geometry: { ...g, coordinates: smoothLine(g.coordinates, strength) } }
      }
      if (g.type === 'MultiLineString') {
        return { ...feature, geometry: { ...g, coordinates: g.coordinates.map(line => smoothLine(line, strength)) } }
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
  const handleFeatures: GeoJSON.Feature[] = []

  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible) continue
    const sliced = sliceRouteByPercent(props.map.geojson as GeoJSON.FeatureCollection, seg.section_start, seg.section_end)
    const src = mapInstance.getSource(trailSourceId(seg)) as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(sliced)

    // Collect start + end handle dots for this segment
    const coords = (sliced.features[0]?.geometry as GeoJSON.LineString | undefined)?.coordinates
    if (coords && coords.length >= 2) {
      handleFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { color: seg.color } })
      handleFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { color: seg.color } })
    }
  }

  const handleSrc = mapInstance.getSource('segment-handles') as maplibregl.GeoJSONSource | undefined
  if (handleSrc) handleSrc.setData({ type: 'FeatureCollection', features: handleFeatures })
}

// ── Text-label start / finish markers ────────────────────────────────────────
// Renders themed "START" / "FINISH" text pills as MapLibre DOM overlays so they
// appear correctly in both the browser preview and Puppeteer screenshots.
// Colors and font are pulled from the live styleConfig + typography computed
// so they always stay in sync with the poster's theme.

let startMarker: maplibregl.Marker | null = null
let finishMarker: maplibregl.Marker | null = null

// diagonal pin: dot sits at the anchor corner; line + label extend inward
function makePinEl(label: string, direction: 'left' | 'right'): HTMLElement {
  const color = props.styleConfig.label_text_color || '#1C1917'
  const font  = typography.value.statsFont
  const W = 60, H = 28
  // dot is at the anchor corner (bottom-right for 'left', bottom-left for 'right')
  const dotX = direction === 'left' ? W : 0
  const dotY = H
  const lineEndX = direction === 'left' ? 5 : W - 5
  const lineEndY = 7

  const el = document.createElement('div')
  el.style.cssText = `position:relative;width:${W}px;height:${H}px;pointer-events:none;`
  el.innerHTML = `
    <svg width="${W}" height="${H}" style="position:absolute;top:0;left:0;overflow:visible;">
      <line x1="${dotX}" y1="${dotY}" x2="${lineEndX}" y2="${lineEndY}"
            stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
      <circle cx="${dotX}" cy="${dotY}" r="2" fill="${color}"/>
    </svg>
    <span style="
      position:absolute;top:0;${direction === 'left' ? 'left:0' : 'right:0'};
      font-family:${font};font-size:7px;font-weight:600;letter-spacing:0.13em;
      text-transform:uppercase;color:${color};white-space:nowrap;line-height:1;
    ">${label}</span>
  `
  return el
}

// loop pin: dot at bottom-center; two diagonal lines fan out to START (left) and FINISH (right)
function makeLoopPinEl(): HTMLElement {
  const color = props.styleConfig.label_text_color || '#1C1917'
  const font  = typography.value.statsFont
  const W = 112, H = 28
  const dotX = W / 2, dotY = H

  const el = document.createElement('div')
  el.style.cssText = `position:relative;width:${W}px;height:${H}px;pointer-events:none;`
  el.innerHTML = `
    <svg width="${W}" height="${H}" style="position:absolute;top:0;left:0;overflow:visible;">
      <line x1="${dotX}" y1="${dotY}" x2="7" y2="7"
            stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
      <line x1="${dotX}" y1="${dotY}" x2="${W - 7}" y2="7"
            stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
      <circle cx="${dotX}" cy="${dotY}" r="2" fill="${color}"/>
    </svg>
    <span style="
      position:absolute;top:0;left:0;
      font-family:${font};font-size:7px;font-weight:600;letter-spacing:0.13em;
      text-transform:uppercase;color:${color};white-space:nowrap;line-height:1;
    ">Start</span>
    <span style="
      position:absolute;top:0;right:0;
      font-family:${font};font-size:7px;font-weight:600;letter-spacing:0.13em;
      text-transform:uppercase;color:${color};white-space:nowrap;line-height:1;
    ">Finish</span>
  `
  return el
}

function placePinMarkers() {
  if (!mapInstance) return

  startMarker?.remove(); startMarker = null
  finishMarker?.remove(); finishMarker = null

  const features = (props.map.geojson as GeoJSON.FeatureCollection).features
  let startCoord: number[] | null = null
  let endCoord: number[] | null = null

  for (const feature of features) {
    const g = feature.geometry
    if (g.type === 'LineString' && g.coordinates.length > 0) {
      if (!startCoord) startCoord = g.coordinates[0]
      endCoord = g.coordinates[g.coordinates.length - 1]
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) {
        if (line.length > 0) {
          if (!startCoord) startCoord = line[0]
          endCoord = line[line.length - 1]
        }
      }
    }
  }

  // ~330 m threshold — catches marathons/loops where start and finish are close
  const isLoop = !!(startCoord && endCoord &&
    Math.abs(startCoord[0] - endCoord[0]) < 0.003 &&
    Math.abs(startCoord[1] - endCoord[1]) < 0.003)

  if (isLoop && startCoord) {
    startMarker = new maplibregl.Marker({ element: makeLoopPinEl(), anchor: 'bottom' })
      .setLngLat(startCoord as [number, number])
      .addTo(mapInstance)
  } else {
    if (startCoord && props.styleConfig.show_start_pin !== false) {
      startMarker = new maplibregl.Marker({ element: makePinEl('Start', 'left'), anchor: 'bottom-right' })
        .setLngLat(startCoord as [number, number])
        .addTo(mapInstance)
    }
    if (endCoord && props.styleConfig.show_finish_pin !== false) {
      finishMarker = new maplibregl.Marker({ element: makePinEl('Finish', 'right'), anchor: 'bottom-left' })
        .setLngLat(endCoord as [number, number])
        .addTo(mapInstance)
    }
  }
}

function apply3DTerrain() {
  if (!mapInstance) return
  if (props.styleConfig.map_3d && mapInstance.getSource('mapbox-dem')) {
    mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
    mapInstance.easeTo({ pitch: 45, duration: 600 })
  } else {
    try { mapInstance.setTerrain(null as any) } catch {}
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
      ignoreFrom: '.overlay-delete-btn, .overlay-resize-handle',
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
          // Read the logical % position accumulated by the move handler — NOT
          // getBoundingClientRect(), which includes the translateX offset applied
          // by overlayStyle() for center/right alignment and would cause a jump
          // when Vue re-renders the element back to those coordinates.
          const x = Math.round(parseFloat(el.style.left) || 0)
          const y = Math.round(parseFloat(el.style.top)  || 0)
          emit('overlay-moved', { id, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
        },
      },
    })
    interactInstances.push(inst)
  })
}

// ── Style config watcher ──────────────────────────────────────────────────────

watch(
  () => props.styleConfig,
  async (newConfig, oldConfig) => {
    if (!mapInstance || !mapReady.value) return

    // Tile effect params are baked into tile URLs — require a full style rebuild
    const tileKeyChanged = effectiveTileKey(newConfig) !== effectiveTileKey(oldConfig ?? newConfig)

    // Segment source/layer structure changes when segment IDs are added/removed
    const newSegIds = (newConfig.trail_segments ?? []).map(s => s.id).join(',')
    const oldSegIds = (oldConfig?.trail_segments ?? []).map(s => s.id).join(',')
    const segStructureChanged = newSegIds !== oldSegIds

    const needsFullReload = tileKeyChanged || segStructureChanged || FULL_RELOAD_KEYS.some(
      key => JSON.stringify(newConfig[key]) !== JSON.stringify(oldConfig?.[key]),
    )

    if (needsFullReload) {
      // Clear tile cache when effect params change so stale processed tiles aren't reused
      if (tileKeyChanged) _tileCache.clear()
      mapReady.value = false
      if (newConfig.show_contours) await ensureContourProtocol()
      const newStyle = buildMapStyle(newConfig, config.public.mapboxToken, config.public.maptilerToken, getContourTileUrl(newConfig)) as maplibregl.StyleSpecification
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        placePinMarkers()
        apply3DTerrain()
        // setStyle() resets the viewport — restore frozen position before revealing the map
        if (props.styleConfig.map_frozen && props.styleConfig.map_zoom != null && props.styleConfig.map_center != null) {
          mapInstance!.jumpTo({
            zoom: props.styleConfig.map_zoom,
            center: props.styleConfig.map_center as [number, number],
          })
        }
        mapReady.value = true
        if (props.editable) nextTick(() => initOverlayDrag())
      })
      return
    }

    // Segment data changed (section_start/end, color, width, visibility, opacity)
    // — update GeoJSON sources and paint properties without any style reload
    if (JSON.stringify(newConfig.trail_segments) !== JSON.stringify(oldConfig?.trail_segments)) {
      populateSegmentSources()
      const newSegs = newConfig.trail_segments ?? []
      for (const seg of newSegs) {
        const lineId = `trail-seg-line-${seg.id}`
        const casingId = `trail-seg-casing-${seg.id}`
        if (!mapInstance.getLayer(lineId)) continue
        const vis = seg.visible ? 'visible' : 'none'
        mapInstance.setLayoutProperty(lineId, 'visibility', vis)
        mapInstance.setLayoutProperty(casingId, 'visibility', vis)
        if (seg.visible) {
          const width = seg.width ?? newConfig.route_width ?? 2
          mapInstance.setPaintProperty(lineId, 'line-color', seg.color)
          mapInstance.setPaintProperty(lineId, 'line-width', width)
          mapInstance.setPaintProperty(lineId, 'line-opacity', seg.opacity ?? 0.9)
          mapInstance.setPaintProperty(casingId, 'line-width', width + 3)
        }
      }
    }

    if (newConfig.background_color !== oldConfig?.background_color) setPaintBackground()

    // Contour line-width fast path — avoids full reload for width multiplier changes
    if (newConfig.contour_minor_width !== oldConfig?.contour_minor_width) {
      const w = newConfig.contour_minor_width ?? 1
      if (mapInstance.getLayer('contours-minor'))
        mapInstance.setPaintProperty('contours-minor', 'line-width',
          ['interpolate', ['linear'], ['zoom'], 5, 0.8 * w, 14, 1.0 * w])
      if (mapInstance.getLayer('contours-mid'))
        mapInstance.setPaintProperty('contours-mid', 'line-width',
          ['interpolate', ['linear'], ['zoom'], 5, 1.1 * w, 14, 1.5 * w])
    }
    if (newConfig.contour_major_width !== oldConfig?.contour_major_width) {
      const w = newConfig.contour_major_width ?? 1
      if (mapInstance.getLayer('contours-major'))
        mapInstance.setPaintProperty('contours-major', 'line-width',
          ['interpolate', ['linear'], ['zoom'], 5, 1.5 * w, 14, 2.5 * w])
    }

    // Raster layer paint-only updates (contrast / saturation / hue) —
    // these are MapLibre paint properties and don't need a tile re-fetch.
    const rasterLayerId = newConfig.preset === 'topographic' ? 'outdoors-tiles' : 'base-tiles'
    if (newConfig.tile_contrast !== oldConfig?.tile_contrast) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-contrast', newConfig.tile_contrast ?? 0)
    }
    if (newConfig.tile_saturation !== oldConfig?.tile_saturation) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-saturation', newConfig.tile_saturation ?? 0)
    }
    if (newConfig.tile_hue_rotate !== oldConfig?.tile_hue_rotate) {
      if (mapInstance.getLayer(rasterLayerId))
        mapInstance.setPaintProperty(rasterLayerId, 'raster-hue-rotate', newConfig.tile_hue_rotate ?? 0)
    }

    if (mapInstance.getLayer('route-line')) {
      if ((newConfig.route_color_mode ?? 'solid') !== 'gradient') {
        mapInstance.setPaintProperty('route-line', 'line-color', newConfig.route_color)
      }
      mapInstance.setPaintProperty('route-line', 'line-width', newConfig.route_width)
      mapInstance.setPaintProperty('route-line', 'line-opacity', newConfig.route_opacity)
      mapInstance.setPaintProperty('route-line-casing', 'line-width', newConfig.route_width + 4)
      mapInstance.setPaintProperty('route-line-casing', 'line-opacity', newConfig.route_opacity)
    }

    // Re-place pin markers when visibility, colors, or font changes
    if (
      newConfig.show_start_pin    !== oldConfig?.show_start_pin    ||
      newConfig.show_finish_pin   !== oldConfig?.show_finish_pin   ||
      newConfig.route_color       !== oldConfig?.route_color       ||
      newConfig.label_bg_color    !== oldConfig?.label_bg_color    ||
      newConfig.label_text_color  !== oldConfig?.label_text_color  ||
      newConfig.font_family       !== oldConfig?.font_family       ||
      newConfig.body_font_family  !== oldConfig?.body_font_family
    ) {
      placePinMarkers()
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
    // Padding changes only refits when not frozen — frozen view holds its position
    if (props.styleConfig.map_frozen) return
    mapInstance.fitBounds(props.map.bbox as maplibregl.LngLatBoundsLike, {
      padding: Math.round(mapContainer.value.offsetHeight * (val ?? 0.15)),
    })
  },
)

// ── Freeze / unfreeze watcher ─────────────────────────────────────────────────
// Enables / disables interactive pan+zoom when map_frozen changes externally
// (e.g. from StylePanel or restored from DB).

watch(
  () => props.styleConfig.map_frozen,
  (frozen) => {
    if (!mapInstance || !mapReady.value) return
    if (frozen) {
      mapInstance.dragPan.disable()
      mapInstance.scrollZoom.disable()
      mapInstance.doubleClickZoom.disable()
      mapInstance.touchZoomRotate.disable()
      mapInstance.keyboard.disable()
    } else {
      mapInstance.dragPan.enable()
      mapInstance.scrollZoom.enable()
      mapInstance.doubleClickZoom.enable()
      mapInstance.touchZoomRotate.enable()
      mapInstance.keyboard.enable()
    }
  },
)

// ── Freeze / unfreeze API (called by FreezeControl.vue) ───────────────────────

function freezeView() {
  if (!mapInstance) return
  const zoom = mapInstance.getZoom()
  const center = mapInstance.getCenter()
  // Clear tile cache — we're establishing a new fixed tile set
  _tileCache.clear()
  mapInstance.dragPan.disable()
  mapInstance.scrollZoom.disable()
  mapInstance.doubleClickZoom.disable()
  mapInstance.touchZoomRotate.disable()
  mapInstance.keyboard.disable()
  emit('freeze-changed', {
    map_frozen: true,
    map_zoom: zoom,
    map_center: [center.lng, center.lat],
  })
}

function unfreezeView() {
  if (!mapInstance) return
  mapInstance.dragPan.enable()
  mapInstance.scrollZoom.enable()
  mapInstance.doubleClickZoom.enable()
  mapInstance.touchZoomRotate.enable()
  mapInstance.keyboard.enable()
  emit('freeze-changed', { map_frozen: false })
}

defineExpose({ freezeView, unfreezeView })

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
  startMarker?.remove()
  finishMarker?.remove()
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
  position: relative; /* needed for child absolute positioning */
}

.text-overlay.is-editable:hover {
  outline: 1.5px dashed rgba(45, 106, 79, 0.4);
  border-radius: 2px;
}

/* Delete button — top-right corner of selected overlay */
.overlay-delete-btn {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.92);
  color: white;
  border: 1.5px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.overlay-delete-btn:hover {
  background: rgb(220, 38, 38);
  transform: scale(1.1);
}

/* Resize handle — bottom-right corner of selected overlay */
.overlay-resize-handle {
  position: absolute;
  bottom: -9px;
  right: -9px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(45, 106, 79, 0.88);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: se-resize;
  pointer-events: auto !important;
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  border: 1.5px solid white;
}
.overlay-resize-handle:hover {
  background: rgba(35, 88, 64, 0.95);
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
