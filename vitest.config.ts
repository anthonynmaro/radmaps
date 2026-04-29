import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    typecheck: { tsconfig: './tsconfig.test.json' },
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['utils/**', 'composables/useSavedThemes.ts'],
      reporter: ['text', 'lcov'],
    },
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
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
      },
    },
  },
})
