<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">

    <!-- Minimal header -->
    <header class="bg-white border-b px-5 py-3 flex items-center justify-between">
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="font-bold text-gray-900 tracking-tight">RadMaps</span>
      </NuxtLink>
      <div class="flex items-center gap-2">
        <UButton
          v-if="user"
          to="/create"
          color="green"
          size="sm"
        >
          Create your map
        </UButton>
        <template v-else>
          <UButton
            to="/auth/login"
            variant="ghost"
            color="gray"
            size="sm"
          >
            Sign in
          </UButton>
          <UButton
            to="/auth/login"
            color="green"
            size="sm"
          >
            Get started free
          </UButton>
        </template>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 flex flex-col items-center py-8 px-4 gap-6">

      <!-- Loading state -->
      <div v-if="pending" class="flex-1 flex items-center justify-center">
        <div class="w-10 h-10 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
      </div>

      <!-- Error state -->
      <div v-else-if="error || !map" class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <UIcon name="i-heroicons-map" class="w-12 h-12 text-gray-300" />
        <p class="text-gray-500">This map couldn't be found.</p>
        <UButton to="/" color="green" variant="soft">Go home</UButton>
      </div>

      <!-- Map display -->
      <template v-else>
        <!-- Map title + meta -->
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900">{{ map.title }}</h1>
          <p v-if="map.subtitle" class="mt-1 text-sm text-gray-500">{{ map.subtitle }}</p>
        </div>

        <!-- Poster preview -->
        <div class="w-full max-w-2xl" style="height: 70vh">
          <ClientOnly>
            <MapPreview
              :map="map"
              :style-config="map.style_config"
              class="w-full h-full"
            />
          </ClientOnly>
        </div>

        <!-- Stats strip -->
        <div v-if="map?.stats" class="flex items-center gap-6 text-sm text-gray-600">
          <span v-if="map.stats?.distance_km">
            <strong>{{ (map.stats.distance_km * 0.621371).toFixed(1) }}</strong> mi
          </span>
          <span v-if="map.stats?.elevation_gain_m">
            <strong>{{ Math.round(map.stats.elevation_gain_m * 3.28084).toLocaleString() }}</strong> ft gain
          </span>
          <span v-if="map.stats?.date">
            {{ new Date(map.stats.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}
          </span>
        </div>

        <!-- Share row -->
        <div class="flex items-center gap-2">
          <UButton
            icon="i-heroicons-link"
            color="gray"
            variant="soft"
            size="sm"
            @click="copyLink"
          >
            {{ copied ? 'Copied!' : 'Copy link' }}
          </UButton>
        </div>

        <!-- CTA for non-signed-in users -->
        <div
          v-if="!user"
          class="w-full max-w-lg rounded-2xl border border-green-200 bg-green-50 px-6 py-6 text-center space-y-3"
        >
          <h2 class="text-lg font-semibold text-green-900">Turn your trails into art</h2>
          <p class="text-sm text-green-800">
            Create a custom map from your Strava activities or any route from your watch — then order a high-quality print delivered to your door.
          </p>
          <div class="flex items-center justify-center gap-3">
            <UButton to="/auth/login" color="green" size="md">
              Sign up free
            </UButton>
            <UButton to="/" variant="ghost" color="gray" size="md">
              Learn more
            </UButton>
          </div>
        </div>

        <!-- CTA for signed-in users -->
        <div
          v-else
          class="w-full max-w-lg rounded-2xl border border-gray-200 bg-white px-6 py-5 text-center space-y-3"
        >
          <p class="text-sm text-gray-600">Create a map from your own activities</p>
          <UButton to="/create" color="green" size="sm">Create your map</UButton>
        </div>

      </template>
    </main>

  </div>
</template>

<script setup lang="ts">
import type { TrailMap } from '~/types'
import { DEFAULT_STYLE_CONFIG } from '~/types'

definePageMeta({ layout: false })

const route = useRoute()
const user = useSupabaseUser()
const id = computed(() => route.params.id as string)

const { data: map, pending, error } = await useFetch<TrailMap>(
  () => `/api/maps/public/${id.value}`,
  {
    transform: (raw: any) => ({
      ...raw,
      style_config: { ...DEFAULT_STYLE_CONFIG, ...(raw.style_config ?? {}) },
    }),
  },
)

const copied = ref(false)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  } catch {
    // Fallback: select the URL bar
  }
}

const ogImage = computed(() =>
  map.value?.render_url ?? map.value?.thumbnail_url ?? undefined
)

const pageDescription = computed(() => {
  const s = map.value?.stats
  if (!s) return 'A custom trail map made with RadMaps.'
  const miles = (s.distance_km * 0.621371).toFixed(1)
  const gain = Math.round(s.elevation_gain_m * 3.28084).toLocaleString()
  return `${miles} miles · ${gain} ft gain — made with RadMaps`
})

useHead({
  title: computed(() => map.value ? `${map.value.title} — RadMaps` : 'RadMaps'),
})

useSeoMeta({
  description: pageDescription,
  ogSiteName: 'RadMaps',
  ogType: 'website',
  ogUrl: computed(() => `https://radmaps.studio/map/${id.value}`),
  ogTitle: computed(() => map.value?.title ?? 'RadMaps'),
  ogDescription: pageDescription,
  ogImage,
  twitterCard: 'summary_large_image',
  twitterTitle: computed(() => map.value?.title ?? 'RadMaps'),
  twitterDescription: pageDescription,
  twitterImage: ogImage,
})
</script>
