<template>
  <div v-if="!premade" class="max-w-3xl mx-auto px-6 py-24 text-center">
    <h1 class="text-2xl font-semibold text-stone-900 mb-2" style="font-family:'Space Grotesk',sans-serif">
      Print not found
    </h1>
    <p class="text-stone-500">Back to <NuxtLink to="/shop" class="text-[#2D6A4F] font-semibold hover:underline">the shop</NuxtLink>.</p>
  </div>

  <div v-else class="max-w-5xl mx-auto px-4 sm:px-6 py-10">

    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-stone-400 mb-8">
      <NuxtLink to="/shop" class="hover:text-stone-900 transition-colors">Shop</NuxtLink>
      <span class="opacity-40">/</span>
      <NuxtLink :to="`/shop/${premade.slug}`" class="hover:text-stone-900 transition-colors truncate">{{ premade.title }}</NuxtLink>
      <span class="opacity-40">/</span>
      <span class="text-stone-700">Checkout</span>
    </div>

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
          <NuxtLink :to="`/auth/login?redirect=${encodeURIComponent(currentPath)}`"
            class="text-xs font-semibold text-[#2D6A4F] hover:text-[#1E5238] shrink-0 transition-colors whitespace-nowrap">
            Sign in →
          </NuxtLink>
        </div>

        <form @submit.prevent="checkout" class="space-y-5">

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
              />
            </FormField>
          </fieldset>

          <!-- Shipping -->
          <fieldset class="space-y-4">
            <legend class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-500 mb-1">
              Shipping address
            </legend>
            <FormField label="Full name" required>
              <input v-model="form.name" type="text" required autocomplete="name" class="form-input" />
            </FormField>
            <FormField label="Address line 1" required>
              <input v-model="form.address1" type="text" required autocomplete="address-line1" class="form-input" />
            </FormField>
            <FormField label="Address line 2 (optional)">
              <input v-model="form.address2" type="text" autocomplete="address-line2" class="form-input" />
            </FormField>
            <div class="grid grid-cols-2 gap-4">
              <FormField label="City" required>
                <input v-model="form.city" type="text" required autocomplete="address-level2" class="form-input" />
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
                />
              </FormField>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <FormField label="ZIP / Postal code" required>
                <input v-model="form.zip" type="text" required autocomplete="postal-code" class="form-input" />
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
              <input v-model="form.phone" type="tel" autocomplete="tel" class="form-input" />
            </FormField>
          </fieldset>

          <!-- Error banner -->
          <div v-if="errorMessage"
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
            :disabled="submitting"
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
              style="aspect-ratio:3/4"
              :style="{ backgroundColor: premade.style_config.background_color }"
            >
              <img v-if="premade.preview_image_url" :src="premade.preview_image_url" class="w-full h-full object-cover" />
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
                {{ selectedProduct?.size_label }} · Qty {{ quantity }}
              </p>
            </div>
          </div>

          <div class="space-y-2 text-sm pt-5">
            <div class="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span class="tabular-nums">{{ formatPrice(totalCents) }}</span>
            </div>
            <div class="flex justify-between text-stone-600">
              <span>Shipping</span>
              <span class="text-stone-400">Calculated at checkout</span>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-stone-200 flex items-baseline justify-between">
            <span class="text-xs font-semibold tracking-[0.18em] uppercase text-stone-500">Total</span>
            <span class="text-2xl font-semibold text-stone-900 tabular-nums" style="font-family:'Space Grotesk',sans-serif">
              {{ formatPrice(totalCents) }}
            </span>
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
</template>

<script setup lang="ts">
import { h, defineComponent, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseUser } from '#imports'
import { getPremadeBySlug } from '~/data/premade-maps'
import { getProduct, formatPrice, PRODUCTS } from '~/utils/products'

definePageMeta({ layout: 'default' })

const route = useRoute()
const user = useSupabaseUser()
const slug = route.params.slug as string
const premade = getPremadeBySlug(slug)
const currentPath = computed(() => `/shop/${slug}/checkout${route.query.size ? `?size=${route.query.size}` : ''}${route.query.qty ? `&qty=${route.query.qty}` : ''}`)

// Read size + qty from query (set by detail page)
const selectedProductUid = ref(
  (route.query.size as string) ||
    PRODUCTS.find((p) => p.type === 'poster' && p.size_label === '12×16"')?.product_uid ||
    'flat_product_pf_12x16_pt_170-gsm-uncoated_cl_4-0_ver'
)
const quantity = ref(Math.max(1, Math.min(10, parseInt((route.query.qty as string) || '1', 10) || 1)))

const selectedProduct = computed(() => getProduct(selectedProductUid.value))
const totalCents = computed(() => (selectedProduct.value?.price_cents ?? 0) * quantity.value)

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

async function checkout() {
  if (!premade) return
  errorMessage.value = ''
  submitting.value = true
  try {
    const resp = await $fetch<{ url: string }>('/api/shop/checkout', {
      method: 'POST',
      body: {
        slug: premade.slug,
        product_uid: selectedProductUid.value,
        print_size: selectedProduct.value?.size_label ?? '',
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
    if (resp?.url) {
      window.location.href = resp.url
    } else {
      throw new Error('Checkout session missing redirect URL')
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Could not start checkout.'
    submitting.value = false
  }
}

useHead(() => ({
  title: premade ? `Checkout — ${premade.title}` : 'Checkout — RadMaps',
}))

// ─── Route SVG for summary thumbnail ────────────────────────────────────
function projectCoords() {
  if (!premade) return null
  const feat = premade.geojson?.features?.[0]
  const g = feat?.geometry as any
  const coords: number[][] | undefined =
    g?.type === 'LineString' ? g.coordinates :
    g?.type === 'MultiLineString' ? (g.coordinates as number[][][]).flat() : undefined
  if (!coords || coords.length < 2) return null
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
