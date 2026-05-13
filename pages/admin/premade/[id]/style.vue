<template>
  <div class="fixed inset-0 bg-stone-100 flex flex-col overflow-hidden">
    <header class="bg-white border-b border-stone-200 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">
      <div class="flex items-center gap-2.5 min-w-0">
        <NuxtLink
          to="/admin/premade"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
          </svg>
        </NuxtLink>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-stone-800 leading-none truncate max-w-[160px] sm:max-w-none">
            {{ premade?.title ?? 'Loading premade…' }}
          </p>
          <p class="text-[11px] text-stone-400 mt-0.5 hidden sm:block">
            Admin premade editor · {{ premade?.status || 'draft' }}
          </p>
        </div>
        <span
          v-if="dirty || saving"
          class="hidden sm:inline-flex items-center text-[10px] px-2 py-0.5 rounded-full"
          :class="saving ? 'text-stone-400 bg-stone-100' : 'text-amber-700 bg-amber-100'"
        >
          {{ saving ? 'Saving…' : 'Unsaved changes' }}
        </span>
        <span
          v-else-if="savedOnce"
          class="hidden sm:inline-flex items-center text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full"
        >
          Saved
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          class="flex items-center gap-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 px-3 py-2 rounded-lg transition-colors min-h-[36px] disabled:opacity-50"
          :disabled="!premade || saving || !dirty"
          @click="savePremadeStyle"
        >
          Save
        </button>
        <button
          class="hidden sm:flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2.5 py-2 rounded-lg hover:bg-stone-100 transition-colors min-h-[36px] disabled:opacity-50"
          :disabled="!premade || previewGenerating"
          @click="generatePreview"
        >
          {{ previewGenerating ? 'Generating…' : 'Generate preview' }}
        </button>
      </div>
    </header>

    <div v-if="pending" class="flex-1 flex items-center justify-center text-sm text-stone-500">
      Loading premade map…
    </div>
    <div v-else-if="error || !premade || !previewMap" class="flex-1 flex items-center justify-center p-6">
      <div class="rounded-xl border border-red-200 bg-red-50 p-5 max-w-md">
        <p class="text-sm font-semibold text-red-800">Could not load premade map</p>
        <p class="text-sm text-red-700 mt-1">{{ loadErrorMessage }}</p>
      </div>
    </div>
    <MapEditorSurface
      v-else
      v-model="styleConfig"
      :map="previewMap"
      :saving="saving"
      :scout-available="true"
      :route-stats="previewMap.stats"
      @logo-upload="handleLogoUpload"
    />
  </div>
</template>

<script setup lang="ts">
import type { DeletedRange, PosterTextOverride, PosterTextSlot, PremadeMap, StyleConfig, TextOverlay, TrailMap } from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { buildElevationProfile, detectDisconnectedRanges, mergeDeletedRanges, mergeDeletedRangesForRoute } from '~/utils/trail'

definePageMeta({ middleware: 'auth', layout: false })

type PosterTextField = 'trail_name' | 'occasion_text' | 'location_text'
type ActiveTextTarget =
  | { type: 'poster-text'; field: PosterTextField }
  | { type: 'text-overlay'; id: string }
type MapPreviewHandle = {
  freezeView: () => void
  unfreezeView: () => void
  resetViewToRoute: () => void
}

const route = useRoute()
const toast = useToast()
const premadeId = computed(() => route.params.id as string)

// useLazyFetch so navigation into the editor is instant — the header chrome
// paints first and the map editor mounts when the premade row arrives.
const { data: premade, pending, error, refresh } = useLazyFetch<PremadeMap>(
  () => `/api/admin/premade/${premadeId.value}`,
)

const styleConfig = ref<StyleConfig>({ ...DEFAULT_STYLE_CONFIG })
const mapPreviewRef = ref<MapPreviewHandle | null>(null)
const activeTextTarget = ref<ActiveTextTarget | null>(null)
const sheetState = ref<'closed' | 'half' | 'full'>('half')
const saving = ref(false)
const dirty = ref(false)
const savedOnce = ref(false)
const previewGenerating = ref(false)

const loadErrorMessage = computed(() => {
  const err = error.value as any
  return err?.data?.message || err?.message || 'This premade map may not exist, or your staff role may not have access.'
})

const previewMap = computed<TrailMap | null>(() => {
  const map = premade.value
  if (!map) return null
  return {
    id: map.id ?? premadeId.value,
    user_id: 'admin',
    title: map.title,
    subtitle: map.subtitle,
    geojson: map.geojson,
    bbox: map.bbox,
    stats: map.stats,
    style_config: styleConfig.value,
    thumbnail_url: map.preview_image_url,
    render_url: map.render_url,
    proof_render_url: map.preview_image_url,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
})

const hasElevationData = computed(() => {
  if (!previewMap.value?.geojson) return false
  return buildElevationProfile(previewMap.value.geojson as GeoJSON.FeatureCollection) !== null
})

watch(premade, (map) => {
  if (!map?.style_config) return
  styleConfig.value = {
    ...DEFAULT_STYLE_CONFIG,
    ...map.style_config,
    trail_legend: {
      show: map.style_config.trail_legend?.show ?? DEFAULT_STYLE_CONFIG.trail_legend!.show,
      position: map.style_config.trail_legend?.position ?? DEFAULT_STYLE_CONFIG.trail_legend!.position,
    },
  }
  nextTick(() => {
    undoHistory.value = [JSON.parse(JSON.stringify(styleConfig.value))]
    undoIndex.value = 0
    historyReady = true
    dirty.value = false
  })
}, { immediate: true })

onMounted(() => {
  if (window.innerWidth < 768) sheetState.value = 'closed'
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (historyTimer) clearTimeout(historyTimer)
})

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
  if (target?.closest('.maplibregl-canvas, .maplibregl-canvas-container')) {
    sheetState.value = 'closed'
  }
}

const undoHistory = ref<StyleConfig[]>([])
const undoIndex = ref(-1)
let historyReady = false
let isUndoRedoing = false
let historyTimer: ReturnType<typeof setTimeout> | null = null

const canUndo = computed(() => undoIndex.value > 0)
const canRedo = computed(() => undoIndex.value < undoHistory.value.length - 1)

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

watch(styleConfig, (newConfig) => {
  if (!historyReady || isUndoRedoing) return
  dirty.value = true
  savedOnce.value = false
  recordHistory(newConfig)
}, { deep: true })

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  if (e.key === 's') { e.preventDefault(); savePremadeStyle() }
}

async function savePremadeStyle() {
  if (!premade.value?.id) return
  saving.value = true
  try {
    const updated = await $fetch<PremadeMap>('/api/admin/premade', {
      method: 'PATCH',
      body: {
        id: premade.value.id,
        style_config: styleConfig.value,
      },
    })
    premade.value = updated
    dirty.value = false
    savedOnce.value = true
    toast.add({
      title: 'Premade style saved',
      description: 'This map is marked as needing a fresh preview before publishing.',
      icon: 'i-heroicons-check-circle',
      color: 'green',
      timeout: 3000,
    })
  } catch (err: any) {
    toast.add({
      title: 'Save failed',
      description: err?.data?.message || err?.message || 'Could not save this premade style.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 5000,
    })
  } finally {
    saving.value = false
  }
}

async function generatePreview() {
  if (!premade.value?.id) return
  if (dirty.value) await savePremadeStyle()
  previewGenerating.value = true
  try {
    premade.value = await $fetch<PremadeMap>(`/api/admin/premade/${premade.value.id}/generate-preview`, { method: 'POST' })
    await refresh()
  } catch (err: any) {
    toast.add({
      title: 'Preview failed',
      description: err?.data?.message || err?.message || 'Could not generate a preview.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 5000,
    })
  } finally {
    previewGenerating.value = false
  }
}

function resetStyle() {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG }
}

const plotMode = ref<{ segId: string; field: 'start' | 'end' } | null>(null)
const pendingDeleteStart = ref<number | null>(null)
const deleteBrushActive = ref(false)
const deleteBrushSize = ref(8)

watch(plotMode, (mode) => { if (!mode) pendingDeleteStart.value = null })

function onRequestPlot(payload: { segId: string; field: 'start' | 'end' }) {
  deleteBrushActive.value = false
  plotMode.value = plotMode.value?.segId === payload.segId && plotMode.value?.field === payload.field ? null : payload
}

function onSegmentPlotted({ segId, field, pct }: { segId: string; field: 'start' | 'end'; pct: number }) {
  if (segId === 'route-crop') {
    styleConfig.value = field === 'start'
      ? { ...styleConfig.value, route_crop_start: Math.min(pct, (styleConfig.value.route_crop_end ?? 100) - 0.1) }
      : { ...styleConfig.value, route_crop_end: Math.max(pct, (styleConfig.value.route_crop_start ?? 0) + 0.1) }
  } else if (segId === 'route-delete-pending') {
    if (field === 'start') {
      pendingDeleteStart.value = pct
      plotMode.value = { segId: 'route-delete-pending', field: 'end' }
      return
    }
    const start = Math.min(pendingDeleteStart.value!, pct)
    const end = Math.max(pendingDeleteStart.value!, pct)
    if (end - start > 0.1) {
      const nextRanges = [...(styleConfig.value.route_deleted_ranges ?? []), { start, end }]
      styleConfig.value = {
        ...styleConfig.value,
        route_deleted_ranges: previewMap.value?.geojson
          ? mergeDeletedRangesForRoute(previewMap.value.geojson as GeoJSON.FeatureCollection, nextRanges)
          : mergeDeletedRanges(nextRanges),
      }
    }
    pendingDeleteStart.value = null
  } else {
    const segments = styleConfig.value.trail_segments ?? []
    styleConfig.value = {
      ...styleConfig.value,
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

function onRequestViewLock() {
  mapPreviewRef.value?.freezeView()
}

function onRequestViewEdit() {
  mapPreviewRef.value?.unfreezeView()
}

function onRequestViewReset() {
  mapPreviewRef.value?.resetViewToRoute()
}

function onRouteDeleteBrushApplied({ ranges }: { ranges: DeletedRange[] }) {
  if (!ranges.length) {
    deleteBrushActive.value = false
    return
  }
  const nextRanges = [...(styleConfig.value.route_deleted_ranges ?? []), ...ranges]
  styleConfig.value = {
    ...styleConfig.value,
    route_deleted_ranges: previewMap.value?.geojson
      ? mergeDeletedRangesForRoute(previewMap.value.geojson as GeoJSON.FeatureCollection, nextRanges)
      : mergeDeletedRanges(nextRanges),
  }
  deleteBrushActive.value = false
}

function onDetectDisconnected() {
  if (!previewMap.value?.geojson) return
  const detected = detectDisconnectedRanges(previewMap.value.geojson as GeoJSON.FeatureCollection, 50)
  if (!detected.length) return
  const nextRanges = [...(styleConfig.value.route_deleted_ranges ?? []), ...detected]
  styleConfig.value = {
    ...styleConfig.value,
    route_deleted_ranges: mergeDeletedRangesForRoute(previewMap.value.geojson as GeoJSON.FeatureCollection, nextRanges),
  }
}

function onOverlayMoved(payload: { id: string; x: number; y: number }) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(o => o.id === payload.id ? { ...o, x: payload.x, y: payload.y } : o),
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

function onOverlayDeleted(id: string) {
  if (activeTextTarget.value?.type === 'text-overlay' && activeTextTarget.value.id === id) {
    activeTextTarget.value = null
  }
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: (styleConfig.value.text_overlays ?? []).filter(o => o.id !== id),
  }
}

function onOverlayResized(payload: { id: string; font_size: number }) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(o => o.id === payload.id ? { ...o, font_size: payload.font_size } : o),
  }
}

function onOverlayUpdated(payload: { id: string; patch: Partial<TextOverlay> }) {
  const overlays = styleConfig.value.text_overlays ?? []
  styleConfig.value = {
    ...styleConfig.value,
    text_overlays: overlays.map(o => o.id === payload.id ? { ...o, ...payload.patch } : o),
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

function onFreezeChanged(payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }) {
  styleConfig.value = { ...styleConfig.value, ...payload }
}

function onLabelMoved({ pin, lnglat }: { pin: 'start' | 'finish'; lnglat: [number, number] }) {
  styleConfig.value = pin === 'start'
    ? { ...styleConfig.value, start_label_lnglat: lnglat }
    : { ...styleConfig.value, finish_label_lnglat: lnglat }
}

function onSegmentLabelEditStarted({ labels }: { labels: Array<{ id: string; lnglat: [number, number] }> }) {
  const byId = new Map(labels.map(label => [label.id, label.lnglat]))
  const segments = (styleConfig.value.trail_segments ?? []).map(s => {
    const lnglat = byId.get(s.id)
    return lnglat ? { ...s, label_lnglat: lnglat } : s
  })
  styleConfig.value = { ...styleConfig.value, trail_segments: segments }
}

function onSegmentLabelMoved({ id, lnglat }: { id: string; lnglat: [number, number] }) {
  const segments = (styleConfig.value.trail_segments ?? []).map(s =>
    s.id === id ? { ...s, label_lnglat: lnglat } : s,
  )
  styleConfig.value = { ...styleConfig.value, trail_segments: segments }
}

function onSegmentLabelsMoved({ labels }: { labels: Array<{ id: string; lnglat: [number, number] }> }) {
  const byId = new Map(labels.map(label => [label.id, label.lnglat]))
  const segments = (styleConfig.value.trail_segments ?? []).map(s => {
    const lnglat = byId.get(s.id)
    return lnglat ? { ...s, label_lnglat: lnglat } : s
  })
  styleConfig.value = { ...styleConfig.value, trail_segments: segments }
}

function onViewChanged({ map_zoom, map_center, map_editor_width, map_pitch, map_bearing }: { map_zoom: number; map_center: [number, number]; map_editor_width: number; map_pitch: number; map_bearing: number }) {
  styleConfig.value = { ...styleConfig.value, map_zoom, map_center, map_editor_width, map_pitch, map_bearing }
}

function handleLogoUpload() {
  toast.add({
    title: 'Logo upload is not available here',
    description: 'Add logo URLs to the style config from a source map before creating a premade.',
    icon: 'i-heroicons-information-circle',
    color: 'amber',
    timeout: 4000,
  })
}
</script>
