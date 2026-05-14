<template>
  <div class="fixed inset-0 bg-stone-100 flex flex-col overflow-hidden">

    <!-- ── Top bar ─────────────────────────────────────────────────────────── -->
    <header class="bg-white border-b border-stone-200 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">

      <!-- Left: back + title -->
      <div class="flex items-center gap-2.5 min-w-0">
        <NuxtLink to="/"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
          </svg>
        </NuxtLink>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-stone-800 leading-none truncate max-w-[120px] sm:max-w-none">
            {{ mapData?.title ?? 'Loading…' }}
          </p>
          <p class="text-[11px] text-stone-400 mt-0.5 hidden sm:block">Style your map</p>
        </div>
        <span v-if="saving" class="hidden sm:inline-flex items-center text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
          Saving…
        </span>
      </div>

      <!-- Right: actions -->
      <div class="flex items-center gap-1.5 shrink-0">

        <!-- Share — icon only on mobile -->
        <button
          class="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2 py-2 sm:px-2.5 rounded-lg hover:bg-stone-100 transition-colors min-h-[36px]"
          :disabled="sharePreparing"
          @click="copyShareLink"
          title="Copy share link"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"/>
          </svg>
          <span class="hidden sm:inline">{{ sharePreparing ? 'Preparing…' : 'Share' }}</span>
        </button>

        <!-- Save version — icon only on mobile -->
        <button
          class="hidden sm:flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-2.5 py-2 rounded-lg hover:bg-stone-100 transition-colors min-h-[36px]"
          @click="showVersionModal = true"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
          </svg>
          Save version
        </button>

        <div class="hidden sm:block w-px h-5 bg-stone-200" />

        <!-- Order — always available; full render fires automatically on the checkout page -->
        <button
          class="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] px-3 py-2 rounded-lg transition-colors min-h-[36px]"
          @click="goToCheckout"
        >
          <span>Order</span>
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    </header>

    <MapEditorSurface
      v-model="styleConfig"
      :map="mapData"
      :saving="saving"
      :track-upload-available="true"
      @logo-upload="handleLogoUpload"
      @image-upload="handleImageAssetUpload"
      @freeze-changed="onFreezeChanged"
    />

    <!-- ── Save version modal ─────────────────────────────────────────────── -->
    <UModal v-model="showVersionModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-stone-900">Save a version</h3>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
              @click="showVersionModal = false"
            >
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-stone-500">
            Snapshot your current style so you can come back to it later. Your map auto-saves continuously — this is an optional named checkpoint.
          </p>
          <UFormGroup label="Label (optional)">
            <UInput
              v-model="versionLabel"
              placeholder="e.g. Dark navy with gold route"
              @keydown.enter="saveVersion"
            />
          </UFormGroup>

          <div v-if="versions.length > 0">
            <p class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Previous snapshots</p>
            <ul class="space-y-1">
              <li
                v-for="v in versions"
                :key="v.id"
                class="flex items-center justify-between text-sm rounded-xl px-3 py-2.5 bg-stone-50 hover:bg-stone-100 cursor-pointer group"
                @click="restoreVersion(v)"
              >
                <span class="text-stone-700">{{ v.label || 'Untitled snapshot' }}</span>
                <span class="text-xs text-stone-400 group-hover:text-[#2D6A4F] transition-colors">
                  {{ new Date(v.created_at).toLocaleDateString() }} — Restore
                </span>
              </li>
            </ul>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <button
              class="text-sm text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-100 transition-colors"
              @click="showVersionModal = false"
            >Cancel</button>
            <button
              class="text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              :disabled="savingVersion"
              @click="saveVersion"
            >
              {{ savingVersion ? 'Saving…' : 'Save snapshot' }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>

  </div>
</template>

<script setup lang="ts">
import type { DeletedRange, MapAsset, MapAssetKind, PosterTextOverride, PosterTextSlot, StyleConfig, TextOverlay } from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { buildElevationProfile, detectDisconnectedRanges, mergeDeletedRanges, mergeDeletedRangesForRoute } from '~/utils/trail'

definePageMeta({ middleware: 'auth', layout: false })

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

const route = useRoute()
const mapId = computed(() => route.params.mapId as string)

const { map: mapData, saving, updateStyle, saveNow } = useMap(mapId)
const {
  triggerRender: triggerThumbnailRender,
  renderUrl: latestThumbnailUrl,
  error: thumbnailRenderError,
  isRendering: thumbnailRendering,
  retryAfterSeconds: thumbnailRetryAfterSeconds,
} = useMapRenderer(mapId)

const styleConfig = ref<StyleConfig>({ ...DEFAULT_STYLE_CONFIG })
const mapPreviewRef = ref<MapPreviewHandle | null>(null)
const activeTextTarget = ref<ActiveTextTarget | null>(null)

const hasElevationData = computed(() => {
  if (!mapData.value?.geojson) return false
  return buildElevationProfile(mapData.value.geojson as GeoJSON.FeatureCollection) !== null
})
const sheetState = ref<'closed' | 'half' | 'full'>('half')

// On mobile, start with the sheet collapsed so the map is visible.
// Desktop renders the panel as a sidebar (the state has no effect there).
onMounted(() => {
  if (window.innerWidth < 768) sheetState.value = 'closed'
})

function toggleSheet() {
  // Tap on the drag handle: closed → half → full → half
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
  // Only on mobile, and only when the sheet is open and we're not actively plotting
  if (typeof window === 'undefined' || window.innerWidth >= 768) return
  if (plotMode.value) return
  if (deleteBrushActive.value) return
  if (sheetState.value === 'closed') return
  // Only dismiss on direct map canvas taps, not on poster controls / overlays / text
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target.closest('.maplibregl-canvas, .maplibregl-canvas-container')) {
    sheetState.value = 'closed'
  }
}

watch(mapData, (m) => {
  if (m?.style_config) {
    styleConfig.value = {
      ...DEFAULT_STYLE_CONFIG,
      ...m.style_config,
      // Deep merge nested objects so new defaults are applied to existing maps
      trail_legend: {
        show: m.style_config.trail_legend?.show ?? DEFAULT_STYLE_CONFIG.trail_legend!.show,
        position: m.style_config.trail_legend?.position ?? DEFAULT_STYLE_CONFIG.trail_legend!.position,
      },
    }
    // Seed history with the loaded config so undo can't go past the initial state
    nextTick(() => {
      undoHistory.value = [JSON.parse(JSON.stringify(styleConfig.value))]
      undoIndex.value = 0
      historyReady = true
    })
  }
}, { immediate: true })

// ── Undo / redo ───────────────────────────────────────────────────────────────

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

// Debounced save — 600ms after the user stops tweaking
let saveTimer: ReturnType<typeof setTimeout>
watch(styleConfig, (newConfig) => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => updateStyle(newConfig), 600)
  recordHistory(newConfig)
  scheduleEditorThumbnailSnapshot()
}, { deep: true })

onUnmounted(() => {
  clearThumbnailTimer()
})

function resetStyle() {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG }
}

// ─── Plot mode (tap route to set segment/crop positions) ─────────────────────

const plotMode = ref<{ segId: string; field: 'start' | 'end' } | null>(null)
const pendingDeleteStart = ref<number | null>(null)
const deleteBrushActive = ref(false)
const deleteBrushSize = ref(8)

// Reset pending delete state if plot mode is cancelled externally (Escape / toggle-off)
watch(plotMode, (mode) => { if (!mode) pendingDeleteStart.value = null })

function onRequestPlot(payload: { segId: string; field: 'start' | 'end' }) {
  deleteBrushActive.value = false
  // Toggle off if clicking the same button again
  if (plotMode.value?.segId === payload.segId && plotMode.value?.field === payload.field) {
    plotMode.value = null
  } else {
    plotMode.value = payload
  }
}

function onSegmentPlotted({ segId, field, pct }: { segId: string; field: 'start' | 'end'; pct: number }) {
  if (segId === 'route-crop') {
    if (field === 'start') {
      styleConfig.value = { ...styleConfig.value, route_crop_start: Math.min(pct, (styleConfig.value.route_crop_end ?? 100) - 0.1) }
    } else {
      styleConfig.value = { ...styleConfig.value, route_crop_end: Math.max(pct, (styleConfig.value.route_crop_start ?? 0) + 0.1) }
    }
  } else if (segId === 'route-delete-pending') {
    if (field === 'start') {
      pendingDeleteStart.value = pct
      plotMode.value = { segId: 'route-delete-pending', field: 'end' }
      return  // keep plot mode active for the second click
    } else {
      const start = Math.min(pendingDeleteStart.value!, pct)
      const end = Math.max(pendingDeleteStart.value!, pct)
      if (end - start > 0.1) {
        const nextRanges = [...(styleConfig.value.route_deleted_ranges ?? []), { start, end }]
        styleConfig.value = {
          ...styleConfig.value,
          route_deleted_ranges: mapData.value?.geojson
            ? mergeDeletedRangesForRoute(mapData.value.geojson as GeoJSON.FeatureCollection, nextRanges)
            : mergeDeletedRanges(nextRanges),
        }
      }
      pendingDeleteStart.value = null
    }
  } else {
    const segments = styleConfig.value.trail_segments ?? []
    styleConfig.value = {
      ...styleConfig.value,
      trail_segments: segments.map(s => {
        if (s.id !== segId) return s
        if (field === 'start') return { ...s, section_start: Math.min(pct, s.section_end - 0.1) }
        return { ...s, section_end: Math.max(pct, s.section_start + 0.1) }
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
    route_deleted_ranges: mapData.value?.geojson
      ? mergeDeletedRangesForRoute(mapData.value.geojson as GeoJSON.FeatureCollection, nextRanges)
      : mergeDeletedRanges(nextRanges),
  }
  deleteBrushActive.value = false
}

function onDetectDisconnected() {
  if (!mapData.value?.geojson) return
  const detected = detectDisconnectedRanges(mapData.value.geojson as GeoJSON.FeatureCollection, 50)
  if (!detected.length) return
  const nextRanges = [...(styleConfig.value.route_deleted_ranges ?? []), ...detected]
  styleConfig.value = {
    ...styleConfig.value,
    route_deleted_ranges: mergeDeletedRangesForRoute(mapData.value.geojson as GeoJSON.FeatureCollection, nextRanges),
  }
}

// ─── Share link ───────────────────────────────────────────────────────────────

const toast = useToast()
const sharePreparing = ref(false)

const THUMBNAIL_RENDER_IDLE_DELAY_MS = 7000
const THUMBNAIL_RENDER_MIN_INTERVAL_MS = 30_000
const THUMBNAIL_RENDER_RATE_LIMIT_FALLBACK_RETRY_MS = 5 * 60_000
const THUMBNAIL_RENDER_RETRY_BUFFER_MS = 5000

let thumbnailTimer: ReturnType<typeof setTimeout> | null = null
let thumbnailLastRenderedAt = 0
let thumbnailRenderRunning = false
let thumbnailRenderQueued = false

function clearThumbnailTimer() {
  if (thumbnailTimer) {
    clearTimeout(thumbnailTimer)
    thumbnailTimer = null
  }
}

function scheduleEditorThumbnailSnapshot(delayMs = THUMBNAIL_RENDER_IDLE_DELAY_MS) {
  if (!historyReady || !mapData.value) return
  clearThumbnailTimer()
  thumbnailTimer = setTimeout(() => {
    refreshEditorThumbnailSnapshot('idle').catch((err) => {
      const retryDelayMs = thumbnailRetryDelayMs(err)
      if (retryDelayMs != null) {
        scheduleEditorThumbnailSnapshot(retryDelayMs)
      }
      console.warn('[thumbnail] idle refresh failed:', err instanceof Error ? err.message : err)
    })
  }, delayMs)
}

function thumbnailRetryDelayMs(err: unknown): number | null {
  const retryAfter = thumbnailRetryAfterSeconds.value
  if (Number.isFinite(retryAfter) && retryAfter != null && retryAfter > 0) {
    return retryAfter * 1000 + THUMBNAIL_RENDER_RETRY_BUFFER_MS
  }
  const message = err instanceof Error ? err.message : String(err)
  if (/too many requests|rate limit|429/i.test(message)) {
    return THUMBNAIL_RENDER_RATE_LIMIT_FALLBACK_RETRY_MS
  }
  return null
}

async function persistCurrentStyleNow() {
  clearTimeout(saveTimer)
  if (mapData.value) {
    mapData.value.style_config = { ...styleConfig.value }
  }
  await saveNow()
}

async function waitForThumbnailRender(timeoutMs = 120_000) {
  const started = Date.now()
  while (thumbnailRendering.value && Date.now() - started < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (thumbnailRendering.value) {
    throw new Error('Thumbnail render timed out')
  }
  if (thumbnailRenderError.value) {
    throw new Error(thumbnailRenderError.value)
  }
  if (!latestThumbnailUrl.value) {
    throw new Error('Thumbnail render completed without a URL')
  }
}

async function refreshEditorThumbnailSnapshot(reason: 'idle' | 'share') {
  if (!mapData.value) return
  clearThumbnailTimer()

  if (thumbnailRenderRunning || thumbnailRendering.value) {
    if (reason === 'share') {
      const started = Date.now()
      while ((thumbnailRenderRunning || thumbnailRendering.value) && Date.now() - started < 120_000) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      if (thumbnailRenderRunning || thumbnailRendering.value) {
        throw new Error('Thumbnail render timed out')
      }
      return refreshEditorThumbnailSnapshot('share')
    }
    thumbnailRenderQueued = true
    return
  }

  const minInterval = reason === 'share' ? 0 : THUMBNAIL_RENDER_MIN_INTERVAL_MS
  const waitMs = thumbnailLastRenderedAt + minInterval - Date.now()
  if (waitMs > 0) {
    scheduleEditorThumbnailSnapshot(waitMs)
    return
  }

  thumbnailRenderRunning = true
  thumbnailRenderQueued = false
  thumbnailRenderError.value = null
  try {
    await persistCurrentStyleNow()
    await triggerThumbnailRender({ intent: reason === 'share' ? 'share' : 'editor-thumbnail' })
    await waitForThumbnailRender()
    if (latestThumbnailUrl.value && mapData.value) {
      mapData.value.thumbnail_url = latestThumbnailUrl.value
      mapData.value.proof_render_url = latestThumbnailUrl.value
      mapData.value.render_url = latestThumbnailUrl.value
    }
    thumbnailLastRenderedAt = Date.now()
  } finally {
    thumbnailRenderRunning = false
    if (thumbnailRenderQueued) {
      thumbnailRenderQueued = false
      scheduleEditorThumbnailSnapshot()
    }
  }
}

async function copyShareLink() {
  const shareUrl = `${window.location.origin}/map/${mapId.value}`
  sharePreparing.value = true
  try {
    await refreshEditorThumbnailSnapshot('share')
    const supabase = useSupabaseClient() as any
    const { error } = await supabase
      .from('maps')
      .update({ is_public: true, updated_at: new Date().toISOString() })
      .eq('id', mapId.value)
    if (error) throw error

    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      window.prompt('Copy this link:', shareUrl)
    }
    toast.add({
      title: 'Link copied',
      description: 'The shared preview now matches your latest saved design.',
      icon: 'i-heroicons-link',
      color: 'green',
      timeout: 3000,
    })
  } catch (err) {
    console.error('Share preparation failed:', err)
    toast.add({
      title: 'Share preview failed',
      description: 'We could not prepare the latest thumbnail. Please try again.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 5000,
    })
  } finally {
    sharePreparing.value = false
  }
}

// ─── Save version ─────────────────────────────────────────────────────────────

const showVersionModal = ref(false)
const versionLabel = ref('')
const savingVersion = ref(false)
const versions = ref<Array<{ id: string; label: string | null; style_config: StyleConfig; created_at: string }>>([])

watch(showVersionModal, async (open) => {
  if (!open) return
  try {
    const data = await $fetch<typeof versions.value>(`/api/maps/${mapId.value}/versions`)
    versions.value = data
  } catch { /* ignore */ }
})

async function saveVersion() {
  savingVersion.value = true
  try {
    const v = await $fetch<{ id: string; label: string | null; created_at: string }>(
      `/api/maps/${mapId.value}/versions`,
      { method: 'POST', body: { label: versionLabel.value || null } },
    )
    versions.value.unshift({ ...v, style_config: { ...styleConfig.value } })
    versionLabel.value = ''
    showVersionModal.value = false
  } catch { /* ignore */ } finally {
    savingVersion.value = false
  }
}

function restoreVersion(v: { style_config: StyleConfig }) {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG, ...v.style_config }
  showVersionModal.value = false
}

// ─── Overlay events ────────────────────────────────────────────────────────────

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

function onEditRequested(payload: { field: PosterTextField; value: string }) {
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

// ─── Freeze / unfreeze ────────────────────────────────────────────────────────

function onFreezeChanged(payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number]; map_editor_width?: number; map_pitch?: number; map_bearing?: number }) {
  styleConfig.value = { ...styleConfig.value, ...payload }
  // Sync optimistic state then save immediately — frozen position must survive
  // navigation (e.g. clicking Order) before the debounce timer fires.
  if (mapData.value) {
    mapData.value.style_config = { ...styleConfig.value, ...payload }
  }
  saveNow()
}

function onLabelMoved({ pin, lnglat }: { pin: 'start' | 'finish'; lnglat: [number, number] }) {
  if (pin === 'start') {
    styleConfig.value = { ...styleConfig.value, start_label_lnglat: lnglat }
  } else {
    styleConfig.value = { ...styleConfig.value, finish_label_lnglat: lnglat }
  }
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

async function goToCheckout() {
  await persistCurrentStyleNow()
  await navigateTo(`/create/${mapId.value}/checkout`)
}

// ─── Logo upload ───────────────────────────────────────────────────────────────

type AssetUploadResult = { asset?: MapAsset; url: string; style_config?: StyleConfig }

function applyUploadedStyle(result: AssetUploadResult) {
  styleConfig.value = result.style_config
    ? { ...DEFAULT_STYLE_CONFIG, ...result.style_config }
    : {
        ...styleConfig.value,
        logo_url: result.url,
        show_logo: true,
        logo_position: styleConfig.value.logo_url ? (styleConfig.value.logo_position ?? 'footer-left') : 'footer-left',
        show_branding: false,
      }
  if (mapData.value) {
    mapData.value.style_config = { ...styleConfig.value }
  }
}

async function handleLogoUpload(file: File) {
  try {
    const formData = new FormData()
    formData.append('image', file)
    const result = await $fetch<AssetUploadResult>(`/api/maps/${mapId.value}/logo`, {
      method: 'POST',
      body: formData,
    })
    applyUploadedStyle(result)
  } catch (err) {
    console.error('Logo upload failed', err)
    toast.add({
      title: 'Logo upload failed',
      description: err instanceof Error ? err.message : 'Could not upload this logo. Please try a PNG, JPG, or WebP under 5 MB.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 6000,
    })
  }
}

async function handleImageAssetUpload(payload: { file: File; kind: MapAssetKind; replaceAssetId?: string }) {
  try {
    const formData = new FormData()
    formData.append('image', payload.file)
    formData.append('kind', payload.kind)
    if (payload.replaceAssetId) formData.append('replace_asset_id', payload.replaceAssetId)
    const result = await $fetch<AssetUploadResult>(`/api/maps/${mapId.value}/assets`, {
      method: 'POST',
      body: formData,
    })
    applyUploadedStyle(result)
  } catch (err) {
    console.error('Image upload failed', err)
    toast.add({
      title: payload.kind === 'logo' ? 'Logo upload failed' : 'Image upload failed',
      description: err instanceof Error ? err.message : 'Could not upload this image. Please try a PNG, JPG, or WebP within the size limit.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 6000,
    })
  }
}
</script>
