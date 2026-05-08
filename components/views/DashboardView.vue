<template>
  <div class="relative">

    <!-- subtle paper texture over cream background -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

      <!-- ═══════════════════════════════════════════════════════════════
           EDITORIAL HEADER
           ═══════════════════════════════════════════════════════════════ -->
      <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-400">
              {{ todayLabel }}
            </span>
            <span class="h-px flex-1 w-10 bg-stone-300/70" />
          </div>
          <h1
            class="text-[44px] sm:text-[56px] leading-[1.02] tracking-tight text-stone-900"
            style="font-family:'Playfair Display',serif"
          >
            <template v-if="firstName">Welcome back, <em class="not-italic text-[#2D6A4F]">{{ firstName }}</em>.</template>
            <template v-else>Your trail studio.</template>
          </h1>
          <p class="text-[15px] text-stone-500 mt-2 max-w-lg">
            Every route is a story. Frame yours as a poster worth hanging.
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink to="/create">
            <button class="group inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5 rounded-full transition-all shadow-sm shadow-stone-900/10">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
              </svg>
              New Map
              <svg class="w-3.5 h-3.5 -mr-0.5 opacity-50 group-hover:translate-x-0.5 group-hover:opacity-90 transition-all" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </NuxtLink>
        </div>
      </header>

      <!-- ═══════════════════════════════════════════════════════════════
           STATS STRIP
           ═══════════════════════════════════════════════════════════════ -->
      <section
        class="grid grid-cols-2 md:grid-cols-4 border border-stone-200 rounded-2xl overflow-hidden bg-white/60 backdrop-blur-sm mb-12 divide-y divide-stone-200 md:divide-y-0 md:divide-x"
      >
        <StatCell
          label="Posters"
          :value="stats.posters"
          suffix=""
          icon="poster"
          :loading="loading"
        />
        <StatCell
          label="Distance"
          :value="stats.distanceKm"
          :decimals="1"
          suffix="km"
          icon="compass"
          :loading="loading"
        />
        <StatCell
          label="Elevation"
          :value="stats.elevationM"
          suffix="m"
          icon="mountain"
          :loading="loading"
        />
        <StatCell
          label="Ordered"
          :value="stats.orders"
          suffix=""
          icon="package"
          :loading="loading"
        />
      </section>

      <!-- ═══════════════════════════════════════════════════════════════
           TAB BAR + CONTROLS
           ═══════════════════════════════════════════════════════════════ -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2
            class="text-xl font-semibold tracking-tight text-stone-900 mb-3"
            style="font-family:'Space Grotesk',sans-serif"
          >
            Your collection
          </h2>
          <div class="flex items-center gap-1 border-b border-stone-200">
            <FilterTab
              v-for="f in filters"
              :key="f.id"
              :label="f.label"
              :count="countByStatus(f.id)"
              :active="activeFilter === f.id"
              @click="activeFilter = f.id"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Sort -->
          <div class="relative">
            <select
              v-model="sortBy"
              class="appearance-none text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-full pl-3 pr-8 py-2 hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 focus:border-[#2D6A4F]/40 cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="az">Title A–Z</option>
              <option value="distance">Longest distance</option>
            </select>
            <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 5l3 3 3-3"/>
            </svg>
          </div>
          <!-- View toggle -->
          <div class="flex items-center rounded-full border border-stone-200 bg-white p-0.5">
            <button
              @click="view = 'grid'"
              :class="[
                'p-1.5 rounded-full transition-colors',
                view === 'grid' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700',
              ]"
              aria-label="Grid view"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <rect x="3" y="3" width="6" height="6" rx="1"/>
                <rect x="11" y="3" width="6" height="6" rx="1"/>
                <rect x="3" y="11" width="6" height="6" rx="1"/>
                <rect x="11" y="11" width="6" height="6" rx="1"/>
              </svg>
            </button>
            <button
              @click="view = 'list'"
              :class="[
                'p-1.5 rounded-full transition-colors',
                view === 'list' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-700',
              ]"
              aria-label="List view"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <rect x="3" y="4" width="14" height="2" rx="1"/>
                <rect x="3" y="9" width="14" height="2" rx="1"/>
                <rect x="3" y="14" width="14" height="2" rx="1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           CONTENT
           ═══════════════════════════════════════════════════════════════ -->

      <!-- Loading skeleton -->
      <div v-if="loading">
        <div v-if="view === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="i in 6" :key="i" class="animate-pulse">
            <div class="bg-stone-200/70 rounded-xl" style="aspect-ratio:2/3" />
            <div class="h-3 bg-stone-200/70 rounded mt-4 w-2/3" />
            <div class="h-2.5 bg-stone-200/60 rounded mt-2 w-1/3" />
          </div>
        </div>
        <div v-else class="space-y-3">
          <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-stone-200 p-4 flex gap-4 animate-pulse">
            <div class="w-14 shrink-0 rounded-lg bg-stone-100" style="aspect-ratio:2/3" />
            <div class="flex-1 py-1 space-y-2.5">
              <div class="h-4 bg-stone-100 rounded w-1/2" />
              <div class="h-3 bg-stone-100 rounded w-1/3" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="maps.length === 0" class="text-center py-24 border border-dashed border-stone-300 rounded-3xl bg-white/40">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-stone-900 mb-6 shadow-lg shadow-stone-900/10">
          <svg class="w-10 h-10 text-[#52B788]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.15"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            <circle cx="11" cy="8" r="1.3" fill="currentColor"/>
          </svg>
        </div>
        <h3 class="text-2xl font-semibold text-stone-900 mb-2" style="font-family:'Playfair Display',serif">
          The studio is quiet.
        </h3>
        <p class="text-sm text-stone-500 mb-8 max-w-sm mx-auto leading-relaxed">
          Connect Strava or upload a route from your watch to print your first poster — museum paper, shipped worldwide.
        </p>
        <div class="flex flex-wrap gap-2 justify-center">
          <NuxtLink to="/create">
            <button class="inline-flex items-center gap-2 text-sm font-semibold bg-stone-900 hover:bg-stone-800 text-white px-5 py-3 rounded-full transition-colors shadow-sm shadow-stone-900/10">
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/>
              </svg>
              Create your first map
            </button>
          </NuxtLink>
          <NuxtLink to="/api/strava/connect">
            <button class="inline-flex items-center gap-2 text-sm font-semibold bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 px-5 py-3 rounded-full transition-colors">
              <svg class="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              Import from Strava
            </button>
          </NuxtLink>
        </div>
      </div>

      <!-- No results for this filter -->
      <div v-else-if="filteredMaps.length === 0" class="text-center py-20 border border-dashed border-stone-300 rounded-2xl bg-white/40">
        <p class="text-sm text-stone-500">No {{ activeFilter }} maps yet.</p>
        <button
          @click="activeFilter = 'all'"
          class="mt-3 text-xs font-semibold text-[#2D6A4F] hover:underline"
        >Show all maps</button>
      </div>

      <!-- GRID VIEW -->
      <div v-else-if="view === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
        <div
          v-for="map in filteredMaps"
          :key="map.id"
          class="group block cursor-pointer"
          role="link"
          tabindex="0"
          @click="openMap(map)"
          @keydown.enter.prevent="openMap(map)"
          @keydown.space.prevent="openMap(map)"
        >
          <!-- Poster card -->
          <NuxtLink
            :to="`/create/${map.id}/style`"
            class="block relative rounded-xl overflow-hidden shadow-sm group-hover:shadow-xl group-hover:-translate-y-0.5 transition-all duration-300 border border-stone-900/5"
            style="aspect-ratio:2/3"
            :style="{ backgroundColor: map.style_config?.background_color || '#F7F4EF' }"
          >
            <!-- Real thumbnail if available -->
            <img
              v-if="posterThumbnailUrl(map)"
              :src="posterThumbnailUrl(map)!"
              :alt="map.title"
              class="w-full h-full object-cover"
            />

            <!-- Otherwise: render a stylised poster preview -->
            <div v-else class="absolute inset-0 flex flex-col">
              <!-- title band -->
              <div
                class="px-3 pt-3 pb-1.5 text-center shrink-0"
                :style="{
                  backgroundColor: map.style_config?.label_bg_color || map.style_config?.background_color || '#F7F4EF',
                  color: map.style_config?.label_text_color || '#1C1917',
                }"
              >
                <p
                  class="text-[9px] font-bold tracking-[0.18em] uppercase truncate leading-tight opacity-90"
                  :style="{ fontFamily: `'${map.style_config?.font_family || 'Space Grotesk'}', sans-serif` }"
                >{{ (map.style_config?.trail_name || map.title).slice(0, 28) }}</p>
              </div>
              <!-- map area -->
              <div class="flex-1 relative overflow-hidden">
                <svg
                  viewBox="0 0 100 133"
                  preserveAspectRatio="xMidYMid meet"
                  class="absolute inset-0 w-full h-full"
                >
                  <!-- topographic contour lines -->
                  <g :stroke="map.style_config?.contour_color || '#C8BDB0'" stroke-width="0.3" fill="none" opacity="0.5">
                    <path d="M-5 30 Q25 25 50 32 T105 28" />
                    <path d="M-5 50 Q20 44 50 52 T105 48" />
                    <path d="M-5 70 Q30 64 50 72 T105 68" />
                    <path d="M-5 90 Q25 84 50 92 T105 88" />
                    <path d="M-5 110 Q30 104 50 112 T105 108" />
                  </g>
                  <!-- Lightweight fallback mark. Real route geometry is intentionally not loaded in the dashboard list. -->
                  <path
                    d="M22 91 C31 75 43 82 50 65 S66 38 80 43"
                    fill="none"
                    :stroke="map.style_config?.route_color || '#C1121F'"
                    stroke-width="1.3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :opacity="map.style_config?.route_opacity ?? 0.95"
                  />
                  <!-- start / finish pins -->
                  <circle cx="22" cy="91" r="1.2" :fill="map.style_config?.route_color || '#C1121F'" />
                  <circle cx="80" cy="43" r="1.2" fill="white" :stroke="map.style_config?.route_color || '#C1121F'" stroke-width="0.6" />
                </svg>
              </div>
              <!-- footer band -->
              <div
                class="px-3 py-1.5 text-center shrink-0"
                :style="{
                  backgroundColor: map.style_config?.label_bg_color || map.style_config?.background_color || '#F7F4EF',
                  color: map.style_config?.label_text_color || '#1C1917',
                }"
              >
                <p class="text-[7px] font-semibold tracking-[0.25em] uppercase opacity-70 truncate">
                  {{ formatKm(map.stats?.distance_km) }} · {{ formatM(map.stats?.elevation_gain_m) }} ↑
                </p>
              </div>
            </div>

            <!-- Hover overlay actions -->
            <div class="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/40 to-transparent pointer-events-none">
              <div class="flex items-center gap-1.5 pointer-events-auto">
                <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm">
                  Open →
                </span>
              </div>
            </div>
          </NuxtLink>

          <!-- Metadata below card -->
          <div class="mt-4 px-0.5">
            <div class="flex items-start justify-between gap-2 mb-1">
              <NuxtLink
                :to="`/create/${map.id}/style`"
                class="font-semibold text-stone-900 text-[15px] leading-tight truncate tracking-tight"
                style="font-family:'Space Grotesk',sans-serif"
              >{{ map.title }}</NuxtLink>
              <button
                type="button"
                class="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-300 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-colors"
                :disabled="deletingMapId === map.id"
                :title="map.status === 'ordered' ? 'Ordered maps are kept with order history' : `Delete ${map.title}`"
                :aria-label="`Delete ${map.title}`"
                @click.stop="requestDeleteMap(map)"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8 2a1 1 0 00-.894.553L6.382 4H3a1 1 0 000 2h.293l.853 10.24A2 2 0 006.139 18h7.722a2 2 0 001.993-1.76L16.707 6H17a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0012 2H8zm1.618 2h4.764l-.5-1h-3.764l-.5 1zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
            <p class="text-[12px] text-stone-500 font-medium tracking-wide">
              {{ formatKm(map.stats?.distance_km) }}
              <span class="text-stone-300 mx-1">·</span>
              {{ formatM(map.stats?.elevation_gain_m) }} ↑
              <span class="text-stone-300 mx-1">·</span>
              {{ formatDate(map.created_at) }}
            </p>
          </div>
        </div>
      </div>

      <!-- LIST VIEW -->
      <div v-else class="space-y-3">
        <div
          v-for="map in filteredMaps"
          :key="map.id"
          class="group bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
          role="link"
          tabindex="0"
          @click="openMap(map)"
          @keydown.enter.prevent="openMap(map)"
          @keydown.space.prevent="openMap(map)"
        >
          <!-- Mini poster thumbnail -->
          <NuxtLink
            :to="`/create/${map.id}/style`"
            class="w-16 shrink-0 rounded-lg overflow-hidden border border-stone-100 relative"
            style="aspect-ratio:2/3"
          >
            <img
              v-if="posterThumbnailUrl(map)"
              :src="posterThumbnailUrl(map)!"
              :alt="map.title"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full"
              :style="{ backgroundColor: map.style_config?.background_color ?? '#F7F4EF' }"
            >
              <svg viewBox="0 0 100 133" class="w-full h-full">
                <path
                  d="M22 91 C31 75 43 82 50 65 S66 38 80 43"
                  fill="none"
                  :stroke="map.style_config?.route_color || '#C1121F'"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </NuxtLink>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 min-w-0">
              <NuxtLink
                :to="`/create/${map.id}/style`"
                class="font-semibold text-stone-900 truncate text-sm leading-tight hover:text-[#2D6A4F] transition-colors"
                style="font-family:'Space Grotesk',sans-serif"
              >{{ map.title }}</NuxtLink>
            </div>
            <p class="text-xs text-stone-400">
              {{ formatKm(map.stats?.distance_km) }}
              <span class="text-stone-200 mx-1">·</span>
              {{ formatM(map.stats?.elevation_gain_m) }} ↑
              <span class="text-stone-200 mx-1">·</span>
              {{ formatDate(map.created_at) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <NuxtLink :to="`/create/${map.id}/style`" @click.stop>
              <button class="text-sm font-medium text-stone-600 border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors">
                Style
              </button>
            </NuxtLink>
            <NuxtLink v-if="map.status === 'rendered'" :to="`/create/${map.id}/checkout`" @click.stop>
              <button class="text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] rounded-lg px-3 py-2 transition-colors">
                Order
              </button>
            </NuxtLink>
            <button
              v-else
              disabled
              class="text-sm font-medium text-stone-300 border border-stone-100 rounded-lg px-3 py-2 cursor-not-allowed"
            >
              Order
            </button>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="deletingMapId === map.id"
              :title="map.status === 'ordered' ? 'Ordered maps are kept with order history' : `Delete ${map.title}`"
              :aria-label="`Delete ${map.title}`"
              @click.stop="requestDeleteMap(map)"
            >
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8 2a1 1 0 00-.894.553L6.382 4H3a1 1 0 000 2h.293l.853 10.24A2 2 0 006.139 18h7.722a2 2 0 001.993-1.76L16.707 6H17a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0012 2H8zm1.618 2h4.764l-.5-1h-3.764l-.5 1zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           FEATURED FROM THE SHOP
           ═══════════════════════════════════════════════════════════════ -->
      <section class="mt-20">
        <div class="flex items-baseline justify-between mb-5">
          <div>
            <p class="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F] mb-1">
              Shop · Curated prints
            </p>
            <h2
              class="text-xl font-semibold tracking-tight text-stone-900"
              style="font-family:'Space Grotesk',sans-serif"
            >
              Iconic maps, framed for you
            </h2>
          </div>
          <NuxtLink to="/shop" class="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors">
            Browse all prints
            <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </NuxtLink>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="premade in featuredPremades"
            :key="premade.slug"
            :to="`/shop/${premade.slug}`"
            class="group block"
          >
            <div
              class="relative rounded-xl overflow-hidden shadow-sm group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-300 border border-stone-900/5"
              style="aspect-ratio:2/3"
              :style="{ backgroundColor: premade.style_config?.background_color || '#F7F4EF' }"
            >
              <img
                v-if="premade.preview_image_url"
                :src="premade.preview_image_url"
                :alt="premade.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="absolute inset-0 flex flex-col">
                <div
                  class="px-2 pt-2 pb-1 text-center shrink-0"
                  :style="{
                    backgroundColor: premade.style_config?.label_bg_color || premade.style_config?.background_color || '#F7F4EF',
                    color: premade.style_config?.label_text_color || '#1C1917',
                  }"
                >
                  <p
                    class="text-[8px] font-bold tracking-[0.16em] uppercase truncate leading-tight"
                    :style="{ fontFamily: `'${premade.style_config?.font_family || 'Space Grotesk'}', sans-serif` }"
                  >{{ premade.title }}</p>
                </div>
                <div class="flex-1 relative overflow-hidden">
                  <svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid meet" class="absolute inset-0 w-full h-full">
                    <path
                      d="M22 91 C31 75 43 82 50 65 S66 38 80 43"
                      fill="none"
                      :stroke="premade.style_config?.route_color || '#C1121F'"
                      stroke-width="1.3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <span class="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-stone-900 text-white">
                from {{ formatPrice(premade.base_price_cents) }}
              </span>
            </div>
            <div class="mt-3">
              <p class="text-[9px] font-semibold tracking-[0.18em] uppercase text-stone-400 truncate">{{ premade.region }}</p>
              <p class="text-sm font-semibold text-stone-900 truncate group-hover:text-[#2D6A4F] transition-colors" style="font-family:'Space Grotesk',sans-serif">
                {{ premade.title }}
              </p>
            </div>
          </NuxtLink>
        </div>

        <NuxtLink to="/shop" class="sm:hidden mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors">
          Browse all prints
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </NuxtLink>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════
           ORDERS SECTION
           ═══════════════════════════════════════════════════════════════ -->
      <section v-if="orders.length > 0" class="mt-20">
        <div class="flex items-baseline justify-between mb-5">
          <h2
            class="text-xl font-semibold tracking-tight text-stone-900"
            style="font-family:'Space Grotesk',sans-serif"
          >
            Recent orders
          </h2>
          <span class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-400">
            {{ orders.length }} total
          </span>
        </div>

        <div class="border border-stone-200 rounded-2xl overflow-hidden bg-white/70 backdrop-blur-sm divide-y divide-stone-100">
          <div
            v-for="order in orders"
            :key="order.id"
            class="flex items-center gap-4 px-5 py-4 hover:bg-stone-50/60 transition-colors"
          >
            <!-- status dot -->
            <div class="relative shrink-0">
              <div :class="[
                'w-2 h-2 rounded-full',
                order.status === 'delivered' || order.status === 'shipped' ? 'bg-emerald-500' :
                order.status === 'paid'      || order.status === 'in_production' ? 'bg-sky-500' :
                order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-400' :
                'bg-amber-400'
              ]" />
              <div
                v-if="order.status === 'in_production' || order.status === 'shipped'"
                :class="[
                  'absolute inset-0 rounded-full animate-ping opacity-75',
                  order.status === 'shipped' ? 'bg-emerald-400' : 'bg-sky-400',
                ]"
              />
            </div>

            <div class="flex-1 min-w-0 flex items-center gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-stone-900 truncate">
                  {{ (order as any).maps?.title || 'Untitled map' }}
                </p>
                <p class="text-xs text-stone-400 mt-0.5">
                  {{ order.print_size }}
                  <span class="text-stone-200 mx-1.5">·</span>
                  {{ formatDate(order.created_at) }}
                  <span v-if="order.tracking_code" class="text-stone-200 mx-1.5">·</span>
                  <span v-if="order.tracking_code" class="font-mono text-stone-500">{{ order.tracking_code }}</span>
                </p>
              </div>
              <div class="text-right shrink-0 flex items-center gap-4">
                <div>
                  <p class="text-sm font-semibold text-stone-900">{{ formatPrice(order.total_cents) }}</p>
                  <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 capitalize mt-0.5">
                    {{ order.status.replace('_', ' ') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-[10px] font-semibold tracking-[0.2em] uppercase text-red-500">Delete map</p>
              <h3 class="text-base font-semibold text-stone-900 mt-1">Remove from your collection?</h3>
            </div>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
              :disabled="!!deletingMapId"
              @click="closeDeleteModal"
            >
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-stone-600 leading-relaxed">
            <span class="font-semibold text-stone-900">{{ mapPendingDelete?.title }}</span>
            will be permanently deleted along with its saved style snapshots. This cannot be undone.
          </p>
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p class="text-xs text-amber-800 leading-relaxed">
              Ordered maps are kept with order history and will not be deleted.
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <button
              class="text-sm text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50"
              :disabled="!!deletingMapId"
              @click="closeDeleteModal"
            >
              Cancel
            </button>
            <button
              class="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              :disabled="!!deletingMapId"
              @click="confirmDeleteMap"
            >
              {{ deletingMapId ? 'Deleting…' : 'Delete map' }}
            </button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent, ref, computed, onMounted } from 'vue'
import { useRouter, useSupabaseClient, useSupabaseUser } from '#imports'
import type { Order, PremadeMap, TrailMap } from '~/types'
import { formatPrice } from '~/utils/products'

type DashboardMap = Pick<
  TrailMap,
  | 'id'
  | 'user_id'
  | 'title'
  | 'subtitle'
  | 'stats'
  | 'style_config'
  | 'thumbnail_url'
  | 'render_url'
  | 'proof_render_url'
  | 'status'
  | 'created_at'
  | 'updated_at'
>

type DashboardPremadeMap = Pick<
  PremadeMap,
  | 'slug'
  | 'title'
  | 'region'
  | 'style_config'
  | 'preview_image_url'
  | 'base_price_cents'
>

type DashboardOrder = Pick<
  Order,
  | 'id'
  | 'print_size'
  | 'total_cents'
  | 'currency'
  | 'status'
  | 'tracking_code'
  | 'carrier'
  | 'created_at'
> & {
  maps?: { title?: string | null } | null
}

const { data: premadeMaps } = await useFetch<DashboardPremadeMap[]>('/api/premade', {
  query: { view: 'cards', limit: 4 },
  default: () => [],
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

// Featured shop picks to surface inside the dashboard (up to 4)
const featuredPremades = computed<DashboardPremadeMap[]>(() =>
  premadeMaps.value
)

const maps = ref<DashboardMap[]>([])
const orders = ref<DashboardOrder[]>([])
const loading = ref(true)
const toast = useToast()

// UI state
type FilterId = 'all' | 'ordered'
const activeFilter = ref<FilterId>('all')
const sortBy = ref<'newest' | 'oldest' | 'az' | 'distance'>('newest')
const view = ref<'grid' | 'list'>('grid')
const showDeleteModal = ref(false)
const mapPendingDelete = ref<DashboardMap | null>(null)
const deletingMapId = ref<string | null>(null)

const filters: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ordered', label: 'Ordered' },
]

// ─── User ─────────────────────────────────────────────────────────────────
const firstName = computed(() => {
  // Prefer the real name stored in user_metadata (set during Strava/social OAuth).
  // Strava users have a synthetic email (strava-{id}@auth.radmaps.studio) so we
  // must not derive the name from the email address for those accounts.
  const fullName = (user.value?.user_metadata?.full_name as string | undefined) ?? ''
  if (fullName.trim()) {
    return fullName.trim().split(/\s+/)[0]
  }

  // Fallback: derive from email for password-based accounts.
  const email = user.value?.email ?? ''
  const local = email.split('@')[0] ?? ''
  if (!local) return ''
  const cleaned = local.replace(/[._-]/g, ' ').replace(/\d+$/, '').trim()
  const first = cleaned.split(' ')[0] || cleaned
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
)

// ─── Stats ────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const posters = maps.value.length
  const distanceKm = maps.value.reduce((acc, m) => acc + (m.stats?.distance_km ?? 0), 0)
  const elevationM = Math.round(maps.value.reduce((acc, m) => acc + (m.stats?.elevation_gain_m ?? 0), 0))
  const orderCount = orders.value.length
  return { posters, distanceKm, elevationM, orders: orderCount }
})

// ─── Filtering / sorting ──────────────────────────────────────────────────
const countByStatus = (id: FilterId) => {
  if (id === 'all') return maps.value.length
  return maps.value.filter((m) => m.status === id).length
}

const filteredMaps = computed(() => {
  const list = activeFilter.value === 'all'
    ? [...maps.value]
    : maps.value.filter((m) => m.status === activeFilter.value)

  switch (sortBy.value) {
    case 'oldest':
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      break
    case 'az':
      list.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'distance':
      list.sort((a, b) => (b.stats?.distance_km ?? 0) - (a.stats?.distance_km ?? 0))
      break
    case 'newest':
    default:
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  return list
})

// ─── Formatting helpers ───────────────────────────────────────────────────
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const formatKm = (km?: number) => {
  if (km == null || !isFinite(km)) return '—'
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

const formatM = (m?: number) => {
  if (m == null || !isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

const posterThumbnailUrl = (map: DashboardMap) =>
  map.proof_render_url ?? map.thumbnail_url ?? map.render_url ?? null

function openMap(map: DashboardMap) {
  if (!map.id) return
  router.push(`/create/${map.id}/style`)
}

// ─── Delete maps ───────────────────────────────────────────────────────────
function requestDeleteMap(map: DashboardMap) {
  if (map.status === 'ordered') {
    toast.add({
      title: 'Map kept with order history',
      description: 'Ordered maps cannot be deleted from your collection yet.',
      icon: 'i-heroicons-lock-closed',
      color: 'amber',
      timeout: 6000,
    })
    return
  }

  mapPendingDelete.value = map
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (deletingMapId.value) return
  showDeleteModal.value = false
  mapPendingDelete.value = null
}

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const candidate = err as {
      data?: { message?: string }
      statusMessage?: string
      message?: string
    }
    return candidate.data?.message || candidate.statusMessage || candidate.message || 'Could not delete this map.'
  }
  return 'Could not delete this map.'
}

async function confirmDeleteMap() {
  const map = mapPendingDelete.value
  if (!map) return

  deletingMapId.value = map.id
  try {
    await $fetch(`/api/maps/${map.id}`, { method: 'DELETE' })
    maps.value = maps.value.filter((item) => item.id !== map.id)
    showDeleteModal.value = false
    mapPendingDelete.value = null
    toast.add({
      title: 'Map deleted',
      description: `${map.title} was removed from your collection.`,
      icon: 'i-heroicons-trash',
      color: 'green',
      timeout: 5000,
    })
  } catch (err) {
    toast.add({
      title: 'Could not delete map',
      description: apiErrorMessage(err),
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 7000,
    })
  } finally {
    deletingMapId.value = null
  }
}

// ─── Data fetch ───────────────────────────────────────────────────────────
const fetchMaps = async () => {
  if (!user.value?.id) return
  try {
    maps.value = await $fetch<DashboardMap[]>('/api/maps')
  } catch (err) {
    console.error('Error fetching maps:', err)
  }
}

const fetchOrders = async () => {
  if (!user.value?.id) return
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, print_size, total_cents, currency, status, tracking_code, carrier, created_at, maps(title)')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    orders.value = (data || []) as unknown as DashboardOrder[]
  } catch (err) {
    console.error('Error fetching orders:', err)
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([fetchMaps(), fetchOrders()])
  loading.value = false
})

// ─── Inline sub-components ────────────────────────────────────────────────

const StatCell = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    decimals: { type: Number, default: 0 },
    suffix: { type: String, default: '' },
    icon: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
  setup(props) {
    const icons: Record<string, () => any> = {
      poster: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-4 h-4' }, [
        h('path', { d: 'M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v10H5V5z', 'clip-rule': 'evenodd', 'fill-rule': 'evenodd' }),
        h('path', { d: 'M7 8a1 1 0 112 0 1 1 0 01-2 0zm2 3l1.5-2 3 4H7l1.5-2z' }),
      ]),
      compass: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-4 h-4' }, [
        h('path', { 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.5-11.5L11 11l-4.5 2.5L9 9l4.5-2.5z' }),
      ]),
      mountain: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-4 h-4' }, [
        h('path', { d: 'M2 16 L7 6 L10.5 11 L13 8 L18 16 Z' }),
      ]),
      package: () => h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-4 h-4' }, [
        h('path', { 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', d: 'M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 4h12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V8zm4 2a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z' }),
      ]),
    }
    const format = () => {
      const v = props.value || 0
      const fixed = props.decimals > 0 ? v.toFixed(props.decimals) : Math.round(v).toString()
      // insert thousand separators
      const [int, dec] = fixed.split('.')
      const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return dec ? `${withSep}.${dec}` : withSep
    }
    return () =>
      h('div', { class: 'relative px-5 py-5 sm:py-6 flex flex-col' }, [
        h('div', { class: 'flex items-center gap-2 mb-3' }, [
          h('span', { class: 'w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center' }, [
            icons[props.icon]?.() ?? null,
          ]),
          h('span', { class: 'text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400' }, props.label),
        ]),
        h('div', { class: 'flex items-baseline gap-1.5' }, [
          props.loading
            ? h('span', { class: 'inline-block h-8 w-16 bg-stone-200/70 rounded animate-pulse' })
            : h('span', {
                class: 'text-[32px] font-semibold tracking-tight text-stone-900 leading-none',
                style: "font-family:'Space Grotesk',sans-serif",
              }, format()),
          props.suffix
            ? h('span', { class: 'text-sm font-semibold text-stone-400' }, props.suffix)
            : null,
        ]),
      ])
  },
})

const FilterTab = defineComponent({
  props: {
    label: { type: String, required: true },
    count: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          onClick: () => emit('click'),
          class: [
            'relative px-4 py-2.5 text-sm font-medium transition-colors',
            props.active ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700',
          ],
        },
        [
          h('span', { class: 'flex items-center gap-1.5' }, [
            h('span', null, props.label),
            h(
              'span',
              {
                class: [
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums',
                  props.active
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-400',
                ],
              },
              props.count.toString()
            ),
          ]),
          h('span', {
            class: [
              'absolute left-0 right-0 -bottom-px h-0.5 bg-stone-900 transition-transform duration-300 ease-out origin-left',
              props.active ? 'scale-x-100' : 'scale-x-0',
            ],
          }),
        ]
      )
  },
})
</script>
