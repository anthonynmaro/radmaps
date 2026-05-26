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
        Privacy Policy
      </h1>
      <p class="text-sm text-stone-400 mb-8 tracking-wide">
        Last updated: May 26, 2026
      </p>

      <div class="rounded-lg border border-stone-200 bg-white/65 p-5 mb-10 text-sm leading-relaxed text-stone-600">
        <p>
          RadMaps collects route, design, account, order, and support information to
          help you create map posters and receive printed or digital products. We do
          not sell your personal information, do not store full payment card numbers,
          and do not use Strava data for advertising or AI model training.
        </p>
      </div>

      <section class="space-y-8 text-sm leading-relaxed text-stone-600">
        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            1. Scope
          </h2>
          <p>
            This Privacy Policy explains how RadMaps Studio ("RadMaps," "we," "us,"
            and "our") collects, uses, shares, and protects information when you use
            radmaps.studio, create an account, import routes, design maps, place
            orders, contact support, or use related features.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            2. Information We Collect
          </h2>
          <p>
            The information we collect depends on how you use RadMaps:
          </p>
          <ul class="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong>Account and contact information:</strong> email address, name,
              authentication provider details, profile metadata, and login/session
              information.
            </li>
            <li>
              <strong>Route and map content:</strong> GPX files, GeoJSON, route
              geometry, Strava activity metadata you authorize, elevation and distance
              stats, map titles, labels, poster text, style settings, print size,
              colors, fonts, uploaded logos or images, generated previews, public-share
              settings, and rendered proof or final artwork.
            </li>
            <li>
              <strong>Order and fulfillment information:</strong> products, quantities,
              prices, discounts, shipping quotes, tax amounts, currency, recipient name,
              email, shipping address, phone number if provided, delivery estimates,
              tracking details, Gelato fulfillment IDs, Stripe customer/session/payment
              identifiers, receipt URLs, refund records, dispute records, and fraud or
              manual-review signals.
            </li>
            <li>
              <strong>Support and administration information:</strong> messages you send
              us, order lookup details, staff notes, timeline events, support actions,
              refund or replacement decisions, and email delivery logs.
            </li>
            <li>
              <strong>Technical information:</strong> IP address, browser and device
              details, pages or API routes requested, timestamps, error logs, security
              events, feature-flag state, rendering diagnostics, and operational logs
              from hosting, database, queue, email, and fulfillment providers.
            </li>
            <li>
              <strong>Local device information:</strong> saved theme preferences,
              temporary editor state, and session-related data stored in cookies or
              local storage when needed for authentication, preferences, checkout,
              feature flags, and app operation.
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            3. Information From Connected Services
          </h2>
          <p>
            If you sign in with Google or connect Strava, those services provide
            information according to your authorization and their own policies. For
            Strava, we request activity-read permission by default and request private
            activity access only if you choose the private-activity connection option.
            We may receive your Strava athlete ID, name, activity list, activity name,
            sport type, distance, elevation, date, moving time, summary route data,
            photos thumbnails, and detailed streams for the specific activity you choose
            to import.
          </p>
          <p class="mt-3">
            Map and tile providers may receive tile requests from your browser or from
            our rendering workers, including IP address, browser information, and map
            tile or viewport coordinates. We do not intentionally send your complete GPX
            file to tile providers, but tile requests can reveal the approximate area
            being viewed or rendered.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            4. How We Use Information
          </h2>
          <p>
            We use information to:
          </p>
          <ul class="mt-3 list-disc pl-5 space-y-2">
            <li>create and manage accounts, sessions, saved maps, and order history;</li>
            <li>import, parse, validate, display, style, render, and share maps at your direction;</li>
            <li>quote shipping, calculate order totals, process payments, collect tax where configured, issue receipts, refunds, and dispute records;</li>
            <li>print, fulfill, ship, track, replace, or refund orders;</li>
            <li>send transactional emails, order updates, support responses, and security notices;</li>
            <li>operate support tools, staff timelines, manual review, fraud prevention, and abuse detection;</li>
            <li>debug errors, improve reliability, protect RadMaps and customers, and comply with legal, accounting, tax, security, and provider obligations;</li>
            <li>provide optional experimental or AI-assisted features when you use them.</li>
          </ul>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            5. When We Share Information
          </h2>
          <p>
            We share information only as needed for RadMaps to work, for you to direct a
            public share or checkout, or for legal and security reasons:
          </p>
          <ul class="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong>Service providers:</strong> hosting, database, storage,
              authentication, payment, tax, print fulfillment, shipping, rendering,
              map/tile, email, security, logging, and support providers may process
              information for us.
            </li>
            <li>
              <strong>Checkout and fulfillment partners:</strong> Stripe receives
              payment, customer, tax, receipt, and checkout information; Gelato receives
              order, product, shipping, recipient, and print-file information needed to
              produce and ship orders.
            </li>
            <li>
              <strong>Connected services:</strong> Strava and Google process your data
              according to the permissions you grant them and their policies. Strava may
              monitor and use data related to our API access as described in Strava's API
              terms.
            </li>
            <li>
              <strong>Public sharing:</strong> if you make a map public, people with the
              link may see the public title, route, preview, style, and related metadata.
            </li>
            <li>
              <strong>Legal and safety:</strong> we may disclose information to comply
              with law, enforce our terms, respond to lawful requests, prevent fraud or
              abuse, protect rights and safety, or handle business transfers such as a
              merger, acquisition, financing, or sale of assets.
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            6. Strava Data
          </h2>
          <p>
            Strava connection is optional. We use Strava data only to authenticate your
            Strava-linked account, show your authorized activities, import the activity
            you choose, create map artwork, provide support, and maintain service
            security. We do not sell Strava data, use Strava data for targeted
            advertising, disclose Strava data to other users without your direction, or
            use Strava data for AI or machine-learning model training.
          </p>
          <p class="mt-3">
            Strava access and refresh tokens are stored encrypted. You can disconnect
            Strava from RadMaps in the create flow, which attempts to deauthorize RadMaps
            with Strava and deletes local Strava tokens. You can also revoke access from
            your <a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" class="text-[#2D6A4F] font-medium hover:underline">Strava connected apps settings</a>.
            Disconnecting Strava stops future imports but does not automatically delete
            maps, proof images, final renders, orders, or accounting records already
            created from imported activity data. You can delete eligible draft maps in
            your account or contact us to request deletion.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            7. Cookies, Local Storage, and Analytics
          </h2>
          <p>
            We use cookies and local storage for authentication, session security,
            redirect handling, saved design preferences, feature flags, checkout flow,
            and app reliability. We do not currently use third-party advertising cookies
            or sell/share personal information for cross-context behavioral advertising.
            If we add analytics, advertising, or marketing cookies later, we will update
            this Policy and provide any consent or opt-out controls required by law.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            8. Retention
          </h2>
          <p>
            We keep information for as long as needed to provide RadMaps, maintain your
            account and maps, fulfill orders, provide support, protect the service,
            comply with legal, tax, accounting, chargeback, fraud-prevention, and
            provider obligations, and resolve disputes. Draft maps can generally be
            deleted from your account. Ordered maps, immutable order snapshots, proof and
            final renders, transaction records, refunds, disputes, shipment records, and
            support notes may be retained longer because they are tied to production,
            payment, tax, audit, and customer-support obligations.
          </p>
          <p class="mt-3">
            Backup copies and logs may persist for a limited period after deletion before
            they are overwritten or expire. We may retain de-identified or aggregated
            information that no longer identifies you.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            9. Your Choices and Privacy Rights
          </h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete,
            export, restrict, object to, or withdraw consent for certain personal
            information. You may also have the right to appeal a privacy-rights decision
            or lodge a complaint with a privacy regulator. To make a request, email
            <a href="mailto:support@radmaps.studio?subject=Privacy%20Request" class="text-[#2D6A4F] font-medium hover:underline">support@radmaps.studio</a>.
          </p>
          <p class="mt-3">
            We may need to verify your identity before acting on a request. Some requests
            may be limited by law, security, fraud prevention, other people's privacy,
            payment and tax records, active disputes, fulfillment obligations, backups,
            or the need to complete a transaction you requested.
          </p>
        </div>

        <div id="state-privacy-rights">
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            10. California and Other U.S. State Privacy Rights
          </h2>
          <p>
            We do not sell personal information and do not share personal information for
            cross-context behavioral advertising. If applicable state privacy laws give
            you rights to know, access, correct, delete, obtain a portable copy, opt out
            of sale/share/targeted advertising, limit certain sensitive-personal-
            information uses, or avoid discrimination for exercising rights, you can
            contact us at
            <a href="mailto:support@radmaps.studio?subject=Privacy%20Request" class="text-[#2D6A4F] font-medium hover:underline">support@radmaps.studio</a>.
          </p>
          <p class="mt-3">
            Route geometry and shipping addresses can be sensitive because they may reveal
            location information. We use that information to provide RadMaps, fulfill
            orders, secure the service, and support you, not to infer unrelated
            characteristics or target ads.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            11. EEA, UK, and Swiss Users
          </h2>
          <p>
            If European, UK, or Swiss data protection laws apply, our legal bases may
            include performance of a contract, legitimate interests, consent, and legal
            obligations. Examples include providing accounts and orders, processing
            payments and fulfillment, securing the service, preventing fraud, responding
            to support requests, complying with tax and accounting requirements, and
            processing Strava data when you authorize it.
          </p>
          <p class="mt-3">
            RadMaps is operated from the United States, and our providers may process
            information in the United States and other countries. Where required, we use
            appropriate transfer mechanisms or rely on provider safeguards.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            12. Security
          </h2>
          <p>
            We use administrative, technical, and organizational measures designed to
            protect personal information, including HTTPS, limited staff access,
            authentication controls, signed render payloads, webhook verification,
            encrypted Strava token storage, provider security controls, and operational
            monitoring. No system is perfectly secure, so we cannot guarantee absolute
            security.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            13. Children
          </h2>
          <p>
            RadMaps is not directed to children under 13, and we do not knowingly collect
            personal information from children under 13. If you believe a child under 13
            provided information to RadMaps, contact us and we will take appropriate steps
            to delete it.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            14. Changes
          </h2>
          <p>
            We may update this Privacy Policy as RadMaps changes or legal requirements
            evolve. The "Last updated" date shows when this Policy was last revised.
            Material changes will be handled with additional notice or consent where
            required by law.
          </p>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-stone-900 mb-3" style="font-family:'Space Grotesk',sans-serif">
            15. Contact
          </h2>
          <p>
            For privacy questions or requests, email
            <a href="mailto:support@radmaps.studio?subject=Privacy%20Request" class="text-[#2D6A4F] font-medium hover:underline">support@radmaps.studio</a>.
          </p>
        </div>
      </section>

      <div class="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between text-sm">
        <NuxtLink to="/" class="text-stone-500 hover:text-stone-900 transition-colors">Back home</NuxtLink>
        <NuxtLink to="/terms-of-service" class="font-semibold text-[#2D6A4F] hover:text-[#1E5238] transition-colors">Terms of Service</NuxtLink>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema } from '~/utils/seo'

definePageMeta({ layout: 'default' })

useSeo({
  title: 'Privacy Policy',
  description: 'RadMaps Studio Privacy Policy covering accounts, route files, Strava imports, map rendering, payments, shipping, support, cookies, and privacy rights.',
  path: '/privacy-policy',
  jsonLd: [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Privacy Policy', path: '/privacy-policy' },
    ]),
  ],
})
</script>
