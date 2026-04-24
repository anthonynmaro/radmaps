<template>
  <DashboardView v-if="user" />
  <ShopView v-else />
</template>

<script setup lang="ts">
import DashboardView from '~/components/views/DashboardView.vue'
import ShopView from '~/components/views/ShopView.vue'
import { useSeo } from '~/composables/useSeo'
import { orgSchema, websiteSchema } from '~/utils/seo'

definePageMeta({
  layout: 'default',
})

const user = useSupabaseUser()

if (user.value) {
  // Signed-in dashboard view — keep it out of the index, it's user-specific.
  useSeo({
    title: 'My Maps',
    description: 'Your RadMaps studio — your trail posters, custom designs, and recent orders.',
    path: '/',
    noindex: true,
  })
} else {
  // Public shop view — full SEO with Organization + WebSite JSON-LD.
  useSeo({
    title: 'Trail Posters, Printed and Framed',
    description: 'Shop a curated collection of premade trail posters — iconic hikes, marathons, and adventures. Or bring your own route from Strava or your watch to design a custom print.',
    path: '/',
    titleTemplate: 'RadMaps — %s',
    jsonLd: [orgSchema(), websiteSchema()],
  })
}
</script>
