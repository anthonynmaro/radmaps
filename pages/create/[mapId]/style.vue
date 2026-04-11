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
        <!-- Share button -->
        <UButton
          icon="i-heroicons-link"
          color="gray"
          variant="ghost"
          size="sm"
          @click="copyShareLink"
        >
          {{ shareLabel }}
        </UButton>

        <!-- Save version button -->
        <UButton
          icon="i-heroicons-bookmark"
          color="gray"
          variant="ghost"
          size="sm"
          @click="showVersionModal = true"
        >
          Save version
        </UButton>

        <div class="w-px h-5 bg-gray-200" />

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
          <ClientOnly>
            <MapPreview
              v-if="mapData"
              :map="mapData"
              :style-config="styleConfig"
              class="w-full h-full"
            />
          </ClientOnly>
          <div v-if="!mapData" class="w-full h-full rounded-xl bg-gray-200 animate-pulse flex items-center justify-center">
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

    <!-- Save version modal -->
    <UModal v-model="showVersionModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-900">Save a version</h3>
            <UButton icon="i-heroicons-x-mark" color="gray" variant="ghost" size="xs" @click="showVersionModal = false" />
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-500">
            Snapshot your current style so you can come back to it later. Your map auto-saves continuously — this is an optional named checkpoint.
          </p>
          <UFormGroup label="Label (optional)">
            <UInput
              v-model="versionLabel"
              placeholder="e.g. Dark navy with gold route"
              @keydown.enter="saveVersion"
            />
          </UFormGroup>

          <!-- Previous versions -->
          <div v-if="versions.length > 0">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Previous snapshots</p>
            <ul class="space-y-1">
              <li
                v-for="v in versions"
                :key="v.id"
                class="flex items-center justify-between text-sm rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer group"
                @click="restoreVersion(v)"
              >
                <span class="text-gray-700">{{ v.label || 'Untitled snapshot' }}</span>
                <span class="text-xs text-gray-400 group-hover:text-green-600 transition-colors">
                  {{ new Date(v.created_at).toLocaleDateString() }} — Restore
                </span>
              </li>
            </ul>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="showVersionModal = false">Cancel</UButton>
            <UButton
              color="green"
              :loading="savingVersion"
              @click="saveVersion"
            >
              Save snapshot
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

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

// ─── Share link ───────────────────────────────────────────────────────────────

const shareLabel = ref('Share')

async function copyShareLink() {
  const shareUrl = `${window.location.origin}/map/${mapId.value}`
  try {
    await navigator.clipboard.writeText(shareUrl)
    shareLabel.value = 'Copied!'
    setTimeout(() => { shareLabel.value = 'Share' }, 2500)
  } catch {
    // Fallback: prompt
    window.prompt('Copy this link:', shareUrl)
  }
}

// ─── Save version ─────────────────────────────────────────────────────────────

const showVersionModal = ref(false)
const versionLabel = ref('')
const savingVersion = ref(false)
const versions = ref<Array<{ id: string; label: string | null; style_config: StyleConfig; created_at: string }>>([])

// Load versions when modal opens
watch(showVersionModal, async (open) => {
  if (!open) return
  try {
    const data = await $fetch<typeof versions.value>(`/api/maps/${mapId.value}/versions`)
    versions.value = data
  } catch { /* ignore */ }
})

async function saveVersion() {
  savingVersion.value = true
  try {
    const v = await $fetch<{ id: string; label: string | null; created_at: string }>(
      `/api/maps/${mapId.value}/versions`,
      { method: 'POST', body: { label: versionLabel.value || null } },
    )
    versions.value.unshift({ ...v, style_config: { ...styleConfig.value } })
    versionLabel.value = ''
    showVersionModal.value = false
  } catch { /* ignore */ } finally {
    savingVersion.value = false
  }
}

function restoreVersion(v: { style_config: StyleConfig }) {
  styleConfig.value = { ...DEFAULT_STYLE_CONFIG, ...v.style_config }
  showVersionModal.value = false
}
</script>
