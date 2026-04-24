/**
 * GET /llms.txt
 *
 * Proposed standard from llmstxt.org — a markdown site index designed for
 * LLM consumption. Lists key URLs with short descriptions so AI assistants
 * can cite the right page when answering trail-poster / map-print questions.
 */
import { PREMADE_MAPS } from '~/data/premade-maps'
import { SITE_URL } from '~/utils/seo'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const premadeLines = PREMADE_MAPS.map(
    (m) => `- [${m.title}](${SITE_URL}/shop/${m.slug}): ${m.tagline} ${m.region}. ${Math.round(m.stats.distance_km)} km, ${m.stats.elevation_gain_m.toLocaleString()} m of elevation gain.`,
  ).join('\n')

  return `# RadMaps Studio

> RadMaps Studio turns trail routes — Strava activities, GPX tracks, drawn maps, or curated iconic routes — into museum-quality printed posters shipped worldwide. Free to design, pay only if you print.

RadMaps is for hikers, trail runners, marathoners, cyclists, pilgrims, and gift-buyers who want a route they care about preserved as a wall-worthy poster. Custom designs require a free account; premade prints can be purchased as a guest with no signup.

## Core pages

- [Home](${SITE_URL}/): The studio dashboard for signed-in users; the curated print shop for guests.
- [Shop all prints](${SITE_URL}/shop): Browse the full premade catalog of iconic trail posters.
- [Create a custom map](${SITE_URL}/create): Four ways to start — Strava import, GPX upload, premade clone, or draw on a map. Requires a free account.
- [Sign in or create an account](${SITE_URL}/auth/login): Magic-link auth, no password. Google and Strava SSO supported.

## Premade trail posters

${premadeLines}

## Help and policies

- [Support](${SITE_URL}/support): Help with shipping, returns, route imports, and design.
- [Terms](${SITE_URL}/terms): Order, refund, and license terms.
- [Privacy](${SITE_URL}/privacy): What data we collect and how it's used.

## Optional

- [Full content for LLMs](${SITE_URL}/llms-full.txt): Extended markdown content covering products, pricing, materials, and FAQs.
`
})
