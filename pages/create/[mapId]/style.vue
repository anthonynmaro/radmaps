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
          @click="copyShareLink"
          title="Copy share link"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"/>
          </svg>
          <span class="hidden sm:inline">Share</span>
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
        <NuxtLink
          :to="`/create/${mapId}/checkout`"
          class="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] px-3 py-2 rounded-lg transition-colors min-h-[36px]"
        >
          <span>Order</span>
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </NuxtLink>
      </div>
    </header>

    <!-- ── Main split layout ──────────────────────────────────────────────── -->
    <div class="flex flex-1 overflow-hidden relative">

      <!-- Map preview — always visible; on mobile the bottom sheet overlays it -->
      <main class="flex-1 flex flex-col overflow-hidden" @click="onMapAreaClick">
        <!-- On mobile: leave room above the sheet so the map isn't fully covered -->
        <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <ClientOnly>
            <MapPreview
              v-if="mapData"
              :map="mapData"
              :style-config="styleConfig"
              :editable="true"
              :plot-mode="plotMode"
              :can-undo="canUndo"
              :can-redo="canRedo"
              class="w-full h-full"
              @update:trail-name="styleConfig.trail_name = $event"
              @update:occasion-text="styleConfig.occasion_text = $event"
              @update:location-text="styleConfig.location_text = $event"
              @overlay-moved="onOverlayMoved"
              @overlay-selected="onOverlaySelected"
              @overlay-deleted="onOverlayDeleted"
              @overlay-resized="onOverlayResized"
              @freeze-changed="onFreezeChanged"
              @segment-plotted="onSegmentPlotted"
              @plot-cancelled="plotMode = null"
              @label-moved="onLabelMoved"
              @segment-label-moved="onSegmentLabelMoved"
              @view-changed="onViewChanged"
              @undo="undo"
              @redo="redo"
            />
          </ClientOnly>
          <div v-if="!mapData" class="w-full h-full rounded-2xl bg-stone-200 animate-pulse flex items-center justify-center">
            <svg class="w-10 h-10 text-stone-400" viewBox="0 0 32 32" fill="none">
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.12"/>
              <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
        </div>
      </main>

      <!-- Style controls panel:
           Mobile — fixed bottom sheet that overlays the map
           Desktop — right sidebar (unchanged) -->
      <aside
        class="shrink-0 overflow-hidden flex flex-col bg-white transition-all duration-300 ease-out"
        :class="[
          // Desktop sidebar
          'md:relative md:inset-auto md:w-[320px] md:h-auto md:border-l md:border-stone-200 md:rounded-none md:shadow-none',
          // Mobile bottom sheet
          'fixed inset-x-0 bottom-0 z-30 md:static',
          sheetState === 'full' ? 'h-[85vh]' :
          sheetState === 'half' ? 'h-[45vh]' :
          'h-16',
        ]"
        style="box-shadow: 0 -4px 20px rgba(0,0,0,0.08);"
      >
        <MapStylePanel
          v-if="mapData"
          v-model="styleConfig"
          :saving="saving"
          :has-route="!!(mapData?.geojson)"
          :has-elevation-data="hasElevationData"
          :total-distance-km="mapData?.stats?.distance_km"
          :active-plot-mode="plotMode"
          @reset="resetStyle"
          @logo-upload="handleLogoUpload"
          @toggle-sheet="toggleSheet"
          @swipe-up="onSwipeUp"
          @swipe-down="onSwipeDown"
          @request-plot="onRequestPlot"
          @request-detect-disconnected="onDetectDisconnected"
        />
        <div v-else class="flex-1 bg-white animate-pulse" />
      </aside>

    </div>

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
import type { StyleConfig } from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { buildElevationProfile, detectDisconnectedRanges } from '~/utils/trail'

definePageMeta({ middleware: 'auth', layout: false })

const route = useRoute()
const mapId = computed(() => route.params.mapId as string)

const { map: mapData, saving, updateStyle, saveNow } = useMap(mapId)

const styleConfig = ref<StyleConfig>({ ...DEFAULT_STYLE_CONFIG })

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
}, { deep: true })

// Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo
function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

function resetStyle() {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG }
}

// ─── Plot mode (tap route to set segment/crop positions) ─────────────────────

const plotMode = ref<{ segId: string; field: 'start' | 'end' } | null>(null)
const pendingDeleteStart = ref<number | null>(null)

// Reset pending delete state if plot mode is cancelled externally (Escape / toggle-off)
watch(plotMode, (mode) => { if (!mode) pendingDeleteStart.value = null })

function onRequestPlot(payload: { segId: string; field: 'start' | 'end' }) {
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
        styleConfig.value = {
          ...styleConfig.value,
          route_deleted_ranges: [...(styleConfig.value.route_deleted_ranges ?? []), { start, end }],
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

function onDetectDisconnected() {
  if (!mapData.value?.geojson) return
  const detected = detectDisconnectedRanges(mapData.value.geojson as GeoJSON.FeatureCollection, 50)
  if (!detected.length) return
  styleConfig.value = {
    ...styleConfig.value,
    route_deleted_ranges: [...(styleConfig.value.route_deleted_ranges ?? []), ...detected],
  }
}

// ─── Share link ───────────────────────────────────────────────────────────────

const toast = useToast()

async function copyShareLink() {
  const shareUrl = `${window.location.origin}/map/${mapId.value}`
  try {
    await navigator.clipboard.writeText(shareUrl)
    toast.add({
      title: 'Link copied',
      description: 'Anyone with this link can view your map.',
      icon: 'i-heroicons-link',
      color: 'green',
      timeout: 3000,
    })
  } catch {
    window.prompt('Copy this link:', shareUrl)
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

function onOverlaySelected(_id: string) {
  if (window.innerWidth < 768) sheetState.value = 'full'
}

function onOverlayDeleted(id: string) {
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

// ─── Freeze / unfreeze ────────────────────────────────────────────────────────

function onFreezeChanged(payload: { map_frozen: boolean; map_zoom?: number; map_center?: [number, number] }) {
  styleConfig.value = { ...styleConfig.value, ...payload }
  // Sync optimistic state then save immediately — frozen position must survive
  // navigation (e.g. clicking Order) before the debounce timer fires.
  if (mapData.value) {
    mapData.value.style_config = { ...mapData.value.style_config, ...payload }
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

function onSegmentLabelMoved({ id, lnglat }: { id: string; lnglat: [number, number] }) {
  const segments = (styleConfig.value.trail_segments ?? []).map(s =>
    s.id === id ? { ...s, label_lnglat: lnglat } : s,
  )
  styleConfig.value = { ...styleConfig.value, trail_segments: segments }
}

function onViewChanged({ map_zoom, map_center }: { map_zoom: number; map_center: [number, number] }) {
  styleConfig.value = { ...styleConfig.value, map_zoom, map_center }
}

// ─── Logo upload ───────────────────────────────────────────────────────────────

async function handleLogoUpload(file: File) {
  try {
    const formData = new FormData()
    formData.append('image', file)
    const result = await $fetch<{ url: string }>(`/api/maps/${mapId.value}/logo`, {
      method: 'POST',
      body: formData,
    })
    styleConfig.value = { ...styleConfig.value, logo_url: result.url, show_logo: true }
  } catch (err) {
    console.error('Logo upload failed', err)
  }
}
</script>
