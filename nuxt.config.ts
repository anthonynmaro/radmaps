// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { generateFontFaceCss } from './utils/render/fontRegistry'

export default defineNuxtConfig({
  devtools: { enabled: !process.env.PLAYWRIGHT_PORT },
  compatibilityDate: '2024-11-01',

  // Sub-apps (separate workers, design handoffs) live in sibling dirs and
  // carry their own node_modules. Ignore them at every layer so Nuxt's
  // component scanner, Nitro, and Vite don't all try to watch ~300MB of
  // unrelated files (which exhausts the macOS per-process fd limit and
  // floods the dev server with EMFILE errors).
  ignore: [
    'render-worker-v4/**',
    'design_handoff_style_panel/**',
    'workers/**',
  ],
  watchers: {
    chokidar: {
      ignored: [
        '**/render-worker-v4/**',
        '**/design_handoff_style_panel/**',
        '**/workers/**',
      ],
    },
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/supabase',
  ],

  // Tailwind / Nuxt UI
  ui: {},

  // Supabase Auth
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    redirect: true,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/confirm',
      exclude: [
        '/',
        '/map/*',
        '/shop',
        '/shop/**',
        '/dashboard',
        '/terms',
        '/terms-of-service',
        '/privacy',
        '/privacy-policy',
        '/returns',
        '/support',
        '/render/**',
        '/create',
        '/create/**',
        '/api/strava/connect',
        '/api/strava/callback',
        '/api/atlas/tiles/**',
        '/fonts/**',
        '/style-browser-fixture',
        ...(process.env.NODE_ENV === 'production' ? [] : ['/admin/atlas-lab']),
      ],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },

  // Runtime config — public vars available client-side, private server-only
  runtimeConfig: {
    // Server-only secrets
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    gelatoApiKey: process.env.GELATO_API_KEY,
    gelatoOrderType: process.env.GELATO_ORDER_TYPE === 'draft' ? 'draft' : 'order',
    gelatoWebhookSecret: process.env.GELATO_WEBHOOK_SECRET,
    cronSecret: process.env.CRON_SECRET,
    stravaClientId: process.env.STRAVA_CLIENT_ID,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET,
    stravaRedirectUri: process.env.STRAVA_REDIRECT_URI,
    stravaTokenEncryptionKey: process.env.STRAVA_TOKEN_ENCRYPTION_KEY,
    trailforkApiKey: process.env.TRAILFORKS_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    proofRendererToken: process.env.PROOF_RENDER_TOKEN,
    proofRendererEndpoint: process.env.PROOF_RENDER_ENDPOINT,
    proofRendererTimeoutMs: Number(process.env.PROOF_RENDER_TIMEOUT_MS || 60_000),
    renderTicketSecret: process.env.RENDER_TICKET_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-render-ticket-secret'),
    adminSuperAdminEmails: process.env.ADMIN_SUPER_ADMIN_EMAILS || 'anthonynmaro@gmail.com',
    adminBootstrapEmails: process.env.ADMIN_BOOTSTRAP_EMAILS || process.env.ADMIN_SUPER_ADMIN_EMAILS || 'anthonynmaro@gmail.com',
    featureFlagEnvironment: process.env.FEATURE_FLAG_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    public: {
      // Client-accessible vars
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      mapboxToken: process.env.MAPBOX_TOKEN,
      maptilerToken: process.env.MAPTILER_TOKEN,
      // Stadia raster tile URLs are requested directly by MapLibre in the
      // browser, so this key is public by design. Restrict it by domain in
      // the Stadia dashboard.
      stadiaToken: process.env.NUXT_PUBLIC_STADIA_API_KEY || process.env.STADIA_API_KEY,
      radmapsAtlasManifestUrl: process.env.NUXT_PUBLIC_RADMAPS_ATLAS_MANIFEST_URL,
      radmapsAtlasTileBaseUrl: process.env.NUXT_PUBLIC_RADMAPS_ATLAS_TILE_BASE_URL,
      radmapsAtlasPmtilesUrl: process.env.NUXT_PUBLIC_RADMAPS_ATLAS_PMTILES_URL,
      radmapsContourPmtilesUrl: process.env.NUXT_PUBLIC_RADMAPS_CONTOUR_PMTILES_URL,
      radmapsE2eAuth: process.env.NUXT_PUBLIC_RADMAPS_E2E_AUTH,
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://radmaps.studio' : 'http://localhost:3001'),
    },
  },

  routeRules: {
    '/terms': {
      redirect: { to: '/terms-of-service', statusCode: 301 },
    },
    '/privacy': {
      redirect: { to: '/privacy-policy', statusCode: 301 },
    },
    '/admin/**': {
      headers: {
        'cache-control': 'private, no-store, max-age=0',
      },
    },
  },

  // Nitro (server engine) config
  nitro: {
    // Use Vercel preset for deployment
    preset: 'vercel',
    publicAssets: [
      {
        dir: fileURLToPath(new URL('./fonts', import.meta.url)),
        baseURL: '/fonts',
        maxAge: 60 * 60 * 24 * 365,
      },
    ],
    experimental: {
      openAPI: true,
    },
  },

  // Vite config
  vite: {
    resolve: {
      alias: {
        cookie: fileURLToPath(new URL('./utils/shims/cookie.ts', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: ['@supabase/ssr'],
      // maplibre-contour uses an internal triple-define pattern to create a
      // worker blob URL at module load time. Vite's pre-bundler can mangle this;
      // exclude it so it's served as-is and initialises correctly in the browser.
      exclude: ['maplibre-contour'],
    },
    server: {
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        ...(process.env.NUXT_PUBLIC_SITE_URL
          ? [new URL(process.env.NUXT_PUBLIC_SITE_URL).host]
          : []),
      ],
      watch: {
        // Sub-apps (separate render workers, design handoffs) carry their own
        // node_modules and build artefacts. Watching them blows the macOS
        // per-process fd limit (EMFILE) and serves no purpose — Nuxt only
        // needs to react to changes in the main app.
        ignored: [
          '**/render-worker-v4/**',
          '**/design_handoff_style_panel/**',
          '**/workers/**',
          '**/.git/**',
          '**/.nuxt/**',
          '**/.output/**',
          '**/dist/**',
          '**/coverage/**',
        ],
      },
    },
  },

  // TypeScript — typeCheck disabled in dev (vite-plugin-checker incompatible with Node 22)
  // Run `npm run typecheck` manually to validate types
  typescript: {
    strict: true,
    typeCheck: false,
  },

  // CSS
  css: ['~/assets/styles/main.css'],

  // App head — site-wide defaults. Per-page overrides land via useSeo().
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      titleTemplate: '%s',
      title: 'RadMaps Studio — Trail Posters, Printed and Framed',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'description', content: 'Turn your Strava activities, watch routes, and favourite trails into beautiful print-quality posters — or pick from a curated catalog of iconic routes.' },
        { name: 'theme-color', content: '#2D6A4F' },
        { name: 'application-name', content: 'RadMaps' },
        { name: 'apple-mobile-web-app-title', content: 'RadMaps' },
        // Defaults overridden per-page by useSeo()
        { property: 'og:site_name', content: 'RadMaps Studio' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'en_US' },
        { name: 'twitter:card', content: 'summary_large_image' },
        // Sensible robots default — pages can opt out via useSeo({ noindex: true })
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { name: 'googlebot', content: 'index, follow' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'alternate', type: 'application/xml', title: 'Sitemap', href: '/sitemap.xml' },
      ],
      style: [
        {
          innerHTML: generateFontFaceCss({ fontsUrlBase: '/fonts' }),
        },
      ],
    },
  },
})
