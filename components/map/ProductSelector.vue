<template>
  <div class="product-selector" :class="{ 'is-expanded': isExpanded }">

    <!-- Toggle handle -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between px-5 py-3 bg-white border-b border-stone-200 hover:bg-stone-50 transition-colors rounded-t-2xl"
    >
      <div class="flex items-center gap-3">
        <span class="text-lg">{{ selectedTypeIcon }}</span>
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

      <!-- Size grid (3×2) -->
      <div>
        <p class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Size</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="size in SIZES"
            :key="size.label"
            @click="selectSize(size.label)"
            :class="[
              'flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all',
              selectedSizeLabel === size.label
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                : 'border-stone-200 hover:border-stone-300',
            ]"
          >
            <!-- Portrait rect visual -->
            <div
              :class="[
                'w-5 rounded-sm mb-1.5 border-2',
                selectedSizeLabel === size.label ? 'border-[#2D6A4F]' : 'border-stone-300',
              ]"
              style="height: 30px;"
            />
            <span
              :class="[
                'text-xs font-semibold',
                selectedSizeLabel === size.label ? 'text-[#2D6A4F]' : 'text-stone-700',
              ]"
            >
              {{ size.label }}
            </span>
          </button>
        </div>
      </div>

      <!-- Material/finish picker -->
      <div>
        <p class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Finish</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="type in availableMaterials"
            :key="type"
            @click="selectType(type)"
            :class="[
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 transition-all text-sm font-medium',
              selectedType === type
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 text-[#2D6A4F]'
                : 'border-stone-200 text-stone-600 hover:border-stone-300',
            ]"
          >
            <span>{{ TYPE_META[type].icon }}</span>
            {{ TYPE_META[type].label }}
          </button>
        </div>
      </div>

      <!-- Digital info card -->
      <div v-if="selectedType === 'digital'" class="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <p class="font-semibold text-sky-900 text-sm mb-1">Digital Download</p>
        <p class="text-xs text-sky-700 mb-3">
          High-resolution file (7200×10800 px) ready for sharing or local printing at any size.
        </p>
        <p class="text-xl font-bold text-sky-900" style="font-family:'Space Grotesk',sans-serif">
          {{ formatPrice(999) }}
        </p>
      </div>

      <!-- CTA -->
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
import { ref, computed } from 'vue'
import { SIZES, PRODUCTS, getMaterialsForSize, getProductBySize, formatPrice } from '~/utils/products'
import type { PrintProduct, ProductFraming } from '~/types'

const TYPE_META: Record<string, { label: string; icon: string }> = {
  poster:       { label: 'Poster',       icon: '📋' },
  wall_hanging: { label: 'Wall Hanging', icon: '🪵' },
  canvas:       { label: 'Canvas',       icon: '🎨' },
  framed:       { label: 'Framed',       icon: '🖼️' },
  digital:      { label: 'Digital',      icon: '💾' },
}

const props = defineProps<{
  modelValue?: PrintProduct | null
  mapCenter?: [number, number]
  mapZoom?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [product: PrintProduct]
  'aspect-change': [payload: { product: PrintProduct; previousAspect: number | null }]
  'confirm': [payload: { product: PrintProduct; framing: ProductFraming }]
}>()

const isExpanded = ref(false)

const selectedSizeLabel = ref<string>(
  props.modelValue?.size_label && props.modelValue.size_label !== 'Digital'
    ? props.modelValue.size_label
    : SIZES[2].label  // default to 16×24"
)

const selectedType = ref<PrintProduct['type']>(
  props.modelValue?.type ?? 'poster'
)

const availableMaterials = computed(() => getMaterialsForSize(selectedSizeLabel.value))

const selectedProduct = computed<PrintProduct | null>(() => {
  const product = getProductBySize(selectedSizeLabel.value, selectedType.value)
  return product ?? null
})

const selectedTypeIcon = computed(() => TYPE_META[selectedType.value]?.icon ?? '📋')

function selectSize(label: string) {
  selectedSizeLabel.value = label
  const available = getMaterialsForSize(label)
  if (!available.includes(selectedType.value)) {
    selectedType.value = available[0] ?? 'poster'
  }
  emitCurrentProduct()
}

function selectType(type: PrintProduct['type']) {
  selectedType.value = type
  emitCurrentProduct()
}

function emitCurrentProduct() {
  const product = selectedProduct.value
  if (!product) return
  emit('update:modelValue', product)
  emit('aspect-change', { product, previousAspect: 2 / 3 })
}

function confirmSelection() {
  const product = selectedProduct.value
  if (!product) return
  const framing: ProductFraming = {
    product_uid: product.product_uid,
    center: props.mapCenter ?? [0, 0],
    zoom: props.mapZoom ?? 10,
    bearing: 0,
    pitch: 0,
  }
  emit('confirm', { product, framing })
  isExpanded.value = false
}

// Auto-select on mount — emit so checkout knows which product is active
if (!props.modelValue) {
  emitCurrentProduct()
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
