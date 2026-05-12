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
          min="0.5"
          max="3"
          step="0.05"
          :value="scale"
          @input="emitPatch({ scale: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="size-value">{{ Math.round(scale * 100) }}%</span>
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
import type { FontFamily, PosterTextOverride } from '~/types'

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

const props = defineProps<{
  label: string
  anchorRect: DOMRect | null
  fontFamily: FontFamily
  color: string
  backgroundColor?: string
  supportsHighlight?: boolean
  scale: number
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
  background: #FFFFFF;
  color: #1C1917;
  font-size: 12px;
  padding: 0 8px;
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

.size-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.size-slider {
  flex: 1;
  accent-color: #2D6A4F;
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
