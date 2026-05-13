<template>
  <AdminShell title="Premade Maps">
    <section class="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div class="space-y-4">
        <form class="rounded-xl border border-stone-200 bg-white p-5 space-y-4" @submit.prevent="createFromMap">
          <div>
            <p class="text-sm font-semibold text-stone-900">Create from map ID</p>
            <p class="text-xs text-stone-500 mt-1">Copies route, style, stats, and available render assets into a draft.</p>
          </div>
          <label class="block">
            <span class="admin-label">Map ID</span>
            <input v-model="mapId" required class="admin-input font-mono text-xs" placeholder="00000000-0000-0000-0000-000000000000" />
          </label>
          <button class="admin-button" :disabled="creating">{{ creating ? 'Creating…' : 'Create draft' }}</button>
          <p v-if="notice" class="text-xs" :class="noticeType === 'error' ? 'text-red-600' : 'text-green-700'">{{ notice }}</p>
        </form>

        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="admin-label mb-2">Draft requirements</p>
          <p class="text-xs text-stone-500 leading-relaxed">
            Drafts can start from only a map ID. Publishing requires route data, style config, preview image, and print-ready render URL.
          </p>
        </div>

        <div class="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
          <div>
            <p class="admin-label mb-2">Thumbnail backfill</p>
            <p class="text-xs text-stone-500 leading-relaxed">
              Generates realistic low-res MapLibre poster thumbnails for drafts missing previews.
            </p>
          </div>
          <button class="admin-secondary w-full" :disabled="backfilling" @click="backfillThumbnails">
            {{ backfilling ? 'Generating…' : 'Generate next 5 previews' }}
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div class="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 border-b border-stone-200 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
          <span>Map</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        <div class="divide-y divide-stone-100">
          <article v-for="map in premades" :key="map.id" class="p-4">
            <div class="grid gap-4 lg:grid-cols-[96px_1fr_220px]">
              <NuxtLink
                :to="`/admin/premade/${map.id}/style`"
                class="block rounded-lg overflow-hidden border border-stone-200 bg-stone-100 transition hover:border-stone-400 hover:shadow-sm"
                style="aspect-ratio:2/3"
              >
                <img v-if="map.preview_image_url" :src="map.preview_image_url" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-stone-400 text-center px-2">No preview</div>
              </NuxtLink>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="admin-label">Title</span>
                  <input v-model="drafts[map.id!].title" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Slug</span>
                  <input v-model="drafts[map.id!].slug" class="admin-input font-mono text-xs" />
                </label>
                <label class="block">
                  <span class="admin-label">Category</span>
                  <select v-model="drafts[map.id!].category" class="admin-input">
                    <option v-for="category in PREMADE_CATEGORIES" :key="category.id" :value="category.id">{{ category.label }}</option>
                  </select>
                </label>
                <label class="block">
                  <span class="admin-label">Region</span>
                  <input v-model="drafts[map.id!].region" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Country</span>
                  <input v-model="drafts[map.id!].country" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Location label</span>
                  <input v-model="drafts[map.id!].location_label" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">City</span>
                  <input v-model="drafts[map.id!].location_city" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Search region</span>
                  <input v-model="drafts[map.id!].location_region" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Search country</span>
                  <input v-model="drafts[map.id!].location_country" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Longitude</span>
                  <input v-model.number="drafts[map.id!].location_lng" type="number" step="0.000001" min="-180" max="180" class="admin-input" />
                </label>
                <label class="block">
                  <span class="admin-label">Latitude</span>
                  <input v-model.number="drafts[map.id!].location_lat" type="number" step="0.000001" min="-90" max="90" class="admin-input" />
                </label>
                <label class="block sm:col-span-2">
                  <span class="admin-label">Tagline</span>
                  <input v-model="drafts[map.id!].tagline" class="admin-input" />
                </label>
                <label class="block sm:col-span-2">
                  <span class="admin-label">Description</span>
                  <textarea v-model="drafts[map.id!].description" class="admin-input min-h-24"></textarea>
                </label>
                <label class="block sm:col-span-2">
                  <span class="admin-label">Preview URL</span>
                  <input v-model="drafts[map.id!].preview_image_url" class="admin-input text-xs" />
                </label>
                <label class="block sm:col-span-2">
                  <span class="admin-label">Render URL</span>
                  <input v-model="drafts[map.id!].render_url" class="admin-input text-xs" />
                </label>
              </div>

              <div class="flex flex-col gap-2">
                <span class="inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" :class="statusClass(map.status)">
                  {{ map.status || 'draft' }}
                </span>
                <span v-if="map.needs_preview" class="text-xs text-amber-700">Needs preview</span>
                <NuxtLink :to="`/admin/premade/${map.id}/style`" class="admin-secondary text-center">Style / edit</NuxtLink>
                <button class="admin-secondary" @click="savePremade(map.id!)">Save</button>
                <button class="admin-secondary" @click="generatePreview(map.id!)">Generate preview</button>
                <button class="admin-button" @click="publishPremade(map.id!)">Publish</button>
                <button class="admin-danger" @click="archivePremade(map.id!)">Archive</button>
              </div>
            </div>
          </article>
          <div v-if="premades.length === 0" class="p-8 text-center text-sm text-stone-500">No premade maps yet.</div>
        </div>
      </div>
    </section>
  </AdminShell>
</template>

<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import type { PremadeMap } from '~/types'
import { PREMADE_CATEGORIES } from '~/utils/premadeCatalog'

definePageMeta({ layout: 'default', middleware: 'auth' })

const mapId = ref('')
const creating = ref(false)
const backfilling = ref(false)
const notice = ref('')
const noticeType = ref<'success' | 'error'>('success')
// useLazyFetch so admin tab navigation isn't blocked on this round-trip —
// the page chrome paints first and the list streams in.
const { data: premades, refresh } = useLazyFetch<PremadeMap[]>('/api/admin/premade', {
  default: () => [],
})

const drafts = reactive<Record<string, Partial<PremadeMap>>>({})

watchEffect(() => {
  for (const map of premades.value) {
    if (!map.id || drafts[map.id]) continue
    drafts[map.id] = {
      title: map.title,
      slug: map.slug,
      category: map.category,
      region: map.region,
      country: map.country,
      location_label: map.location_label,
      location_city: map.location_city,
      location_region: map.location_region,
      location_country: map.location_country,
      location_lng: map.location_lng,
      location_lat: map.location_lat,
      tagline: map.tagline,
      description: map.description,
      preview_image_url: map.preview_image_url,
      render_url: map.render_url,
    }
  }
})

function statusClass(status?: string) {
  if (status === 'published') return 'bg-green-100 text-green-800'
  if (status === 'archived') return 'bg-stone-100 text-stone-500'
  return 'bg-amber-100 text-amber-800'
}

async function createFromMap() {
  creating.value = true
  notice.value = ''
  try {
    await $fetch('/api/admin/premade/from-map', { method: 'POST', body: { map_id: mapId.value } })
    notice.value = 'Draft created.'
    noticeType.value = 'success'
    mapId.value = ''
    await refresh()
  } catch (err: any) {
    notice.value = err?.data?.message || err?.message || 'Could not create draft.'
    noticeType.value = 'error'
  } finally {
    creating.value = false
  }
}

async function savePremade(id: string) {
  const draft = { ...drafts[id] }
  for (const key of ['location_label', 'location_city', 'location_region', 'location_country'] as const) {
    if (draft[key] === '') draft[key] = null
  }
  if ((draft as any).location_lng === '') draft.location_lng = null
  if ((draft as any).location_lat === '') draft.location_lat = null
  await $fetch('/api/admin/premade', { method: 'PATCH', body: { id, ...draft } })
  await refresh()
}

async function generatePreview(id: string) {
  await $fetch(`/api/admin/premade/${id}/generate-preview`, { method: 'POST' })
  await refresh()
}

async function backfillThumbnails() {
  backfilling.value = true
  try {
    await $fetch('/api/admin/premade/backfill-thumbnails', {
      method: 'POST',
      body: { limit: 5 },
    })
    await refresh()
  } finally {
    backfilling.value = false
  }
}

async function publishPremade(id: string) {
  await savePremade(id)
  await $fetch(`/api/admin/premade/${id}/publish`, { method: 'POST' })
  await refresh()
}

async function archivePremade(id: string) {
  await $fetch('/api/admin/premade', { method: 'PATCH', body: { id, status: 'archived', homepage_visible: false } })
  await refresh()
}
</script>

<style scoped>
.admin-label { display:block; margin-bottom:0.375rem; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgb(120 113 108); }
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-button { border-radius:999px; background:rgb(28 25 23); color:white; padding:0.75rem 1rem; font-size:0.8rem; font-weight:700; }
.admin-button:disabled { opacity:0.55; }
.admin-secondary { border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.7rem 1rem; font-size:0.8rem; font-weight:700; }
.admin-danger { border-radius:999px; border:1px solid rgb(254 202 202); background:white; color:rgb(220 38 38); padding:0.7rem 1rem; font-size:0.8rem; font-weight:700; }
</style>
