<template>
  <ShopView />
</template>

<script setup lang="ts">
import ShopView from '~/components/views/ShopView.vue'
import { useSeo } from '~/composables/useSeo'
import { breadcrumbSchema, SITE_URL } from '~/utils/seo'
import type { PremadeMap } from '~/types'

const { data: premadeMaps } = await useFetch<PremadeMap[]>('/api/premade', {
  default: () => [],
})

definePageMeta({
  layout: 'default',
})

const collectionSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Shop Trail Posters',
  url: `${SITE_URL}/shop`,
  description: 'A curated collection of iconic trail posters — printed on archival paper and shipped worldwide.',
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: premadeMaps.value.length,
    itemListElement: premadeMaps.value.map((m, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${SITE_URL}/shop/${m.slug}`,
      name: m.title,
      image: m.preview_image_url ?? undefined,
    })),
  },
}

useSeo({
  title: 'Shop Trail Posters',
  description: 'Shop a curated collection of premade trail posters — iconic hikes, marathons, and adventures, printed on archival paper and shipped worldwide. No account required.',
  path: '/shop',
  jsonLd: [
    collectionSchema,
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop' },
    ]),
  ],
})
</script>
