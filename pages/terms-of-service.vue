<template>
  <div class="relative min-h-[70vh]">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
      style="background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E');background-size:180px"
    />

    <article class="relative max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
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
      <p class="text-sm text-stone-400 mb-8 tracking-wide">
        Last updated: May 26, 2026
      </p>

      <div class="rounded-lg border border-stone-200 bg-white/65 p-5 mb-10 text-sm leading-relaxed text-stone-600">
        <p>
          These Terms govern your use of RadMaps Studio and your purchase of custom,
          premade, physical, and digital trail-map products. RadMaps posters are
          decorative products only. They are not navigation tools, safety devices,
          land-boundary references, or emergency route guidance.
        </p>
      </div>

      <section class="space-y-8 text-sm leading-relaxed text-stone-600">
        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            1. Acceptance
          </h2>
          <p>
            By accessing RadMaps Studio, creating an account, importing a route, saving a
            map, placing an order, or using any related feature, you agree to these Terms
            and to our <NuxtLink to="/privacy-policy" class="text-[#2D6A4F] font-medium hover:underline">Privacy Policy</NuxtLink>.
            If you do not agree, do not use RadMaps.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            2. What RadMaps Provides
          </h2>
          <p>
            RadMaps lets you upload GPX or GeoJSON files, import authorized Strava
            activities, draw routes, customize poster styles, purchase premade maps, and
            order physical or digital map artwork. Physical products are printed on demand
            through fulfillment partners. Availability, materials, sizes, pricing, taxes,
            shipping quotes, and delivery estimates may change before checkout is complete.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            3. Accounts and Eligibility
          </h2>
          <p>
            You may need an account to design custom maps, import routes, save drafts, or
            access order history. You are responsible for keeping your login method secure
            and for all activity under your account. RadMaps is not directed to children
            under 13. If you are under the age of majority where you live, you may use
            RadMaps only with permission from a parent or legal guardian.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            4. Your Routes, Files, and Poster Content
          </h2>
          <p>
            You keep ownership of GPX files, routes, text, logos, images, names, and other
            content you submit to RadMaps ("User Content"). You grant RadMaps a worldwide,
            non-exclusive, royalty-free, sublicensable license to host, copy, process,
            modify, render, display, transmit, print, fulfill, support, and otherwise use
            User Content as needed to operate RadMaps, provide the service, complete orders,
            prevent abuse, comply with law, and improve reliability.
          </p>
          <p class="mt-3">
            You represent that you have all rights needed to submit and use your User
            Content. Do not upload content that infringes someone else's rights, discloses
            private information without permission, violates law, or creates safety,
            harassment, or abuse risks. If you make a map public or share it, you authorize
            RadMaps to display the public map, preview, title, route, style, and related
            metadata until you unshare it, delete it, or ask us to remove it.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            5. RadMaps Ownership and Your License
          </h2>
          <p>
            RadMaps and its licensors own the site, software, rendering pipeline, templates,
            themes, presets, premade map catalog, generated layout systems, product
            presentation, brand, logos, documentation, and all related intellectual property.
            Except for the limited rights these Terms give you, no RadMaps intellectual
            property is transferred to you.
          </p>
          <p class="mt-3">
            When you buy a physical print, you receive the physical item. When you buy a
            digital download, you receive a personal, non-exclusive, non-transferable license
            to download, print, and display that file for personal use. You may not resell,
            commercially reproduce, sublicense, mass-produce, scrape, clone, reverse engineer,
            remove attribution from, or build a competing product from RadMaps designs,
            templates, software, catalog content, or generated outputs unless we agree in
            writing.
          </p>
          <p class="mt-3">
            Feedback, suggestions, and ideas you provide may be used by RadMaps without
            restriction or compensation.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            6. Maps, Strava, and Third-Party Services
          </h2>
          <p>
            RadMaps relies on third-party services for authentication, payments, tax,
            shipping, printing, map tiles, route imports, rendering, hosting, storage, and
            email. These services may include Stripe, Gelato, Supabase, Vercel, AWS,
            Resend, Mapbox, Stadia, CARTO, OpenStreetMap contributors, Google,
            and Strava. Their services are governed by their own terms and policies.
          </p>
          <p class="mt-3">
            Strava activity import is optional and requires your authorization. Strava may
            change, suspend, limit, audit, or revoke API access. Strava and other third-party
            service providers are not responsible for RadMaps and disclaim warranties and
            liability for RadMaps to the maximum extent permitted by law.
          </p>
          <p class="mt-3">
            Map data, elevation data, route geometry, product previews, colors, contours,
            labels, shipping estimates, and delivery estimates may be incomplete,
            inaccurate, delayed, unavailable, or visually different from the final printed
            product. You are responsible for validating any route before outdoor use with
            official, current, and safety-appropriate sources.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            7. Orders, Payment, Taxes, and Shipping
          </h2>
          <p>
            Prices are shown before checkout and may include product, shipping, discount,
            and tax line items. Stripe or another payment processor handles payment
            information. RadMaps does not store full card numbers. You authorize us and our
            payment processor to charge the selected payment method for the order total.
          </p>
          <p class="mt-3">
            You are responsible for accurate recipient, email, shipping, and customs
            information. We may cancel, hold, or refuse orders if payment fails, fraud or
            abuse is suspected, a quote expires, a product is unavailable, the shipping
            address is unsupported, fulfillment fails, or the order appears to violate these
            Terms. International orders may be subject to duties, taxes, customs fees, or
            import restrictions that are outside RadMaps' control.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            8. Made-to-Order Products, Cancellations, and Refunds
          </h2>
          <p>
            Most RadMaps products are made specifically for your order. Except where required
            by law, custom and made-to-order physical products are not returnable for change
            of mind, incorrect size selection, address mistakes, or design preferences after
            production begins. Damaged, defective, misprinted, or materially incorrect orders
            may qualify for a replacement or refund under our
            <NuxtLink to="/returns" class="text-[#2D6A4F] font-medium hover:underline">Return &amp; Refund Policy</NuxtLink>.
            Digital downloads are non-refundable once accessed unless required by law or we
            choose otherwise for a technical issue.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            9. Acceptable Use
          </h2>
          <p>
            You may not misuse RadMaps, interfere with the service, overload rendering or
            checkout systems, scrape or harvest data, bypass security controls, probe for
            vulnerabilities without permission, upload malware, impersonate others, submit
            unlawful or infringing content, use RadMaps to track or endanger people, resell
            generated products commercially without permission, or use Strava data in any way
            that violates Strava's terms, privacy choices, or API requirements.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            10. Manual Review, Fraud Prevention, and Service Integrity
          </h2>
          <p>
            We may review, pause, cancel, refund, refuse, or remove accounts, maps, orders,
            coupons, public shares, or support requests when needed for fraud prevention,
            security, legal compliance, fulfillment reliability, provider requirements, or
            protection of RadMaps, customers, creators, and third parties.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            11. Beta, Experimental, and Generated Features
          </h2>
          <p>
            Some features may be experimental, feature-flagged, staff-only, or generated by
            automation or AI systems. Generated suggestions may be inaccurate or unsuitable.
            You are responsible for reviewing any design, text, route, and order details
            before purchase.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            12. Disclaimers
          </h2>
          <p>
            RadMaps is provided "as is" and "as available." To the fullest extent permitted
            by law, RadMaps disclaims all warranties, express or implied, including implied
            warranties of merchantability, fitness for a particular purpose,
            non-infringement, availability, accuracy, and uninterrupted operation. We do not
            guarantee that any route, map, terrain, contour, label, delivery estimate,
            generated preview, or printed color will be accurate or fit for any particular
            use.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            13. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, RadMaps, its owners, employees,
            contractors, affiliates, suppliers, and third-party service providers will not be
            liable for indirect, incidental, special, consequential, exemplary, punitive, or
            lost-profit damages, or for loss of data, goodwill, business, use, or route
            access. RadMaps' total liability for any claim will not exceed the greater of
            the amount you paid RadMaps for the product or service giving rise to the claim
            during the 12 months before the event, or USD $100. Some jurisdictions do not
            allow certain exclusions, so parts of this section may not apply to you.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            14. Indemnity
          </h2>
          <p>
            You agree to defend, indemnify, and hold harmless RadMaps and its owners,
            employees, contractors, affiliates, suppliers, and service providers from claims,
            liabilities, damages, losses, and expenses, including reasonable attorneys' fees,
            arising from your User Content, your use of RadMaps, your products or public
            shares, your violation of these Terms, or your violation of law or third-party
            rights.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            15. Suspension and Termination
          </h2>
          <p>
            You may stop using RadMaps at any time. We may suspend or terminate access,
            remove content, or cancel orders if we believe you violated these Terms, created
            risk for RadMaps or others, or used the service in a way that could harm the
            platform, providers, or customers. Sections that by their nature should survive,
            including ownership, payment obligations, disclaimers, liability limits,
            indemnity, disputes, and privacy-related rights, survive termination.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            16. Disputes and Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of Illinois, USA, without regard to conflict
            of law rules. Before filing a formal claim, you agree to contact
            <a href="mailto:support@radmaps.studio" class="text-[#2D6A4F] font-medium hover:underline">support@radmaps.studio</a>
            and give us a reasonable chance to resolve the issue informally. To the fullest
            extent permitted by law, disputes must be brought only on an individual basis and
            not as a plaintiff or class member in any class, collective, consolidated, or
            representative action.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            17. Changes
          </h2>
          <p>
            We may update these Terms as RadMaps changes. The "Last updated" date shows when
            the Terms were last revised. Continued use after revised Terms are posted means
            you accept the revised Terms, except where law requires a different notice or
            consent process.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            18. Contact
          </h2>
          <p>
            Questions about these Terms can be sent to
            <a href="mailto:support@radmaps.studio" class="text-[#2D6A4F] font-medium hover:underline">support@radmaps.studio</a>.
          </p>
        </div>
      </section>

      <div class="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between text-sm">
        <NuxtLink to="/" class="text-stone-500 hover:text-stone-900 transition-colors">Back home</NuxtLink>
        <NuxtLink to="/privacy-policy" class="font-semibold text-[#2D6A4F] hover:text-[#1E5238] transition-colors">Privacy Policy</NuxtLink>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema } from '~/utils/seo'

definePageMeta({ layout: 'default' })

useSeo({
  title: 'Terms of Service',
  description: 'RadMaps Studio Terms of Service for accounts, route uploads, Strava imports, custom map posters, payments, shipping, refunds, and licensing.',
  path: '/terms-of-service',
  jsonLd: [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Terms of Service', path: '/terms-of-service' },
    ]),
  ],
})
</script>
