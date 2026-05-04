import { defineConfig } from 'vitest/config'

// CONFIG is validated at module-load via process.env. Provide stub values
// so tests that import any module touching `src/config.ts` (transitively
// via log.ts, db.ts, …) don't bomb out on boot.
process.env.RENDER_WORKER_SECRET ??= 'test-secret'
process.env.SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test-service-key'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    // sharp + maplibre-native both ship native binaries; keep the worker
    // count low to avoid OOM on CI runners.
    poolOptions: { forks: { singleFork: true } },
    env: {
      RENDER_WORKER_SECRET: 'test-secret',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
    },
  },
  resolve: {
    alias: {
      '~/types': new URL('../types/index.ts', import.meta.url).pathname,
    },
  },
})
