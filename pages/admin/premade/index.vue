<template>
  <AdminShell title="Premade Maps">
    <!-- ─────────────────────────────────────────────────────────────────
         TOOLBAR — search, status filter, primary CTA, utility action
         ───────────────────────────────────────────────────────────────── -->
    <div class="rounded-xl border border-stone-200 bg-white p-4 mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div class="relative flex-1 max-w-md">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            v-model="searchQuery"
            class="admin-input pl-9"
            placeholder="Search title, slug, or region…"
          />
        </div>
        <div class="flex items-center gap-1.5 rounded-full bg-stone-100 p-1 self-start sm:self-auto">
          <button
            v-for="filter in statusFilters"
            :key="filter.id"
            class="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
            :class="statusFilter === filter.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'"
            @click="setStatusFilter(filter.id)"
          >
            {{ filter.label }}
            <span v-if="filter.count !== undefined" class="ml-1 text-[10px] text-stone-400">{{ filter.count }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="admin-secondary" :disabled="backfilling" @click="backfillThumbnails">
          <UIcon name="i-heroicons-photo" class="w-3.5 h-3.5 mr-1.5 inline-block" />
          {{ backfilling ? 'Generating…' : 'Backfill thumbnails' }}
        </button>
        <button class="admin-button" @click="openCreatePanel">
          <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5 mr-1.5 inline-block" />
          New from map ID
        </button>
      </div>
    </div>

    <!-- ─────────────────────────────────────────────────────────────────
         CARD GRID
         ───────────────────────────────────────────────────────────────── -->
    <div v-if="filteredPremades.length === 0" class="rounded-xl border border-stone-200 bg-white p-12 text-center">
      <UIcon name="i-heroicons-map" class="w-8 h-8 text-stone-300 mx-auto mb-3" />
      <p class="text-sm font-semibold text-stone-700">No premade maps match this view.</p>
      <p class="text-xs text-stone-500 mt-1">
        {{ searchQuery || statusFilter !== 'all' ? 'Try clearing your filters.' : 'Use “New from map ID” to start a draft.' }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <button
        v-for="map in pagedPremades"
        :key="map.id"
        class="group text-left rounded-2xl border border-stone-200 bg-white overflow-hidden transition-all hover:border-stone-400 hover:shadow-lg hover:shadow-stone-900/5 hover:-translate-y-0.5 flex flex-col"
        @click="openEditPanel(map)"
      >
        <!-- Preview -->
        <div class="relative bg-stone-100 overflow-hidden" style="aspect-ratio:2/3">
          <img
            v-if="map.preview_image_url"
            :src="map.preview_image_url"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-stone-400">
            <UIcon name="i-heroicons-photo" class="w-7 h-7" />
            <span class="text-[10px] uppercase tracking-[0.18em] font-semibold">No preview</span>
          </div>
          <!-- Status pill -->
          <span
            class="absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] shadow-sm backdrop-blur"
            :class="statusBadgeClass(map.status)"
          >
            {{ map.status || 'draft' }}
          </span>
          <!-- Needs-preview / homepage-visible markers -->
          <div class="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
            <span v-if="map.needs_preview" class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-amber-100/90 text-amber-800 shadow-sm">
              Needs preview
            </span>
            <span v-if="map.homepage_visible" class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-stone-900/90 text-white shadow-sm">
              Featured
            </span>
          </div>
        </div>

        <!-- Metadata -->
        <div class="flex flex-col gap-2 p-4">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-stone-900 leading-tight line-clamp-2 flex-1">
              {{ map.title || 'Untitled draft' }}
            </p>
            <UIcon
              name="i-heroicons-arrow-up-right"
              class="w-4 h-4 text-stone-300 group-hover:text-stone-700 transition-colors shrink-0 mt-0.5"
            />
          </div>
          <p v-if="map.slug" class="font-mono text-[11px] text-stone-500 truncate">{{ map.slug }}</p>
          <p class="text-xs text-stone-500 truncate">
            <span v-if="map.region">{{ map.region }}</span>
            <span v-if="map.region && map.country" class="text-stone-300"> · </span>
            <span v-if="map.country">{{ map.country }}</span>
            <span v-if="!map.region && !map.country" class="italic text-stone-400">Location not set</span>
          </p>
          <div class="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-stone-100">
            <span class="text-[10px] uppercase tracking-[0.14em] font-bold text-stone-400">
              {{ categoryLabel(map.category) }}
            </span>
            <span class="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-400 group-hover:text-[#2D6A4F] transition-colors">
              Click to edit →
            </span>
          </div>
        </div>
      </button>
    </div>

    <!-- ─────────────────────────────────────────────────────────────────
         PAGINATION
         ───────────────────────────────────────────────────────────────── -->
    <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between gap-3">
      <p class="text-xs text-stone-500">
        Showing
        <span class="font-semibold text-stone-700">{{ pageStartIndex + 1 }}</span>
        –<span class="font-semibold text-stone-700">{{ pageEndIndex }}</span>
        of <span class="font-semibold text-stone-700">{{ filteredPremades.length }}</span>
      </p>
      <div class="flex items-center gap-1">
        <button
          class="admin-page-button"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5" />
        </button>
        <button
          v-for="page in pageNumbers"
          :key="page.key"
          class="admin-page-button"
          :class="page.value === currentPage ? 'admin-page-button-active' : ''"
          :disabled="page.value === null"
          @click="page.value !== null && goToPage(page.value)"
        >
          <span v-if="page.value === null" class="text-stone-300">…</span>
          <span v-else>{{ page.value }}</span>
        </button>
        <button
          class="admin-page-button"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- ─────────────────────────────────────────────────────────────────
         SLIDE-OUT PANEL — create + edit share one drawer
         ───────────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="panelOpen" class="fixed inset-0 z-50">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity"
          :class="panelMounted ? 'opacity-100' : 'opacity-0'"
          @click="closePanel"
        />

        <!-- Panel -->
        <aside
          class="absolute top-0 right-0 h-full w-full sm:max-w-xl bg-[#FAF8F4] shadow-2xl flex flex-col transition-transform duration-300 ease-out"
          :class="panelMounted ? 'translate-x-0' : 'translate-x-full'"
        >
          <!-- Header -->
          <header class="shrink-0 border-b border-stone-200 bg-white/70 backdrop-blur px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2D6A4F]">
                {{ panelMode === 'create' ? 'New premade' : 'Editing premade' }}
              </p>
              <h2 class="text-lg font-semibold text-stone-900 mt-1 truncate" style="font-family:'Space Grotesk',sans-serif">
                {{ panelTitle }}
              </h2>
              <p v-if="panelMode === 'edit' && editingMap?.slug" class="font-mono text-[11px] text-stone-500 mt-1 truncate">
                {{ editingMap.slug }}
              </p>
            </div>
            <button
              class="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              aria-label="Close"
              @click="closePanel"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </header>

          <!-- Body — scrollable -->
          <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            <!-- ─── CREATE MODE ─────────────────────────────────────── -->
            <template v-if="panelMode === 'create'">
              <div class="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
                <div>
                  <p class="text-sm font-semibold text-stone-900">Create from map ID</p>
                  <p class="text-xs text-stone-500 mt-1 leading-relaxed">
                    Paste a source map UUID. We'll copy its route, style, stats, and render assets
                    into a fresh draft. You can fill in the marketing metadata after the draft loads.
                  </p>
                </div>
                <label class="block">
                  <span class="admin-label">Source map ID</span>
                  <input
                    v-model="newMapId"
                    required
                    class="admin-input font-mono text-xs"
                    placeholder="00000000-0000-0000-0000-000000000000"
                    @keyup.enter="createFromMap"
                  />
                </label>
                <p v-if="createError" class="text-xs text-red-600">{{ createError }}</p>
              </div>

              <div class="rounded-xl border border-dashed border-stone-200 bg-white/60 p-4">
                <p class="admin-label mb-1.5">Draft requirements</p>
                <p class="text-xs text-stone-500 leading-relaxed">
                  Drafts can start from just a map ID. Publishing requires route data, style config,
                  preview image, and a print-ready render URL.
                </p>
              </div>
            </template>

            <!-- ─── EDIT MODE ───────────────────────────────────────── -->
            <template v-else-if="editingMap && panelDraft">
              <!-- Status / quick context -->
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  :class="statusBadgeClass(editingMap.status)"
                >
                  {{ editingMap.status || 'draft' }}
                </span>
                <span v-if="editingMap.needs_preview" class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] bg-amber-100 text-amber-800">
                  Needs preview
                </span>
                <span v-if="editingMap.homepage_visible" class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] bg-stone-900 text-white">
                  Featured
                </span>
                <span v-if="saveStatus" class="text-[11px]" :class="saveStatusType === 'error' ? 'text-red-600' : 'text-green-700'">
                  {{ saveStatus }}
                </span>
              </div>

              <!-- Identity -->
              <Section title="Identity">
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="block">
                    <span class="admin-label">Title</span>
                    <input v-model="panelDraft.title" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Slug</span>
                    <input v-model="panelDraft.slug" class="admin-input font-mono text-xs" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Category</span>
                    <select v-model="panelDraft.category" class="admin-input">
                      <option v-for="category in PREMADE_CATEGORIES" :key="category.id" :value="category.id">
                        {{ category.label }}
                      </option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="admin-label">Region</span>
                    <input v-model="panelDraft.region" class="admin-input" />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="admin-label">Country</span>
                    <input v-model="panelDraft.country" class="admin-input" />
                  </label>
                </div>
              </Section>

              <!-- Location -->
              <Section title="Location">
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="block sm:col-span-2">
                    <span class="admin-label">Location label</span>
                    <input v-model="panelDraft.location_label" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">City</span>
                    <input v-model="panelDraft.location_city" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Search region</span>
                    <input v-model="panelDraft.location_region" class="admin-input" />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="admin-label">Search country</span>
                    <input v-model="panelDraft.location_country" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Longitude</span>
                    <input v-model.number="panelDraft.location_lng" type="number" step="0.000001" min="-180" max="180" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Latitude</span>
                    <input v-model.number="panelDraft.location_lat" type="number" step="0.000001" min="-90" max="90" class="admin-input" />
                  </label>
                </div>
              </Section>

              <!-- Marketing copy -->
              <Section title="Marketing">
                <div class="grid gap-3">
                  <label class="block">
                    <span class="admin-label">Tagline</span>
                    <input v-model="panelDraft.tagline" class="admin-input" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Description</span>
                    <textarea v-model="panelDraft.description" class="admin-input min-h-24"></textarea>
                  </label>
                </div>
              </Section>

              <!-- Render assets -->
              <Section title="Render assets">
                <div class="grid gap-3">
                  <label class="block">
                    <span class="admin-label">Preview URL</span>
                    <input v-model="panelDraft.preview_image_url" class="admin-input text-xs" />
                  </label>
                  <label class="block">
                    <span class="admin-label">Render URL</span>
                    <input v-model="panelDraft.render_url" class="admin-input text-xs" />
                  </label>
                </div>
              </Section>

              <!-- Secondary actions live in the body so the sticky footer can stay focused on save/publish. -->
              <Section title="Actions">
                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <NuxtLink
                    v-if="editingMap.id"
                    :to="`/admin/premade/${editingMap.id}/style`"
                    class="admin-secondary text-center"
                  >
                    Open style editor
                  </NuxtLink>
                  <button class="admin-secondary" :disabled="generating" @click="generatePreview">
                    {{ generating ? 'Generating…' : 'Regenerate preview' }}
                  </button>
                  <button
                    v-if="editingMap.status !== 'archived'"
                    class="admin-danger"
                    :disabled="archiving"
                    @click="archivePremade"
                  >
                    {{ archiving ? 'Archiving…' : 'Archive' }}
                  </button>
                </div>
              </Section>
            </template>
          </div>

          <!-- Sticky footer — primary actions -->
          <footer class="shrink-0 border-t border-stone-200 bg-white/80 backdrop-blur px-5 sm:px-6 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button class="admin-secondary" type="button" @click="closePanel">
              {{ panelMode === 'create' ? 'Cancel' : 'Close' }}
            </button>
            <div v-if="panelMode === 'create'" class="flex items-center gap-2">
              <button class="admin-button" :disabled="creating || !newMapId" @click="createFromMap">
                {{ creating ? 'Creating draft…' : 'Create draft' }}
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <button class="admin-secondary" :disabled="saving" @click="savePanel">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
              <button
                v-if="editingMap?.status !== 'published'"
                class="admin-button"
                :disabled="publishing"
                @click="publishPanel"
              >
                {{ publishing ? 'Publishing…' : 'Save & publish' }}
              </button>
            </div>
          </footer>
        </aside>
      </div>
    </Teleport>
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { PremadeMap, PremadeStatus } from '~/types'
import { PREMADE_CATEGORIES } from '~/utils/premadeCatalog'

definePageMeta({ layout: 'default', middleware: 'auth' })

// ─── Data ──────────────────────────────────────────────────────────────────
// useLazyFetch so admin tab navigation isn't blocked on this round-trip —
// the page chrome paints first and the list streams in.
const { data: premades, refresh } = useLazyFetch<PremadeMap[]>('/api/admin/premade', {
  default: () => [],
})

// ─── Filtering & search ────────────────────────────────────────────────────
type StatusFilterId = 'all' | PremadeStatus | 'needs_preview'

const searchQuery = ref('')
const statusFilter = ref<StatusFilterId>('all')
const currentPage = ref(1)
const PAGE_SIZE = 12

const statusCounts = computed(() => {
  const counts = { all: premades.value.length, draft: 0, published: 0, archived: 0, needs_preview: 0 }
  for (const map of premades.value) {
    if (map.status === 'draft' || map.status === 'published' || map.status === 'archived') {
      counts[map.status] += 1
    } else {
      counts.draft += 1
    }
    if (map.needs_preview) counts.needs_preview += 1
  }
  return counts
})

const statusFilters = computed<Array<{ id: StatusFilterId; label: string; count?: number }>>(() => [
  { id: 'all', label: 'All', count: statusCounts.value.all },
  { id: 'draft', label: 'Drafts', count: statusCounts.value.draft },
  { id: 'published', label: 'Published', count: statusCounts.value.published },
  { id: 'needs_preview', label: 'Needs preview', count: statusCounts.value.needs_preview },
  { id: 'archived', label: 'Archived', count: statusCounts.value.archived },
])

function setStatusFilter(id: StatusFilterId) {
  statusFilter.value = id
  currentPage.value = 1
}

const filteredPremades = computed(() => {
  const term = searchQuery.value.trim().toLowerCase()
  return premades.value.filter((map) => {
    if (statusFilter.value === 'needs_preview') {
      if (!map.needs_preview) return false
    } else if (statusFilter.value !== 'all') {
      if ((map.status || 'draft') !== statusFilter.value) return false
    }
    if (!term) return true
    return [map.title, map.slug, map.region, map.country, map.location_label]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })
})

// Any change to the search query resets pagination to page 1; status filter
// changes already reset via `setStatusFilter`. Also clamp if the visible
// list ever shrinks past the current page (eg. archive a map mid-page).
watch(searchQuery, () => {
  currentPage.value = 1
})
watch(() => filteredPremades.value.length, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = Math.max(1, totalPages.value)
  }
})

// ─── Pagination ────────────────────────────────────────────────────────────
const totalPages = computed(() => Math.max(1, Math.ceil(filteredPremades.value.length / PAGE_SIZE)))
const pageStartIndex = computed(() => (currentPage.value - 1) * PAGE_SIZE)
const pageEndIndex = computed(() => Math.min(filteredPremades.value.length, pageStartIndex.value + PAGE_SIZE))
const pagedPremades = computed(() => filteredPremades.value.slice(pageStartIndex.value, pageEndIndex.value))

interface PageEntry { key: string; value: number | null }
const pageNumbers = computed<PageEntry[]>(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => ({ key: `p${i + 1}`, value: i + 1 }))
  }
  // Compact pagination: 1 … current-1 current current+1 … total
  const set = new Set<number>([1, total, current, current - 1, current + 1])
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: PageEntry[] = []
  let prev = 0
  for (const p of pages) {
    if (prev && p - prev > 1) out.push({ key: `gap-${prev}-${p}`, value: null })
    out.push({ key: `p${p}`, value: p })
    prev = p
  }
  return out
})

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  // Scroll the grid back to top on page change so the new page is in view.
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ─── Slide-out panel — shared between create + edit ────────────────────────
type PanelMode = 'create' | 'edit'
const panelOpen = ref(false)
const panelMounted = ref(false) // drives the slide-in transition after Teleport mounts
const panelMode = ref<PanelMode>('edit')
const editingId = ref<string | null>(null)

const editingMap = computed<PremadeMap | null>(() => {
  if (!editingId.value) return null
  return premades.value.find((map) => map.id === editingId.value) ?? null
})

// Per-map drafts persist across panel open/close so unsaved tweaks survive
// flipping between cards.
const drafts = reactive<Record<string, Partial<PremadeMap>>>({})

function draftForMap(map: PremadeMap): Partial<PremadeMap> {
  if (!map.id) return { ...map }
  if (!drafts[map.id]) {
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
  return drafts[map.id]
}

const panelDraft = computed(() => (editingMap.value ? draftForMap(editingMap.value) : null))

const panelTitle = computed(() => {
  if (panelMode.value === 'create') return 'Create a draft'
  return editingMap.value?.title || 'Untitled draft'
})

function openCreatePanel() {
  panelMode.value = 'create'
  editingId.value = null
  newMapId.value = ''
  createError.value = ''
  openPanel()
}

function openEditPanel(map: PremadeMap) {
  if (!map.id) return
  panelMode.value = 'edit'
  editingId.value = map.id
  // Prime the draft entry so the form has values immediately.
  draftForMap(map)
  saveStatus.value = ''
  openPanel()
}

function openPanel() {
  panelOpen.value = true
  // Force the slide-in transition: mount with translate-x-full, then flip
  // to translate-x-0 on the next frame.
  panelMounted.value = false
  nextTick(() => {
    panelMounted.value = true
  })
  // Stop the page from scrolling behind the drawer.
  if (import.meta.client) document.body.style.overflow = 'hidden'
}

function closePanel() {
  panelMounted.value = false
  // Wait for the transition before unmounting.
  setTimeout(() => {
    panelOpen.value = false
    editingId.value = null
    saveStatus.value = ''
    if (import.meta.client) document.body.style.overflow = ''
  }, 250)
}

// ESC closes the panel
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && panelOpen.value) closePanel()
}
onMounted(() => {
  if (import.meta.client) document.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKeyDown)
    document.body.style.overflow = ''
  }
})

// ─── Mutation state ────────────────────────────────────────────────────────
const newMapId = ref('')
const creating = ref(false)
const createError = ref('')
const saving = ref(false)
const publishing = ref(false)
const generating = ref(false)
const archiving = ref(false)
const backfilling = ref(false)
const saveStatus = ref('')
const saveStatusType = ref<'success' | 'error'>('success')

function flashStatus(message: string, type: 'success' | 'error' = 'success') {
  saveStatus.value = message
  saveStatusType.value = type
  setTimeout(() => {
    if (saveStatus.value === message) saveStatus.value = ''
  }, 3500)
}

async function createFromMap() {
  if (!newMapId.value) return
  creating.value = true
  createError.value = ''
  try {
    const created = await $fetch<PremadeMap>('/api/admin/premade/from-map', {
      method: 'POST',
      body: { map_id: newMapId.value },
    })
    await refresh()
    // Slide directly into edit mode for the newly created draft.
    if (created?.id) {
      panelMode.value = 'edit'
      editingId.value = created.id
      newMapId.value = ''
      flashStatus('Draft created — fill in the metadata below.', 'success')
    } else {
      closePanel()
    }
  } catch (err: any) {
    createError.value = err?.data?.message || err?.message || 'Could not create draft.'
  } finally {
    creating.value = false
  }
}

function normalisedDraftBody(): Partial<PremadeMap> | null {
  if (!editingId.value || !panelDraft.value) return null
  const draft = { ...panelDraft.value } as Record<string, any>
  for (const key of ['location_label', 'location_city', 'location_region', 'location_country']) {
    if (draft[key] === '') draft[key] = null
  }
  if (draft.location_lng === '' || draft.location_lng === undefined || Number.isNaN(draft.location_lng)) {
    draft.location_lng = null
  }
  if (draft.location_lat === '' || draft.location_lat === undefined || Number.isNaN(draft.location_lat)) {
    draft.location_lat = null
  }
  if (draft.preview_image_url === '') draft.preview_image_url = null
  if (draft.render_url === '') draft.render_url = null
  return draft as Partial<PremadeMap>
}

async function savePanel() {
  const id = editingId.value
  const body = normalisedDraftBody()
  if (!id || !body) return
  saving.value = true
  try {
    await $fetch('/api/admin/premade', { method: 'PATCH', body: { id, ...body } })
    await refresh()
    flashStatus('Saved.', 'success')
  } catch (err: any) {
    flashStatus(err?.data?.message || err?.message || 'Could not save changes.', 'error')
  } finally {
    saving.value = false
  }
}

async function publishPanel() {
  const id = editingId.value
  if (!id) return
  publishing.value = true
  try {
    // Save first so any in-flight edits land before publish validation runs.
    const body = normalisedDraftBody()
    if (body) {
      await $fetch('/api/admin/premade', { method: 'PATCH', body: { id, ...body } })
    }
    await $fetch(`/api/admin/premade/${id}/publish`, { method: 'POST' })
    await refresh()
    flashStatus('Published.', 'success')
  } catch (err: any) {
    flashStatus(err?.data?.message || err?.message || 'Could not publish.', 'error')
  } finally {
    publishing.value = false
  }
}

async function generatePreview() {
  const id = editingId.value
  if (!id) return
  generating.value = true
  try {
    await $fetch(`/api/admin/premade/${id}/generate-preview`, { method: 'POST' })
    await refresh()
    flashStatus('Preview regenerated.', 'success')
  } catch (err: any) {
    flashStatus(err?.data?.message || err?.message || 'Could not regenerate preview.', 'error')
  } finally {
    generating.value = false
  }
}

async function archivePremade() {
  const id = editingId.value
  if (!id) return
  archiving.value = true
  try {
    await $fetch('/api/admin/premade', {
      method: 'PATCH',
      body: { id, status: 'archived', homepage_visible: false },
    })
    await refresh()
    flashStatus('Archived.', 'success')
  } catch (err: any) {
    flashStatus(err?.data?.message || err?.message || 'Could not archive.', 'error')
  } finally {
    archiving.value = false
  }
}

async function backfillThumbnails() {
  backfilling.value = true
  try {
    await $fetch('/api/admin/premade/backfill-thumbnails', { method: 'POST', body: { limit: 5 } })
    await refresh()
  } finally {
    backfilling.value = false
  }
}

// ─── Display helpers ───────────────────────────────────────────────────────
function statusBadgeClass(status?: string) {
  if (status === 'published') return 'bg-green-100/90 text-green-800'
  if (status === 'archived') return 'bg-stone-200/90 text-stone-600'
  return 'bg-amber-100/90 text-amber-800'
}

function categoryLabel(id?: string) {
  if (!id) return 'Uncategorised'
  return PREMADE_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

// ─── Inline section component for the panel body ───────────────────────────
const Section = defineComponent({
  props: {
    title: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'rounded-xl border border-stone-200 bg-white p-4 sm:p-5' }, [
        h('p', {
          class: 'text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 mb-3',
        }, props.title),
        slots.default?.(),
      ])
  },
})
</script>

<style scoped>
.admin-label { display:block; margin-bottom:0.375rem; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:rgb(120 113 108); }
.admin-input { width:100%; border:1px solid rgb(231 229 228); border-radius:0.65rem; background:white; padding:0.65rem 0.8rem; font-size:0.875rem; color:rgb(28 25 23); }
.admin-input:focus { outline:none; border-color:rgb(120 113 108); box-shadow:0 0 0 3px rgba(120,113,108,0.12); }
.admin-button { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:rgb(28 25 23); color:white; padding:0.65rem 1rem; font-size:0.8rem; font-weight:700; transition:background-color 150ms ease; }
.admin-button:hover:not(:disabled) { background:rgb(41 37 36); }
.admin-button:disabled { opacity:0.55; }
.admin-secondary { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.6rem 1rem; font-size:0.8rem; font-weight:700; transition:background-color 150ms ease, border-color 150ms ease; }
.admin-secondary:hover:not(:disabled) { background:rgb(245 245 244); border-color:rgb(214 211 209); }
.admin-secondary:disabled { opacity:0.55; }
.admin-danger { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid rgb(254 202 202); background:white; color:rgb(220 38 38); padding:0.6rem 1rem; font-size:0.8rem; font-weight:700; transition:background-color 150ms ease; }
.admin-danger:hover:not(:disabled) { background:rgb(254 242 242); }
.admin-page-button { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:32px; padding:0 0.5rem; border-radius:0.5rem; font-size:0.75rem; font-weight:600; color:rgb(87 83 78); background:white; border:1px solid rgb(231 229 228); transition:background-color 120ms ease, color 120ms ease; }
.admin-page-button:hover:not(:disabled) { background:rgb(245 245 244); color:rgb(28 25 23); }
.admin-page-button:disabled { opacity:0.4; cursor:not-allowed; }
.admin-page-button-active { background:rgb(28 25 23) !important; color:white !important; border-color:rgb(28 25 23) !important; }
.line-clamp-2 { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
</style>
