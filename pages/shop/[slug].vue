<template>
  <div v-if="!premade" class="max-w-3xl mx-auto px-6 py-24 text-center">
    <h1 class="text-2xl font-semibold text-stone-900 mb-2" style="font-family:'Space Grotesk',sans-serif">
      Print not found
    </h1>
    <p class="text-stone-500">We couldn't find that poster. Back to <NuxtLink to="/shop" class="text-[#2D6A4F] font-semibold hover:underline">the shop</NuxtLink>.</p>
  </div>

  <div v-else class="relative min-h-[100dvh]">
    <!-- paper texture -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      <!-- Back -->
      <NuxtLink to="/shop" class="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] uppercase text-stone-500 hover:text-stone-900 transition-colors mb-8">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
        </svg>
        All Prints
      </NuxtLink>

      <div class="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">

        <!-- ═══════════════════════════════════════════════════════════
             POSTER PREVIEW
             ═══════════════════════════════════════════════════════════ -->
        <div class="lg:sticky lg:top-24 self-start">
          <div
            class="relative mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-stone-900/10 border border-stone-900/5 max-w-md lg:max-w-none"
            :style="{
              aspectRatio: posterAspect,
              backgroundColor: premade.style_config?.background_color || '#F7F4EF',
            }"
          >
            <img
              v-if="premade.preview_image_url"
              :src="premade.preview_image_url"
              :alt="premade.title"
              class="w-full h-full object-cover"
            />
            <div v-else class="absolute inset-0 flex flex-col">
              <!-- title band -->
              <div
                class="px-6 pt-6 pb-3 text-center shrink-0"
                :style="{
                  backgroundColor: premade.style_config?.label_bg_color || premade.style_config?.background_color,
                  color: premade.style_config?.label_text_color || '#1C1917',
                }"
              >
                <p
                  class="text-xl sm:text-2xl font-bold tracking-[0.08em] uppercase leading-tight"
                  :style="{ fontFamily: `'${premade.style_config?.font_family || 'Space Grotesk'}', sans-serif` }"
                >{{ premade.title }}</p>
                <p
                  class="text-[10px] font-semibold tracking-[0.24em] uppercase opacity-65 mt-1"
                  :style="{ fontFamily: `'${premade.style_config?.body_font_family || 'DM Sans'}', sans-serif` }"
                >{{ premade.subtitle }}</p>
              </div>
              <!-- map area -->
              <div class="flex-1 relative overflow-hidden">
                <svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid meet" class="absolute inset-0 w-full h-full">
                  <g :stroke="premade.style_config?.contour_color || '#C8BDB0'" stroke-width="0.25" fill="none" opacity="0.6">
                    <path v-for="(y, i) in [18, 28, 38, 48, 58, 68, 78, 88, 98, 108]" :key="i"
                      :d="`M-5 ${y} Q${25 + (i % 3) * 8} ${y - 4} 50 ${y + ((i % 2) * 2)} T105 ${y - 2}`" />
                  </g>
                  <path
                    v-if="routePath"
                    :d="routePath"
                    fill="none"
                    :stroke="premade.style_config?.route_color || '#C1121F'"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :opacity="premade.style_config?.route_opacity ?? 0.95"
                  />
                  <template v-if="routeEndpoints">
                    <circle :cx="routeEndpoints.start[0]" :cy="routeEndpoints.start[1]" r="1.4"
                      :fill="premade.style_config?.route_color || '#C1121F'" />
                    <circle :cx="routeEndpoints.end[0]" :cy="routeEndpoints.end[1]" r="1.4" fill="white"
                      :stroke="premade.style_config?.route_color || '#C1121F'" stroke-width="0.6" />
                  </template>
                </svg>
              </div>
              <!-- stats band -->
              <div
                class="px-6 py-3 flex items-center justify-center gap-6 shrink-0 text-center"
                :style="{
                  backgroundColor: premade.style_config?.label_bg_color || premade.style_config?.background_color,
                  color: premade.style_config?.label_text_color || '#1C1917',
                }"
              >
                <div>
                  <p class="text-[8px] font-semibold tracking-[0.3em] uppercase opacity-60">Distance</p>
                  <p class="text-sm font-bold">{{ formatKm(premade.stats.distance_km) }}</p>
                </div>
                <div class="w-px h-6 bg-current opacity-20" />
                <div>
                  <p class="text-[8px] font-semibold tracking-[0.3em] uppercase opacity-60">Elevation</p>
                  <p class="text-sm font-bold">{{ formatM(premade.stats.elevation_gain_m) }} ↑</p>
                </div>
                <div v-if="premade.stats.max_elevation_m" class="w-px h-6 bg-current opacity-20" />
                <div v-if="premade.stats.max_elevation_m">
                  <p class="text-[8px] font-semibold tracking-[0.3em] uppercase opacity-60">Peak</p>
                  <p class="text-sm font-bold">{{ premade.stats.max_elevation_m.toLocaleString() }} m</p>
                </div>
              </div>
            </div>
          </div>
          <p class="text-center text-[10px] font-medium tracking-[0.18em] uppercase text-stone-400 mt-4">
            Shown at {{ selectedProduct?.size_label || '18×24"' }} · 170 gsm archival matte
          </p>
        </div>

        <!-- ═══════════════════════════════════════════════════════════
             DETAIL + BUY PANEL
             ═══════════════════════════════════════════════════════════ -->
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span
              v-for="b in premade.badges"
              :key="b"
              class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] bg-stone-900 text-white"
            >{{ b }}</span>
            <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-stone-400">
              {{ premade.region }}
            </span>
          </div>

          <h1
            class="text-[40px] sm:text-[52px] leading-[1.02] tracking-tight text-stone-900 mb-2"
            style="font-family:'Playfair Display',serif"
          >{{ premade.title }}</h1>
          <p class="text-base text-stone-500 mb-6">{{ premade.subtitle }}</p>
          <p class="text-[15px] text-stone-700 leading-relaxed mb-8">{{ premade.description }}</p>

          <!-- Stats row -->
          <div class="grid grid-cols-3 border border-stone-200 rounded-xl overflow-hidden bg-white/60 mb-8 divide-x divide-stone-200">
            <div class="p-4">
              <p class="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1">Distance</p>
              <p class="text-lg font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">{{ formatKm(premade.stats.distance_km) }}</p>
            </div>
            <div class="p-4">
              <p class="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1">Elevation</p>
              <p class="text-lg font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">{{ formatM(premade.stats.elevation_gain_m) }}</p>
            </div>
            <div class="p-4">
              <p class="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1">Max altitude</p>
              <p class="text-lg font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">
                {{ premade.stats.max_elevation_m ? `${premade.stats.max_elevation_m.toLocaleString()} m` : '—' }}
              </p>
            </div>
          </div>

          <!-- Size selector -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <label class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Print size</label>
              <span class="text-xs text-stone-400">170 gsm archival matte</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="opt in posterOptions"
                :key="opt.product_uid"
                @click="selectedProductUid = opt.product_uid"
                :class="[
                  'relative p-4 rounded-xl border-2 text-left transition-all',
                  selectedProductUid === opt.product_uid
                    ? 'border-stone-900 bg-white shadow-sm'
                    : 'border-stone-200 bg-white/60 hover:border-stone-300',
                ]"
              >
                <p class="text-xs font-semibold text-stone-500 mb-0.5">{{ opt.size_label }}</p>
                <p class="text-lg font-bold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">
                  {{ formatPrice(opt.price_cents) }}
                </p>
                <span
                  v-if="selectedProductUid === opt.product_uid"
                  class="absolute top-2 right-2 w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center"
                >
                  <svg class="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>

          <!-- Quantity -->
          <div class="mb-8 flex items-center gap-4">
            <label class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Quantity</label>
            <div class="inline-flex items-center rounded-full bg-white border border-stone-200 p-1 gap-1">
              <button
                @click="quantity = Math.max(1, quantity - 1)"
                class="w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 font-bold text-base"
              >−</button>
              <span class="w-8 text-center font-semibold text-stone-900 tabular-nums">{{ quantity }}</span>
              <button
                @click="quantity = Math.min(10, quantity + 1)"
                class="w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 font-bold text-base"
              >+</button>
            </div>
          </div>

          <!-- Total & CTA -->
          <div class="border-t border-stone-200 pt-6">
            <div class="flex items-baseline justify-between mb-5">
              <span class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Total</span>
              <span class="text-3xl font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">
                {{ formatPrice(totalCents) }}
              </span>
            </div>

            <NuxtLink :to="`/shop/${premade.slug}/checkout?size=${selectedProductUid}&qty=${quantity}`">
              <button class="w-full group inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-6 py-4 rounded-full text-sm transition-all shadow-sm shadow-stone-900/10">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
                  <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                </svg>
                Buy now — checkout as guest
                <svg class="w-3.5 h-3.5 -mr-0.5 opacity-60 group-hover:translate-x-0.5 transition-all" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </button>
            </NuxtLink>

            <p class="text-[11px] text-stone-400 text-center mt-3 tracking-wide">
              No account needed · Secure payment via Stripe · Ships worldwide
            </p>

            <!-- Customize CTA for logged-in users -->
            <div v-if="user" class="mt-5 p-4 bg-white/70 border border-stone-200 rounded-2xl">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 shrink-0 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
                  <svg class="w-4 h-4 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-stone-900 mb-0.5">Make it yours</p>
                  <p class="text-xs text-stone-500 mb-3">
                    Open this map in the editor to change colors, typography, text, and size.
                  </p>
                  <button
                    @click="customize"
                    :disabled="customizing"
                    class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:text-[#235840] transition-colors disabled:opacity-50"
                  >
                    <template v-if="customizing">Opening editor…</template>
                    <template v-else>
                      Customize in editor
                      <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 8h10M9 4l4 4-4 4"/>
                      </svg>
                    </template>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="mt-5 p-4 bg-white/70 border border-stone-200 rounded-2xl">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 shrink-0 rounded-full bg-stone-900/5 flex items-center justify-center">
                  <svg class="w-4 h-4 text-stone-700" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-stone-900 mb-0.5">Want to tweak the design?</p>
                  <p class="text-xs text-stone-500 mb-3">
                    Create a free account to change colors, type, and text — or bring in your own route to make a custom map.
                  </p>
                  <NuxtLink to="/auth/login" class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D6A4F] hover:text-[#235840] transition-colors">
                    Sign up free
                    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 8h10M9 4l4 4-4 4"/>
                    </svg>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import { getPremadeBySlug } from '~/data/premade-maps'
import { PRODUCTS, getProduct, formatPrice } from '~/utils/products'
import type { PremadeMap } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const user = useSupabaseUser()
const slug = route.params.slug as string
const premade = getPremadeBySlug(slug) as PremadeMap | undefined

// Poster products only for shop (no framed/canvas/digital for this flow)
const posterOptions = PRODUCTS.filter((p) => p.type === 'poster' && p.size_label !== '5×7"')

// Default size: 12x16 → falls back to first available
const defaultSizeUid =
  posterOptions.find((p) => p.size_label === '12×16"')?.product_uid ||
  posterOptions[0]?.product_uid ||
  ''

const selectedProductUid = ref<string>(defaultSizeUid)
const quantity = ref(1)

const selectedProduct = computed(() => getProduct(selectedProductUid.value))

const totalCents = computed(() =>
  (selectedProduct.value?.price_cents ?? 0) * quantity.value
)

const posterAspect = computed(() => {
  const p = selectedProduct.value
  if (!p || !p.width_in || !p.height_in) return '3 / 4'
  return `${p.width_in} / ${p.height_in}`
})

useHead(() => ({
  title: premade ? `${premade.title} Poster — RadMaps` : 'RadMaps',
  meta: premade
    ? [
        { name: 'description', content: premade.tagline },
        { property: 'og:title', content: `${premade.title} — Trail Poster` },
        { property: 'og:description', content: premade.description },
      ]
    : [],
}))

// ─── Customize (logged-in only) ────────────────────────────────────────
const customizing = ref(false)
async function customize() {
  if (!user.value) {
    await navigateTo('/auth/login')
    return
  }
  try {
    customizing.value = true
    const resp = await $fetch<{ redirect: string }>('/api/shop/customize', {
      method: 'POST',
      body: { slug },
    })
    if (resp?.redirect) await navigateTo(resp.redirect)
  } catch (err: any) {
    alert(err?.data?.message || err?.message || 'Could not customize this map.')
  } finally {
    customizing.value = false
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
const formatKm = (km?: number) => {
  if (km == null) return '—'
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`
}
const formatM = (m?: number) => {
  if (m == null) return '—'
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// ─── Route SVG (same logic as dashboard / shop grid) ───────────────────
function extractCoords(): number[][] | null {
  if (!premade) return null
  const feat = premade.geojson?.features?.[0]
  if (!feat) return null
  const g = feat.geometry as any
  if (g?.type === 'LineString') return g.coordinates
  if (g?.type === 'MultiLineString') return (g.coordinates as number[][][]).flat()
  return null
}
function projectCoords() {
  if (!premade) return null
  const coords = extractCoords()
  if (!coords || coords.length < 2) return null
  const [minLng, minLat, maxLng, maxLat] = premade.bbox
  const lngRange = (maxLng - minLng) || 0.0001
  const latRange = (maxLat - minLat) || 0.0001
  const padX = 5, padTop = 22, padBottom = 22
  const availW = 100 - padX * 2
  const availH = 133 - padTop - padBottom
  const scale = Math.min(availW / lngRange, availH / latRange)
  const offsetX = padX + (availW - lngRange * scale) / 2
  const offsetY = padTop + (availH - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coords.length / 200))
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
const routePath = computed(() => {
  const pts = projectCoords()
  if (!pts) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
})
const routeEndpoints = computed(() => {
  const pts = projectCoords()
  if (!pts || pts.length < 2) return null
  return {
    start: [pts[0].x, pts[0].y] as [number, number],
    end: [pts[pts.length - 1].x, pts[pts.length - 1].y] as [number, number],
  }
})
</script>
