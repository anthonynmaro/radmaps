<template>
  <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">

    <!-- Top bar -->
    <header class="bg-white border-b px-5 py-3 flex items-center justify-between sticky top-0 z-20">
      <div class="flex items-center gap-3">
        <NuxtLink to="/dashboard" class="text-gray-400 hover:text-gray-600 transition-colors">
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <div>
          <p class="text-sm font-semibold text-gray-800 leading-none">{{ mapData?.title ?? 'Loading…' }}</p>
          <p class="text-xs text-gray-400 mt-0.5">Style your map</p>
        </div>
        <UBadge v-if="saving" color="gray" size="xs" variant="subtle">Saving…</UBadge>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          :loading="isRendering"
          :disabled="isRendering"
          color="gray"
          variant="outline"
          size="sm"
          icon="i-heroicons-photo"
          @click="triggerRender"
        >
          {{ isRendering ? 'Rendering…' : 'Generate 300 DPI' }}
        </UButton>

        <UBadge v-if="renderComplete" color="green" size="sm">
          <UIcon name="i-heroicons-check" class="w-3 h-3 mr-1" /> Print file ready
        </UBadge>

        <UButton
          :disabled="!renderComplete"
          color="primary"
          size="sm"
          trailing-icon="i-heroicons-arrow-right"
          :to="`/create/${mapId}/checkout`"
        >
          Choose product
        </UButton>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">

      <!-- Map preview -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <MapPreview
            v-if="mapData"
            :map="mapData"
            :style-config="styleConfig"
            class="w-full h-full"
          />
          <div v-else class="w-full h-full rounded-xl bg-gray-200 animate-pulse flex items-center justify-center">
            <UIcon name="i-heroicons-map" class="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <div v-if="renderError" class="px-6 pb-4 shrink-0">
          <UAlert color="red" :description="renderError" icon="i-heroicons-exclamation-triangle" />
        </div>
      </main>

      <!-- Style controls panel -->
      <aside class="w-[320px] border-l shrink-0 overflow-hidden flex flex-col">
        <MapStylePanel
          v-if="mapData"
          v-model="styleConfig"
          :saving="saving"
          @reset="resetStyle"
        />
        <div v-else class="flex-1 bg-white animate-pulse" />
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { StyleConfig } from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'

definePageMeta({ middleware: 'auth', layout: false })

const route = useRoute()
const mapId = computed(() => route.params.mapId as string)

const { map: mapData, saving, updateStyle } = useMap(mapId)
const { triggerRender, isRendering, isComplete: renderComplete, error: renderError } = useMapRenderer(mapId)

const styleConfig = ref<StyleConfig>({ ...DEFAULT_STYLE_CONFIG })

watch(mapData, (m) => {
  if (m?.style_config) {
    // Merge with current defaults so any new fields (or stale DB records) get sensible values
    styleConfig.value = { ...DEFAULT_STYLE_CONFIG, ...m.style_config }
  }
}, { immediate: true })

// Debounced save — 600ms after the user stops tweaking
let saveTimer: ReturnType<typeof setTimeout>
watch(styleConfig, (newConfig) => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => updateStyle(newConfig), 600)
}, { deep: true })

function resetStyle() {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG }
}
</script>
