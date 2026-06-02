<template>
  <div class="h-screen flex flex-col bg-[#e8e5e0]">
    <header class="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur border-b border-stone-200 z-40">
      <NuxtLink
        :to="premade ? `/shop/${premade.slug}` : '/shop'"
        class="flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
        </svg>
      </NuxtLink>
      <h1 class="text-lg font-bold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
        Order a Print
      </h1>
      <span v-if="premade" class="text-sm text-stone-400 hidden sm:inline">&mdash; {{ premade.title }}</span>

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

    <div v-if="!premade" class="flex-1 flex items-center justify-center px-6 text-center">
      <div>
        <h1 class="text-2xl font-semibold text-stone-900 mb-2" style="font-family:'Space Grotesk',sans-serif">
          Print not found
        </h1>
        <p class="text-stone-500">Back to <NuxtLink to="/shop" class="text-[#2D6A4F] font-semibold hover:underline">the shop</NuxtLink>.</p>
      </div>
    </div>

    <div v-else-if="step === 'product'" class="flex-1 overflow-y-auto">
      <div class="min-h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main class="min-h-[58vh] lg:min-h-0 flex flex-col overflow-hidden relative">
          <div class="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div
              :class="displayPremadeMockup
                ? 'w-full max-w-[600px] aspect-square overflow-hidden'
                : 'w-full max-w-[460px] aspect-[2/3] bg-white shadow-2xl shadow-stone-900/10 overflow-hidden'"
              :style="{ backgroundColor: displayPremadeMockup ? 'transparent' : (premade.style_config?.background_color || '#F7F4EF') }"
            >
              <img
                v-if="primaryPremadePreviewUrl"
                :src="primaryPremadePreviewUrl"
                :alt="displayPremadeMockup ? 'Wall mockup preview' : premade.title"
                :class="displayPremadeMockup ? 'h-full w-full object-contain drop-shadow-2xl' : 'h-full w-full object-cover'"
              >
              <svg v-else viewBox="0 0 100 133" class="w-full h-full">
                <path
                  v-if="routePath"
                  :d="routePath"
                  fill="none"
                  :stroke="premade.style_config.route_color"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
          <div
            v-if="mockupInFlight && productMockupsEnabled"
            class="absolute top-4 left-4 right-4 flex items-center gap-3 bg-white/95 border border-stone-200 rounded-xl px-4 py-3 z-10 shadow-sm">
            <UIcon name="i-heroicons-photo" class="h-4 w-4 shrink-0 text-[#2D6A4F]" />
            <p class="text-xs text-stone-700">Building the wall mockup. You can keep choosing products.</p>
          </div>
        </main>

        <aside class="flex min-h-0 flex-col bg-white border-t lg:h-[calc(100vh-57px)] lg:border-t-0 lg:border-l border-stone-200 lg:overflow-hidden">
          <div class="p-5 sm:p-6 border-b border-stone-200">
            <p class="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">Choose your print</p>
            <h2 class="mt-1 text-2xl font-bold text-stone-950" style="font-family:'Space Grotesk',sans-serif">
              {{ premade.title }}
            </h2>
          </div>

          <MapProductSelector
            v-model="selectedProduct"
            class="min-h-0 flex-1"
            :show-confirm="false"
            :include-digital="false"
            confirm-label="Continue to shipping"
          />
          <div class="shrink-0 border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-10px_20px_rgba(28,25,23,0.04)]">
            <button
              type="button"
              :disabled="!selectedProduct"
              class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#2D6A4F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#235840] disabled:cursor-not-allowed disabled:opacity-50"
              @click="onProductConfirmed"
            >
              <span>Continue to shipping</span>
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            </button>
          </div>

          <div class="p-5 sm:p-6 border-t border-stone-200">
            <div class="flex items-center justify-between gap-4">
              <label class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Quantity</label>
              <div class="inline-flex items-center rounded-full bg-white border border-stone-200 p-1 gap-1">
                <button
                  type="button"
                  class="w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 font-bold text-base"
                  @click="quantity = Math.max(1, quantity - 1)"
                >−</button>
                <span class="w-8 text-center font-semibold text-stone-900 tabular-nums">{{ quantity }}</span>
                <button
                  type="button"
                  class="w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 font-bold text-base"
                  @click="quantity = Math.min(10, quantity + 1)"
                >+</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-14 items-start">

      <!-- ═══════════════════════════════════════════════════════════
           SHIPPING FORM
           ═══════════════════════════════════════════════════════════ -->
      <div>
        <h1
          class="text-3xl sm:text-4xl font-semibold text-stone-900 mb-2 tracking-tight"
          style="font-family:'Playfair Display',serif"
        >
          Where should we ship it?
        </h1>
        <p class="text-stone-500 text-sm mb-6">
          You'll confirm payment securely via Stripe on the next step.
          <span v-if="!user">No account required.</span>
        </p>

        <!-- Guest sign-in nudge (friction-free dismissible) -->
        <div v-if="!user" class="flex items-center justify-between gap-3 bg-[#2D6A4F]/5 border border-[#2D6A4F]/15 rounded-xl px-4 py-3 mb-8">
          <p class="text-xs text-stone-700">
            <span class="font-semibold">Already have an account?</span>
            <span class="text-stone-500">Sign in to save your order history.</span>
          </p>
          <NuxtLink
:to="`/auth/login?redirect=${encodeURIComponent(currentPath)}`"
            class="text-xs font-semibold text-[#2D6A4F] hover:text-[#1E5238] shrink-0 transition-colors whitespace-nowrap">
            Sign in →
          </NuxtLink>
        </div>

        <form class="space-y-5" @submit.prevent="checkout">

          <!-- Contact -->
          <fieldset class="space-y-4">
            <legend class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-500 mb-1">
              Contact
            </legend>
            <FormField label="Email address" required>
              <input
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                placeholder="you@example.com"
                class="form-input"
              >
            </FormField>
          </fieldset>

          <!-- Shipping -->
          <fieldset class="space-y-4">
            <legend class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-500 mb-1">
              Shipping address
            </legend>
            <FormField label="Full name" required>
              <input v-model="form.name" type="text" required autocomplete="name" class="form-input" >
            </FormField>
            <FormField label="Address line 1" required>
              <input v-model="form.address1" type="text" required autocomplete="address-line1" class="form-input" >
            </FormField>
            <FormField label="Address line 2 (optional)">
              <input v-model="form.address2" type="text" autocomplete="address-line2" class="form-input" >
            </FormField>
            <div class="grid grid-cols-2 gap-4">
              <FormField label="City" required>
                <input v-model="form.city" type="text" required autocomplete="address-level2" class="form-input" >
              </FormField>
              <FormField label="State / Region" required>
                <input
                  v-model="form.state_code"
                  type="text"
                  required
                  autocomplete="address-level1"
                  maxlength="2"
                  placeholder="CA"
                  class="form-input uppercase"
                >
              </FormField>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <FormField label="ZIP / Postal code" required>
                <input v-model="form.zip" type="text" required autocomplete="postal-code" class="form-input" >
              </FormField>
              <FormField label="Country" required>
                <select v-model="form.country_code" required class="form-input">
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="NL">Netherlands</option>
                  <option value="SE">Sweden</option>
                  <option value="NO">Norway</option>
                  <option value="ES">Spain</option>
                  <option value="IT">Italy</option>
                  <option value="IE">Ireland</option>
                  <option value="DK">Denmark</option>
                  <option value="FI">Finland</option>
                  <option value="NZ">New Zealand</option>
                  <option value="JP">Japan</option>
                </select>
              </FormField>
            </div>
            <FormField label="Phone (optional)">
              <input v-model="form.phone" type="tel" autocomplete="tel" class="form-input" >
            </FormField>
          </fieldset>

          <!-- Error banner -->
          <div
v-if="errorMessage"
            class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div class="flex-1">
              <p class="text-sm font-semibold text-red-800">Something went wrong</p>
              <p class="text-sm text-red-700">{{ errorMessage }}</p>
            </div>
          </div>

          <button
            type="submit"
            :disabled="submitting || !selectedProduct || (!isDigital && (!shippingQuote || quoteLoading))"
            class="w-full inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-500 text-white font-semibold px-6 py-4 rounded-full text-sm transition-all shadow-sm shadow-stone-900/10"
          >
            <svg v-if="submitting" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
            </svg>
            {{ submitting ? 'Redirecting to Stripe…' : 'Continue to payment' }}
          </button>

          <p class="text-[11px] text-stone-400 text-center tracking-wide">
            Your card details are handled entirely by Stripe — we never see them.
          </p>
        </form>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           ORDER SUMMARY
           ═══════════════════════════════════════════════════════════ -->
      <aside class="lg:sticky lg:top-24 self-start">
        <div class="bg-white/70 backdrop-blur-sm border border-stone-200 rounded-2xl p-6">
          <p class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-4">
            Order summary
          </p>

          <div class="flex gap-4 items-start pb-5 border-b border-stone-200">
            <div
              class="w-20 shrink-0 rounded-lg overflow-hidden border border-stone-200"
              style="aspect-ratio:2/3"
              :style="{ backgroundColor: premade.style_config.background_color }"
            >
              <img
                v-if="primaryPremadePreviewUrl"
                :src="primaryPremadePreviewUrl"
                :class="displayPremadeMockup ? 'h-full w-full object-contain' : 'h-full w-full object-cover'"
              >
              <svg v-else viewBox="0 0 100 133" class="w-full h-full">
                <path
                  v-if="routePath"
                  :d="routePath"
                  fill="none"
                  :stroke="premade.style_config.route_color"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-stone-900 text-sm leading-tight tracking-tight truncate" style="font-family:'Space Grotesk',sans-serif">
                {{ premade.title }}
              </p>
              <p class="text-xs text-stone-500 mt-1 truncate">{{ premade.subtitle }}</p>
              <p class="text-xs font-semibold text-stone-700 mt-2">
                {{ selectedProduct?.name ?? 'Selected print' }} · Qty {{ quantity }}
              </p>
              <button
                type="button"
                class="mt-2 text-xs font-semibold text-[#2D6A4F] hover:text-[#235840]"
                @click="step = 'product'"
              >
                Change product
              </button>
            </div>
          </div>

          <div class="space-y-2 text-sm pt-5">
            <div class="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span class="tabular-nums">{{ formatPrice(subtotalCents) }}</span>
            </div>
            <div v-if="couponPreview" class="flex justify-between text-green-700">
              <span>{{ couponPreview.slug }}</span>
              <span class="tabular-nums">-{{ formatPrice(couponPreview.discount_cents) }}</span>
            </div>
            <div v-if="!isDigital" class="flex justify-between text-stone-600">
              <span>Shipping</span>
              <span v-if="quoteLoading" class="text-stone-400">Updating…</span>
              <span v-else-if="shippingQuote" class="tabular-nums">{{ formatPrice(shippingCents) }}</span>
              <span v-else class="text-stone-400">Enter address</span>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-stone-200 flex items-baseline justify-between">
            <span class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Total</span>
            <span class="text-2xl font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">
              {{ formatPrice(totalCents) }}
            </span>
          </div>
          <p v-if="!isDigital && quoteError" class="mt-3 text-xs text-red-600">{{ quoteError }}</p>
          <p v-else-if="!isDigital && shippingQuote" class="mt-3 text-xs text-stone-500">
            {{ shippingQuote.shipment_method_name }}. Tax is calculated by Stripe.
          </p>

          <div class="mt-5 pt-5 border-t border-stone-200 space-y-3">
            <div class="flex gap-2">
              <input v-model="couponCode" class="form-input uppercase" placeholder="Coupon code" >
              <button
                type="button"
                class="rounded-full border border-stone-300 px-4 text-xs font-semibold text-stone-700 disabled:opacity-50"
                :disabled="couponBusy || !couponCode.trim() || !form.email"
                @click="applyCoupon"
              >
                {{ couponBusy ? 'Checking...' : 'Apply' }}
              </button>
            </div>
            <div v-if="couponPreview" class="flex items-center justify-between text-xs text-green-700">
              <span>{{ couponPreview.percent_off }}% off applied</span>
              <button type="button" class="font-semibold underline" @click="removeCoupon">Remove</button>
            </div>
            <p v-if="couponError" class="text-xs text-red-600">{{ couponError }}</p>
          </div>

          <!-- Tiny reassurance -->
          <div class="mt-6 space-y-2 text-[11px] text-stone-500">
            <p class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Printed to order · 5–10 business days
            </p>
            <p class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Tracking sent to your email
            </p>
            <p class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Secure payment via Stripe
            </p>
          </div>
        </div>
      </aside>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import { getProduct, formatPrice, PRODUCTS, getDefaultPhysicalProduct } from '~/utils/products'
import { normalizeCouponSlug } from '~/utils/coupons'
import { FLAGS } from '~/utils/knownFlags'
import type { PremadeMap } from '~/types'

definePageMeta({ layout: false })

const route = useRoute()
const user = useSupabaseUser()
const slug = route.params.slug as string
const { data: premade } = await useFetch<PremadeMap>(`/api/premade/${slug}`)
const currentPath = computed(() => {
  const params = new URLSearchParams()
  if (typeof route.query.size === 'string') params.set('size', route.query.size)
  if (typeof route.query.qty === 'string') params.set('qty', route.query.qty)
  const query = params.toString()
  return `/shop/${slug}/checkout${query ? `?${query}` : ''}`
})
const step = ref<'product' | 'shipping' | 'payment'>('product')

// Read size + qty from query (set by detail page)
const queryProduct = typeof route.query.size === 'string' ? getProduct(route.query.size) : undefined
const initialProduct = queryProduct && queryProduct.type !== 'digital'
  ? queryProduct
  : getDefaultPhysicalProduct() || PRODUCTS.find(product => product.type !== 'digital') || null
const selectedProduct = ref(initialProduct)
const selectedProductUid = computed(() => selectedProduct.value?.product_uid ?? '')
const quantity = ref(Math.max(1, Math.min(10, parseInt((route.query.qty as string) || '1', 10) || 1)))

const isDigital = computed(() => selectedProduct.value?.type === 'digital')
const productMockupsEnabled = useFeatureFlag(FLAGS.PRODUCT_MOCKUPS)
const mockupUrl = ref<string | null>(null)
const mockupInFlight = ref(false)
const mockupTargetProductUid = ref<string | null>(null)
const displayPremadeMockup = computed(() =>
  productMockupsEnabled.value
  && !!mockupUrl.value
  && !!selectedProduct.value
  && mockupTargetProductUid.value === selectedProduct.value.product_uid
)
const primaryPremadePreviewUrl = computed(() =>
  displayPremadeMockup.value ? mockupUrl.value : premade.value?.preview_image_url
)
const productPrices = ref<Record<string, number>>({})
const lockedProductPriceCents = ref<number | null>(null)
try {
  const productPriceResponse = await $fetch<{ prices: Array<{ product_uid: string; retail_price_cents: number }> }>('/api/product-prices', {
    query: { country: 'US' },
  })
  productPrices.value = Object.fromEntries(
    productPriceResponse.prices.map((price) => [price.product_uid, price.retail_price_cents]),
  )
} catch {
  productPrices.value = {}
}
const couponCode = ref('')
const couponBusy = ref(false)
const couponError = ref('')
const couponPreview = ref<null | {
  slug: string
  percent_off: number
  discount_cents: number
  subtotal_cents: number
  total_cents: number
}>(null)
const selectedUnitPriceCents = computed(() =>
  lockedProductPriceCents.value ?? productPrices.value[selectedProductUid.value] ?? selectedProduct.value?.price_cents ?? 0
)
const subtotalCents = computed(() => selectedUnitPriceCents.value * quantity.value)
const shippingCents = computed(() => shippingQuote.value?.amount_cents ?? 0)
const totalCents = computed(() => Math.max(0, subtotalCents.value - (couponPreview.value?.discount_cents ?? 0) + shippingCents.value))

function onProductConfirmed() {
  clearShippingQuote()
  void requestPremadeMockup()
  step.value = 'shipping'
}
type ShippingQuoteSelection = {
  checkout_attempt_id: string
  quote_id: string
  shipment_method_uid: string
  shipment_method_name: string
  amount_cents: number
  currency: string
  expires_at: string
}
const shippingQuote = ref<ShippingQuoteSelection | null>(null)
const quoteLoading = ref(false)
const quoteError = ref('')
let quoteTimer: ReturnType<typeof setTimeout> | null = null

const form = ref({
  email: user.value?.email ?? '',
  name: '',
  address1: '',
  address2: '',
  city: '',
  state_code: '',
  country_code: 'US',
  zip: '',
  phone: '',
})

const submitting = ref(false)
const errorMessage = ref('')

async function applyCoupon() {
  couponError.value = ''
  couponBusy.value = true
  try {
    const preview = await $fetch<typeof couponPreview.value>('/api/coupons/validate', {
      method: 'POST',
      body: {
        coupon_slug: normalizeCouponSlug(couponCode.value),
        email: form.value.email,
        subtotal_cents: subtotalCents.value,
      },
    })
    couponPreview.value = preview
    couponCode.value = preview?.slug || couponCode.value
  } catch (err: any) {
    couponPreview.value = null
    couponError.value = err?.data?.message || err?.message || 'Could not apply coupon.'
  } finally {
    couponBusy.value = false
  }
}

function removeCoupon() {
  couponPreview.value = null
  couponError.value = ''
}

watch([() => form.value.email, selectedProduct, quantity, subtotalCents], () => {
  if (couponPreview.value) removeCoupon()
})

function hasQuoteAddress() {
  const value = form.value
  return !!(
    premade.value
    && selectedProduct.value
    && !isDigital.value
    && value.email
    && value.name
    && value.address1
    && value.city
    && value.state_code
    && value.country_code
    && value.zip
  )
}

function clearShippingQuote() {
  shippingQuote.value = null
  quoteError.value = ''
  lockedProductPriceCents.value = null
}

async function requestShippingQuote() {
  if (!hasQuoteAddress() || !premade.value || !selectedProduct.value) {
    clearShippingQuote()
    return
  }
  quoteLoading.value = true
  quoteError.value = ''
  try {
    const response = await $fetch<{
      checkout_attempt_id: string
      quote_id: string
      selected: Omit<ShippingQuoteSelection, 'checkout_attempt_id' | 'quote_id'>
      pricing?: { product_uid: string; retail_price_cents: number }
    }>('/api/checkout/quote', {
      method: 'POST',
      body: {
        cart_source: 'premade',
        premade_slug: premade.value.slug,
        product_uid: selectedProductUid.value,
        quantity: quantity.value,
        shipping_address: {
          name: form.value.name.trim(),
          address1: form.value.address1.trim(),
          address2: form.value.address2.trim() || undefined,
          city: form.value.city.trim(),
          state_code: form.value.state_code.trim().toUpperCase(),
          country_code: form.value.country_code,
          zip: form.value.zip.trim(),
          email: form.value.email.trim(),
          phone: form.value.phone.trim() || undefined,
        },
      },
    })
    shippingQuote.value = {
      checkout_attempt_id: response.checkout_attempt_id,
      quote_id: response.quote_id,
      ...response.selected,
    }
    if (response.pricing?.retail_price_cents) lockedProductPriceCents.value = response.pricing.retail_price_cents
  } catch (err: any) {
    shippingQuote.value = null
    quoteError.value = err?.data?.message || err?.message || 'Could not calculate shipping for this address.'
  } finally {
    quoteLoading.value = false
  }
}

watch([
  () => form.value.email,
  () => form.value.name,
  () => form.value.address1,
  () => form.value.address2,
  () => form.value.city,
  () => form.value.state_code,
  () => form.value.country_code,
  () => form.value.zip,
  () => form.value.phone,
  selectedProduct,
  quantity,
], () => {
  if (quoteTimer) clearTimeout(quoteTimer)
  if (isDigital.value) {
    clearShippingQuote()
    return
  }
  clearShippingQuote()
  quoteTimer = setTimeout(requestShippingQuote, 650)
})

async function requestPremadeMockup() {
  const sourceId = premade.value?.id || premade.value?.slug
  const productUid = selectedProduct.value?.product_uid
  if (!productMockupsEnabled.value || !sourceId || !productUid || isDigital.value) return
  if (mockupUrl.value && mockupTargetProductUid.value === productUid) return

  mockupInFlight.value = true
  mockupTargetProductUid.value = productUid
  try {
    const response = await $fetch<{
      status: 'ready'
      mockup_url: string
      product_uid: string
      mockup_template_id: string
      mockup_hash: string
    }>('/api/mockups/render', {
      method: 'POST',
      body: {
        source: { type: 'premade', id: sourceId },
        product_uid: productUid,
      },
    })
    if (mockupTargetProductUid.value === productUid) {
      mockupUrl.value = response.mockup_url
    }
  } catch {
    mockupUrl.value = null
  } finally {
    if (mockupTargetProductUid.value === productUid) {
      mockupInFlight.value = false
    }
  }
}

watch([selectedProductUid, productMockupsEnabled], () => {
  mockupUrl.value = null
  mockupInFlight.value = false
  mockupTargetProductUid.value = null
  if (productMockupsEnabled.value) void requestPremadeMockup()
}, { immediate: true })

async function checkout() {
  if (!premade.value) return
  errorMessage.value = ''
  submitting.value = true
  step.value = 'payment'
  try {
    const resp = await $fetch<{ url: string }>('/api/checkout/session', {
      method: 'POST',
      body: {
        cart_source: 'premade',
        slug: premade.value.slug,
        checkout_attempt_id: !isDigital.value ? shippingQuote.value?.checkout_attempt_id : undefined,
        quote_id: !isDigital.value ? shippingQuote.value?.quote_id : null,
        premade_slug: premade.value.slug,
        product_uid: selectedProductUid.value,
        quantity: quantity.value,
        shipping_address: {
          name: form.value.name.trim(),
          address1: form.value.address1.trim(),
          address2: form.value.address2.trim() || undefined,
          city: form.value.city.trim(),
          state_code: form.value.state_code.trim().toUpperCase(),
          country_code: form.value.country_code,
          zip: form.value.zip.trim(),
          email: form.value.email.trim(),
          phone: form.value.phone.trim() || undefined,
        },
        digital_only: isDigital.value,
        coupon_slug: couponPreview.value?.slug,
      },
    })
    if (resp?.url) {
      window.location.href = resp.url
    } else {
      throw new Error('Checkout session missing redirect URL')
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Could not start checkout.'
    step.value = 'shipping'
    submitting.value = false
  }
}

useSeo({
  title: premade.value ? `Checkout — ${premade.value.title}` : 'Checkout',
  description: 'Secure checkout for your RadMaps trail poster.',
  path: route.fullPath,
  noindex: true,
})

// ─── Route SVG for summary thumbnail ────────────────────────────────────
function projectCoords() {
  if (!premade.value) return null
  const feat = premade.value.geojson?.features?.[0]
  const g = feat?.geometry as any
  const coords: number[][] | undefined =
    g?.type === 'LineString' ? g.coordinates :
    g?.type === 'MultiLineString' ? (g.coordinates as number[][][]).flat() : undefined
  if (!coords || coords.length < 2) return null
  const [minLng, minLat, maxLng, maxLat] = premade.value.bbox
  const lngRange = (maxLng - minLng) || 0.0001
  const latRange = (maxLat - minLat) || 0.0001
  const padX = 6, padY = 14
  const availW = 100 - padX * 2
  const availH = 133 - padY * 2
  const scale = Math.min(availW / lngRange, availH / latRange)
  const offsetX = padX + (availW - lngRange * scale) / 2
  const offsetY = padY + (availH - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coords.length / 80))
  const result: { x: number; y: number }[] = []
  for (let i = 0; i < coords.length; i += stride) {
    const [lng, lat] = coords[i]
    result.push({ x: offsetX + (lng - minLng) * scale, y: offsetY + (maxLat - lat) * scale })
  }
  return result
}
const routePath = computed(() => {
  const pts = projectCoords()
  if (!pts) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
})

// ─── Field wrapper ──────────────────────────────────────────────────────
const FormField = defineComponent({
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h('label', { class: 'block' }, [
        h('span', { class: 'text-[11px] font-semibold tracking-[0.12em] uppercase text-stone-500 mb-1.5 block' }, [
          props.label,
          props.required
            ? h('span', { class: 'text-red-400 ml-0.5' }, '*')
            : null,
        ]),
        slots.default?.(),
      ])
  },
})
</script>

<style scoped>
.form-input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(231 229 228);
  background: white;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: rgb(28 25 23);
  transition: all 0.15s;
}
.form-input:focus {
  outline: none;
  border-color: #2D6A4F;
  box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.12);
}
.form-input::placeholder {
  color: rgb(168 162 158);
}
</style>
