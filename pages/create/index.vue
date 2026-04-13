<template>
  <div class="max-w-xl mx-auto space-y-8">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Create New Map</h1>
      <p class="mt-1 text-sm text-gray-500">
        Upload a GPX file or import from Strava to get started
      </p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200">
      <div class="flex gap-6">
        <button
          @click="activeTab = 'strava'"
          :class="[
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'strava'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          Import from Strava
        </button>
        <button
          @click="activeTab = 'upload'"
          :class="[
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'upload'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
        >
          Upload GPX
        </button>
      </div>
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
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 px-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50',
        ]"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".gpx,.geojson"
          class="hidden"
          @change="handleFileSelect"
        />
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
          <UIcon name="i-heroicons-arrow-up-tray" class="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p class="text-sm font-medium text-gray-700">
            Drop your file here, or <span class="text-green-600 underline underline-offset-2">browse</span>
          </p>
          <p class="mt-1 text-xs text-gray-400">GPX or GeoJSON · up to 50 MB</p>
        </div>
      </div>

      <!-- Parsing spinner -->
      <div v-if="isParsing" class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <svg class="h-4 w-4 animate-spin text-green-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-600">Parsing file…</span>
      </div>

      <!-- Error -->
      <UAlert
        v-if="parseError"
        color="red"
        icon="i-heroicons-exclamation-triangle-20-solid"
        :title="parseError"
        variant="subtle"
      />

      <!-- Parsed result -->
      <div v-if="parsedGeojson && parsedStats" class="space-y-5">

        <!-- Success banner + change file -->
        <div class="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-check-circle" class="h-4 w-4 text-green-600 shrink-0" />
            <span class="text-sm font-medium text-green-800">File parsed successfully</span>
          </div>
          <button
            @click="resetFile"
            class="text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
          >
            Change
          </button>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-lg bg-gray-50 px-4 py-3 text-center">
            <p class="text-lg font-bold text-gray-900">{{ (parsedStats.distance_km * 0.621371).toFixed(1) }}</p>
            <p class="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">Miles</p>
          </div>
          <div class="rounded-lg bg-gray-50 px-4 py-3 text-center">
            <p class="text-lg font-bold text-gray-900">{{ (parsedStats.elevation_gain_m * 3.28084).toFixed(0) }}</p>
            <p class="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">Elev gain (ft)</p>
          </div>
          <div class="rounded-lg bg-gray-50 px-4 py-3 text-center">
            <p class="text-lg font-bold text-gray-900">{{ parsedPointCount.toLocaleString() }}</p>
            <p class="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">Points</p>
          </div>
        </div>

        <!-- Map name -->
        <div class="space-y-1.5">
          <label class="block text-sm font-medium text-gray-700">Map name</label>
          <input
            v-model="mapTitle"
            type="text"
            placeholder="e.g., Mount Rainier Loop"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <!-- Create button -->
        <UButton
          @click="createMap"
          :loading="isCreating"
          :disabled="!mapTitle.trim() || isCreating"
          color="green"
          size="md"
          class="w-full justify-center"
        >
          Create Map
        </UButton>
      </div>
    </div>

    <!-- Tab 2: Strava Import -->
    <div v-show="activeTab === 'strava'" class="space-y-5">

      <!-- Loading spinner -->
      <div v-if="stravaLoading" class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <svg class="h-4 w-4 animate-spin text-green-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-600">Loading Strava activities…</span>
      </div>

      <!-- Error -->
      <UAlert
        v-else-if="stravaError"
        color="red"
        icon="i-heroicons-exclamation-triangle-20-solid"
        :title="stravaError"
        variant="subtle"
      />

      <!-- Not connected -->
      <div
        v-else-if="!stravaConnected"
        class="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-6 py-12 text-center"
      >
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
          <UIcon name="i-heroicons-link" class="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Connect Strava</h3>
          <p class="mt-1 text-xs text-gray-500">Import your activities directly from your Strava account</p>
        </div>
        <UButton
          href="/api/strava/connect"
          color="red"
          size="sm"
          external
        >
          Connect Strava Account
        </UButton>
      </div>

      <!-- Connected: activity list -->
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-gray-500">Select an activity to import as a new map.</p>
          <button
            @click="disconnectStrava"
            :disabled="isDisconnecting"
            class="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {{ isDisconnecting ? 'Disconnecting…' : 'Disconnect' }}
          </button>
        </div>
        <div
          v-for="activity in stravaActivities"
          :key="activity.id"
          class="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 gap-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ activity.name }}</p>
              <span class="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-600 shrink-0">
                {{ activity.sport_type }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-gray-500">
              {{ (activity.distance / 1609.34).toFixed(1) }} mi
              · {{ Math.round(activity.total_elevation_gain * 3.28084) }} ft gain
            </p>
            <p class="mt-0.5 text-xs text-gray-400">
              {{ new Date(activity.start_date).toLocaleDateString() }}
            </p>
          </div>
          <UButton
            size="sm"
            color="green"
            variant="soft"
            :loading="importingId === activity.id"
            :disabled="importingId !== null"
            @click="importActivity(activity)"
          >
            Import
          </UButton>
        </div>

        <div v-if="stravaActivities.length === 0" class="text-center py-8 text-sm text-gray-500">
          No recent activities found.
        </div>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import * as toGeoJSON from '@tmcw/togeojson'
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

// Strava
const stravaConnected = ref(false)
const stravaActivities = ref<any[]>([])
const stravaLoading = ref(false)
const stravaError = ref<string | null>(null)
const importingId = ref<number | null>(null)
const isDisconnecting = ref(false)

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

// Parse file
const parseFile = async (file: File) => {
  isParsing.value = true
  parseError.value = null

  try {
    const text = await file.text()

    let geojson: GeoJSON.FeatureCollection

    if (file.name.endsWith('.gpx')) {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, 'text/xml')

      if (xmlDoc.documentElement.tagName === 'parseerror') {
        throw new Error('Invalid GPX file format')
      }

      geojson = toGeoJSON.gpx(xmlDoc)
    } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
      geojson = JSON.parse(text) as GeoJSON.FeatureCollection
      if (!geojson.features) {
        throw new Error('Invalid GeoJSON format')
      }
    } else {
      throw new Error('Unsupported file format. Please use GPX or GeoJSON.')
    }

    if (!geojson.features || geojson.features.length === 0) {
      throw new Error('No features found in file')
    }

    parsedGeojson.value = geojson
    const { bbox, stats, pointCount } = computeRouteData(geojson)
    parsedStats.value = stats
    parsedBbox.value = bbox
    parsedPointCount.value = pointCount
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
  if (input.files && input.files[0]) {
    parseFile(input.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    parseFile(event.dataTransfer.files[0])
  }
}

const resetFile = () => {
  parsedGeojson.value = null
  parsedStats.value = null
  parsedBbox.value = null
  parsedPointCount.value = 0
  mapTitle.value = ''
  parseError.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const createMap = async () => {
  if (!user.value?.id || !mapTitle.value.trim() || !parsedGeojson.value || !parsedStats.value) {
    return
  }

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

const loadStravaActivities = async () => {
  stravaLoading.value = true
  stravaError.value = null

  try {
    const response = await fetch('/api/strava/activities')

    if (!response.ok) {
      throw new Error('Failed to fetch Strava activities')
    }

    const data = await response.json()

    if (data.connected) {
      stravaConnected.value = true
      stravaActivities.value = data.activities ?? []
    } else {
      stravaConnected.value = false
      stravaActivities.value = []
    }
  } catch (err) {
    stravaError.value = err instanceof Error ? err.message : 'Failed to load Strava activities'
  } finally {
    stravaLoading.value = false
  }
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
  // Auto-switch to Strava tab if returning from OAuth
  if (route.query.strava_connected === '1') {
    activeTab.value = 'strava'
  }

  // Show error if user denied access on Strava
  if (route.query.strava_error === 'access_denied') {
    activeTab.value = 'strava'
    stravaError.value = 'Strava access was denied. Connect your account to import activities.'
  }

  // Clean OAuth query params from URL without re-triggering navigation
  if (route.query.strava_connected || route.query.strava_error) {
    router.replace({ query: {} })
  }

  await loadStravaActivities()
})
</script>
