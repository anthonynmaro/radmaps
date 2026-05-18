<template>
  <div
    class="flex flex-1 overflow-hidden relative"
    data-testid="map-editor-surface"
    :data-chrome-editing="chromeDirectEdit ? 'true' : 'false'"
  >
    <main
      class="flex-1 flex flex-col overflow-hidden transition-[padding] duration-300 ease-out md:!pb-0"
      :class="[
        sheetState === 'closed' ? 'pb-16' :
        sheetState === 'half' ? 'pb-[45vh]' :
        'pb-[85vh]',
      ]"
      @click="onMapAreaClick"
    >
      <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <div
          v-if="trackImportWarning"
          class="absolute left-4 right-4 top-4 z-20 mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 shadow-sm"
        >
          {{ trackImportWarning }}
        </div>
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
            :segment-draw-mode="segmentDrawMode"
            :segment-edit-mode="segmentEditMode"
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
            @segment-draw-finished="onSegmentDrawFinished"
            @segment-draw-cancelled="segmentDrawMode = null"
            @segment-geometry-edited="onSegmentGeometryEdited"
            @segment-edit-cancelled="segmentEditMode = null"
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
        :active-segment-draw-mode="segmentDrawMode"
        :segment-draw-disabled="segmentDrawDisabled"
        :active-segment-edit-mode="segmentEditMode"
        :segment-edit-disabled="segmentEditDisabled"
        :active-text-target="activeTextTarget"
        :scout-available="scoutAvailable"
        :route-stats="routeStats ?? map.stats"
        :track-upload-available="trackUploadAvailable"
        :track-upload-loading="trackUploadLoading"
        :track-upload-error="trackUploadError"
        @reset="resetStyle"
        @logo-upload="emit('logo-upload', $event)"
        @image-upload="emit('image-upload', $event)"
        @track-upload="onTrackUpload"
        @toggle-sheet="toggleSheet"
        @swipe-up="onSwipeUp"
        @swipe-down="onSwipeDown"
        @request-plot="onRequestPlot"
        @request-segment-draw="onRequestSegmentDraw"
        @request-segment-draw-save="mapPreviewRef?.finishSegmentDraw()"
        @request-segment-draw-cancel="segmentDrawMode = null"
        @request-segment-edit="onRequestSegmentEdit"
        @request-segment-edit-cancel="segmentEditMode = null"
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
  TrailSegment,
} from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { FLAGS } from '~/utils/knownFlags'
import {
  buildElevationProfile,
  detectDisconnectedRanges,
  mergeDeletedRanges,
  mergeDeletedRangesForRoute,
  bboxContainsBbox,
  buildGeometryBackedSegmentPatch,
  extendSegmentCoordinates,
  isGeometryBackedSegment,
  normalizeLineCoords,
  sanitizeSegmentBends,
} from '~/utils/trail'

type PosterTextField = 'trail_name' | 'occasion_text' | 'location_text'
type SegmentDrawMode =
  | { type: 'new' }
  | { type: 'extend'; segId: string; end: 'start' | 'end' }
type SegmentEditMode = { segId: string }
type ActiveTextTarget =
  | { type: 'poster-text'; field: PosterTextField }
  | { type: 'text-overlay'; id: string }
  | { type: 'image-overlay'; id: string }
type MapPreviewHandle = {
  freezeView: () => void
  unfreezeView: () => void
  resetViewToRoute: () => void
  getVisibleBounds: () => [number, number, number, number] | null
  fitToRouteAndSegments: (segmentBboxes?: Array<[number, number, number, number]>) => void
  finishSegmentDraw: () => void
  undoSegmentDrawPoint: () => boolean
}

type TrackUploadResponse = {
  style_config: StyleConfig
  segment: TrailSegment
  outside_current_frame_hint_data?: {
    bbox?: [number, number, number, number]
  }
}

const props = defineProps<{
  map: TrailMap | null
  modelValue: StyleConfig
  saving?: boolean
  scoutAvailable?: boolean
  routeStats?: TrailMap['stats']
  trackUploadAvailable?: boolean
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

const route = useRoute()
const mapPreviewRef = ref<MapPreviewHandle | null>(null)
const activeTextTarget = ref<ActiveTextTarget | null>(null)
const sheetState = ref<'closed' | 'half' | 'full'>('half')
const plotMode = ref<{ segId: string; field: 'start' | 'end' } | null>(null)
const segmentDrawMode = ref<SegmentDrawMode | null>(null)
const segmentEditMode = ref<SegmentEditMode | null>(null)
const pendingDeleteStart = ref<number | null>(null)
const deleteBrushActive = ref(false)
const deleteBrushSize = ref(8)
const trackUploadLoading = ref(false)
const trackUploadError = ref<string | null>(null)
const trackImportWarning = ref<string | null>(null)

const undoHistory = ref<StyleConfig[]>([])
const undoIndex = ref(-1)
let historyReady = false
let isUndoRedoing = false
let historyTimer: ReturnType<typeof setTimeout> | null = null
let trackWarningTimer: ReturnType<typeof setTimeout> | null = null

const canUndo = computed(() => undoIndex.value > 0)
const canRedo = computed(() => undoIndex.value < undoHistory.value.length - 1)
const segmentDrawDisabled = computed(() => Boolean(plotMode.value || deleteBrushActive.value || segmentEditMode.value))
const segmentEditDisabled = computed(() => Boolean(plotMode.value || deleteBrushActive.value || segmentDrawMode.value))

const hasElevationData = computed(() => {
  if (!props.map?.geojson) return false
  return buildElevationProfile(props.map.geojson as GeoJSON.FeatureCollection) !== null
})

const chromeDirectEditFlag = useFeatureFlag(FLAGS.CHROME_DIRECT_EDIT)
const chromeDirectEdit = computed(() => {
  const chromeQuery = route.query.chrome
  const chromeQueryEnabled = chromeQuery === '1' || chromeQuery === 'true'
  return chromeDirectEditFlag.value || (import.meta.dev && chromeQueryEnabled)
})

onMounted(() => {
  if (window.innerWidth < 768) sheetState.value = 'closed'
  document.addEventListener('keydown', onKeyDown)
  seedHistory(props.modelValue)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (historyTimer) clearTimeout(historyTimer)
  if (trackWarningTimer) clearTimeout(trackWarningTimer)
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
  if (plotMode.value || segmentDrawMode.value || segmentEditMode.value || deleteBrushActive.value || sheetState.value === 'closed') return
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
  if (segmentDrawMode.value && mapPreviewRef.value?.undoSegmentDrawPoint()) return
  if (!canUndo.value) return
  if (historyTimer) clearTimeout(historyTimer)
  isUndoRedoing = true
  undoIndex.value--
  styleConfig.value = JSON.parse(JSON.stringify(undoHistory.value[undoIndex.value]))
  nextTick(() => { isUndoRedoing = false })
}

function redo() {
  if (segmentDrawMode.value) return
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
  const key = e.key.toLowerCase()
  if (segmentDrawMode.value && key === 'z') {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (!e.shiftKey) mapPreviewRef.value?.undoSegmentDrawPoint()
    return
  }
  if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
}

function onRequestPlot(payload: { segId: string; field: 'start' | 'end' }) {
  deleteBrushActive.value = false
  segmentDrawMode.value = null
  segmentEditMode.value = null
  plotMode.value = plotMode.value?.segId === payload.segId && plotMode.value?.field === payload.field ? null : payload
}

function onRequestSegmentDraw(payload: SegmentDrawMode) {
  if (segmentDrawDisabled.value) return
  deleteBrushActive.value = false
  plotMode.value = null
  segmentEditMode.value = null
  pendingDeleteStart.value = null
  if (styleConfig.value.map_frozen) mapPreviewRef.value?.unfreezeView()
  const current = segmentDrawMode.value
  const isSameMode = current?.type === payload.type &&
    (payload.type === 'new' || (current?.type === 'extend' && current.segId === payload.segId && current.end === payload.end))
  segmentDrawMode.value = isSameMode ? null : payload
  if (segmentDrawMode.value && typeof window !== 'undefined' && window.innerWidth < 768) sheetState.value = 'closed'
}

function onRequestSegmentEdit(payload: SegmentEditMode) {
  const isSameMode = segmentEditMode.value?.segId === payload.segId
  if (segmentEditDisabled.value && !isSameMode) return
  deleteBrushActive.value = false
  plotMode.value = null
  segmentDrawMode.value = null
  pendingDeleteStart.value = null
  if (styleConfig.value.map_frozen) mapPreviewRef.value?.unfreezeView()
  segmentEditMode.value = isSameMode ? null : payload
  if (segmentEditMode.value && typeof window !== 'undefined' && window.innerWidth < 768) sheetState.value = 'closed'
}

function visibleUploadedSegmentBboxes(config: StyleConfig): Array<[number, number, number, number]> {
  return (config.trail_segments ?? [])
    .filter(segment => segment.visible && segment.source === 'uploaded-track' && segment.bbox)
    .map(segment => segment.bbox as [number, number, number, number])
}

function showTrackImportWarning(message: string) {
  trackImportWarning.value = message
  if (trackWarningTimer) clearTimeout(trackWarningTimer)
  trackWarningTimer = setTimeout(() => {
    trackImportWarning.value = null
    trackWarningTimer = null
  }, 7000)
}

async function onTrackUpload(file: File) {
  if (!props.trackUploadAvailable || !props.map?.id || trackUploadLoading.value) return
  const visibleBoundsBeforeImport = mapPreviewRef.value?.getVisibleBounds()
  trackUploadLoading.value = true
  trackUploadError.value = null
  try {
    const form = new FormData()
    form.append('gpx', file)
    const response = await fetch(`/api/maps/${props.map.id}/tracks`, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to import GPX track')
    }
    const result = await response.json() as TrackUploadResponse
    styleConfig.value = {
      ...DEFAULT_STYLE_CONFIG,
      ...result.style_config,
    }

    const importedBbox = result.segment.bbox ?? result.outside_current_frame_hint_data?.bbox
    const isOutsideCurrentFrame = Boolean(
      visibleBoundsBeforeImport &&
      importedBbox &&
      !bboxContainsBbox(visibleBoundsBeforeImport, importedBbox),
    )

    await nextTick()
    if (isOutsideCurrentFrame) {
      showTrackImportWarning('The uploaded GPX was outside the current map frame, so I zoomed out to include both tracks.')
      mapPreviewRef.value?.fitToRouteAndSegments(visibleUploadedSegmentBboxes(result.style_config))
    }
  } catch (err) {
    trackUploadError.value = err instanceof Error ? err.message : 'Failed to import GPX track'
  } finally {
    trackUploadLoading.value = false
  }
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

function nextSegmentColor(segments: TrailSegment[]) {
  const colors = ['#2D6A4F', '#3A7CA5', '#C1121F', '#E87722', '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E', '#555555', '#FFFFFF']
  const usedColors = segments.map(segment => segment.color)
  return colors.find(color => !usedColors.includes(color)) ?? colors[0]
}

function onSegmentDrawFinished({ mode, coords }: { mode: SegmentDrawMode; coords: Array<[number, number]> }) {
  const config = styleConfig.value
  const segments = config.trail_segments ?? []
  if (mode.type === 'new') {
    if (coords.length < 2) return
    const segment: TrailSegment = {
      id: crypto.randomUUID(),
      name: `Trail ${segments.length + 1}`,
      color: nextSegmentColor(segments),
      visible: true,
      source: 'drawn-track',
      width: 3,
      opacity: 0.9,
      smooth: 0,
      bend: 0,
      dash: false,
      ...buildGeometryBackedSegmentPatch(coords),
    }
    styleConfig.value = { ...config, trail_segments: [...segments, segment] }
  } else {
    const nextSegments = segments.map(segment => {
      if (segment.id !== mode.segId || !isGeometryBackedSegment(segment)) return segment
      const nextCoords = extendSegmentCoordinates(segment, coords, mode.end)
      const geometryPatch = buildGeometryBackedSegmentPatch(nextCoords)
      const { label_lnglat: _labelLngLat, ...rest } = segment
      const addedBends = Array(coords.length).fill(0)
      const previousBends = normalizedSegmentBendsForCoords(segment.bends, segment.geojson ? normalizeLineCoords(segment.geojson).length : 0)
      const nextBends = mode.end === 'start'
        ? [...addedBends, ...previousBends]
        : [...previousBends, ...addedBends]
      return {
        ...rest,
        ...geometryPatch,
        bends: normalizedSegmentBendsForCoords(nextBends, nextCoords.length),
        section_start: segment.section_start,
        section_end: segment.section_end,
      }
    })
    styleConfig.value = { ...config, trail_segments: nextSegments }
  }
  segmentDrawMode.value = null
}

function normalizedSegmentBendsForCoords(bends: number[] | undefined, coordCount: number): number[] {
  return sanitizeSegmentBends(bends, Math.max(0, coordCount - 1))
}

function onSegmentGeometryEdited({ segId, coords, bends }: { segId: string; coords: number[][]; bends?: number[] }) {
  if (coords.length < 2) return
  const segments = styleConfig.value.trail_segments ?? []
  const nextSegments = segments.map(segment => {
    if (segment.id !== segId || !isGeometryBackedSegment(segment)) return segment
    const geometryPatch = buildGeometryBackedSegmentPatch(coords)
    const { label_lnglat: _labelLngLat, ...rest } = segment
    const nextBends = normalizedSegmentBendsForCoords(bends ?? segment.bends, coords.length)
    return {
      ...rest,
      ...geometryPatch,
      bends: nextBends,
      section_start: segment.section_start,
      section_end: segment.section_end,
    }
  })
  styleConfig.value = { ...styleConfig.value, trail_segments: nextSegments }
}

function onRequestBrushDelete() {
  deleteBrushActive.value = !deleteBrushActive.value
  if (deleteBrushActive.value) {
    plotMode.value = null
    segmentDrawMode.value = null
    segmentEditMode.value = null
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
  if (payload.map_frozen) {
    segmentDrawMode.value = null
    segmentEditMode.value = null
  }
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
