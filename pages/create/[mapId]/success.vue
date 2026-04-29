<template>
  <div class="min-h-[calc(100dvh-56px)] flex items-center justify-center px-4 py-12">
    <div class="max-w-lg w-full space-y-6">

      <!-- Success Icon & Heading -->
      <div class="text-center space-y-3">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-2">
          <svg class="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
          Order Confirmed!
        </h1>
        <p class="text-stone-500">
          Your map is being prepared for printing.
        </p>
      </div>

      <!-- Order Details Card -->
      <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-4">

        <!-- Order ID -->
        <div v-if="orderId">
          <p class="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Order ID</p>
          <p class="text-sm font-mono text-emerald-900 break-all">{{ orderId }}</p>
        </div>

        <!-- Map Title -->
        <div v-if="mapTitle" class="border-t border-emerald-200 pt-4">
          <p class="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Map</p>
          <p class="text-sm font-semibold text-emerald-900">{{ mapTitle }}</p>
        </div>

        <!-- Status items -->
        <div class="border-t border-emerald-200 pt-4 space-y-3">
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path fill-rule="evenodd" d="M10.707 3.293a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L5 7.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-emerald-900">Processing with Gelato</p>
              <p class="text-xs text-emerald-700 mt-0.5">Ships within 5–7 business days</p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path fill-rule="evenodd" d="M10.707 3.293a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L5 7.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-emerald-900">Tracking Available</p>
              <p class="text-xs text-emerald-700 mt-0.5">You'll receive an email with tracking details</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Digital Copy Section -->
      <div v-if="hasDigitalUrl" class="bg-sky-50 border border-sky-200 rounded-2xl p-5">
        <p class="font-semibold text-sky-900 mb-3">Download Your Digital Copy</p>
        <a :href="digitalUrl ?? ''"
          class="flex items-center justify-center gap-2 w-full text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl py-3 transition-colors min-h-[48px]">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          Download Digital Map
        </a>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NuxtLink to="/">
          <button class="w-full text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] px-5 py-3.5 rounded-xl transition-colors min-h-[48px]">
            View Your Maps
          </button>
        </NuxtLink>
        <NuxtLink to="/create">
          <button class="w-full text-sm font-semibold text-stone-700 border border-stone-200 px-5 py-3.5 rounded-xl hover:bg-stone-50 transition-colors min-h-[48px]">
            Create Another Map
          </button>
        </NuxtLink>
      </div>

      <!-- Help Text -->
      <div class="bg-stone-50 rounded-2xl p-5 text-center">
        <p class="text-sm font-medium text-stone-700 mb-1">Questions?</p>
        <p class="text-xs text-stone-500">
          Check your email for order confirmation and shipping updates.
          Contact us at <a href="mailto:support@radmaps.studio" class="underline underline-offset-2 hover:text-stone-700">support@radmaps.studio</a>
        </p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseClient, useSupabaseUser } from '#imports'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = useSupabaseClient() as any
const user = useSupabaseUser()

const mapId = route.params.mapId as string
const orderId = ref<string | null>(null)
const mapTitle = ref<string | null>(null)
const digitalUrl = ref<string | null>(null)
const hasDigitalUrl = ref(false)

// Webhook fires async after Stripe redirects — poll until the order appears (up to ~15s).
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollAttempts = 0

async function pollForOrder() {
  pollAttempts++
  try {
    const { data } = await supabase
      .from('orders')
      .select('id, digital_url, maps(title)')
      .eq('map_id', mapId)
      .eq('user_id', user.value?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      orderId.value = data.id
      mapTitle.value = data.maps?.title ?? null
      if (data.digital_url) {
        digitalUrl.value = data.digital_url
        hasDigitalUrl.value = true
      }
      stopPolling()
    } else if (pollAttempts >= 8) {
      // Webhook took too long — stop polling, page still shows the success state
      stopPolling()
    }
  } catch (err) {
    console.error('Error polling order:', err)
    stopPolling()
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  // Fetch map title immediately so the page isn't blank while waiting for the order
  try {
    const { data: mapData } = await supabase
      .from('maps')
      .select('title')
      .eq('id', mapId)
      .single()
    if (mapData?.title) mapTitle.value = mapData.title
  } catch { /* non-critical */ }

  // Poll for the order row — the Stripe webhook fires asynchronously
  await pollForOrder()
  if (!orderId.value) {
    pollTimer = setInterval(pollForOrder, 2000)
  }
})

onUnmounted(stopPolling)
</script>
