<template>
  <div class="h-screen flex flex-col bg-[#e8e5e0]">

    <!-- Header -->
    <header class="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur border-b border-stone-200 z-40">
      <NuxtLink :to="`/create/${mapId}/style`"
        class="flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
        </svg>
      </NuxtLink>
      <h1 class="text-lg font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
        Order a Print
      </h1>
      <span v-if="map" class="text-sm text-stone-400 hidden sm:inline">&mdash; {{ map.title }}</span>

      <!-- Step indicator -->
      <div class="ml-auto flex items-center gap-2 text-xs">
        <span :class="step === 'product' ? 'text-[#2D6A4F] font-semibold' : 'text-stone-400'">
          1. Product
        </span>
        <svg class="w-3 h-3 text-stone-300" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
        </svg>
        <span :class="step === 'shipping' ? 'text-[#2D6A4F] font-semibold' : 'text-stone-400'">
          2. Shipping
        </span>
        <svg class="w-3 h-3 text-stone-300" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
        </svg>
        <span :class="step === 'payment' ? 'text-[#2D6A4F] font-semibold' : 'text-stone-400'">
          3. Payment
        </span>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <svg class="animate-spin h-8 w-8 text-[#2D6A4F]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p class="text-sm text-stone-500">Loading map details…</p>
      </div>
    </div>

    <!-- Step 1: Product Selection with Live Map Preview -->
    <div v-else-if="map && step === 'product'" class="flex-1 flex flex-col lg:flex-row overflow-hidden">

      <!-- Map Preview Area -->
      <main class="flex-1 flex flex-col overflow-hidden relative">
        <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <ClientOnly>
            <MapPreview
              v-if="mapData"
              :map="mapData"
              :style-config="currentStyleConfig"
              :editable="false"
              class="w-full h-full"
            />
          </ClientOnly>
        </div>

        <!-- Render status banner -->
        <div v-if="renderError"
          class="absolute top-4 left-4 right-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 z-10">
          <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <div>
            <p class="text-sm font-semibold text-red-800">Render failed</p>
            <p class="text-xs text-red-700 mt-0.5">{{ renderError }}</p>
            <button @click="startRenders" class="mt-1 text-xs font-medium text-red-700 underline">Try again</button>
          </div>
        </div>
        <div v-else-if="!printReady"
          class="absolute top-4 left-4 right-4 flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 z-10">
          <svg class="w-4 h-4 text-sky-500 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p class="text-xs text-sky-800">Preparing print file — select your product while we get it ready.</p>
        </div>

        <!-- Product Selector overlay (bottom of map area) -->
        <MapProductSelector
          v-model="selectedProduct"
          :map-center="mapCenter"
          :map-zoom="mapZoom"
          @aspect-change="onAspectChange"
          @confirm="onProductConfirmed"
        />
      </main>
    </div>

    <!-- Step 2: Shipping Form -->
    <div v-else-if="map && step === 'shipping'" class="flex-1 overflow-y-auto">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <!-- Order summary card -->
        <div class="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4">
          <div class="w-16 h-20 rounded-lg overflow-hidden bg-stone-200 shrink-0">
            <img v-if="previewUrl" :src="previewUrl" class="w-full h-full object-cover" alt="Preview" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-stone-900 text-sm truncate">{{ map.title }}</p>
            <p class="text-xs text-stone-500 mt-0.5">{{ selectedProduct?.name }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-[#2D6A4F]">{{ selectedProduct ? formatPrice(selectedProduct.price_cents) : '' }}</p>
            <button @click="step = 'product'" class="text-xs text-stone-400 hover:text-stone-600 mt-1">Change</button>
          </div>
        </div>

        <!-- Digital — skip shipping, just need email -->
        <div v-if="isDigital" class="space-y-4">
          <h2 class="text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
            Where should we send your download link?
          </h2>
          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input v-model="shippingAddress.email" type="email" placeholder="you@example.com"
              class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
          </div>
        </div>

        <!-- Physical — full shipping form -->
        <div v-else class="space-y-5">
          <h2 class="text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
            Shipping Information
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">Full Name</label>
              <input v-model="shippingAddress.name" type="text" placeholder="John Doe"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
              <input v-model="shippingAddress.email" type="email" placeholder="you@example.com"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1.5">Street Address</label>
            <input v-model="shippingAddress.address1" type="text" placeholder="123 Main St"
              class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
          </div>

          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1.5">Apt, suite, etc. (optional)</label>
            <input v-model="shippingAddress.address2" type="text" placeholder="Apt 4B"
              class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div class="col-span-2 sm:col-span-1">
              <label class="block text-sm font-medium text-stone-700 mb-1.5">City</label>
              <input v-model="shippingAddress.city" type="text" placeholder="Seattle"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">State</label>
              <input v-model="shippingAddress.state_code" type="text" placeholder="WA" maxlength="2"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] uppercase min-h-[48px]"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">ZIP</label>
              <input v-model="shippingAddress.zip" type="text" placeholder="98101"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">Country</label>
              <select v-model="shippingAddress.country_code"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] bg-white min-h-[48px]">
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="SE">Sweden</option>
                <option value="NO">Norway</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700 mb-1.5">Phone</label>
              <input v-model="shippingAddress.phone" type="tel" placeholder="(206) 555-0100"
                class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]"/>
            </div>
          </div>
        </div>

        <!-- Proceed to payment -->
        <div class="pt-4 border-t border-stone-200">
          <div class="flex justify-between items-center mb-4">
            <span class="text-base font-bold text-stone-900">Total</span>
            <span class="text-xl font-bold text-[#2D6A4F]" style="font-family:'Space Grotesk',sans-serif">
              {{ selectedProduct ? formatPrice(selectedProduct.price_cents) : '' }}
            </span>
          </div>
          <button
            @click="proceedToPayment"
            :disabled="!canProceed || isSubmitting"
            class="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 transition-colors min-h-[52px]"
          >
            <svg v-if="isSubmitting" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ isSubmitting ? 'Redirecting…' : 'Proceed to Payment' }}
          </button>
          <p class="text-xs text-stone-400 text-center mt-3">Secure checkout via Stripe</p>
        </div>

      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="!map && !loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-stone-500 mb-4">Unable to load map details</p>
        <NuxtLink to="/dashboard">
          <button class="text-sm font-medium text-stone-700 border border-stone-200 px-4 py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
            Back to My Maps
          </button>
        </NuxtLink>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import { formatPrice, getRenderDimensions } from '~/utils/products'
import type { TrailMap, PrintProduct, ProductFraming, StyleConfig } from '~/types'

definePageMeta({
  middleware: 'auth',
  layout: false, // Full-screen layout for the map preview step
})

const route = useRoute()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = useSupabaseClient() as any
const user = useSupabaseUser()

const mapId = route.params.mapId as string
const map = ref<TrailMap | null>(null)
const loading = ref(true)
const isSubmitting = ref(false)

// ─── Step state ─────────────────────────────────────────────────────────────
const step = ref<'product' | 'shipping' | 'payment'>('product')

// ─── Product selection ──────────────────────────────────────────────────────
const selectedProduct = ref<PrintProduct | null>(null)
const confirmedFraming = ref<ProductFraming | null>(null)
const mapCenter = ref<[number, number]>([0, 0])
const mapZoom = ref(10)

const isDigital = computed(() => selectedProduct.value?.type === 'digital')

// ─── Style config for live preview (adjusts aspect ratio per product) ───────
const mapData = ref<TrailMap | null>(null)
const currentStyleConfig = ref<StyleConfig | null>(null)

function onAspectChange(payload: { product: PrintProduct; previousAspect: number | null }) {
  if (!currentStyleConfig.value) return
  // All products use 2:3 — always preview at 24×36 aspect ratio
  currentStyleConfig.value = { ...currentStyleConfig.value, print_size: '24x36' as any }
}

function onProductConfirmed(payload: { product: PrintProduct; framing: ProductFraming }) {
  selectedProduct.value = payload.product
  confirmedFraming.value = payload.framing
  if (isDigital.value) {
    // Digital downloads skip shipping — but still need email
    step.value = 'shipping'
  } else {
    // Re-render at the product-specific dimensions
    startRenders()
    step.value = 'shipping'
  }
}

// ─── Shipping form ──────────────────────────────────────────────────────────

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return /^strava-\d+@auth\./i.test(email)
}

const shippingAddress = reactive({
  name: '',
  email: isSyntheticEmail(user.value?.email) ? '' : (user.value?.email || ''),
  address1: '',
  address2: '',
  city: '',
  state_code: '',
  zip: '',
  country_code: 'US',
  phone: '',
})

const canProceed = computed(() => {
  if (!selectedProduct.value) return false
  if (!printReady.value && !isDigital.value) return false
  if (isDigital.value) return !!shippingAddress.email
  const { name, email, address1, city, state_code, zip, phone } = shippingAddress
  return !!(name && email && address1 && city && state_code && zip && phone)
})

// ─── Render state ───────────────────────────────────────────────────────────

const previewUrl = ref<string | null>(null)
const printReady = ref(false)
const renderError = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function stopPolling() {
  if (pollTimer)    { clearInterval(pollTimer);   pollTimer   = null }
  if (timeoutTimer) { clearTimeout(timeoutTimer);  timeoutTimer = null }
}

async function triggerRender(quality: 'preview' | 'print') {
  const body: Record<string, unknown> = { quality }

  // Pass product-specific dimensions for the print render
  if (selectedProduct.value && selectedProduct.value.type !== 'digital') {
    const dims = getRenderDimensions(selectedProduct.value)
    body.render_width_px = dims.width
    body.render_height_px = dims.height
  }

  // Pass user's framing adjustments
  if (confirmedFraming.value) {
    body.framing = confirmedFraming.value
  }

  await $fetch(`/api/maps/${mapId}/render`, { method: 'POST', body })
}

async function pollStatus() {
  const { data } = await supabase
    .from('maps')
    .select('status, render_url, thumbnail_url')
    .eq('id', mapId)
    .single()
  if (!data) return

  if (typeof data.thumbnail_url === 'string' && !data.thumbnail_url.startsWith('error:')) {
    previewUrl.value = data.thumbnail_url
  }

  if (typeof data.render_url === 'string' && data.render_url.startsWith('error:')) {
    renderError.value = data.render_url.slice(6) || 'Render failed. Please try again.'
    stopPolling()
    await supabase.from('maps').update({ render_url: null }).eq('id', mapId)
    return
  }

  if (data.status === 'rendered') {
    printReady.value = true
    stopPolling()
  }
}

async function startRenders() {
  renderError.value = null
  printReady.value = false
  stopPolling()

  // Only fire the print render — preview thumbnail already exists from the style editor.
  // Two concurrent Puppeteer instances on Railway cause OOM/slowdowns.
  await triggerRender('print')

  pollTimer = setInterval(pollStatus, 3000)
  timeoutTimer = setTimeout(() => {
    if (!printReady.value && !renderError.value) {
      renderError.value = 'Render timed out. Please try again.'
      stopPolling()
    }
  }, 5 * 60 * 1000)
}

onUnmounted(stopPolling)

// ─── Payment ────────────────────────────────────────────────────────────────

const proceedToPayment = async () => {
  if (!map.value || !user.value?.id || !selectedProduct.value) return
  isSubmitting.value = true
  step.value = 'payment'
  try {
    const payload = {
      map_id: mapId,
      product_uid: selectedProduct.value.product_uid,
      print_size: selectedProduct.value.size_label || 'digital',
      quantity: 1,
      shipping_address: isDigital.value
        ? { name: 'Digital', email: shippingAddress.email, address1: '-', city: '-', state_code: '--', zip: '-', country_code: 'US' }
        : shippingAddress,
      digital_only: isDigital.value,
    }
    const response = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to create checkout session')
    const data = await response.json()
    window.location.href = data.url
  } catch (err) {
    console.error('Error:', err)
    alert('Failed to proceed to payment. Please try again.')
    step.value = 'shipping'
  } finally {
    isSubmitting.value = false
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .eq('user_id', user.value?.id)
      .single()
    if (error) throw error
    map.value = data as TrailMap
    mapData.value = data as TrailMap
    currentStyleConfig.value = { ...(data.style_config as StyleConfig) }

    // Seed preview URL
    const seedUrl = data.render_url && !data.render_url.startsWith('error:')
      ? data.render_url
      : data.thumbnail_url && !data.thumbnail_url.startsWith('error:')
        ? data.thumbnail_url
        : null
    if (seedUrl) previewUrl.value = seedUrl

    // Seed map center from bbox
    if (data.bbox) {
      mapCenter.value = [
        (data.bbox[0] + data.bbox[2]) / 2,
        (data.bbox[1] + data.bbox[3]) / 2,
      ]
    }

    startRenders()
  } catch (err) {
    console.error('Error fetching map:', err)
  } finally {
    loading.value = false
  }
})
</script>
