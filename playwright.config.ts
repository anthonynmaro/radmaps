import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config() // load .env for global-setup and auth.setup (not loaded by Nuxt in this context)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Auth setup project runs first and writes session to .auth/user.json
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // Authenticated browsers depend on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: '**/anon/**',
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: '**/anon/**',
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: '**/anon/**',
    },
    // Anonymous tests — no auth required
    {
      name: 'chromium-anon',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/anon/**/*.spec.ts',
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  globalSetup: './e2e/global-setup.ts',
})
