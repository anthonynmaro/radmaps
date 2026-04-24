<template>
  <DashboardView v-if="user" />
  <ShopView v-else />
</template>

<script setup lang="ts">
import DashboardView from '~/components/views/DashboardView.vue'
import ShopView from '~/components/views/ShopView.vue'

definePageMeta({
  layout: 'default',
})

const user = useSupabaseUser()

useHead(() => ({
  title: user.value
    ? 'My Maps — RadMaps'
    : 'RadMaps — Trail Posters, Printed & Framed',
  meta: user.value
    ? [
        { name: 'description', content: 'Your RadMaps studio — your trail posters, custom designs, and recent orders.' },
      ]
    : [
        { name: 'description', content: 'Shop a curated collection of premade trail posters — iconic hikes, marathons, and adventures. Or bring your own route from Strava or your watch to design a custom print.' },
      ],
}))
</script>
