<template>
  <div>

    <!-- ════════════════════════════════════════════════════════════
         HERO — dark, full-height, live map on the right
         ════════════════════════════════════════════════════════════ -->
    <section class="hero-section relative min-h-[100dvh] flex flex-col" style="background:#0C1910">

      <!-- Noise texture overlay -->
      <div class="absolute inset-0 pointer-events-none opacity-[0.03]" style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:200px" />

      <!-- Dark nav (overrides default layout nav on this page) -->
      <nav class="relative z-20 max-w-6xl mx-auto w-full px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <svg class="w-7 h-7 text-[#52B788]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.15"/>
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
            <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.55"/>
            <path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="currentColor" stroke-width="0.7" fill="none" opacity="0.4"/>
            <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
          </svg>
          <span class="text-[15px] font-bold tracking-tight text-white" style="font-family:'Space Grotesk',sans-serif">
            Rad Maps
          </span>
        </NuxtLink>

        <div class="flex items-center gap-4">
          <NuxtLink v-if="user" to="/dashboard"
            class="text-sm font-medium text-white/60 hover:text-white transition-colors">My Maps</NuxtLink>
          <template v-if="!user">
            <NuxtLink to="/auth/login"
              class="text-sm font-medium text-white/60 hover:text-white transition-colors">Log in</NuxtLink>
          </template>
          <NuxtLink :to="user ? '/create' : '/auth/login'">
            <button class="text-sm font-semibold bg-[#2D6A4F] hover:bg-[#387D5E] text-white px-4 py-2 rounded-lg transition-colors border border-[#52B788]/20">
              {{ user ? 'Create a map' : 'Get started' }}
            </button>
          </NuxtLink>
        </div>
      </nav>

      <!-- Hero content -->
      <div class="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 py-12 grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">

        <!-- Left: Copy -->
        <div>
          <!-- Eyebrow -->
          <div class="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-[#52B788]/25 bg-[#52B788]/8">
            <span class="w-1.5 h-1.5 rounded-full bg-[#52B788] animate-pulse" />
            <span class="text-xs font-semibold tracking-widest uppercase text-[#52B788]/90">Trail Poster Prints</span>
          </div>

          <h1 class="text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6 text-white" style="font-family:'Playfair Display',serif">
            Your trails.<br/>
            <em class="not-italic text-[#52B788]">Beautifully framed.</em>
          </h1>

          <p class="text-lg text-white/55 leading-relaxed mb-10 max-w-md">
            Upload a GPX file or connect Strava. We'll turn your routes into stunning topographic
            posters — printed on museum-quality paper and shipped worldwide.
          </p>

          <!-- CTAs -->
          <div v-if="!user" class="flex flex-wrap gap-3">
            <NuxtLink to="/create">
              <button class="group flex items-center gap-2 bg-[#52B788] hover:bg-[#63C99A] text-[#0C1910] font-semibold px-6 py-3 rounded-xl transition-all text-sm">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm4.5 11h-3.5v3.5c0 .55-.45 1-1 1s-1-.45-1-1V11H5.5c-.55 0-1-.45-1-1s.45-1 1-1H9V5.5c0-.55.45-1 1-1s1 .45 1 1V9h3.5c.55 0 1 .45 1 1s-.45 1-1 1z"/>
                </svg>
                Create your map
                <svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3l5 5-5 5"/>
                </svg>
              </button>
            </NuxtLink>
            <NuxtLink to="/api/strava/connect">
              <button class="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm">
                <!-- Strava orange bolt -->
                <svg class="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
                </svg>
                Import from Strava
              </button>
            </NuxtLink>
          </div>
          <div v-else>
            <NuxtLink to="/dashboard">
              <button class="group flex items-center gap-2 bg-[#52B788] hover:bg-[#63C99A] text-[#0C1910] font-semibold px-6 py-3 rounded-xl transition-all text-sm">
                Go to your maps
                <svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </button>
            </NuxtLink>
          </div>

          <!-- Social proof -->
          <p class="mt-8 text-xs text-white/30 tracking-wide">
            Printed via Gelato · 130+ facilities · Ships to 32 countries
          </p>
        </div>

        <!-- Right: Live poster mockup -->
        <div class="flex items-center justify-center lg:justify-end">
          <div class="poster-wrap" style="transform:rotate(1.5deg)">
            <!-- Paper poster frame -->
            <div class="bg-[#F7F3EE] shadow-[0_40px_80px_rgba(0,0,0,0.6)] rounded-sm overflow-hidden w-[340px]" style="aspect-ratio:18/24">
              <!-- Title band -->
              <div class="px-6 py-3 border-b border-stone-300/60 flex flex-col items-center">
                <p class="text-[11px] font-bold tracking-[0.2em] uppercase text-stone-700" style="font-family:'Space Grotesk',sans-serif">
                  Maroon Bells
                </p>
                <p class="text-[9px] tracking-widest uppercase text-stone-400 mt-0.5">
                  Aspen, Colorado · 3,862 m
                </p>
              </div>

              <!-- Live MapLibre map -->
              <div class="relative flex-1" style="height:calc(100% - 88px)">
                <ClientOnly>
                  <div ref="heroMapEl" class="absolute inset-0" />
                  <template #fallback>
                    <!-- SSR placeholder that looks like a topo map -->
                    <div class="absolute inset-0 bg-[#e8dfd0] flex items-center justify-center">
                      <svg viewBox="0 0 200 270" class="w-full h-full opacity-40" fill="none">
                        <ellipse cx="100" cy="135" rx="80" ry="60" stroke="#a09070" stroke-width="1"/>
                        <ellipse cx="100" cy="135" rx="60" ry="44" stroke="#a09070" stroke-width="0.8"/>
                        <ellipse cx="100" cy="135" rx="40" ry="29" stroke="#a09070" stroke-width="0.6"/>
                        <ellipse cx="100" cy="135" rx="20" ry="14" stroke="#a09070" stroke-width="0.5"/>
                        <path d="M40 100 Q70 80 100 90 Q130 100 160 80" stroke="#C0392B" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </template>
                </ClientOnly>
              </div>

              <!-- Footer band -->
              <div class="px-6 py-2.5 border-t border-stone-300/60 flex items-center justify-between">
                <div>
                  <p class="text-[9px] font-bold tracking-widest uppercase text-stone-600">12.4 mi · 3,240 ft</p>
                  <p class="text-[8px] tracking-widest uppercase text-stone-400 mt-0.5">Loop Trail</p>
                </div>
                <svg viewBox="0 0 32 32" class="w-6 h-6 text-stone-400" fill="none">
                  <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.5"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Bottom fade -->
      <div class="absolute bottom-0 inset-x-0 h-24 pointer-events-none" style="background:linear-gradient(to bottom, transparent, #0C1910 90%)" />
    </section>


    <!-- ════════════════════════════════════════════════════════════
         FEATURES — light paper tone
         ════════════════════════════════════════════════════════════ -->
    <section class="bg-[#F7F4F0] border-y border-stone-200/60 py-20">
      <div class="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-10">

        <div v-for="feat in features" :key="feat.title" class="flex gap-4">
          <div class="shrink-0 w-10 h-10 rounded-xl bg-[#2D6A4F]/10 flex items-center justify-center mt-0.5">
            <div class="w-5 h-5 text-[#2D6A4F]" v-html="feat.icon" />
          </div>
          <div>
            <h3 class="font-semibold text-stone-900 mb-1.5 text-[15px]">{{ feat.title }}</h3>
            <p class="text-sm text-stone-500 leading-relaxed">{{ feat.desc }}</p>
          </div>
        </div>

      </div>
    </section>


    <!-- ════════════════════════════════════════════════════════════
         HOW IT WORKS
         ════════════════════════════════════════════════════════════ -->
    <section class="py-24 max-w-6xl mx-auto px-6">
      <div class="text-center mb-16">
        <p class="text-xs font-bold tracking-widest uppercase text-[#2D6A4F] mb-3">Simple process</p>
        <h2 class="text-3xl font-bold text-stone-900" style="font-family:'Playfair Display',serif">
          From trail to wall in three steps
        </h2>
      </div>

      <div class="grid md:grid-cols-3 gap-4">
        <div v-for="(step, i) in steps" :key="i"
          class="relative bg-stone-50 border border-stone-200/80 rounded-2xl p-8 hover:border-[#2D6A4F]/30 hover:bg-[#2D6A4F]/[0.02] transition-all group">
          <!-- Step number -->
          <div class="text-[64px] font-black leading-none text-stone-100 absolute top-6 right-6 select-none group-hover:text-[#2D6A4F]/10 transition-colors" style="font-family:'Space Grotesk',sans-serif">
            {{ String(i + 1).padStart(2, '0') }}
          </div>
          <div class="w-10 h-10 rounded-xl bg-[#2D6A4F]/10 flex items-center justify-center mb-5">
            <div class="w-5 h-5 text-[#2D6A4F]" v-html="step.icon" />
          </div>
          <h3 class="font-semibold text-stone-900 mb-2 text-[15px]">{{ step.title }}</h3>
          <p class="text-sm text-stone-500 leading-relaxed">{{ step.desc }}</p>
        </div>
      </div>
    </section>


    <!-- ════════════════════════════════════════════════════════════
         PRINT SIZES — visual cards
         ════════════════════════════════════════════════════════════ -->
    <section class="bg-[#0C1910] py-24">
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-14">
          <p class="text-xs font-bold tracking-widest uppercase text-[#52B788] mb-3">Sizes & formats</p>
          <h2 class="text-3xl font-bold text-white" style="font-family:'Playfair Display',serif">
            Every size, every wall
          </h2>
          <p class="text-stone-400 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
            From desk-side postcards to gallery-sized statement pieces.
            Archival inks, 300 DPI precision.
          </p>
        </div>

        <div class="grid grid-cols-4 md:grid-cols-8 gap-2">
          <div v-for="size in printSizes" :key="size.label"
            class="group flex flex-col items-center gap-2 p-3 rounded-xl border border-white/8 hover:border-[#52B788]/40 hover:bg-[#52B788]/5 cursor-pointer transition-all">
            <!-- Visual proportional rectangle -->
            <div class="w-full flex items-end justify-center" style="height:44px">
              <div class="bg-white/10 group-hover:bg-[#52B788]/20 rounded transition-colors border border-white/15"
                :style="{ width: size.w + 'px', height: size.h + 'px' }" />
            </div>
            <p class="text-[10px] font-semibold text-white/70 tracking-wide">{{ size.label }}</p>
            <p class="text-[9px] text-white/35 -mt-1">{{ size.type }}</p>
          </div>
        </div>
      </div>
    </section>


    <!-- ════════════════════════════════════════════════════════════
         FINAL CTA
         ════════════════════════════════════════════════════════════ -->
    <section class="py-24 max-w-6xl mx-auto px-6">
      <div class="bg-gradient-to-br from-[#1B3A2A] to-[#2D6A4F] rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
        <!-- Decorative topo rings -->
        <svg class="absolute inset-0 w-full h-full opacity-5 pointer-events-none" viewBox="0 0 600 300" fill="none" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="300" cy="150" rx="220" ry="110" stroke="white" stroke-width="2"/>
          <ellipse cx="300" cy="150" rx="170" ry="85" stroke="white" stroke-width="1.5"/>
          <ellipse cx="300" cy="150" rx="120" ry="60" stroke="white" stroke-width="1"/>
          <ellipse cx="300" cy="150" rx="70" ry="35" stroke="white" stroke-width="0.8"/>
          <ellipse cx="300" cy="150" rx="30" ry="15" stroke="white" stroke-width="0.5"/>
        </svg>
        <div class="relative">
          <p class="text-xs font-bold tracking-widest uppercase text-[#52B788]/80 mb-4">Ready to start?</p>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4" style="font-family:'Playfair Display',serif">
            Hang your next adventure on the wall.
          </h2>
          <p class="text-white/50 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
            Your GPX is just a drag-and-drop away from becoming something beautiful.
          </p>
          <NuxtLink to="/create">
            <button class="inline-flex items-center gap-2 bg-[#52B788] hover:bg-[#63C99A] text-[#0C1910] font-bold px-8 py-3.5 rounded-xl transition-all text-sm">
              Create your first map — it's free to start
            </button>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-stone-200 py-8">
      <div class="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-[#2D6A4F]" viewBox="0 0 32 32" fill="none">
            <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
          <span class="text-sm font-semibold text-stone-700" style="font-family:'Space Grotesk',sans-serif">Rad Maps</span>
        </div>
        <p class="text-xs text-stone-400">© 2026 Rad Maps · radmaps.studio</p>
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

definePageMeta({ layout: false })

const user = useSupabaseUser()
const config = useRuntimeConfig()

// ── Hero map ──────────────────────────────────────────────────────────────────

const heroMapEl = ref<HTMLDivElement | null>(null)
const TOKEN = config.public.mapboxToken as string

// Maroon Bells loop trail, Colorado
const TRAIL_COORDS = [
  [-106.9437,39.0706],[-106.9447,39.0714],[-106.9458,39.0724],[-106.9468,39.0738],
  [-106.9476,39.0754],[-106.9481,39.0772],[-106.9482,39.0791],[-106.9478,39.0808],
  [-106.9469,39.0824],[-106.9457,39.0838],[-106.9442,39.0851],[-106.9424,39.0860],
  [-106.9405,39.0866],[-106.9386,39.0869],[-106.9368,39.0868],[-106.9352,39.0862],
  [-106.9338,39.0852],[-106.9327,39.0840],[-106.9320,39.0825],[-106.9317,39.0809],
  [-106.9319,39.0793],[-106.9325,39.0779],[-106.9335,39.0765],[-106.9348,39.0752],
  [-106.9362,39.0740],[-106.9377,39.0729],[-106.9393,39.0720],[-106.9410,39.0713],
  [-106.9426,39.0709],[-106.9437,39.0706],
]

onMounted(async () => {
  await nextTick()
  if (!heroMapEl.value || !TOKEN) return

  const map = new maplibregl.Map({
    container: heroMapEl.value,
    style: {
      version: 8,
      glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${TOKEN}`,
      sources: {
        'outdoors': {
          type: 'raster',
          tiles: [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${TOKEN}`],
          tileSize: 512,
        },
        'dem': {
          type: 'raster-dem',
          tiles: [`https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.webp?access_token=${TOKEN}`],
          tileSize: 512, encoding: 'mapbox',
        },
        'terrain-v2': {
          type: 'vector',
          tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${TOKEN}`],
          minzoom: 9, maxzoom: 15,
        },
        'trail': {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: null,
            geometry: { type: 'LineString', coordinates: TRAIL_COORDS },
          },
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#e8dfd0' } },
        { id: 'base', type: 'raster', source: 'outdoors', paint: { 'raster-opacity': 0.78, 'raster-saturation': -0.1 } },
        { id: 'hillshade', type: 'hillshade', source: 'dem',
          paint: { 'hillshade-exaggeration': 0.5, 'hillshade-illumination-direction': 335 } },
        { id: 'contours-minor', type: 'line', source: 'terrain-v2', 'source-layer': 'contour',
          filter: ['==', ['get', 'index'], 1],
          paint: { 'line-color': '#9b8b72', 'line-width': 0.5, 'line-opacity': 0.55 } },
        { id: 'contours-major', type: 'line', source: 'terrain-v2', 'source-layer': 'contour',
          filter: ['==', ['get', 'index'], 10],
          paint: { 'line-color': '#7a6a54', 'line-width': 1.0, 'line-opacity': 0.75 } },
        { id: 'contour-labels', type: 'symbol', source: 'terrain-v2', 'source-layer': 'contour',
          filter: ['==', ['get', 'index'], 10],
          layout: { 'symbol-placement': 'line', 'symbol-spacing': 400,
            'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
            'text-size': 9, 'text-pitch-alignment': 'viewport' },
          paint: { 'text-color': '#7a6a54', 'text-halo-color': 'rgba(240,235,226,0.9)', 'text-halo-width': 1.5 } },
        { id: 'trail-casing', type: 'line', source: 'trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fff', 'line-width': 5, 'line-opacity': 0.9 } },
        { id: 'trail-line', type: 'line', source: 'trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#C0392B', 'line-width': 2.8 } },
      ],
    } as maplibregl.StyleSpecification,
    center: [-106.926, 39.078],
    zoom: 12.8,
    pitch: 35,
    bearing: -20,
    interactive: false,
    attributionControl: false,
  })

  // Slow pan for life
  let angle = 0
  const pan = () => {
    angle = (angle + 0.01) % 360
    map.rotateTo(angle * 0.05, { duration: 0, easing: t => t })
    requestAnimationFrame(pan)
  }
  map.on('load', () => requestAnimationFrame(pan))
})

// ── Static data ────────────────────────────────────────────────────────────────

const features = [
  {
    title: 'Real topographic detail',
    desc: 'Hillshade, contour lines, and elevation labels from Mapbox terrain data — every summit, ridge, and valley captured.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 17 L7 7 L11 12 L14 8 L18 17"/>
      <path d="M1 14 Q6 12 10 13 Q14 14 19 12"/>
    </svg>`,
  },
  {
    title: 'Any route, any source',
    desc: 'Drag in a GPX file from Garmin, Komoot, AllTrails, or Strava — or import your activity library directly with OAuth.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4,14 4,4 10,10 16,4 16,14"/>
      <line x1="4" y1="17" x2="16" y2="17"/>
    </svg>`,
  },
  {
    title: 'Printed & shipped worldwide',
    desc: '300 DPI archival prints via Gelato\'s 130+ facilities. Arrives in 5–10 days, almost anywhere on the planet.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="16" height="11" rx="1"/>
      <path d="M6 7 V5 a4 4 0 0 1 8 0 v2"/>
      <line x1="10" y1="11" x2="10" y2="14"/>
    </svg>`,
  },
]

const steps = [
  {
    title: 'Upload your route',
    desc: 'Drop any GPX or GeoJSON file, or import directly from your Strava activity feed.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2 L10 13 M6 6 L10 2 L14 6"/>
      <path d="M3 16 L3 17 Q3 18 4 18 L16 18 Q17 18 17 17 L17 16"/>
    </svg>`,
  },
  {
    title: 'Style it your way',
    desc: 'Choose from topographic or minimalist base maps. Dial in colours, contours, fonts, and poster size.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="3"/>
      <path d="M10 2 L10 4 M10 16 L10 18 M2 10 L4 10 M16 10 L18 10 M4.2 4.2 L5.6 5.6 M14.4 14.4 L15.8 15.8 M4.2 15.8 L5.6 14.4 M14.4 5.6 L15.8 4.2"/>
    </svg>`,
  },
  {
    title: 'Order your print',
    desc: 'From 5×7" desk prints to 24×36" wall posters. Or grab the high-res digital file for $9.99.',
    icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 2 h12 v3 H4 z"/>
      <path d="M2 5 h16 l-1.5 11 Q16.3 17 15.5 17 h-11 Q3.7 17 3.5 16 z"/>
      <line x1="8" y1="10" x2="12" y2="10"/>
    </svg>`,
  },
]

const printSizes = [
  { label: '5×7"', type: 'Postcard', w: 16, h: 22 },
  { label: '8×10"', type: 'Desk', w: 18, h: 23 },
  { label: '11×14"', type: 'Medium', w: 20, h: 26 },
  { label: '12×16"', type: 'Standard', w: 21, h: 28 },
  { label: '18×24"', type: 'Poster', w: 26, h: 35 },
  { label: '24×36"', type: 'Grand', w: 28, h: 42 },
  { label: 'Canvas', type: 'Wrapped', w: 24, h: 30 },
  { label: 'Framed', type: 'Display', w: 24, h: 30 },
]
</script>

<style scoped>
.poster-wrap {
  filter: drop-shadow(0 60px 80px rgba(0,0,0,0.7));
}
</style>
