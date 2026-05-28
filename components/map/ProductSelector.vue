<template>
  <div class="product-selector" :class="{ 'is-expanded': isExpanded }">

    <!-- Selected option summary -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-4 px-5 py-4 bg-white border-b border-stone-200 hover:bg-stone-50 transition-colors"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
          <UIcon :name="selectedFormatMeta.icon" class="h-4 w-4" />
        </span>
        <div class="min-w-0 text-left">
          <p class="text-xs font-semibold uppercase tracking-wider text-stone-400">Selected product</p>
          <p class="mt-0.5 truncate text-sm font-semibold text-stone-900">
            {{ selectedSummaryName }}
          </p>
          <p v-if="selectedProduct" class="text-xs text-stone-500">
            {{ formatPrice(selectedProduct.price_cents) }}
            <span v-if="selectedProduct.type !== 'digital'"> · Shipping calculated at checkout</span>
          </p>
        </div>
      </div>
      <UIcon
        name="i-heroicons-chevron-down"
        class="h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
      />
    </button>

    <!-- Expanded panel -->
    <div v-show="isExpanded" class="space-y-6 bg-white px-5 py-5 lg:max-h-[calc(100vh-220px)] overflow-y-auto">

      <!-- Format picker -->
      <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Format</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            v-for="format in formatOptions"
            :key="format.type"
            type="button"
            :class="[
              'flex min-h-[72px] items-start gap-3 rounded-lg border p-3 text-left transition-all',
              selectedType === format.type
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/5 text-[#2D6A4F]'
                : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50',
            ]"
            @click="selectFormat(format.type)"
          >
            <UIcon :name="format.icon" class="mt-0.5 h-4 w-4 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm font-semibold leading-5">{{ format.label }}</span>
              <span class="block text-xs leading-4 text-stone-500">{{ format.description }}</span>
              <span class="mt-1 block text-xs font-medium text-stone-500">
                from {{ formatPrice(formatStartingPrice(format.type)) }}
              </span>
            </span>
          </button>
        </div>
      </div>

      <!-- Material/paper picker -->
      <div v-if="visibleMaterialOptions.length">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">{{ materialSectionLabel }}</p>
        <div class="space-y-2">
          <button
            v-for="material in visibleMaterialOptions"
            :key="material.key"
            type="button"
            :class="[
              'w-full rounded-lg border p-3 text-left transition-all',
              selectedMaterialKey === material.key
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
            ]"
            @click="selectMaterial(material.key)"
          >
            <span class="block text-sm font-semibold text-stone-900">{{ material.label }}</span>
            <span v-if="material.description" class="mt-0.5 block text-xs leading-5 text-stone-500">
              {{ material.description }}
            </span>
            <span v-if="material.warning" class="mt-1 block text-xs leading-5 text-amber-700">
              {{ material.warning }}
            </span>
          </button>
        </div>
      </div>

      <!-- Size grid -->
      <div v-if="selectedType !== 'digital'">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Size</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="size in SIZES"
            :key="size.label"
            type="button"
            :disabled="!sizeAvailability(size.label).available"
            :title="sizeAvailability(size.label).reason"
            :class="sizeButtonClass(size.label)"
            @click="selectSize(size.label)"
          >
            <!-- Portrait rect visual -->
            <span
              :class="[
                'mb-1.5 block w-5 rounded-sm border-2',
                selectedSizeLabel === size.label ? 'border-[#2D6A4F]' : 'border-stone-300',
              ]"
              style="height: 30px;"
            />
            <span
              :class="[
                'block text-xs font-semibold',
                selectedSizeLabel === size.label ? 'text-[#2D6A4F]' : 'text-stone-700',
              ]"
            >
              {{ size.label }}
            </span>
            <span
              v-if="!sizeAvailability(size.label).available"
              class="mt-0.5 block min-h-[14px] text-[10px] leading-[14px] text-stone-400"
            >
              Unavailable
            </span>
          </button>
        </div>
      </div>

      <!-- Format-specific info cards -->
      <div v-if="selectedType === 'digital'" class="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <p class="mb-1 text-sm font-semibold text-sky-900">Digital Download</p>
        <p class="mb-3 text-xs leading-5 text-sky-700">
          High-resolution file (7200×10800 px) ready for sharing or local printing at any size.
        </p>
        <p class="text-xl font-bold text-sky-900" style="font-family:'Space Grotesk',sans-serif">
          {{ formatPrice(999) }}
        </p>
      </div>

      <div v-if="!selectedProduct && selectedType !== 'digital'" class="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p class="text-xs leading-5 text-amber-800">{{ invalidSelectionMessage }}</p>
      </div>

      <!-- CTA -->
      <button
        type="button"
        :disabled="!selectedProduct"
        class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#2D6A4F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#235840] disabled:cursor-not-allowed disabled:opacity-50"
        @click="confirmSelection"
      >
        <span>{{ selectedProduct ? `Render ${selectedProduct.name}` : 'Choose an enabled size' }}</span>
        <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  PRODUCT_FORMAT_META,
  SIZES,
  formatPrice,
  getDefaultMaterialKeyForFormat,
  getProductForSelection,
  getProductFormatOptions,
  getProductSizeAvailability,
  getProductsByType,
  getVisibleProductMaterialOptions,
  type ProductFormat,
} from '~/utils/products'
import type { PrintProduct, ProductFraming } from '~/types'

const props = defineProps<{
  modelValue?: PrintProduct | null
  mapCenter?: [number, number]
  mapZoom?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [product: PrintProduct | null]
  'aspect-change': [payload: { product: PrintProduct; previousAspect: number | null }]
  'confirm': [payload: { product: PrintProduct; framing: ProductFraming }]
}>()

const isExpanded = ref(true)

const selectedSizeLabel = ref<string>(
  props.modelValue?.size_label && props.modelValue.size_label !== 'Digital'
    ? props.modelValue.size_label
    : SIZES[2].label, // default to 16×24"
)

const selectedType = ref<ProductFormat>(
  props.modelValue?.type ?? 'poster',
)

const selectedMaterialKey = ref<string | undefined>(
  props.modelValue?.material_key ?? getDefaultMaterialKeyForFormat(selectedType.value, selectedSizeLabel.value),
)

const productPrices = ref<Record<string, number>>({})
const formatOptions = computed(() => getProductFormatOptions())
const visibleMaterialOptions = computed(() => getVisibleProductMaterialOptions(selectedType.value))
const selectedFormatMeta = computed(() => PRODUCT_FORMAT_META[selectedType.value])

const materialSectionLabel = computed(() => {
  if (selectedType.value === 'poster') return 'Paper'
  if (selectedType.value === 'aluminum') return 'Aluminum'
  return 'Material'
})

function applyRetailPrice(product: PrintProduct): PrintProduct {
  const price = productPrices.value[product.product_uid]
  return Number.isInteger(price) && price > 0
    ? { ...product, price_cents: price }
    : product
}

const selectedProduct = computed<PrintProduct | null>(() => {
  const product = getProductForSelection({
    type: selectedType.value,
    sizeLabel: selectedSizeLabel.value,
    materialKey: selectedMaterialKey.value,
  })
  return product ? applyRetailPrice(product) : null
})

const selectedSummaryName = computed(() => selectedProduct.value?.name ?? invalidSelectionMessage.value)

const invalidSelectionMessage = computed(() => {
  if (selectedType.value === 'digital') return 'Digital Download'
  return sizeAvailability(selectedSizeLabel.value).reason ?? 'Choose an enabled size for this format.'
})

function formatStartingPrice(type: ProductFormat): number {
  const prices = getProductsByType(type)
    .map(product => applyRetailPrice(product).price_cents)
    .filter(price => Number.isInteger(price) && price > 0)
  return prices.length ? Math.min(...prices) : 0
}

function sizeAvailability(label: string) {
  return getProductSizeAvailability({
    type: selectedType.value,
    sizeLabel: label,
    materialKey: selectedMaterialKey.value,
  })
}

function sizeButtonClass(label: string) {
  const availability = sizeAvailability(label)
  const selected = selectedSizeLabel.value === label
  return [
    'flex min-h-[86px] flex-col items-center justify-start rounded-lg border-2 px-2 py-3 transition-all',
    selected
      ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
      : 'border-stone-200',
    availability.available
      ? 'hover:border-stone-300 hover:bg-stone-50'
      : 'cursor-not-allowed bg-stone-50 opacity-60',
    selected && !availability.available ? 'border-amber-300 bg-amber-50' : '',
  ]
}

function selectFormat(type: ProductFormat) {
  selectedType.value = type
  selectedMaterialKey.value = getDefaultMaterialKeyForFormat(type, selectedSizeLabel.value)
  emitCurrentProduct()
}

function selectMaterial(materialKey: string) {
  selectedMaterialKey.value = materialKey
  emitCurrentProduct()
}

function selectSize(label: string) {
  if (!sizeAvailability(label).available) return
  selectedSizeLabel.value = label
  emitCurrentProduct()
}

function emitCurrentProduct() {
  const product = selectedProduct.value
  emit('update:modelValue', product)
  if (!product) return
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

// Auto-select on mount — emit so checkout knows which product is active.
if (!props.modelValue) {
  onMounted(emitCurrentProduct)
}

onMounted(async () => {
  try {
    const response = await $fetch<{ prices: Array<{ product_uid: string; retail_price_cents: number }> }>('/api/product-prices', {
      query: { country: 'US' },
    })
    productPrices.value = Object.fromEntries(
      response.prices.map((price) => [price.product_uid, price.retail_price_cents]),
    )
  } catch {
    productPrices.value = {}
  }
})

watch(productPrices, () => {
  emitCurrentProduct()
})
</script>

<style scoped>
.product-selector {
  width: 100%;
}
</style>
