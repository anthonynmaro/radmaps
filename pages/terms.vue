<template>
  <div class="relative min-h-[60vh]">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">
          Legal
        </span>
        <span class="h-px flex-1 w-10 bg-stone-300/70" />
      </div>

      <h1
        class="text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.05] mb-4"
        style="font-family:'Playfair Display',serif"
      >
        Terms of Service
      </h1>
      <p class="text-sm text-stone-400 mb-10 tracking-wide">
        Last updated · <span class="italic">placeholder — pending legal review</span>
      </p>

      <div class="rounded-2xl border border-dashed border-stone-300 bg-white/50 backdrop-blur-sm p-8 mb-10 text-center">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stone-900/5 mb-4">
          <svg class="w-5 h-5 text-stone-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clip-rule="evenodd"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-stone-900 mb-1" style="font-family:'Space Grotesk',sans-serif">
          Terms are coming soon
        </p>
        <p class="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
          We're finalizing our Terms of Service. Until they're published, any
          purchase or use of RadMaps is governed by our standard fulfilment
          policies. Reach out if you have questions.
        </p>
      </div>

      <section class="prose-sm max-w-none text-stone-600 leading-relaxed space-y-5">
        <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-stone-500 mb-2">At a glance</h2>
        <p>
          RadMaps Studio sells custom and premade trail posters printed on demand via Gelato.
          By placing an order you agree that prints are produced specifically for you and
          are generally non-refundable except in cases of manufacturing defect or shipping damage.
        </p>
        <p>
          You retain ownership of any GPX data you upload. We use it solely to produce your
          poster and surface it inside your account. We do not sell or share your route data.
        </p>
        <p>
          The full Terms of Service — covering licensing, refunds, dispute resolution, and
          governing law — will be published here shortly.
        </p>
      </section>

      <div class="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between text-sm">
        <NuxtLink to="/" class="text-stone-500 hover:text-stone-900 transition-colors">← Back home</NuxtLink>
        <NuxtLink to="/support" class="font-semibold text-[#2D6A4F] hover:text-[#1E5238] transition-colors">Contact support →</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema } from '~/utils/seo'

definePageMeta({ layout: 'default' })

useSeo({
  title: 'Terms of Service',
  description: 'RadMaps Studio Terms of Service — our standard fulfilment, refund, and licensing policies for custom and premade trail poster orders.',
  path: '/terms',
  jsonLd: [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Terms', path: '/terms' },
    ]),
  ],
})
</script>
