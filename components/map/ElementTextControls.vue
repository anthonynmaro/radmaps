<template>
  <!--
    EDITOR-V2 D1 — text-domain control rows for the unified ElementToolbar
    (poster text slots + free text overlays). Slots stay DATA-BOUND and
    AUTO-FITTING: every change emits a PosterTextOverride patch that the
    existing poster_text_overrides / text_overlays write paths consume, so
    text-fit behavior is untouched (manual font_size_pt still bypasses fit,
    exactly as before). Size slider keeps InlineTextToolbar's log curve and
    test ids so muscle memory and Playwright selectors survive the migration.
  -->
  <div class="text-controls">
    <input
      class="toolbar-text-input"
      type="text"
      :value="textValue"
      :readonly="textReadonly === true"
      :title="textReadonly === true ? 'Bound to map data — value updates automatically' : undefined"
      aria-label="Element text"
      data-testid="element-toolbar-text"
      enterkeyhint="done"
      @input="textReadonly !== true && emitPatch({ text: ($event.target as HTMLInputElement).value })"
      @keydown.enter.prevent="$emit('done')"
      @keydown.esc.stop="($event.target as HTMLInputElement).blur()"
    />

    <div class="toolbar-row">
      <select
        class="toolbar-select"
        :value="fontFamily"
        title="Font"
        @change="emitPatch({ font_family: ($event.target as HTMLSelectElement).value as FontFamily })"
      >
        <option v-for="font in FONT_OPTIONS" :key="font" :value="font">{{ font }}</option>
      </select>

      <button
        class="toolbar-toggle"
        :class="{ active: bold }"
        title="Bold"
        @click="emitPatch({ bold: !bold })"
      >B</button>

      <button
        class="toolbar-toggle italic"
        :class="{ active: italic }"
        title="Italic"
        @click="emitPatch({ italic: !italic })"
      >I</button>

      <label class="toolbar-color" title="Text color">
        <input type="color" :value="color" @input="emitPatch({ color: ($event.target as HTMLInputElement).value })" />
      </label>
    </div>

    <div class="toolbar-row">
      <div class="toolbar-align-group" aria-label="Text alignment">
        <button
          v-for="option in ALIGN_OPTIONS"
          :key="option.value"
          class="toolbar-align-btn"
          :class="{ active: align === option.value }"
          type="button"
          :title="option.title"
          :data-testid="`text-align-${option.value}`"
          @click="emitPatch({ align: option.value })"
        >
          <span class="align-icon" :class="`align-icon--${option.value}`" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span class="sr-only">{{ option.title }}</span>
        </button>
      </div>

      <input
        class="size-slider"
        type="range"
        min="0"
        :max="SIZE_SLIDER_STEPS"
        step="1"
        :value="sizeSliderPos"
        aria-label="Font size"
        data-testid="text-size-slider"
        @input="emitSizeFromSlider(($event.target as HTMLInputElement).value)"
      />
      <input
        class="size-input"
        type="number"
        inputmode="numeric"
        :min="MIN_TEXT_SIZE_PT"
        :max="MAX_TEXT_SIZE_PT"
        step="1"
        :value="fontSizePt"
        aria-label="Font size in points"
        data-testid="text-size-input"
        @input="emitFontSize(($event.target as HTMLInputElement).value, false)"
        @change="emitFontSize(($event.target as HTMLInputElement).value, true)"
      />
      <span class="size-unit">pt</span>
    </div>

    <div class="toolbar-row size-row">
      <span class="size-label">Opacity</span>
      <input
        class="opacity-slider"
        type="range"
        min="0.05"
        max="1"
        step="0.05"
        :value="opacity"
        aria-label="Opacity"
        @input="emitPatch({ opacity: Number(($event.target as HTMLInputElement).value) })"
      />
      <span class="size-value">{{ Math.round(opacity * 100) }}%</span>

      <button
        v-if="hasOverflow"
        class="toolbar-toggle toolbar-overflow"
        :class="{ active: overflowOpen }"
        title="More options"
        aria-label="More options"
        data-testid="element-toolbar-overflow"
        @click="overflowOpen = !overflowOpen"
      >…</button>

      <button
        v-if="canDelete"
        class="toolbar-toggle toolbar-delete"
        title="Delete"
        aria-label="Delete element"
        data-testid="element-toolbar-delete"
        @click="$emit('delete')"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>

    <!-- "…" overflow — the rare/fine properties: letter-spacing, line-height,
         fit-to-area, highlight, reset. -->
    <div v-if="hasOverflow && overflowOpen" class="toolbar-overflow-panel" data-testid="element-toolbar-overflow-panel">
      <template v-if="supportsTypography">
      <div class="toolbar-row size-row">
        <span class="size-label">Tracking</span>
        <input
          class="opacity-slider"
          type="range"
          min="-0.05" max="0.4" step="0.005"
          :value="letterSpacing ?? 0"
          aria-label="Letter spacing"
          data-testid="text-letter-spacing"
          @input="emitPatch({ letter_spacing: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="size-value">{{ ((letterSpacing ?? 0)).toFixed(2) }}em</span>
      </div>
      <div class="toolbar-row size-row">
        <span class="size-label">Leading</span>
        <input
          class="opacity-slider"
          type="range"
          min="0.8" max="2.4" step="0.05"
          :value="lineHeight ?? 1.1"
          aria-label="Line height"
          data-testid="text-line-height"
          @input="emitPatch({ line_height: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="size-value">{{ (lineHeight ?? 1.1).toFixed(2) }}</span>
      </div>
      <div class="toolbar-row">
        <label class="toolbar-fit-toggle" title="Auto-fit text to its area (keeps it print-safe)">
          <input
            type="checkbox"
            :checked="autoFit !== false"
            data-testid="text-fit-to-area"
            @change="emitPatch({ auto_fit: ($event.target as HTMLInputElement).checked })"
          />
          <span>Fit to area</span>
        </label>
      </div>
      </template>
      <div v-if="supportsHighlight" class="toolbar-row">
        <button
          class="toolbar-highlight-toggle"
          :class="{ active: !!backgroundColor }"
          title="Text highlight"
          @click="toggleHighlight"
        >Highlight</button>
        <label v-if="backgroundColor" class="toolbar-color" title="Highlight color">
          <input type="color" :value="backgroundColor" @input="emitPatch({ bg_color: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
      <button v-if="canReset" class="toolbar-reset" data-testid="element-toolbar-reset" @click="$emit('reset')">
        Reset to imported text
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChromeBlockAlign, FontFamily, PosterTextOverride } from '~/types'

// Same catalog as InlineTextToolbar — keep in sync until a shared font
// registry util exists.
const FONT_OPTIONS: FontFamily[] = [
  'Source Sans 3',
  'IBM Plex Sans',
  'Atkinson Hyperlegible Next',
  'Source Serif 4',
  'Newsreader',
  'Big Shoulders Display',
  'Fjalla One',
  'Oswald',
  'Bebas Neue',
  'DM Sans',
  'Space Grotesk',
  'Outfit',
  'Work Sans',
  'Playfair Display',
  'Cormorant Garamond',
  'Libre Baskerville',
  'DM Serif Display',
]

const MIN_TEXT_SIZE_PT = 6
const MAX_TEXT_SIZE_PT = 240
const SIZE_SLIDER_STEPS = 1000
const ALIGN_OPTIONS: Array<{ value: ChromeBlockAlign; title: string }> = [
  { value: 'left', title: 'Align left' },
  { value: 'center', title: 'Align center' },
  { value: 'right', title: 'Align right' },
]

const props = defineProps<{
  textValue: string
  /** Data-bound elements (D3 stat chips): text derives from map data — show it, don't edit it. */
  textReadonly?: boolean
  fontFamily: FontFamily
  color: string
  backgroundColor?: string
  supportsHighlight?: boolean
  fontSizePt: number
  align: ChromeBlockAlign
  opacity: number
  bold: boolean
  italic: boolean
  canReset: boolean
  canDelete?: boolean
  /** Phase 5 typography fine controls (em / unitless / fit toggle). */
  letterSpacing?: number
  lineHeight?: number
  autoFit?: boolean
  /** Theme slots expose tracking/leading/fit; free overlays keep the simpler set. */
  supportsTypography?: boolean
}>()

const emit = defineEmits<{
  patch: [patch: PosterTextOverride]
  reset: []
  delete: []
  done: []
}>()

const overflowOpen = ref(false)
const hasOverflow = computed(() => props.supportsTypography === true || props.supportsHighlight === true || props.canReset)

function emitPatch(patch: PosterTextOverride) {
  emit('patch', patch)
}

function emitFontSize(value: string, clamp: boolean) {
  const size = Number(value)
  if (!Number.isFinite(size)) return
  if (!clamp && (size < MIN_TEXT_SIZE_PT || size > MAX_TEXT_SIZE_PT)) return
  emitPatch({ font_size_pt: Math.min(MAX_TEXT_SIZE_PT, Math.max(MIN_TEXT_SIZE_PT, Math.round(size))) })
}

// Log-curve size slider (InlineTextToolbar parity): the 6–240pt range would
// crowd the common small sizes into a few pixels on a linear track.
const SIZE_LOG_RATIO = Math.log(MAX_TEXT_SIZE_PT / MIN_TEXT_SIZE_PT)

const sizeSliderPos = computed(() => {
  const clamped = Math.min(MAX_TEXT_SIZE_PT, Math.max(MIN_TEXT_SIZE_PT, props.fontSizePt || MIN_TEXT_SIZE_PT))
  const t = Math.log(clamped / MIN_TEXT_SIZE_PT) / SIZE_LOG_RATIO
  return Math.round(t * SIZE_SLIDER_STEPS)
})

function emitSizeFromSlider(value: string) {
  const t = Number(value) / SIZE_SLIDER_STEPS
  if (!Number.isFinite(t)) return
  const pt = MIN_TEXT_SIZE_PT * Math.exp(t * SIZE_LOG_RATIO)
  emitPatch({ font_size_pt: Math.min(MAX_TEXT_SIZE_PT, Math.max(MIN_TEXT_SIZE_PT, Math.round(pt))) })
}

function toggleHighlight() {
  emitPatch({ bg_color: props.backgroundColor ? '' : '#E85D75' })
}
</script>

<style scoped>
.text-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-toggle,
.toolbar-align-btn,
.toolbar-highlight-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #44403c;
  cursor: pointer;
  flex-shrink: 0;
}

.toolbar-toggle {
  font-size: 13px;
  font-weight: 800;
}

.toolbar-toggle.italic {
  font-style: italic;
}

.toolbar-overflow {
  font-weight: 700;
  letter-spacing: 0.05em;
}

.toolbar-delete:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.toolbar-align-group {
  display: inline-flex;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  flex-shrink: 0;
}

.toolbar-align-btn {
  width: 27px;
  height: 26px;
  border: 0;
  border-radius: 0;
  padding: 0;
}

.align-icon {
  width: 14px;
  height: 13px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.align-icon span {
  display: block;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
}

.align-icon--left span:nth-child(1),
.align-icon--left span:nth-child(3),
.align-icon--center span:nth-child(1),
.align-icon--center span:nth-child(3),
.align-icon--right span:nth-child(1),
.align-icon--right span:nth-child(3) {
  width: 14px;
}

.align-icon--left span:nth-child(2),
.align-icon--left span:nth-child(4),
.align-icon--center span:nth-child(2),
.align-icon--center span:nth-child(4),
.align-icon--right span:nth-child(2),
.align-icon--right span:nth-child(4) {
  width: 9px;
}

.align-icon--center {
  align-items: center;
}

.align-icon--right {
  align-items: flex-end;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.toolbar-highlight-toggle {
  width: auto;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
}

.toolbar-toggle.active,
.toolbar-align-btn.active,
.toolbar-highlight-toggle.active {
  border-color: #2d6a4f;
  background: #dcebe2;
  color: #1f4d38;
}

.toolbar-select {
  min-width: 0;
  flex: 1;
  height: 28px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background-color: #ffffff;
  color: #1c1917;
  font-size: 12px;
  padding: 0 28px 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='none' stroke='%2378716C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 8l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}

.toolbar-text-input {
  width: 100%;
  height: 30px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #1c1917;
  font-size: 13px;
  line-height: 1;
  padding: 0 9px;
  outline: none;
}

.toolbar-text-input:focus {
  border-color: #2d6a4f;
  box-shadow: 0 0 0 1px rgba(45, 106, 79, 0.18);
}

.toolbar-color {
  width: 30px;
  height: 28px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  overflow: hidden;
  background: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
}

.toolbar-color input {
  width: 42px;
  height: 40px;
  margin: -5px;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.size-row {
  color: #78716c;
  font-size: 11px;
}

.size-label {
  width: 42px;
  flex-shrink: 0;
}

.size-value {
  width: 34px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.size-slider,
.opacity-slider {
  flex: 1;
  min-width: 0;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.size-slider::-webkit-slider-runnable-track,
.opacity-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: #e7e5e4;
}

.size-slider::-moz-range-track,
.opacity-slider::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: #e7e5e4;
}

.size-slider::-webkit-slider-thumb,
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2d6a4f;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(28, 25, 23, 0.25);
}

.size-slider::-moz-range-thumb,
.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2d6a4f;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(28, 25, 23, 0.25);
}

.size-slider:focus-visible,
.opacity-slider:focus-visible {
  outline: none;
}

.size-input {
  width: 52px;
  flex-shrink: 0;
  height: 28px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #1c1917;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 0 4px;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.size-input::-webkit-outer-spin-button,
.size-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.size-input:focus {
  border-color: #2d6a4f;
  box-shadow: 0 0 0 1px rgba(45, 106, 79, 0.18);
}

.size-unit {
  width: 18px;
  color: #78716c;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.toolbar-overflow-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid #f0efee;
  padding-top: 6px;
}

.toolbar-reset {
  align-self: flex-start;
  color: #78716c;
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.toolbar-fit-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #44403c;
  cursor: pointer;
}
.toolbar-fit-toggle input { accent-color: #2d6a4f; }
</style>
