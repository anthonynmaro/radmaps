<template>
  <div class="product-selector" :class="{ 'is-expanded': isExpanded }">

    <!-- Selected option summary -->
    <button
      type="button"
      class="w-full shrink-0 flex items-center justify-between gap-4 px-5 py-4 bg-white border-b border-stone-200 hover:bg-stone-50 transition-colors"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex min-w-0 items-center gap-3">
        <span class="product-mini shrink-0" :class="formatVisualClass(selectedType)" aria-hidden="true">
          <UIcon v-if="selectedType === 'digital'" :name="selectedFormatMeta.icon" class="h-4 w-4" />
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
    <div v-show="isExpanded" class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">

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
              <span class="product-mini mt-0.5 shrink-0" :class="formatVisualClass(format.type)" aria-hidden="true">
                <UIcon v-if="format.type === 'digital'" :name="format.icon" class="h-4 w-4" />
              </span>
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
      </div>

      <!-- CTA -->
      <div v-if="showConfirmButton" class="shrink-0 border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-10px_20px_rgba(28,25,23,0.04)]">
        <button
          type="button"
          :disabled="!selectedProduct"
          class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#2D6A4F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#235840] disabled:cursor-not-allowed disabled:opacity-50"
          @click="confirmSelection"
        >
          <span>{{ confirmButtonLabel }}</span>
          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  PRODUCT_FORMAT_META,
  SIZES,
  formatPrice,
  getDefaultPhysicalProduct,
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
  showConfirm?: boolean
  includeDigital?: boolean
  confirmLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [product: PrintProduct | null]
  'aspect-change': [payload: { product: PrintProduct; previousAspect: number | null }]
  'confirm': [payload: { product: PrintProduct; framing: ProductFraming }]
}>()

const defaultProduct = getDefaultPhysicalProduct()
const isExpanded = ref(true)

const selectedSizeLabel = ref<string>(
  props.modelValue?.size_label && props.modelValue.size_label !== 'Digital'
    ? props.modelValue.size_label
    : defaultProduct?.size_label ?? SIZES[0].label,
)

const initialType = props.modelValue?.type === 'digital' && props.includeDigital === false
  ? defaultProduct?.type ?? 'poster'
  : props.modelValue?.type ?? defaultProduct?.type ?? 'poster'

const selectedType = ref<ProductFormat>(
  initialType,
)

const selectedMaterialKey = ref<string | undefined>(
  props.modelValue?.material_key ?? getDefaultMaterialKeyForFormat(selectedType.value, selectedSizeLabel.value),
)

const productPrices = ref<Record<string, number>>({})
const showConfirmButton = computed(() => props.showConfirm !== false)
const formatOptions = computed(() =>
  getProductFormatOptions().filter(option => props.includeDigital !== false || option.type !== 'digital'),
)
const visibleMaterialOptions = computed(() => getVisibleProductMaterialOptions(selectedType.value))
const selectedFormatMeta = computed(() => PRODUCT_FORMAT_META[selectedType.value])

const materialSectionLabel = computed(() => {
  if (selectedType.value === 'poster') return 'Paper'
  if (selectedType.value === 'aluminum') return 'Aluminum'
  if (selectedType.value === 'framed') return 'Frame'
  if (selectedType.value === 'wall_hanging') return 'Rails & paper'
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
const confirmButtonLabel = computed(() => {
  if (!selectedProduct.value) return 'Choose an enabled size'
  return props.confirmLabel || `Render ${selectedProduct.value.name}`
})

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

function firstAvailableSizeLabel(type: ProductFormat, materialKey: string | undefined, preferredSizeLabel?: string): string | undefined {
  const labels = [
    preferredSizeLabel,
    ...SIZES.map(size => size.label),
  ].filter((label, index, all): label is string => !!label && all.indexOf(label) === index)

  return labels.find(label => !!getProductForSelection({ type, sizeLabel: label, materialKey }))
}

function applyValidSelection(type: ProductFormat, materialKey?: string, preferredSizeLabel = selectedSizeLabel.value) {
  selectedType.value = type

  if (type === 'digital') {
    selectedMaterialKey.value = materialKey
    return
  }

  let nextMaterialKey = materialKey ?? getDefaultMaterialKeyForFormat(type, preferredSizeLabel)
  let nextSizeLabel = preferredSizeLabel

  if (!getProductForSelection({ type, sizeLabel: nextSizeLabel, materialKey: nextMaterialKey })) {
    nextSizeLabel = firstAvailableSizeLabel(type, nextMaterialKey, preferredSizeLabel)
      ?? firstAvailableSizeLabel(type, undefined, preferredSizeLabel)
      ?? defaultProduct?.size_label
      ?? SIZES[0].label
  }

  if (!getProductForSelection({ type, sizeLabel: nextSizeLabel, materialKey: nextMaterialKey })) {
    nextMaterialKey = getDefaultMaterialKeyForFormat(type, nextSizeLabel)
  }

  selectedSizeLabel.value = nextSizeLabel
  selectedMaterialKey.value = nextMaterialKey
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

function formatVisualClass(type: ProductFormat): string {
  return `product-mini--${type}`
}

function selectFormat(type: ProductFormat) {
  if (type === 'digital' && props.includeDigital === false) return
  applyValidSelection(type, getDefaultMaterialKeyForFormat(type, selectedSizeLabel.value))
  emitCurrentProduct()
}

function selectMaterial(materialKey: string) {
  applyValidSelection(selectedType.value, materialKey)
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

watch(() => props.modelValue?.product_uid ?? null, () => {
  const product = props.modelValue
  if (!product) {
    applyValidSelection(selectedType.value, selectedMaterialKey.value)
    emitCurrentProduct()
    return
  }
  selectedType.value = product.type
  selectedSizeLabel.value = product.size_label
  selectedMaterialKey.value = product.material_key
}, { flush: 'post' })

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
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.product-mini {
  position: relative;
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.45rem;
  background: #f5f3ef;
  color: #57534e;
  box-shadow: inset 0 0 0 1px rgba(120, 113, 108, 0.14);
}

.product-mini::before,
.product-mini::after {
  position: absolute;
  content: "";
  box-sizing: border-box;
}

.product-mini::before {
  left: 0.78rem;
  top: 0.38rem;
  width: 0.72rem;
  height: 1.08rem;
  background: #fffdf8;
  border: 1px solid rgba(87, 83, 78, 0.28);
  box-shadow: 0.22rem 0.28rem 0 rgba(87, 83, 78, 0.12);
}

.product-mini--framed::before {
  background: #f9f7f2;
  border: 0.18rem solid #1c1917;
}

.product-mini--wall_hanging::before {
  top: 0.52rem;
  box-shadow: 0.2rem 0.24rem 0 rgba(87, 83, 78, 0.12);
}

.product-mini--wall_hanging::after {
  left: 0.58rem;
  top: 0.34rem;
  width: 1.12rem;
  height: 0.16rem;
  border-radius: 999px;
  background: #1c1917;
  box-shadow: 0 1.18rem 0 #1c1917;
}

.product-mini--aluminum::before {
  background: linear-gradient(135deg, #f9faf9, #c9ccca 62%, #f4f1ea);
  border-color: rgba(87, 83, 78, 0.22);
}

.product-mini--acrylic::before {
  background: linear-gradient(135deg, #f7fbff 0%, #111827 40%, #f8fafc 42%, #111827 62%);
  border-color: rgba(87, 83, 78, 0.18);
}

.product-mini--digital::before,
.product-mini--digital::after {
  display: none;
}
</style>
