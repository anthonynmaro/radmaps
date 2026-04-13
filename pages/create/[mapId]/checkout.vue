<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
      <svg class="animate-spin h-8 w-8 text-[#2D6A4F]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
      </svg>
      <p class="text-sm text-stone-500">Loading map details…</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="map" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- Left Column: Product Selection + Shipping -->
      <div class="lg:col-span-2 space-y-8">

        <!-- Header -->
        <div>
          <div class="flex items-center gap-3 mb-1">
            <NuxtLink :to="`/create/${mapId}/style`"
              class="flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
              </svg>
            </NuxtLink>
            <h1 class="text-2xl sm:text-3xl font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
              Order a Print
            </h1>
          </div>
          <p class="text-stone-500 text-sm ml-11">{{ map.title }}</p>
        </div>

        <!-- Alert if not rendered -->
        <div v-if="map.status !== 'rendered'"
          class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
          <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <div>
            <p class="text-sm font-semibold text-amber-800">Map Not Ready</p>
            <p class="text-sm text-amber-700 mt-0.5">Your map needs to be styled and rendered first. Please complete the styling step before ordering.</p>
          </div>
        </div>

        <!-- Product Type Selector -->
        <div class="space-y-3">
          <label class="block text-sm font-semibold text-stone-700">Product Type</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              v-for="type in (['poster', 'framed', 'canvas', 'digital'] as const)"
              :key="type"
              @click="selectedType = type"
              :class="[
                'relative p-4 rounded-2xl border-2 transition-all text-left min-h-[80px]',
                selectedType === type
                  ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                  : 'border-stone-200 hover:border-stone-300 bg-white',
              ]"
            >
              <div class="text-2xl mb-2">
                <span v-if="type === 'poster'">📋</span>
                <span v-else-if="type === 'framed'">🖼️</span>
                <span v-else-if="type === 'canvas'">🎨</span>
                <span v-else>💾</span>
              </div>
              <p class="font-semibold text-stone-900 capitalize text-sm">{{ type }}</p>
            </button>
          </div>
        </div>

        <!-- Size Grid (non-digital) -->
        <div v-if="selectedType !== 'digital'" class="space-y-3">
          <label class="block text-sm font-semibold text-stone-700">Size</label>
          <div v-if="availableProducts.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="product in availableProducts"
              :key="product.product_uid"
              @click="selectedProduct = product"
              :class="[
                'relative p-4 rounded-2xl border-2 transition-all text-left',
                selectedProduct?.product_uid === product.product_uid
                  ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                  : 'border-stone-200 hover:border-stone-300 bg-white',
              ]"
            >
              <p class="font-semibold text-stone-900">{{ product.size_label }}</p>
              <p class="text-sm text-stone-500 mt-0.5">
                {{ product.width_in }}" × {{ product.height_in }}"
              </p>
              <p class="text-lg font-bold text-[#2D6A4F] mt-2">
                {{ formatPrice(product.price_cents) }}
              </p>
            </button>
          </div>
          <div v-else class="text-center py-8 text-stone-500 text-sm">
            No products available for this type
          </div>
        </div>

        <!-- Digital Download -->
        <div v-if="selectedType === 'digital'" class="bg-sky-50 border border-sky-200 rounded-2xl p-6">
          <p class="font-semibold text-sky-900 mb-2">Digital Download</p>
          <p class="text-sm text-sky-700 mb-4">
            High-resolution digital files ready for sharing or local printing.
          </p>
          <p class="text-2xl font-bold text-sky-900" style="font-family:'Space Grotesk',sans-serif">{{ formatPrice(999) }}</p>
        </div>

        <!-- Shipping Form (non-digital) -->
        <div v-if="selectedType !== 'digital'" class="space-y-5 border-t border-stone-200 pt-8">
          <h2 class="text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">Shipping Information</h2>

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
      </div>

      <!-- Right Column: Order Summary — sticky on desktop, bottom-stacked on mobile -->
      <div class="lg:col-span-1 order-first lg:order-last">
        <div class="lg:sticky lg:top-24 bg-stone-50 rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h3 class="font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">Order Summary</h3>

          <div class="space-y-3 border-t border-stone-200 pt-4">
            <div class="flex justify-between text-sm">
              <span class="text-stone-500">Map</span>
              <span class="font-medium text-stone-900 text-right max-w-[60%] truncate">{{ map.title }}</span>
            </div>
            <div v-if="selectedProduct" class="flex justify-between text-sm">
              <span class="text-stone-500">Product</span>
              <span class="font-medium text-stone-900">{{ selectedProduct.size_label }}</span>
            </div>
            <div v-if="selectedType === 'digital'" class="flex justify-between text-sm">
              <span class="text-stone-500">Product</span>
              <span class="font-medium text-stone-900">Digital Download</span>
            </div>

            <div class="flex justify-between text-base font-bold pt-3 border-t border-stone-200">
              <span class="text-stone-900">Total</span>
              <span class="text-[#2D6A4F]">
                {{
                  selectedType === 'digital'
                    ? formatPrice(999)
                    : selectedProduct
                      ? formatPrice(selectedProduct.price_cents)
                      : '—'
                }}
              </span>
            </div>
          </div>

          <button
            @click="proceedToPayment"
            :disabled="
              (selectedType !== 'digital' && !selectedProduct) ||
              (selectedType !== 'digital' && !isFormValid()) ||
              isSubmitting ||
              map.status !== 'rendered'
            "
            class="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 transition-colors min-h-[52px]"
          >
            <svg v-if="isSubmitting" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ isSubmitting ? 'Redirecting…' : 'Proceed to Payment' }}
          </button>

          <p class="text-xs text-stone-400 text-center">
            Secure checkout via Stripe
          </p>
        </div>
      </div>

    </div>

    <!-- Error State -->
    <div v-else class="text-center py-20">
      <p class="text-stone-500 mb-4">Unable to load map details</p>
      <NuxtLink to="/dashboard">
        <button class="text-sm font-medium text-stone-700 border border-stone-200 px-4 py-2.5 rounded-xl hover:bg-stone-50 transition-colors">
          Back to Dashboard
        </button>
      </NuxtLink>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import { getProductsByType, formatPrice } from '~/utils/products'
import type { TrailMap, PrintProduct } from '~/types'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = useSupabaseClient() as any
const user = useSupabaseUser()

const mapId = route.params.mapId as string
const map = ref<TrailMap | null>(null)
const loading = ref(true)
const isSubmitting = ref(false)

const selectedType = ref<'poster' | 'framed' | 'canvas' | 'digital'>('poster')
const selectedProduct = ref<PrintProduct | null>(null)

const shippingAddress = ref({
  name: '',
  email: user.value?.email || '',
  address1: '',
  address2: '',
  city: '',
  state_code: '',
  zip: '',
  country_code: 'US',
  phone: '',
})

const availableProducts = computed(() => {
  if (selectedType.value === 'digital') return []
  return getProductsByType(selectedType.value)
})

const handleTypeChange = () => {
  const products = getProductsByType(selectedType.value)
  selectedProduct.value = products.length > 0 ? products[0] : null
}

const isFormValid = () => {
  const { name, email, address1, city, state_code, zip, phone } = shippingAddress.value
  return !!(name && email && address1 && city && state_code && zip && phone)
}

const fetchMap = async () => {
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .eq('user_id', user.value?.id)
      .single()
    if (error) throw error
    map.value = data as TrailMap
    handleTypeChange()
  } catch (err) {
    console.error('Error fetching map:', err)
  } finally {
    loading.value = false
  }
}

const proceedToPayment = async () => {
  if (!map.value || !user.value?.id) return
  isSubmitting.value = true
  try {
    const payload = {
      map_id: mapId,
      product_uid: selectedType.value === 'digital' ? 'digital' : selectedProduct.value?.product_uid,
      print_size: selectedProduct.value?.size_label || 'digital',
      quantity: 1,
      shipping_address:
        selectedType.value === 'digital'
          ? { email: shippingAddress.value.email }
          : shippingAddress.value,
      digital_only: selectedType.value === 'digital',
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
    alert('Failed to proceed. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await fetchMap()
})
</script>
