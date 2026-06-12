<template>
  <div
    class="flex flex-1 h-full min-h-0 w-full overflow-hidden relative"
    data-testid="map-editor-surface"
    :data-chrome-editing="chromeDirectEdit ? 'true' : 'false'"
  >
    <template v-if="fixedTemplateEditorActive && map">
      <main class="flex-1 min-h-0 overflow-hidden">
        <FixedPosterTemplateEditor
          ref="mapPreviewRef"
          v-model="styleConfig"
          :map="map"
          :show-inspector="false"
          class="h-full w-full"
          @done="dismissFixedTemplateEditor"
        />
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
          :poster-elements-available="posterElementsEditor"
          :poster-tier2-available="posterTier2Editor"
          :poster-editor-mode="posterEditorMode"
          :selected-poster-element-id="selectedPosterElementId"
          :poster-guides-visible="posterGuidesVisible"
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
          @browse-themes="emit('browse-themes')"
          @poster-editor-mode-change="posterEditorMode = $event"
          @poster-guides-visible-change="posterGuidesVisible = $event"
          @poster-element-selected="onPosterElementSelected"
          @poster-element-patch="onPosterElementPatch"
          @poster-element-remove="onPosterElementRemove"
          @poster-element-duplicate="onPosterElementDuplicate"
          @poster-text-add="onPosterTextAdd"
          @poster-icon-add="onPosterIconAdd"
        />
      </aside>
    </template>

    <template v-else>
    <main
      class="flex-1 min-h-0 flex flex-col overflow-hidden transition-[padding] duration-300 ease-out md:!pb-0"
      :class="[
        sheetState === 'closed' ? 'pb-16' :
        sheetState === 'half' ? 'pb-[45vh]' :
        'pb-[85vh]',
      ]"
      @click="onMapAreaClick"
    >
      <div class="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
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
            :segment-label-rename-enabled="mapSelectionEnabled"
            :can-undo="canUndo"
            :can-redo="canRedo"
            :chrome-editing="chromeDirectEdit"
            :poster-elements-editing="posterElementsEditor"
            :poster-tier2-editor="posterTier2Editor"
            :poster-editor-mode="posterEditorMode"
            :poster-guides-visible="posterGuidesVisible"
            :selected-poster-element-id="selectedPosterElementId"
            :editable-text-slots="posterEditableTextSlots"
            :guided-poster-editor="posterElementsEditor"
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
            @poster-element-selected="onPosterElementSelected"
            @poster-element-patched="onPosterElementPatch"
            @poster-element-remove="onPosterElementRemove"
            @poster-add-text="onPosterAddText"
            @poster-add-stat="onPosterAddStat"
            @poster-add-icon="onPosterAddIconCentered"
            @poster-add-image="onPosterAddImage"
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
            @segment-label-rename="onSegmentLabelRename"
            @view-changed="onViewChanged"
            @map-ready="onEditorMapReady"
            @text-target-selected="clearMapElementSelection"
            @undo="undo"
            @redo="redo"
          />
          <!-- Editor-only selection chrome (FLAGS.EDITOR_V2) — never mounted on render pages, never prints. -->
          <MapSelectionOverlay
            v-if="mapSelectionEnabled"
            :selection="mapElementSelection"
            :get-map="getEditorMapInstance"
            :segment="selectedMapSegment"
            :fallback-width="styleConfig.route_width"
            :split-armed="Boolean(segmentSplitTarget)"
            :rename-focus-token="segmentRenameFocusToken"
            :route-color="styleConfig.route_color"
            :route-width="styleConfig.route_width"
            :route-opacity="styleConfig.route_opacity"
            :route-controls="routeToolbarControls"
            @close="clearMapElementSelection"
            @patch-segment="onSelectedSegmentPatch"
            @delete-segment="onSelectedSegmentDelete"
            @toggle-split="onSegmentSplitToggle"
            @patch-route="onSelectedRoutePatch"
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

    <!-- Drag-to-resize divider (desktop only) -->
    <div
      v-if="!panelCollapsed"
      class="editor-resizer hidden md:flex shrink-0 items-center justify-center cursor-col-resize group"
      :class="{ 'is-resizing': isResizing }"
      title="Drag to resize · double-click to reset"
      @pointerdown="startResize"
      @dblclick="resetPanelWidth"
    >
      <span class="editor-resizer-grip" />
    </div>

    <!-- Reopen tab when panel is collapsed (desktop only). Editor-v2 D4: the
         panel is the Advanced drawer, and this is its explicit entry point. -->
    <button
      v-if="panelCollapsed"
      type="button"
      class="hidden md:flex absolute top-4 right-4 z-30 items-center gap-1.5 rounded-full bg-white/90 backdrop-blur border border-stone-200 shadow-sm px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-white transition-colors cursor-pointer"
      :title="editorV2Enabled ? 'Open the Advanced drawer (themes, map style, ordering)' : 'Show editor panel'"
      data-testid="advanced-drawer-button"
      @click="panelCollapsed = false"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
        <path d="M12 5l-5 5 5 5"/>
      </svg>
      {{ editorV2Enabled ? 'Advanced' : 'Edit' }}
    </button>

    <aside
      class="editor-aside shrink-0 overflow-hidden flex flex-col bg-white transition-all duration-300 ease-out"
      :class="[
        'md:relative md:inset-auto md:h-auto md:rounded-none md:shadow-none',
        !panelCollapsed ? 'md:border-l md:border-stone-200' : '',
        'fixed inset-x-0 bottom-0 z-30 md:static',
        sheetState === 'full' ? 'h-[85vh]' :
        sheetState === 'half' ? 'h-[45vh]' :
        'h-16',
      ]"
      :style="{
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        '--panel-w': panelWidth + 'px',
        '--panel-mr': panelCollapsed ? `-${panelWidth}px` : '0px',
        transition: isResizing ? 'none' : undefined,
      }"
    >
      <MapStylePanel
        v-if="map"
        ref="stylePanelRef"
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
        :poster-elements-available="posterElementsEditor"
        :poster-tier2-available="posterTier2Editor"
        :poster-editor-mode="posterEditorMode"
        :selected-poster-element-id="selectedPosterElementId"
        :poster-guides-visible="posterGuidesVisible"
        :scout-available="scoutAvailable"
        :route-stats="routeStats ?? map.stats"
        :track-upload-available="trackUploadAvailable"
        :track-upload-loading="trackUploadLoading"
        :track-upload-error="trackUploadError"
        :can-undo="canUndo"
        :can-redo="canRedo"
        @undo="undo"
        @redo="redo"
        @collapse="panelCollapsed = true"
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
        @browse-themes="emit('browse-themes')"
        @poster-editor-mode-change="posterEditorMode = $event"
        @poster-guides-visible-change="posterGuidesVisible = $event"
        @poster-element-selected="onPosterElementSelected"
        @poster-element-patch="onPosterElementPatch"
        @poster-element-remove="onPosterElementRemove"
        @poster-element-duplicate="onPosterElementDuplicate"
        @poster-text-add="onPosterTextAdd"
        @poster-icon-add="onPosterIconAdd"
      />
      <div v-else class="flex-1 bg-white animate-pulse" />
    </aside>
    </template>
  </div>
</template>

<script setup lang="ts">
import FixedPosterTemplateEditor from '~/components/map/FixedPosterTemplateEditor.vue'
import MapSelectionOverlay from '~/components/map/MapSelectionOverlay.vue'
import { useElementSelection } from '~/composables/useElementSelection'
import { useMapElementSelection } from '~/composables/useMapElementSelection'
import type {
  DeletedRange,
  MapAsset,
  MapAssetKind,
  PartialPosterLayout,
  PosterIconId,
  PosterStatBinding,
  PosterTextOverride,
  PosterTextSlot,
  StyleConfig,
  TextOverlay,
  TrailMap,
  TrailSegment,
} from '~/types'
import { DEFAULT_STYLE_CONFIG, DEFAULT_TRAIL_SEGMENT_WIDTH } from '~/types'
import { FLAGS } from '~/utils/knownFlags'
import {
  addPosterEditorIcon,
  addPosterEditorIconCentered,
  addPosterEditorStat,
  addPosterEditorText,
  duplicatePosterEditorElement,
  patchPosterEditorElement,
  removePosterEditorElement,
  syncPosterOverlayAnchors,
  type PosterEditorElementPatch,
} from '~/utils/posterEditorElements'
import { buildThemeDataContext } from '~/utils/themeDataContract'
import { posterEditorAllowlistForStyle } from '~/utils/posterEditorAllowlist'
import { applyRouteLineControl, type RouteLineControlField } from '~/utils/styleControlSync'
import { getThemeDefinition } from '~/utils/themes/refined'
import {
  buildElevationProfile,
  detectDisconnectedRanges,
  mergeDeletedRanges,
  mergeDeletedRangesForRoute,
  bboxContainsBbox,
  buildGeometryBackedSegmentPatch,
  defaultTrailSegmentColor,
  extendSegmentCoordinates,
  isGeometryBackedSegment,
  normalizeLineCoords,
  patchTrailSegment,
  removeTrailSegment,
  sanitizeSegmentBends,
  splitTrailSegmentInList,
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
type PosterEditorMode = 'layout' | 'select' | 'text' | 'image' | 'icon' | 'guides'
type MapPreviewHandle = {
  freezeView: () => void
  unfreezeView: () => void
  resetViewToRoute: () => void
  getVisibleBounds: () => [number, number, number, number] | null
  fitToRouteAndSegments: (segmentBboxes?: Array<[number, number, number, number]>) => void
  finishSegmentDraw: () => void
  undoSegmentDrawPoint: () => boolean
  getMapInstance: () => import('maplibre-gl').Map | null
  mapCenterPosterPercent: () => { x: number; y: number }
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
  'browse-themes': []
}>()

const styleConfig = computed({
  get: () => props.modelValue,
  set: (value: StyleConfig) => emit('update:modelValue', value),
})

const route = useRoute()
const mapPreviewRef = ref<MapPreviewHandle | null>(null)
const activeTextTarget = ref<ActiveTextTarget | null>(null)
const selectedPosterElementId = ref<string | null>(null)
const posterEditorMode = ref<PosterEditorMode>(parsePosterEditorMode(route.query.posterMode))
const posterGuidesVisible = ref(false)
const templateEditorDismissed = ref(false)
const sheetState = ref<'closed' | 'half' | 'full'>('half')

// ── Desktop panel sizing & collapse (browser-local, persisted) ──────────────────
const PANEL_MIN_W = 280
const PANEL_MAX_W = 560
const PANEL_DEFAULT_W = 320
const PANEL_WIDTH_KEY = 'radmaps:panelWidth'
const PANEL_COLLAPSED_KEY = 'radmaps:panelCollapsed'
const panelWidth = ref(PANEL_DEFAULT_W)
const panelCollapsed = ref(false)
// (Editor-v2 D4 default-collapse lives below editorV2Enabled's definition —
// watch sources evaluate eagerly at setup.)
const isResizing = ref(false)

function clampPanelWidth(w: number) {
  return Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, Math.round(w)))
}

function startResize(e: PointerEvent) {
  e.preventDefault()
  isResizing.value = true
  window.addEventListener('pointermove', onResize)
  window.addEventListener('pointerup', stopResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

function onResize(e: PointerEvent) {
  // Panel is docked on the right edge, so width grows as the pointer moves left.
  panelWidth.value = clampPanelWidth(window.innerWidth - e.clientX)
}

function stopResize() {
  isResizing.value = false
  window.removeEventListener('pointermove', onResize)
  window.removeEventListener('pointerup', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  try { localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth.value)) } catch { /* ignore */ }
}

function resetPanelWidth() {
  panelWidth.value = PANEL_DEFAULT_W
  try { localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth.value)) } catch { /* ignore */ }
}

watch(panelCollapsed, (collapsed) => {
  try { localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
})

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
const posterElementsEditorFlag = useFeatureFlag(FLAGS.POSTER_ELEMENTS_EDITOR)
const posterTemplateEditorFlag = useFeatureFlag(FLAGS.POSTER_TEMPLATE_EDITOR)
const posterTier2EditorFlag = useFeatureFlag(FLAGS.POSTER_TIER2_EDITOR)
const posterElementsEditor = computed(() => {
  const queryValue = route.query.posterEditor
  const queryEnabled = queryValue === '1' || queryValue === 'true'
  return posterElementsEditorFlag.value || (import.meta.dev && queryEnabled)
})
const posterTier2Editor = computed(() => {
  const queryValue = route.query.posterTier2 ?? route.query.tier2Editor
  const queryEnabled = queryValue === '1' || queryValue === 'true'
  return posterElementsEditor.value && (posterTier2EditorFlag.value || (import.meta.dev && queryEnabled))
})
const posterEditableTextSlots = computed(() =>
  posterElementsEditor.value ? posterEditorAllowlistForStyle(styleConfig.value).textSlots : null,
)
const fixedTemplateEditorActive = computed(() => {
  const queryValue = route.query.surfaceTemplateEditor ?? route.query.templateEditor
  const queryEnabled = queryValue === '1' || queryValue === 'true'
  return posterElementsEditor.value && !templateEditorDismissed.value && (posterTemplateEditorFlag.value || (import.meta.dev && queryEnabled))
})
const chromeDirectEdit = computed(() => {
  if (fixedTemplateEditorActive.value) return false
  if (posterElementsEditor.value) return posterEditorMode.value === 'layout'
  const chromeQuery = route.query.chrome
  const chromeQueryEnabled = chromeQuery === '1' || chromeQuery === 'true'
  return chromeDirectEditFlag.value || (import.meta.dev && chromeQueryEnabled)
})

// ── Map-element selection (editor-v2 E3, modeless since E6) ─────────────────────
// Click = select, drag = pan — no freeze prerequisite. MapLibre suppresses
// 'click' after a drag-pan natively, so selection coexists with camera moves
// in any view state. Special gestures (plot/draw/edit/brush/split) still own
// the map click while active. Everything gated behind FLAGS.EDITOR_V2.
const editorV2Enabled = useFeatureFlag(FLAGS.EDITOR_V2)

// Editor-v2 D4: the StylePanel stops being the front door — flag-on it starts
// collapsed on desktop (the poster is the interface; the panel is the
// Advanced drawer, reached via empty map-space click or the Advanced button).
// Mobile keeps the bottom sheet exactly as before. One-shot immediate watch
// rather than onMounted: the flag state may resolve just after mount.
const panelAutoCollapsed = ref(false)
watch(() => editorV2Enabled.value, (on) => {
  if (!on || panelAutoCollapsed.value || typeof window === 'undefined') return
  panelAutoCollapsed.value = true
  // A stored preference (the user explicitly opened/closed the drawer
  // before) always wins over the flag-on default.
  try { if (localStorage.getItem(PANEL_COLLAPSED_KEY) != null) return } catch { /* ignore */ }
  if (window.innerWidth >= 768) panelCollapsed.value = true
}, { immediate: true })
const mapSelectionEnabled = computed(() => editorV2Enabled.value && !fixedTemplateEditorActive.value)

function getEditorMapInstance() {
  return mapPreviewRef.value?.getMapInstance?.() ?? null
}

function mapSelectionModeActive() {
  return !plotMode.value
    && !segmentDrawMode.value
    && !segmentEditMode.value
    && !deleteBrushActive.value
    // One-shot split mode owns the next map click (E4).
    && !segmentSplitTarget.value
}

const {
  selection: mapElementSelection,
  clearSelection: clearMapElementSelection,
  selectSegment: selectMapSegment,
  attachToMap: attachMapSelection,
  detachFromMap: detachMapSelection,
} = useMapElementSelection({
  getMap: getEditorMapInstance,
  getStyleConfig: () => props.modelValue,
  enabled: () => mapSelectionEnabled.value,
  selectionModeActive: mapSelectionModeActive,
  // D4 gesture 5: empty map space is the map-style entry point. Dismiss-first
  // applies across domains — with a poster selection active the click only
  // deselects; a truly idle click opens the Advanced drawer.
  onEmptyClick: () => {
    if (selectedPosterElementId.value || activeTextTarget.value) {
      onPosterElementSelected(null)
      return
    }
    openAdvancedDrawer()
  },
})

function onEditorMapReady() {
  attachMapSelection()
}

// ── Advanced drawer (editor-v2 D4) ───────────────────────────────────────────
// The StylePanel stops being the front door: empty map-space clicks (and the
// explicit Advanced affordance) open it scoped to the map-style tab.
const stylePanelRef = ref<{ openTab: (tab: 'quick' | 'map' | 'style' | 'text') => void } | null>(null)

function openAdvancedDrawer(tab: 'quick' | 'map' | 'style' | 'text' = 'map') {
  panelCollapsed.value = false
  if (typeof window !== 'undefined' && window.innerWidth < 768 && sheetState.value === 'closed') {
    sheetState.value = 'half'
  }
  nextTick(() => stylePanelRef.value?.openTab(tab))
}

watch(mapSelectionEnabled, async (enabled) => {
  if (!enabled) {
    detachMapSelection()
    return
  }
  await nextTick()
  attachMapSelection()
}, { immediate: true })

// ── Segment toolbar (editor-v2 E4) ──────────────────────────────────────────────
// The toolbar's controls persist exclusively through the same trail_segments
// write path the StylePanel segments section uses (utils/trail.ts helpers).
const selectedMapSegment = computed<TrailSegment | null>(() => {
  const selection = mapElementSelection.value
  if (!selection || selection.slot !== 'segments-handles' || !selection.featureKey) return null
  return (props.modelValue.trail_segments ?? []).find(s => s.id === selection.featureKey) ?? null
})

function onSelectedSegmentPatch(patch: Partial<TrailSegment>) {
  const segment = selectedMapSegment.value
  if (!segment) return
  styleConfig.value = {
    ...styleConfig.value,
    trail_segments: patchTrailSegment(styleConfig.value.trail_segments ?? [], segment.id, patch),
  }
}

// Simple delete — segments have no tombstone system; the editor undo stack
// (Cmd+Z) and the StylePanel segments section remain the recovery paths.
function onSelectedSegmentDelete() {
  const segment = selectedMapSegment.value
  if (!segment) return
  styleConfig.value = {
    ...styleConfig.value,
    trail_segments: removeTrailSegment(styleConfig.value.trail_segments ?? [], segment.id),
  }
  clearMapElementSelection()
}

// ── Route toolbar (editor-v2 D1) ────────────────────────────────────────────────
// The route selection's contextual controls (docs/STYLE_SYSTEM_EVOLUTION.md
// "Per-element toolbars"). Availability mirrors the StylePanel Route section's
// theme gating (utils/stylePanelGating.ts) so the toolbar never offers a
// control the panel would hide; writes share the panel's exact write path
// (applyRouteLineControl) so E6a sticky-segment semantics hold. stickySegments
// is unconditionally true here: this code path only exists flag-on.
const routeToolbarControls = computed(() => {
  const editableFields = getThemeDefinition(props.modelValue.color_theme ?? 'chalk')?.editable_fields
  const hasAllowlist = Array.isArray(editableFields)
  return {
    color: !hasAllowlist || editableFields!.includes('route_color'),
    width: !hasAllowlist,
    opacity: !hasAllowlist,
  }
})

function onSelectedRoutePatch(patch: { route_color?: string; route_width?: number; route_opacity?: number }) {
  let next = styleConfig.value
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue
    next = applyRouteLineControl(next, key as RouteLineControlField, value as never, { stickySegments: true })
  }
  styleConfig.value = next
}

// A segment removed elsewhere (StylePanel, undo) invalidates its selection.
watch(
  () => (props.modelValue.trail_segments ?? []).map(s => s.id).join('|'),
  () => {
    const selection = mapElementSelection.value
    if (!selection || selection.slot !== 'segments-handles' || !selection.featureKey) return
    if (!(props.modelValue.trail_segments ?? []).some(s => s.id === selection.featureKey)) {
      clearMapElementSelection()
    }
  },
)

// ── Split at point: one-shot mode (editor-v2 E4) ────────────────────────────────
// Arm via the toolbar's Split button; the next map click ON the selected
// segment splits it via the pure splitTrailSegmentInList (utils/trail.ts) and
// flows through the same trail_segments write path. Esc or any selection
// change disarms. While armed, selection hit-testing is suspended.
const segmentSplitTarget = ref<string | null>(null)
let splitClickMap: import('maplibre-gl').Map | null = null

function onSegmentSplitToggle() {
  segmentSplitTarget.value = segmentSplitTarget.value ? null : selectedMapSegment.value?.id ?? null
}

function onSplitMapClick(e: import('maplibre-gl').MapMouseEvent) {
  const targetId = segmentSplitTarget.value
  const map = getEditorMapInstance()
  if (!targetId || !map) return

  // One-shot fires only when the click lands on the selected segment's line.
  const tolerance = 8
  const bbox: [[number, number], [number, number]] = [
    [e.point.x - tolerance, e.point.y - tolerance],
    [e.point.x + tolerance, e.point.y + tolerance],
  ]
  const layerIds = (map.getStyle()?.layers ?? [])
    .filter(layer => layer.type === 'line' && 'source' in layer && layer.source === `trail-seg-${targetId}`)
    .map(layer => layer.id)
  if (!layerIds.length) return
  if (!map.queryRenderedFeatures(bbox, { layers: layerIds }).length) return

  segmentSplitTarget.value = null
  const primaryRoute = (props.map?.geojson ?? { type: 'FeatureCollection', features: [] }) as GeoJSON.FeatureCollection
  const result = splitTrailSegmentInList(
    styleConfig.value.trail_segments ?? [],
    targetId,
    primaryRoute,
    [e.lngLat.lng, e.lngLat.lat],
  )
  if (!result) return

  styleConfig.value = { ...styleConfig.value, trail_segments: result.segments }
  // Keep the user in context: the first child stays selected at the split
  // point. nextTick so props.modelValue carries the new segment list first
  // (the stale-id watcher clears the original's selection on the same flush).
  const splitLngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
  nextTick(() => selectMapSegment(result.first.id, splitLngLat))
}

watch(segmentSplitTarget, (target) => {
  const map = getEditorMapInstance()
  if (target && map) {
    splitClickMap = map
    map.on('click', onSplitMapClick)
    map.getCanvas().style.cursor = 'crosshair'
  } else if (splitClickMap) {
    try {
      splitClickMap.off('click', onSplitMapClick)
      splitClickMap.getCanvas().style.cursor = ''
    } catch {
      // Map may already be destroyed.
    }
    splitClickMap = null
  }
})

// Selection change/clear (incl. unfreeze, draw modes, preset switch) disarms split.
watch(mapElementSelection, (selection) => {
  if (!segmentSplitTarget.value) return
  if (!selection || selection.slot !== 'segments-handles' || selection.featureKey !== segmentSplitTarget.value) {
    segmentSplitTarget.value = null
  }
})

onUnmounted(() => {
  segmentSplitTarget.value = null
})

// ── Label double-click rename (editor-v2 E4) ────────────────────────────────────
// Double-click/tap on a draggable segment label selects its segment (toolbar
// opens anchored at the label) and focuses the toolbar's name input — the
// SAME field/write path as toolbar rename, one source of truth.
const segmentRenameFocusToken = ref(0)

function onSegmentLabelRename({ id, lnglat }: { id: string; lnglat: [number, number] }) {
  if (!mapSelectionEnabled.value) return
  segmentSplitTarget.value = null
  selectMapSegment(id, lnglat)
  segmentRenameFocusToken.value++
}

// ── Unified selection arbiter — poster domain (editor-v2 D1) ────────────────────
// MapEditorSurface co-holds the poster claim with MapPreview (idempotent claims,
// shared key grammar: 'slot:<slot>' / 'text:<id>' / 'asset:<id>' / 'icon:<id>')
// so Moveable state and toolbar state are evicted together when the map domain
// claims the selection. Claims only happen flag-on; the manual cross-domain
// watchers below remain as the direct event path.
const elementSelectionArbiter = useElementSelection()

function posterArbiterKey(target: ActiveTextTarget): string {
  if (target.type === 'poster-text') return `slot:${target.field}`
  if (target.type === 'text-overlay') return `text:${target.id}`
  return `asset:${target.id}`
}

watch(activeTextTarget, (target, previous) => {
  if (!editorV2Enabled.value) return
  if (target) elementSelectionArbiter.claim('poster', posterArbiterKey(target))
  else if (previous) elementSelectionArbiter.release('poster', posterArbiterKey(previous))
})

watch(selectedPosterElementId, (id, previous) => {
  if (!editorV2Enabled.value) return
  if (id) elementSelectionArbiter.claim('poster', id)
  else if (previous) elementSelectionArbiter.release('poster', previous)
})

elementSelectionArbiter.onEvicted('poster', () => {
  if (!editorV2Enabled.value) return
  activeTextTarget.value = null
  selectedPosterElementId.value = null
})

// Single-selection world: a map selection evicts any poster-element/text
// selection, and vice versa (MapPreview's text-target-selected event plus the
// watchers below cover the poster side).
watch(mapElementSelection, (selection) => {
  if (!selection) return
  activeTextTarget.value = null
  selectedPosterElementId.value = null
})
watch(activeTextTarget, (target) => {
  if (target) clearMapElementSelection()
})
watch(selectedPosterElementId, (id) => {
  if (id) clearMapElementSelection()
})
// Edit gestures or switching preset invalidate the selection. (Freeze state
// no longer affects selection — it only locks the print framing.)
watch(() => props.modelValue.preset, () => clearMapElementSelection())
watch([plotMode, segmentDrawMode, segmentEditMode, deleteBrushActive], (modes) => {
  if (modes.some(Boolean)) clearMapElementSelection()
})

onMounted(() => {
  if (window.innerWidth < 768) sheetState.value = 'closed'
  document.addEventListener('keydown', onKeyDown)
  seedHistory(props.modelValue)
  try {
    const savedWidth = Number(localStorage.getItem(PANEL_WIDTH_KEY))
    if (Number.isFinite(savedWidth) && savedWidth > 0) panelWidth.value = clampPanelWidth(savedWidth)
    // Editor-v2 D4: with no saved preference the flag-on default is COLLAPSED
    // (the poster is the interface; the panel is the Advanced drawer). An
    // explicit user choice, once stored, is always respected.
    const savedCollapsed = localStorage.getItem(PANEL_COLLAPSED_KEY)
    if (savedCollapsed != null) panelCollapsed.value = savedCollapsed === '1'
    else if (panelAutoCollapsed.value) panelCollapsed.value = window.innerWidth >= 768
  } catch { /* ignore */ }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointermove', onResize)
  window.removeEventListener('pointerup', stopResize)
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

watch(posterElementsEditor, (enabled) => {
  if (!enabled) {
    selectedPosterElementId.value = null
    posterEditorMode.value = 'layout'
  }
})

watch(
  () => [posterTier2Editor.value, props.modelValue.image_overlays?.length ?? 0, props.modelValue.text_overlays?.length ?? 0],
  () => {
    if (!posterTier2Editor.value) return
    const next = syncPosterOverlayAnchors(styleConfig.value)
    if (JSON.stringify(next.poster_layout) !== JSON.stringify(styleConfig.value.poster_layout)) styleConfig.value = next
  },
)

watch(() => route.query.posterMode, (mode) => {
  posterEditorMode.value = parsePosterEditorMode(mode)
  if (posterEditorMode.value === 'guides') posterGuidesVisible.value = true
})

watch(() => route.fullPath, () => {
  templateEditorDismissed.value = false
})

function parsePosterEditorMode(value: unknown): PosterEditorMode {
  return value === 'select' || value === 'text' || value === 'image' || value === 'icon' || value === 'guides'
    ? value
    : 'layout'
}

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

function dismissFixedTemplateEditor() {
  templateEditorDismissed.value = true
  posterEditorMode.value = 'layout'
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
  // Esc cancels an armed split-at-point mode first (selection stays),
  // then clears an active map-element selection (editor-v2 selection mode).
  if (e.key === 'Escape' && segmentSplitTarget.value) {
    segmentSplitTarget.value = null
    return
  }
  if (e.key === 'Escape' && mapElementSelection.value) {
    clearMapElementSelection()
    return
  }
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
  return defaultTrailSegmentColor(styleConfig.value, segments)
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
      width: DEFAULT_TRAIL_SEGMENT_WIDTH,
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

function onPosterElementSelected(id: string | null) {
  selectedPosterElementId.value = id
  if (id?.startsWith('text:')) activeTextTarget.value = { type: 'text-overlay', id: id.slice('text:'.length) }
  else if (id?.startsWith('asset:')) activeTextTarget.value = { type: 'image-overlay', id: id.slice('asset:'.length) }
  else activeTextTarget.value = null
}

function onPosterElementPatch(payload: { id: string; patch: PosterEditorElementPatch }) {
  styleConfig.value = patchPosterEditorElement(styleConfig.value, payload.id, payload.patch)
}

function onPosterElementRemove(id: string) {
  styleConfig.value = removePosterEditorElement(styleConfig.value, id)
  if (selectedPosterElementId.value === id) onPosterElementSelected(null)
}

function onPosterElementDuplicate(id: string) {
  const result = duplicatePosterEditorElement(styleConfig.value, id)
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

function onPosterTextAdd() {
  const result = addPosterEditorText(styleConfig.value)
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

function onPosterIconAdd(icon: PosterIconId) {
  const result = addPosterEditorIcon(styleConfig.value, icon)
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

// ── + Add menu handlers (editor-v2 D3, north-star gesture 4) ────────────────
// New elements drop centered over the map area (MapPreview sends the center
// as % of the poster canvas), get selected, and their toolbar opens through
// the selection watchers. All writes ride the existing element add paths.

function onPosterAddText(payload: { x: number; y: number }) {
  const result = addPosterEditorText(styleConfig.value, { x: payload.x, y: payload.y })
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

function onPosterAddStat(payload: { binding: PosterStatBinding; x: number; y: number }) {
  const context = buildThemeDataContext({ ...props.map, styleConfig: styleConfig.value })
  const result = addPosterEditorStat(styleConfig.value, payload.binding, context, { x: payload.x, y: payload.y })
  // null = the contract has no real data for this binding (the menu should
  // not have offered it); nothing is inserted.
  if (!result) return
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

function onPosterAddIconCentered(payload: { icon: PosterIconId; x: number; y: number }) {
  const result = addPosterEditorIconCentered(styleConfig.value, payload.icon, payload)
  styleConfig.value = result.config
  onPosterElementSelected(result.id)
}

// Image adds ride the existing upload pipeline (server-side validation +
// quality classification). The drop center is stashed; when the uploaded
// asset lands in styleConfig, it is centered over the map and selected.
const pendingImageAdd = ref<{ x: number; y: number; knownIds: Set<string>; expires: number } | null>(null)

function onPosterAddImage(payload: { file: File }) {
  const center = mapPreviewRef.value?.mapCenterPosterPercent?.() ?? { x: 50, y: 50 }
  pendingImageAdd.value = {
    ...center,
    knownIds: new Set((styleConfig.value.image_overlays ?? []).map(asset => asset.id)),
    expires: Date.now() + 60_000,
  }
  emit('image-upload', { file: payload.file, kind: 'image' })
}

watch(() => styleConfig.value.image_overlays, (assets) => {
  const pending = pendingImageAdd.value
  if (!pending || !assets?.length) return
  if (Date.now() > pending.expires) {
    pendingImageAdd.value = null
    return
  }
  const added = assets.find(asset => asset.kind === 'image' && !pending.knownIds.has(asset.id))
  if (!added) return
  pendingImageAdd.value = null
  styleConfig.value = patchPosterEditorElement(styleConfig.value, `asset:${added.id}`, {
    x: Math.max(0, pending.x - added.width / 2),
    y: Math.max(0, pending.y - added.height / 2),
  })
  onPosterElementSelected(`asset:${added.id}`)
})

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

<style scoped>
/* Desktop: panel width is driven by the resizable --panel-w variable.
   On mobile the panel is a full-width bottom sheet, so width stays untouched. */
@media (min-width: 768px) {
  .editor-aside {
    /* Width stays constant so the panel contents never reflow. Collapsing slides
       the panel off the right edge via negative margin (clipped by the row's
       overflow-hidden); the map area grows to fill the reclaimed space. */
    width: var(--panel-w, 320px);
    margin-right: var(--panel-mr, 0px);
  }
}

.editor-resizer {
  width: 8px;
  margin: 0 -3px;
  background: transparent;
  position: relative;
  z-index: 25;
  touch-action: none;
}
.editor-resizer-grip {
  width: 2px;
  height: 36px;
  border-radius: 999px;
  background: #E7E5E4;
  transition: background 0.15s, height 0.15s;
}
.editor-resizer:hover .editor-resizer-grip,
.editor-resizer.is-resizing .editor-resizer-grip {
  background: #2D6A4F;
  height: 56px;
}
</style>
