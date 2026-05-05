import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// CONFIG is validated at module-load via process.env. Provide stub values so
// tests that import modules touching `src/config.ts` do not fail at import time.
process.env.SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test-service-key'
process.env.RENDER_TICKET_SECRET ??= 'test-render-ticket-secret-000000000000'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    // Sharp ships native binaries; keep worker count low to avoid CI memory
    // spikes during image validation tests.
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      RENDER_TICKET_SECRET: 'test-render-ticket-secret-000000000000',
    },
  },
  resolve: {
    alias: {
      '~/types': new URL('../types/index.ts', import.meta.url).pathname,
      '~': resolve(__dirname, '..'),
    },
  },
})
