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
      ref="posterCanvasEl"
      class="poster-canvas relative flex flex-col shadow-[0_32px_80px_rgba(0,0,0,0.35)]"
      :style="posterCanvasStyle"
    >

      <!-- ── Inset frame (optional) ───────────────────────────────────────── -->
      <div
        v-if="styleConfig.border_style !== 'none'"
        class="absolute z-20 pointer-events-none"
        :style="frameStyle"
      />

      <!-- ── Top-right controls: undo/redo + zoom lock ────────────────────── -->
      <div
        v-if="editable && mapReady"
        class="poster-controls"
        :class="{ 'map-hovered': mapHovered }"
      >
        <!-- Undo / redo pill -->
        <div class="control-pill">
          <button
            class="control-btn"
            :disabled="!canUndo"
            title="Undo (⌘Z)"
            @click="emit('undo')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clip-rule="evenodd"/>
            </svg>
          </button>
          <span class="control-divider"/>
          <button
            class="control-btn"
            :disabled="!canRedo"
            title="Redo (⌘⇧Z)"
            @click="emit('redo')"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.061.025z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>

        <FreezeControl
          :frozen="styleConfig.map_frozen ?? false"
          :map-hovered="mapHovered"
          @freeze="freezeView"
          @unfreeze="unfreezeView"
        />
      </div>

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

        <!-- Plot mode overlay — instruction banner + cancel -->
        <div
          v-if="plotMode"
          class="absolute top-0 inset-x-0 z-20 flex items-center justify-between pointer-events-none"
          style="padding: 0.8cqh 1.4cqw; background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%);"
        >
          <span style="color: white; font-size: 0.85cqh; font-weight: 600; letter-spacing: 0.06em; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">
            {{ plotMode.segId === 'route-delete-pending'
              ? (plotMode.field === 'start' ? 'Tap route: mark delete start…' : 'Tap route: mark delete end…')
              : `Tap route to set ${plotMode.field === 'start' ? 'start' : 'end'}` }}
          </span>
          <button
            class="pointer-events-auto"
            style="background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.4); color: white; border-radius: 6px; padding: 3px 9px; font-size: 0.75cqh; font-weight: 600; cursor: pointer; backdrop-filter: blur(4px);"
            @click="emit('plot-cancelled')"
          >Cancel</button>
        </div>
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

        <!-- ── Elevation profile ─────────────────────────────────────────── -->
        <ElevationProfile
          v-if="styleConfig.show_elevation_profile && mapReady"
          :map="map"
          :style-config="styleConfig"
        />

        <!-- ── Leader lines + pin label SVG overlay ──────────────────────── -->
        <svg
          v-if="mapReady && (showLeaderLines || showPinOverlay)"
          class="absolute inset-0 w-full h-full"
          style="z-index: 14; overflow: visible; pointer-events: none;"
        >
          <!-- Pin labels with leader lines (labels are draggable) -->
          <g v-if="showPinOverlay">
            <template v-for="pin in pinOverlayItems" :key="pin.id">
              <line
                :x1="pin.dotX" :y1="pin.dotY"
                :x2="pin.labelX" :y2="pin.labelY"
                :stroke="pin.color" :stroke-width="svgLineW"
                :stroke-opacity="pin.opacity * 0.55"
                style="pointer-events: none;"
              />
              <text
                :x="pin.labelX" :y="pin.labelY"
                :text-anchor="pin.anchor"
                :font-size="svgPinFontSize"
                :font-family="styleConfig.pin_font_family ? `'${styleConfig.pin_font_family}', sans-serif` : typography.statsFont"
                :fill="pin.color"
                :opacity="pin.opacity"
                :stroke="styleConfig.background_color ?? '#FFFFFF'"
                stroke-width="3"
                paint-order="stroke fill"
                font-weight="600"
                letter-spacing="0.12em"
                dominant-baseline="middle"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                @pointerdown.stop="editable && startLabelDrag($event, pin.id as 'start' | 'finish')"
                @pointermove="draggingPin === pin.id && onLabelDragMove($event)"
                @pointerup="draggingPin === pin.id && onLabelDragEnd($event)"
                @pointercancel="draggingPin = null"
              >{{ pin.label.toUpperCase() }}</text>
            </template>
          </g>

          <!-- Trail segment leader lines -->
          <g v-if="showLeaderLines">
            <template v-for="item in leaderLineItems" :key="item.id">
              <circle :cx="item.dotX" :cy="item.dotY" :r="svgDotR" :fill="item.color"
                :stroke="styleConfig.background_color ?? '#FFFFFF'" :stroke-width="svgDotStroke"
                vector-effect="non-scaling-stroke" style="pointer-events: none;" />
              <line
                :x1="item.dotX" :y1="item.dotY"
                :x2="item.labelX" :y2="item.labelY"
                :stroke="item.color" :stroke-width="svgLineW" stroke-opacity="0.6"
                style="pointer-events: none;"
              />
              <text
                :x="item.labelX" :y="item.labelY"
                :text-anchor="item.anchor"
                :font-size="svgLeaderFontSize"
                :font-family="`'${styleConfig.font_family}', sans-serif`"
                :fill="item.color"
                :stroke="styleConfig.background_color ?? '#FFFFFF'"
                stroke-width="3"
                paint-order="stroke fill"
                font-weight="700"
                letter-spacing="0.1em"
                dominant-baseline="middle"
                :style="editable ? 'pointer-events: all; cursor: grab; user-select: none;' : 'pointer-events: none;'"
                @pointerdown.stop="editable && startLeaderDrag($event, item.id)"
                @pointermove="draggingLeader === item.id && onLeaderDragMove($event)"
                @pointerup="draggingLeader === item.id && onLeaderDragEnd($event, item.id)"
                @pointercancel="draggingLeader = null"
              >{{ item.name }}</text>
            </template>
          </g>
        </svg>

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
        <div v-if="styleConfig.show_branding !== false" class="poster-mark">
          <svg viewBox="0 0 32 32" fill="none" class="mark-svg" :style="{ color: styleConfig.label_text_color, opacity: '0.4' }">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.9" fill="none"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.65" fill="none" opacity="0.6"/>
            <circle cx="11" cy="8" r="1.1" fill="currentColor"/>
          </svg>
          <span class="mark-label" :style="markLabelStyle">RAD MAPS</span>
          <span class="branding-note" :style="brandingNoteStyle">radmaps.studio</span>
        </div>

      </div>

      <!-- ── Text overlays (poster-level — can span header, map, footer) ──── -->
      <div
        v-if="(styleConfig.text_overlays ?? []).length > 0"
        class="overlay-layer"
        style="pointer-events: none;"
        @click.self="selectedOverlayId = null"
      >
        <div
          v-for="overlay in styleConfig.text_overlays"
          :key="overlay.id"
          :data-overlay-id="overlay.id"
          class="text-overlay"
          :class="{ 'is-editable': editable, 'is-selected': editable && selectedOverlayId === overlay.id }"
          :style="overlayStyle(overlay)"
          @click.stop="editable ? onOverlayClick(overlay.id) : undefined"
        >
          {{ overlay.content }}
          <template v-if="editable">
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

    </div>
  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMapStyle, CONTOUR_THRESHOLDS } from '~/utils/mapStyle'
import { sliceRouteByPercent, excludeRangesFromRoute, trailSourceId, findRoutePercent, getAllRouteCoords, getRouteEndpoints } from '~/utils/trail'
import { getPosterTypography, getPosterLayout, toFontStack } from '~/utils/posterData'
import { PRINT_SIZES } from '~/types'
import type { StyleConfig, TrailMap, TextOverlay } from '~/types'
import FreezeControl from '~/components/map/FreezeControl.vue'
import ElevationProfile from '~/components/map/ElevationProfile.vue'

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
  editable?: boolean
  /** When set, the map enters crosshair mode: user taps to set a segment or crop position */
  plotMode?: { segId: string; field: 'start' | 'end' } | null
  canUndo?: boolean
  canRedo?: boolean
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
  'freeze-changed': [payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number] }]
  /** Fired when user taps the route in plot mode; parent should update the segment and clear plotMode */
  'segment-plotted': [payload: { segId: string; field: 'start' | 'end'; pct: number }]
  /** Fired when user cancels plot mode (Escape key or cancel button) */
  'plot-cancelled': []
  /** Fired when user drags a pin label to a new position */
  'label-moved': [payload: { pin: 'start' | 'finish'; lnglat: [number, number] }]
  /** Fired when user drags a trail segment label to a new position */
  'segment-label-moved': [payload: { id: string; lnglat: [number, number] }]
  /** Fired (debounced) when map pan/zoom changes so the view can be persisted */
  'view-changed': [payload: { map_zoom: number; map_center: [number, number] }]
  'undo': []
  'redo': []
}>()

const config = useRuntimeConfig()
const mapContainer = ref<HTMLDivElement | null>(null)
const posterCanvasEl = ref<HTMLDivElement | null>(null)
const mapReady = ref(false)
const liveZoom = ref<number | undefined>(undefined)
const mapHovered = ref(false)
let mapInstance: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null
let interactInstances: Array<{ unset: () => void }> = []

// ── Plot mode (map-tap segment/crop position picking) ─────────────────────────
let plotGhostMarker: maplibregl.Marker | null = null
let plotAnimFrame = 0
let plotRouteCoords: number[][] = []

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
let deselectTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDeselect() {
  if (deselectTimer) clearTimeout(deselectTimer)
  deselectTimer = setTimeout(() => { selectedOverlayId.value = null }, 2000)
}

function onOverlayClick(id: string) {
  if (deselectTimer) clearTimeout(deselectTimer)
  selectedOverlayId.value = id
  emit('overlay-selected', id)
  scheduleDeselect()
}

function onOverlayDelete(id: string) {
  selectedOverlayId.value = null
  emit('overlay-deleted', id)
}

function onResizeStart(e: PointerEvent, id: string) {
  const overlay = props.styleConfig.text_overlays?.find(o => o.id === id)
  if (!overlay || !posterCanvasEl.value) return
  e.preventDefault()

  const startY = e.clientY
  const startSize = overlay.font_size
  const containerH = posterCanvasEl.value.offsetHeight

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
    scheduleDeselect()
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

const typography = computed(() => getPosterTypography(props.styleConfig))

const layout = computed(() => getPosterLayout(props.styleConfig))

// ── Poster content ────────────────────────────────────────────────────────────

const trailName = computed(() =>
  props.styleConfig.trail_name || props.map.title || 'Your Trail',
)

const locationLine = computed(() => {
  const text = props.styleConfig.location_text?.trim() || (props.map.stats as Record<string, unknown> & { location?: string })?.location?.trim() || ''
  return text ? text.toUpperCase() : ''
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

function getTextHalo() {
  const bg = props.styleConfig.background_color ?? '#FFF'
  // 8-direction solid offsets create a crisp outline; blur fills any gaps
  return [
    `-2px -2px 0 ${bg}`, `0 -2px 0 ${bg}`, `2px -2px 0 ${bg}`,
    `-2px 0 0 ${bg}`,                        `2px 0 0 ${bg}`,
    `-2px 2px 0 ${bg}`,  `0 2px 0 ${bg}`,  `2px 2px 0 ${bg}`,
    `0 0 4px ${bg}`,
  ].join(', ')
}

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
  fontSize: `${typography.value.titleSize * (props.styleConfig.title_scale ?? 1.0)}cqh`,
  lineHeight: typography.value.titleLineHeight,
  color: fg.value,
  textAlign: layout.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
  margin: '0',
  padding: '0',
  outline: 'none',
  textShadow: getTextHalo(),
}))

const locationLineStyle = computed(() => ({
  fontFamily: typography.value.subFont,
  fontWeight: typography.value.subWeight,
  letterSpacing: typography.value.subTracking,
  fontSize: `${typography.value.subSize * (props.styleConfig.subtitle_scale ?? 1.0)}cqh`,
  color: fg.value,
  opacity: '0.5',
  textTransform: 'uppercase' as const,
  textAlign: layout.value.titleAlign === 'left' ? 'left' as const : 'center' as const,
  margin: '0',
  padding: '0',
  outline: 'none',
  textShadow: getTextHalo(),
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
  fontSize: `${0.95 * (props.styleConfig.occasion_scale ?? 1.0)}cqh`,
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
  textShadow: getTextHalo(),
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
    fontStyle: o.italic ? 'italic' : 'normal',
    transform: `translateX(${xOffset})`,
    whiteSpace: 'pre',
    width: 'max-content',
    pointerEvents: props.editable ? 'auto' : 'none',
    cursor: props.editable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: '8',
    // Halo: skip when bg_color is set (the pill background already provides contrast)
    ...(!o.bg_color ? { textShadow: getTextHalo() } : {}),
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
  visibleNamedSegments.value.length > 0 &&
  props.styleConfig.trail_label_style !== 'leader-lines',
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

// ── SVG overlay state (leader lines + pin labels) ─────────────────────────────
// All positions are in px relative to the map container, recomputed on every
// map move/zoom via recomputeOverlays(). Sizes scale with container height so
// they look correct at both browser-preview and Puppeteer print dimensions.

interface LeaderItem {
  id: string
  name: string
  color: string
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

interface PinItem {
  id: 'start' | 'finish'
  label: string
  color: string
  opacity: number
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

const containerDims  = ref({ w: 0, h: 0 })
const leaderLineItems = ref<LeaderItem[]>([])
const pinOverlayItems = ref<PinItem[]>([])
const draggingPin    = ref<'start' | 'finish' | null>(null)
const draggingLeader = ref<string | null>(null)

const svgDotR         = computed(() => Math.max(1.5, containerDims.value.h * 0.00125))
const svgDotStroke    = computed(() => Math.max(0.5, containerDims.value.h * 0.0003))
const svgLineW        = computed(() => Math.max(0.8, containerDims.value.h * 0.0012))
const svgPinFontSize  = computed(() => Math.max(11,  containerDims.value.h * 0.022))
const svgLeaderFontSize = computed(() => Math.max(9, containerDims.value.h * 0.014) * (props.styleConfig.leader_label_scale ?? 1.0))
const svgPinOffset    = computed(() => Math.max(40,  containerDims.value.h * 0.07))

const showLeaderLines = computed(() =>
  props.styleConfig.trail_label_style === 'leader-lines' &&
  (props.styleConfig.trail_segments ?? []).some(s => s.visible && s.name),
)
const showPinOverlay = computed(() =>
  mapReady.value && (
    (props.styleConfig.show_start_pin !== false) ||
    (props.styleConfig.show_finish_pin !== false)
  ),
)

function recomputeOverlays() {
  if (!mapInstance || !mapContainer.value) return
  const W = mapContainer.value.offsetWidth
  const H = mapContainer.value.offsetHeight
  containerDims.value = { w: W, h: H }
  const offset = svgPinOffset.value

  // ── Pin labels ────────────────────────────────────────────────────────────
  // Skip recomputing dot/label positions while the user is actively dragging
  // (pinOverlayItems is updated live in onLabelDragMove instead)
  if (draggingPin.value) {
    // Still need to reproject the dot position for the active drag
    for (let i = 0; i < pinOverlayItems.value.length; i++) {
      const pin = pinOverlayItems.value[i]
      const marker = pin.id === 'start' ? startMarker : finishMarker
      if (!marker) continue
      const pt = mapInstance.project(marker.getLngLat())
      pinOverlayItems.value[i] = { ...pin, dotX: pt.x, dotY: pt.y }
    }
  } else {
    const newPins: PinItem[] = []
    const pinColor   = props.styleConfig.pin_color   ?? props.styleConfig.label_text_color ?? '#1C1917'
    const pinOpacity = props.styleConfig.pin_opacity ?? 0.9

    for (const which of ['start', 'finish'] as const) {
      const show = which === 'start'
        ? props.styleConfig.show_start_pin !== false
        : props.styleConfig.show_finish_pin !== false
      if (!show) continue

      const marker = which === 'start' ? startMarker : finishMarker
      if (!marker) continue

      const ll = marker.getLngLat()
      const pt = mapInstance.project(ll)
      if (pt.x < -offset * 2 || pt.x > W + offset * 2 || pt.y < -offset * 2 || pt.y > H + offset * 2) continue

      const label = which === 'start'
        ? (props.styleConfig.start_pin_label ?? 'Start')
        : (props.styleConfig.finish_pin_label ?? 'Finish')

      // Use saved label lnglat (from prior drag) or auto-offset from dot
      const savedLabelLnglat = which === 'start'
        ? props.styleConfig.start_label_lnglat
        : props.styleConfig.finish_label_lnglat

      let labelX: number, labelY: number, anchor: 'start' | 'end'
      if (savedLabelLnglat) {
        const lp = mapInstance.project(savedLabelLnglat as [number, number])
        labelX = lp.x
        labelY = lp.y
        anchor = lp.x < pt.x ? 'end' : 'start'
      } else {
        // Default: start label goes upper-left, finish goes upper-right
        anchor = which === 'start' ? 'end' : 'start'
        labelX = which === 'start' ? pt.x - offset * 0.7 : pt.x + offset * 0.7
        labelY = pt.y - offset * 0.8
      }

      newPins.push({ id: which, label, color: pinColor, opacity: pinOpacity, dotX: pt.x, dotY: pt.y, labelX, labelY, anchor })
    }
    pinOverlayItems.value = newPins
  }

  // ── Trail leader lines ────────────────────────────────────────────────────
  if (!showLeaderLines.value) { leaderLineItems.value = []; return }

  // While dragging a leader label, only reproject the dot; keep label pos
  if (draggingLeader.value) {
    leaderLineItems.value = leaderLineItems.value.map(item => {
      const seg = (props.styleConfig.trail_segments ?? []).find(s => s.id === item.id)
      if (!seg) return item
      const allC   = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
      const idx    = Math.min(Math.floor(allC.length * seg.section_start / 100), allC.length - 1)
      if (idx < 0) return item
      const pt = mapInstance.project([allC[idx][0], allC[idx][1]] as [number, number])
      return { ...item, dotX: pt.x, dotY: pt.y }
    })
    return
  }

  const allCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)

  interface Candidate { seg: NonNullable<typeof props.styleConfig.trail_segments>[number]; dotX: number; dotY: number }
  const candidates: Candidate[] = []

  for (const seg of (props.styleConfig.trail_segments ?? [])) {
    if (!seg.visible || !seg.name) continue
    const idx = Math.min(Math.floor(allCoords.length * seg.section_start / 100), allCoords.length - 1)
    if (idx < 0) continue
    const [lng, lat] = allCoords[idx]
    const pt = mapInstance.project([lng, lat])
    // Include segments slightly off-screen too (leader line still useful)
    if (pt.x < -W * 0.5 || pt.x > W * 1.5 || pt.y < -H * 0.5 || pt.y > H * 1.5) continue
    candidates.push({ seg, dotX: pt.x, dotY: pt.y })
  }

  // Place label on the side closest to each segment's start dot position
  const leftCandidates  = candidates.filter(c => c.dotX <= W / 2).sort((a, b) => a.dotY - b.dotY)
  const rightCandidates = candidates.filter(c => c.dotX  > W / 2).sort((a, b) => a.dotY - b.dotY)

  // Pull labels in from edges so text doesn't get clipped
  const leftX  = W * 0.13
  const rightX = W * 0.87
  const vMargin = H * 0.08

  function evenY(count: number): number[] {
    if (count === 0) return []
    if (count === 1) return [H / 2]
    return Array.from({ length: count }, (_, i) => vMargin + (H - 2 * vMargin) * i / (count - 1))
  }

  const leftYs  = evenY(leftCandidates.length)
  const rightYs = evenY(rightCandidates.length)

  const items: LeaderItem[] = []

  for (let i = 0; i < leftCandidates.length; i++) {
    const c = leftCandidates[i]
    let labelX = leftX
    let labelY = leftYs[i]
    let anchor: 'start' | 'end' = 'end'
    // Use saved label position if the user dragged it
    if (c.seg.label_lnglat) {
      const lp = mapInstance.project(c.seg.label_lnglat as [number, number])
      labelX = lp.x; labelY = lp.y
      anchor = lp.x < c.dotX ? 'end' : 'start'
    }
    items.push({ id: c.seg.id, name: c.seg.name, color: c.seg.color, dotX: c.dotX, dotY: c.dotY, labelX, labelY, anchor })
  }
  for (let i = 0; i < rightCandidates.length; i++) {
    const c = rightCandidates[i]
    let labelX = rightX
    let labelY = rightYs[i]
    let anchor: 'start' | 'end' = 'start'
    if (c.seg.label_lnglat) {
      const lp = mapInstance.project(c.seg.label_lnglat as [number, number])
      labelX = lp.x; labelY = lp.y
      anchor = lp.x < c.dotX ? 'end' : 'start'
    }
    items.push({ id: c.seg.id, name: c.seg.name, color: c.seg.color, dotX: c.dotX, dotY: c.dotY, labelX, labelY, anchor })
  }

  leaderLineItems.value = items
}

// ── Pin label drag (label moves, dot stays at route endpoint) ─────────────────

function startLabelDrag(e: PointerEvent, pinId: 'start' | 'finish') {
  draggingPin.value = pinId
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onLabelDragMove(e: PointerEvent) {
  if (!draggingPin.value || !mapContainer.value || !mapInstance) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  pinOverlayItems.value = pinOverlayItems.value.map(pin => {
    if (pin.id !== draggingPin.value) return pin
    const anchor: 'start' | 'end' = x < pin.dotX ? 'end' : 'start'
    return { ...pin, labelX: x, labelY: y, anchor }
  })
}

function onLabelDragEnd(e: PointerEvent) {
  if (!draggingPin.value || !mapContainer.value || !mapInstance) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const lngLat = mapInstance.unproject([x, y])
  emit('label-moved', { pin: draggingPin.value, lnglat: [lngLat.lng, lngLat.lat] })
  draggingPin.value = null
}

// ── Trail segment label drag ──────────────────────────────────────────────────

function startLeaderDrag(e: PointerEvent, segId: string) {
  draggingLeader.value = segId
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onLeaderDragMove(e: PointerEvent) {
  if (!draggingLeader.value || !mapContainer.value) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  leaderLineItems.value = leaderLineItems.value.map(item => {
    if (item.id !== draggingLeader.value) return item
    const anchor: 'start' | 'end' = x < item.dotX ? 'end' : 'start'
    return { ...item, labelX: x, labelY: y, anchor }
  })
}

function onLeaderDragEnd(e: PointerEvent, segId: string) {
  if (!draggingLeader.value || !mapContainer.value || !mapInstance) return
  const rect = mapContainer.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const lngLat = mapInstance.unproject([x, y])
  emit('segment-label-moved', { id: segId, lnglat: [lngLat.lng, lngLat.lat] })
  draggingLeader.value = null
}

// ── Map lifecycle ─────────────────────────────────────────────────────────────

const FULL_RELOAD_KEYS: (keyof StyleConfig)[] = [
  'preset', 'base_tile_style',
  'show_contours', 'show_hillshade', 'show_elevation_labels',
  'contour_color', 'contour_major_color', 'contour_opacity', 'contour_detail',
  'hillshade_intensity', 'hillshade_highlight',
  'show_roads', 'roads_color', 'roads_opacity',
  'show_place_labels', 'place_labels_color', 'place_labels_opacity', 'place_labels_scale',
  'show_poi_labels', 'poi_labels_color', 'poi_labels_opacity',
  // trail_segments intentionally absent — segment ID changes are detected below,
  // and data-only changes (section_start/end, color, width) use the fast path.
  'tile_effect',
  'route_color_mode',
  'map_3d',
  'segment_casing_width',
  'segment_casing_color',
  'segment_dot_size',
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

  // Restore saved zoom/center whenever they exist (user panned/zoomed before),
  // regardless of whether the map is frozen. Frozen = non-interactive only.
  const hasSavedView = props.styleConfig.map_zoom != null && props.styleConfig.map_center != null

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style,
    ...(hasSavedView
      ? { center: props.styleConfig.map_center as [number, number], zoom: props.styleConfig.map_zoom as number }
      : { bounds: props.map.bbox, fitBoundsOptions: { padding: Math.round(mapContainer.value.offsetHeight * (props.styleConfig.padding_factor ?? 0.15)) } }),
    attributionControl: false,
    interactive: props.editable !== false && !(props.styleConfig.map_frozen),
  })

  // Debounced view-change emitter so pan/zoom is auto-saved without flooding saves
  let viewSaveTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleViewSave() {
    if (!mapInstance || !props.editable) return
    if (viewSaveTimer) clearTimeout(viewSaveTimer)
    viewSaveTimer = setTimeout(() => {
      if (!mapInstance) return
      const z = mapInstance.getZoom()
      const c = mapInstance.getCenter()
      emit('view-changed', { map_zoom: z, map_center: [c.lng, c.lat] })
    }, 800)
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
    recomputeOverlays()
  })

  mapInstance.on('zoom', () => {
    liveZoom.value = mapInstance?.getZoom()
    recomputeOverlays()
  })

  mapInstance.on('move', recomputeOverlays)
  mapInstance.on('moveend', scheduleViewSave)

  resizeObserver = new ResizeObserver(() => {
    mapInstance?.resize()
    recomputeOverlays()
  })
  resizeObserver.observe(mapContainer.value)
})

// ── Route smoothing (moving-window average) ───────────────────────────────────
// Chaikin corner-cutting is ineffective on dense GPS tracks because individual
// corner cuts are sub-pixel. A moving window average instead drags each point
// toward the mean of its neighborhood — this visibly rounds GPS jitter at any
// point density.

const SMOOTH_PRESETS = [
  null,                        // 0 — Off
  { radius: 2,  passes: 1 },  // 1
  { radius: 3,  passes: 2 },  // 2
  { radius: 4,  passes: 2 },  // 3
  { radius: 6,  passes: 3 },  // 4
  { radius: 8,  passes: 3 },  // 5
  { radius: 10, passes: 4 },  // 6
  { radius: 13, passes: 4 },  // 7
  { radius: 16, passes: 5 },  // 8
  { radius: 20, passes: 5 },  // 9
  { radius: 25, passes: 6 },  // 10 — Max
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
  const cropStart = props.styleConfig.route_crop_start ?? 0
  const cropEnd = props.styleConfig.route_crop_end ?? 100
  const deletedRanges = props.styleConfig.route_deleted_ranges ?? []
  const hasModification = cropStart > 0 || cropEnd < 100 || deletedRanges.length > 0
  const processed = hasModification
    ? excludeRangesFromRoute(raw, cropStart, cropEnd, deletedRanges)
    : raw

  const iterations = props.styleConfig.route_smooth ?? 0
  const geojson = smoothGeojson(processed, iterations)
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

// ── Start / finish pin markers ────────────────────────────────────────────────
// The dot sits fixed at the route endpoint. Drag the SVG text label instead.
// The leader line stretches from the fixed dot to wherever the label is placed.

let startMarker: maplibregl.Marker | null = null
let finishMarker: maplibregl.Marker | null = null

function makePinDotEl(): HTMLElement {
  const color   = props.styleConfig.pin_color ?? props.styleConfig.label_text_color ?? '#1C1917'
  const opacity = props.styleConfig.pin_opacity ?? 0.9
  const size    = Math.max(10, (containerDims.value.h || 600) * 0.015)
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, 'border-radius:50%',
    `background:${color}`, `opacity:${opacity}`,
    `border:${Math.max(2, size * 0.18)}px solid rgba(255,255,255,0.85)`,
    'box-shadow:0 1px 6px rgba(0,0,0,0.4)',
    'cursor:default', 'pointer-events:none',
  ].join(';')
  return el
}

function placePinMarkers() {
  if (!mapInstance) return

  startMarker?.remove(); startMarker = null
  finishMarker?.remove(); finishMarker = null

  const { start: routeStart, finish: routeFinish } = getRouteEndpoints(props.map.geojson as GeoJSON.FeatureCollection)

  const startCoord: [number, number] | null = routeStart
  const endCoord:   [number, number] | null = routeFinish

  if (startCoord && props.styleConfig.show_start_pin !== false) {
    startMarker = new maplibregl.Marker({ element: makePinDotEl(), anchor: 'center', draggable: false })
      .setLngLat(startCoord)
      .addTo(mapInstance)
  }

  if (endCoord && props.styleConfig.show_finish_pin !== false) {
    finishMarker = new maplibregl.Marker({ element: makePinDotEl(), anchor: 'center', draggable: false })
      .setLngLat(endCoord)
      .addTo(mapInstance)
  }

  nextTick(recomputeOverlays)
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
  if (!props.editable || !posterCanvasEl.value) return
  // Clean up previous instances
  for (const inst of interactInstances) inst.unset()
  interactInstances = []

  const { default: interact } = await import('interactjs')

  // Use the poster canvas as the bounds reference so overlays can be dragged
  // over the header and footer bands, not just the map area.
  const container = posterCanvasEl.value
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
          scheduleDeselect()
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
        nextTick(recomputeOverlays)
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
          mapInstance.setPaintProperty(casingId, 'line-width', width + (newConfig.segment_casing_width ?? 3))
        }
      }
      nextTick(recomputeOverlays)
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

    // Re-place pin markers when visibility or dot appearance changes
    if (
      newConfig.show_start_pin    !== oldConfig?.show_start_pin    ||
      newConfig.show_finish_pin   !== oldConfig?.show_finish_pin   ||
      newConfig.pin_color         !== oldConfig?.pin_color         ||
      newConfig.pin_opacity       !== oldConfig?.pin_opacity       ||
      newConfig.route_color       !== oldConfig?.route_color       ||
      newConfig.label_text_color  !== oldConfig?.label_text_color
    ) {
      placePinMarkers()
    }

    // Recompute SVG overlay when label-affecting config changes
    if (
      newConfig.trail_label_style   !== oldConfig?.trail_label_style   ||
      newConfig.start_pin_label     !== oldConfig?.start_pin_label     ||
      newConfig.finish_pin_label    !== oldConfig?.finish_pin_label    ||
      newConfig.pin_font_family     !== oldConfig?.pin_font_family     ||
      JSON.stringify(newConfig.start_label_lnglat)  !== JSON.stringify(oldConfig?.start_label_lnglat)  ||
      JSON.stringify(newConfig.finish_label_lnglat) !== JSON.stringify(oldConfig?.finish_label_lnglat)
    ) {
      nextTick(recomputeOverlays)
    }
  },
  { deep: true },
)

watch(
  () => props.styleConfig.route_smooth,
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

watch(
  [() => props.styleConfig.route_crop_start, () => props.styleConfig.route_crop_end],
  () => { if (mapInstance && mapReady.value) populateRouteSource() },
)

watch(
  () => props.styleConfig.route_deleted_ranges,
  (newRanges, oldRanges) => {
    if (!mapInstance || !mapReady.value) return
    const isGradient = (props.styleConfig.route_color_mode ?? 'solid') === 'gradient'
    const hadRanges = (oldRanges ?? []).length > 0
    const hasRanges = (newRanges ?? []).length > 0
    // In gradient mode, crossing the empty↔non-empty boundary changes both the
    // source lineMetrics flag and the layer paint (line-gradient vs line-color).
    // A full style reload is required — same path as FULL_RELOAD_KEYS.
    if (isGradient && hadRanges !== hasRanges) {
      mapReady.value = false
      const newStyle = buildMapStyle(props.styleConfig, config.public.mapboxToken, config.public.maptilerToken, getContourTileUrl(props.styleConfig)) as maplibregl.StyleSpecification
      mapInstance.setStyle(newStyle)
      mapInstance.once('styledata', () => {
        populateRouteSource()
        populateSegmentSources()
        placePinMarkers()
        apply3DTerrain()
        if (props.styleConfig.map_frozen && props.styleConfig.map_zoom != null && props.styleConfig.map_center != null) {
          mapInstance!.jumpTo({ zoom: props.styleConfig.map_zoom, center: props.styleConfig.map_center as [number, number] })
        }
        mapReady.value = true
        if (props.editable) nextTick(() => initOverlayDrag())
        nextTick(recomputeOverlays)
      })
      return
    }
    populateRouteSource()
  },
  { deep: true },
)

// ── Plot mode: crosshair + ghost marker + click handler ───────────────────────

function nearestRouteCoord(lngLat: maplibregl.LngLat): [number, number] {
  let bestIdx = 0, bestDist = Infinity
  for (let i = 0; i < plotRouteCoords.length; i++) {
    const dx = plotRouteCoords[i][0] - lngLat.lng
    const dy = plotRouteCoords[i][1] - lngLat.lat
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return [plotRouteCoords[bestIdx][0], plotRouteCoords[bestIdx][1]]
}

function onPlotMouseMove(e: maplibregl.MapMouseEvent) {
  if (!plotGhostMarker || plotRouteCoords.length === 0) return
  cancelAnimationFrame(plotAnimFrame)
  plotAnimFrame = requestAnimationFrame(() => {
    const [lng, lat] = nearestRouteCoord(e.lngLat)
    plotGhostMarker!.setLngLat([lng, lat])
  })
}

function onPlotClick(e: maplibregl.MapMouseEvent) {
  if (!props.plotMode || !mapInstance) return
  const pct = findRoutePercent([e.lngLat.lng, e.lngLat.lat], props.map.geojson as GeoJSON.FeatureCollection)
  emit('segment-plotted', { segId: props.plotMode.segId, field: props.plotMode.field, pct })
}

function onPlotKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('plot-cancelled')
}

watch(
  () => props.plotMode,
  (mode, prevMode) => {
    if (!mapInstance) return

    // Tear down previous plot mode
    if (prevMode) {
      mapInstance.getCanvas().style.cursor = ''
      mapInstance.off('mousemove', onPlotMouseMove)
      mapInstance.off('click', onPlotClick)
      document.removeEventListener('keydown', onPlotKeydown)
      cancelAnimationFrame(plotAnimFrame)
      if (plotGhostMarker) { plotGhostMarker.remove(); plotGhostMarker = null }
    }

    if (!mode) return

    // Pre-compute route coords for fast nearest-point lookup
    plotRouteCoords = getAllRouteCoords(props.map.geojson as GeoJSON.FeatureCollection)
    if (plotRouteCoords.length === 0) return

    // Position ghost marker at current segment position
    const pct = mode.field === 'start'
      ? (mode.segId === 'route-crop'
          ? (props.styleConfig.route_crop_start ?? 0)
          : (props.styleConfig.trail_segments ?? []).find(s => s.id === mode.segId)?.section_start ?? 0)
      : (mode.segId === 'route-crop'
          ? (props.styleConfig.route_crop_end ?? 100)
          : (props.styleConfig.trail_segments ?? []).find(s => s.id === mode.segId)?.section_end ?? 100)
    const idx = Math.round((pct / 100) * Math.max(plotRouteCoords.length - 1, 0))
    const initCoord = plotRouteCoords[Math.min(idx, plotRouteCoords.length - 1)]

    // Create ghost marker element
    const isDeleteMode = mode.segId === 'route-delete-pending'
    const isStart = mode.field === 'start'
    const markerColor = isDeleteMode ? '#EA580C' : (isStart ? '#2D6A4F' : '#C1121F')
    const el = document.createElement('div')
    el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${markerColor};border:3px solid white;box-shadow:0 0 0 2px ${markerColor},0 2px 6px rgba(0,0,0,0.4);pointer-events:none;`
    plotGhostMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([initCoord[0], initCoord[1]])
      .addTo(mapInstance)

    mapInstance.getCanvas().style.cursor = 'crosshair'
    mapInstance.on('mousemove', onPlotMouseMove)
    mapInstance.on('click', onPlotClick)
    document.addEventListener('keydown', onPlotKeydown)
  },
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
// (e.g. from StylePanel or restored from DB on page load).
// Also jumps to saved position when frozen state is restored from DB — the map
// may have initialized with bounds before the DB record loaded, so we need
// to explicitly reposition it here.

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
      if (props.styleConfig.map_zoom != null && props.styleConfig.map_center != null) {
        mapInstance.jumpTo({
          zoom: props.styleConfig.map_zoom,
          center: props.styleConfig.map_center as [number, number],
        })
      }
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
  plotGhostMarker?.remove()
  document.removeEventListener('keydown', onPlotKeydown)
  cancelAnimationFrame(plotAnimFrame)
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
  z-index: 25;
}

.text-overlay.is-editable {
  pointer-events: auto !important;
  cursor: move !important;
  position: relative;
  border-radius: 2px;
  outline: 1.5px dashed transparent;
  transition: outline-color 0.2s;
}

.text-overlay.is-editable:hover {
  outline-color: rgba(45, 106, 79, 0.35);
}

.text-overlay.is-editable.is-selected {
  outline-color: rgba(45, 106, 79, 0.65);
}

/* Delete + resize buttons: hidden by default, revealed on hover/selected */
.overlay-delete-btn,
.overlay-resize-handle {
  opacity: 0;
  transform: scale(0.6);
  pointer-events: none !important;
  transition: opacity 0.18s, transform 0.18s;
}

.text-overlay.is-editable:hover .overlay-delete-btn,
.text-overlay.is-editable:hover .overlay-resize-handle,
.text-overlay.is-editable.is-selected .overlay-delete-btn,
.text-overlay.is-editable.is-selected .overlay-resize-handle {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto !important;
}

/* Delete button — top-right corner */
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
  touch-action: none;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.overlay-delete-btn:hover {
  background: rgb(220, 38, 38);
  transform: scale(1.1) !important;
}

/* Resize handle — bottom-right corner */
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

/* ── Top-right poster controls group (undo/redo + zoom lock) ───────────────── */
.poster-controls {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.55;
  transition: opacity 0.2s ease;
  pointer-events: auto;
}
.poster-controls.map-hovered {
  opacity: 0.9;
}
.poster-controls:hover {
  opacity: 1;
}

/* Shared pill for undo/redo buttons */
.control-pill {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6B7280;
  transition: background 0.12s, color 0.12s;
}
.control-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
  color: #1C1917;
}
.control-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.control-divider {
  width: 1px;
  height: 14px;
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}
</style>
