import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Load .env files from the root and every sub-app that has its own. Tests in
// subprojects (e.g. render-worker-v4) read config at module-import time, so
// their env must be populated before vitest collects suites. Node 20.12+
// `loadEnvFile` is a no-op for missing files and never overrides existing
// process.env keys, so layering is safe.
for (const envPath of ['.env', 'render-worker-v4/.env']) {
  if (existsSync(envPath)) {
    try { process.loadEnvFile(envPath) } catch { /* malformed — let tests fail loudly */ }
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['tests/style-browser/**', 'tests/e2e/**', 'render-worker-v4/**', '**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.output/**'],
    typecheck: { tsconfig: './tsconfig.test.json' },
  },
  define: {
    // Nuxt compile-time constant — not available in the test runner
    'import.meta.server': 'false',
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
    },
  },
  esbuild: {
    // Inline tsconfig bypasses the file-based lookup that would try to resolve
    // the Nuxt-generated .nuxt/tsconfig.json (only present after `nuxt prepare`)
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2022',
        strict: true,
      },
    },
  },
})
