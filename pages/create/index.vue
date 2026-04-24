<template>
  <div class="relative min-h-[100dvh]">

    <!-- paper texture -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

      <!-- ═══════════════════════════════════════════════════════════════
           EDITORIAL HEADER
           ═══════════════════════════════════════════════════════════════ -->
      <header class="mb-10">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">
            Studio · Create
          </span>
          <span class="h-px flex-1 w-12 bg-stone-300/70" />
        </div>
        <h1
          class="text-[44px] sm:text-[56px] leading-[1.02] tracking-tight text-stone-900 mb-3"
          style="font-family:'Playfair Display',serif"
        >
          Design a new map.
        </h1>
        <p class="text-[15px] sm:text-base text-stone-500 max-w-xl leading-relaxed">
          Start from a Strava activity, an imported route, a curated premade,
          or draw it yourself on a map. Pick what fits best.
        </p>
      </header>

      <!-- ═══════════════════════════════════════════════════════════════
           METHOD PICKER
           ═══════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <MethodCard
          v-for="m in methods"
          :key="m.id"
          :method="m"
          :active="activeMethod === m.id"
          @select="setMethod(m.id)"
        />
      </div>

      <!-- ═══════════════════════════════════════════════════════════════
           ACTIVE PANEL
           ═══════════════════════════════════════════════════════════════ -->
      <section class="relative rounded-3xl bg-white/70 border border-stone-200 backdrop-blur-sm p-5 sm:p-8 min-h-[380px]">

        <!-- STRAVA -->
        <div v-show="activeMethod === 'strava'">
          <PanelHeader
            eyebrow="From Strava"
            title="Pick a recent activity"
            body="Connect your Strava account to see your latest runs, rides, and hikes — then import one with a click."
          />

          <!-- Not connected -->
          <div v-if="!stravaLoading && !stravaConnected && !stravaError"
            class="flex flex-col items-center gap-5 rounded-2xl border border-stone-200 bg-white/50 px-6 py-14 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#FC4C02]/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-stone-900 mb-1" style="font-family:'Space Grotesk',sans-serif">
                Connect your Strava
              </p>
              <p class="text-xs text-stone-500 max-w-xs">
                Sync once. Your activities appear here automatically.
              </p>
            </div>
            <a
              href="/api/strava/connect"
              class="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 px-5 py-3 rounded-full transition-colors shadow-sm shadow-stone-900/10"
            >
              <svg class="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172"/>
              </svg>
              Connect Strava
            </a>
          </div>

          <!-- Loading -->
          <div v-if="stravaLoading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="animate-pulse bg-stone-100 rounded-2xl h-24" />
          </div>

          <!-- Error -->
          <InlineError v-if="stravaError" :message="stravaError" />

          <!-- Activities list -->
          <div v-if="!stravaLoading && stravaConnected && stravaActivities.length > 0" class="space-y-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-400">
                {{ stravaActivities.length }} activit{{ stravaActivities.length === 1 ? 'y' : 'ies' }}
              </p>
              <button
                @click="disconnectStrava"
                :disabled="isDisconnecting"
                class="text-[11px] font-medium text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
              >
                {{ isDisconnecting ? 'Disconnecting…' : 'Disconnect' }}
              </button>
            </div>

            <div
              v-for="activity in stravaActivities"
              :key="activity.id"
              class="group relative rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-4 flex items-start gap-4"
            >
              <div class="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center">
                <img v-if="activity.thumbnail_url" :src="activity.thumbnail_url" class="w-full h-full object-cover" loading="lazy" />
                <span v-else class="text-2xl leading-none">{{ sportEmoji(activity.sport_type) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <p class="text-[15px] font-semibold text-stone-900 truncate" style="font-family:'Space Grotesk',sans-serif">{{ activity.name }}</p>
                  <span class="inline-flex items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-600 tracking-wide uppercase shrink-0">
                    {{ activity.sport_type }}
                  </span>
                  <span v-if="activity.achievement_count > 0"
                    class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 shrink-0">
                    🏆 {{ activity.achievement_count }}
                  </span>
                </div>
                <p class="text-xs text-stone-500">
                  {{ (activity.distance / 1609.34).toFixed(1) }} mi
                  <span class="text-stone-300 mx-1">·</span>
                  {{ Math.round(activity.total_elevation_gain * 3.28084).toLocaleString() }} ft
                  <template v-if="activity.elapsed_time">
                    <span class="text-stone-300 mx-1">·</span>{{ formatDuration(activity.elapsed_time) }}
                  </template>
                </p>
                <p class="text-[11px] text-stone-400 mt-0.5">
                  <span v-if="activity.location">{{ activity.location }} · </span>{{ new Date(activity.start_date).toLocaleDateString() }}
                </p>
              </div>
              <button
                class="shrink-0 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed px-4 py-2 rounded-full transition-colors"
                :disabled="importingId !== null"
                @click="importActivity(activity)"
              >
                <Spinner v-if="importingId === activity.id" class="w-3.5 h-3.5" />
                <span v-else>Import</span>
              </button>
            </div>

            <button
              v-if="stravaHasMore"
              @click="loadMore"
              :disabled="stravaLoadingMore"
              class="w-full py-3 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-200 rounded-full hover:border-stone-300 disabled:opacity-50 transition-colors"
            >
              <span v-if="stravaLoadingMore" class="flex items-center justify-center gap-2">
                <Spinner class="w-3.5 h-3.5" />
                Loading more…
              </span>
              <span v-else>Load more activities</span>
            </button>
          </div>

          <div v-if="!stravaLoading && stravaConnected && stravaActivities.length === 0" class="text-center py-10 text-sm text-stone-500">
            No recent activities found.
          </div>
        </div>

        <!-- UPLOAD -->
        <div v-show="activeMethod === 'upload'">
          <PanelHeader
            eyebrow="Upload a route"
            title="Bring a file from your watch or app"
            body="Drop a GPX (what most apps export) or a GeoJSON file here — up to 50 MB."
          />

          <div v-if="!parsedStats">
            <div
              @drop.prevent="handleDrop"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @click="(fileInput as HTMLInputElement | null)?.click()"
              :class="[
                'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 scale-[1.01]'
                  : 'border-stone-200 bg-white/50 hover:border-[#2D6A4F]/40 hover:bg-[#2D6A4F]/3',
              ]"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".gpx,.geojson,.json"
                class="hidden"
                @change="handleFileSelect"
              />
              <div class="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-200">
                <svg class="h-6 w-6 text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                </svg>
              </div>
              <div>
                <p class="text-[15px] font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
                  Drop your route here, or <span class="text-[#2D6A4F] underline underline-offset-4">browse</span>
                </p>
                <p class="mt-1 text-xs text-stone-400">
                  GPX (most apps export this) or GeoJSON · up to 50 MB
                </p>
              </div>
            </div>
          </div>

          <div v-if="isParsing" class="mt-4 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3.5">
            <Spinner class="h-4 w-4 text-[#2D6A4F]" />
            <span class="text-sm text-stone-700">Reading your route…</span>
          </div>

          <InlineError v-if="parseError" :message="parseError" class="mt-4" />

          <!-- Parsed result -->
          <div v-if="parsedGeojson && parsedStats" class="space-y-5">

            <!-- Success banner -->
            <div class="flex items-center justify-between rounded-2xl border border-[#2D6A4F]/15 bg-[#2D6A4F]/5 px-4 py-3">
              <div class="flex items-center gap-2.5">
                <svg class="h-5 w-5 text-[#2D6A4F] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="text-sm font-semibold text-stone-900">Route loaded</span>
              </div>
              <button
                @click="resetFile"
                class="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
              >
                Change file
              </button>
            </div>

            <!-- Stats row -->
            <div class="grid grid-cols-3 border border-stone-200 rounded-2xl overflow-hidden bg-white/60 divide-x divide-stone-200">
              <StatCell label="Distance" :value="`${(parsedStats.distance_km * 0.621371).toFixed(1)} mi`" />
              <StatCell label="Elev gain" :value="`${(parsedStats.elevation_gain_m * 3.28084).toFixed(0)} ft`" />
              <StatCell label="Points" :value="parsedPointCount.toLocaleString()" />
            </div>

            <!-- Map name -->
            <div class="space-y-2">
              <label class="block text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-500">Name this map</label>
              <input
                v-model="mapTitle"
                type="text"
                placeholder="e.g., Mount Rainier Loop"
                class="w-full rounded-full border border-stone-200 bg-white px-5 py-3.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15 transition-shadow"
              />
            </div>

            <!-- Create -->
            <button
              @click="createMap"
              :disabled="!mapTitle.trim() || isCreating"
              class="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed rounded-full py-3.5 transition-colors shadow-sm shadow-stone-900/10"
            >
              <Spinner v-if="isCreating" class="w-4 h-4" />
              {{ isCreating ? 'Creating…' : 'Continue to styling' }}
              <svg v-if="!isCreating" class="w-3.5 h-3.5 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- PREMADE -->
        <div v-show="activeMethod === 'premade'">
          <PanelHeader
            eyebrow="Start from a premade"
            title="Base your design on an iconic trail"
            body="Pick one of our curated routes — we'll clone it to your studio so you can customize colors, typography, text, and size."
          />

          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              v-for="premade in PREMADE_MAPS"
              :key="premade.slug"
              @click="selectedPremadeSlug = premade.slug"
              :class="[
                'group relative text-left rounded-2xl overflow-hidden border-2 transition-all',
                selectedPremadeSlug === premade.slug
                  ? 'border-stone-900 shadow-lg shadow-stone-900/5 -translate-y-0.5'
                  : 'border-stone-200 hover:border-stone-300 hover:-translate-y-0.5',
              ]"
            >
              <div
                class="relative"
                style="aspect-ratio:3/4"
                :style="{ backgroundColor: premade.style_config.background_color }"
              >
                <img v-if="premade.preview_image_url" :src="premade.preview_image_url" class="w-full h-full object-cover" />
                <div v-else class="absolute inset-0 flex flex-col">
                  <div
                    class="px-2 pt-2 pb-1 text-center shrink-0"
                    :style="{ backgroundColor: premade.style_config.label_bg_color || premade.style_config.background_color, color: premade.style_config.label_text_color }"
                  >
                    <p class="text-[8px] font-bold tracking-[0.14em] uppercase truncate leading-tight"
                      :style="{ fontFamily: `'${premade.style_config.font_family}', sans-serif` }"
                    >{{ premade.title }}</p>
                  </div>
                  <div class="flex-1 relative overflow-hidden">
                    <svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid meet" class="absolute inset-0 w-full h-full">
                      <path
                        v-if="premadeRoutePath(premade)"
                        :d="premadeRoutePath(premade)"
                        fill="none"
                        :stroke="premade.style_config.route_color"
                        stroke-width="1.3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <span
                  v-if="selectedPremadeSlug === premade.slug"
                  class="absolute top-2 right-2 w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center shadow"
                >
                  <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                </span>
              </div>
              <div class="p-3 bg-white">
                <p class="text-[9px] font-semibold tracking-[0.18em] uppercase text-stone-400 truncate">{{ premade.region }}</p>
                <p class="text-sm font-semibold text-stone-900 truncate" style="font-family:'Space Grotesk',sans-serif">{{ premade.title }}</p>
              </div>
            </button>
          </div>

          <div v-if="selectedPremadeSlug" class="mt-6 pt-5 border-t border-stone-200">
            <button
              @click="customizePremade"
              :disabled="isCustomizing"
              class="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 rounded-full py-3.5 transition-colors shadow-sm shadow-stone-900/10"
            >
              <Spinner v-if="isCustomizing" class="w-4 h-4" />
              {{ isCustomizing ? 'Opening the editor…' : 'Customize and continue' }}
              <svg v-if="!isCustomizing" class="w-3.5 h-3.5 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
            <InlineError v-if="customizeError" :message="customizeError" class="mt-3" />
          </div>
        </div>

        <!-- DRAW -->
        <div v-show="activeMethod === 'draw'">
          <PanelHeader
            eyebrow="Draw on a map"
            title="Sketch a route with your mouse"
            body="Click anywhere to place points — we'll connect them with a line. Great for trails you remember but don't have data for."
          />

          <ClientOnly>
            <div class="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
              <div class="relative" style="height:440px;">
                <div ref="drawMapEl" class="absolute inset-0 w-full h-full" />

                <!-- Map controls overlay -->
                <div class="absolute top-3 right-3 z-10 flex flex-col gap-2">
                  <button
                    @click="undoWaypoint"
                    :disabled="drawWaypoints.length === 0"
                    class="w-10 h-10 rounded-full bg-white/95 hover:bg-white shadow-md border border-stone-200 flex items-center justify-center text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Undo last point"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                  <button
                    @click="clearWaypoints"
                    :disabled="drawWaypoints.length === 0"
                    class="w-10 h-10 rounded-full bg-white/95 hover:bg-white shadow-md border border-stone-200 flex items-center justify-center text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Clear all"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                </div>

                <!-- Empty state overlay -->
                <div v-if="drawWaypoints.length === 0 && drawMapLoaded"
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <div class="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full shadow-lg border border-stone-200 flex items-center gap-2.5">
                    <svg class="w-4 h-4 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l.707.707L2 5.414A2 2 0 002 8.243L8.243 14.485A2 2 0 0010.657 14.485l1-1 .707.707a1 1 0 001.414-1.414l-10.07-10.485zM10 11l1.586-1.586a1 1 0 00-1.414-1.414L8 10" clip-rule="evenodd"/>
                    </svg>
                    <p class="text-xs font-semibold text-stone-800">Click anywhere to place your first point</p>
                  </div>
                </div>

                <!-- Loading overlay -->
                <div v-if="!drawMapLoaded" class="absolute inset-0 flex items-center justify-center bg-stone-50">
                  <div class="flex items-center gap-2">
                    <Spinner class="w-4 h-4 text-[#2D6A4F]" />
                    <span class="text-sm text-stone-500">Loading map…</span>
                  </div>
                </div>
              </div>

              <!-- Stats bar below map -->
              <div class="bg-white border-t border-stone-200 px-4 py-3 flex items-center justify-between text-xs">
                <div class="flex items-center gap-5">
                  <div>
                    <span class="text-stone-400 font-semibold tracking-wide uppercase text-[10px]">Points</span>
                    <span class="ml-2 text-stone-900 font-semibold tabular-nums">{{ drawWaypoints.length }}</span>
                  </div>
                  <div>
                    <span class="text-stone-400 font-semibold tracking-wide uppercase text-[10px]">Distance</span>
                    <span class="ml-2 text-stone-900 font-semibold tabular-nums">
                      {{ drawDistanceKm > 0 ? `${(drawDistanceKm * 0.621371).toFixed(1)} mi` : '—' }}
                    </span>
                  </div>
                </div>
                <span class="text-[10px] text-stone-400 hidden sm:block">
                  Tip: clicks connect with straight lines — great for sketching.
                </span>
              </div>
            </div>
          </ClientOnly>

          <!-- Name + save -->
          <div v-if="drawWaypoints.length >= 2" class="mt-5 space-y-4">
            <div class="space-y-2">
              <label class="block text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-500">Name this map</label>
              <input
                v-model="drawTitle"
                type="text"
                placeholder="e.g., Afternoon loop"
                class="w-full rounded-full border border-stone-200 bg-white px-5 py-3.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
              />
            </div>
            <button
              @click="saveDrawnMap"
              :disabled="!drawTitle.trim() || isSavingDrawn"
              class="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 rounded-full py-3.5 transition-colors shadow-sm shadow-stone-900/10"
            >
              <Spinner v-if="isSavingDrawn" class="w-4 h-4" />
              {{ isSavingDrawn ? 'Saving…' : 'Continue to styling' }}
              <svg v-if="!isSavingDrawn" class="w-3.5 h-3.5 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
            <InlineError v-if="drawError" :message="drawError" />
          </div>
          <p v-else-if="drawWaypoints.length === 1" class="mt-4 text-center text-xs text-stone-500">
            Place at least one more point to continue.
          </p>
        </div>

      </section>

      <!-- Footer note -->
      <p class="text-center text-xs text-stone-400 mt-8 max-w-md mx-auto leading-relaxed">
        All routes stay private to your account. You can edit every detail — colors,
        typography, title, size — before ordering a print.
      </p>

    </div>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent, ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import * as toGeoJSON from '@tmcw/togeojson'
import type { RouteStats, PremadeMap } from '~/types'
import { PREMADE_MAPS } from '~/data/premade-maps'
import { extractNamedTrackSegments } from '~/utils/trail'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

useSeo({
  title: 'Create a new map',
  description: 'Design a custom trail poster — import from Strava, upload a route file, start from a premade, or draw on a map.',
  path: '/create',
  // Authenticated, user-specific flow — not for the index.
  noindex: true,
})

const router = useRouter()
const route = useRoute()
const user = useSupabaseUser()

// ─── Method picker ───────────────────────────────────────────────────────
type MethodId = 'strava' | 'upload' | 'premade' | 'draw'

const methods = [
  {
    id: 'strava' as MethodId,
    title: 'From Strava',
    subtitle: 'Import any activity',
    tone: 'orange',
  },
  {
    id: 'upload' as MethodId,
    title: 'Upload a route',
    subtitle: 'From your watch or app',
    tone: 'stone',
  },
  {
    id: 'premade' as MethodId,
    title: 'Start from a premade',
    subtitle: 'Curated iconic trails',
    tone: 'green',
  },
  {
    id: 'draw' as MethodId,
    title: 'Draw on a map',
    subtitle: 'Sketch with your mouse',
    tone: 'amber',
  },
]

const activeMethod = ref<MethodId>('strava')

function setMethod(id: MethodId) {
  activeMethod.value = id
  if (id === 'draw') {
    nextTick(() => initDrawMap())
  }
}

// ─── Shared form state (upload) ──────────────────────────────────────────
const isDragging = ref(false)
const isParsing = ref(false)
const isCreating = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const mapTitle = ref('')
const parseError = ref<string | null>(null)
const parsedGeojson = ref<GeoJSON.FeatureCollection | null>(null)
const parsedStats = ref<RouteStats | null>(null)
const parsedBbox = ref<[number, number, number, number] | null>(null)
const parsedPointCount = ref(0)
const parsedSegments = ref<import('~/types').TrailSegment[]>([])

// ─── Strava state ────────────────────────────────────────────────────────
const ACTIVITIES_PER_PAGE = 20
const stravaConnected = ref(false)
const stravaActivities = ref<any[]>([])
const stravaLoading = ref(false)
const stravaLoadingMore = ref(false)
const stravaHasMore = ref(false)
const stravaPage = ref(1)
const stravaError = ref<string | null>(null)
const importingId = ref<number | null>(null)
const isDisconnecting = ref(false)

// ─── Premade state ───────────────────────────────────────────────────────
const selectedPremadeSlug = ref<string | null>(null)
const isCustomizing = ref(false)
const customizeError = ref<string | null>(null)

// ─── Draw state ──────────────────────────────────────────────────────────
const drawMapEl = ref<HTMLDivElement | null>(null)
const drawMapLoaded = ref(false)
const drawWaypoints = ref<Array<[number, number]>>([])
const drawTitle = ref('')
const isSavingDrawn = ref(false)
const drawError = ref<string | null>(null)
let drawMapInstance: any = null

const drawDistanceKm = computed(() => {
  if (drawWaypoints.value.length < 2) return 0
  let total = 0
  for (let i = 1; i < drawWaypoints.value.length; i++) {
    total += haversineKm(drawWaypoints.value[i - 1], drawWaypoints.value[i])
  }
  return total
})

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

async function initDrawMap() {
  if (drawMapInstance || !drawMapEl.value) return
  const maplibregl = (await import('maplibre-gl')).default
  // Ensure maplibre CSS loaded
  if (!document.querySelector('link[data-maplibre]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
    link.setAttribute('data-maplibre', 'true')
    document.head.appendChild(link)
  }

  drawMapInstance = new maplibregl.Map({
    container: drawMapEl.value,
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [-98.5795, 39.8283],
    zoom: 3,
    attributionControl: { compact: true },
  })

  drawMapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  drawMapInstance.on('load', () => {
    drawMapLoaded.value = true

    drawMapInstance.addSource('drawn-line', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    drawMapInstance.addSource('drawn-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    drawMapInstance.addLayer({
      id: 'drawn-line',
      type: 'line',
      source: 'drawn-line',
      paint: {
        'line-color': '#C1121F',
        'line-width': 3,
        'line-opacity': 0.9,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
    drawMapInstance.addLayer({
      id: 'drawn-points-halo',
      type: 'circle',
      source: 'drawn-points',
      paint: {
        'circle-radius': 9,
        'circle-color': '#ffffff',
        'circle-opacity': 0.85,
      },
    })
    drawMapInstance.addLayer({
      id: 'drawn-points',
      type: 'circle',
      source: 'drawn-points',
      paint: {
        'circle-radius': 5,
        'circle-color': '#C1121F',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })

    drawMapInstance.on('click', (e: any) => {
      drawWaypoints.value.push([e.lngLat.lng, e.lngLat.lat])
      syncDrawSources()
    })

    drawMapInstance.getCanvas().style.cursor = 'crosshair'
  })
}

function syncDrawSources() {
  if (!drawMapInstance || !drawMapLoaded.value) return
  const line = drawWaypoints.value.length >= 2
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: drawWaypoints.value },
          },
        ],
      }
    : { type: 'FeatureCollection' as const, features: [] }

  const points = {
    type: 'FeatureCollection' as const,
    features: drawWaypoints.value.map((c, i) => ({
      type: 'Feature' as const,
      properties: { idx: i },
      geometry: { type: 'Point' as const, coordinates: c },
    })),
  }

  drawMapInstance.getSource('drawn-line')?.setData(line)
  drawMapInstance.getSource('drawn-points')?.setData(points)
}

function undoWaypoint() {
  drawWaypoints.value.pop()
  syncDrawSources()
}

function clearWaypoints() {
  drawWaypoints.value = []
  syncDrawSources()
}

async function saveDrawnMap() {
  if (!user.value?.id || drawWaypoints.value.length < 2 || !drawTitle.value.trim()) return
  isSavingDrawn.value = true
  drawError.value = null
  try {
    const coords = drawWaypoints.value
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords as [number, number][] },
      }],
    }
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
    const bbox: [number, number, number, number] = [minLng, minLat, maxLng, maxLat]

    const stats: RouteStats = {
      distance_km: Math.round(drawDistanceKm.value * 100) / 100,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
      activity_type: 'drawn',
    }

    const response = await fetch('/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: drawTitle.value.trim(), geojson, bbox, stats }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to save drawn map')
    }
    const data = await response.json()
    router.push(`/create/${data.id}/style`)
  } catch (err) {
    drawError.value = err instanceof Error ? err.message : 'Could not save your map.'
  } finally {
    isSavingDrawn.value = false
  }
}

// ─── Premade customize ───────────────────────────────────────────────────
async function customizePremade() {
  if (!selectedPremadeSlug.value) return
  isCustomizing.value = true
  customizeError.value = null
  try {
    const resp = await $fetch<{ redirect: string }>('/api/shop/customize', {
      method: 'POST',
      body: { slug: selectedPremadeSlug.value },
    })
    if (resp?.redirect) router.push(resp.redirect)
  } catch (err: any) {
    customizeError.value = err?.data?.message || err?.message || 'Could not customize this map.'
  } finally {
    isCustomizing.value = false
  }
}

function premadeRoutePath(map: PremadeMap): string {
  const feat = map.geojson?.features?.[0]
  const g = feat?.geometry as any
  const coords: number[][] | undefined =
    g?.type === 'LineString' ? g.coordinates :
    g?.type === 'MultiLineString' ? (g.coordinates as number[][][]).flat() : undefined
  if (!coords || coords.length < 2) return ''
  const [minLng, minLat, maxLng, maxLat] = map.bbox
  const lngRange = (maxLng - minLng) || 0.0001
  const latRange = (maxLat - minLat) || 0.0001
  const padX = 5, padTop = 18, padBottom = 16
  const availW = 100 - padX * 2
  const availH = 133 - padTop - padBottom
  const scale = Math.min(availW / lngRange, availH / latRange)
  const offsetX = padX + (availW - lngRange * scale) / 2
  const offsetY = padTop + (availH - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coords.length / 120))
  const parts: string[] = []
  for (let i = 0; i < coords.length; i += stride) {
    const [lng, lat] = coords[i]
    const x = offsetX + (lng - minLng) * scale
    const y = offsetY + (maxLat - lat) * scale
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

// ─── Strava helpers ──────────────────────────────────────────────────────
const sportEmoji = (sport: string): string => {
  const map: Record<string, string> = {
    Run: '🏃', VirtualRun: '🏃', TrailRun: '🏃',
    Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚵', GravelRide: '🚵',
    Hike: '🥾', Walk: '🚶',
    Swim: '🏊', OpenWaterSwim: '🏊',
    Ski: '⛷️', AlpineSki: '⛷️', BackcountrySki: '⛷️', NordicSki: '⛷️',
    Snowboard: '🏂',
    Kayaking: '🛶', Canoeing: '🛶', Rowing: '🚣',
  }
  return map[sport] ?? '🗺️'
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─── Upload / parse ──────────────────────────────────────────────────────
const computeRouteData = (geojson: GeoJSON.FeatureCollection) => {
  const allCoords: [number, number, number?][] = []
  geojson.features.forEach((feature) => {
    if (feature.geometry.type === 'LineString') {
      allCoords.push(...(feature.geometry.coordinates as [number, number, number?][]))
    } else if (feature.geometry.type === 'MultiLineString') {
      const lines = feature.geometry.coordinates as [number, number, number?][][]
      lines.forEach((line) => allCoords.push(...line))
    }
  })
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  let distanceKm = 0, elevationGain = 0, elevationLoss = 0
  let lastElevation: number | null = null
  allCoords.forEach(([lng, lat, elevation], idx) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
    if (idx > 0) {
      distanceKm += haversineKm([allCoords[idx - 1][0], allCoords[idx - 1][1]], [lng, lat])
    }
    if (elevation !== undefined) {
      if (lastElevation !== null) {
        const diff = elevation - lastElevation
        if (diff > 0) elevationGain += diff
        else elevationLoss += Math.abs(diff)
      }
      lastElevation = elevation
    }
  })
  const elevations = allCoords.map((c) => c[2]).filter((e): e is number => e !== undefined)
  return {
    bbox: [minLng, minLat, maxLng, maxLat] as [number, number, number, number],
    pointCount: allCoords.length,
    stats: {
      distance_km: Math.round(distanceKm * 100) / 100,
      elevation_gain_m: Math.round(elevationGain),
      elevation_loss_m: Math.round(elevationLoss),
      max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
      min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
    } as RouteStats,
  }
}

const parseFile = async (file: File) => {
  isParsing.value = true
  parseError.value = null
  try {
    const text = await file.text()
    let geojson: GeoJSON.FeatureCollection
    if (file.name.endsWith('.gpx')) {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, 'text/xml')
      if (xmlDoc.documentElement.tagName === 'parseerror') throw new Error('Invalid GPX file format')
      geojson = toGeoJSON.gpx(xmlDoc)
    } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
      geojson = JSON.parse(text) as GeoJSON.FeatureCollection
      if (!geojson.features) throw new Error('Invalid GeoJSON format')
    } else {
      throw new Error('Unsupported file. Please use GPX or GeoJSON.')
    }
    if (!geojson.features || geojson.features.length === 0) throw new Error('No route found in file')
    parsedGeojson.value = geojson
    const { bbox, stats, pointCount } = computeRouteData(geojson)
    parsedStats.value = stats
    parsedBbox.value = bbox
    parsedPointCount.value = pointCount
    parsedSegments.value = extractNamedTrackSegments(geojson)
    if (!mapTitle.value) {
      mapTitle.value = file.name.replace(/\.(gpx|geojson|json)$/i, '').replace(/[-_]/g, ' ')
    }
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : 'Failed to parse file'
    parsedGeojson.value = null
    parsedStats.value = null
    parsedBbox.value = null
    parsedPointCount.value = 0
  } finally {
    isParsing.value = false
  }
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) parseFile(input.files[0])
}
const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) parseFile(event.dataTransfer.files[0])
}
const resetFile = () => {
  parsedGeojson.value = null
  parsedStats.value = null
  parsedBbox.value = null
  parsedPointCount.value = 0
  parsedSegments.value = []
  mapTitle.value = ''
  parseError.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const createMap = async () => {
  if (!user.value?.id || !mapTitle.value.trim() || !parsedGeojson.value || !parsedStats.value) return
  isCreating.value = true
  try {
    const response = await fetch('/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: mapTitle.value.trim(),
        geojson: parsedGeojson.value,
        bbox: parsedBbox.value,
        stats: parsedStats.value,
        trail_segments: parsedSegments.value.length > 0 ? parsedSegments.value : undefined,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to create map')
    }
    const data = await response.json()
    router.push(`/create/${data.id}/style`)
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : 'Failed to create map'
  } finally {
    isCreating.value = false
  }
}

// ─── Strava loading ──────────────────────────────────────────────────────
const loadStravaActivities = async (append = false) => {
  if (append) {
    stravaLoadingMore.value = true
  } else {
    stravaLoading.value = true
    stravaActivities.value = []
    stravaPage.value = 1
  }
  stravaError.value = null
  try {
    const response = await fetch(`/api/strava/activities?page=${stravaPage.value}&per_page=${ACTIVITIES_PER_PAGE}`)
    if (!response.ok) throw new Error('Failed to fetch Strava activities')
    const data = await response.json()
    if (data.connected) {
      stravaConnected.value = true
      const batch = data.activities ?? []
      if (append) stravaActivities.value.push(...batch)
      else stravaActivities.value = batch
      stravaHasMore.value = batch.length === ACTIVITIES_PER_PAGE
    } else {
      stravaConnected.value = false
      stravaActivities.value = []
      stravaHasMore.value = false
    }
  } catch (err) {
    stravaError.value = err instanceof Error ? err.message : 'Failed to load Strava activities'
  } finally {
    stravaLoading.value = false
    stravaLoadingMore.value = false
  }
}

const loadMore = async () => {
  stravaPage.value++
  await loadStravaActivities(true)
}

const importActivity = async (activity: any) => {
  importingId.value = activity.id
  try {
    const response = await fetch(`/api/strava/activities/${activity.id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: activity.name }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message ?? 'Failed to import activity')
    }
    const data = await response.json()
    router.push(`/create/${data.id}/style`)
  } catch (err) {
    stravaError.value = err instanceof Error ? err.message : 'Failed to import activity'
    importingId.value = null
  }
}

const disconnectStrava = async () => {
  isDisconnecting.value = true
  try {
    await fetch('/api/strava/disconnect', { method: 'DELETE' })
    stravaConnected.value = false
    stravaActivities.value = []
  } catch {
    stravaError.value = 'Failed to disconnect Strava. Please try again.'
  } finally {
    isDisconnecting.value = false
  }
}

onMounted(async () => {
  if (route.query.strava_connected === '1') activeMethod.value = 'strava'
  if (route.query.strava_error === 'access_denied') {
    activeMethod.value = 'strava'
    stravaError.value = 'Strava access was denied. Connect your account to import activities.'
  }
  if (route.query.strava_connected || route.query.strava_error) {
    router.replace({ query: {} })
  }
  await loadStravaActivities()
})

onBeforeUnmount(() => {
  if (drawMapInstance) {
    try { drawMapInstance.remove() } catch {}
    drawMapInstance = null
  }
})

// ─── Inline components ───────────────────────────────────────────────────

const Spinner = defineComponent({
  props: { class: { type: String, default: '' } },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          class: `animate-spin ${props.class}`,
          xmlns: 'http://www.w3.org/2000/svg',
          fill: 'none',
          viewBox: '0 0 24 24',
        },
        [
          h('circle', { class: 'opacity-25', cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 4 }),
          h('path', { class: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' }),
        ],
      )
  },
})

const InlineError = defineComponent({
  props: { message: { type: String, required: true }, class: { type: String, default: '' } },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: `flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 ${props.class}`,
        },
        [
          h('svg', { class: 'w-5 h-5 text-red-500 shrink-0 mt-0.5', viewBox: '0 0 20 20', fill: 'currentColor' }, [
            h('path', {
              'fill-rule': 'evenodd',
              'clip-rule': 'evenodd',
              d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z',
            }),
          ]),
          h('span', { class: 'text-sm text-red-800' }, props.message),
        ],
      )
  },
})

const StatCell = defineComponent({
  props: { label: { type: String, required: true }, value: { type: String, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'p-4 text-center' }, [
        h('p', { class: 'text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1' }, props.label),
        h(
          'p',
          {
            class: 'text-lg font-semibold text-stone-900 tabular-nums',
            style: "font-family:'Space Grotesk',sans-serif",
          },
          props.value,
        ),
      ])
  },
})

const PanelHeader = defineComponent({
  props: {
    eyebrow: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'mb-6' }, [
        h('p', { class: 'text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F] mb-2' }, props.eyebrow),
        h(
          'h2',
          {
            class: 'text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight mb-1',
            style: "font-family:'Space Grotesk',sans-serif",
          },
          props.title,
        ),
        h('p', { class: 'text-sm text-stone-500 leading-relaxed max-w-xl' }, props.body),
      ])
  },
})

const MethodCard = defineComponent({
  props: {
    method: { type: Object as any, required: true },
    active: { type: Boolean, default: false },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const toneClasses: Record<string, { bg: string; icon: string }> = {
      orange: { bg: 'bg-[#FC4C02]/10', icon: 'text-[#FC4C02]' },
      stone: { bg: 'bg-stone-900/5', icon: 'text-stone-700' },
      green: { bg: 'bg-[#2D6A4F]/10', icon: 'text-[#2D6A4F]' },
      amber: { bg: 'bg-amber-500/10', icon: 'text-amber-700' },
    }
    const icons: Record<string, () => any> = {
      strava: () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', class: 'w-5 h-5' }, [
          h('path', { d: 'M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172' }),
        ]),
      upload: () =>
        h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-5 h-5' }, [
          h('path', {
            'fill-rule': 'evenodd',
            'clip-rule': 'evenodd',
            d: 'M10 3a1 1 0 011 1v8.59l2.29-2.3a1 1 0 011.42 1.42l-4 4a1 1 0 01-1.42 0l-4-4a1 1 0 111.42-1.42L9 12.59V4a1 1 0 011-1zm-7 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z',
          }),
        ]),
      premade: () =>
        h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-5 h-5' }, [
          h('rect', { x: 3, y: 3, width: 6, height: 8, rx: 1 }),
          h('rect', { x: 11, y: 3, width: 6, height: 5, rx: 1 }),
          h('rect', { x: 3, y: 13, width: 6, height: 4, rx: 1 }),
          h('rect', { x: 11, y: 10, width: 6, height: 7, rx: 1 }),
        ]),
      draw: () =>
        h('svg', { viewBox: '0 0 20 20', fill: 'currentColor', class: 'w-5 h-5' }, [
          h('path', { d: 'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z' }),
          h('path', { d: 'M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z' }),
        ]),
    }
    const tone = computed(() => toneClasses[props.method.tone] ?? toneClasses.stone)
    return () =>
      h(
        'button',
        {
          onClick: () => emit('select'),
          class: [
            'relative group text-left p-4 rounded-2xl border-2 transition-all overflow-hidden',
            props.active
              ? 'border-stone-900 bg-white shadow-md shadow-stone-900/5 -translate-y-0.5'
              : 'border-stone-200 bg-white/60 hover:border-stone-300 hover:-translate-y-0.5',
          ],
        },
        [
          h('span', {
            class: [
              'w-10 h-10 rounded-full flex items-center justify-center mb-3',
              tone.value.bg,
              tone.value.icon,
            ],
          }, [icons[props.method.id]?.()]),
          h('p', {
            class: 'text-[15px] font-semibold text-stone-900 leading-tight mb-0.5',
            style: "font-family:'Space Grotesk',sans-serif",
          }, props.method.title),
          h('p', { class: 'text-xs text-stone-500 leading-snug' }, props.method.subtitle),
          props.active
            ? h('span', { class: 'absolute top-3 right-3 w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center' }, [
                h('svg', { class: 'w-3 h-3', viewBox: '0 0 20 20', fill: 'currentColor' }, [
                  h('path', {
                    'fill-rule': 'evenodd',
                    'clip-rule': 'evenodd',
                    d: 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z',
                  }),
                ]),
              ])
            : null,
        ],
      )
  },
})
</script>

<style scoped>
:deep(.maplibregl-ctrl-attrib) {
  font-size: 10px;
}
:deep(.maplibregl-canvas) {
  cursor: crosshair;
}
</style>
