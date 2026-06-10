<template>
  <div class="fixed-template-editor" :class="{ 'fixed-template-editor--no-inspector': !showInspector, 'fixed-template-editor--preview': previewMode }" data-testid="fixed-template-editor">
    <aside class="fixed-template-left">
      <div class="fixed-template-tabs" role="tablist" aria-label="Editor modes">
        <button data-testid="template-tab-insert" :class="{ active: leftMode === 'insert' }" title="Insert blocks" @click="leftMode = 'insert'">
          Insert
        </button>
        <button data-testid="template-tab-layers" :class="{ active: leftMode === 'layers' }" title="Layers" @click="leftMode = 'layers'">
          Layers
        </button>
      </div>

      <section
        v-if="!showInspector && (selectedBlock || selectedRow)"
        class="fixed-template-left-selection"
        data-testid="template-left-selection"
      >
        <div class="fixed-template-left-selection-head">
          <strong>{{ inspectorTitle }}</strong>
          <span>{{ inspectorSubtitle }}</span>
        </div>

        <template v-if="selectedBlock">
          <div class="fixed-template-select-control fixed-template-select-control--compact">
            <label for="fixed-template-font-compact">Font</label>
            <select
              id="fixed-template-font-compact"
              data-testid="template-font-select"
              :value="selectedBlockFont"
              @change="setSelectedBlockFont(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="font in fontOptions" :key="font" :value="font">{{ font }}</option>
            </select>
          </div>
          <div class="fixed-template-style-row fixed-template-style-row--compact">
            <button :class="{ active: selectedBlock.bold }" @click="patchSelectedBlock({ bold: !selectedBlock.bold })">B</button>
            <button :class="{ active: selectedBlock.italic }" @click="patchSelectedBlock({ italic: !selectedBlock.italic })"><em>I</em></button>
            <button data-testid="template-text-size-decrease" title="Decrease text size" aria-label="Decrease text size" @click="nudgeSelectedScale(-0.06)">A-</button>
            <button data-testid="template-text-size-increase" title="Increase text size" aria-label="Increase text size" @click="nudgeSelectedScale(0.06)">A+</button>
          </div>
          <div class="fixed-template-align-row fixed-template-align-row--compact">
            <button
              :class="{ active: selectedBlock.align === 'left' || !selectedBlock.align }"
              title="Align left"
              aria-label="Align left"
              @click="patchSelectedBlock({ align: 'left' })"
            >
              <UIcon name="i-heroicons-bars-3-bottom-left" class="fixed-template-control-icon" />
            </button>
            <button
              :class="{ active: selectedBlock.align === 'center' }"
              title="Align center"
              aria-label="Align center"
              @click="patchSelectedBlock({ align: 'center' })"
            >
              <UIcon name="i-heroicons-bars-3" class="fixed-template-control-icon" />
            </button>
            <button
              :class="{ active: selectedBlock.align === 'right' }"
              title="Align right"
              aria-label="Align right"
              @click="patchSelectedBlock({ align: 'right' })"
            >
              <UIcon name="i-heroicons-bars-3-bottom-right" class="fixed-template-control-icon" />
            </button>
          </div>
          <div class="fixed-template-danger-row fixed-template-danger-row--compact">
            <button data-testid="template-duplicate-selected" title="Duplicate" aria-label="Duplicate" @click="duplicateSelected">
              <UIcon name="i-heroicons-document-duplicate" class="fixed-template-control-icon" />
            </button>
            <button class="danger" data-testid="template-delete-selected" title="Delete" aria-label="Delete" @click="deleteSelected">
              <UIcon name="i-heroicons-trash" class="fixed-template-trash-icon" />
            </button>
          </div>
        </template>

        <template v-else-if="selectedRow">
          <div class="fixed-template-control fixed-template-control--row-height">
            <label>{{ selectedRow.kind === 'spacer' ? 'Padding' : 'Size' }}</label>
            <input
              data-testid="template-row-height"
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              :value="selectedRow.heightFr"
              @input="setSelectedRowHeight(Number(($event.target as HTMLInputElement).value))"
            >
            <output>{{ rowSpacingLabel(selectedRow.heightFr) }}</output>
          </div>
          <div class="fixed-template-danger-row fixed-template-danger-row--compact">
            <button
              v-if="selectedRow.kind !== 'spacer'"
              data-testid="template-add-column-selected-row"
              title="Add column"
              @click="addColumnForSelection"
            >
              <span class="fixed-template-action-icon">+</span>
              <span>Col</span>
            </button>
            <button class="danger" data-testid="template-delete-row" title="Delete row" aria-label="Delete row" @click="deleteSelectedRow">
              <span class="fixed-template-action-icon" aria-hidden="true">
                <UIcon name="i-heroicons-trash" class="fixed-template-trash-icon" />
              </span>
            </button>
          </div>
        </template>
      </section>

      <section v-if="leftMode === 'insert'" class="fixed-template-panel">
        <p class="fixed-template-label">Add</p>
        <div class="fixed-template-insert-grid">
          <button data-testid="template-add-text-header" title="Add header text" @click="addText('header')">
            <span>T</span>
            <strong>Header</strong>
            <small>Text</small>
          </button>
          <button data-testid="template-add-text-footer" title="Add footer text" @click="addText('footer')">
            <span>T</span>
            <strong>Footer</strong>
            <small>Text</small>
          </button>
          <button data-testid="template-add-spacer-header" title="Add header spacer" @click="addSpacer('header')">
            <span>-</span>
            <strong>Header</strong>
            <small>Gap</small>
          </button>
          <button data-testid="template-add-spacer-footer" title="Add footer spacer" @click="addSpacer('footer')">
            <span>-</span>
            <strong>Footer</strong>
            <small>Gap</small>
          </button>
        </div>

        <p class="fixed-template-label">Grid</p>
        <div class="fixed-template-actions">
          <button data-testid="template-add-header-row" title="Add header row" @click="addRow('header')">
            <span class="fixed-template-action-icon">+</span>
            <span>Header row</span>
          </button>
          <button data-testid="template-add-footer-row" title="Add footer row" @click="addRow('footer')">
            <span class="fixed-template-action-icon">+</span>
            <span>Footer row</span>
          </button>
          <button :disabled="!selectedRow" data-testid="template-add-column" title="Add column" @click="addColumnForSelection">
            <span class="fixed-template-action-icon">+</span>
            <span>Col</span>
          </button>
        </div>
      </section>

      <section v-else class="fixed-template-panel">
        <p class="fixed-template-label">Theme layout</p>
        <div class="fixed-template-layer-list" data-testid="template-layer-list">
          <div
            v-for="band in editableBands"
            :key="band.id"
            class="fixed-template-layer-group"
            :data-band-id="band.id"
            data-testid="template-layer-group"
          >
            <button
              class="fixed-template-layer-band"
              :class="{ active: selectedBandId === band.id && !selectedBlockId }"
              @click="selectBand(band.id)"
            >
              <span>{{ band.label }}</span>
              <small>{{ band.rows.length }} rows</small>
            </button>
            <button
              v-for="row in band.rows"
              :key="row.id"
              class="fixed-template-layer-row"
              :class="{ active: selectedRowId === row.id && selectedBandId === band.id && !selectedBlockId }"
              @click="selectRow(band.id, row.id)"
            >
              <span>{{ row.kind === 'spacer' ? 'Spacer row' : 'Row' }}</span>
              <small>{{ band.label }}</small>
            </button>
            <template v-for="row in band.rows" :key="`${row.id}-blocks`">
              <button
                v-for="block in blocksForRow(row)"
                :key="block.id"
                class="fixed-template-layer-block"
                :class="{ active: selectedBlockId === block.id }"
                @click="selectBlock(block.id)"
              >
                <span>{{ block.label ?? (blockText(block) || block.kind) }}</span>
                <small>{{ block.kind }}</small>
              </button>
            </template>
          </div>
        </div>
        <div v-if="removedChromeItems.length" class="fixed-template-restore-list" data-testid="template-restore-list">
          <p class="fixed-template-label">Removed</p>
          <button
            v-for="item in removedChromeItems"
            :key="item.id"
            class="fixed-template-restore-item"
            data-testid="template-restore-item"
            @click="restoreChromeItem(item)"
          >
            <UIcon name="i-heroicons-arrow-path" class="fixed-template-control-icon" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </section>
    </aside>

    <main class="fixed-template-main">
      <header class="fixed-template-topbar">
        <button class="fixed-template-done" data-testid="template-done" @click="emit('done')">Done</button>
        <div>
          <strong>Fixed Poster Template</strong>
          <span>Header and footer are editable. Map band is locked.</span>
        </div>
        <button
          class="fixed-template-preview"
          :class="{ active: previewMode }"
          data-testid="template-preview-toggle"
          :aria-pressed="previewMode"
          @click="previewMode = !previewMode"
        >{{ previewMode ? 'Edit' : 'Preview' }}</button>
      </header>

      <section class="fixed-template-stage">
        <div
          class="fixed-template-poster fixed-template-poster--render-truth"
          data-testid="fixed-template-poster"
          @pointerdown.capture="onPreviewChromeTrashInteraction"
          @click.capture="onPreviewChromeClick"
        >
          <MapPreview
            ref="previewRef"
            class="fixed-template-map-preview"
            :map="map"
            :style-config="previewStyleConfig"
            :editable="true"
            :chrome-editing="true"
            :chrome-preview="previewMode"
            :chrome-external-shell="true"
            @poster-layout-updated="onPreviewPosterLayoutUpdated"
            @poster-text-override="onPreviewPosterTextOverride"
            @poster-text-reset="onPreviewPosterTextReset"
            @chrome-selection-changed="onPreviewChromeSelectionChanged"
          />
        </div>
      </section>
    </main>

    <aside v-if="showInspector" class="fixed-template-right">
      <section class="fixed-template-inspector">
        <div class="fixed-template-inspector-head">
          <p>{{ inspectorTitle }}</p>
          <span>{{ inspectorSubtitle }}</span>
        </div>

        <template v-if="selectedBlock">
          <div class="fixed-template-divider" />
          <div class="fixed-template-select-control">
            <label for="fixed-template-font">Font</label>
            <select
              id="fixed-template-font"
              data-testid="template-font-select"
              :value="selectedBlockFont"
              @change="setSelectedBlockFont(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="font in fontOptions" :key="font" :value="font">{{ font }}</option>
            </select>
          </div>
          <div class="fixed-template-range-control">
            <label for="fixed-template-size">Size</label>
            <input
              id="fixed-template-size"
              data-testid="template-text-size"
              type="range"
              min="45"
              max="220"
              step="5"
              :value="selectedBlockScalePercent"
              @input="setSelectedBlockScalePercent(Number(($event.target as HTMLInputElement).value))"
            >
            <output>{{ selectedBlockScalePercent }}%</output>
          </div>
          <div class="fixed-template-style-row">
            <button :class="{ active: selectedBlock.bold }" @click="patchSelectedBlock({ bold: !selectedBlock.bold })">B</button>
            <button :class="{ active: selectedBlock.italic }" @click="patchSelectedBlock({ italic: !selectedBlock.italic })"><em>I</em></button>
            <button @click="nudgeSelectedScale(-0.06)">A-</button>
            <button @click="nudgeSelectedScale(0.06)">A+</button>
          </div>
          <div class="fixed-template-align-row">
            <button
              :class="{ active: selectedBlock.align === 'left' || !selectedBlock.align }"
              title="Align left"
              aria-label="Align left"
              @click="patchSelectedBlock({ align: 'left' })"
            >
              <UIcon name="i-heroicons-bars-3-bottom-left" class="fixed-template-control-icon" />
            </button>
            <button
              :class="{ active: selectedBlock.align === 'center' }"
              title="Align center"
              aria-label="Align center"
              @click="patchSelectedBlock({ align: 'center' })"
            >
              <UIcon name="i-heroicons-bars-3" class="fixed-template-control-icon" />
            </button>
            <button
              :class="{ active: selectedBlock.align === 'right' }"
              title="Align right"
              aria-label="Align right"
              @click="patchSelectedBlock({ align: 'right' })"
            >
              <UIcon name="i-heroicons-bars-3-bottom-right" class="fixed-template-control-icon" />
            </button>
          </div>
          <div class="fixed-template-danger-row">
            <button data-testid="template-duplicate-selected" title="Duplicate" aria-label="Duplicate" @click="duplicateSelected">
              <UIcon name="i-heroicons-document-duplicate" class="fixed-template-control-icon" />
            </button>
            <button class="danger" data-testid="template-delete-selected" title="Delete" aria-label="Delete" @click="deleteSelected">
              <UIcon name="i-heroicons-trash" class="fixed-template-trash-icon" />
            </button>
          </div>
        </template>

        <template v-else-if="selectedRow">
          <div class="fixed-template-divider" />
          <div class="fixed-template-control fixed-template-control--row-height">
            <label>{{ selectedRow.kind === 'spacer' ? 'Padding' : 'Size' }}</label>
            <input
              data-testid="template-row-height"
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              :value="selectedRow.heightFr"
              @input="setSelectedRowHeight(Number(($event.target as HTMLInputElement).value))"
            >
            <output>{{ rowSpacingLabel(selectedRow.heightFr) }}</output>
          </div>
          <button
            v-if="selectedRow.kind !== 'spacer'"
            class="fixed-template-wide-action"
            data-testid="template-add-column-selected-row"
            @click="addColumnForSelection"
          >
            Add column to row
          </button>
          <button class="fixed-template-wide-action" @click="addRowAfter(selectedBandId, selectedRow.id)">Add row below</button>
          <button class="fixed-template-wide-action danger" data-testid="template-delete-row" @click="deleteSelectedRow">Delete row</button>
        </template>
      </section>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ChromeBandId,
  ChromeGridCell,
  ChromeGridRow,
  FontFamily,
  PartialPosterLayout,
  PosterTextOverride,
  PosterTextSlot,
  StyleConfig,
  TrailMap,
} from '~/types'
import MapPreview from '~/components/map/MapPreview.vue'
import { FONT_REGISTRY } from '~/utils/render/fontRegistry'
import { buildThemeDataContext } from '~/utils/themeDataContract'
import { formatDistanceMiles, formatElevationGainFeet, formatPosterLocationLine } from '~/utils/posterFormatters'
import {
  appendDraftBlock,
  appendDraftRow,
  clonePosterLayoutDraft,
  createDraftBlock,
  createDraftCell,
  createDraftRow,
  deleteDraftBlock,
  draftToPosterLayout,
  duplicateDraftBlock,
  findDraftBlock,
  posterLayoutToDraft,
  type PosterLayoutDraft,
  type PosterLayoutDraftBandId,
  type PosterLayoutDraftBlock,
  type PosterLayoutDraftRow,
} from '~/utils/posterLayoutDraft'

const props = withDefaults(defineProps<{
  modelValue: StyleConfig
  map: TrailMap
  showInspector?: boolean
}>(), {
  showInspector: true,
})

const showInspector = computed(() => props.showInspector !== false)

type MapPreviewHandle = {
  freezeView: () => void
  unfreezeView: () => void
  resetViewToRoute: () => void
  getVisibleBounds: () => [number, number, number, number] | null
  fitToRouteAndSegments: (segmentBboxes?: Array<[number, number, number, number]>) => void
  finishSegmentDraw: () => void
  undoSegmentDrawPoint: () => boolean
}

const previewRef = ref<MapPreviewHandle | null>(null)

defineExpose({
  freezeView: () => previewRef.value?.freezeView(),
  unfreezeView: () => previewRef.value?.unfreezeView(),
  resetViewToRoute: () => previewRef.value?.resetViewToRoute(),
  getVisibleBounds: () => previewRef.value?.getVisibleBounds() ?? null,
  fitToRouteAndSegments: (segmentBboxes?: Array<[number, number, number, number]>) => previewRef.value?.fitToRouteAndSegments(segmentBboxes),
  finishSegmentDraw: () => previewRef.value?.finishSegmentDraw(),
  undoSegmentDrawPoint: () => previewRef.value?.undoSegmentDrawPoint() ?? false,
})

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
  'done': []
}>()

const draft = ref<PosterLayoutDraft>(posterLayoutToDraft(props.modelValue, props.map.stats, props.map))
const leftMode = ref<'insert' | 'layers'>('insert')
const previewMode = ref(false)
const selectedBandId = ref<PosterLayoutDraftBandId>('header')
const selectedRowId = ref<string | null>(draft.value.bands.header.rows.find(row => row.kind === 'content')?.id ?? null)
const selectedCellId = ref<string | null>(null)
const selectedBlockId = ref<string | null>(null)

watch(() => [
  props.modelValue.color_theme,
  props.modelValue.composition,
  props.modelValue.poster_layout,
  props.modelValue.poster_text_overrides,
], () => {
  draft.value = posterLayoutToDraft(props.modelValue, props.map.stats, props.map)
}, { deep: true })

if (import.meta.dev && typeof window !== 'undefined') {
  Object.assign(window, {
    __RADMAPS_FIXED_TEMPLATE_EDITOR__: {
      getDraft: () => draft.value,
      getStyle: () => props.modelValue,
      getPreviewStyle: () => previewStyleConfig.value,
      getSelection: () => ({
        band: selectedBandId.value,
        row: selectedRowId.value,
        cell: selectedCellId.value,
        block: selectedBlockId.value,
      }),
    },
  })
}

const editableBands = computed(() => [
  { id: 'header' as const, label: 'Header', rows: draft.value.bands.header.rows },
  { id: 'footer' as const, label: 'Footer', rows: draft.value.bands.footer.rows },
])

const selectedRow = computed(() => {
  const rows = draft.value.bands[selectedBandId.value].rows
  return selectedRowId.value ? rows.find(row => row.id === selectedRowId.value) ?? null : null
})
const selectedCell = computed(() => {
  const row = selectedRow.value
  return selectedCellId.value ? row?.cells.find(cell => cell.id === selectedCellId.value) ?? null : null
})
const selectedBlockTargetId = computed(() => {
  if (selectedBlockId.value) return selectedBlockId.value
  const block = selectedCell.value?.blocks.find(candidate => candidate.kind !== 'spacer')
  return block?.id ?? null
})
const selectedBlock = computed(() => {
  const targetId = selectedBlockTargetId.value
  return targetId ? findDraftBlock(draft.value, targetId)?.block ?? null : null
})
const fontOptions = Object.keys(FONT_REGISTRY) as FontFamily[]
const selectedBlockFont = computed(() => {
  const block = selectedBlock.value
  if (!block) return props.modelValue.body_font_family
  return block.font_family ?? (block.chromeKind === 'title' ? props.modelValue.font_family : props.modelValue.body_font_family)
})
const selectedBlockScalePercent = computed(() => Math.round((selectedBlock.value?.scale ?? 1) * 100))
const inspectorTitle = computed(() => {
  if (selectedBlock.value) return selectedBlock.value.label
  if (selectedRow.value?.kind === 'spacer') return 'Gap'
  if (selectedRow.value) return 'Row'
  return `${selectedBandId.value === 'header' ? 'Header' : 'Footer'} section`
})
const inspectorSubtitle = computed(() => {
  if (selectedBlock.value) return `${selectedBlock.value.kind} block`
  if (selectedRow.value?.kind === 'spacer') return 'Space'
  if (selectedRow.value) return `${selectedRow.value.cells.length} ${selectedRow.value.cells.length === 1 ? 'col' : 'cols'}`
  return 'Fixed poster template'
})

const previewLayout = computed(() => draftToPosterLayout(draft.value))
const previewStyleConfig = computed<StyleConfig>(() => ({
  ...props.modelValue,
  map_frozen: true,
  poster_layout: mergeLayoutIntoCurrent(previewLayout.value),
}))

type RemovedChromeItem = {
  id: string
  label: string
  band: PosterLayoutDraftBandId
  rowId: string
  cellId?: string
}

const removedChromeItems = computed<RemovedChromeItem[]>(() => {
  const items: RemovedChromeItem[] = []
  for (const band of ['header', 'footer'] as const) {
    for (const row of props.modelValue.poster_layout?.bands?.[band]?.rows ?? []) {
      if (row.deleted) {
        items.push({
          id: `${band}:${row.id}`,
          label: chromeRowRestoreLabel(band, row.id),
          band,
          rowId: row.id,
        })
        continue
      }
      for (const cell of row.cells ?? []) {
        if (!cell.deleted) continue
        items.push({
          id: `${band}:${row.id}:${cell.id}`,
          label: chromeCellRestoreLabel(cell.id),
          band,
          rowId: row.id,
          cellId: cell.id,
        })
      }
    }
  }
  return items
})

function emitLayout(extraBands: PartialPosterLayout['bands'] = {}) {
  const layout = draftToPosterLayout(draft.value)
  emit('update:modelValue', {
    ...props.modelValue,
    poster_layout: mergeLayoutIntoCurrent(layout, extraBands),
  })
}

function mergeLayoutIntoCurrent(layout: PartialPosterLayout, extraBands: PartialPosterLayout['bands'] = {}): PartialPosterLayout {
  const currentBands = props.modelValue.poster_layout?.bands ?? {}
  const currentVisibleLayout = draftToPosterLayout(posterLayoutToDraft(props.modelValue, props.map.stats, props.map))
  const bands: PartialPosterLayout['bands'] = {
    ...currentBands,
    header: {
      ...(currentBands.header ?? {}),
      ...(layout.bands?.header ?? {}),
      ...(extraBands.header ?? {}),
      rows: mergeRowsWithTombstones(
        layout.bands?.header?.rows,
        currentVisibleLayout.bands?.header?.rows,
        currentBands.header?.rows,
        extraBands.header?.rows,
      ),
    },
    footer: {
      ...(currentBands.footer ?? {}),
      ...(layout.bands?.footer ?? {}),
      ...(extraBands.footer ?? {}),
      rows: mergeRowsWithTombstones(
        layout.bands?.footer?.rows,
        currentVisibleLayout.bands?.footer?.rows,
        currentBands.footer?.rows,
        extraBands.footer?.rows,
      ),
    },
    ...(extraBands.railLeft ? { railLeft: extraBands.railLeft } : {}),
    ...(extraBands.railRight ? { railRight: extraBands.railRight } : {}),
  }
  return { bands }
}

function cloneChromeDraftCell(cell: ChromeGridCell): ChromeGridCell {
  return {
    ...cell,
    block: cell.block ? { ...cell.block } : undefined,
  }
}

function cloneChromeDraftRow(row: ChromeGridRow): ChromeGridRow {
  return {
    ...row,
    cells: row.cells.map(cloneChromeDraftCell),
  }
}

function tombstoneChromeDraftCell(cell: ChromeGridCell): ChromeGridCell {
  return {
    ...cloneChromeDraftCell(cell),
    deleted: true,
    block: undefined,
  }
}

function tombstoneChromeDraftRow(row: ChromeGridRow): ChromeGridRow {
  return {
    ...cloneChromeDraftRow(row),
    deleted: true,
    cells: row.cells.map(tombstoneChromeDraftCell),
  }
}

function mergeRowsWithTombstones(
  layoutRows: ChromeGridRow[] | undefined,
  currentVisibleRows: ChromeGridRow[] | undefined,
  currentSparseRows: ChromeGridRow[] | undefined,
  extraRows?: ChromeGridRow[],
): ChromeGridRow[] {
  const rows = (extraRows ?? layoutRows ?? []).map(cloneChromeDraftRow)
  const rowIds = new Set(rows.map(row => row.id))
  const rowsById = new Map(rows.map(row => [row.id, row]))

  for (const row of currentSparseRows ?? []) {
    const targetRow = rowsById.get(row.id)
    if (!targetRow) {
      if (!row.deleted) continue
      const clone = cloneChromeDraftRow(row)
      rows.push(clone)
      rowsById.set(clone.id, clone)
      rowIds.add(clone.id)
      continue
    }

    const targetCellIds = new Set(targetRow.cells.map(cell => cell.id))
    for (const cell of row.cells) {
      if (!cell.deleted || targetCellIds.has(cell.id)) continue
      targetRow.cells.push(cloneChromeDraftCell(cell))
      targetCellIds.add(cell.id)
    }
  }

  for (const row of currentVisibleRows ?? []) {
    const targetRow = rowsById.get(row.id)
    if (!targetRow) {
      const tombstone = tombstoneChromeDraftRow(row)
      rows.push(tombstone)
      rowsById.set(tombstone.id, tombstone)
      rowIds.add(tombstone.id)
      continue
    }

    const targetCellIds = new Set(targetRow.cells.map(cell => cell.id))
    for (const cell of row.cells) {
      if (targetCellIds.has(cell.id)) continue
      targetRow.cells.push(tombstoneChromeDraftCell(cell))
      targetCellIds.add(cell.id)
    }
  }

  return rows
}

function setDraft(next: PosterLayoutDraft) {
  draft.value = next
  emitLayout()
}

function blockText(block: PosterLayoutDraftBlock) {
  if (block.kind === 'spacer') return ''
  if (block.text != null) return block.text
  if (block.slot) return slotText(block.slot)
  return block.label ?? ''
}

function slotText(slot: PosterTextSlot) {
  const stats = props.map.stats
  const overrides = props.modelValue.poster_text_overrides ?? {}
  if (overrides[slot]?.text != null) return overrides[slot]?.text ?? ''
  if (slot === 'trail_name') return props.modelValue.trail_name
  if (slot === 'location_text') return props.modelValue.location_text
  if (slot === 'occasion_text') return props.modelValue.occasion_text
  const dataContext = buildThemeDataContext({ ...props.map, styleConfig: props.modelValue })
  if (slot === 'distance') return dataContext.hasDistance ? `${formatDistanceMiles(stats ?? {})} miles` : ''
  if (slot === 'elevation_gain') return dataContext.hasElevation ? `${formatElevationGainFeet(stats ?? {})} ft gain` : ''
  if (slot === 'date') return stats?.date ?? ''
  if (slot === 'coordinates') return formatPosterLocationLine(dataContext)
  if (slot === 'composition_kicker') return 'NO. 01 - A FIELD RECORD'
  if (slot === 'composition_meta') return stats?.date ? `${props.modelValue.location_text} - ${stats.date}` : props.modelValue.location_text
  if (slot === 'composition_footer') return 'Drawn from route telemetry and terrain data'
  if (slot === 'composition_side_rail') return 'RADMAPS'
  return ''
}

function selectBand(band: PosterLayoutDraftBandId) {
  selectedBandId.value = band
  selectedRowId.value = draft.value.bands[band].rows.find(row => row.kind === 'content')?.id ?? draft.value.bands[band].rows[0]?.id ?? null
  selectedCellId.value = null
  selectedBlockId.value = null
}

function selectRow(band: PosterLayoutDraftBandId, rowId: string) {
  selectedBandId.value = band
  selectedRowId.value = rowId
  selectedCellId.value = null
  selectedBlockId.value = null
}

function selectBlock(blockId: string) {
  const found = findDraftBlock(draft.value, blockId)
  if (!found) return
  selectedBandId.value = found.location.bandId
  selectedRowId.value = draft.value.bands[found.location.bandId].rows[found.location.rowIndex]?.id ?? null
  selectedCellId.value = draft.value.bands[found.location.bandId].rows[found.location.rowIndex]?.cells[found.location.cellIndex]?.id ?? null
  if (found.block.kind === 'spacer') {
    selectedCellId.value = null
    selectedBlockId.value = null
    return
  }
  selectedBlockId.value = blockId
}

function onPreviewPosterLayoutUpdated(value: PartialPosterLayout | undefined) {
  const nextStyle = {
    ...props.modelValue,
    poster_layout: value,
  }
  draft.value = posterLayoutToDraft(nextStyle, props.map.stats, props.map)
  emit('update:modelValue', nextStyle)
}

function onPreviewPosterTextOverride(payload: { slot: PosterTextSlot; patch: PosterTextOverride }) {
  emit('update:modelValue', {
    ...props.modelValue,
    poster_text_overrides: {
      ...(props.modelValue.poster_text_overrides ?? {}),
      [payload.slot]: {
        ...(props.modelValue.poster_text_overrides?.[payload.slot] ?? {}),
        ...payload.patch,
      },
    },
  })
}

function onPreviewPosterTextReset(slot: PosterTextSlot) {
  const nextOverrides = { ...(props.modelValue.poster_text_overrides ?? {}) }
  delete nextOverrides[slot]
  emit('update:modelValue', {
    ...props.modelValue,
    poster_text_overrides: Object.keys(nextOverrides).length ? nextOverrides : undefined,
  })
}

function onPreviewChromeClick(event: MouseEvent) {
  onPreviewChromeTrashInteraction(event)
}

function onPreviewChromeTrashInteraction(event: MouseEvent | PointerEvent) {
  const target = event.target instanceof HTMLElement ? event.target : null
  const trashButton = target?.closest<HTMLElement>('[data-testid="chrome-cell-trash"]')
  if (!trashButton) return

  const rowEl = trashButton.closest<HTMLElement>('.chrome-grid-row')
  const cellEl = trashButton.closest<HTMLElement>('.chrome-grid-cell')
  const bandEl = trashButton.closest<HTMLElement>('[data-testid="chrome-band-header"], [data-testid="chrome-band-footer"]')
  const band = bandEl?.dataset.testid === 'chrome-band-header'
    ? 'header'
    : bandEl?.dataset.testid === 'chrome-band-footer'
      ? 'footer'
      : null
  const rowId = rowEl?.dataset.chromeRowId
  const cellId = cellEl?.dataset.chromeCellId
  if (!band || !rowId || !cellId) return

  const next = clonePosterLayoutDraft(draft.value)
  const rows = next.bands[band].rows
  const rowIndex = rows.findIndex(row => row.id === rowId)
  const row = rows[rowIndex]
  const cellIndex = row?.cells.findIndex(cell => cell.id === cellId) ?? -1
  if (!row || cellIndex < 0) return

  event.preventDefault()
  event.stopPropagation()

  const removedColumnOnly = row.cells.length > 1
  if (removedColumnOnly) {
    row.cells.splice(cellIndex, 1)
  } else if (rows.length > 1) {
    rows.splice(rowIndex, 1)
  } else {
    row.cells.splice(cellIndex, 1)
    if (!row.cells.length) row.cells.push(createDraftCell())
  }

  setDraft(next)
  selectedBandId.value = band
  if (removedColumnOnly) {
    const selectedCell = row.cells[Math.min(cellIndex, row.cells.length - 1)] ?? null
    selectedRowId.value = row.id
    selectedCellId.value = selectedCell?.id ?? null
    selectedBlockId.value = selectedCell?.blocks.find(block => block.kind !== 'spacer')?.id ?? null
  } else {
    selectedRowId.value = rows[Math.min(rowIndex, rows.length - 1)]?.id ?? null
    selectedCellId.value = null
    selectedBlockId.value = null
  }
}

function onPreviewChromeSelectionChanged(payload: { type: 'band'; band: ChromeBandId } | { type: 'row'; band: ChromeBandId; rowId: string } | { type: 'cell'; band: ChromeBandId; rowId: string; cellId: string; blockId: string | null } | null) {
  if (!payload || (payload.band !== 'header' && payload.band !== 'footer')) return
  selectedBandId.value = payload.band
  if (payload.type === 'band') {
    selectedRowId.value = null
    selectedCellId.value = null
    selectedBlockId.value = null
    return
  }
  selectedRowId.value = payload.rowId
  if (payload.type === 'row') {
    selectedCellId.value = null
    selectedBlockId.value = null
    return
  }
  selectedCellId.value = payload.cellId
  const selectedDraftBlock = payload.blockId ? findDraftBlock(draft.value, payload.blockId)?.block : null
  if (selectedDraftBlock && selectedDraftBlock.kind !== 'spacer') {
    selectedBlockId.value = payload.blockId
    return
  }
  const row = draft.value.bands[payload.band].rows.find(candidate => candidate.id === payload.rowId)
  const block = row?.cells.find(cell => cell.id === payload.cellId)?.blocks.find(candidate => candidate.kind !== 'spacer')
  selectedBlockId.value = block?.id ?? null
}

function addText(band: PosterLayoutDraftBandId) {
  const result = appendDraftBlock(draft.value, band, 'text', selectedBandId.value === band ? selectedRowId.value ?? undefined : undefined, selectedBandId.value === band ? selectedCellId.value ?? undefined : undefined)
  setDraft(result.draft)
  selectBlock(result.blockId)
}

function addSpacer(band: PosterLayoutDraftBandId) {
  const result = appendDraftBlock(draft.value, band, 'spacer')
  setDraft(result.draft)
  selectBlock(result.blockId)
}

function addRow(band: PosterLayoutDraftBandId) {
  const block = createDraftBlock('text', { text: 'Write here...', source: 'user' })
  const row = createDraftRow('content', [block])
  setDraft(appendDraftRow(draft.value, band, row))
  selectedBandId.value = band
  selectedRowId.value = row.id
  selectedCellId.value = row.cells[0]?.id ?? null
  selectedBlockId.value = block.id
}

function addRowAfter(band: PosterLayoutDraftBandId, rowId: string) {
  const next = clonePosterLayoutDraft(draft.value)
  const rows = next.bands[band].rows
  const index = rows.findIndex(row => row.id === rowId)
  const block = createDraftBlock('text', { text: 'Write here...', source: 'user' })
  const row = createDraftRow('content', [block])
  rows.splice(index >= 0 ? index + 1 : rows.length, 0, row)
  setDraft(next)
  selectedBandId.value = band
  selectedRowId.value = row.id
  selectedCellId.value = row.cells[0]?.id ?? null
  selectedBlockId.value = block.id
}

function addColumnForSelection() {
  if (!selectedRowId.value) return
  addColumnAfter(selectedBandId.value, selectedRowId.value, selectedCellId.value ?? undefined)
}

function setSelectedRowHeight(value: number) {
  if (!selectedRowId.value) return
  const next = clonePosterLayoutDraft(draft.value)
  const row = next.bands[selectedBandId.value].rows.find(candidate => candidate.id === selectedRowId.value)
  if (!row) return
  row.heightFr = Math.max(0.2, Math.min(4, Math.round(value * 20) / 20))
  setDraft(next)
}

function deleteSelectedRow() {
  if (!selectedRowId.value) return
  const next = clonePosterLayoutDraft(draft.value)
  const rows = next.bands[selectedBandId.value].rows
  const index = rows.findIndex(row => row.id === selectedRowId.value)
  if (index < 0) return
  rows.splice(index, 1)
  setDraft(next)
  selectedRowId.value = rows[Math.min(index, rows.length - 1)]?.id ?? null
  selectedCellId.value = null
  selectedBlockId.value = null
}

function addColumnAfter(band: PosterLayoutDraftBandId, rowId: string, afterCellId?: string) {
  const next = clonePosterLayoutDraft(draft.value)
  const row = next.bands[band].rows.find(row => row.id === rowId)
  if (!row) return
  const block = createDraftBlock('text', { text: 'Write here...', source: 'user' })
  const cell = createDraftCell(block, { widthFr: 1 })
  const index = afterCellId ? row.cells.findIndex(cell => cell.id === afterCellId) : row.cells.length - 1
  row.kind = 'content'
  row.cells.splice(index >= 0 ? index + 1 : row.cells.length, 0, cell)
  setDraft(next)
  selectedBandId.value = band
  selectedRowId.value = row.id
  selectedCellId.value = cell.id
  selectedBlockId.value = block.id
}

function duplicateSelected() {
  const blockId = selectedBlockTargetId.value
  if (!blockId) return
  const result = duplicateDraftBlock(draft.value, blockId)
  setDraft(result.draft)
  if (result.blockId) selectBlock(result.blockId)
}

function deleteSelected() {
  const blockId = selectedBlockTargetId.value
  if (!blockId) return
  const next = deleteDraftBlock(draft.value, blockId)
  const lastBand = selectedBandId.value
  setDraft(next)
  selectedBlockId.value = null
  selectedCellId.value = null
  selectedRowId.value = next.bands[lastBand].rows[0]?.id ?? null
}

function patchSelectedBlock(patch: Partial<PosterLayoutDraftBlock>) {
  const blockId = selectedBlockTargetId.value
  if (!blockId) return
  const next = clonePosterLayoutDraft(draft.value)
  const found = findDraftBlock(next, blockId)
  if (!found) return
  Object.assign(found.block, patch)
  setDraft(next)
}

function nudgeSelectedScale(delta: number) {
  if (!selectedBlock.value) return
  patchSelectedBlock({ scale: Math.min(2.2, Math.max(0.45, (selectedBlock.value.scale ?? 1) + delta)) })
}

function setSelectedBlockScalePercent(value: number) {
  patchSelectedBlock({ scale: Math.min(2.2, Math.max(0.45, value / 100)) })
}

function setSelectedBlockFont(value: string) {
  if (!fontOptions.includes(value as FontFamily)) return
  patchSelectedBlock({ font_family: value as FontFamily })
}

function restoreChromeItem(item: RemovedChromeItem) {
  const nextLayout = restoreSparseChromeTombstone(props.modelValue.poster_layout, item)
  const nextStyle = {
    ...props.modelValue,
    poster_layout: nextLayout,
  }
  draft.value = posterLayoutToDraft(nextStyle, props.map.stats, props.map)
  emit('update:modelValue', nextStyle)
  selectedBandId.value = item.band
  selectedRowId.value = item.rowId
  selectedCellId.value = item.cellId ?? null
  selectedBlockId.value = null
  leftMode.value = 'layers'
}

function restoreSparseChromeTombstone(layout: PartialPosterLayout | undefined, item: RemovedChromeItem): PartialPosterLayout | undefined {
  if (!layout?.bands?.[item.band]?.rows) return layout
  const next = cloneSparsePosterLayout(layout)
  const row = next.bands?.[item.band]?.rows?.find(candidate => candidate.id === item.rowId)
  if (!row) return next

  if (item.cellId) {
    row.deleted = false
    const cell = row.cells?.find(candidate => candidate.id === item.cellId)
    if (cell) cell.deleted = false
    return next
  }

  row.deleted = false
  row.cells = row.cells?.map(cell => ({ ...cell, deleted: false })) ?? []
  return next
}

function cloneSparsePosterLayout(layout: PartialPosterLayout): PartialPosterLayout {
  const bands: PartialPosterLayout['bands'] = {}
  for (const band of Object.keys(layout.bands ?? {}) as ChromeBandId[]) {
    const source = layout.bands?.[band]
    if (!source) continue
    bands[band] = {
      ...source,
      padding: source.padding ? [...source.padding] as [number, number, number, number] : undefined,
      rows: source.rows?.map(cloneChromeDraftRow),
    }
  }
  return {
    ...layout,
    bands,
    anchors: layout.anchors?.map(anchor => ({ ...anchor })),
  }
}

function chromeRowRestoreLabel(band: PosterLayoutDraftBandId, rowId: string) {
  if (rowId === 'footer-primary') return 'Footer metrics'
  if (rowId === 'header-title') return 'Title row'
  if (rowId === 'header-subtitle') return 'Subtitle row'
  if (rowId.includes('spacer-top')) return `${band === 'header' ? 'Header' : 'Footer'} top spacer`
  if (rowId.includes('spacer-bottom')) return `${band === 'header' ? 'Header' : 'Footer'} bottom spacer`
  return `${band === 'header' ? 'Header' : 'Footer'} row`
}

function chromeCellRestoreLabel(cellId: string) {
  const labels: Record<string, string> = {
    'hdr-kicker': 'Eyebrow',
    'hdr-meta': 'Header meta',
    'hdr-title': 'Title',
    'hdr-location': 'Location',
    'hdr-occasion': 'Description',
    'ft-distance': 'Distance',
    'ft-gain': 'Elevation gain',
    'ft-date': 'Date',
    'ft-coords': 'Coordinates',
    'ft-brand': 'Branding',
    'ft-note': 'Footer note',
  }
  return labels[cellId] ?? 'Removed cell'
}

function rowSpacingLabel(value: number) {
  return `${Math.round(value * 100)}%`
}

function blocksForRow(row: PosterLayoutDraftRow) {
  return row.cells.flatMap(cell => cell.blocks)
}
</script>

<style>
.fixed-template-editor {
  display: grid;
  grid-template-columns: 168px minmax(460px, 1fr) 280px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ebe9e4;
  color: #22201d;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.fixed-template-editor--no-inspector {
  grid-template-columns: 168px minmax(460px, 1fr);
}

.fixed-template-left,
.fixed-template-right {
  min-height: 0;
  overflow: auto;
  border-color: rgba(36, 32, 27, 0.12);
  background: #fbfaf7;
}

.fixed-template-left {
  border-right: 1px solid rgba(36, 32, 27, 0.12);
}

.fixed-template-right {
  border-left: 1px solid rgba(36, 32, 27, 0.12);
}

.fixed-template-inspector-head {
  padding: 16px 16px 12px;
}

.fixed-template-inspector-head p {
  display: block;
  margin: 0;
  font-size: 19px;
  font-weight: 850;
  letter-spacing: 0;
}

.fixed-template-inspector-head span,
.fixed-template-topbar span {
  color: #82796f;
  font-size: 12px;
  font-weight: 650;
}

.fixed-template-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin: 8px 8px 10px;
  padding: 3px;
  border-radius: 8px;
  background: #eeeae2;
}

.fixed-template-tabs button,
.fixed-template-style-row button,
.fixed-template-align-row button,
.fixed-template-danger-row button,
.fixed-template-actions button,
.fixed-template-wide-action,
.fixed-template-done,
.fixed-template-preview {
  min-height: 30px;
  border: 1px solid rgba(42, 37, 31, 0.12);
  border-radius: 7px;
  background: #fffdf8;
  color: #29241f;
  font-size: 11px;
  font-weight: 750;
}

.fixed-template-tabs button,
.fixed-template-actions button,
.fixed-template-danger-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.fixed-template-actions button,
.fixed-template-danger-row button {
  gap: 5px;
}

.fixed-template-done,
.fixed-template-preview {
  min-height: 34px;
  font-size: 13px;
}

.fixed-template-action-icon {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: rgba(42, 37, 31, 0.08);
  color: #24313a;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.fixed-template-tabs button.active,
.fixed-template-style-row button.active,
.fixed-template-align-row button.active,
.fixed-template-preview.active {
  border-color: rgba(32, 101, 72, 0.5);
  background: #e3efe8;
  color: #163f2e;
}

.fixed-template-left-selection {
  display: grid;
  gap: 6px;
  margin: 0 8px 10px;
  padding: 7px;
  border: 1px solid rgba(32, 101, 72, 0.22);
  border-radius: 8px;
  background: #f2f7f2;
}

.fixed-template-left-selection-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.fixed-template-left-selection-head strong {
  min-width: 0;
  overflow: hidden;
  color: #1d211f;
  font-size: 11px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fixed-template-left-selection-head span {
  flex: none;
  color: #6f766f;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.fixed-template-style-row--compact,
.fixed-template-align-row--compact {
  display: grid;
  gap: 5px;
}

.fixed-template-style-row--compact {
  grid-template-columns: repeat(4, 1fr);
}

.fixed-template-align-row--compact {
  grid-template-columns: repeat(3, 1fr);
}

.fixed-template-danger-row--compact {
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.fixed-template-danger-row--compact > button:only-child {
  grid-column: 1 / -1;
  justify-self: start;
  min-width: 76px;
}

.fixed-template-left-selection .fixed-template-control {
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 5px;
  padding: 0;
}

.fixed-template-left-selection .fixed-template-control label {
  font-size: 9px;
}

.fixed-template-left-selection .fixed-template-control output {
  font-size: 10px;
}

.fixed-template-select-control,
.fixed-template-range-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  padding: 0 20px 10px;
}

.fixed-template-select-control label,
.fixed-template-range-control label {
  color: #6f675f;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fixed-template-select-control select {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(42, 37, 31, 0.14);
  border-radius: 7px;
  background: #fffdf8;
  color: #29241f;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
}

.fixed-template-range-control input {
  width: 100%;
  accent-color: #28785a;
}

.fixed-template-range-control output {
  min-width: 34px;
  color: #403a34;
  font-size: 11px;
  font-weight: 850;
  text-align: right;
}

.fixed-template-select-control--compact {
  padding: 0;
}

.fixed-template-select-control--compact label {
  font-size: 10px;
}

.fixed-template-select-control--compact select {
  height: 28px;
  font-size: 10px;
}

.fixed-template-panel {
  padding: 0 8px 12px;
}

.fixed-template-label {
  margin: 10px 0 5px;
  color: #746d64;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.fixed-template-insert-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}

.fixed-template-insert-grid button {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  min-height: 32px;
  padding: 5px 7px;
  border: 1px solid rgba(42, 37, 31, 0.13);
  border-radius: 7px;
  background: #fffdf8;
  text-align: left;
}

.fixed-template-insert-grid span {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: #efede7;
  color: #394150;
  font-size: 13px;
  font-weight: 900;
}

.fixed-template-insert-grid strong {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fixed-template-insert-grid small {
  color: #857d73;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fixed-template-actions,
.fixed-template-danger-row {
  display: grid;
  gap: 5px;
}

.fixed-template-actions button {
  justify-content: flex-start;
  min-height: 28px;
  padding: 0 7px;
}

.fixed-template-layer-list {
  display: grid;
  gap: 6px;
}

.fixed-template-layer-group {
  display: grid;
  gap: 4px;
}

.fixed-template-layer-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 27px;
  padding: 5px 7px;
  border: 1px solid rgba(42, 37, 31, 0.1);
  border-radius: 7px;
  background: #fffdf8;
  text-align: left;
}

.fixed-template-layer-list button.active {
  border-color: #28785a;
  box-shadow: inset 0 0 0 1px #28785a;
}

.fixed-template-layer-row {
  margin-left: 5px;
}

.fixed-template-layer-block {
  margin-left: 12px;
  min-height: 26px !important;
  background: #f7f5ef !important;
}

.fixed-template-layer-list small {
  color: #8c8378;
  font-size: 9px;
  font-weight: 750;
  text-transform: uppercase;
}

.fixed-template-restore-list {
  display: grid;
  gap: 5px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(42, 37, 31, 0.1);
}

.fixed-template-restore-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-height: 28px;
  padding: 5px 7px;
  border: 1px solid rgba(40, 120, 90, 0.24);
  border-radius: 7px;
  background: #f5fbf6;
  color: #225f49;
  text-align: left;
}

.fixed-template-main {
  display: grid;
  grid-template-rows: 54px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}

.fixed-template-topbar {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) 86px;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(36, 32, 27, 0.12);
  background: #34312c;
  color: #fffaf0;
}

.fixed-template-topbar div {
  text-align: center;
}

.fixed-template-topbar strong {
  display: block;
  font-size: 15px;
  font-weight: 850;
  white-space: nowrap;
}

.fixed-template-topbar span {
  display: none;
}

.fixed-template-stage {
  display: grid;
  place-items: center;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}

.fixed-template-poster {
  --template-bg: #f8f1e7;
  --template-fg: #1f1a16;
  --template-route: #b5251d;
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(520px, 100%, calc((100vh - 120px) * 2 / 3));
  height: auto;
  max-height: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: 1px solid rgba(31, 26, 22, 0.16);
  background: var(--template-bg);
  color: var(--template-fg);
  box-shadow: 0 24px 80px rgba(37, 32, 26, 0.18);
  container-type: size;
  font-family: Georgia, "Times New Roman", serif;
}

.fixed-template-poster--render-truth {
  display: block;
  overflow: visible;
  border: 0;
  background: transparent;
  box-shadow: none;
  container-type: normal;
  font-family: inherit;
}

.fixed-template-map-preview {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  overflow: visible !important;
}

.fixed-template-map-preview .poster-canvas {
  width: 100%;
  height: 100%;
  overflow: visible;
  box-shadow: 0 24px 80px rgba(37, 32, 26, 0.18) !important;
}

.fixed-template-map-preview .poster-header.is-chrome-grid-mode,
.fixed-template-map-preview .poster-footer.is-chrome-grid-mode {
  position: relative;
  z-index: 40;
  overflow: visible;
  outline: 1px solid rgba(36, 104, 194, 0.13);
  outline-offset: -1px;
}

.fixed-template-map-preview .chrome-grid-band,
.fixed-template-map-preview .chrome-grid-row,
.fixed-template-map-preview .chrome-grid-cell {
  overflow: visible !important;
}

.fixed-template-map-preview .poster-canvas .poster-header.is-chrome-grid-mode,
.fixed-template-map-preview .poster-canvas .poster-footer.is-chrome-grid-mode {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.fixed-template-map-preview [data-testid="poster-map"] {
  position: relative;
  z-index: 1;
}

.fixed-template-map-preview .chrome-grid-band {
  overflow: visible;
  gap: 0 !important;
}

.fixed-template-map-preview .chrome-grid-row {
  overflow: visible;
  gap: 0.7cqw !important;
}

.fixed-template-map-preview .chrome-grid-row:hover,
.fixed-template-map-preview .chrome-grid-row.is-selected,
.fixed-template-map-preview .chrome-grid-row.is-resizing-row {
  z-index: 70;
}

.fixed-template-map-preview .chrome-grid-row::after {
  border-color: transparent !important;
  background: transparent !important;
}

.fixed-template-map-preview .chrome-grid-row:hover::after,
.fixed-template-map-preview .chrome-grid-row.is-selected::after,
.fixed-template-map-preview .chrome-grid-row.is-resizing-row::after {
  border-color: rgba(28, 126, 214, 0.3) !important;
  background: rgba(34, 139, 230, 0.045) !important;
}

.fixed-template-map-preview .chrome-grid-cell {
  overflow: visible;
  outline-color: transparent !important;
  outline-offset: 2px !important;
}

.fixed-template-map-preview .chrome-grid-cell:hover,
.fixed-template-map-preview .chrome-grid-cell.is-selected {
  z-index: 80;
  outline-color: rgba(28, 126, 214, 0.58) !important;
  background: rgba(34, 139, 230, 0.035);
}

.fixed-template-map-preview .chrome-cell-trash,
.fixed-template-map-preview .chrome-cell-add-col,
.fixed-template-map-preview .chrome-cell-resize-col,
.fixed-template-map-preview .chrome-row-add-row,
.fixed-template-map-preview .chrome-row-resize-row {
  z-index: 90;
}

.fixed-template-map-preview .chrome-grid-cell.is-selected > .chrome-cell-trash,
.fixed-template-map-preview .chrome-grid-cell.is-selected > .chrome-cell-trash.is-passive,
.fixed-template-map-preview .chrome-grid-cell.is-selected > .chrome-cell-add-col,
.fixed-template-map-preview .chrome-grid-cell.is-selected > .chrome-cell-resize-col {
  opacity: 1 !important;
  pointer-events: auto !important;
  transition: none !important;
  z-index: 120;
}

.fixed-template-map-preview .chrome-grid-block {
  border-radius: 2px;
}

.fixed-template-map-preview .chrome-grid-block:focus {
  box-shadow: 0 0 0 2px rgba(28, 126, 214, 0.72);
}

.fixed-template-band {
  position: relative;
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 7cqw;
  outline: 1px solid rgba(42, 91, 204, 0.12);
  outline-offset: -1px;
}

.fixed-template-band.is-active {
  outline-color: rgba(28, 118, 205, 0.65);
}

.fixed-template-band-label {
  display: none;
}

.fixed-template-band-grid {
  display: grid;
  gap: 0;
  width: 100%;
  height: 100%;
}

.fixed-template-row {
  position: relative;
  display: grid;
  gap: 0.85cqw;
  min-height: 0;
}

.fixed-template-row.is-spacer {
  min-height: 2.2cqh;
}

.fixed-template-row.is-spacer .fixed-template-cell {
  outline-color: transparent !important;
}

.fixed-template-cell {
  position: relative;
  display: grid;
  align-items: center;
  min-width: 0;
  min-height: 0;
  outline: 1px dashed rgba(38, 117, 215, 0);
  outline-offset: 2px;
}

.fixed-template-row:hover .fixed-template-cell,
.fixed-template-cell.is-selected {
  outline-color: rgba(38, 117, 215, 0.32);
}

.fixed-template-block {
  min-width: 0;
  outline: 2px solid transparent;
  outline-offset: 2px;
  word-break: normal;
  overflow-wrap: break-word;
  hyphens: none;
}

.fixed-template-block.is-selected {
  outline-color: #1c7ed6;
}

.fixed-template-block:focus {
  outline-color: #1c7ed6;
}

.fixed-template-block--spacer {
  display: grid;
  place-items: center;
  min-height: 100%;
  border-radius: 4px;
  background: transparent;
  color: transparent;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 0.8cqh !important;
  font-weight: 850;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.fixed-template-row.is-spacer:hover .fixed-template-block--spacer,
.fixed-template-block--spacer.is-selected {
  background: rgba(34, 121, 188, 0.08);
}

.fixed-template-empty {
  min-height: 26px;
  border: 1px dashed rgba(42, 91, 204, 0.35);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.38);
  color: rgba(42, 91, 204, 0.72);
}

.fixed-template-row-plus,
.fixed-template-col-plus {
  position: absolute;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(28, 118, 205, 0.45);
  border-radius: 999px;
  background: #fff;
  color: #1c66c2;
  font-size: 15px;
  font-weight: 900;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.92);
}

.fixed-template-row-plus {
  left: 50%;
  bottom: -16px;
}

.fixed-template-col-plus {
  top: 50%;
  right: -17px;
}

.fixed-template-row:hover > .fixed-template-row-plus,
.fixed-template-row:hover > .fixed-template-col-plus {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

.fixed-template-map-band {
  position: relative;
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  border-block: 1px solid rgba(31, 26, 22, 0.12);
  background:
    linear-gradient(120deg, rgba(246, 239, 221, 0.72), rgba(221, 235, 239, 0.82)),
    repeating-linear-gradient(0deg, rgba(70, 86, 100, 0.07) 0 1px, transparent 1px 32px),
    repeating-linear-gradient(90deg, rgba(70, 86, 100, 0.07) 0 1px, transparent 1px 32px);
}

.fixed-template-route {
  position: absolute;
  inset: 12% 16%;
  width: 68%;
  height: 76%;
}

.fixed-template-route polyline {
  fill: none;
  stroke: var(--template-route);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 7;
}

.fixed-template-inspector {
  padding-bottom: 20px;
}

.fixed-template-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  gap: 8px;
  align-items: center;
  padding: 12px 20px;
}

.fixed-template-control label {
  grid-column: 1 / -1;
  color: #6f675f;
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fixed-template-control input {
  width: 100%;
  accent-color: #28785a;
}

.fixed-template-control output {
  color: #403a34;
  font-size: 12px;
  font-weight: 850;
  text-align: right;
}

.fixed-template-divider {
  height: 1px;
  margin: 8px 20px 14px;
  background: rgba(42, 37, 31, 0.12);
}

.fixed-template-style-row,
.fixed-template-align-row,
.fixed-template-danger-row {
  display: grid;
  gap: 8px;
  padding: 0 20px 10px;
}

.fixed-template-style-row {
  grid-template-columns: repeat(4, 1fr);
}

.fixed-template-align-row {
  grid-template-columns: repeat(3, 1fr);
}

.fixed-template-danger-row {
  grid-template-columns: 1fr 1fr;
}

.fixed-template-danger-row .danger {
  border-color: rgba(205, 43, 49, 0.24);
  color: #b3262d;
}

.fixed-template-danger-row .danger .fixed-template-action-icon {
  background: rgba(205, 43, 49, 0.1);
  color: #b3262d;
}

.fixed-template-control-icon {
  width: 15px;
  height: 15px;
}

.fixed-template-trash-icon {
  width: 15px;
  height: 15px;
}

.fixed-template-left-selection .fixed-template-style-row,
.fixed-template-left-selection .fixed-template-align-row,
.fixed-template-left-selection .fixed-template-danger-row {
  gap: 5px;
  margin: 0;
  padding: 0;
}

.fixed-template-left-selection .fixed-template-style-row button,
.fixed-template-left-selection .fixed-template-align-row button,
.fixed-template-left-selection .fixed-template-danger-row button {
  min-height: 30px;
  font-size: 11px;
}

.fixed-template-wide-action {
  width: calc(100% - 40px);
  margin: 0 20px 10px;
}

.fixed-template-wide-action.danger {
  border-color: rgba(190, 45, 45, 0.26);
  color: #9b2e2e;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

@media (max-width: 920px) {
  .fixed-template-editor {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .fixed-template-left,
  .fixed-template-right {
    display: none;
  }

  .fixed-template-topbar {
    grid-template-columns: 72px minmax(0, 1fr) 72px;
  }

  .fixed-template-stage {
    padding: 18px;
  }

  .fixed-template-poster {
    width: min(390px, 94vw);
    height: auto;
    max-height: none;
  }
}
</style>
