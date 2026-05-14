<template>
  <div class="relative min-h-[100dvh] overflow-hidden bg-[#FAF8F4] text-stone-900">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <header class="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="group flex items-center gap-2.5">
        <svg class="h-7 w-7 text-[#2D6A4F] transition-transform duration-300 group-hover:-rotate-3" viewBox="0 0 32 32" fill="none">
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor" opacity="0.14" />
          <path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none" />
          <path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.45" />
          <circle cx="11" cy="8" r="1.2" fill="currentColor" />
        </svg>
        <span class="text-[15px] font-bold tracking-tight" style="font-family:'Space Grotesk',sans-serif">Rad Maps</span>
        <span class="hidden rounded-full border border-stone-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400 sm:inline">Studio</span>
      </NuxtLink>

      <nav class="flex items-center gap-2">
        <NuxtLink
          to="/shop"
          class="hidden rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900 sm:inline-flex"
        >
          Browse prints
        </NuxtLink>
        <NuxtLink
          :to="user ? '/create' : '/auth/login?mode=signup'"
          class="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-stone-900/10 transition-colors hover:bg-stone-800"
        >
          Make your own
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </NuxtLink>
      </nav>
    </header>

    <main class="relative z-10">
      <div v-if="pending" class="flex min-h-[70dvh] items-center justify-center">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-[#2D6A4F] border-t-transparent" />
      </div>

      <section v-else-if="error || !map" class="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
        <svg class="mb-5 h-14 w-14 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
          <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6" />
        </svg>
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2D6A4F]">Map unavailable</p>
        <h1 class="mt-3 text-3xl leading-tight tracking-tight text-stone-900" style="font-family:'Playfair Display',serif">
          This shared map could not be found.
        </h1>
        <p class="mt-3 text-sm leading-6 text-stone-500">
          The owner may have turned off sharing, or the link may be incorrect.
        </p>
        <NuxtLink to="/" class="mt-7 inline-flex rounded-full bg-[#2D6A4F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#235840]">
          Go to RadMaps
        </NuxtLink>
      </section>

      <template v-else>
        <section class="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)] lg:gap-14 lg:px-8 lg:pb-16 lg:pt-10">
          <div class="order-2 flex flex-col justify-center lg:order-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2D6A4F]">
                Shared trail poster
              </span>
              <span class="h-px w-14 bg-stone-300/80" />
            </div>

            <h1 class="mt-4 text-[44px] leading-[1.02] tracking-tight text-stone-950 sm:text-[64px]" style="font-family:'Playfair Display',serif">
              {{ map.title }}
            </h1>
            <p class="mt-4 max-w-xl text-[15px] leading-7 text-stone-500 sm:text-base">
              {{ heroCopy }}
            </p>

            <div v-if="statCards.length" class="mt-7 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                v-for="stat in statCards"
                :key="stat.label"
                class="border-l border-stone-300/80 pl-3"
              >
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">{{ stat.label }}</p>
                <p class="mt-1 text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">{{ stat.value }}</p>
              </div>
            </div>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#2D6A4F] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[#2D6A4F]/20 transition-colors hover:bg-[#235840] disabled:cursor-wait disabled:opacity-70"
                :disabled="actionBusy !== null"
                @click="continueWithSharedMap('checkout')"
              >
                <svg v-if="actionBusy === 'checkout'" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4a1 1 0 011-1h1.2a1 1 0 01.97.757L6.55 5H17a1 1 0 01.95 1.316l-2 6A1 1 0 0115 13H8a1 1 0 01-.97-.757L5.42 5.8 5.02 5H4a1 1 0 01-1-1z" />
                  <path d="M8 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM15 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                {{ actionBusy === 'checkout' ? 'Opening order flow...' : 'Order this print' }}
              </button>
              <button
                class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:text-stone-950 disabled:cursor-wait disabled:opacity-70"
                :disabled="actionBusy !== null"
                @click="continueWithSharedMap('style')"
              >
                <svg v-if="actionBusy === 'style'" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2h4a1 1 0 010 2H6v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd" />
                </svg>
                {{ actionBusy === 'style' ? 'Opening studio...' : 'Customize it' }}
              </button>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium tracking-wide text-stone-500">
              <span class="inline-flex items-center gap-1.5">
                <svg class="h-3.5 w-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                Museum-quality paper
              </span>
              <span class="inline-flex items-center gap-1.5">
                <svg class="h-3.5 w-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3a1 1 0 000 2h1v9a2 2 0 002 2h7.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 14H6V5h11a1 1 0 100-2H3z" />
                </svg>
                Ships worldwide
              </span>
              <button class="inline-flex items-center gap-1.5 font-semibold text-stone-600 transition-colors hover:text-stone-900" @click="copyLink">
                <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" />
                </svg>
                {{ copied ? 'Link copied' : 'Copy link' }}
              </button>
            </div>
          </div>

          <div class="order-1 lg:order-2">
            <div class="relative mx-auto max-w-[430px] lg:mr-0">
              <div class="absolute -left-4 top-8 h-[78%] w-full rotate-[-3deg] rounded-[8px] bg-[#2D6A4F]/12" />
              <div class="relative overflow-hidden rounded-[8px] border border-stone-900/10 bg-white shadow-2xl shadow-stone-900/15" style="aspect-ratio:2/3">
                <img
                  v-if="posterImage"
                  :src="posterImage"
                  :alt="`${map.title} trail poster preview`"
                  class="h-full w-full object-cover"
                >
                <div v-else class="flex h-full flex-col items-center justify-center bg-stone-100 text-center text-sm text-stone-500">
                  <svg class="mb-4 h-16 w-16 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                    <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round" />
                    <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6" />
                  </svg>
                  Preview preparing
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="bg-stone-950 text-white">
          <div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#52B788]">Make it yours</p>
              <h2 class="mt-2 text-3xl leading-tight tracking-tight sm:text-4xl" style="font-family:'Playfair Display',serif">
                Start with this design, then change the route title, colors, type, and print size.
              </h2>
            </div>
            <button
              class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#52B788] px-6 py-3 text-sm font-semibold text-stone-950 transition-colors hover:bg-[#63C99A] disabled:cursor-wait disabled:opacity-70"
              :disabled="actionBusy !== null"
              @click="continueWithSharedMap('style')"
            >
              Open in the studio
              <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { RouteStats } from '~/types'

definePageMeta({ layout: false })

const route = useRoute()
const user = useSupabaseUser()
const toast = useToast()
const id = computed(() => route.params.id as string)

type ShareAction = 'checkout' | 'style'

interface PublicMapPreview {
  id: string
  title: string
  subtitle?: string | null
  stats?: RouteStats
  proof_render_url?: string | null
  thumbnail_url?: string | null
  render_url?: string | null
  proof_render_hash?: string | null
  updated_at?: string | null
  owned_by_viewer?: boolean
}

const { data: map, pending, error } = await useFetch<PublicMapPreview>(
  () => `/api/maps/public/${id.value}`,
)

const copied = ref(false)
const actionBusy = ref<ShareAction | null>(null)
const handledIntent = ref(false)

const posterImage = computed(() =>
  map.value?.proof_render_url ?? map.value?.thumbnail_url ?? map.value?.render_url ?? undefined
)

const shareUrl = computed(() => `https://radmaps.studio/map/${id.value}`)
const ogImage = computed(() => {
  const version = map.value?.proof_render_hash || map.value?.updated_at || id.value
  return `https://radmaps.studio/map-og/${id.value}?v=${encodeURIComponent(version)}`
})

const miles = computed(() => {
  const distance = map.value?.stats?.distance_km
  return typeof distance === 'number' ? (distance * 0.621371).toFixed(1) : null
})

const elevationFeet = computed(() => {
  const gain = map.value?.stats?.elevation_gain_m
  return typeof gain === 'number' ? Math.round(gain * 3.28084).toLocaleString() : null
})

const heroCopy = computed(() => {
  const bits = []
  if (miles.value) bits.push(`${miles.value} miles`)
  if (elevationFeet.value) bits.push(`${elevationFeet.value} ft of climbing`)
  const routeLine = bits.length ? `This ${bits.join(' with ')} route` : 'This route'
  if (map.value?.subtitle) {
    return `${map.value.subtitle}. ${routeLine} is ready as a museum-quality print, or you can open it in the studio and make it your own.`
  }
  return `${routeLine} has already been turned into a print-ready RadMaps poster. Order this version, or open it in the studio and make it your own.`
})

const pageDescription = computed(() => {
  const bits = []
  if (miles.value) bits.push(`${miles.value} miles`)
  if (elevationFeet.value) bits.push(`${elevationFeet.value} ft gain`)
  const stats = bits.length ? `${bits.join(' · ')} — ` : ''
  return `${stats}order or customize this trail poster with RadMaps Studio.`
})

const statCards = computed(() => {
  const stats = []
  if (miles.value) stats.push({ label: 'Distance', value: `${miles.value} mi` })
  if (elevationFeet.value) stats.push({ label: 'Elevation', value: `${elevationFeet.value} ft` })
  if (map.value?.stats?.date) {
    stats.push({
      label: 'Recorded',
      value: new Date(map.value.stats.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    })
  }
  return stats
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  } catch {
    window.prompt('Copy this link:', window.location.href)
  }
}

function destinationFor(mapId: string, action: ShareAction) {
  return action === 'checkout'
    ? `/create/${mapId}/checkout`
    : `/create/${mapId}/style`
}

function loginForAction(action: ShareAction) {
  const next = `/map/${id.value}?intent=${action}`
  return `/auth/login?mode=signup&next=${encodeURIComponent(next)}`
}

async function continueWithSharedMap(action: ShareAction) {
  if (!map.value || actionBusy.value) return

  if (!user.value) {
    await navigateTo(loginForAction(action))
    return
  }

  actionBusy.value = action
  try {
    if (map.value.owned_by_viewer) {
      await navigateTo(destinationFor(map.value.id, action))
      return
    }

    const cloned = await $fetch<{ map_id: string; redirect: string; checkout_redirect: string }>(
      `/api/maps/public/${id.value}/clone`,
      { method: 'POST' },
    )
    await navigateTo(action === 'checkout' ? cloned.checkout_redirect : cloned.redirect)
  } catch (err) {
    console.error('Shared map action failed:', err)
    toast.add({
      title: 'Could not open this map',
      description: 'Please try again in a moment.',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red',
      timeout: 5000,
    })
  } finally {
    actionBusy.value = null
  }
}

watch([user, () => route.query.intent], ([currentUser, intent]) => {
  if (import.meta.server) return
  if (handledIntent.value || !currentUser) return
  if (intent === 'checkout' || intent === 'style') {
    handledIntent.value = true
    continueWithSharedMap(intent)
  }
}, { immediate: true })

useHead({
  title: computed(() => map.value ? `${map.value.title} — Order or Customize This Trail Poster` : 'RadMaps'),
  link: [
    { rel: 'canonical', href: shareUrl },
  ],
})

useSeoMeta({
  description: pageDescription,
  ogSiteName: 'RadMaps Studio',
  ogType: 'website',
  ogUrl: shareUrl,
  ogTitle: computed(() => map.value ? `${map.value.title} — RadMaps Trail Poster` : 'RadMaps Trail Poster'),
  ogDescription: pageDescription,
  ogImage,
  ogImageSecureUrl: ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  twitterCard: 'summary_large_image',
  twitterTitle: computed(() => map.value ? `${map.value.title} — Order or customize the print` : 'RadMaps Trail Poster'),
  twitterDescription: pageDescription,
  twitterImage: ogImage,
})
</script>
