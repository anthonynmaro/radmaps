<template>
  <div class="max-w-xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14">

    <!-- Header -->
    <div class="mb-7">
      <h1 class="text-2xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">Create New Map</h1>
      <p class="mt-1 text-sm text-stone-500">
        Upload a GPX file or import from Strava to get started
      </p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6">
      <button
        @click="activeTab = 'strava'"
        :class="[
          'flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all min-h-[44px]',
          activeTab === 'strava'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-500 hover:text-stone-700',
        ]"
      >
        Import from Strava
      </button>
      <button
        @click="activeTab = 'upload'"
        :class="[
          'flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all min-h-[44px]',
          activeTab === 'upload'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-500 hover:text-stone-700',
        ]"
      >
        Upload GPX
      </button>
    </div>

    <!-- Tab 1: Upload GPX -->
    <div v-show="activeTab === 'upload'" class="space-y-5">

      <!-- Drop zone — hidden once file is parsed -->
      <div
        v-if="!parsedStats"
        @drop.prevent="handleDrop"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @click="($refs.fileInput as HTMLInputElement).click()"
        :class="[
          'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-14 px-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
            : 'border-stone-200 bg-stone-50 hover:border-[#2D6A4F]/50 hover:bg-[#2D6A4F]/5',
        ]"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".gpx,.geojson"
          class="hidden"
          @change="handleFileSelect"
        />
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-stone-100">
          <svg class="h-5 w-5 text-stone-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-stone-700">
            Drop your file here, or <span class="text-[#2D6A4F] underline underline-offset-2">browse</span>
          </p>
          <p class="mt-1 text-xs text-stone-400">GPX or GeoJSON · up to 50 MB</p>
        </div>
      </div>

      <!-- Parsing spinner -->
      <div v-if="isParsing" class="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3.5">
        <svg class="h-4 w-4 animate-spin text-[#2D6A4F] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-stone-600">Parsing file…</span>
      </div>

      <!-- Error -->
      <div v-if="parseError" class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
        <svg class="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <span class="text-sm text-red-700">{{ parseError }}</span>
      </div>

      <!-- Parsed result -->
      <div v-if="parsedGeojson && parsedStats" class="space-y-5">

        <!-- Success banner + change file -->
        <div class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm font-medium text-emerald-800">File parsed successfully</span>
          </div>
          <button
            @click="resetFile"
            class="text-xs text-emerald-700 underline underline-offset-2 hover:text-emerald-900 min-h-[32px] px-1"
          >
            Change
          </button>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-stone-50 px-4 py-3 text-center">
            <p class="text-xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
              {{ (parsedStats.distance_km * 0.621371).toFixed(1) }}
            </p>
            <p class="mt-0.5 text-[10px] uppercase tracking-wider text-stone-400">Miles</p>
          </div>
          <div class="rounded-xl bg-stone-50 px-4 py-3 text-center">
            <p class="text-xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
              {{ (parsedStats.elevation_gain_m * 3.28084).toFixed(0) }}
            </p>
            <p class="mt-0.5 text-[10px] uppercase tracking-wider text-stone-400">Elev gain ft</p>
          </div>
          <div class="rounded-xl bg-stone-50 px-4 py-3 text-center">
            <p class="text-xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
              {{ parsedPointCount.toLocaleString() }}
            </p>
            <p class="mt-0.5 text-[10px] uppercase tracking-wider text-stone-400">Points</p>
          </div>
        </div>

        <!-- Map name -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-stone-700">Map name</label>
          <input
            v-model="mapTitle"
            type="text"
            placeholder="e.g., Mount Rainier Loop"
            class="w-full rounded-xl border border-stone-200 px-4 py-3 text-base text-stone-900 placeholder-stone-400 focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 min-h-[48px]"
          />
        </div>

        <!-- Create button -->
        <button
          @click="createMap"
          :disabled="!mapTitle.trim() || isCreating"
          class="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 transition-colors min-h-[48px]"
        >
          <svg v-if="isCreating" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ isCreating ? 'Creating…' : 'Create Map' }}
        </button>
      </div>
    </div>

    <!-- Tab 2: Strava Import -->
    <div v-show="activeTab === 'strava'" class="space-y-5">

      <!-- Loading spinner -->
      <div v-if="stravaLoading" class="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-4">
        <svg class="h-4 w-4 animate-spin text-[#2D6A4F] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-stone-600">Loading Strava activities…</span>
      </div>

      <!-- Error -->
      <div v-else-if="stravaError" class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
        <svg class="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <span class="text-sm text-red-700">{{ stravaError }}</span>
      </div>

      <!-- Not connected -->
      <div
        v-else-if="!stravaConnected"
        class="flex flex-col items-center gap-4 rounded-2xl border border-stone-100 bg-stone-50 px-6 py-12 text-center"
      >
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
          <svg class="h-6 w-6 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
          </svg>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Connect Strava</h3>
          <p class="mt-1 text-xs text-stone-500 max-w-xs">Import your activities directly from your Strava account</p>
        </div>
        <a
          href="/api/strava/connect"
          class="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-xl transition-colors min-h-[48px]"
          style="background:#FC4C02"
        >
          Connect Strava Account
        </a>
      </div>

      <!-- Connected: activity list -->
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between py-1">
          <p class="text-xs text-stone-500">
            {{ stravaActivities.length }} activit{{ stravaActivities.length === 1 ? 'y' : 'ies' }} loaded
          </p>
          <button
            @click="disconnectStrava"
            :disabled="isDisconnecting"
            class="text-xs text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50 min-h-[32px] px-1"
          >
            {{ isDisconnecting ? 'Disconnecting…' : 'Disconnect' }}
          </button>
        </div>

        <!-- Activity cards -->
        <div
          v-for="activity in stravaActivities"
          :key="activity.id"
          :class="[
            'rounded-xl border px-4 py-3.5 transition-colors',
            activity.achievement_count > 0
              ? 'border-amber-200 bg-amber-50/40'
              : 'border-stone-100 bg-stone-50 hover:border-stone-200',
          ]"
        >
          <div class="flex items-start gap-3">

            <!-- Thumbnail or sport icon -->
            <div class="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-stone-200 flex items-center justify-center">
              <img
                v-if="activity.thumbnail_url"
                :src="activity.thumbnail_url"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <span v-else class="text-2xl leading-none">{{ sportEmoji(activity.sport_type) }}</span>
            </div>

            <!-- Text content -->
            <div class="min-w-0 flex-1">

              <!-- Name + sport type + achievement badges -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <p class="text-sm font-semibold text-stone-900 truncate">{{ activity.name }}</p>
                <span class="inline-flex items-center rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-600 shrink-0">
                  {{ activity.sport_type }}
                </span>
                <span v-if="activity.achievement_count > 0"
                  class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 shrink-0">
                  🏆 {{ activity.achievement_count }}
                </span>
                <span v-if="activity.pr_count > 0"
                  class="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 shrink-0">
                  PR ×{{ activity.pr_count }}
                </span>
              </div>

              <!-- Stats -->
              <p class="mt-0.5 text-xs text-stone-500">
                {{ (activity.distance / 1609.34).toFixed(1) }} mi
                · {{ Math.round(activity.total_elevation_gain * 3.28084).toLocaleString() }} ft gain
                <template v-if="activity.elapsed_time"> · {{ formatDuration(activity.elapsed_time) }}</template>
              </p>

              <!-- Location + date + photos toggle -->
              <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                <p v-if="activity.location" class="text-xs text-stone-500 font-medium">{{ activity.location }}</p>
                <span v-if="activity.location" class="text-stone-300 text-xs">·</span>
                <p class="text-xs text-stone-400">{{ new Date(activity.start_date).toLocaleDateString() }}</p>
                <button
                  v-if="activity.total_photo_count > 0"
                  @click="togglePhotos(activity.id)"
                  class="inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-[#2D6A4F] transition-colors"
                >
                  <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
                  </svg>
                  {{ activity.total_photo_count }} photo{{ activity.total_photo_count > 1 ? 's' : '' }}
                </button>
              </div>

              <!-- KOM / segment achievement entice -->
              <p
                v-if="activity.achievement_count > 0 && activity.achievement_count > activity.pr_count"
                class="mt-1.5 text-[10px] font-medium text-amber-700"
              >
                Segment achievement — make it a poster →
              </p>
            </div>

            <!-- Import button -->
            <button
              class="shrink-0 text-sm font-semibold text-[#2D6A4F] bg-[#2D6A4F]/10 hover:bg-[#2D6A4F]/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors min-h-[40px]"
              :disabled="importingId !== null"
              @click="importActivity(activity)"
            >
              <svg v-if="importingId === activity.id" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span v-else>Import</span>
            </button>
          </div>

          <!-- Photo strip (lazy-loaded on toggle) -->
          <div v-if="expandedPhotos[activity.id]" class="mt-3 pt-3 border-t border-stone-100">
            <div v-if="loadingPhotosId === activity.id" class="flex items-center gap-2">
              <svg class="h-3 w-3 animate-spin text-stone-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span class="text-xs text-stone-400">Loading photos…</span>
            </div>
            <div v-else-if="activityPhotos[activity.id]?.length" class="flex gap-2 overflow-x-auto pb-1">
              <img
                v-for="(url, idx) in activityPhotos[activity.id]"
                :key="idx"
                :src="url"
                class="h-20 w-20 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
            </div>
            <p v-else class="text-xs text-stone-400">No photos available for this activity.</p>
          </div>
        </div>

        <div v-if="stravaActivities.length === 0" class="text-center py-10 text-sm text-stone-500">
          No recent activities found.
        </div>

        <!-- Load more -->
        <button
          v-if="stravaHasMore"
          @click="loadMore"
          :disabled="stravaLoadingMore"
          class="w-full py-3 text-sm font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:border-stone-300 disabled:opacity-50 transition-colors min-h-[48px]"
        >
          <span v-if="stravaLoadingMore" class="flex items-center justify-center gap-2">
            <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading more…
          </span>
          <span v-else>Load more activities</span>
        </button>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import * as toGeoJSON from '@tmcw/togeojson'
import { extractNamedTrackSegments } from '~/utils/trail'
import type { RouteStats } from '~/types'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const router = useRouter()
const route = useRoute()
const user = useSupabaseUser()

const activeTab = ref<'upload' | 'strava'>('strava')
const isDragging = ref(false)
const isParsing = ref(false)
const isCreating = ref(false)
const fileInput = ref<HTMLInputElement>()
const mapTitle = ref('')
const parseError = ref<string | null>(null)
const parsedGeojson = ref<GeoJSON.FeatureCollection | null>(null)
const parsedStats = ref<RouteStats | null>(null)
const parsedBbox = ref<[number, number, number, number] | null>(null)
const parsedPointCount = ref(0)
const parsedSegments = ref<import('~/types').TrailSegment[]>([])

// Strava
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
const expandedPhotos = ref<Record<number, boolean>>({})
const activityPhotos = ref<Record<number, string[]>>({})
const loadingPhotosId = ref<number | null>(null)

const sportEmoji = (sport: string): string => {
  const map: Record<string, string> = {
    Run: '🏃', VirtualRun: '🏃', TrailRun: '🏃',
    Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚵', GravelRide: '🚵',
    Hike: '🥾', Walk: '🚶',
    Swim: '🏊', OpenWaterSwim: '🏊',
    Ski: '⛷️', AlpineSki: '⛷️', BackcountrySki: '⛷️', NordicSki: '⛷️',
    Snowboard: '🏂',
    Kayaking: '🛶', Canoeing: '🛶', Rowing: '🚣',
    Yoga: '🧘', Workout: '💪', WeightTraining: '🏋️',
  }
  return map[sport] ?? '🗺️'
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const togglePhotos = async (id: number) => {
  if (expandedPhotos.value[id]) {
    expandedPhotos.value[id] = false
    return
  }
  expandedPhotos.value[id] = true
  if (activityPhotos.value[id]) return
  loadingPhotosId.value = id
  try {
    const res = await fetch(`/api/strava/activities/${id}/photos`)
    const data = await res.json()
    activityPhotos.value[id] = (data.photos ?? []).map((p: any) => p.url).filter(Boolean)
  } catch {
    activityPhotos.value[id] = []
  } finally {
    loadingPhotosId.value = null
  }
}

// Compute route stats + bbox from GeoJSON
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
  let distanceKm = 0
  let elevationGain = 0, elevationLoss = 0
  let lastElevation: number | null = null

  allCoords.forEach(([lng, lat, elevation], idx) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)

    if (idx > 0) {
      const [pLng, pLat] = allCoords[idx - 1]
      const R = 6371
      const dLat = ((lat - pLat) * Math.PI) / 180
      const dLon = ((lng - pLng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((pLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
      distanceKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

  const elevations = allCoords.map(c => c[2]).filter((e): e is number => e !== undefined)

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
      throw new Error('Unsupported file format. Please use GPX or GeoJSON.')
    }

    if (!geojson.features || geojson.features.length === 0) throw new Error('No features found in file')

    parsedGeojson.value = geojson
    const { bbox, stats, pointCount } = computeRouteData(geojson)
    parsedStats.value = stats
    parsedBbox.value = bbox
    parsedPointCount.value = pointCount
    parsedSegments.value = extractNamedTrackSegments(geojson)
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

const loadStravaActivities = async (append = false) => {
  if (append) {
    stravaLoadingMore.value = true
  } else {
    stravaLoading.value = true
    stravaActivities.value = []
    stravaPage.value = 1
    expandedPhotos.value = {}
    activityPhotos.value = {}
  }
  stravaError.value = null
  try {
    const response = await fetch(`/api/strava/activities?page=${stravaPage.value}&per_page=${ACTIVITIES_PER_PAGE}`)
    if (!response.ok) throw new Error('Failed to fetch Strava activities')
    const data = await response.json()
    if (data.connected) {
      stravaConnected.value = true
      const batch = data.activities ?? []
      if (append) {
        stravaActivities.value.push(...batch)
      } else {
        stravaActivities.value = batch
      }
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
  if (route.query.strava_connected === '1') activeTab.value = 'strava'
  if (route.query.strava_error === 'access_denied') {
    activeTab.value = 'strava'
    stravaError.value = 'Strava access was denied. Connect your account to import activities.'
  }
  if (route.query.strava_connected || route.query.strava_error) {
    router.replace({ query: {} })
  }
  await loadStravaActivities()
})
</script>
