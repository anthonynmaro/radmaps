<template>
  <button
    ref="cardEl"
    type="button"
    class="theme-preview-card"
    :class="{ 'is-selected': selected }"
    :data-theme-id="theme.id"
    data-testid="theme-preview-card"
    @click="emit('select', theme.id)"
  >
    <div
      class="theme-preview-frame"
      :style="{ backgroundColor: theme.background_color }"
    >
      <ClientOnly>
        <MapPreview
          v-if="liveEnabled"
          :key="`live-${theme.id}`"
          :map="map"
          :style-config="previewConfig"
          :editable="false"
          class="theme-preview-live"
        />
      </ClientOnly>
      <span v-if="!liveEnabled" class="theme-preview-loading" aria-hidden="true" />
      <span v-if="selected" class="theme-check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>
    <span class="theme-card-meta">
      <span class="theme-card-label">{{ theme.label }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import type { ColorTheme, StyleConfig, ThemeDefinition, TrailMap } from '~/types'
import MapPreview from '~/components/map/MapPreview.vue'

const props = defineProps<{
  map: TrailMap
  theme: ThemeDefinition
  previewConfig: StyleConfig
  selected?: boolean
  liveEnabled?: boolean
}>()

const emit = defineEmits<{
  select: [themeId: ColorTheme]
  visible: [themeId: ColorTheme]
}>()

const cardEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!cardEl.value || typeof IntersectionObserver === 'undefined') {
    emit('visible', props.theme.id)
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      emit('visible', props.theme.id)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '240px 0px' })

  observer.observe(cardEl.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style>
.theme-preview-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.theme-preview-frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 2 / 3;
  width: 100%;
  border: 2px solid #e7e5e4;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(28, 25, 23, 0.05);
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.theme-preview-card:hover .theme-preview-frame,
.theme-preview-card.is-selected .theme-preview-frame {
  border-color: #2d6a4f;
  box-shadow: 0 10px 24px rgba(28, 25, 23, 0.12);
  transform: translateY(-2px);
}

.theme-preview-live {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.theme-preview-loading {
  position: absolute;
  inset: 0;
  display: block;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0)),
    currentColor;
  opacity: 0.12;
}

.theme-check {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: #2d6a4f;
  color: white;
  box-shadow: 0 6px 16px rgba(28, 25, 23, 0.18);
}

.theme-check svg {
  width: 15px;
  height: 15px;
}

.theme-card-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #57534e;
}

.theme-card-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

</style>
