<template>
  <section class="theme-lineup-step" data-testid="theme-lineup-step">
    <div class="theme-lineup-shell">
      <div class="theme-lineup-hero">
        <div class="theme-lineup-copy">
          <h1>Pick a map theme.</h1>
          <p class="theme-lineup-selected">
            {{ selectedTheme.label }}
            <span v-if="selectedTheme.family">/ {{ selectedTheme.family }}</span>
          </p>
          <div class="theme-base-mode-picker" data-testid="theme-base-mode-picker" aria-label="Base map mode">
            <button
              v-for="option in baseModeOptions"
              :key="option.id"
              type="button"
              class="theme-base-mode-option"
              :class="{ 'is-active': selectedBaseMode === option.id }"
              :disabled="option.disabled"
              :data-testid="`theme-base-mode-${option.id}`"
              @click="selectBaseMode(option.id)"
            >
              <span>{{ option.label }}</span>
              <small v-if="option.id === 'auto'">{{ resolvedBaseModeLabel }}</small>
            </button>
          </div>
        </div>

        <div class="theme-lineup-poster" data-testid="theme-picker-hero" :style="{ backgroundColor: selectedTheme.background_color }">
          <ClientOnly>
            <MapPreview
              :key="`${selectedTheme.id}-${resolvedBaseMode}`"
              :map="map"
              :style-config="selectedPreviewConfig"
              :editable="false"
              class="theme-lineup-poster-preview"
            />
          </ClientOnly>
        </div>

        <div class="theme-lineup-actions theme-lineup-actions--desktop">
          <button class="theme-lineup-primary" data-testid="theme-picker-apply" @click="applySelected">
            Use this look
          </button>
          <button class="theme-lineup-secondary" data-testid="theme-picker-design-myself" @click="emit('design-myself')">
            Design myself
          </button>
        </div>
      </div>

      <div class="theme-lineup-grid-wrap">
        <div class="theme-lineup-groups" data-testid="theme-lineup-grid">
          <section
            v-for="group in themePurposeGroups"
            :key="group.purpose"
            class="theme-purpose-group"
            :data-theme-purpose="group.purpose"
          >
            <div class="theme-purpose-heading">
              <span>{{ group.label }}</span>
              <small>{{ group.themes.length }}</small>
            </div>
            <div class="theme-lineup-grid">
              <ThemePreviewCard
                v-for="theme in group.themes"
                :key="theme.id"
                :map="map"
                :theme="theme"
                :preview-config="previewConfigFor(theme)"
                :selected="theme.id === selectedThemeId"
                :live-enabled="cardLiveEnabled(theme.id)"
                @select="selectTheme"
                @visible="enableLiveCard"
              />
            </div>
          </section>
          <section class="theme-purpose-group theme-purpose-group--custom">
            <div class="theme-lineup-grid">
              <button
                type="button"
                class="theme-design-card"
                data-testid="theme-design-card"
                @click="emit('design-myself')"
              >
                <span class="theme-design-card-icon">
                  <UIcon name="i-heroicons-pencil-square" />
                </span>
                <span>Design myself</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="theme-lineup-actions theme-lineup-actions--mobile">
      <button class="theme-lineup-secondary" data-testid="theme-picker-design-myself-mobile" @click="emit('design-myself')">
        Design myself
      </button>
      <button class="theme-lineup-primary" data-testid="theme-picker-apply-mobile" @click="applySelected">
        Use this look
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ColorTheme, StyleConfig, ThemeDefinition, TrailMap } from '~/types'
import MapPreview from '~/components/map/MapPreview.vue'
import ThemePreviewCard from '~/components/map/ThemePreviewCard.vue'
import {
  QUICK_THEME_OPTIONS,
  deriveThemePreviewConfig,
  groupThemeOptionsByPurpose,
  orderedQuickThemeOptionsForRoute,
  resolveThemePreviewBaseMapMode,
  type ThemeBaseMapSelection,
} from '~/utils/themeOptions'

const props = defineProps<{
  map: TrailMap
  modelValue: StyleConfig
}>()

const emit = defineEmits<{
  'apply-theme': [payload: { themeId: ColorTheme; styleConfig: StyleConfig }]
  'design-myself': []
}>()

const orderedThemes = computed(() => orderedQuickThemeOptionsForRoute(props.map.stats, props.map.geojson))
const themePurposeGroups = computed(() => groupThemeOptionsByPurpose(orderedThemes.value, {
  ...props.map,
  stats: props.map.stats,
  geojson: props.map.geojson,
}))
const selectedThemeId = ref<ColorTheme>((orderedThemes.value[0] ?? QUICK_THEME_OPTIONS[0]).id)
const selectedBaseMode = ref<ThemeBaseMapSelection>('auto')
const liveCardThemeIds = ref<ColorTheme[]>([])
const maxLivePreviewCards = 4
const baseModeOptions: Array<{ id: ThemeBaseMapSelection; label: string; disabled?: boolean }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'streets', label: 'Streets' },
  { id: 'minimal', label: 'Minimal' },
]

const selectedTheme = computed(() =>
  orderedThemes.value.find(theme => theme.id === selectedThemeId.value) ?? orderedThemes.value[0] ?? QUICK_THEME_OPTIONS[0],
)

const selectedPreviewConfig = computed(() => previewConfigFor(selectedTheme.value))
const resolvedBaseMode = computed(() => resolveThemePreviewBaseMapMode({
  ...props.map,
  stats: props.map.stats,
  geojson: props.map.geojson,
}, selectedBaseMode.value))
const resolvedBaseModeLabel = computed(() => resolvedBaseMode.value[0].toUpperCase() + resolvedBaseMode.value.slice(1))

watch(orderedThemes, (themes) => {
  if (!themes.some(theme => theme.id === selectedThemeId.value)) {
    selectedThemeId.value = (themes[0] ?? QUICK_THEME_OPTIONS[0]).id
  }
  liveCardThemeIds.value = liveCardThemeIds.value
    .filter(themeId => themes.some(theme => theme.id === themeId))
    .slice(0, maxLivePreviewCards)
}, { immediate: true })

function previewConfigFor(theme: ThemeDefinition): StyleConfig {
  return deriveThemePreviewConfig(props.modelValue, theme, {
    ...props.map,
    stats: props.map.stats,
    geojson: props.map.geojson,
    baseMapMode: selectedBaseMode.value,
  })
}

function selectTheme(themeId: ColorTheme) {
  selectedThemeId.value = themeId
  enableLiveCard(themeId)
}

function enableLiveCard(themeId: ColorTheme) {
  if (liveCardThemeIds.value.includes(themeId)) return
  if (themeId !== selectedThemeId.value && liveCardThemeIds.value.length >= maxLivePreviewCards) return
  liveCardThemeIds.value = [...liveCardThemeIds.value, themeId]
}

function selectBaseMode(mode: ThemeBaseMapSelection) {
  selectedBaseMode.value = mode
}

function cardLiveEnabled(themeId: ColorTheme) {
  return selectedThemeId.value === themeId || liveCardThemeIds.value.includes(themeId)
}

function applySelected() {
  emit('apply-theme', {
    themeId: selectedTheme.value.id,
    styleConfig: selectedPreviewConfig.value,
  })
}
</script>

<style scoped>
.theme-lineup-step {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: #f5f5f4;
  color: #1c1917;
}

.theme-lineup-shell {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr);
  gap: 28px;
  min-height: 100%;
  padding: 24px;
}

.theme-lineup-hero {
  position: sticky;
  top: 0;
  align-self: start;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 96px);
  gap: 16px;
}

.theme-lineup-copy {
  display: grid;
  gap: 4px;
}

.theme-lineup-copy h1 {
  margin: 0;
  color: #1c1917;
  font-family: "Playfair Display", serif;
  font-size: 40px;
  font-weight: 600;
  line-height: 1.02;
}

.theme-lineup-selected {
  margin: 0;
  color: #78716c;
  font-size: 12px;
  font-weight: 700;
}

.theme-base-mode-picker {
  display: inline-grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  width: min(100%, 360px);
  margin-top: 8px;
  padding: 3px;
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  background: #fff;
}

.theme-base-mode-option {
  display: grid;
  min-height: 34px;
  place-items: center;
  gap: 1px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #57534e;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.theme-base-mode-option small {
  color: #a8a29e;
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}

.theme-base-mode-option.is-active {
  background: #1c1917;
  color: white;
}

.theme-base-mode-option.is-active small {
  color: rgba(255, 255, 255, 0.72);
}

.theme-base-mode-option:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.theme-lineup-poster {
  position: relative;
  flex: 1;
  min-height: 0;
  max-height: min(68dvh, 780px);
  overflow: hidden;
  border: 1px solid #d6d3d1;
  border-radius: 8px;
  box-shadow: 0 18px 46px rgba(28, 25, 23, 0.16);
}

.theme-lineup-poster-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.theme-lineup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-lineup-primary,
.theme-lineup-secondary {
  min-height: 44px;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}

.theme-lineup-primary {
  border: 1px solid #2d6a4f;
  background: #2d6a4f;
  color: white;
}

.theme-lineup-primary:hover {
  background: #235840;
}

.theme-lineup-secondary {
  border: 1px solid #d6d3d1;
  background: white;
  color: #57534e;
}

.theme-lineup-secondary:hover {
  border-color: #2d6a4f;
  color: #1f4d38;
}

.theme-lineup-grid-wrap {
  min-width: 0;
}

.theme-lineup-groups {
  display: grid;
  gap: 22px;
  padding-bottom: 24px;
}

.theme-purpose-group {
  display: grid;
  gap: 10px;
}

.theme-purpose-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #57534e;
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
}

.theme-purpose-heading small {
  color: #a8a29e;
  font-size: 10px;
  font-weight: 800;
}

.theme-lineup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 16px;
}

.theme-design-card {
  display: grid;
  min-height: 250px;
  place-items: center;
  align-content: center;
  gap: 12px;
  border: 2px dashed #d6d3d1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #57534e;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
}

.theme-design-card:hover {
  border-color: #2d6a4f;
  background: white;
  color: #1f4d38;
}

.theme-design-card-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  background: #f5f5f4;
  color: #2d6a4f;
  font-size: 20px;
}

.theme-lineup-actions--mobile {
  display: none;
}

@media (max-width: 900px) {
  .theme-lineup-shell {
    display: block;
    padding: 16px 16px 96px;
  }

  .theme-lineup-hero {
    position: static;
    min-height: 0;
    margin-bottom: 20px;
  }

  .theme-lineup-copy h1 {
    font-size: 32px;
  }

  .theme-lineup-poster {
    height: 58dvh;
    min-height: 420px;
    max-height: 620px;
  }

  .theme-lineup-actions--desktop {
    display: none;
  }

  .theme-lineup-actions--mobile {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 10px;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid #e7e5e4;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(12px);
  }

  .theme-lineup-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .theme-design-card {
    min-height: 230px;
  }
}
</style>
