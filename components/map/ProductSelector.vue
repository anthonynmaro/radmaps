<template>
  <!-- Slide-up product selector panel -->
  <div class="product-selector" :class="{ 'is-expanded': isExpanded }">

    <!-- Toggle handle -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between px-5 py-3 bg-white border-b border-stone-200 hover:bg-stone-50 transition-colors rounded-t-2xl"
    >
      <div class="flex items-center gap-3">
        <span class="text-lg">{{ productTypeIcon }}</span>
        <div class="text-left">
          <p class="text-sm font-semibold text-stone-900">
            {{ selectedProduct?.name ?? 'Select a Product' }}
          </p>
          <p v-if="selectedProduct" class="text-xs text-stone-500">
            {{ formatPrice(selectedProduct.price_cents) }}
            <span v-if="selectedProduct.type !== 'digital'"> · Free shipping</span>
          </p>
        </div>
      </div>
      <svg
        class="w-4 h-4 text-stone-400 transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
        viewBox="0 0 20 20" fill="currentColor"
      >
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
    </button>

    <!-- Expanded panel -->
    <div v-show="isExpanded" class="px-5 py-4 space-y-5 bg-white max-h-[60vh] overflow-y-auto">

      <!-- Product type tabs -->
      <div class="flex gap-2">
        <button
          v-for="ptype in productTypes"
          :key="ptype.id"
          @click="selectType(ptype.id)"
          :class="[
            'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium',
            selectedType === ptype.id
              ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 text-[#2D6A4F]'
              : 'border-stone-200 text-stone-500 hover:border-stone-300',
          ]"
        >
          <span class="text-base">{{ ptype.icon }}</span>
          {{ ptype.label }}
        </button>
      </div>

      <!-- Size grid (non-digital) -->
      <div v-if="selectedType !== 'digital'" class="space-y-2">
        <p class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Size</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            v-for="product in availableProducts"
            :key="product.product_uid"
            @click="selectProduct(product)"
            :class="[
              'relative p-3 rounded-xl border-2 transition-all text-left',
              selectedProduct?.product_uid === product.product_uid
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                : 'border-stone-200 hover:border-stone-300',
            ]"
          >
            <p class="font-semibold text-stone-900 text-sm">{{ product.size_label }}</p>
            <p class="text-sm font-bold text-[#2D6A4F] mt-1">{{ formatPrice(product.price_cents) }}</p>
            <!-- Aspect ratio changed indicator -->
            <span
              v-if="previousAspect && Math.abs(product.aspect_ratio - previousAspect) > 0.01"
              class="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400"
              title="Different aspect ratio — map will reframe"
            />
          </button>
        </div>
      </div>

      <!-- Digital info -->
      <div v-if="selectedType === 'digital'" class="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <p class="font-semibold text-sky-900 text-sm mb-1">Digital Download</p>
        <p class="text-xs text-sky-700 mb-3">
          High-resolution file (7200×10800px) ready for sharing or local printing at any size.
        </p>
        <p class="text-xl font-bold text-sky-900" style="font-family:'Space Grotesk',sans-serif">
          {{ formatPrice(999) }}
        </p>
      </div>

      <!-- Framing hint when aspect ratio changes -->
      <div
        v-if="aspectChanged && selectedType !== 'digital'"
        class="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
      >
        <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
        <p class="text-xs text-amber-800">
          This size has a different aspect ratio. The map has been reframed — pan and zoom on the
          preview to adjust how your trail is positioned before proceeding.
        </p>
      </div>

      <!-- Action button -->
      <button
        v-if="selectedProduct"
        @click="confirmSelection"
        class="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] rounded-xl py-3 transition-colors"
      >
        Continue with {{ selectedProduct.name }}
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { PRODUCTS, getProductsByType, formatPrice } from '~/utils/products'
import type { PrintProduct, ProductFraming } from '~/types'

const props = defineProps<{
  /** The currently selected product (if any) — for restoring state */
  modelValue?: PrintProduct | null
  /** Current map center for framing state */
  mapCenter?: [number, number]
  /** Current map zoom for framing state */
  mapZoom?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [product: PrintProduct]
  /** Emitted when product changes, carrying the new aspect ratio for the map preview */
  'aspect-change': [payload: { product: PrintProduct; previousAspect: number | null }]
  /** Emitted when user confirms their selection and is ready to proceed to checkout */
  'confirm': [payload: { product: PrintProduct; framing: ProductFraming }]
}>()

const isExpanded = ref(false)

const productTypes = [
  { id: 'poster' as const, label: 'Poster', icon: '📋' },
  { id: 'framed' as const, label: 'Framed', icon: '🖼️' },
  { id: 'canvas' as const, label: 'Canvas', icon: '🎨' },
  { id: 'digital' as const, label: 'Digital', icon: '💾' },
]

const selectedType = ref<'poster' | 'framed' | 'canvas' | 'digital'>(
  props.modelValue?.type ?? 'poster'
)
const selectedProduct = ref<PrintProduct | null>(props.modelValue ?? null)
const previousAspect = ref<number | null>(null)

const availableProducts = computed(() => {
  if (selectedType.value === 'digital') return []
  return getProductsByType(selectedType.value)
})

const productTypeIcon = computed(() => {
  const found = productTypes.find(t => t.id === selectedType.value)
  return found?.icon ?? '📋'
})

const aspectChanged = computed(() => {
  if (!selectedProduct.value || !previousAspect.value) return false
  return Math.abs(selectedProduct.value.aspect_ratio - previousAspect.value) > 0.01
})

function selectType(type: typeof selectedType.value) {
  selectedType.value = type
  if (type === 'digital') {
    const dp = PRODUCTS.find(p => p.type === 'digital')
    if (dp) selectProduct(dp)
    return
  }
  const products = getProductsByType(type)
  if (products.length > 0) {
    // Try to match the current size, otherwise pick the first
    const matchingSize = selectedProduct.value
      ? products.find(p => p.size_label === selectedProduct.value!.size_label)
      : null
    selectProduct(matchingSize ?? products[0])
  }
}

function selectProduct(product: PrintProduct) {
  const prevAspect = selectedProduct.value?.aspect_ratio ?? null
  previousAspect.value = prevAspect
  selectedProduct.value = product

  emit('update:modelValue', product)
  emit('aspect-change', { product, previousAspect: prevAspect })
}

function confirmSelection() {
  if (!selectedProduct.value) return
  const framing: ProductFraming = {
    product_uid: selectedProduct.value.product_uid,
    center: props.mapCenter ?? [0, 0],
    zoom: props.mapZoom ?? 10,
    bearing: 0,
    pitch: 0,
  }
  emit('confirm', { product: selectedProduct.value, framing })
  isExpanded.value = false
}

// Auto-select first poster on mount if nothing selected
if (!selectedProduct.value) {
  const posters = getProductsByType('poster')
  if (posters.length > 0) selectProduct(posters[0])
}
</script>

<style scoped>
.product-selector {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}
</style>
