<template>
  <div class="shop-wall relative min-h-[100dvh]">

    <!-- gallery wall texture -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:220px"
    />
    <!-- ambient overhead gallery light -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-[60vh]"
      style="background:radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,247,230,0.55), rgba(255,247,230,0) 70%)"
    />
    <!-- wall-to-floor shadow at the bottom -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-40"
      style="background:linear-gradient(to top, rgba(58,42,28,0.10), rgba(58,42,28,0))"
    />

    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

      <!-- ═══════════════════════════════════════════════════════════════
           EDITORIAL HEADER
           ═══════════════════════════════════════════════════════════════ -->
      <header class="mb-14">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">
            Shop · Premade Prints
          </span>
          <span class="h-px flex-1 w-16 bg-stone-300/70" />
        </div>

        <h1
          class="text-[48px] sm:text-[64px] leading-[1.02] tracking-tight text-stone-900 max-w-3xl"
          style="font-family:'Playfair Display',serif"
        >
          Iconic maps, <em class="not-italic text-[#2D6A4F]">framed for you.</em>
        </h1>
        <p class="text-[15px] sm:text-base text-stone-500 mt-4 max-w-xl leading-relaxed">
          A curated collection of the world's greatest routes — printed on 170 gsm archival paper
          and shipped to your door. Ready to hang, no upload needed.
        </p>

        <!-- Tiny reassurance strip -->
        <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium tracking-wide text-stone-500">
          <span class="inline-flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            No account required
          </span>
          <span class="inline-flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3V3a1 1 0 00-1-1z"/>
            </svg>
            Printed on-demand
          </span>
          <span class="inline-flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 9l3-7h4l3 7v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"/>
            </svg>
            Ships worldwide
          </span>
        </div>
      </header>

      <!-- ═══════════════════════════════════════════════════════════════
           CREATE YOUR OWN — guest callout
           ═══════════════════════════════════════════════════════════════ -->
      <div v-if="!user" class="mb-12 flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/[0.05] px-6 py-5 sm:px-8 sm:py-6">
        <div class="flex-1 min-w-0">
          <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F] mb-1.5">Custom Maps</p>
          <h2
            class="text-lg sm:text-xl font-semibold text-stone-900 leading-snug tracking-tight"
            style="font-family:'Space Grotesk',sans-serif"
          >
            Got a GPS track? Turn it into wall art.
          </h2>
          <p class="text-sm text-stone-500 mt-1 leading-relaxed">
            Upload a GPX from Strava, Garmin, or any app — design a print-quality poster in minutes. Free to try, pay only if you order.
          </p>
        </div>
        <NuxtLink to="/auth/login?mode=signup" class="shrink-0">
          <button class="inline-flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#235840] text-white font-semibold px-5 py-3 rounded-full text-sm transition-colors shadow-sm shadow-[#2D6A4F]/20 whitespace-nowrap">
            Start designing free
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </button>
        </NuxtLink>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           CATEGORY FILTER
           ═══════════════════════════════════════════════════════════════ -->
      <form class="mb-4 flex flex-col gap-3 rounded-xl border border-stone-300/70 bg-white/60 backdrop-blur-sm p-3 sm:flex-row sm:items-center shadow-sm shadow-stone-900/[0.03]" @submit.prevent="searchByPlace">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search by location</span>
          <input
            v-model="searchText"
            class="w-full rounded-lg border border-stone-200 bg-white/90 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/15"
            placeholder="Search by city, park, state, or country"
          />
        </label>
        <div class="flex shrink-0 gap-2">
          <button
            class="rounded-lg bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-stone-800 disabled:opacity-60"
            :disabled="pending"
            type="submit"
          >
            {{ pending && searchMode === 'place' ? 'Searching...' : 'Search' }}
          </button>
          <button
            class="rounded-lg border border-stone-200 bg-white/90 px-3.5 py-2.5 text-xs font-bold text-stone-700 transition-colors hover:border-stone-300 hover:text-stone-900 disabled:opacity-60"
            :disabled="pending"
            type="button"
            @click="useNearbyLocation"
          >
            {{ pending && searchMode === 'near-me' ? 'Locating...' : 'Near me' }}
          </button>
          <button
            v-if="locationSearchActive"
            class="rounded-lg border border-stone-200 bg-white/90 px-3.5 py-2.5 text-xs font-bold text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-900"
            type="button"
            @click="clearLocationSearch"
          >
            Clear
          </button>
        </div>
      </form>
      <p v-if="searchNotice" class="mb-4 text-xs text-stone-500">{{ searchNotice }}</p>

      <nav aria-label="Filter by collection" class="mb-12">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-500">
            Browse the collection
          </span>
          <span class="h-px flex-1 bg-stone-300/60" />
        </div>
        <div class="relative -mx-4 sm:mx-0">
          <ul class="flex flex-nowrap sm:flex-wrap items-center gap-x-1 gap-y-2 overflow-x-auto sm:overflow-visible px-4 sm:px-0 pb-1 scrollbar-none">
            <li class="shrink-0">
              <button
                type="button"
                @click="activeCategory = null"
                :class="[
                  'group/cat relative inline-flex items-baseline gap-1.5 px-3 py-1.5 text-[12px] tracking-wide transition-colors whitespace-nowrap',
                  activeCategory === null
                    ? 'text-stone-900 font-semibold'
                    : 'text-stone-500 hover:text-stone-900 font-medium',
                ]"
              >
                All prints
                <span class="text-[10px] tabular-nums opacity-60">{{ allCount }}</span>
                <span
                  aria-hidden="true"
                  :class="[
                    'absolute inset-x-2 -bottom-0.5 h-px transition-colors',
                    activeCategory === null ? 'bg-stone-900' : 'bg-transparent group-hover/cat:bg-stone-300',
                  ]"
                />
              </button>
            </li>
            <li v-for="cat in visibleCategories" :key="cat.id" class="shrink-0 flex items-center">
              <span aria-hidden="true" class="text-stone-300 select-none px-0.5">·</span>
              <button
                type="button"
                @click="activeCategory = activeCategory === cat.id ? null : cat.id"
                :class="[
                  'group/cat relative inline-flex items-baseline gap-1.5 px-3 py-1.5 text-[12px] tracking-wide transition-colors whitespace-nowrap',
                  activeCategory === cat.id
                    ? 'text-stone-900 font-semibold'
                    : 'text-stone-500 hover:text-stone-900 font-medium',
                ]"
              >
                {{ cat.label }}
                <span class="text-[10px] tabular-nums opacity-60">{{ countByCategory(cat.id) }}</span>
                <span
                  aria-hidden="true"
                  :class="[
                    'absolute inset-x-2 -bottom-0.5 h-px transition-colors',
                    activeCategory === cat.id ? 'bg-stone-900' : 'bg-transparent group-hover/cat:bg-stone-300',
                  ]"
                />
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <!-- ═══════════════════════════════════════════════════════════════
           GRID — framed posters mounted on the wall
           ═══════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 sm:gap-x-12 gap-y-16 sm:gap-y-20">
        <NuxtLink
          v-for="map in filteredMaps"
          :key="map.slug"
          :to="`/shop/${map.slug}`"
          class="frame-mount group block"
        >
          <!-- Picture-hanging hardware -->
          <div aria-hidden="true" class="hanger-wire" />
          <div aria-hidden="true" class="hanger-nail" />

          <!-- Outer frame (matte black with subtle bevel) -->
          <div class="frame relative">
            <!-- inner frame bevel highlight -->
            <div aria-hidden="true" class="frame-bevel" />

            <!-- Matboard -->
            <div class="mat">
              <!-- Poster itself -->
              <div
                class="poster relative overflow-hidden"
                style="aspect-ratio:2/3"
                :style="{ backgroundColor: map.style_config?.background_color || '#F7F4EF' }"
              >
                <!-- Real pre-rendered image if available -->
                <img
                  v-if="map.preview_image_url"
                  :src="map.preview_image_url"
                  :alt="map.title"
                  class="w-full h-full object-cover"
                />

                <!-- Otherwise: render the stylised poster preview inline -->
                <div v-else class="absolute inset-0 flex flex-col">
                  <!-- title band -->
                  <div
                    class="px-3 pt-3 pb-1.5 text-center shrink-0"
                    :style="{
                      backgroundColor: map.style_config?.label_bg_color || map.style_config?.background_color,
                      color: map.style_config?.label_text_color || '#1C1917',
                    }"
                  >
                    <p
                      class="text-[10px] font-bold tracking-[0.18em] uppercase truncate leading-tight"
                      :style="{ fontFamily: `'${map.style_config?.font_family || 'Space Grotesk'}', sans-serif` }"
                    >{{ map.title }}</p>
                  </div>
                  <!-- map area -->
                  <div class="flex-1 relative overflow-hidden">
                    <svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid meet" class="absolute inset-0 w-full h-full">
                      <!-- subtle contour lines -->
                      <g :stroke="map.style_config?.contour_color || '#C8BDB0'" stroke-width="0.3" fill="none" opacity="0.55">
                        <path d="M-5 28 Q25 23 50 30 T105 26" />
                        <path d="M-5 48 Q20 42 50 50 T105 46" />
                        <path d="M-5 68 Q30 62 50 70 T105 66" />
                        <path d="M-5 88 Q25 82 50 90 T105 86" />
                        <path d="M-5 108 Q30 102 50 110 T105 106" />
                      </g>
                      <path
                        v-if="routePath(map)"
                        :d="routePath(map)"
                        fill="none"
                        :stroke="map.style_config?.route_color || '#C1121F'"
                        stroke-width="1.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        :opacity="map.style_config?.route_opacity ?? 0.95"
                      />
                      <template v-if="routeEndpoints(map)">
                        <circle
                          :cx="routeEndpoints(map)!.start[0]"
                          :cy="routeEndpoints(map)!.start[1]"
                          r="1.3"
                          :fill="map.style_config?.route_color || '#C1121F'"
                        />
                        <circle
                          :cx="routeEndpoints(map)!.end[0]"
                          :cy="routeEndpoints(map)!.end[1]"
                          r="1.3"
                          fill="white"
                          :stroke="map.style_config?.route_color || '#C1121F'"
                          stroke-width="0.6"
                        />
                      </template>
                    </svg>
                  </div>
                  <!-- footer band -->
                  <div
                    class="px-3 py-1.5 text-center shrink-0"
                    :style="{
                      backgroundColor: map.style_config?.label_bg_color || map.style_config?.background_color,
                      color: map.style_config?.label_text_color || '#1C1917',
                    }"
                  >
                    <p class="text-[7px] font-semibold tracking-[0.25em] uppercase opacity-70 truncate">
                      {{ formatKm(map.stats.distance_km) }} · {{ formatM(map.stats.elevation_gain_m) }} ↑
                    </p>
                  </div>
                </div>

                <!-- specular glass highlight -->
                <div aria-hidden="true" class="glass-glint" />

                <!-- Badges -->
                <div v-if="map.badges?.length" class="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
                  <span
                    v-for="b in map.badges"
                    :key="b"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.14em] bg-white/90 text-stone-800 backdrop-blur"
                  >{{ b }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Museum placard -->
          <div class="mt-6 text-center px-2">
            <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-500 mb-1.5">
              {{ map.region }}<span v-if="formatDistance(map)" class="text-[#2D6A4F]"> · {{ formatDistance(map) }}</span>
            </p>
            <h3
              class="text-[17px] sm:text-lg font-semibold text-stone-900 leading-snug tracking-tight truncate group-hover:text-[#2D6A4F] transition-colors"
              style="font-family:'Playfair Display',serif"
            >{{ map.title }}</h3>
            <p v-if="map.tagline" class="text-[13px] italic text-stone-500 mt-1 truncate" style="font-family:'Playfair Display',serif">{{ map.tagline }}</p>
            <p class="mt-3 text-[11px] font-semibold tracking-[0.22em] uppercase text-stone-700">
              from {{ formatPrice(map.base_price_cents) }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- Empty filter state -->
      <div v-if="filteredMaps.length === 0" class="text-center py-20 border border-dashed border-stone-400/40 rounded-2xl bg-white/30 backdrop-blur-sm mt-8">
        <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-500 mb-2">An empty wall</p>
        <p class="text-sm text-stone-600" style="font-family:'Playfair Display',serif">No prints in this collection yet.</p>
        <button
          @click="activeCategory = null"
          class="mt-3 text-xs font-semibold text-[#2D6A4F] hover:underline"
        >Show all prints</button>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           CTA — make your own
           ═══════════════════════════════════════════════════════════════ -->
      <section class="mt-20 relative overflow-hidden rounded-3xl bg-stone-900 text-white p-10 sm:p-14">
        <!-- topo lines texture -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 800 400" preserveAspectRatio="none">
          <g stroke="#52B788" stroke-width="1" fill="none">
            <path d="M0 100 Q200 80 400 100 T800 90" />
            <path d="M0 150 Q200 130 400 150 T800 140" />
            <path d="M0 200 Q200 180 400 200 T800 190" />
            <path d="M0 250 Q200 230 400 250 T800 240" />
            <path d="M0 300 Q200 280 400 300 T800 290" />
            <path d="M0 350 Q200 330 400 350 T800 340" />
          </g>
        </svg>
        <div class="relative max-w-xl">
          <p class="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#52B788] mb-3">
            Or make one from your own trail
          </p>
          <h2 class="text-3xl sm:text-4xl leading-tight tracking-tight mb-4" style="font-family:'Playfair Display',serif">
            Your route, your poster.
          </h2>
          <p class="text-white/60 mb-6 leading-relaxed">
            Bring your route from Strava, your watch, or any tracking app — we'll turn it into a
            museum-quality print styled exactly how you want. Free to design, pay only if you print.
          </p>
          <div class="flex flex-wrap gap-3">
            <NuxtLink :to="user ? '/create' : '/auth/login?mode=signup'">
              <button class="inline-flex items-center gap-2 bg-[#52B788] hover:bg-[#63C99A] text-stone-900 font-semibold px-5 py-3 rounded-full text-sm transition-colors">
                {{ user ? 'Create a custom map' : 'Start designing free' }}
                <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </button>
            </NuxtLink>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useSupabaseUser } from '#imports'
import type { PremadeMap } from '~/types'
import { PREMADE_CATEGORIES, isPremadeCategory, premadeHasCategory } from '~/utils/premadeCatalog'
import { formatPrice } from '~/utils/products'

const user = useSupabaseUser()
const route = useRoute()
const searchText = ref('')
const searchMode = ref<'place' | 'near-me' | null>(null)
const searchNotice = ref('')
const locationSearchActive = ref(false)
const searchParams = ref<Record<string, string | number>>({})
const { data: premadeMaps, pending, refresh } = await useFetch<PremadeMap[]>('/api/premade', {
  query: searchParams,
  default: () => [],
})

function readCategoryFromQuery(value: unknown): PremadeMap['category'] | null {
  const raw = Array.isArray(value) ? value[0] : value
  return isPremadeCategory(raw) ? raw : null
}

const activeCategory = ref<PremadeMap['category'] | null>(readCategoryFromQuery(route.query.category))

watch(() => route.query.category, (next) => {
  activeCategory.value = readCategoryFromQuery(next)
})

const allCount = computed(() => premadeMaps.value.length)

const filteredMaps = computed(() => {
  if (activeCategory.value) {
    return premadeMaps.value.filter((m) => premadeHasCategory(m, activeCategory.value!))
  }
  if (locationSearchActive.value) {
    return premadeMaps.value
  }
  if (!activeCategory.value) {
    // Sort featured first, then by title
    return [...premadeMaps.value].sort((a, b) => Number(b.featured) - Number(a.featured))
  }
  return premadeMaps.value
})

function countByCategory(id: PremadeMap['category']) {
  return premadeMaps.value.filter((m) => premadeHasCategory(m, id)).length
}

const formatKm = (km?: number) => {
  if (km == null) return '—'
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

const formatM = (m?: number) => {
  if (m == null) return '—'
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

const formatDistance = (map: PremadeMap) => {
  if (typeof map.distance_meters !== 'number') return ''
  const miles = map.distance_meters / 1609.344
  return miles < 10 ? `${miles.toFixed(1)} mi away` : `${Math.round(miles)} mi away`
}

async function searchByPlace() {
  const q = searchText.value.trim()
  if (!q) {
    await clearLocationSearch()
    return
  }
  searchMode.value = 'place'
  searchNotice.value = ''
  locationSearchActive.value = true
  searchParams.value = { q }
  await refresh()
  if (premadeMaps.value.length === 0) {
    searchNotice.value = 'No nearby premade maps found for that location yet.'
  } else if (!premadeMaps.value.some((map) => typeof map.distance_meters === 'number')) {
    searchNotice.value = 'Could not locate that place precisely, so the full catalog is shown.'
  }
}

async function useNearbyLocation() {
  if (!navigator.geolocation) {
    searchNotice.value = 'Location access is not available in this browser.'
    return
  }
  searchMode.value = 'near-me'
  searchNotice.value = ''
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      })
    })
    locationSearchActive.value = true
    searchParams.value = {
      lat: Number(position.coords.latitude.toFixed(6)),
      lng: Number(position.coords.longitude.toFixed(6)),
      radius_km: 250,
    }
    await refresh()
    if (premadeMaps.value.length === 0) {
      searchNotice.value = 'No premade maps found near your location yet.'
    }
  } catch {
    searchMode.value = null
    searchNotice.value = 'Could not access your location. The full catalog is still shown.'
    searchParams.value = {}
    locationSearchActive.value = false
    await refresh()
  }
}

async function clearLocationSearch() {
  searchText.value = ''
  searchMode.value = null
  searchNotice.value = ''
  locationSearchActive.value = false
  searchParams.value = {}
  await refresh()
}

// ─── Route path SVG helpers ──────────────────────────────────────────────
function extractCoords(map: PremadeMap): number[][] | null {
  const feat = map.geojson?.features?.[0]
  if (!feat) return null
  const g = feat.geometry as any
  if (!g) return null
  if (g.type === 'LineString') return g.coordinates as number[][]
  if (g.type === 'MultiLineString') return (g.coordinates as number[][][]).flat()
  return null
}

function projectCoords(map: PremadeMap): { x: number; y: number }[] | null {
  const coords = extractCoords(map)
  if (!coords || coords.length < 2) return null
  const [minLng, minLat, maxLng, maxLat] = map.bbox
  const lngRange = (maxLng - minLng) || 0.0001
  const latRange = (maxLat - minLat) || 0.0001
  const padX = 5, padTop = 20, padBottom = 20
  const availW = 100 - padX * 2
  const availH = 133 - padTop - padBottom
  const scale = Math.min(availW / lngRange, availH / latRange)
  const offsetX = padX + (availW - lngRange * scale) / 2
  const offsetY = padTop + (availH - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coords.length / 120))
  const result: { x: number; y: number }[] = []
  for (let i = 0; i < coords.length; i += stride) {
    const [lng, lat] = coords[i]
    result.push({
      x: offsetX + (lng - minLng) * scale,
      y: offsetY + (maxLat - lat) * scale,
    })
  }
  const last = coords[coords.length - 1]
  result.push({
    x: offsetX + (last[0] - minLng) * scale,
    y: offsetY + (maxLat - last[1]) * scale,
  })
  return result
}

function routePath(map: PremadeMap): string {
  const pts = projectCoords(map)
  if (!pts) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}

function routeEndpoints(map: PremadeMap): { start: [number, number]; end: [number, number] } | null {
  const pts = projectCoords(map)
  if (!pts || pts.length < 2) return null
  return { start: [pts[0].x, pts[0].y], end: [pts[pts.length - 1].x, pts[pts.length - 1].y] }
}

const visibleCategories = computed(() =>
  PREMADE_CATEGORIES.filter((cat) => countByCategory(cat.id) > 0),
)
</script>

<style scoped>
.shop-wall {
  background:
    linear-gradient(180deg, #EDE5D5 0%, #E4DBC8 55%, #DBD0B8 100%);
}

.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { scrollbar-width: none; }

/* ── Framed poster mounting ───────────────────────────────────────────── */
.frame-mount {
  position: relative;
  padding-top: 22px; /* room for hanging hardware */
}

.hanger-nail {
  position: absolute;
  top: 6px;
  left: 50%;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #c7b9a3 0%, #6e5d46 65%, #3b3024 100%);
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.12);
  z-index: 2;
}

.hanger-wire {
  position: absolute;
  top: 11px;
  left: 22%;
  right: 22%;
  height: 16px;
  border-top: 1px solid rgba(58, 42, 28, 0.55);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.7;
}

.frame {
  background:
    linear-gradient(180deg, #2a2520 0%, #1a1612 50%, #0f0c09 100%);
  padding: 10px;
  border-radius: 2px;
  box-shadow:
    /* contact shadow */
    0 2px 3px rgba(28, 22, 16, 0.35),
    /* soft mid shadow */
    0 14px 24px -10px rgba(28, 22, 16, 0.45),
    /* large ambient shadow on the wall */
    0 30px 50px -18px rgba(28, 22, 16, 0.55),
    /* inner top-rim highlight */
    inset 0 1px 0 rgba(255, 246, 230, 0.08),
    /* inner bottom shadow */
    inset 0 -1px 0 rgba(0, 0, 0, 0.5);
  transform-origin: 50% 0%;
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 500ms ease;
  will-change: transform;
}

.frame-bevel {
  position: absolute;
  inset: 4px;
  border-radius: 1px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 246, 230, 0.06),
    inset 0 1px 2px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.mat {
  position: relative;
  background:
    radial-gradient(120% 90% at 50% 0%, #FBFAF4 0%, #F1ECDF 100%);
  padding: 14px;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    inset 0 2px 4px rgba(0, 0, 0, 0.10),
    inset 0 -1px 0 rgba(255, 255, 255, 0.6);
}

.poster {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.18);
}

/* specular highlight to imply glazing */
.glass-glint {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 18%, rgba(255,255,255,0) 38%);
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.7;
  transition: opacity 500ms ease;
}

/* hover: gently lifts off the wall */
.frame-mount:hover .frame {
  transform: translateY(-4px) rotate(0.15deg);
  box-shadow:
    0 3px 4px rgba(28, 22, 16, 0.32),
    0 22px 34px -12px rgba(28, 22, 16, 0.5),
    0 44px 70px -22px rgba(28, 22, 16, 0.55),
    inset 0 1px 0 rgba(255, 246, 230, 0.10),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5);
}
.frame-mount:hover .glass-glint { opacity: 0.95; }

@media (prefers-reduced-motion: reduce) {
  .frame { transition: none; }
  .frame-mount:hover .frame { transform: none; }
}

@media (max-width: 640px) {
  .frame { padding: 8px; }
  .mat { padding: 10px; }
  .hanger-wire { left: 28%; right: 28%; }
}
</style>
