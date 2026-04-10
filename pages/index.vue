<template>
  <div class="bg-white">
    <!-- Hero Section -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <!-- Left: Headline & CTAs -->
        <div>
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Turn your trails into art.
          </h1>
          <p class="text-xl text-gray-600 mb-8 leading-relaxed">
            Upload your favorite GPX files or connect your Strava account to create beautifully styled topographic maps. We'll print and ship them to you.
          </p>

          <!-- Auth State Check -->
          <div v-if="!user" class="flex gap-4 flex-wrap">
            <NuxtLink to="/create">
              <UButton size="lg" color="green" class="bg-[#2D6A4F] hover:bg-[#1b4332]">
                <template #leading>
                  <UIcon name="i-heroicons-arrow-up-tray-20-solid" />
                </template>
                Upload a GPX file
              </UButton>
            </NuxtLink>
            <NuxtLink to="/api/strava/connect">
              <UButton size="lg" color="gray" variant="outline">
                <template #leading>
                  <UIcon name="i-heroicons-link-20-solid" />
                </template>
                Connect Strava
              </UButton>
            </NuxtLink>
          </div>
          <div v-else>
            <NuxtLink to="/dashboard">
              <UButton size="lg" color="green" class="bg-[#2D6A4F] hover:bg-[#1b4332]">
                Go to your dashboard →
              </UButton>
            </NuxtLink>
          </div>
        </div>

        <!-- Right: Map Print Placeholder -->
        <div class="relative h-96 md:h-96">
          <div class="absolute inset-0 bg-gradient-to-br from-[#2D6A4F] via-[#40916c] to-[#52b788] rounded-2xl shadow-2xl overflow-hidden">
            <!-- Topographic lines -->
            <svg class="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="80" r="60" fill="none" stroke="white" stroke-width="2" />
              <circle cx="80" cy="80" r="50" fill="none" stroke="white" stroke-width="1.5" />
              <circle cx="80" cy="80" r="40" fill="none" stroke="white" stroke-width="1" />
              <circle cx="280" cy="120" r="70" fill="none" stroke="white" stroke-width="2" />
              <circle cx="280" cy="120" r="58" fill="none" stroke="white" stroke-width="1.5" />
              <circle cx="280" cy="120" r="46" fill="none" stroke="white" stroke-width="1" />
              <circle cx="120" cy="280" r="65" fill="none" stroke="white" stroke-width="2" />
              <circle cx="120" cy="280" r="53" fill="none" stroke="white" stroke-width="1.5" />
              <circle cx="120" cy="280" r="41" fill="none" stroke="white" stroke-width="1" />
              <path d="M 200 0 Q 250 100 200 200 T 200 400" fill="none" stroke="white" stroke-width="2" opacity="0.3" />
            </svg>

            <!-- Overlay text -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <p class="text-white text-sm font-medium opacity-60">Example Print</p>
                <p class="text-white text-lg font-bold mt-2">Your Trail Here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Strip -->
    <section class="bg-gray-50 border-y border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid md:grid-cols-3 gap-12">
          <!-- Feature 1 -->
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-[#2D6A4F] rounded-lg mb-4">
              <UIcon name="i-heroicons-document-arrow-up-20-solid" class="w-6 h-6 text-white" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Upload any GPX</h3>
            <p class="text-gray-600">Support for GPX files from any running, cycling, or hiking app.</p>
          </div>

          <!-- Feature 2 -->
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-[#2D6A4F] rounded-lg mb-4">
              <UIcon name="i-heroicons-paintbrush-20-solid" class="w-6 h-6 text-white" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Style it your way</h3>
            <p class="text-gray-600">AI-powered styling with custom colors, fonts, and map layouts.</p>
          </div>

          <!-- Feature 3 -->
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-12 h-12 bg-[#2D6A4F] rounded-lg mb-4">
              <UIcon name="i-heroicons-truck-20-solid" class="w-6 h-6 text-white" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Printed & shipped</h3>
            <p class="text-gray-600">Premium prints delivered to your door, worldwide.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it Works -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h2 class="text-3xl font-bold text-gray-900 text-center mb-16">How it works</h2>

      <div class="grid md:grid-cols-3 gap-12">
        <!-- Step 1 -->
        <div class="relative">
          <div class="flex items-start gap-6">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-12 w-12 rounded-lg bg-[#2D6A4F] text-white font-bold text-lg">
                1
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Upload your route</h3>
              <p class="text-gray-600">Drop a GPX file or authenticate with Strava to import your favorite routes instantly.</p>
            </div>
          </div>
          <div v-if="true" class="absolute top-6 -right-6 md:flex hidden">
            <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="relative">
          <div class="flex items-start gap-6">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-12 w-12 rounded-lg bg-[#2D6A4F] text-white font-bold text-lg">
                2
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Style with AI</h3>
              <p class="text-gray-600">Choose colors, fonts, and layouts. Our AI helps you create a design that matches your style.</p>
            </div>
          </div>
          <div v-if="true" class="absolute top-6 -right-6 md:flex hidden">
            <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- Step 3 -->
        <div>
          <div class="flex items-start gap-6">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-12 w-12 rounded-lg bg-[#2D6A4F] text-white font-bold text-lg">
                3
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Print & ship</h3>
              <p class="text-gray-600">Order in your preferred size and format. We print and ship to you within days.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Print Sizes Section -->
    <section class="bg-gray-50 border-y border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 class="text-3xl font-bold text-gray-900 text-center mb-4">Print sizes & formats</h2>
        <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Choose from poster prints, canvas, framed options, and more. All printed with archival-quality materials.
        </p>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">5×7"</p>
            <p class="text-sm text-gray-600 mt-1">Postcard</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">8×10"</p>
            <p class="text-sm text-gray-600 mt-1">Small Print</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">11×14"</p>
            <p class="text-sm text-gray-600 mt-1">Medium</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">16×20"</p>
            <p class="text-sm text-gray-600 mt-1">Large</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">24×36"</p>
            <p class="text-sm text-gray-600 mt-1">Poster</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">Canvas</p>
            <p class="text-sm text-gray-600 mt-1">Wrapped</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">Framed</p>
            <p class="text-sm text-gray-600 mt-1">Wood Frame</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-6 text-center hover:border-[#2D6A4F] hover:shadow-md transition-all">
            <p class="font-semibold text-gray-900">Acrylic</p>
            <p class="text-sm text-gray-600 mt-1">Printed</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="bg-gradient-to-r from-[#2D6A4F] to-[#40916c] rounded-2xl p-12 md:p-16 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">Ready to create your first map?</h2>
        <p class="text-lg text-green-50 mb-8 max-w-2xl mx-auto">
          Start now and join thousands of athletes who've turned their favorite trails into beautiful wall art.
        </p>
        <NuxtLink to="/create">
          <UButton size="lg" color="white" variant="soft">
            Start your first map
          </UButton>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const user = useSupabaseUser()
</script>
