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
          Support
        </span>
        <span class="h-px flex-1 w-10 bg-stone-300/70" />
      </div>

      <h1
        class="text-4xl sm:text-5xl tracking-tight text-stone-900 leading-[1.05] mb-4"
        style="font-family:'Playfair Display',serif"
      >
        Need a hand?
      </h1>
      <p class="text-[15px] text-stone-500 leading-relaxed mb-10 max-w-xl">
        We'd love to help. Most questions are covered in the topics below — if you
        still need us, drop a line and we'll get back within one business day.
      </p>

      <!-- Contact card -->
      <div class="rounded-2xl border border-stone-200 bg-white/70 backdrop-blur-sm p-6 mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div class="w-12 h-12 shrink-0 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-[#2D6A4F]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold tracking-[0.18em] uppercase text-stone-400 mb-1">Email</p>
          <a href="mailto:support@radmaps.studio" class="text-lg font-semibold text-stone-900 hover:text-[#2D6A4F] transition-colors" style="font-family:'Space Grotesk',sans-serif">
            support@radmaps.studio
          </a>
          <p class="text-xs text-stone-500 mt-1">Include your order ID if you're asking about a purchase.</p>
        </div>
      </div>

      <!-- FAQ topics -->
      <p class="text-[11px] font-semibold tracking-[0.22em] uppercase text-stone-500 mb-4">Common topics</p>
      <div class="grid sm:grid-cols-2 gap-3 mb-10">
        <div class="p-5 rounded-xl border border-stone-200 bg-white/60 backdrop-blur-sm">
          <div class="w-8 h-8 rounded-full bg-stone-900/5 flex items-center justify-center mb-3">
            <svg class="w-4 h-4 text-stone-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
              <path fill-rule="evenodd" d="M3 4a1 1 0 00-1 1v1h16V5a1 1 0 00-1-1H3zm15 4H2v5a1 1 0 001 1h1a3 3 0 116 0h2a3 3 0 116 0h.5a.5.5 0 00.5-.5V8z" clip-rule="evenodd"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-stone-900 mb-1">Shipping &amp; delivery</p>
          <p class="text-xs text-stone-500 leading-relaxed">Orders are printed on demand and ship within 5–10 business days. Tracking is emailed when your print dispatches.</p>
        </div>
        <div class="p-5 rounded-xl border border-stone-200 bg-white/60 backdrop-blur-sm">
          <div class="w-8 h-8 rounded-full bg-stone-900/5 flex items-center justify-center mb-3">
            <svg class="w-4 h-4 text-stone-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v2H7V5zm0 4h6v2H7V9zm0 4h4v2H7v-2z"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-stone-900 mb-1">Returns &amp; refunds</p>
          <p class="text-xs text-stone-500 leading-relaxed">Prints are made to order. If something arrives damaged or misprinted, we'll reprint or refund — just email us with a photo.</p>
        </div>
        <div class="p-5 rounded-xl border border-stone-200 bg-white/60 backdrop-blur-sm">
          <div class="w-8 h-8 rounded-full bg-stone-900/5 flex items-center justify-center mb-3">
            <svg class="w-4 h-4 text-stone-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4zM3 9h14v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-stone-900 mb-1">Importing your route</p>
          <p class="text-xs text-stone-500 leading-relaxed">Connect Strava to import directly, or upload a route file from your watch or any trail app — most export GPX, up to 25 MB.</p>
        </div>
        <div class="p-5 rounded-xl border border-stone-200 bg-white/60 backdrop-blur-sm">
          <div class="w-8 h-8 rounded-full bg-stone-900/5 flex items-center justify-center mb-3">
            <svg class="w-4 h-4 text-stone-700" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/>
            </svg>
          </div>
          <p class="text-sm font-semibold text-stone-900 mb-1">Design &amp; sizing</p>
          <p class="text-xs text-stone-500 leading-relaxed">All prints are produced at 300 DPI on 170 gsm archival matte. Available from 8×10″ up to 24×36″.</p>
        </div>
      </div>

      <div class="pt-6 border-t border-stone-200 flex items-center justify-between text-sm">
        <NuxtLink to="/" class="text-stone-500 hover:text-stone-900 transition-colors">← Back home</NuxtLink>
        <div class="flex gap-4">
          <NuxtLink to="/terms" class="text-stone-500 hover:text-stone-900 transition-colors">Terms</NuxtLink>
          <NuxtLink to="/privacy" class="text-stone-500 hover:text-stone-900 transition-colors">Privacy</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema } from '~/utils/seo'

definePageMeta({ layout: 'default' })

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How long does shipping take?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Orders are printed on demand and ship within 5–10 business days. Tracking is emailed when your print dispatches. RadMaps prints at the closest of 130+ Gelato facilities to minimize shipping times.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is your return policy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Prints are made to order. If something arrives damaged or misprinted, we will reprint or refund it — just email support@radmaps.studio with a photo.',
      },
    },
    {
      '@type': 'Question',
      name: 'What route file types are supported?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Connect Strava to import directly, or upload a route file from your watch or any trail app — most export GPX, up to 25 MB. GeoJSON is also supported.',
      },
    },
    {
      '@type': 'Question',
      name: 'What materials are RadMaps prints made from?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'All prints are produced at 300 DPI on 170 gsm archival matte paper. Available sizes range from 8×10″ to 24×36″.',
      },
    },
  ],
}

useSeo({
  title: 'Support',
  description: 'Get help with your RadMaps order, importing your route, or your account. Common questions about shipping, returns, GPX uploads, and design.',
  path: '/support',
  jsonLd: [
    faqSchema,
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Support', path: '/support' },
    ]),
  ],
})
</script>
