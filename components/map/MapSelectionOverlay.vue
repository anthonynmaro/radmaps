<template>
  <!--
    EDITOR-ONLY SELECTION CHROME (editor-v2 E3).
    Rule: selection chrome NEVER prints. This DOM overlay is allowed precisely
    because it is editor decoration — it is mounted only from MapEditorSurface
    behind FLAGS.EDITOR_V2 and never on the /render pages the AWS renderer
    screenshots. Anything that must print flows through StyleConfig →
    buildMapStyle instead. Highlighting deliberately avoids MapLibre
    feature-state: promoteId/rm_id is not in the tiles yet
    (docs/ATLAS_STABLE_FEATURE_IDS.md).
  -->
  <Teleport to="body">
    <template v-if="selection && anchorVisible">
      <div class="map-selection-ring" :style="ringStyle" aria-hidden="true" data-testid="map-selection-ring" />
      <div
        class="map-selection-toolbar"
        :style="toolbarStyle"
        data-testid="map-selection-toolbar"
        @pointerdown.stop
        @click.stop
      >
        <div class="toolbar-header">
          <span class="selection-kind">{{ kindLabel }}</span>
          <!-- Segments: inline name edit (one source of truth with the StylePanel name field). -->
          <input
            v-if="segment"
            ref="nameInputRef"
            class="segment-name-input"
            :value="segment.name"
            placeholder="Trail name…"
            data-testid="map-selection-segment-name"
            @input="emitPatch({ name: ($event.target as HTMLInputElement).value })"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.stop="($event.target as HTMLInputElement).blur()"
          />
          <span v-else class="selection-name" :title="selection.displayName">{{ selection.displayName }}</span>
          <button class="toolbar-icon-btn" title="Close" data-testid="map-selection-close" @click="$emit('close')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <!-- Segment controls (E4). Every change flows through the same
             trail_segments write path the StylePanel segments section uses. -->
        <template v-if="segment">
          <div class="toolbar-row" data-testid="map-selection-segment-controls">
            <label class="swatch" title="Segment color">
              <span class="swatch-dot" :style="{ backgroundColor: segment.color }" />
              <input
                type="color"
                :value="segment.color"
                data-testid="map-selection-segment-color"
                @input="emitPatch({ color: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <input
              type="range"
              class="width-slider"
              min="1"
              max="8"
              step="0.5"
              :value="segmentWidth"
              title="Line width"
              data-testid="map-selection-segment-width"
              @input="emitPatch({ width: parseFloat(($event.target as HTMLInputElement).value) })"
            />
            <span class="width-readout">{{ segmentWidth }}px</span>
            <button
              class="toolbar-chip"
              :class="{ 'is-active': segment.dash }"
              title="Dashed line"
              data-testid="map-selection-segment-dash"
              @click="emitPatch({ dash: !segment.dash })"
            >- - -</button>
            <button
              class="toolbar-icon-btn toolbar-icon-btn--danger"
              title="Delete segment"
              data-testid="map-selection-segment-delete"
              @click="$emit('delete-segment')"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </template>
        <!-- Placeholder row — route/label controls land in E5. -->
        <div v-else class="toolbar-placeholder" aria-disabled="true">Controls coming</div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import { mapSelectionKindLabel, type MapElementSelection } from '~/composables/useMapElementSelection'
import type { TrailSegment } from '~/types'
import { DEFAULT_TRAIL_SEGMENT_WIDTH } from '~/types'

const props = defineProps<{
  selection: MapElementSelection | null
  /** Function prop so the (late-created, non-reactive) MapLibre instance is read lazily. */
  getMap: () => MapLibreMap | null
  /** The live segment record when the selection is a trail segment — keeps toolbar values reactive to StylePanel edits too. */
  segment?: TrailSegment | null
  /** Fallback for segments without an explicit width (mirrors the StylePanel slider fallback). */
  fallbackWidth?: number
}>()

const emit = defineEmits<{
  close: []
  /** Parent applies this through the shared trail_segments write path (utils/trail.ts patchTrailSegment). */
  'patch-segment': [patch: Partial<TrailSegment>]
  'delete-segment': []
}>()

const RING_SIZE_PX = 28
const TOOLBAR_OFFSET_PX = 18
const TOOLBAR_WIDTH_PX = 240
const SEGMENT_TOOLBAR_WIDTH_PX = 280

const anchor = ref<{ x: number; y: number } | null>(null)
const anchorVisible = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)

const kindLabel = computed(() => props.selection ? mapSelectionKindLabel(props.selection.slot) : '')
const toolbarWidth = computed(() => props.segment ? SEGMENT_TOOLBAR_WIDTH_PX : TOOLBAR_WIDTH_PX)
const segmentWidth = computed(() => props.segment?.width ?? props.fallbackWidth ?? DEFAULT_TRAIL_SEGMENT_WIDTH)

function emitPatch(patch: Partial<TrailSegment>) {
  emit('patch-segment', patch)
}

// Project the selection anchor through the live camera into viewport (fixed)
// coordinates; re-run on map move/resize so the chrome tracks the feature.
function reproject() {
  const map = props.getMap()
  const selection = props.selection
  if (!map || !selection) {
    anchor.value = null
    anchorVisible.value = false
    return
  }
  try {
    const point = map.project(selection.lngLat)
    const rect = map.getContainer().getBoundingClientRect()
    anchor.value = { x: rect.left + point.x, y: rect.top + point.y }
    anchorVisible.value = point.x >= 0 && point.y >= 0 && point.x <= rect.width && point.y <= rect.height
  } catch {
    anchor.value = null
    anchorVisible.value = false
  }
}

let trackedMap: MapLibreMap | null = null

function startTracking() {
  const map = props.getMap()
  if (!map) return
  trackedMap = map
  map.on('move', reproject)
  map.on('resize', reproject)
  window.addEventListener('resize', reproject)
  reproject()
}

function stopTracking() {
  if (trackedMap) {
    try {
      trackedMap.off('move', reproject)
      trackedMap.off('resize', reproject)
    } catch {
      // Map already destroyed.
    }
    trackedMap = null
  }
  window.removeEventListener('resize', reproject)
}

watch(() => props.selection, (selection) => {
  stopTracking()
  if (selection) startTracking()
  else {
    anchor.value = null
    anchorVisible.value = false
  }
}, { immediate: true })

onUnmounted(stopTracking)

const ringStyle = computed(() => {
  if (!anchor.value) return { display: 'none' }
  return {
    left: `${anchor.value.x - RING_SIZE_PX / 2}px`,
    top: `${anchor.value.y - RING_SIZE_PX / 2}px`,
    width: `${RING_SIZE_PX}px`,
    height: `${RING_SIZE_PX}px`,
  }
})

const toolbarStyle = computed(() => {
  if (!anchor.value) return { display: 'none' }
  const width = toolbarWidth.value
  const left = Math.min(
    Math.max(12, anchor.value.x - width / 2),
    window.innerWidth - width - 12,
  )
  const below = anchor.value.y + TOOLBAR_OFFSET_PX
  const estimatedHeight = props.segment ? 100 : 76
  const top = below + estimatedHeight < window.innerHeight - 12
    ? below
    : Math.max(12, anchor.value.y - estimatedHeight - TOOLBAR_OFFSET_PX)
  return { left: `${left}px`, top: `${top}px`, width: `${width}px` }
})
</script>

<style scoped>
/* Visual language mirrors InlineTextToolbar (white blur card, stone palette). */
.map-selection-ring {
  position: fixed;
  z-index: 9999;
  border: 2px solid rgba(45, 106, 79, 0.9);
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.18), 0 2px 10px rgba(28, 25, 23, 0.18);
  background: transparent;
  pointer-events: none;
}

.map-selection-toolbar {
  position: fixed;
  z-index: 10000;
  padding: 8px 10px;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 44px rgba(28, 25, 23, 0.18);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-kind {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2d6a4f;
  background: #dcebe2;
  border-radius: 999px;
  padding: 2px 7px;
}

.selection-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1c1917;
  font-size: 12px;
  font-weight: 700;
}

.toolbar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #44403c;
  cursor: pointer;
}

.toolbar-placeholder {
  font-size: 11px;
  color: #a8a29e;
  background: #fafaf9;
  border: 1px dashed #e7e5e4;
  border-radius: 8px;
  padding: 6px 8px;
  text-align: center;
  cursor: default;
  user-select: none;
}

.segment-name-input {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #1c1917;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 6px;
  outline: none;
}
.segment-name-input:hover {
  border-color: #e7e5e4;
}
.segment-name-input:focus {
  border-color: #2d6a4f;
  background: #ffffff;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.swatch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}
.swatch-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(28, 25, 23, 0.12);
  pointer-events: none;
}
.swatch input[type='color'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.width-slider {
  flex: 1;
  min-width: 0;
  height: 4px;
  border-radius: 999px;
  appearance: none;
  -webkit-appearance: none;
  background: #e7e5e4;
  accent-color: #2d6a4f;
  cursor: pointer;
}

.width-readout {
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  font-size: 10px;
  color: #78716c;
  font-variant-numeric: tabular-nums;
}

.toolbar-chip {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #78716c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
}
.toolbar-chip.is-active {
  border-color: #2d6a4f;
  background: #dcebe2;
  color: #1f4d38;
}

.toolbar-icon-btn--danger:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
</style>
