/**
 * GET /sitemap.xml
 * Dynamically generated sitemap covering all public pages plus every
 * premade map slug from the static catalog.
 */
import { PREMADE_MAPS } from '~/data/premade-maps'
import { SITE_URL, type SitemapEntry } from '~/utils/seo'

const today = () => new Date().toISOString().split('T')[0]

const entries: SitemapEntry[] = [
  { loc: '/',         priority: 1.0, changefreq: 'daily' },
  { loc: '/shop',     priority: 0.9, changefreq: 'daily' },
  { loc: '/support',  priority: 0.5, changefreq: 'monthly' },
  { loc: '/terms',    priority: 0.3, changefreq: 'yearly' },
  { loc: '/privacy',  priority: 0.3, changefreq: 'yearly' },
  { loc: '/auth/login', priority: 0.4, changefreq: 'yearly' },
]

// Premade product pages — one per slug
for (const m of PREMADE_MAPS) {
  entries.push({
    loc: `/shop/${m.slug}`,
    priority: 0.85,
    changefreq: 'weekly',
  })
}

const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const lastmod = today()
  const urls = entries
    .map((e) => {
      return `  <url>
    <loc>${xmlEscape(`${SITE_URL}${e.loc}`)}</loc>
    <lastmod>${e.lastmod ?? lastmod}</lastmod>
    <changefreq>${e.changefreq ?? 'monthly'}</changefreq>
    <priority>${(e.priority ?? 0.5).toFixed(1)}</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
})
