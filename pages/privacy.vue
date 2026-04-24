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
        Privacy Policy
      </h1>
      <p class="text-sm text-stone-400 mb-10 tracking-wide">
        Last updated · <span class="italic">placeholder — pending legal review</span>
      </p>

      <div class="rounded-2xl border border-dashed border-stone-300 bg-white/50 backdrop-blur-sm p-8 mb-10 text-center">
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stone-900/5 mb-4">
          <svg class="w-5 h-5 text-stone-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7zM12 15a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" transform="scale(0.83) translate(2 2)"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-stone-900 mb-1" style="font-family:'Space Grotesk',sans-serif">
          Privacy Policy is coming soon
        </p>
        <p class="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
          We take privacy seriously and are finalizing the full policy here. Until it's
          published, the summary below describes how we handle your data.
        </p>
      </div>

      <section class="prose-sm max-w-none text-stone-600 leading-relaxed space-y-5">
        <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-stone-500 mb-2">What we collect</h2>
        <p>
          When you create an account we store your email address and any GPX routes or
          Strava activities you import. For purchases we collect your name, shipping address,
          and order history. Payment card details are handled entirely by Stripe — we never
          see or store them.
        </p>

        <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-stone-500 mb-2 pt-2">How we use it</h2>
        <p>
          Your data is used to produce your posters, fulfil and ship your orders, and surface
          your maps inside your account. We do not sell your data or share it with third
          parties except fulfilment partners (Gelato for printing, Stripe for payments,
          Resend for receipts) strictly as required to complete your order.
        </p>

        <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-stone-500 mb-2 pt-2">Your rights</h2>
        <p>
          You can download or delete your account data at any time from your account
          settings, or by contacting support. Guests who checkout without an account can
          request deletion by emailing support.
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
definePageMeta({ layout: 'default' })

useHead({
  title: 'Privacy Policy — RadMaps',
  meta: [{ name: 'description', content: 'RadMaps Studio Privacy Policy.' }],
})
</script>
