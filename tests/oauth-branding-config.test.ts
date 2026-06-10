import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

function readProjectFile(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('OAuth branding configuration', () => {
  it('keeps Strava OAuth entry points outside the Supabase login redirect', () => {
    const nuxtConfig = readProjectFile('nuxt.config.ts')

    expect(nuxtConfig).toContain("'/api/strava/connect'")
    expect(nuxtConfig).toContain("'/api/strava/callback'")
  })

  it('documents the branded OAuth domains and callback sequencing', () => {
    const runbook = readProjectFile('docs/AUTH_OAUTH_BRANDING.md')

    expect(runbook).toContain('https://auth.radmaps.studio/auth/v1/callback')
    expect(runbook).toContain('https://radmaps.studio/api/strava/callback')
    expect(runbook).toContain('SUPABASE_URL=https://auth.radmaps.studio')
    expect(runbook).toContain('Do not activate the Supabase custom domain early')
    expect(runbook).toContain('Vercel DNS records for `radmaps.studio` are not authoritative')
  })

  it('keeps agent docs aligned with the production Strava callback and runbook', () => {
    for (const path of ['AGENTS.md', 'CLAUDE.md']) {
      const agentDoc = readProjectFile(path)

      expect(agentDoc).toContain('docs/AUTH_OAUTH_BRANDING.md')
      expect(agentDoc).toContain('https://radmaps.studio/api/strava/callback')
      expect(agentDoc).toContain('/api/strava/connect')
      expect(agentDoc).toContain('/api/strava/callback')
      expect(agentDoc).not.toContain('https://radmaps.studio/auth/strava-callback')
    }
  })
})
