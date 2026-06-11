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
          <span class="selection-name" :title="selection.displayName">{{ selection.displayName }}</span>
          <button class="toolbar-icon-btn" title="Close" data-testid="map-selection-close" @click="$emit('close')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <!-- Placeholder row only — element controls land in E4/E5. -->
        <div class="toolbar-placeholder" aria-disabled="true">Controls coming</div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import type { Map as MapLibreMap } from 'maplibre-gl'
import { mapSelectionKindLabel, type MapElementSelection } from '~/composables/useMapElementSelection'

const props = defineProps<{
  selection: MapElementSelection | null
  /** Function prop so the (late-created, non-reactive) MapLibre instance is read lazily. */
  getMap: () => MapLibreMap | null
}>()

defineEmits<{ close: [] }>()

const RING_SIZE_PX = 28
const TOOLBAR_OFFSET_PX = 18
const TOOLBAR_WIDTH_PX = 240

const anchor = ref<{ x: number; y: number } | null>(null)
const anchorVisible = ref(false)

const kindLabel = computed(() => props.selection ? mapSelectionKindLabel(props.selection.slot) : '')

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
  const left = Math.min(
    Math.max(12, anchor.value.x - TOOLBAR_WIDTH_PX / 2),
    window.innerWidth - TOOLBAR_WIDTH_PX - 12,
  )
  const below = anchor.value.y + TOOLBAR_OFFSET_PX
  const estimatedHeight = 76
  const top = below + estimatedHeight < window.innerHeight - 12
    ? below
    : Math.max(12, anchor.value.y - estimatedHeight - TOOLBAR_OFFSET_PX)
  return { left: `${left}px`, top: `${top}px`, width: `${TOOLBAR_WIDTH_PX}px` }
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
</style>
