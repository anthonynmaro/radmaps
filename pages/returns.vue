<template>
  <div class="relative min-h-[60vh]">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <div class="relative max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20">

      <div class="flex items-center gap-2 mb-4">
        <span class="text-[10px] font-semibold tracking-[0.22em] uppercase text-[#2D6A4F]">
          Policy
        </span>
        <span class="h-px flex-1 w-10 bg-stone-300/70" />
      </div>

      <h1
        class="text-3xl sm:text-4xl tracking-tight text-stone-900 leading-[1.05] mb-6"
        style="font-family:'Playfair Display',serif"
      >
        Return & Refund Policy
      </h1>

      <div class="prose prose-stone prose-sm max-w-none text-stone-600 leading-relaxed space-y-6">

        <p>
          Because every RadMaps print is custom-made with your unique trail design, we handle
          returns a bit differently than off-the-shelf products. Here's the full picture.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Damaged or Defective Prints
        </h2>
        <p>
          If your order arrives damaged in transit or has a print quality defect (misprints,
          color issues, wrong size), contact us within <strong>14 days of delivery</strong> at
          <a href="mailto:support@radmaps.studio" class="text-[#2D6A4F] font-medium">support@radmaps.studio</a>.
          Please include your order ID and a photo showing the issue.
        </p>
        <p>
          We'll either send a <strong>free replacement</strong> or issue a <strong>full refund</strong> — your choice.
          You don't need to return the damaged item.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Made-to-Order Products
        </h2>
        <p>
          Since every print is manufactured specifically for your order, we cannot accept returns
          for change of mind, incorrect sizing choices, or design preferences. Please review your
          map preview and product selection carefully before placing your order.
        </p>
        <p>
          The live preview in our checkout shows exactly how your map will look at each product
          size, so you can frame your trail perfectly before ordering.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Digital Downloads
        </h2>
        <p>
          Digital download purchases are <strong>non-refundable</strong> once the download link
          has been accessed. If you experience a technical issue downloading your file, contact
          us and we'll generate a new link.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Order Cancellation
        </h2>
        <p>
          If you need to cancel an order, contact us as soon as possible. Once an order enters
          production (typically within 1–2 hours of placement), it cannot be cancelled or modified.
          Orders cancelled before production begins will receive a full refund.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Refund Processing
        </h2>
        <p>
          Approved refunds are processed back to the original payment method within
          <strong>5–10 business days</strong>. You'll receive an email confirmation once
          the refund is issued.
        </p>

        <h2 class="text-lg font-semibold text-stone-900 !mt-8" style="font-family:'Space Grotesk',sans-serif">
          Lost Packages
        </h2>
        <p>
          If tracking shows your order as delivered but you haven't received it, or if there are
          no tracking updates for more than 15 business days after dispatch, contact us. We'll
          work with our shipping partner to investigate and either resend your order or issue a refund.
        </p>

      </div>

      <div class="pt-8 mt-8 border-t border-stone-200 flex items-center justify-between text-sm">
        <NuxtLink to="/support" class="text-stone-500 hover:text-stone-900 transition-colors">← Back to support</NuxtLink>
        <p class="text-xs text-stone-400">Last updated: April 2026</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema } from '~/utils/seo'

definePageMeta({ layout: 'default' })

useSeo({
  title: 'Return & Refund Policy',
  description: 'RadMaps return and refund policy for custom trail map prints, framed prints, canvas, and digital downloads.',
  path: '/returns',
  jsonLd: [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Support', path: '/support' },
      { name: 'Returns', path: '/returns' },
    ]),
  ],
})
</script>
