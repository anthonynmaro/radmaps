<template>
  <div class="space-y-8">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block">
        <svg
          class="animate-spin h-8 w-8 text-green-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <p class="mt-4 text-gray-600">Loading map details...</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="map" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Products -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Header -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Order a Print</h1>
          <p class="mt-2 text-gray-600">{{ map.title }}</p>
        </div>

        <!-- Alert if not rendered -->
        <UAlert
          v-if="map.status !== 'rendered'"
          icon="i-heroicons-exclamation-triangle-20-solid"
          color="amber"
          title="Map Not Ready"
          description="Your map needs to be styled and rendered first. Please complete the styling step before ordering."
        />

        <!-- Product Type Selector -->
        <div class="space-y-4">
          <label class="block text-sm font-medium text-gray-900">Product Type</label>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              v-for="type in (['poster', 'framed', 'canvas', 'digital'] as const)"
              :key="type"
              @click="selectedType = type"
              :class="[
                'relative p-4 rounded-lg border-2 transition-colors',
                selectedType === type
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
            >
              <div
                :class="[
                  'text-2xl mb-2',
                  selectedType === type ? 'opacity-100' : 'opacity-60',
                ]"
              >
                <span v-if="type === 'poster'">📋</span>
                <span v-else-if="type === 'framed'">🖼️</span>
                <span v-else-if="type === 'canvas'">🎨</span>
                <span v-else>💾</span>
              </div>
              <p class="font-medium text-gray-900 capitalize text-sm">{{ type }}</p>
            </button>
          </div>
        </div>

        <!-- Size Grid (non-digital) -->
        <div v-if="selectedType !== 'digital'" class="space-y-4">
          <label class="block text-sm font-medium text-gray-900">Size</label>
          <div v-if="availableProducts.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              v-for="product in availableProducts"
              :key="product.product_uid"
              @click="selectedProduct = product"
              :class="[
                'relative p-4 rounded-lg border-2 transition-colors text-left',
                selectedProduct?.product_uid === product.product_uid
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
            >
              <p class="font-semibold text-gray-900">{{ product.size_label }}</p>
              <p class="text-sm text-gray-600 mt-1">
                {{ product.width_in }}" x {{ product.height_in }}"
              </p>
              <p class="text-lg font-bold text-green-600 mt-2">
                {{ formatPrice(product.price_cents) }}
              </p>
            </button>
          </div>
          <div v-else class="text-center py-8 text-gray-600">
            No products available for this type
          </div>
        </div>

        <!-- Digital Download -->
        <div v-if="selectedType === 'digital'" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p class="font-semibold text-blue-900 mb-2">Digital Download Only</p>
          <p class="text-sm text-blue-700 mb-4">
            Get high-resolution digital copies of your map ready for sharing or printing.
          </p>
          <p class="text-2xl font-bold text-blue-900">{{ formatPrice(999) }}</p>
        </div>

        <!-- Shipping Form (non-digital) -->
        <div v-if="selectedType !== 'digital'" class="space-y-4 border-t border-gray-200 pt-8">
          <h2 class="text-lg font-semibold text-gray-900">Shipping Information</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Full Name
              </label>
              <input
                v-model="shippingAddress.name"
                type="text"
                placeholder="John Doe"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Email
              </label>
              <input
                v-model="shippingAddress.email"
                type="email"
                placeholder="john@example.com"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-900 mb-2">
              Street Address
            </label>
            <input
              v-model="shippingAddress.address1"
              type="text"
              placeholder="123 Main St"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-900 mb-2">
              Apartment, suite, etc. (optional)
            </label>
            <input
              v-model="shippingAddress.address2"
              type="text"
              placeholder="Apt 4B"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                City
              </label>
              <input
                v-model="shippingAddress.city"
                type="text"
                placeholder="Seattle"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                State / Province (2-letter)
              </label>
              <input
                v-model="shippingAddress.state_code"
                type="text"
                placeholder="WA"
                maxlength="2"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent uppercase"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                ZIP Code
              </label>
              <input
                v-model="shippingAddress.zip"
                type="text"
                placeholder="98101"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Country
              </label>
              <select
                v-model="shippingAddress.country_code"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              >
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
              <label class="block text-sm font-medium text-gray-900 mb-2">
                Phone
              </label>
              <input
                v-model="shippingAddress.phone"
                type="tel"
                placeholder="(206) 555-0100"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Order Summary -->
      <div class="lg:col-span-1">
        <div class="sticky top-8 bg-gray-50 rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 class="font-semibold text-gray-900">Order Summary</h3>

          <div class="space-y-3 border-t border-gray-200 pt-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">Map</span>
              <span class="font-medium text-gray-900">{{ map.title }}</span>
            </div>

            <div v-if="selectedProduct" class="flex justify-between text-sm">
              <span class="text-gray-600">Product</span>
              <span class="font-medium text-gray-900">{{ selectedProduct.size_label }}</span>
            </div>

            <div v-if="selectedType === 'digital'" class="flex justify-between text-sm">
              <span class="text-gray-600">Product</span>
              <span class="font-medium text-gray-900">Digital Download</span>
            </div>

            <div class="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>Total</span>
              <span class="text-green-600">
                {{
                  selectedType === 'digital'
                    ? formatPrice(999)
                    : selectedProduct
                      ? formatPrice(selectedProduct.price_cents)
                      : '--'
                }}
              </span>
            </div>
          </div>

          <UButton
            @click="proceedToPayment"
            :loading="isSubmitting"
            color="green"
            size="lg"
            class="w-full"
            :disabled="
              (selectedType !== 'digital' && !selectedProduct) ||
              (selectedType !== 'digital' && !isFormValid()) ||
              isSubmitting ||
              map.status !== 'rendered'
            "
          >
            Proceed to Payment
          </UButton>

          <p class="text-xs text-gray-600 text-center">
            Powered by Stripe Checkout. Your payment is secure.
          </p>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else class="text-center py-12">
      <p class="text-gray-600">Unable to load map details</p>
      <UButton to="/dashboard" variant="ghost" class="mt-4">
        Back to Dashboard
      </UButton>
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

// Watch type changes and select first product
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

    if (!response.ok) {
      throw new Error('Failed to create checkout session')
    }

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
