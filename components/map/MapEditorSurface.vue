<template>
  <div class="flex flex-1 overflow-hidden relative">
    <main class="flex-1 flex flex-col overflow-hidden" @click="onMapAreaClick">
      <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <ClientOnly>
          <MapPreview
            v-if="map"
            ref="mapPreviewRef"
            :map="map"
            :style-config="styleConfig"
            :editable="true"
            :plot-mode="plotMode"
            :delete-brush-active="deleteBrushActive"
            :delete-brush-size="deleteBrushSize"
            :can-undo="canUndo"
            :can-redo="canRedo"
            :chrome-editing="chromeDirectEdit"
            class="w-full h-full"
            @update:trail-name="setStyle({ trail_name: $event })"
            @update:occasion-text="setStyle({ occasion_text: $event })"
            @update:location-text="setStyle({ location_text: $event })"
            @overlay-moved="onOverlayMoved"
            @overlay-selected="onOverlaySelected"
            @overlay-deleted="onOverlayDeleted"
            @overlay-resized="onOverlayResized"
            @overlay-updated="onOverlayUpdated"
            @asset-moved="onAssetMoved"
            @asset-selected="onAssetSelected"
            @asset-deleted="onAssetDeleted"
            @asset-resized="onAssetResized"
            @edit-requested="onEditRequested"
            @poster-text-override="onPosterTextOverride"
            @poster-text-reset="onPosterTextReset"
            @poster-layout-updated="onPosterLayoutUpdated"
            @freeze-changed="onFreezeChanged"
            @segment-plotted="onSegmentPlotted"
            @plot-cancelled="plotMode = null"
            @route-delete-brush-applied="onRouteDeleteBrushApplied"
            @route-delete-brush-cancelled="deleteBrushActive = false"
            @label-moved="onLabelMoved"
            @segment-label-edit-started="onSegmentLabelEditStarted"
            @segment-label-moved="onSegmentLabelMoved"
            @segment-labels-moved="onSegmentLabelsMoved"
            @view-changed="onViewChanged"
            @undo="undo"
            @redo="redo"
          />
        </ClientOnly>
        <div v-if="!map" class="w-full h-full rounded-2xl bg-stone-200 animate-pulse flex items-center justify-center">
          <svg class="w-10 h-10 text-stone-400" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.12"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
      </div>
    </main>

    <aside
      class="shrink-0 overflow-hidden flex flex-col bg-white transition-all duration-300 ease-out"
      :class="[
        'md:relative md:inset-auto md:w-[320px] md:h-auto md:border-l md:border-stone-200 md:rounded-none md:shadow-none',
        'fixed inset-x-0 bottom-0 z-30 md:static',
        sheetState === 'full' ? 'h-[85vh]' :
        sheetState === 'half' ? 'h-[45vh]' :
        'h-16',
      ]"
      style="box-shadow: 0 -4px 20px rgba(0,0,0,0.08);"
    >
      <MapStylePanel
        v-if="map"
        v-model="styleConfig"
        :saving="saving"
        :has-route="!!map.geojson"
        :has-elevation-data="hasElevationData"
        :total-distance-km="map.stats?.distance_km"
        :active-plot-mode="plotMode"
        :active-delete-brush="deleteBrushActive"
        :delete-brush-size="deleteBrushSize"
        :active-text-target="activeTextTarget"
        :scout-available="scoutAvailable"
        :route-stats="routeStats ?? map.stats"
        @reset="resetStyle"
        @logo-upload="emit('logo-upload', $event)"
        @image-upload="emit('image-upload', $event)"
        @toggle-sheet="toggleSheet"
        @swipe-up="onSwipeUp"
        @swipe-down="onSwipeDown"
        @request-plot="onRequestPlot"
        @request-detect-disconnected="onDetectDisconnected"
        @request-brush-delete="onRequestBrushDelete"
        @update-brush-size="deleteBrushSize = $event"
        @request-view-lock="mapPreviewRef?.freezeView()"
        @request-view-edit="mapPreviewRef?.unfreezeView()"
        @request-view-reset="mapPreviewRef?.resetViewToRoute()"
      />
      <div v-else class="flex-1 bg-white animate-pulse" />
    </aside>
  </div>
</template>

<script setup lang="ts">
import type {
  DeletedRange,
  MapAsset,
  MapAssetKind,
  PartialPosterLayout,
  PosterTextOverride,
  PosterTextSlot,
  StyleConfig,
  TextOverlay,
  TrailMap,
} from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { FLAGS } from '~/utils/knownFlags'
import {
  buildElevationProfile,
  detectDisconnectedRanges,
  mergeDeletedRanges,
  mergeDeletedRangesForRoute,
} from '~/utils/trail'

type PosterTextField = 'trail_name' | 'occasion_text' | 'location_text'
type ActiveTextTarget =
  | { type: 'poster-text'; field: PosterTextField }
  | { type: 'text-overlay'; id: string }
  | { type: 'image-overlay'; id: string }
type MapPreviewHandle = {
  freezeView: () => void
  unfreezeView: () => void
  resetViewToRoute: () => void
}

const props = defineProps<{
  map: TrailMap | null
  modelValue: StyleConfig
  saving?: boolean
  scoutAvailable?: boolean
  routeStats?: TrailMap['stats']
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
  'logo-upload': [file: File]
  'image-upload': [payload: { file: File; kind: MapAssetKind; replaceAssetId?: string }]
  'freeze-changed': [payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }]
}>()

const styleConfig = computed({
  get: () => props.modelValue,
  set: (value: StyleConfig) => emit('update:modelValue', value),
})

const mapPreviewRef = ref<MapPreviewHandle | null>(null)
const activeTextTarget = ref<ActiveTextTarget | null>(null)
const sheetState = ref<'closed' | 'half' | 'full'>('half')
const plotMode = ref<{ segId: string; field: 'start' | 'end' } | null>(null)
const pendingDeleteStart = ref<number | null>(null)
const deleteBrushActive = ref(false)
const deleteBrushSize = ref(8)

const undoHistory = ref<StyleConfig[]>([])
const undoIndex = ref(-1)
let historyReady = false
let isUndoRedoing = false
let historyTimer: ReturnType<typeof setTimeout> | null = null

const canUndo = computed(() => undoIndex.value > 0)
const canRedo = computed(() => undoIndex.value < undoHistory.value.length - 1)

const hasElevationData = computed(() => {
  if (!props.map?.geojson) return false
  return buildElevationProfile(props.map.geojson as GeoJSON.FeatureCollection) !== null
})

const chromeDirectEdit = useFeatureFlag(FLAGS.CHROME_DIRECT_EDIT)

onMounted(() => {
  if (window.innerWidth < 768) sheetState.value = 'closed'
  document.addEventListener('keydown', onKeyDown)
  seedHistory(props.modelValue)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (historyTimer) clearTimeout(historyTimer)
})

watch(
  () => props.map?.id,
  () => seedHistory(props.modelValue),
)

watch(
  () => props.modelValue,
  (newConfig) => {
    if (!historyReady || isUndoRedoing) return
    recordHistory(newConfig)
  },
  { deep: true },
)

watch(plotMode, (mode) => { if (!mode) pendingDeleteStart.value = null })

function seedHistory(config: StyleConfig) {
  nextTick(() => {
    undoHistory.value = [JSON.parse(JSON.stringify(config))]
    undoIndex.value = 0
    historyReady = true
  })
}

function setStyle(patch: Partial<StyleConfig>) {
  styleConfig.value = { ...styleConfig.value, ...patch }
}

function resetStyle() {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG }
}

function toggleSheet() {
  if (sheetState.value === 'closed') sheetState.value = 'half'
  else if (sheetState.value === 'half') sheetState.value = 'full'
  else sheetState.value = 'half'
}

function onSwipeUp() {
  if (sheetState.value === 'closed') sheetState.value = 'half'
  else if (sheetState.value === 'half') sheetState.value = 'full'
}

function onSwipeDown() {
  if (sheetState.value === 'full') sheetState.value = 'half'
  else if (sheetState.value === 'half') sheetState.value = 'closed'
}

function onMapAreaClick(e: MouseEvent) {
  if (typeof window === 'undefined' || window.innerWidth >= 768) return
  if (plotMode.value || deleteBrushActive.value || sheetState.value === 'closed') return
  const target = e.target as HTMLElement | null
  if (target?.closest('.maplibregl-canvas, .maplibregl-canvas-container')) sheetState.value = 'closed'
}

function recordHistory(config: StyleConfig) {
  if (!historyReady || isUndoRedoing) return
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    const snapshot = JSON.parse(JSON.stringify(config))
    const trimmed = undoHistory.value.slice(0, undoIndex.value + 1)
    trimmed.push(snapshot)
    if (trimmed.length > 50) trimmed.shift()
    undoHistory.value = trimmed
    undoIndex.value = trimmed.length - 1
  }, 400)
}

function undo() {
  if (!canUndo.value) return
  if (historyTimer) clearTimeout(historyTimer)
  isUndoRedoing = true
  undoIndex.value--
  styleConfig.value = JSON.parse(JSON.stringify(undoHistory.value[undoIndex.value]))
  nextTick(() => { isUndoRedoing = false })
}

function redo() {
  if (!canRedo.value) return
  if (historyTimer) clearTimeout(historyTimer)
  isUndoRedoing = true
  undoIndex.value++
  styleConfig.value = JSON.parse(JSON.stringify(undoHistory.value[undoIndex.value]))
  nextTick(() => { isUndoRedoing = false })
}

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
}

function onRequestPlot(payload: { segId: string; field: 'start' | 'end' }) {
  deleteBrushActive.value = false
  plotMode.value = plotMode.value?.segId === payload.segId && plotMode.value?.field === payload.field ? null : payload
}

function onSegmentPlotted({ segId, field, pct }: { segId: string; field: 'start' | 'end'; pct: number }) {
  const config = styleConfig.value
  if (segId === 'route-crop') {
    styleConfig.value = field === 'start'
      ? { ...config, route_crop_start: Math.min(pct, (config.route_crop_end ?? 100) - 0.1) }
      : { ...config, route_crop_end: Math.max(pct, (config.route_crop_start ?? 0) + 0.1) }
  } else if (segId === 'route-delete-pending') {
    if (field === 'start') {
      pendingDeleteStart.value = pct
      plotMode.value = { segId: 'route-delete-pending', field: 'end' }
      return
    }
    const start = Math.min(pendingDeleteStart.value!, pct)
    const end = Math.max(pendingDeleteStart.value!, pct)
    if (end - start > 0.1) {
      applyDeletedRanges([...(config.route_deleted_ranges ?? []), { start, end }])
    }
    pendingDeleteStart.value = null
  } else {
    const segments = config.trail_segments ?? []
    styleConfig.value = {
      ...config,
      trail_segments: segments.map(s => {
        if (s.id !== segId) return s
        return field === 'start'
          ? { ...s, section_start: Math.min(pct, s.section_end - 0.1) }
          : { ...s, section_end: Math.max(pct, s.section_start + 0.1) }
      }),
    }
  }
  plotMode.value = null
}

function onRequestBrushDelete() {
  deleteBrushActive.value = !deleteBrushActive.value
  if (deleteBrushActive.value) {
    plotMode.value = null
    pendingDeleteStart.value = null
  }
}

function onRouteDeleteBrushApplied({ ranges }: { ranges: DeletedRange[] }) {
  if (!ranges.length) {
    deleteBrushActive.value = false
    return
  }
  applyDeletedRanges([...(styleConfig.value.route_deleted_ranges ?? []), ...ranges])
  deleteBrushActive.value = false
}

function onDetectDisconnected() {
  if (!props.map?.geojson) return
  const detected = detectDisconnectedRanges(props.map.geojson as GeoJSON.FeatureCollection, 50)
  if (!detected.length) return
  applyDeletedRanges([...(styleConfig.value.route_deleted_ranges ?? []), ...detected])
}

function applyDeletedRanges(ranges: DeletedRange[]) {
  styleConfig.value = {
    ...styleConfig.value,
    route_deleted_ranges: props.map?.geojson
      ? mergeDeletedRangesForRoute(props.map.geojson as GeoJSON.FeatureCollection, ranges)
      : mergeDeletedRanges(ranges),
  }
}

function openTextPanelForTarget(target: ActiveTextTarget) {
  activeTextTarget.value = target
  if (window.innerWidth < 768) sheetState.value = 'closed'
}

function onEditRequested(payload: { field: PosterTextField }) {
  openTextPanelForTarget({ type: 'poster-text', field: payload.field })
}

function onOverlaySelected(id: string) {
  openTextPanelForTarget({ type: 'text-overlay', id })
}

function onAssetSelected(id: string) {
  openTextPanelForTarget({ type: 'image-overlay', id })
}

function onOverlayMoved(payload: { id: string; x: number; y: number }) {
  updateOverlay(payload.id, { x: payload.x, y: payload.y })
}

function onOverlayDeleted(id: string) {
  if (activeTextTarget.value?.type === 'text-overlay' && activeTextTarget.value.id === id) activeTextTarget.value = null
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: (styleConfig.value.text_overlays ?? []).filter(o => o.id !== id),
  }
}

function onOverlayResized(payload: { id: string; font_size: number }) {
  updateOverlay(payload.id, { font_size: payload.font_size })
}

function onOverlayUpdated(payload: { id: string; patch: Partial<TextOverlay> }) {
  updateOverlay(payload.id, payload.patch)
}

function updateOverlay(id: string, patch: Partial<TextOverlay>) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(o => o.id === id ? { ...o, ...patch } : o),
  }
}

function onAssetMoved(payload: { id: string; x: number; y: number }) {
  updateAsset(payload.id, { x: payload.x, y: payload.y })
}

function onAssetDeleted(id: string) {
  const asset = styleConfig.value.image_overlays?.find(a => a.id === id)
  if (activeTextTarget.value?.type === 'image-overlay' && activeTextTarget.value.id === id) activeTextTarget.value = null
  const nextAssets = (styleConfig.value.image_overlays ?? []).filter(a => a.id !== id)
  styleConfig.value = {
    ...styleConfig.value,
    image_overlays: nextAssets,
    ...(asset?.kind === 'logo' ? { logo_url: undefined, show_logo: false } : {}),
  }
}

function onAssetResized(payload: { id: string; width: number; height: number }) {
  updateAsset(payload.id, { width: payload.width, height: payload.height })
}

function updateAsset(id: string, patch: Partial<MapAsset>) {
  const assets = styleConfig.value.image_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    image_overlays: assets.map(asset => asset.id === id ? { ...asset, ...patch } : asset),
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
  setStyle({ poster_layout: value })
}

function onFreezeChanged(payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }) {
  setStyle(payload)
  emit('freeze-changed', payload)
}

function onLabelMoved({ pin, lnglat }: { pin: 'start' | 'finish'; lnglat: [number, number] }) {
  styleConfig.value = pin === 'start'
    ? { ...styleConfig.value, start_label_lnglat: lnglat }
    : { ...styleConfig.value, finish_label_lnglat: lnglat }
}

function onSegmentLabelEditStarted({ labels }: { labels: Array<{ id: string; lnglat: [number, number] }> }) {
  const byId = new Map(labels.map(label => [label.id, label.lnglat]))
  updateSegmentsFromLabels(byId)
}

function onSegmentLabelMoved({ id, lnglat }: { id: string; lnglat: [number, number] }) {
  updateSegmentsFromLabels(new Map([[id, lnglat]]))
}

function onSegmentLabelsMoved({ labels }: { labels: Array<{ id: string; lnglat: [number, number] }> }) {
  const byId = new Map(labels.map(label => [label.id, label.lnglat]))
  updateSegmentsFromLabels(byId)
}

function updateSegmentsFromLabels(byId: Map<string, [number, number]>) {
  const segments = (styleConfig.value.trail_segments ?? []).map(s => {
    const lnglat = byId.get(s.id)
    return lnglat ? { ...s, label_lnglat: lnglat } : s
  })
  styleConfig.value = { ...styleConfig.value, trail_segments: segments }
}

function onViewChanged(payload: { map_zoom: number; map_center: [number, number]; map_editor_width: number; map_pitch: number; map_bearing: number }) {
  setStyle(payload)
}
</script>
