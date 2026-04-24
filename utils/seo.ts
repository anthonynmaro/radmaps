/**
 * Shared SEO constants + helpers used across pages, server routes, and
 * the sitemap generator.
 */

export const SITE_URL = 'https://radmaps.studio'
export const SITE_NAME = 'RadMaps Studio'
export const SITE_TAGLINE = 'Trail posters, printed and framed.'
export const TWITTER_HANDLE = '@radmapsstudio'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`

export type SitemapEntry = {
  loc: string
  lastmod?: string             // ISO date
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number            // 0.0 – 1.0
}

/** Build an absolute URL from a path. */
export const absoluteUrl = (path: string): string => {
  if (!path) return SITE_URL
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Build a JSON-LD Organization schema. */
export const orgSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  sameAs: [],
  description:
    'RadMaps Studio turns trail routes — Strava activities, GPX tracks, drawn maps, or curated iconic routes — into museum-quality printed posters shipped worldwide.',
})

/** Build a WebSite schema with optional SearchAction. */
export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_TAGLINE,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/shop?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
})

/** Build a BreadcrumbList schema from `[label, path]` pairs. */
export const breadcrumbSchema = (items: Array<{ name: string; path: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: it.name,
    item: absoluteUrl(it.path),
  })),
})
