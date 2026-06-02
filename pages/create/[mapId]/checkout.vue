<template>
  <div class="h-screen flex flex-col bg-[#e8e5e0]">

    <!-- Header -->
    <header class="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur border-b border-stone-200 z-40">
      <NuxtLink
:to="`/create/${mapId}/style`"
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
    <div v-else-if="map && step === 'product'" class="flex-1 overflow-y-auto">
      <div class="min-h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">

        <!-- Map Preview Area -->
        <main class="min-h-[58vh] lg:min-h-0 flex flex-col overflow-hidden relative">
          <div class="flex-1 flex flex-col items-center justify-center gap-3 p-4 sm:p-6 overflow-hidden">
            <ProductMockupPreview
              v-if="selectedProductMockupItem && mockupArtworkUrl"
              :template-image-url="selectedProductMockupItem.templateImageUrl!"
              :artwork-url="mockupArtworkUrl"
              :artwork-box="selectedProductMockupItem.artworkBox!"
              :chrome-boxes="selectedProductMockupItem.chromeBoxes"
              :finish="selectedProductMockupItem.finish"
              :scene-file="selectedProductMockupItem.sceneFile"
              :label="selectedProductMockupItem.label"
              :class="[
                'aspect-square w-full max-w-[720px] shadow-2xl shadow-stone-900/15 transition-opacity duration-200 ease-out',
                mockupPreviewUpdating ? 'opacity-85' : 'opacity-100',
              ]"
            />
            <img
              v-else-if="primaryProductPreviewUrl"
              :src="primaryProductPreviewUrl!"
              class="max-w-full max-h-full object-contain shadow-2xl shadow-stone-900/15"
              :alt="displayProductMockup ? 'Wall mockup preview' : 'Print preview'"
            >
            <div
              v-else-if="livePreviewMap"
              class="w-full max-w-[460px] aspect-[2/3] bg-white shadow-2xl shadow-stone-900/10 overflow-hidden"
            >
              <ClientOnly>
                <MapPreview
                  :map="livePreviewMap"
                  :style-config="liveStyleConfig"
                  class="w-full h-full"
                />
                <template #fallback>
                  <div class="w-full h-full flex items-center justify-center">
                    <svg class="w-16 h-16 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                      <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
                      <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
                    </svg>
                  </div>
                </template>
              </ClientOnly>
            </div>
            <div v-else class="w-full max-w-[460px] aspect-[2/3] bg-white shadow-2xl shadow-stone-900/10 flex items-center justify-center">
              <svg class="w-16 h-16 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
              </svg>
            </div>
            <div
              v-if="previewGalleryItems.length > 1"
              class="w-full max-w-[640px] shrink-0 overflow-x-auto"
            >
              <div class="flex gap-2 px-1 py-1">
                <button
                  v-for="item in previewGalleryItems"
                  :key="item.id"
                  type="button"
                  class="group w-[74px] shrink-0 text-left"
                  :aria-pressed="selectedPreviewId === item.id"
                  @click="selectedPreviewId = item.id"
                >
                  <span
                    class="relative flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-md border bg-white transition-colors"
                    :class="selectedPreviewId === item.id ? 'border-[#2D6A4F] ring-2 ring-[#2D6A4F]/20' : 'border-stone-200 group-hover:border-stone-300'"
                  >
                    <ProductMockupPreview
                      v-if="item.kind === 'mockup' && item.templateImageUrl && item.artworkBox && mockupArtworkUrl"
                      :template-image-url="item.templateImageUrl"
                      :artwork-url="mockupArtworkUrl"
                      :artwork-box="item.artworkBox"
                      :chrome-boxes="item.chromeBoxes"
                      :finish="item.finish"
                      :scene-file="item.sceneFile"
                      :label="item.label"
                      class="h-full w-full"
                    />
                    <img
                      v-else-if="item.url"
                      :src="item.url"
                      :alt="item.label"
                      class="h-full w-full bg-stone-100 object-contain"
                    >
                    <span v-else class="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                      <UIcon
                        :name="item.loading ? 'i-heroicons-arrow-path' : 'i-heroicons-photo'"
                        class="h-4 w-4"
                        :class="item.loading ? 'animate-spin' : ''"
                      />
                    </span>
                  </span>
                  <span
                    class="mt-1 block truncate text-center text-[10px] font-semibold"
                    :class="selectedPreviewId === item.id ? 'text-[#2D6A4F]' : 'text-stone-500'"
                  >
                    {{ item.label }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Render status banner -->
          <div
v-if="renderError"
            class="absolute top-4 left-4 right-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 z-10">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="text-sm font-semibold text-red-800">Render failed</p>
              <p class="text-xs text-red-700 mt-0.5">{{ renderError }}</p>
              <button class="mt-1 text-xs font-medium text-red-700 underline" @click="startRenders">Try again</button>
            </div>
          </div>
          <div
v-else-if="renderInFlight && !printReady"
            class="absolute top-4 left-4 right-4 flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 z-10">
            <svg class="w-4 h-4 text-sky-500 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p class="text-xs text-sky-800">Preparing the selected print file. This preview stays live while the proof renders.</p>
          </div>
          <div
            v-else-if="mockupInFlight && displayProofImage"
            class="absolute top-4 left-4 right-4 flex items-center gap-3 bg-white/95 border border-stone-200 rounded-xl px-4 py-3 z-10 shadow-sm">
            <UIcon name="i-heroicons-photo" class="h-4 w-4 shrink-0 text-[#2D6A4F]" />
            <p class="text-xs text-stone-700">Building the wall mockup. Checkout stays ready while it finishes.</p>
          </div>
        </main>

        <!-- Product Selector -->
        <aside class="flex min-h-0 flex-col bg-white border-t lg:h-[calc(100vh-57px)] lg:border-t-0 lg:border-l border-stone-200 lg:overflow-hidden">
          <div class="p-5 sm:p-6 border-b border-stone-200">
            <p class="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
              {{ productStepEyebrow }}
            </p>
            <h2 class="mt-1 text-2xl font-bold text-stone-950" style="font-family:'Space Grotesk',sans-serif">
              {{ productStepTitle }}
            </h2>
            <p class="mt-2 text-sm leading-6 text-stone-600">
              {{ productStepDescription }}
            </p>
          </div>
          <MapProductSelector
            v-model="selectedProduct"
            class="min-h-0 flex-1"
            :show-confirm="false"
            :map-center="mapCenter"
            :map-zoom="mapZoom"
          />
          <div class="shrink-0 border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-10px_20px_rgba(28,25,23,0.04)]">
            <button
              type="button"
              :disabled="!selectedProduct"
              class="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#2D6A4F] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#235840] disabled:cursor-not-allowed disabled:opacity-50"
              @click="confirmSelectedProduct"
            >
              <span>{{ productConfirmLabel }}</span>
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>

    <!-- Step 2: Shipping Form -->
    <div v-else-if="map && step === 'shipping'" class="flex-1 overflow-y-auto">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <!-- Order summary card -->
        <div class="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4">
          <div class="w-16 aspect-[2/3] bg-stone-100 shrink-0 flex items-center justify-center overflow-hidden">
            <img
              v-if="primaryProductPreviewUrl"
              :src="primaryProductPreviewUrl!"
              class="w-full h-full object-contain rounded-none"
              :alt="displayProductMockup ? 'Wall mockup preview' : 'Preview'"
            >
            <svg v-else class="w-8 h-8 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
              <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-stone-900 text-sm truncate">{{ map.title }}</p>
            <p class="text-xs text-stone-500 mt-0.5">{{ selectedProduct?.name }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-bold text-[#2D6A4F]">{{ selectedProduct ? formatPrice(selectedUnitPriceCents) : '' }}</p>
            <button class="text-xs text-stone-400 hover:text-stone-600 mt-1" @click="step = 'product'">Change</button>
          </div>
        </div>

        <!-- Full poster preview while the selected proof renders -->
        <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-stone-400">Poster preview</p>
              <p class="text-sm text-stone-600 mt-1">
                {{ displayProofImage ? 'Print-ready proof is ready.' : 'Showing your current saved design while the print file renders.' }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-3">
              <a
                v-if="displayProofImage && previewUrl"
                :href="previewUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D6A4F] hover:text-[#235840]"
              >
                <UIcon name="i-heroicons-arrows-pointing-out" class="h-3.5 w-3.5" />
                <span>Open full proof</span>
              </a>
              <button class="text-xs font-medium text-stone-500 hover:text-stone-800" @click="step = 'product'">Change product</button>
            </div>
          </div>
          <div class="h-[58vh] min-h-[420px] max-h-[720px] bg-[#e8e5e0] flex items-center justify-center overflow-hidden">
            <img
              v-if="displayProofImage"
              :src="previewUrl!"
              class="max-w-full max-h-full object-contain rounded-none"
              alt="Print proof"
            >
            <div
              v-else-if="livePreviewMap"
              class="h-full max-h-full aspect-[2/3] bg-white overflow-hidden"
            >
              <ClientOnly>
                <MapPreview
                  :map="livePreviewMap"
                  :style-config="liveStyleConfig"
                  class="w-full h-full"
                />
                <template #fallback>
                  <div class="w-full h-full flex items-center justify-center">
                    <svg class="w-16 h-16 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
                      <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
                      <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
                    </svg>
                  </div>
                </template>
              </ClientOnly>
            </div>
            <svg v-else class="w-16 h-16 text-stone-300" viewBox="0 0 48 48" fill="none" stroke="currentColor">
              <path d="M4 40 L16 12 L24 26 L32 14 L44 40Z" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M8 34 Q16 30 24 32 Q32 34 40 30" stroke-width="1" opacity="0.6"/>
            </svg>
          </div>
        </div>

        <!-- Digital — skip shipping, just need email -->
        <div v-if="isDigital" class="space-y-4">
          <h2 class="text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
            Where should we send your download link?
          </h2>
          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input
v-model="shippingAddress.email" type="email" placeholder="you@example.com"
              class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] min-h-[48px]">
          </div>
        </div>

        <!-- Physical — full shipping form -->
        <div v-else class="space-y-5">
          <h2 class="text-lg font-semibold text-stone-900" style="font-family:'Space Grotesk',sans-serif">
            Shipping Information
          </h2>
          <CheckoutShippingAddressForm
            :model-value="shippingAddress"
            :mapbox-token="mapboxToken"
            :quote-loading="quoteLoading"
            :quote-error="quoteError"
            :shipping-quote="shippingQuote"
            :disabled="isSubmitting"
            @update:model-value="assignShippingAddress"
            @address-selected="onAddressSelected"
            @manual-edit="onAddressManualEdit"
          />
        </div>

        <!-- Proceed to payment -->
        <div class="pt-4 border-t border-stone-200">
          <div class="mb-5 rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div class="flex items-end gap-2">
              <label class="block flex-1">
                <span class="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Coupon</span>
                <input v-model="couponCode" class="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 focus:border-[#2D6A4F] uppercase min-h-[48px]" placeholder="TRAIL-25" >
              </label>
              <button
                type="button"
                class="px-4 py-3 rounded-xl border border-stone-300 text-sm font-semibold text-stone-700 min-h-[48px] disabled:opacity-50"
                :disabled="couponBusy || !couponCode.trim() || !shippingAddress.email || !selectedProduct"
                @click="applyCoupon"
              >
                {{ couponBusy ? 'Checking...' : 'Apply' }}
              </button>
            </div>
            <div v-if="couponPreview" class="flex items-center justify-between text-sm text-green-700">
              <span>{{ couponPreview.slug }} applied</span>
              <button type="button" class="font-semibold underline" @click="removeCoupon">Remove</button>
            </div>
            <p v-if="couponError" class="text-xs text-red-600">{{ couponError }}</p>
          </div>

          <div
v-if="renderError && !isDigital"
            class="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="text-sm font-semibold text-red-800">Render failed</p>
              <p class="text-xs text-red-700 mt-0.5">{{ renderError }}</p>
              <button class="mt-1 text-xs font-medium text-red-700 underline" @click="startRenders">Try again</button>
            </div>
          </div>
          <div
v-else-if="renderInFlight && !printReady && !isDigital"
            class="mb-4 flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
            <svg class="w-4 h-4 text-sky-500 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p class="text-xs text-sky-800">Preparing print file — you can finish shipping details while we get it ready.</p>
          </div>

          <div class="flex justify-between items-center mb-4">
            <span class="text-base font-bold text-stone-900">Total</span>
            <div class="text-right">
              <p v-if="couponPreview" class="text-sm text-stone-500 line-through">{{ formatPrice(subtotalCents) }}</p>
              <p v-if="couponPreview" class="text-sm font-semibold text-green-700">-{{ formatPrice(couponPreview.discount_cents) }}</p>
              <p v-if="!isDigital && shippingQuote" class="text-sm" :class="shippingQuoteIsStale ? 'text-stone-400' : 'text-stone-500'">
                Shipping {{ formatPrice(shippingCents) }}
              </p>
              <span class="text-xl font-bold text-[#2D6A4F]" style="font-family:'Space Grotesk',sans-serif">
                {{ selectedProduct ? formatPrice(totalCents) : '' }}
              </span>
            </div>
          </div>
          <div v-if="!isDigital" class="mb-4">
            <p v-if="quoteLoading" class="text-xs text-stone-500">Updating shipping…</p>
            <p v-else-if="quoteError" class="text-xs text-red-600">{{ quoteError }}</p>
            <p v-else-if="shippingQuoteIsStale" class="text-xs text-stone-500">
              Shipping will refresh before payment.
            </p>
            <p v-else-if="shippingQuote" class="text-xs text-stone-500">
              {{ shippingQuote.shipment_method_name }} locked for this checkout. Tax is calculated by Stripe.
            </p>
          </div>
          <div
            v-if="checkoutError"
            class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <UIcon name="i-heroicons-exclamation-circle" class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p class="text-sm font-semibold text-red-800">Checkout could not start</p>
              <p class="mt-0.5 text-xs leading-5 text-red-700">{{ checkoutError }}</p>
            </div>
          </div>
          <button
            :disabled="!canProceed || isSubmitting"
            class="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#2D6A4F] hover:bg-[#235840] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 transition-colors min-h-[52px]"
            @click="proceedToPayment"
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
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import ProductMockupPreview from '~/components/checkout/ProductMockupPreview.vue'
import CheckoutShippingAddressForm from '~/components/checkout/ShippingAddressForm.vue'
import { formatPrice, getRenderDimensions } from '~/utils/products'
import { normalizeCouponSlug } from '~/utils/coupons'
import {
  checkoutAddressFingerprint,
  missingCheckoutAddressFields,
  normalizeCheckoutAddress,
  type CheckoutAddress,
} from '~/utils/checkoutAddress'
import { FLAGS } from '~/utils/knownFlags'
import { DEFAULT_STYLE_CONFIG, type TrailMap, type PrintProduct, type ProductFraming, type StyleConfig } from '~/types'

definePageMeta({
  middleware: 'auth',
  layout: false, // Full-screen layout for the map preview step
})

type CheckoutMap = Pick<TrailMap,
  | 'id'
  | 'user_id'
  | 'title'
  | 'geojson'
  | 'bbox'
  | 'stats'
  | 'style_config'
  | 'thumbnail_url'
  | 'render_url'
  | 'proof_render_url'
  | 'status'
  | 'created_at'
  | 'updated_at'
>

const route = useRoute()
const supabase = useSupabaseClient() as any
const user = useSupabaseUser()
const runtimeConfig = useRuntimeConfig()
const mapboxToken = computed(() => String(runtimeConfig.public.mapboxToken || ''))

const mapId = route.params.mapId as string
const map = ref<CheckoutMap | null>(null)
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
const lockedProductPriceCents = ref<number | null>(null)
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
  lockedProductPriceCents.value ?? selectedProduct.value?.price_cents ?? 0
)
const subtotalCents = computed(() => selectedProduct.value ? selectedUnitPriceCents.value : 0)
const shippingCents = computed(() => shippingQuote.value?.amount_cents ?? 0)
const totalCents = computed(() => Math.max(0, subtotalCents.value - (couponPreview.value?.discount_cents ?? 0) + shippingCents.value))
const checkoutError = ref('')

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
let quoteRequestRun = 0
const quotedFingerprint = ref('')

const displayProofImage = computed(() =>
  !!previewUrl.value
  && printReady.value
  && !!selectedProduct.value
  && renderTargetProductUid.value === selectedProduct.value.product_uid
)
const productMockupsEnabled = useFeatureFlag(FLAGS.PRODUCT_MOCKUPS)
const selectedPreviewId = ref('proof')
type MockupTemplateOption = {
  id: string
  label: string
  scene_file: string
  finish: string
  asset_product_uid: string
  template_image_url: string
  artwork_box: ProductMockupBox
  chrome_boxes: ProductMockupChromeBox[]
  is_default: boolean
}
type ProductMockupBox = {
  x: number
  y: number
  w: number
  h: number
}
type ProductMockupChromeBox = {
  id: string
  box: ProductMockupBox
}
type PreviewGalleryItem = {
  id: string
  kind: 'mockup' | 'proof'
  label: string
  url: string | null
  loading?: boolean
  finish?: string
  sceneFile?: string
  templateImageUrl?: string
  artworkBox?: ProductMockupBox
  chromeBoxes?: ProductMockupChromeBox[]
}
const mockupTemplates = ref<MockupTemplateOption[]>([])
function usableRenderUrl(value: string | null | undefined): string | null {
  if (!value || value.startsWith('error:')) return null
  return value
}
const mockupArtworkUrl = computed(() =>
  usableRenderUrl(previewUrl.value)
  ?? usableRenderUrl(map.value?.proof_render_url)
  ?? usableRenderUrl(map.value?.thumbnail_url)
  ?? usableRenderUrl(map.value?.render_url)
)
const previewGalleryItems = computed<PreviewGalleryItem[]>(() => {
  const items: PreviewGalleryItem[] = mockupTemplates.value.map(template => ({
    id: `mockup:${template.id}`,
    kind: 'mockup' as const,
    label: template.label,
    url: null,
    loading: false,
    finish: template.finish,
    sceneFile: template.scene_file,
    templateImageUrl: template.template_image_url,
    artworkBox: template.artwork_box,
    chromeBoxes: template.chrome_boxes,
  }))
  if (mockupArtworkUrl.value) {
    items.push({
      id: 'proof',
      kind: 'proof',
      label: 'Map',
      url: mockupArtworkUrl.value,
    })
  }
  return items
})
const selectedPreviewItem = computed(() => (
  previewGalleryItems.value.find(item => item.id === selectedPreviewId.value)
  ?? previewGalleryItems.value.find(item => item.kind === 'mockup')
  ?? previewGalleryItems.value.find(item => item.url)
  ?? previewGalleryItems.value[0]
  ?? null
))
const displayProductMockup = computed(() =>
  productMockupsEnabled.value
  && selectedPreviewItem.value?.kind === 'mockup'
  && (!!selectedPreviewItem.value.url || !!selectedPreviewItem.value.templateImageUrl)
  && !!selectedProduct.value
  && !!mockupArtworkUrl.value
)
const selectedProductMockupItem = computed(() =>
  displayProductMockup.value && selectedPreviewItem.value?.kind === 'mockup'
    ? selectedPreviewItem.value
    : null
)
const mockupPreviewUpdating = computed(() =>
  mockupInFlight.value
  && mockupTemplates.value.length > 0
  && !!mockupTargetProductUid.value
  && mockupTargetProductUid.value !== mockupTemplatesProductUid.value
)
const primaryProductPreviewUrl = computed(() => {
  const selected = selectedPreviewItem.value
  if (selected?.kind === 'mockup' && displayProductMockup.value) return selected.url ?? mockupArtworkUrl.value
  if (selected?.kind === 'proof' && selected.url) return selected.url
  return mockupArtworkUrl.value
})

const selectedProductName = computed(() => selectedProduct.value?.name ?? 'the selected print')
const liveStyleConfig = computed<StyleConfig>(() => ({
  ...DEFAULT_STYLE_CONFIG,
  ...(map.value?.style_config ?? {}),
}))
const livePreviewMap = computed<TrailMap | null>(() => {
  if (!map.value) return null
  return {
    ...map.value,
    style_config: liveStyleConfig.value,
  } as TrailMap
})

const productStepTitle = computed(() => {
  if (renderError.value) return 'Render needs attention'
  if (renderInFlight.value && !printReady.value) return 'Rendering print proof'
  if (printReady.value && selectedProduct.value && renderTargetProductUid.value === selectedProduct.value.product_uid) {
    return 'Print-ready proof is ready'
  }
  return 'Select a product'
})

const productStepDescription = computed(() => {
  if (renderError.value) return 'The selected proof did not render. Try again or choose another product.'
  if (renderInFlight.value && !printReady.value) return `Preparing the print-ready proof for ${selectedProductName.value}.`
  if (printReady.value && selectedProduct.value && renderTargetProductUid.value === selectedProduct.value.product_uid) {
    return `The print-ready proof for ${selectedProductName.value} is ready for checkout.`
  }
  return 'Pick a format, finish, and size below. We will render the print-ready proof after you continue.'
})

const productStepEyebrow = computed(() => {
  if (renderError.value) return 'Proof render'
  if (renderInFlight.value || (printReady.value && selectedProduct.value && renderTargetProductUid.value === selectedProduct.value.product_uid)) {
    return 'Print proof'
  }
  return 'Choose your print'
})
const productConfirmLabel = computed(() =>
  selectedProduct.value ? (isDigital.value ? 'Continue' : 'Render proof') : 'Choose an enabled size',
)

function confirmSelectedProduct() {
  const product = selectedProduct.value
  if (!product) return
  onProductConfirmed({
    product,
    framing: {
      product_uid: product.product_uid,
      center: mapCenter.value,
      zoom: mapZoom.value,
      bearing: 0,
      pitch: 0,
    },
  })
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

const shippingAddress = reactive<CheckoutAddress>({
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
const currentQuoteFingerprint = computed(() =>
  selectedProduct.value
    ? checkoutAddressFingerprint(shippingAddress, selectedProduct.value.product_uid, 1)
    : '',
)
const quoteIsCurrent = computed(() =>
  !!shippingQuote.value
  && !!quotedFingerprint.value
  && quotedFingerprint.value === currentQuoteFingerprint.value
)
const shippingQuoteIsStale = computed(() => !!shippingQuote.value && !quoteIsCurrent.value)

const canProceed = computed(() => {
  if (!selectedProduct.value) return false
  if (!isDigital.value && (!printReady.value || renderTargetProductUid.value !== selectedProduct.value.product_uid)) return false
  if (isDigital.value) return !!shippingAddress.email
  return quoteIsCurrent.value && !quoteLoading.value
})

async function applyCoupon() {
  couponError.value = ''
  couponBusy.value = true
  try {
    const preview = await $fetch<typeof couponPreview.value>('/api/coupons/validate', {
      method: 'POST',
      body: {
        coupon_slug: normalizeCouponSlug(couponCode.value),
        email: shippingAddress.email,
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

watch([() => shippingAddress.email, selectedProduct, subtotalCents], () => {
  if (couponPreview.value) removeCoupon()
})

function hasQuoteAddress() {
  return !!(
    selectedProduct.value
    && !isDigital.value
    && missingCheckoutAddressFields(shippingAddress).length === 0
  )
}

function clearShippingQuote() {
  if (quoteTimer) clearTimeout(quoteTimer)
  quoteRequestRun += 1
  shippingQuote.value = null
  quoteError.value = ''
  checkoutError.value = ''
  lockedProductPriceCents.value = null
  quotedFingerprint.value = ''
  quoteLoading.value = false
}

function assignShippingAddress(next: CheckoutAddress) {
  Object.assign(shippingAddress, normalizeCheckoutAddress(next))
}

function scheduleShippingQuote(delay = 650) {
  if (quoteTimer) clearTimeout(quoteTimer)
  if (isDigital.value) {
    clearShippingQuote()
    return
  }
  checkoutError.value = ''
  quoteError.value = ''
  if (!hasQuoteAddress()) return
  quoteTimer = setTimeout(() => requestShippingQuote(), delay)
}

function onAddressSelected() {
  scheduleShippingQuote(0)
}

function onAddressManualEdit() {
  scheduleShippingQuote(650)
}

async function requestShippingQuote() {
  if (!hasQuoteAddress() || !selectedProduct.value) {
    if (!shippingQuote.value) clearShippingQuote()
    return
  }
  const quoteFingerprint = currentQuoteFingerprint.value
  if (shippingQuote.value && quotedFingerprint.value === quoteFingerprint) return
  const requestRun = ++quoteRequestRun
  const normalizedAddress = normalizeCheckoutAddress(shippingAddress)
  quoteLoading.value = true
  quoteError.value = ''
  try {
    const response = await $fetch<{
      checkout_attempt_id: string
      quote_id: string
      selected: Omit<ShippingQuoteSelection, 'checkout_attempt_id' | 'quote_id'>
      pricing?: { retail_price_cents: number }
    }>('/api/checkout/quote', {
      method: 'POST',
      body: {
        cart_source: 'custom',
        map_id: mapId,
        product_uid: selectedProduct.value.product_uid,
        quantity: 1,
        shipping_address: normalizedAddress,
        digital_only: false,
      },
    })
    if (requestRun !== quoteRequestRun) return
    shippingQuote.value = {
      checkout_attempt_id: response.checkout_attempt_id,
      quote_id: response.quote_id,
      ...response.selected,
    }
    quotedFingerprint.value = quoteFingerprint
    if (response.pricing?.retail_price_cents) {
      lockedProductPriceCents.value = response.pricing.retail_price_cents
    }
  } catch (err: any) {
    if (requestRun !== quoteRequestRun) return
    shippingQuote.value = null
    quotedFingerprint.value = ''
    quoteError.value = err?.data?.message || err?.message || 'Could not calculate shipping for this address.'
  } finally {
    if (requestRun === quoteRequestRun) quoteLoading.value = false
  }
}

watch(currentQuoteFingerprint, () => scheduleShippingQuote(650))

// ─── Render state ───────────────────────────────────────────────────────────

const previewUrl = ref<string | null>(null)
const printReady = ref(false)
const renderError = ref<string | null>(null)
const renderInFlight = ref(false)
const renderTargetProductUid = ref<string | null>(null)
const mockupInFlight = ref(false)
const mockupError = ref<string | null>(null)
const mockupTargetProductUid = ref<string | null>(null)
const mockupTargetProofUrl = ref<string | null>(null)
const mockupTemplatesProductUid = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function stopPolling() {
  if (pollTimer)    { clearInterval(pollTimer);   pollTimer   = null }
  if (timeoutTimer) { clearTimeout(timeoutTimer);  timeoutTimer = null }
}

// Tracks the proof_render_hash returned by the v4 render endpoint so
// the polling loop can wait for *exactly that* hash to land. Null when
// the server is on the legacy path (response had no proof_render_hash).
const v4ExpectedHash = ref<string | null>(null)
// Tracks whether the latest render trigger was a cache hit on the
// server side — when true, the print is already ready and we skip the
// status poll entirely.
const v4Cached = ref(false)
const autoStartedInitialRender = ref(false)

async function requestProductMockup() {
  const product = selectedProduct.value
  const artworkUrl = mockupArtworkUrl.value
  if (!productMockupsEnabled.value || !map.value?.id || !product || product.type === 'digital' || !artworkUrl) {
    return
  }

  const targetKey = `${map.value.id}:${product.product_uid}:${artworkUrl}`
  if (
    mockupTargetProductUid.value === product.product_uid
    && mockupTargetProofUrl.value === artworkUrl
    && (mockupInFlight.value || mockupTemplates.value.length > 0)
  ) {
    return
  }

  const preferredSceneFile = selectedPreviewItem.value?.kind === 'mockup'
    ? selectedPreviewItem.value.sceneFile
    : null
  mockupInFlight.value = true
  mockupError.value = null
  mockupTargetProductUid.value = product.product_uid
  mockupTargetProofUrl.value = artworkUrl

  try {
    const templateResponse = await $fetch<{ templates: MockupTemplateOption[] }>('/api/mockups/templates', {
      query: { product_uid: product.product_uid },
    })
    if (`${map.value?.id}:${mockupTargetProductUid.value}:${mockupTargetProofUrl.value}` !== targetKey) return
    const templates = templateResponse.templates
    mockupTemplates.value = templates
    mockupTemplatesProductUid.value = product.product_uid
    const selectedTemplate = templates.find(template => template.scene_file === preferredSceneFile) ?? templates[0]
    selectedPreviewId.value = selectedTemplate?.id ? `mockup:${selectedTemplate.id}` : 'proof'
  } catch (err: any) {
    mockupError.value = err?.data?.message || err?.message || 'Could not create the wall mockup.'
    if (`${map.value?.id}:${mockupTargetProductUid.value}:${mockupTargetProofUrl.value}` === targetKey) {
      resetProductMockup()
    }
  } finally {
    if (`${map.value?.id}:${mockupTargetProductUid.value}:${mockupTargetProofUrl.value}` === targetKey) {
      mockupInFlight.value = false
    }
  }
}

function resetProductMockup(options: { preservePreview?: boolean } = {}) {
  if (!options.preservePreview) {
    mockupTemplates.value = []
    mockupTemplatesProductUid.value = null
    selectedPreviewId.value = mockupArtworkUrl.value ? 'proof' : ''
  }
  mockupInFlight.value = false
  mockupError.value = null
  mockupTargetProductUid.value = null
  mockupTargetProofUrl.value = null
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

  // v4 endpoint takes a product_uid for hash framing. Legacy endpoint
  // ignores unknown body keys, so this is safe with the flag off.
  if (selectedProduct.value?.product_uid) {
    body.product_uid = selectedProduct.value.product_uid
  }

  const resp = await $fetch<{
    status?: 'cached' | 'compositing' | 'rendering' | 'queued'
    render_url?: string
    proof_render_hash?: string
  }>(`/api/maps/${mapId}/render`, { method: 'POST', body })

  if (resp && typeof resp.proof_render_hash === 'string') {
    v4ExpectedHash.value = resp.proof_render_hash
    if (resp.status === 'cached' && resp.render_url) {
      // Server confirmed the hash matched and the proof is already up;
      // skip render entirely and let the user proceed to payment.
      v4Cached.value = true
      previewUrl.value = resp.render_url
      printReady.value = true
      renderInFlight.value = false
      void requestProductMockup()
    } else {
      v4Cached.value = false
    }
  } else {
    v4ExpectedHash.value = null
    v4Cached.value = false
  }
}

async function pollStatus() {
  // v4 protocol: poll for the exact proof_render_hash to land, plus
  // proof_render_url. Legacy: poll status === 'rendered'. Both paths
  // honour the `error:` sentinel for worker failures.
  const v4 = v4ExpectedHash.value
  const cols = v4
    ? 'render_url, thumbnail_url, proof_render_hash, proof_render_url'
    : 'status, render_url, thumbnail_url'

  const { data } = await supabase
    .from('maps')
    .select(cols)
    .eq('id', mapId)
    .single()
  if (!data) return

  if (!v4 && typeof data.thumbnail_url === 'string' && !data.thumbnail_url.startsWith('error:')) {
    previewUrl.value = data.thumbnail_url
  }

  if (typeof data.render_url === 'string' && data.render_url.startsWith('error:')) {
    renderError.value = data.render_url.slice(6) || 'Render failed. Please try again.'
    renderInFlight.value = false
    stopPolling()
    await supabase.from('maps').update({ render_url: null }).eq('id', mapId)
    return
  }

  if (v4) {
    if (data.proof_render_hash === v4 && data.proof_render_url) {
      previewUrl.value = data.proof_render_url
      printReady.value = true
      renderInFlight.value = false
      stopPolling()
      void requestProductMockup()
    }
    return
  }

  if (data.status === 'rendered') {
    printReady.value = true
    renderInFlight.value = false
    stopPolling()
    void requestProductMockup()
  }
}

function renderErrorMessage(error: unknown): string {
  const fallback = 'Render failed. Please try again.'
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: { message?: string; statusMessage?: string }
    statusMessage?: string
    message?: string
  }
  const message = maybeError.data?.message
    || maybeError.data?.statusMessage
    || maybeError.statusMessage
    || maybeError.message
    || fallback

  if (/timed out|timeout|408/i.test(message)) {
    return 'Render service timed out. Please try again in a moment.'
  }
  if (/browserless|render service|BROWSERLESS/i.test(message)) {
    return 'Render service unavailable. Please try again in a moment.'
  }
  return message
}

async function startRenders() {
  const product = selectedProduct.value
  renderError.value = null

  if (!product || product.type === 'digital') {
    renderInFlight.value = false
    renderTargetProductUid.value = product?.product_uid ?? null
    resetProductMockup()
    return
  }

  if ((renderInFlight.value || printReady.value) && renderTargetProductUid.value === product.product_uid) {
    return
  }

  printReady.value = false
  renderInFlight.value = true
  renderTargetProductUid.value = product.product_uid
  resetProductMockup()
  stopPolling()

  // Only fire the print render — preview thumbnail already exists from the style editor.
  // Two concurrent Puppeteer instances on Railway cause OOM/slowdowns.
  try {
    await triggerRender('print')
  } catch (error) {
    renderError.value = renderErrorMessage(error)
    printReady.value = false
    renderInFlight.value = false
    stopPolling()
    return
  }

  // v4 cache hit: server confirmed proof_render_hash matches and the
  // proof URL is set. Skip polling entirely and proceed to payment.
  if (v4Cached.value && printReady.value) {
    renderInFlight.value = false
    void requestProductMockup()
    return
  }

  pollTimer = setInterval(pollStatus, 3000)
  timeoutTimer = setTimeout(() => {
    if (!printReady.value && !renderError.value) {
      renderError.value = 'Render timed out. Please try again.'
      renderInFlight.value = false
      stopPolling()
    }
  }, 5 * 60 * 1000)
}

onUnmounted(stopPolling)

watch(selectedProduct, (product, previousProduct) => {
  if (!product) return

  if (product.type === 'digital') {
    renderError.value = null
    printReady.value = true
    renderInFlight.value = false
    renderTargetProductUid.value = product.product_uid
    clearShippingQuote()
    stopPolling()
    resetProductMockup()
    return
  }

  if (previousProduct?.product_uid !== product.product_uid) {
    clearShippingQuote()
    printReady.value = false
    renderInFlight.value = false
    renderTargetProductUid.value = null
    v4ExpectedHash.value = null
    v4Cached.value = false
    renderError.value = null
    resetProductMockup({ preservePreview: productMockupsEnabled.value && mockupTemplates.value.length > 0 })
    stopPolling()
  }
}, { flush: 'post' })

watch([mockupArtworkUrl, selectedProduct, productMockupsEnabled], () => {
  if (!mockupArtworkUrl.value || !selectedProduct.value || !productMockupsEnabled.value) {
    resetProductMockup()
    return
  }
  void requestProductMockup()
}, { flush: 'post' })

watch([selectedProduct, () => map.value?.id, productMockupsEnabled], () => {
  const product = selectedProduct.value
  if (
    autoStartedInitialRender.value
    || !productMockupsEnabled.value
    || !map.value?.id
    || !product
    || product.type === 'digital'
    || mockupArtworkUrl.value
    || renderInFlight.value
    || printReady.value
  ) {
    return
  }

  autoStartedInitialRender.value = true
  void startRenders()
}, { flush: 'post' })

// ─── Payment ────────────────────────────────────────────────────────────────

const proceedToPayment = async () => {
  if (!map.value || !user.value?.id || !selectedProduct.value) return
  checkoutError.value = ''
  if (!isDigital.value && !quoteIsCurrent.value) {
    checkoutError.value = quoteLoading.value
      ? 'Please wait for shipping to finish updating.'
      : 'Please enter a complete shipping address and wait for shipping to update.'
    return
  }
  isSubmitting.value = true
  step.value = 'payment'
  try {
    const normalizedAddress = normalizeCheckoutAddress(shippingAddress)
    const payload = {
      cart_source: 'custom',
      checkout_attempt_id: !isDigital.value ? shippingQuote.value?.checkout_attempt_id : undefined,
      quote_id: !isDigital.value ? shippingQuote.value?.quote_id : null,
      map_id: mapId,
      product_uid: selectedProduct.value.product_uid,
      quantity: 1,
      shipping_address: isDigital.value
        ? { name: 'Digital', email: shippingAddress.email, address1: '-', city: '-', state_code: '--', zip: '-', country_code: 'US' }
        : normalizedAddress,
      digital_only: isDigital.value,
      coupon_slug: couponPreview.value?.slug,
    }
    const response = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      let message = 'Failed to create checkout session'
      try {
        const errorBody = await response.json()
        message = errorBody?.message || errorBody?.statusMessage || message
      } catch {}
      throw new Error(message)
    }
    const data = await response.json()
    window.location.href = data.url
  } catch (err) {
    checkoutError.value = err instanceof Error ? err.message : 'Failed to proceed to payment. Please try again.'
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
      .select('id, user_id, title, geojson, bbox, stats, style_config, thumbnail_url, render_url, proof_render_url, status, created_at, updated_at')
      .eq('id', mapId)
      .eq('user_id', user.value?.id)
      .single()
    if (error) throw error
    map.value = data as CheckoutMap

    // Seed map center from bbox
    if (data.bbox) {
      mapCenter.value = [
        (data.bbox[0] + data.bbox[2]) / 2,
        (data.bbox[1] + data.bbox[3]) / 2,
      ]
    }

  } catch (err) {
    console.error('Error fetching map:', err)
  } finally {
    loading.value = false
  }
})
</script>
