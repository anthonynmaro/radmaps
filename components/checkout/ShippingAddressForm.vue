<template>
  <fieldset class="space-y-4" :disabled="disabled">
    <legend class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-500 mb-1">
      Shipping address
    </legend>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Full name" required>
        <input
          :value="modelValue.name"
          type="text"
          required
          autocomplete="shipping name"
          class="checkout-input"
          data-address-field="name"
          @input="updateField('name', inputValue($event))"
        >
      </FormField>

      <FormField label="Email address" required>
        <input
          :value="modelValue.email"
          type="email"
          required
          autocomplete="shipping email"
          placeholder="you@example.com"
          class="checkout-input"
          data-address-field="email"
          @input="updateField('email', inputValue($event))"
        >
      </FormField>
    </div>

    <div class="relative">
      <FormField label="Address line 1" required>
        <input
          :value="modelValue.address1"
          type="text"
          required
          autocomplete="shipping address-line1"
          placeholder="197 Heritage Trace"
          class="checkout-input"
          data-address-field="address1"
          role="combobox"
          :aria-expanded="showSuggestionPanel ? 'true' : 'false'"
          aria-autocomplete="list"
          :aria-busy="suggesting ? 'true' : 'false'"
          @focus="addressFocused = true"
          @blur="onAddressBlur"
          @input="onAddressInput"
          @keydown="onAddressKeydown"
        >
      </FormField>

      <div
        v-if="showSuggestionPanel"
        class="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg shadow-stone-900/10"
      >
        <div v-if="suggesting" class="flex items-center gap-2 px-4 py-3 text-xs text-stone-500">
          <UIcon name="i-heroicons-arrow-path" class="h-3.5 w-3.5 animate-spin" />
          <span>Finding addresses...</span>
        </div>
        <div v-else-if="suggestError" class="px-4 py-3 text-xs text-red-600">
          {{ suggestError }}
        </div>
        <div v-else-if="suggestions.length === 0 && modelValue.address1.trim().length >= 3" class="px-4 py-3 text-xs text-stone-500">
          No address matches yet.
        </div>
        <button
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.mapbox_id || `${suggestion.feature_name}-${index}`"
          type="button"
          class="block w-full px-4 py-3 text-left transition-colors"
          :class="highlightedIndex === index ? 'bg-[#2D6A4F]/10' : 'hover:bg-stone-50'"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="block text-sm font-semibold text-stone-900">
            {{ suggestion.address_line1 || suggestion.feature_name || suggestion.matching_name }}
          </span>
          <span class="mt-0.5 block truncate text-xs text-stone-500">
            {{ suggestion.description || suggestion.full_address || suggestion.place_name }}
          </span>
        </button>
      </div>
    </div>

    <FormField label="Address line 2 (optional)">
      <input
        :value="modelValue.address2"
        type="text"
        autocomplete="shipping address-line2"
        class="checkout-input"
        data-address-field="address2"
        @input="updateField('address2', inputValue($event))"
      >
    </FormField>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <FormField label="City" required>
          <input
            :value="modelValue.city"
            type="text"
            required
            autocomplete="shipping address-level2"
            class="checkout-input"
            data-address-field="city"
            @input="updateField('city', inputValue($event))"
          >
        </FormField>
      </div>

      <FormField label="State / Region" required>
        <input
          :value="modelValue.state_code"
          type="text"
          required
          autocomplete="shipping address-level1"
          maxlength="64"
          placeholder="CA"
          class="checkout-input uppercase"
          data-address-field="state_code"
          @input="updateField('state_code', inputValue($event))"
        >
      </FormField>

      <FormField label="ZIP / Postal code" required>
        <input
          :value="modelValue.zip"
          type="text"
          required
          autocomplete="shipping postal-code"
          class="checkout-input"
          data-address-field="zip"
          @input="updateField('zip', inputValue($event))"
        >
      </FormField>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Country" required>
        <select
          :value="modelValue.country_code"
          required
          autocomplete="shipping country"
          class="checkout-input bg-white"
          data-address-field="country_code"
          @change="updateField('country_code', inputValue($event))"
        >
          <option
            v-for="country in CHECKOUT_COUNTRIES"
            :key="country.code"
            :value="country.code"
          >
            {{ country.label }}
          </option>
        </select>
      </FormField>

      <FormField label="Phone (optional)">
        <input
          :value="modelValue.phone"
          type="tel"
          autocomplete="shipping tel"
          class="checkout-input"
          data-address-field="phone"
          @input="updateField('phone', inputValue($event))"
        >
      </FormField>
    </div>

    <div v-if="quoteLoading || quoteError || shippingQuote" class="rounded-xl border px-4 py-3 text-xs" :class="quoteStatusClass">
      <div class="flex items-center gap-2">
        <UIcon
          :name="quoteStatusIcon"
          class="h-4 w-4 shrink-0"
          :class="quoteLoading ? 'animate-spin' : ''"
        />
        <span>{{ quoteStatusText }}</span>
      </div>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AddressAutofillSuggestion } from '@mapbox/search-js-core'
import {
  CHECKOUT_COUNTRIES,
  mapMapboxAutofillToAddressPatch,
  missingCheckoutAddressFields,
  normalizeCheckoutAddress,
  type CheckoutAddress,
} from '~/utils/checkoutAddress'

type ShippingQuoteSummary = {
  shipment_method_name?: string
  amount_cents?: number
} | null

const props = withDefaults(defineProps<{
  modelValue: CheckoutAddress
  quoteLoading?: boolean
  quoteError?: string
  shippingQuote?: ShippingQuoteSummary
  mapboxToken?: string
  disabled?: boolean
}>(), {
  quoteLoading: false,
  quoteError: '',
  shippingQuote: null,
  mapboxToken: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: CheckoutAddress]
  'address-selected': [value: CheckoutAddress]
  'manual-edit': [value: CheckoutAddress]
}>()

const addressFocused = ref(false)
const suggesting = ref(false)
const retrieving = ref(false)
const suggestError = ref('')
const suggestions = ref<AddressAutofillSuggestion[]>([])
const highlightedIndex = ref(-1)
const hasSearched = ref(false)
let activeSuggestRun = 0
let searchSession: any = null

const showSuggestionPanel = computed(() =>
  addressFocused.value
  && !props.disabled
  && props.modelValue.address1.trim().length >= 3
  && (suggesting.value || suggestError.value || suggestions.value.length > 0 || hasSearched.value),
)

const quoteStatusClass = computed(() => {
  if (props.quoteError) return 'border-red-200 bg-red-50 text-red-700'
  if (props.quoteLoading) return 'border-sky-200 bg-sky-50 text-sky-800'
  return 'border-emerald-200 bg-emerald-50 text-emerald-800'
})

const quoteStatusIcon = computed(() => {
  if (props.quoteError) return 'i-heroicons-exclamation-circle'
  if (props.quoteLoading) return 'i-heroicons-arrow-path'
  return 'i-heroicons-check-circle'
})

const quoteStatusText = computed(() => {
  if (props.quoteError) return props.quoteError
  if (props.quoteLoading) {
    return props.shippingQuote
      ? 'Updating shipping while keeping the last quote visible.'
      : 'Updating shipping...'
  }
  if (props.shippingQuote?.shipment_method_name) {
    return `${props.shippingQuote.shipment_method_name} locked for this address.`
  }
  return ''
})

watch(() => props.mapboxToken, () => {
  abortSuggest()
  searchSession = null
})

onBeforeUnmount(() => {
  abortSuggest()
})

function inputValue(event: Event): string {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  return target?.value ?? ''
}

function updateField(field: keyof CheckoutAddress, value: string, selected = false) {
  const next = normalizeCheckoutAddress({
    ...props.modelValue,
    [field]: value,
  })
  emit('update:modelValue', next)
  if (!selected) emit('manual-edit', next)
}

function emitAddress(next: CheckoutAddress, selected: boolean) {
  emit('update:modelValue', next)
  if (selected) {
    emit('address-selected', next)
    void focusFirstMissingField(next)
  } else {
    emit('manual-edit', next)
  }
}

async function ensureSearchSession() {
  if (!import.meta.client || !props.mapboxToken) return null
  if (searchSession) return searchSession

  try {
    const { AddressAutofillCore, SearchSession } = await import('@mapbox/search-js-core')
    const autofill = new AddressAutofillCore({
      accessToken: props.mapboxToken,
      language: 'en',
      limit: 5,
    })
    searchSession = new SearchSession(autofill, 200)
    return searchSession
  } catch {
    return null
  }
}

function abortSuggest() {
  activeSuggestRun += 1
  suggesting.value = false
  try {
    searchSession?.abort?.()
  } catch {
    // Mapbox sessions are best-effort here; stale run ids still guard results.
  }
}

function onAddressInput(event: Event) {
  const value = inputValue(event)
  updateField('address1', value)
  void suggestAddresses(value)
}

async function suggestAddresses(value: string) {
  const query = value.trim()
  suggestError.value = ''
  suggestions.value = []
  highlightedIndex.value = -1
  hasSearched.value = false

  if (props.disabled || query.length < 3 || !props.mapboxToken) {
    abortSuggest()
    return
  }

  const session = await ensureSearchSession()
  if (!session) return

  const run = ++activeSuggestRun
  suggesting.value = true
  try {
    const response = await session.suggest(query, {
      country: props.modelValue.country_code || 'US',
      limit: 5,
      language: 'en',
      proximity: 'ip',
    })
    if (run !== activeSuggestRun) return
    suggestions.value = (response?.suggestions || []).slice(0, 5)
    highlightedIndex.value = suggestions.value.length ? 0 : -1
    hasSearched.value = true
  } catch {
    if (run !== activeSuggestRun) return
    suggestError.value = 'Address lookup is unavailable.'
    hasSearched.value = true
  } finally {
    if (run === activeSuggestRun) suggesting.value = false
  }
}

async function selectSuggestion(suggestion: AddressAutofillSuggestion) {
  if (props.disabled) return
  const session = await ensureSearchSession()
  let selectedResult: unknown = suggestion
  retrieving.value = true
  suggestError.value = ''

  try {
    if (session?.canRetrieve?.(suggestion)) {
      const response = await session.retrieve(suggestion)
      selectedResult = response?.features?.[0] || suggestion
    }
    const patch = mapMapboxAutofillToAddressPatch(selectedResult)
    const filledPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => typeof value === 'string' && value.trim()),
    )
    const next = normalizeCheckoutAddress({
      ...props.modelValue,
      ...filledPatch,
    })
    suggestions.value = []
    highlightedIndex.value = -1
    hasSearched.value = false
    addressFocused.value = false
    emitAddress(next, true)
  } catch {
    suggestError.value = 'Could not use that address.'
  } finally {
    retrieving.value = false
  }
}

function onAddressKeydown(event: KeyboardEvent) {
  if (!showSuggestionPanel.value || suggestions.value.length === 0) {
    if (event.key === 'Escape') {
      suggestions.value = []
      hasSearched.value = false
      addressFocused.value = false
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0
      ? suggestions.value.length - 1
      : highlightedIndex.value - 1
  } else if (event.key === 'Enter' && highlightedIndex.value >= 0) {
    event.preventDefault()
    void selectSuggestion(suggestions.value[highlightedIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    suggestions.value = []
    hasSearched.value = false
    addressFocused.value = false
  }
}

function onAddressBlur() {
  window.setTimeout(() => {
    if (!retrieving.value) addressFocused.value = false
  }, 120)
}

async function focusFirstMissingField(address: CheckoutAddress) {
  await nextTick()
  const missing = missingCheckoutAddressFields(address).find(field => field !== 'email')
  if (!missing) return
  const element = document.querySelector<HTMLElement>(`[data-address-field="${missing}"]`)
  element?.focus()
}

const FormField = defineComponent({
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  setup(fieldProps, { slots }) {
    return () =>
      h('label', { class: 'block' }, [
        h('span', { class: 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500' }, [
          fieldProps.label,
          fieldProps.required
            ? h('span', { class: 'ml-0.5 text-red-400' }, '*')
            : null,
        ]),
        slots.default?.(),
      ])
  },
})
</script>

<style scoped>
.checkout-input {
  width: 100%;
  min-height: 48px;
  border-radius: 0.75rem;
  border: 1px solid rgb(231 229 228);
  background: white;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  color: rgb(28 25 23);
  transition: all 0.15s;
}

.checkout-input:focus {
  outline: none;
  border-color: #2D6A4F;
  box-shadow: 0 0 0 3px rgba(45, 106, 79, 0.12);
}

.checkout-input::placeholder {
  color: rgb(168 162 158);
}
</style>
