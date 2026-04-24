<template>
  <div class="relative min-h-[100dvh]">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">

      <!-- Celebratory mark -->
      <div class="flex flex-col items-center text-center mb-10">
        <div class="relative mb-6">
          <div class="w-20 h-20 rounded-full bg-[#2D6A4F] flex items-center justify-center shadow-lg shadow-[#2D6A4F]/20">
            <svg class="w-10 h-10 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="absolute inset-0 rounded-full bg-[#2D6A4F] animate-ping opacity-30" />
        </div>

        <p class="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F] mb-3">
          Order confirmed
        </p>
        <h1
          class="text-4xl sm:text-5xl tracking-tight text-stone-900 leading-tight mb-3"
          style="font-family:'Playfair Display',serif"
        >
          Your print is on the way.
        </h1>
        <p class="text-stone-500 max-w-md leading-relaxed">
          Thanks for ordering <strong class="text-stone-800 font-semibold">{{ premade?.title ?? 'your trail poster' }}</strong>.
          You'll receive a confirmation email shortly, then tracking details once it ships.
        </p>
      </div>

      <!-- Order card -->
      <div v-if="premade" class="bg-white/70 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 mb-6">
        <div class="flex gap-5 items-start">
          <div
            class="w-28 shrink-0 rounded-lg overflow-hidden border border-stone-200"
            style="aspect-ratio:3/4"
            :style="{ backgroundColor: premade.style_config.background_color }"
          >
            <img v-if="premade.preview_image_url" :src="premade.preview_image_url" class="w-full h-full object-cover" />
            <svg v-else viewBox="0 0 100 133" class="w-full h-full">
              <path v-if="routePath" :d="routePath" fill="none" :stroke="premade.style_config.route_color" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1">{{ premade.region }}</p>
            <p class="text-xl font-semibold text-stone-900 leading-snug mb-1" style="font-family:'Space Grotesk',sans-serif">
              {{ premade.title }}
            </p>
            <p class="text-sm text-stone-500 mb-3">{{ premade.subtitle }}</p>
            <p class="text-xs font-medium text-stone-700">
              {{ formatKm(premade.stats.distance_km) }}
              <span class="text-stone-300 mx-1.5">·</span>
              {{ formatM(premade.stats.elevation_gain_m) }} ↑
            </p>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="border border-stone-200 rounded-2xl bg-white/70 backdrop-blur-sm overflow-hidden mb-10">
        <div class="grid grid-cols-3 divide-x divide-stone-200">
          <div class="p-5 text-center">
            <div class="w-8 h-8 mx-auto rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-xs font-bold mb-2">1</div>
            <p class="text-[10px] font-semibold tracking-[0.14em] uppercase text-stone-700 mb-1">Paid</p>
            <p class="text-xs text-stone-500">Just now</p>
          </div>
          <div class="p-5 text-center">
            <div class="w-8 h-8 mx-auto rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold mb-2">2</div>
            <p class="text-[10px] font-semibold tracking-[0.14em] uppercase text-stone-400 mb-1">In production</p>
            <p class="text-xs text-stone-400">1–2 days</p>
          </div>
          <div class="p-5 text-center">
            <div class="w-8 h-8 mx-auto rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold mb-2">3</div>
            <p class="text-[10px] font-semibold tracking-[0.14em] uppercase text-stone-400 mb-1">Shipped</p>
            <p class="text-xs text-stone-400">5–10 business days</p>
          </div>
        </div>
      </div>

      <!-- Upsell for guests: create account -->
      <div v-if="!user" class="relative overflow-hidden rounded-2xl bg-stone-900 text-white p-6 sm:p-8 mb-8">
        <svg class="absolute inset-0 w-full h-full opacity-15 pointer-events-none" viewBox="0 0 800 200" preserveAspectRatio="none">
          <g stroke="#52B788" stroke-width="1" fill="none">
            <path d="M0 60 Q200 40 400 60 T800 50" />
            <path d="M0 100 Q200 80 400 100 T800 90" />
            <path d="M0 140 Q200 120 400 140 T800 130" />
          </g>
        </svg>
        <div class="relative max-w-lg">
          <p class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#52B788] mb-3">
            One more thing
          </p>
          <h2 class="text-2xl sm:text-3xl leading-tight mb-3" style="font-family:'Playfair Display',serif">
            Want a poster of <em class="not-italic text-[#52B788]">your</em> trail next?
          </h2>
          <p class="text-white/60 text-sm mb-5 leading-relaxed">
            Create a free account to bring in routes from Strava, your watch, or any trail app —
            we'll turn them into fully-custom posters designed exactly how you want.
          </p>
          <NuxtLink to="/auth/login">
            <button class="inline-flex items-center gap-2 bg-[#52B788] hover:bg-[#63C99A] text-stone-900 font-semibold px-5 py-3 rounded-full text-sm transition-colors">
              Create a free account
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </NuxtLink>
        </div>
      </div>

      <!-- Secondary actions -->
      <div class="flex flex-wrap items-center justify-center gap-3 text-sm">
        <NuxtLink to="/shop">
          <button class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-stone-200 bg-white hover:border-stone-300 text-stone-700 font-medium transition-colors">
            <svg class="w-4 h-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3V3a1 1 0 00-1-1z"/>
            </svg>
            Keep browsing
          </button>
        </NuxtLink>
        <NuxtLink v-if="user" to="/">
          <button class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white font-semibold transition-colors">
            View my maps
            <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </button>
        </NuxtLink>
      </div>

      <p v-if="sessionId" class="text-[11px] text-stone-400 text-center mt-10 tracking-wide">
        Reference: <span class="font-mono">{{ sessionId }}</span>
      </p>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import { getPremadeBySlug } from '~/data/premade-maps'

definePageMeta({ layout: 'default' })

const route = useRoute()
const user = useSupabaseUser()
const slug = route.params.slug as string
const premade = getPremadeBySlug(slug)
const sessionId = route.query.session_id as string | undefined

useHead(() => ({
  title: premade ? `Order confirmed — ${premade.title}` : 'Order confirmed — RadMaps',
}))

const formatKm = (km?: number) => {
  if (km == null) return '—'
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`
}
const formatM = (m?: number) => {
  if (m == null) return '—'
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// Summary thumbnail route
const routePath = computed(() => {
  if (!premade) return ''
  const feat = premade.geojson?.features?.[0]
  const g = feat?.geometry as any
  const coords: number[][] | undefined =
    g?.type === 'LineString' ? g.coordinates :
    g?.type === 'MultiLineString' ? (g.coordinates as number[][][]).flat() : undefined
  if (!coords || coords.length < 2) return ''
  const [minLng, minLat, maxLng, maxLat] = premade.bbox
  const lngRange = (maxLng - minLng) || 0.0001
  const latRange = (maxLat - minLat) || 0.0001
  const padX = 6, padY = 14
  const availW = 100 - padX * 2
  const availH = 133 - padY * 2
  const scale = Math.min(availW / lngRange, availH / latRange)
  const offsetX = padX + (availW - lngRange * scale) / 2
  const offsetY = padY + (availH - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coords.length / 80))
  const parts: string[] = []
  for (let i = 0; i < coords.length; i += stride) {
    const [lng, lat] = coords[i]
    const x = offsetX + (lng - minLng) * scale
    const y = offsetY + (maxLat - lat) * scale
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return parts.join(' ')
})
</script>
