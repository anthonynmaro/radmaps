import { useHead, useRoute, useRequestURL } from '#imports'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, DEFAULT_OG_IMAGE, absoluteUrl } from '~/utils/seo'

export interface SeoOptions {
  title: string
  description: string
  /** Path relative to site root, e.g. '/shop'. Defaults to current route. */
  path?: string
  /** Absolute or relative image URL. Defaults to DEFAULT_OG_IMAGE. */
  image?: string
  /** OpenGraph type. Defaults to 'website'. */
  ogType?: 'website' | 'article' | 'product' | 'profile'
  /** If true, marks the page as noindex/nofollow (for private/auth pages). */
  noindex?: boolean
  /** Optional JSON-LD structured data objects to inject as <script type="application/ld+json"> */
  jsonLd?: Array<Record<string, unknown>>
  /** Override site name in title. Default: "{title} — RadMaps". */
  titleTemplate?: string
}

/**
 * Single composable that wires up:
 *   • Title (with consistent " — RadMaps" suffix)
 *   • Meta description
 *   • Canonical link
 *   • Open Graph + Twitter Card tags
 *   • robots noindex (when requested)
 *   • Optional JSON-LD scripts
 */
export function useSeo(options: SeoOptions) {
  const route = useRoute()
  const path = options.path ?? route.fullPath
  const canonical = absoluteUrl(path.split('?')[0])

  const ogImage = options.image
    ? options.image.startsWith('http')
      ? options.image
      : absoluteUrl(options.image)
    : DEFAULT_OG_IMAGE

  const fullTitle = options.titleTemplate
    ? options.titleTemplate.replace('%s', options.title)
    : `${options.title} — ${SITE_NAME.replace(' Studio', '')}`

  useHead({
    title: fullTitle,
    link: [{ rel: 'canonical', href: canonical }],
    meta: [
      { name: 'description', content: options.description },
      ...(options.noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : [{ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }]),
      // Open Graph
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: options.description },
      { property: 'og:url', content: canonical },
      { property: 'og:type', content: options.ogType ?? 'website' },
      { property: 'og:image', content: ogImage },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'en_US' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: TWITTER_HANDLE },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: options.description },
      { name: 'twitter:image', content: ogImage },
    ],
    script: (options.jsonLd ?? []).map((obj) => ({
      type: 'application/ld+json',
      innerHTML: JSON.stringify(obj),
    })),
  })
}
