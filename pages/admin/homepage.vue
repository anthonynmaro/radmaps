<template>
  <AdminShell title="Homepage Features">
    <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div class="p-4 border-b border-stone-200 flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-stone-900">Pre-login catalog section</p>
          <p class="text-xs text-stone-500 mt-1">Controls which published premade maps appear first on the public home/shop experience.</p>
        </div>
        <button class="admin-button" @click="saveHomepage">Save ordering</button>
      </div>
      <div class="divide-y divide-stone-100">
        <div v-for="map in publishedPremades" :key="map.id" class="p-4 grid gap-4 sm:grid-cols-[56px_1fr_120px_100px] sm:items-center">
          <div class="rounded-md overflow-hidden border border-stone-200 bg-stone-100" style="aspect-ratio:2/3">
            <img v-if="map.preview_image_url" :src="map.preview_image_url" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-stone-900 truncate">{{ map.title }}</p>
            <p class="text-xs text-stone-500 truncate">{{ map.region }}</p>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-stone-700">
            <input v-model="drafts[map.id!].homepage_visible" type="checkbox" class="rounded border-stone-300" />
            Featured
          </label>
          <input v-model.number="drafts[map.id!].homepage_sort_order" type="number" class="admin-input" />
        </div>
        <div v-if="publishedPremades.length === 0" class="p-8 text-center text-sm text-stone-500">No published premade maps yet.</div>
      </div>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import type { PremadeMap } from '~/types'

definePageMeta({ layout: 'default', middleware: 'auth' })

// useLazyFetch so admin tab navigation isn't blocked on this round-trip.
const { data: premades, refresh } = useLazyFetch<PremadeMap[]>('/api/admin/premade', {
  default: () => [],
})

const drafts = reactive<Record<string, { homepage_visible: boolean; homepage_sort_order: number }>>({})
const publishedPremades = computed(() => premades.value.filter((map) => map.status === 'published'))

watchEffect(() => {
  for (const map of publishedPremades.value) {
    if (!map.id || drafts[map.id]) continue
    drafts[map.id] = {
      homepage_visible: Boolean(map.homepage_visible),
      homepage_sort_order: map.homepage_sort_order ?? 1000,
    }
  }
})

async function saveHomepage() {
  await $fetch('/api/admin/homepage', {
    method: 'PATCH',
    body: {
      items: Object.entries(drafts).map(([id, values]) => ({ id, ...values })),
    },
  })
  await refresh()
}
</script>

<style scoped>
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.55rem 0.7rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-button { border-radius:999px; background:rgb(28 25 23); color:white; padding:0.75rem 1rem; font-size:0.8rem; font-weight:700; }
</style>
