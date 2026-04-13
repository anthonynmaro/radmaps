// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: '2024-11-01',

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
      exclude: ['/', '/map/*'],
    },
  },

  // Runtime config — public vars available client-side, private server-only
  runtimeConfig: {
    // Server-only secrets
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    gelatoApiKey: process.env.GELATO_API_KEY,
    gelatoWebhookSecret: process.env.GELATO_WEBHOOK_SECRET,
    stravaClientId: process.env.STRAVA_CLIENT_ID,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET,
    stravaRedirectUri: process.env.STRAVA_REDIRECT_URI,
    trailforkApiKey: process.env.TRAILFORKS_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    renderWorkerUrl: process.env.RENDER_WORKER_URL,
    renderWorkerSecret: process.env.RENDER_WORKER_SECRET,
    public: {
      // Client-accessible vars
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      mapboxToken: process.env.MAPBOX_TOKEN,
      maptilerToken: process.env.MAPTILER_TOKEN,
    },
  },

  // Nitro (server engine) config
  nitro: {
    // Use Vercel preset for deployment
    preset: 'vercel',
    experimental: {
      openAPI: true,
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

  // App head
  app: {
    head: {
      title: 'RadMaps — Beautiful Maps from Your Trails',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Turn your GPX tracks, Strava activities, and trail routes into beautiful print-quality maps.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@400;600;700;900&family=Fjalla+One&family=Oswald:wght@400;500;600;700&family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Work+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Serif+Display:ital,wght@0,400;1,400&display=swap' },
      ],
    },
  },
})
