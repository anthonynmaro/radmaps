<template>
  <Teleport to="body">
    <div
      ref="toolbarRef"
      class="inline-text-toolbar"
      :class="{ 'is-mobile': isMobile }"
      :style="toolbarStyle"
      @pointerdown.stop
      @click.stop
    >
      <div class="toolbar-header">
        <span class="toolbar-title">{{ label }}</span>
        <button class="toolbar-icon-btn" title="Done" @click="$emit('done')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <input
        class="toolbar-text-input"
        type="text"
        :value="textValue"
        :aria-label="`${label} text`"
        enterkeyhint="done"
        @input="emitPatch({ text: ($event.target as HTMLInputElement).value })"
        @keydown.enter.prevent="$emit('done')"
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

        <label class="toolbar-color" title="Text color">
          <input type="color" :value="color" @input="emitPatch({ color: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>

      <div v-if="supportsHighlight" class="toolbar-row highlight-row">
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

      <div class="toolbar-row size-row">
        <span class="size-label">Size</span>
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
          @input="emitPatch({ opacity: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="size-value">{{ Math.round(opacity * 100) }}%</span>
      </div>

      <button v-if="canReset" class="toolbar-reset" @click="$emit('reset')">Reset to imported text</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ChromeBlockAlign, FontFamily, PosterTextOverride } from '~/types'

const FONT_OPTIONS: FontFamily[] = [
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
  label: string
  anchorRect: DOMRect | null
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
  textValue: string
}>()

const emit = defineEmits<{
  patch: [patch: PosterTextOverride]
  reset: []
  done: []
}>()

const toolbarRef = ref<HTMLElement | null>(null)
const isMobile = ref(false)
const viewportBottomInset = ref(0)

function syncViewport() {
  isMobile.value = window.matchMedia('(max-width: 767px)').matches
  const vv = window.visualViewport
  viewportBottomInset.value = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('scroll', syncViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
})

const toolbarStyle = computed(() => {
  if (isMobile.value || !props.anchorRect) {
    return {
      left: '12px',
      right: '12px',
      bottom: `${viewportBottomInset.value + 12}px`,
    }
  }

  const width = toolbarRef.value?.offsetWidth ?? 360
  const height = toolbarRef.value?.offsetHeight ?? 132
  const left = Math.min(
    Math.max(12, props.anchorRect.left + props.anchorRect.width / 2 - width / 2),
    window.innerWidth - width - 12,
  )
  const below = props.anchorRect.bottom + 10
  const top = below + height < window.innerHeight - 12
    ? below
    : Math.max(12, props.anchorRect.top - height - 10)

  return {
    left: `${left}px`,
    top: `${top}px`,
  }
})

function emitPatch(patch: PosterTextOverride) {
  emit('patch', patch)
}

function emitFontSize(value: string, clamp: boolean) {
  const size = Number(value)
  if (!Number.isFinite(size)) return
  if (!clamp && (size < MIN_TEXT_SIZE_PT || size > MAX_TEXT_SIZE_PT)) return
  emitPatch({ font_size_pt: Math.min(MAX_TEXT_SIZE_PT, Math.max(MIN_TEXT_SIZE_PT, Math.round(size))) })
}

// The point range (6–240) is wide, so a linear slider would crowd the common
// small sizes into a few pixels. Map the slider on a log curve so drag distance
// feels even across the whole range.
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
.inline-text-toolbar {
  position: fixed;
  z-index: 10000;
  width: min(360px, calc(100vw - 24px));
  padding: 10px;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 44px rgba(28, 25, 23, 0.18);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inline-text-toolbar.is-mobile {
  width: auto;
  border-radius: 14px;
}

.toolbar-header,
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-header {
  justify-content: space-between;
}

.toolbar-title {
  color: #1C1917;
  font-size: 12px;
  font-weight: 700;
}

.toolbar-icon-btn,
.toolbar-toggle,
.toolbar-align-btn,
.toolbar-highlight-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  background: #FFFFFF;
  color: #44403C;
  cursor: pointer;
}

.toolbar-toggle {
  font-size: 13px;
  font-weight: 800;
}

.toolbar-align-group {
  display: inline-flex;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
}

.toolbar-align-btn {
  width: 27px;
  height: 28px;
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
.align-icon--left span:nth-child(3) {
  width: 14px;
}

.align-icon--left span:nth-child(2),
.align-icon--left span:nth-child(4) {
  width: 9px;
}

.align-icon--center {
  align-items: center;
}

.align-icon--center span:nth-child(1),
.align-icon--center span:nth-child(3) {
  width: 14px;
}

.align-icon--center span:nth-child(2),
.align-icon--center span:nth-child(4) {
  width: 9px;
}

.align-icon--right {
  align-items: flex-end;
}

.align-icon--right span:nth-child(1),
.align-icon--right span:nth-child(3) {
  width: 14px;
}

.align-icon--right span:nth-child(2),
.align-icon--right span:nth-child(4) {
  width: 9px;
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

.toolbar-toggle.italic {
  font-style: italic;
}

.toolbar-toggle.active,
.toolbar-align-btn.active,
.toolbar-highlight-toggle.active {
  border-color: #2D6A4F;
  background: #DCEBE2;
  color: #1F4D38;
}

.toolbar-select {
  min-width: 0;
  flex: 1;
  height: 30px;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  background-color: #FFFFFF;
  color: #1C1917;
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
  height: 32px;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  background: #FFFFFF;
  color: #1C1917;
  font-size: 14px;
  line-height: 1;
  padding: 0 9px;
  outline: none;
}

.toolbar-text-input:focus {
  border-color: #2D6A4F;
  box-shadow: 0 0 0 1px rgba(45, 106, 79, 0.18);
}

.toolbar-color {
  width: 32px;
  height: 30px;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
  cursor: pointer;
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
  color: #78716C;
  font-size: 11px;
}

.size-label,
.size-value {
  width: 42px;
}

.size-label {
  flex-shrink: 0;
}

.size-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
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
  background: #E7E5E4;
}

.size-slider::-moz-range-track,
.opacity-slider::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: #E7E5E4;
}

.size-slider::-webkit-slider-thumb,
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2D6A4F;
  border: 2px solid #FFFFFF;
  box-shadow: 0 1px 3px rgba(28, 25, 23, 0.25);
  transition: box-shadow 0.12s ease;
}

.size-slider::-moz-range-thumb,
.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2D6A4F;
  border: 2px solid #FFFFFF;
  box-shadow: 0 1px 3px rgba(28, 25, 23, 0.25);
}

.size-slider:focus-visible,
.opacity-slider:focus-visible {
  outline: none;
}

.size-slider:focus-visible::-webkit-slider-thumb,
.opacity-slider:focus-visible::-webkit-slider-thumb,
.size-slider:active::-webkit-slider-thumb,
.opacity-slider:active::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px rgba(45, 106, 79, 0.2);
}

.size-input {
  width: 56px;
  flex-shrink: 0;
  height: 30px;
  border: 1px solid #E7E5E4;
  border-radius: 8px;
  background: #FFFFFF;
  color: #1C1917;
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
  border-color: #2D6A4F;
  box-shadow: 0 0 0 1px rgba(45, 106, 79, 0.18);
}

.size-unit {
  width: 24px;
  color: #78716C;
  font-size: 11px;
  font-weight: 700;
}

.toolbar-reset {
  align-self: flex-start;
  color: #78716C;
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
</style>
