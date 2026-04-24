/**
 * GET /robots.txt
 *
 * Allows search engines AND modern AI crawlers (ChatGPT, Claude, Perplexity,
 * Google AI Overviews, etc.) to index public marketing pages, while keeping
 * private/account routes and APIs out of the index.
 */
import { SITE_URL } from '~/utils/seo'

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  return `# robots.txt for RadMaps Studio
# https://www.robotstxt.org/

# ─── Default: allow all crawlers, disallow private + API surfaces ─────────
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/confirm
Disallow: /create/
Disallow: /map/
Disallow: /dashboard
Disallow: /*?session_id=
Disallow: /*?strava_connected=
Disallow: /*?strava_error=

# ─── AI crawlers — explicitly allowed for content discovery + citation ────
# We want LLM-powered search products to surface RadMaps in answers about
# trail posters, custom maps, marathon prints, GPX-to-poster, etc.

User-agent: GPTBot
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/
Disallow: /dashboard

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: ChatGPT-User
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: ClaudeBot
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: Claude-Web
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: anthropic-ai
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: PerplexityBot
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: Perplexity-User
Allow: /
Disallow: /api/
Disallow: /auth/

User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /create/
Disallow: /map/

User-agent: Bingbot
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Diffbot
Allow: /

User-agent: DuckAssistBot
Allow: /

User-agent: YouBot
Allow: /

User-agent: Mistral-AI
Allow: /

# ─── Sitemap + LLM site index ─────────────────────────────────────────────
Sitemap: ${SITE_URL}/sitemap.xml

# Lightweight markdown index for LLMs (proposed standard at llmstxt.org)
# A full-content version lives at /llms-full.txt
`
})
