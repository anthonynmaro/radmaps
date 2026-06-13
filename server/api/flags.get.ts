import { getEnabledFeatureFlags } from '~/server/utils/featureFlags'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  // E2E hermeticity: RADMAPS_E2E=1 (set by playwright.e2e.config.ts for its
  // dev server) pins the flag surface EMPTY so suites that assert the legacy
  // flows (the money path) cannot be flipped by environment flag rows — CI
  // runs with real Supabase secrets, which would otherwise enable
  // development-environment flags (e.g. editor_v2) mid-suite. Dev-mode only;
  // specs that need flags ON use the style-browser fixture's ?flags= override.
  if (import.meta.dev && process.env.RADMAPS_E2E === '1') return { flags: {} }
  return { flags: await getEnabledFeatureFlags(event) }
})
