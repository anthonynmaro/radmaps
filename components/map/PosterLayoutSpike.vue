<template>
  <div
    class="layout-spike"
    :class="{ 'is-dragging': Boolean(draggingBlockId), 'is-placing': Boolean(pendingInsert) }"
    data-testid="layout-spike"
  >
    <aside class="layout-spike-rail" data-testid="layout-spike-left-rail">
      <button
        v-for="item in railItems"
        :key="item.id"
        class="layout-spike-rail-btn"
        :class="{ 'is-active': activeDrawer === item.id }"
        :data-testid="`layout-spike-rail-${item.id}`"
        :title="item.label"
        @click="activeDrawer = item.id"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
      </button>
    </aside>

    <aside class="layout-spike-drawer" data-testid="layout-spike-left-drawer">
      <div class="layout-spike-drawer-head">
        <p>{{ drawerTitle }}</p>
        <span>{{ drawerSubtitle }}</span>
      </div>

      <div
        v-if="selectedBlock"
        class="layout-spike-selected-card"
        data-testid="layout-spike-selected-card"
      >
        <div>
          <p>Selected</p>
          <span>{{ selectedBlock.label ?? selectedBlock.kind }}</span>
        </div>
        <div class="layout-spike-selected-actions">
          <button data-testid="layout-spike-selected-duplicate" @click="duplicateSelectedBlock">Duplicate</button>
          <button class="is-danger" data-testid="layout-spike-selected-delete" @click="deleteSelectedBlock">Delete</button>
        </div>
      </div>

      <div v-if="activeDrawer === 'insert'" class="layout-spike-insert" data-testid="layout-spike-insert-drawer">
        <p class="layout-spike-section-label">Essentials</p>
        <div class="layout-spike-block-grid">
          <button class="layout-spike-block-card" data-testid="layout-spike-add-text" @click="requestAddBlock('text')">
            <span>T</span>
            <strong>Text</strong>
          </button>
          <button class="layout-spike-block-card" data-testid="layout-spike-add-image" @click="requestAddBlock('image')">
            <span>[ ]</span>
            <strong>Image</strong>
          </button>
          <button class="layout-spike-block-card" data-testid="layout-spike-add-icon" @click="requestAddBlock('icon')">
            <span>^</span>
            <strong>Icon</strong>
          </button>
          <button class="layout-spike-block-card" data-testid="layout-spike-add-spacer" @click="requestAddBlock('spacer')">
            <span>S</span>
            <strong>Spacer</strong>
          </button>
          <button class="layout-spike-block-card is-wide" data-testid="layout-spike-add-row" @click="requestAddRow">
            <span>+</span>
            <strong>Row</strong>
          </button>
        </div>

        <div class="layout-spike-reference" data-testid="layout-spike-library-notes">
          <p class="layout-spike-section-label">Spike References</p>
          <div v-for="candidate in libraryCandidates" :key="candidate.name" class="layout-spike-candidate">
            <strong>{{ candidate.name }}</strong>
            <span>{{ candidate.note }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="activeDrawer === 'layers'" class="layout-spike-layers" data-testid="layout-spike-layers">
        <div class="layout-spike-layer-static">Theme chrome</div>
        <div class="layout-spike-layer-static">Map</div>
        <template v-for="band in draftBands" :key="band.id">
          <p class="layout-spike-section-label">{{ band.label }}</p>
          <button
            v-for="row in band.rows"
            :key="row.id"
            class="layout-spike-layer-row"
            :class="{ 'is-selected': selectedRowId === row.id }"
            @click="selectRow(band.id, row.id)"
          >
            <span>{{ row.kind === 'spacer' ? 'Spacer row' : 'Row' }}</span>
            <small>{{ row.cells.length }} {{ row.cells.length === 1 ? 'cell' : 'cells' }}</small>
          </button>
          <button
            v-for="block in layerBlocks(band.rows)"
            :key="block.id"
            class="layout-spike-layer-block"
            :class="{ 'is-selected': selectedBlockId === block.id }"
            :data-testid="`layout-spike-layer-${block.id}`"
            @click="selectBlock(block.id)"
          >
            <span>{{ block.label ?? block.kind }}</span>
            <small>{{ block.kind }}</small>
          </button>
        </template>
      </div>

      <div v-else-if="activeDrawer === 'assets'" class="layout-spike-empty">
        <p class="layout-spike-section-label">Assets</p>
        <button class="layout-spike-file-card" data-testid="layout-spike-upload-placeholder" @click="requestAddBlock('image')">
          <span>[ ]</span>
          <strong>Add local image slot</strong>
        </button>
      </div>

      <div v-else class="layout-spike-icons" data-testid="layout-spike-icons-drawer">
        <p class="layout-spike-section-label">Local Icons</p>
        <button
          v-for="icon in localIcons"
          :key="icon.id"
          class="layout-spike-file-card"
          :data-testid="`layout-spike-icon-${icon.id}`"
          @click="addIcon(icon.id)"
        >
          <span>{{ icon.symbol }}</span>
          <strong>{{ icon.label }}</strong>
        </button>
      </div>
    </aside>

    <main class="layout-spike-workspace">
      <header class="layout-spike-topbar">
        <button class="layout-spike-done">Done</button>
        <p>Poster Layout Spike</p>
        <button class="layout-spike-view">Preview</button>
      </header>

      <section class="layout-spike-stage">
        <div class="layout-spike-poster-frame" data-testid="layout-spike-canvas">
          <MapPreview
            class="layout-spike-map-preview"
            :map="map"
            :style-config="previewStyleConfig"
            :editable="false"
          />
          <div class="layout-spike-edit-layer" data-testid="layout-spike-edit-layer">
            <section
              v-for="band in draftBands"
              :key="band.id"
              class="layout-spike-band"
              :class="`layout-spike-band--${band.id}`"
              :data-testid="`layout-spike-band-${band.id}`"
            >
              <div class="layout-spike-band-tag">{{ band.label }}</div>
              <div
                v-for="row in band.rows"
                :key="row.id"
                class="layout-spike-row"
                :class="{ 'is-spacer': row.kind === 'spacer', 'is-selected': selectedRowId === row.id }"
                :style="rowStyle(row)"
                :data-row-id="row.id"
                data-testid="layout-spike-row"
                @click.self="selectRow(band.id, row.id)"
              >
                <div
                  v-for="cell in row.cells"
                  :key="cell.id"
                  class="layout-spike-cell"
                  :class="{ 'is-empty': !cell.blocks.length }"
                  :style="{ flex: `${cell.widthFr} 1 0` }"
                  :data-cell-id="cell.id"
                  data-testid="layout-spike-cell"
                  @click.self="selectRow(band.id, row.id)"
                  @dragover.prevent
                  @drop="onDropIntoCell($event, band.id, row.id, cell.id)"
                >
                  <article
                    v-for="block in cell.blocks"
                    :key="block.id"
                    class="layout-spike-block"
                    :class="[
                      `layout-spike-block--${block.kind}`,
                      selectedBlockId === block.id ? 'is-selected' : '',
                    ]"
                    :draggable="false"
                    :data-block-id="block.id"
                    data-testid="layout-spike-block"
                    @click.stop="selectBlock(block.id)"
                    @dragstart="onDragStart($event, block.id)"
                    @dragend="draggingBlockId = null"
                  >
                    <button
                      class="layout-spike-drop-beside"
                      data-testid="layout-spike-drop-beside"
                      title="Drop beside to create a column"
                      @dragover.prevent
                      @drop.stop="onDropBeside($event, block.id)"
                    />

                    <div
                      v-if="block.kind === 'text' && selectedBlockId === block.id"
                      class="layout-spike-text"
                      contenteditable="true"
                      spellcheck="false"
                      :data-testid="`layout-spike-text-${block.id}`"
                      @focus="selectBlock(block.id)"
                      @input="onTextInput(block.id, $event)"
                    >{{ block.text }}</div>
                    <div
                      v-else-if="block.kind === 'text'"
                      class="layout-spike-hit-proxy"
                      :title="block.label ?? 'Text'"
                    />
                    <div v-else-if="block.kind === 'image'" class="layout-spike-media-block">
                      <span>[ ]</span>
                      <strong>{{ block.label ?? 'Image' }}</strong>
                    </div>
                    <div v-else-if="block.kind === 'icon'" class="layout-spike-icon-block">
                      <span>{{ iconSymbol(block.icon) }}</span>
                      <strong>{{ block.label ?? 'Icon' }}</strong>
                    </div>
                    <div v-else class="layout-spike-spacer-block">
                      <span>Spacer</span>
                    </div>

                    <div
                      v-if="selectedBlockId === block.id"
                      class="layout-spike-context-toolbar"
                      data-testid="layout-spike-context-toolbar"
                    >
                      <span
                        class="layout-spike-drag-handle"
                        aria-label="Drag handle"
                        draggable="true"
                        @dragstart.stop="onDragStart($event, block.id)"
                        @dragend="draggingBlockId = null"
                      >::</span>
                      <button class="layout-spike-toolbar-action" data-testid="layout-spike-duplicate-block" title="Duplicate" @click.stop="duplicateSelectedBlock">Dup</button>
                      <button class="layout-spike-toolbar-action is-danger" data-testid="layout-spike-delete-block" title="Delete" @click.stop="deleteSelectedBlock">Delete</button>
                      <button class="layout-spike-toolbar-action" title="More">...</button>
                    </div>
                  </article>

                  <button
                    v-if="!cell.blocks.length"
                    class="layout-spike-empty-cell"
                    data-testid="layout-spike-empty-cell"
                    @click.stop="addBlockToCell(band.id, row.id, cell.id, 'text')"
                  >
                    Add text
                  </button>

                  <button
                    v-if="row.cells.length > 1 && cell !== row.cells[row.cells.length - 1]"
                    class="layout-spike-column-resize"
                    data-testid="layout-spike-column-resize"
                    title="Resize column"
                    @pointerdown.prevent="startColumnResize($event, band.id, row.id, cell.id)"
                  />
                </div>

                <button
                  class="layout-spike-row-resize"
                  data-testid="layout-spike-row-resize"
                  title="Resize row"
                  @pointerdown.prevent="startRowResize($event, band.id, row.id)"
                />
                <button
                  class="layout-spike-drop-below"
                  data-testid="layout-spike-drop-below"
                  title="Drop below to reorder rows"
                  @dragover.prevent
                  @drop.stop="onDropBelow($event, band.id, row.id)"
                />
              </div>
            </section>
            <section class="layout-spike-map-zone" aria-hidden="true" />
            <div
              v-if="pendingInsert"
              class="layout-spike-placement-layer"
              data-testid="layout-spike-placement-layer"
            >
              <button
                class="layout-spike-placement-target layout-spike-placement-target--header"
                data-testid="layout-spike-place-header"
                @click="placePendingInsert('header')"
              >
                Add {{ pendingInsertLabel }} to header
              </button>
              <button
                class="layout-spike-placement-target layout-spike-placement-target--footer"
                data-testid="layout-spike-place-footer"
                @click="placePendingInsert('footer')"
              >
                Add {{ pendingInsertLabel }} to footer
              </button>
              <button
                class="layout-spike-placement-cancel"
                data-testid="layout-spike-place-cancel"
                @click="pendingInsert = null"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <aside class="layout-spike-right" data-testid="layout-spike-right-panel">
      <div class="layout-spike-panel-head">
        <p>Map Style</p>
        <span>Route, terrain, theme, print</span>
      </div>
      <div class="layout-spike-tabs">
        <button class="is-active">Map</button>
        <button>Route</button>
        <button>Trail</button>
        <button>Print</button>
      </div>
      <section class="layout-spike-control">
        <p class="layout-spike-section-label">Route color</p>
        <div class="layout-spike-swatches" data-testid="layout-spike-route-color">
          <button
            v-for="color in routeColors"
            :key="color"
            :style="{ backgroundColor: color }"
            :class="{ 'is-active': modelValue.route_color === color }"
            @click="setRouteColor(color)"
          />
        </div>
      </section>
      <section class="layout-spike-control">
        <p class="layout-spike-section-label">Terrain</p>
        <label class="layout-spike-toggle">
          <input
            type="checkbox"
            :checked="modelValue.show_contours"
            @change="setStyleField('show_contours', ($event.target as HTMLInputElement).checked)"
          />
          <span>Contours</span>
        </label>
        <label class="layout-spike-toggle">
          <input
            type="checkbox"
            :checked="modelValue.show_hillshade"
            @change="setStyleField('show_hillshade', ($event.target as HTMLInputElement).checked)"
          />
          <span>Hillshade</span>
        </label>
      </section>
      <section class="layout-spike-control">
        <p class="layout-spike-section-label">Recommendation</p>
        <div class="layout-spike-recommendation">
          Native Vue structured editor is the control path; Puck/Craft conventions are references, not renderers.
        </div>
      </section>
    </aside>

    <nav class="layout-spike-mobile-bar" data-testid="layout-spike-mobile-bar">
      <button data-testid="layout-spike-mobile-insert" @click="openMobileSheet('insert')">Insert</button>
      <button data-testid="layout-spike-mobile-layers" @click="openMobileSheet('layers')">Layers</button>
      <button data-testid="layout-spike-mobile-selected" @click="openMobileSheet('selected')">Selected</button>
      <button data-testid="layout-spike-mobile-style" @click="openMobileSheet('style')">Style</button>
    </nav>

    <div
      v-if="mobileSheet"
      class="layout-spike-mobile-sheet"
      data-testid="layout-spike-mobile-sheet"
    >
      <div class="layout-spike-mobile-sheet-head">
        <strong>{{ mobileSheetTitle }}</strong>
        <button @click="mobileSheet = null">Close</button>
      </div>
      <div v-if="mobileSheet === 'insert'" class="layout-spike-mobile-grid">
        <button data-testid="layout-spike-mobile-add-text" @click="addBlock('text')">Text</button>
        <button @click="addBlock('image')">Image</button>
        <button @click="addBlock('icon')">Icon</button>
        <button @click="addBlock('spacer')">Spacer</button>
      </div>
      <div v-else-if="mobileSheet === 'layers'" class="layout-spike-mobile-list">
        <button v-for="block in allBlocks" :key="block.id" @click="selectBlock(block.id)">
          {{ block.label ?? block.kind }}
        </button>
      </div>
      <div v-else-if="mobileSheet === 'selected'" class="layout-spike-mobile-actions">
        <button data-testid="layout-spike-mobile-duplicate" :disabled="!selectedBlockId" @click="duplicateSelectedBlock">Duplicate</button>
        <button data-testid="layout-spike-mobile-delete" :disabled="!selectedBlockId" @click="deleteSelectedBlock">Delete</button>
      </div>
      <div v-else class="layout-spike-mobile-list">
        <button
          v-for="color in routeColors"
          :key="color"
          :style="{ borderColor: color }"
          @click="setRouteColor(color)"
        >
          {{ color }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import MapPreview from '~/components/map/MapPreview.vue'
import type { PosterLayoutDraftBandId, PosterLayoutDraftBlock, PosterLayoutDraftBlockKind, PosterLayoutDraftRow } from '~/utils/posterLayoutDraft'
import {
  appendDraftBlock,
  clonePosterLayoutDraft,
  createDraftBlock,
  createDraftCell,
  createDraftRow,
  draftToPosterLayout,
  duplicateDraftBlock,
  deleteDraftBlock,
  findDraftBlock,
  moveDraftBlockBelow,
  moveDraftBlockBeside,
  posterLayoutToDraft,
  resizeDraftCell,
  resizeDraftRow,
  updateDraftBlockText,
} from '~/utils/posterLayoutDraft'
import type { StyleConfig, TrailMap } from '~/types'

const props = defineProps<{
  modelValue: StyleConfig
  map: TrailMap
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
}>()

const railItems = [
  { id: 'insert', label: 'Insert', icon: '+' },
  { id: 'layers', label: 'Layers', icon: 'L' },
  { id: 'assets', label: 'Assets', icon: 'A' },
  { id: 'icons', label: 'Icons', icon: 'I' },
] as const
type DrawerId = typeof railItems[number]['id']
type MobileSheet = 'insert' | 'layers' | 'selected' | 'style'

const libraryCandidates = [
  { name: 'Puck', note: 'Config, fields, slots.' },
  { name: 'Craft.js', note: 'Nodes, rules, settings.' },
  { name: 'GrapesJS', note: 'Reject raw HTML export.' },
  { name: 'myissue', note: 'Vue/Tiptap patterns.' },
  { name: 'Native Vue', note: 'Best control path.' },
]

const localIcons = [
  { id: 'mountain' as const, label: 'Mountain', symbol: '^' },
  { id: 'pin' as const, label: 'Pin', symbol: 'o' },
  { id: 'route' as const, label: 'Route', symbol: '~' },
]

const routeColors = ['#C1121F', '#2D6A4F', '#154C79', '#F9A620', '#1C1917']

const activeDrawer = ref<DrawerId>('insert')
const mobileSheet = ref<MobileSheet | null>(null)
const draft = ref(posterLayoutToDraft(props.modelValue, props.map.stats))
const selectedBlockId = ref<string | null>(null)
const selectedRow = ref<{ bandId: PosterLayoutDraftBandId; rowId: string } | null>(null)
const draggingBlockId = ref<string | null>(null)
const pendingInsert = ref<{ kind: PosterLayoutDraftBlockKind; action: 'block' | 'row' } | null>(null)
const resizing = ref<{
  type: 'column' | 'row'
  bandId: PosterLayoutDraftBandId
  rowId: string
  cellId?: string
  startX: number
  startY: number
} | null>(null)

const drawerTitle = computed(() => ({
  insert: 'Insert',
  layers: 'Layers',
  assets: 'Assets',
  icons: 'Icons',
}[activeDrawer.value]))

const drawerSubtitle = computed(() => ({
  insert: 'Blocks, rows, spacing',
  layers: 'Header, map, footer',
  assets: 'Local image slots',
  icons: 'SVG icon registry',
}[activeDrawer.value]))

const mobileSheetTitle = computed(() => ({
  insert: 'Insert',
  layers: 'Layers',
  selected: 'Selected',
  style: 'Style',
}[mobileSheet.value ?? 'insert']))

const draftBands = computed(() => [draft.value.bands.header, draft.value.bands.footer])
const selectedRowId = computed(() => selectedRow.value?.rowId ?? null)
const selectedBlock = computed(() => selectedBlockId.value ? findDraftBlock(draft.value, selectedBlockId.value)?.block ?? null : null)
const allBlocks = computed(() => draftBands.value.flatMap(band => layerBlocks(band.rows)))
const pendingInsertLabel = computed(() => {
  if (!pendingInsert.value) return 'block'
  if (pendingInsert.value.action === 'row') return 'row'
  return pendingInsert.value.kind
})
const previewStyleConfig = computed<StyleConfig>(() => ({
  ...props.modelValue,
  composition: 'editorial-tall',
  poster_layout: draftToPosterLayout(draft.value),
}))

watch(
  () => props.modelValue.poster_layout,
  () => {
    draft.value = posterLayoutToDraft(props.modelValue, props.map.stats)
  },
  { deep: true },
)

onMounted(() => {
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('keydown', onKeydown)
  if (import.meta.dev) {
    ;(window as unknown as {
      __RADMAPS_POSTER_LAYOUT_SPIKE__?: {
        getDraft: () => unknown
        getStyle: () => StyleConfig
        getPosterLayout: () => unknown
      }
    }).__RADMAPS_POSTER_LAYOUT_SPIKE__ = {
      getDraft: () => draft.value,
      getStyle: () => previewStyleConfig.value,
      getPosterLayout: () => draftToPosterLayout(draft.value),
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('keydown', onKeydown)
  if (import.meta.dev) {
    delete (window as unknown as {
      __RADMAPS_POSTER_LAYOUT_SPIKE__?: {
        getDraft: () => unknown
        getStyle: () => StyleConfig
        getPosterLayout: () => unknown
      }
    }).__RADMAPS_POSTER_LAYOUT_SPIKE__
  }
})

function commitDraft(next: typeof draft.value) {
  draft.value = next
  emit('update:modelValue', {
    ...props.modelValue,
    composition: 'editorial-tall',
    poster_layout: draftToPosterLayout(next),
  })
}

function layerBlocks(rows: typeof draft.value.bands.header.rows): PosterLayoutDraftBlock[] {
  return rows.flatMap(row => row.cells.flatMap(cell => cell.blocks))
}

function rowStyle(row: PosterLayoutDraftRow) {
  return {
    flex: `${row.heightFr} 1 0`,
    minHeight: row.kind === 'spacer' ? `${Math.max(18, Math.round(row.heightFr * 34))}px` : undefined,
  }
}

function selectedLocation() {
  return selectedBlockId.value ? findDraftBlock(draft.value, selectedBlockId.value)?.location ?? null : null
}

function requestAddBlock(kind: PosterLayoutDraftBlockKind) {
  if (selectedLocation() || selectedRow.value) {
    addBlock(kind)
    return
  }
  pendingInsert.value = { kind, action: 'block' }
}

function requestAddRow() {
  if (selectedLocation() || selectedRow.value) {
    addRow()
    return
  }
  pendingInsert.value = { kind: 'text', action: 'row' }
}

function addBlock(kind: PosterLayoutDraftBlockKind) {
  const result = insertBlockFromContext(draft.value, kind)
  selectedBlockId.value = result.blockId
  selectedRow.value = null
  pendingInsert.value = null
  commitDraft(result.draft)
  focusBlock(result.blockId)
}

function insertBlockFromContext(
  currentDraft: typeof draft.value,
  kind: PosterLayoutDraftBlockKind,
): { draft: typeof draft.value; blockId: string } {
  const next = clonePosterLayoutDraft(currentDraft)
  const block = createDraftBlock(kind)
  const location = selectedLocation()
  const selectedBandId = location?.bandId ?? selectedRow.value?.bandId ?? 'header'

  if (kind === 'spacer') {
    const row = createDraftRow('spacer', [block], { heightFr: 0.75 })
    const rowIndex = location?.rowIndex ?? selectedRowIndex(next, selectedBandId)
    insertRowAtIndex(next, selectedBandId, row, rowIndex >= 0 ? rowIndex + 1 : defaultInsertRowIndex(next, selectedBandId) + 1)
    return { draft: next, blockId: block.id }
  }

  if (location) {
    const row = next.bands[location.bandId].rows[location.rowIndex]
    if (row?.kind === 'content' && row.cells.length < 3) {
      row.cells.splice(location.cellIndex + 1, 0, createDraftCell(block))
    } else {
      insertRowAtIndex(next, location.bandId, createDraftRow('content', [block]), location.rowIndex + 1)
    }
    return { draft: next, blockId: block.id }
  }

  if (selectedRow.value) {
    const rowIndex = selectedRowIndex(next, selectedRow.value.bandId)
    const row = next.bands[selectedRow.value.bandId].rows[rowIndex]
    if (row?.kind === 'content' && row.cells.length < 3) {
      row.cells.push(createDraftCell(block))
    } else {
      insertRowAtIndex(next, selectedRow.value.bandId, createDraftRow('content', [block]), rowIndex + 1)
    }
    return { draft: next, blockId: block.id }
  }

  insertBlockAtDefault(next, selectedBandId, block)
  return { draft: next, blockId: block.id }
}

function insertBlockAtDefault(
  targetDraft: typeof draft.value,
  bandId: PosterLayoutDraftBandId,
  block: PosterLayoutDraftBlock,
) {
  const rowIndex = defaultInsertRowIndex(targetDraft, bandId)
  const row = targetDraft.bands[bandId].rows[rowIndex]
  if (row?.kind === 'content' && row.cells.length < 3) {
    row.cells.push(createDraftCell(block))
  } else {
    insertRowAtIndex(targetDraft, bandId, createDraftRow('content', [block]), rowIndex + 1)
  }
}

function insertRowAtDefault(
  targetDraft: typeof draft.value,
  bandId: PosterLayoutDraftBandId,
  row: PosterLayoutDraftRow,
) {
  insertRowAtIndex(targetDraft, bandId, row, defaultInsertRowIndex(targetDraft, bandId) + 1)
}

function insertRowAtIndex(
  targetDraft: typeof draft.value,
  bandId: PosterLayoutDraftBandId,
  row: PosterLayoutDraftRow,
  index: number,
) {
  const rows = targetDraft.bands[bandId].rows
  rows.splice(Math.max(0, Math.min(rows.length, index)), 0, row)
}

function selectedRowIndex(targetDraft: typeof draft.value, bandId: PosterLayoutDraftBandId) {
  if (!selectedRow.value || selectedRow.value.bandId !== bandId) return -1
  return targetDraft.bands[bandId].rows.findIndex(row => row.id === selectedRow.value?.rowId)
}

function defaultInsertRowIndex(targetDraft: typeof draft.value, bandId: PosterLayoutDraftBandId) {
  const rows = targetDraft.bands[bandId].rows
  const preferredIds = bandId === 'header'
    ? ['header-subtitle', 'header-title', 'header-meta']
    : ['footer-primary']
  for (const id of preferredIds) {
    const index = rows.findIndex(row => row.id === id)
    if (index >= 0) return index
  }
  const contentIndex = rows.findIndex(row => row.kind === 'content')
  return contentIndex >= 0 ? contentIndex : Math.max(0, rows.length - 1)
}

function addIcon(icon: 'mountain' | 'pin' | 'route') {
  const location = selectedLocation()
  const bandId = location?.bandId ?? selectedRow.value?.bandId ?? 'header'
  const next = clonePosterLayoutDraft(draft.value)
  const block = createDraftBlock('icon', { icon, label: icon.replace(/^\w/, value => value.toUpperCase()) })
  const targetBand = next.bands[bandId]
  const row = location
    ? targetBand.rows[location.rowIndex]
    : targetBand.rows.find(candidate => candidate.kind === 'content')
  if (row) {
    row.cells.push(createDraftCell(block))
  } else {
    targetBand.rows.push(createDraftRow('content', [block]))
  }
  selectedBlockId.value = block.id
  selectedRow.value = null
  pendingInsert.value = null
  commitDraft(next)
}

function addBlockToCell(
  bandId: PosterLayoutDraftBandId,
  rowId: string,
  cellId: string,
  kind: PosterLayoutDraftBlockKind,
) {
  const result = appendDraftBlock(draft.value, bandId, kind, rowId, cellId)
  selectedBlockId.value = result.blockId
  selectedRow.value = null
  pendingInsert.value = null
  commitDraft(result.draft)
  focusBlock(result.blockId)
}

function addRow() {
  const location = selectedLocation()
  const bandId = location?.bandId ?? selectedRow.value?.bandId ?? 'header'
  const next = clonePosterLayoutDraft(draft.value)
  const row = createDraftRow('content', [createDraftBlock('text')])
  const targetIndex = selectedRow.value?.bandId === bandId
    ? next.bands[bandId].rows.findIndex(candidate => candidate.id === selectedRow.value?.rowId)
    : location?.rowIndex ?? -1
  if (targetIndex >= 0) next.bands[bandId].rows.splice(targetIndex + 1, 0, row)
  else next.bands[bandId].rows.push(row)
  selectedBlockId.value = row.cells[0]?.blocks[0]?.id ?? null
  selectedRow.value = null
  pendingInsert.value = null
  commitDraft(next)
  if (selectedBlockId.value) focusBlock(selectedBlockId.value)
}

function placePendingInsert(bandId: PosterLayoutDraftBandId) {
  if (!pendingInsert.value) return
  const pending = pendingInsert.value
  const next = clonePosterLayoutDraft(draft.value)
  if (pending.action === 'row') {
    const row = createDraftRow('content', [createDraftBlock('text')])
    insertRowAtDefault(next, bandId, row)
    selectedBlockId.value = row.cells[0]?.blocks[0]?.id ?? null
    selectedRow.value = null
    pendingInsert.value = null
    commitDraft(next)
    if (selectedBlockId.value) focusBlock(selectedBlockId.value)
    return
  }

  const block = createDraftBlock(pending.kind)
  if (pending.kind === 'spacer') {
    insertRowAtDefault(next, bandId, createDraftRow('spacer', [block], { heightFr: 0.75 }))
  } else {
    insertBlockAtDefault(next, bandId, block)
  }
  selectedBlockId.value = block.id
  selectedRow.value = null
  pendingInsert.value = null
  commitDraft(next)
  focusBlock(block.id)
}

function selectBlock(blockId: string) {
  pendingInsert.value = null
  selectedBlockId.value = blockId
  const found = findDraftBlock(draft.value, blockId)
  selectedRow.value = found
    ? { bandId: found.location.bandId, rowId: draft.value.bands[found.location.bandId].rows[found.location.rowIndex].id }
    : null
}

function selectRow(bandId: PosterLayoutDraftBandId, rowId: string) {
  pendingInsert.value = null
  selectedRow.value = { bandId, rowId }
  selectedBlockId.value = null
}

function onTextInput(blockId: string, event: Event) {
  const text = (event.target as HTMLElement).innerText
  commitDraft(updateDraftBlockText(draft.value, blockId, text))
}

function duplicateSelectedBlock() {
  if (!selectedBlockId.value) return
  const result = duplicateDraftBlock(draft.value, selectedBlockId.value)
  if (result.blockId) selectedBlockId.value = result.blockId
  commitDraft(result.draft)
  if (result.blockId && selectedBlock.value?.kind === 'text') focusBlock(result.blockId)
}

function deleteSelectedBlock() {
  if (!selectedBlockId.value) return
  const next = deleteDraftBlock(draft.value, selectedBlockId.value)
  selectedBlockId.value = null
  commitDraft(next)
}

function onKeydown(event: KeyboardEvent) {
  if (!selectedBlockId.value) return
  if (event.key !== 'Delete' && event.key !== 'Backspace') return
  if (isTextEntryTarget(event.target)) return
  event.preventDefault()
  deleteSelectedBlock()
}

function isTextEntryTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

function onDragStart(event: DragEvent, blockId: string) {
  draggingBlockId.value = blockId
  event.dataTransfer?.setData('text/plain', blockId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function droppedBlockId(event: DragEvent) {
  return event.dataTransfer?.getData('text/plain') || draggingBlockId.value
}

function onDropBeside(event: DragEvent, targetBlockId: string) {
  const blockId = droppedBlockId(event)
  if (!blockId) return
  selectedBlockId.value = blockId
  commitDraft(moveDraftBlockBeside(draft.value, blockId, targetBlockId))
}

function onDropBelow(event: DragEvent, bandId: PosterLayoutDraftBandId, rowId: string) {
  const blockId = droppedBlockId(event)
  if (!blockId) return
  selectedBlockId.value = blockId
  commitDraft(moveDraftBlockBelow(draft.value, blockId, rowId, bandId))
}

function onDropIntoCell(
  event: DragEvent,
  bandId: PosterLayoutDraftBandId,
  rowId: string,
  cellId: string,
) {
  const blockId = droppedBlockId(event)
  if (!blockId) return
  const next = clonePosterLayoutDraft(deleteDraftBlock(draft.value, blockId))
  const block = findDraftBlock(draft.value, blockId)?.block
  const row = next.bands[bandId].rows.find(candidate => candidate.id === rowId)
  const cell = row?.cells.find(candidate => candidate.id === cellId)
  if (!block || !cell) return
  cell.blocks = [{ ...block, source: 'user' }]
  selectedBlockId.value = blockId
  commitDraft(next)
}

function startColumnResize(
  event: PointerEvent,
  bandId: PosterLayoutDraftBandId,
  rowId: string,
  cellId: string,
) {
  resizing.value = {
    type: 'column',
    bandId,
    rowId,
    cellId,
    startX: event.clientX,
    startY: event.clientY,
  }
}

function startRowResize(event: PointerEvent, bandId: PosterLayoutDraftBandId, rowId: string) {
  resizing.value = {
    type: 'row',
    bandId,
    rowId,
    startX: event.clientX,
    startY: event.clientY,
  }
}

function onResizeMove(event: PointerEvent) {
  if (!resizing.value) return
  const active = resizing.value
  if (active.type === 'column' && active.cellId) {
    const delta = (event.clientX - active.startX) / 120
    commitDraft(resizeDraftCell(draft.value, active.bandId, active.rowId, active.cellId, delta))
    resizing.value = { ...active, startX: event.clientX, startY: event.clientY }
  } else {
    const delta = (event.clientY - active.startY) / 80
    commitDraft(resizeDraftRow(draft.value, active.bandId, active.rowId, delta))
    resizing.value = { ...active, startX: event.clientX, startY: event.clientY }
  }
}

function endResize() {
  resizing.value = null
}

function setRouteColor(routeColor: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    route_color: routeColor,
    poster_layout: draftToPosterLayout(draft.value),
  })
}

function setStyleField<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value,
    poster_layout: draftToPosterLayout(draft.value),
  })
}

function focusBlock(blockId: string) {
  nextTick(() => {
    const element = document.querySelector<HTMLElement>(`[data-testid="layout-spike-text-${CSS.escape(blockId)}"]`)
    element?.focus()
  })
}

function iconSymbol(icon?: PosterLayoutDraftBlock['icon']) {
  return localIcons.find(candidate => candidate.id === icon)?.symbol ?? '^'
}

function openMobileSheet(sheet: MobileSheet) {
  mobileSheet.value = sheet
}
</script>

<style scoped>
.layout-spike {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 48px 232px minmax(0, 1fr) 304px;
  background: #f4f3ef;
  color: #1c1917;
  overflow: visible;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.layout-spike button {
  font: inherit;
}

.layout-spike-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  background: #23211f;
  border-right: 1px solid rgba(255,255,255,0.08);
}

.layout-spike-rail-btn {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #f8f7f2;
  background: transparent;
  cursor: pointer;
}

.layout-spike-rail-btn.is-active,
.layout-spike-rail-btn:hover {
  background: #f8f7f2;
  color: #1c1917;
}

.layout-spike-drawer,
.layout-spike-right {
  min-height: 0;
  overflow-y: auto;
  background: #fbfaf7;
  border-right: 1px solid #dedbd2;
}

.layout-spike-right {
  border-right: 0;
  border-left: 1px solid #dedbd2;
}

.layout-spike-drawer-head,
.layout-spike-panel-head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid #ebe8df;
}

.layout-spike-drawer-head p,
.layout-spike-panel-head p {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}

.layout-spike-drawer-head span,
.layout-spike-panel-head span {
  display: block;
  margin-top: 2px;
  color: #8d8678;
  font-size: 11px;
  font-weight: 600;
}

.layout-spike-insert,
.layout-spike-layers,
.layout-spike-empty,
.layout-spike-icons,
.layout-spike-control {
  padding: 11px 10px 12px;
}

.layout-spike-selected-card {
  margin: 10px;
  padding: 8px;
  border: 1px solid #d7e7fb;
  border-radius: 8px;
  background: #f4f9ff;
}

.layout-spike-selected-card p {
  margin: 0;
  color: #1f4d80;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.layout-spike-selected-card span {
  display: block;
  margin-top: 2px;
  color: #263746;
  font-size: 12px;
  font-weight: 800;
}

.layout-spike-selected-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}

.layout-spike-selected-actions button {
  min-height: 28px;
  border: 1px solid #bfd7f2;
  border-radius: 6px;
  background: #fff;
  color: #1f4d80;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.layout-spike-selected-actions button.is-danger {
  border-color: #efc2c2;
  color: #b4232a;
}

.layout-spike-section-label {
  margin: 0 0 8px;
  color: #70695d;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.layout-spike-block-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.layout-spike-block-card,
.layout-spike-file-card {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e5e1d8;
  border-radius: 7px;
  background: #fff;
  color: #1f2933;
  cursor: pointer;
  text-align: left;
}

.layout-spike-block-card:hover,
.layout-spike-file-card:hover {
  border-color: #2774d9;
  box-shadow: 0 5px 12px rgba(39, 116, 217, 0.1);
}

.layout-spike-block-card span,
.layout-spike-file-card span {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1px solid #d6d1c5;
  border-radius: 5px;
  color: #2f3b45;
  font-size: 12px;
  font-weight: 800;
}

.layout-spike-block-card strong,
.layout-spike-file-card strong {
  font-size: 12px;
}

.layout-spike-block-card.is-wide {
  grid-column: 1 / -1;
}

.layout-spike-reference {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #ebe8df;
}

.layout-spike-candidate,
.layout-spike-recommendation {
  padding: 7px 8px;
  border: 1px solid #e5e1d8;
  border-radius: 7px;
  background: #fff;
}

.layout-spike-candidate + .layout-spike-candidate {
  margin-top: 6px;
}

.layout-spike-candidate strong {
  display: block;
  font-size: 11px;
}

.layout-spike-candidate span,
.layout-spike-recommendation {
  color: #625c52;
  font-size: 10px;
  line-height: 1.25;
}

.layout-spike-layer-static,
.layout-spike-layer-row,
.layout-spike-layer-block {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 9px 10px;
  border: 1px solid #e5e1d8;
  border-radius: 8px;
  background: #fff;
  color: #2f2a23;
  text-align: left;
}

.layout-spike-layer-row,
.layout-spike-layer-block {
  cursor: pointer;
}

.layout-spike-layer-block {
  margin-left: 12px;
  width: calc(100% - 12px);
  border-style: dashed;
}

.layout-spike-layer-row.is-selected,
.layout-spike-layer-block.is-selected {
  border-color: #2774d9;
  background: #edf6ff;
}

.layout-spike-layer-row small,
.layout-spike-layer-block small {
  color: #8d8678;
  font-size: 10px;
  text-transform: uppercase;
}

.layout-spike-workspace {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.layout-spike-topbar {
  height: 52px;
  display: grid;
  grid-template-columns: 90px 1fr 90px;
  align-items: center;
  padding: 0 14px;
  background: #34322f;
  color: #f8f7f2;
}

.layout-spike-topbar p {
  margin: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 800;
  color: #cfcac0;
}

.layout-spike-done,
.layout-spike-view {
  justify-self: start;
  border: 0;
  background: transparent;
  color: #f8f7f2;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}

.layout-spike-view {
  justify-self: end;
}

.layout-spike-stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 22px;
  overflow: auto;
}

.layout-spike-poster-frame {
  position: relative;
  width: min(68vh, 100%);
  max-width: 560px;
  aspect-ratio: 2 / 3;
  background: #f8f4eb;
  box-shadow: 0 18px 48px rgba(34, 28, 19, 0.18);
}

.layout-spike-map-preview {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
  pointer-events: none;
}

.layout-spike-edit-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: auto;
}

.layout-spike-band,
.layout-spike-map-zone {
  position: absolute;
  pointer-events: auto;
}

.layout-spike-band {
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
  left: 7.5%;
  right: 7.5%;
  border: 1px solid rgba(39, 116, 217, 0);
  overflow: visible;
}

.layout-spike-band--header {
  top: 7.5%;
  height: 25%;
}

.layout-spike-band--footer {
  bottom: 5%;
  height: 11%;
}

.layout-spike-map-zone {
  top: 35%;
  bottom: 17%;
  left: 7.5%;
  right: 7.5%;
  pointer-events: none;
}

.layout-spike-placement-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: auto;
}

.layout-spike-placement-target,
.layout-spike-placement-cancel {
  position: absolute;
  border: 1px dashed rgba(39, 116, 217, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #1f4d80;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 8px 22px rgba(31, 27, 22, 0.1);
  cursor: pointer;
}

.layout-spike-placement-target {
  left: 7.5%;
  right: 7.5%;
  height: 30px;
}

.layout-spike-placement-target:hover {
  border-style: solid;
  background: #edf6ff;
}

.layout-spike-placement-target--header {
  top: 31%;
}

.layout-spike-placement-target--footer {
  bottom: 13%;
}

.layout-spike-placement-cancel {
  top: calc(50% - 15px);
  left: 50%;
  height: 30px;
  padding: 0 12px;
  border-style: solid;
  color: #625c52;
  transform: translateX(-50%);
}

.layout-spike-band-tag {
  position: absolute;
  top: 4px;
  left: 7.5%;
  color: #2774d9;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0;
  transition: opacity 120ms ease;
}

.layout-spike-band:hover .layout-spike-band-tag {
  opacity: 1;
}

.layout-spike-row {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 34px;
  gap: 5px;
  border: 1px dashed transparent;
  background: transparent;
}

.layout-spike-row:hover,
.layout-spike-row.is-selected {
  border-color: rgba(39, 116, 217, 0.72);
  background: rgba(39, 116, 217, 0.05);
}

.layout-spike-row.is-spacer {
  min-height: 22px;
  background: transparent;
}

.layout-spike-row.is-spacer:hover,
.layout-spike-row.is-spacer.is-selected {
  background: rgba(39, 116, 217, 0.07);
}

.layout-spike-cell {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.layout-spike-cell.is-empty {
  align-items: center;
  justify-content: center;
}

.layout-spike-block {
  position: relative;
  width: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  outline: 1px solid transparent;
  cursor: pointer;
}

.layout-spike-block.is-selected {
  outline: 2px solid #2774d9;
  outline-offset: 2px;
  background: rgba(39, 116, 217, 0.07);
}

.layout-spike-block:active {
  cursor: pointer;
}

.layout-spike-text {
  width: 100%;
  min-height: 30px;
  padding: 4px;
  color: #181512;
  font-size: 14px;
  font-family: inherit;
  font-weight: 800;
  line-height: 1.15;
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 0 0 1px rgba(39, 116, 217, 0.24);
}

.layout-spike-hit-proxy {
  width: 100%;
  min-height: 100%;
}

.layout-spike-media-block,
.layout-spike-icon-block,
.layout-spike-spacer-block {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #2f3b45;
  font-size: 12px;
  font-weight: 800;
}

.layout-spike-media-block,
.layout-spike-icon-block {
  border: 1px solid rgba(39, 116, 217, 0.22);
  background: rgba(255,255,255,0.72);
}

.layout-spike-spacer-block {
  color: rgba(39, 116, 217, 0.68);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0;
}

.layout-spike-row:hover .layout-spike-spacer-block,
.layout-spike-block.is-selected .layout-spike-spacer-block {
  opacity: 1;
}

.layout-spike-context-toolbar {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 1px solid #d6d1c5;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(31, 27, 22, 0.16);
  transform: translateY(-50%);
}

.layout-spike-context-toolbar button,
.layout-spike-drag-handle {
  min-width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #37312b;
  font-size: 12px;
  font-weight: 900;
}

.layout-spike-context-toolbar .layout-spike-toolbar-action {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
}

.layout-spike-context-toolbar .layout-spike-toolbar-action.is-danger {
  color: #b4232a;
}

.layout-spike-context-toolbar button:hover {
  background: #f1eee7;
}

.layout-spike-drag-handle {
  cursor: grab;
}

.layout-spike-drop-beside {
  position: absolute;
  top: 3px;
  right: -9px;
  z-index: 10;
  width: 14px;
  height: calc(100% - 6px);
  border: 0;
  border-radius: 8px;
  background: rgba(39, 116, 217, 0.01);
  cursor: copy;
}

.layout-spike-block:hover .layout-spike-drop-beside,
.layout-spike-drop-beside:hover,
.layout-spike.is-dragging .layout-spike-drop-beside {
  background: rgba(39, 116, 217, 0.22);
}

.layout-spike-drop-below {
  position: absolute;
  left: 18px;
  bottom: -9px;
  z-index: 9;
  width: calc(100% - 36px);
  height: 14px;
  border: 0;
  border-radius: 8px;
  background: rgba(39, 116, 217, 0.01);
  cursor: copy;
}

.layout-spike-row:hover .layout-spike-drop-below,
.layout-spike-drop-below:hover,
.layout-spike.is-dragging .layout-spike-drop-below {
  background: rgba(39, 116, 217, 0.22);
}

.layout-spike-empty-cell {
  border: 1px dashed #b9d4f5;
  border-radius: 7px;
  background: rgba(255,255,255,0.68);
  color: #2774d9;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.layout-spike-column-resize {
  position: absolute;
  top: 6px;
  right: -6px;
  z-index: 12;
  width: 10px;
  height: calc(100% - 12px);
  border: 0;
  border-radius: 8px;
  background: rgba(39, 116, 217, 0.01);
  cursor: ew-resize;
  pointer-events: auto;
}

.layout-spike-row:hover .layout-spike-column-resize,
.layout-spike-column-resize:hover {
  background: #2774d9;
}

.layout-spike-row-resize {
  position: absolute;
  left: 50%;
  bottom: 1px;
  z-index: 12;
  width: 40px;
  height: 8px;
  border: 0;
  border-radius: 8px;
  background: rgba(39, 116, 217, 0.01);
  cursor: ns-resize;
  pointer-events: auto;
  transform: translateX(-50%);
}

.layout-spike-row:hover .layout-spike-row-resize,
.layout-spike-row-resize:hover {
  background: #2774d9;
}

.layout-spike-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  margin: 12px 14px 0;
  padding: 3px;
  border-radius: 8px;
  background: #eeeae2;
}

.layout-spike-tabs button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6f685d;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  padding: 7px 0;
}

.layout-spike-tabs button.is-active {
  background: #fff;
  color: #191714;
  box-shadow: 0 1px 3px rgba(38, 32, 24, 0.08);
}

.layout-spike-swatches {
  display: flex;
  gap: 8px;
}

.layout-spike-swatches button {
  width: 30px;
  height: 30px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #d8d3c8;
  cursor: pointer;
}

.layout-spike-swatches button.is-active {
  box-shadow: 0 0 0 2px #2774d9;
}

.layout-spike-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: #37312b;
  font-size: 13px;
  font-weight: 700;
}

.layout-spike-mobile-bar,
.layout-spike-mobile-sheet {
  display: none;
}

@media (max-width: 760px) {
  .layout-spike {
    grid-template-columns: 1fr;
  }

  .layout-spike-rail,
  .layout-spike-drawer,
  .layout-spike-right {
    display: none;
  }

  .layout-spike-topbar {
    height: 46px;
    grid-template-columns: 64px 1fr 64px;
  }

  .layout-spike-stage {
    padding: 12px 12px 72px;
  }

  .layout-spike-poster-frame {
    width: min(100%, 48vh);
  }

  .layout-spike-context-toolbar {
    left: 50%;
    top: auto;
    bottom: calc(100% + 8px);
    transform: translateX(-50%);
  }

  .layout-spike-mobile-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 80;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 8px;
    gap: 6px;
    background: #23211f;
  }

  .layout-spike-mobile-bar button {
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    background: #fbfaf7;
    color: #1c1917;
    font-size: 12px;
    font-weight: 800;
  }

  .layout-spike-mobile-sheet {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 62px;
    z-index: 90;
    display: block;
    max-height: 42vh;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid #d8d3c8;
    border-radius: 12px;
    background: #fbfaf7;
    box-shadow: 0 16px 42px rgba(31, 27, 22, 0.22);
  }

  .layout-spike-mobile-sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .layout-spike-mobile-sheet-head button,
  .layout-spike-mobile-grid button,
  .layout-spike-mobile-list button,
  .layout-spike-mobile-actions button {
    border: 1px solid #d8d3c8;
    border-radius: 8px;
    background: #fff;
    color: #1c1917;
    font-size: 13px;
    font-weight: 800;
    padding: 10px;
  }

  .layout-spike-mobile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .layout-spike-mobile-list,
  .layout-spike-mobile-actions {
    display: grid;
    gap: 8px;
  }
}
</style>
