<template>
  <ShopView />
</template>

<script setup lang="ts">
import ShopView from '~/components/views/ShopView.vue'

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Shop Trail Posters — RadMaps',
  meta: [
    { name: 'description', content: 'Shop a curated collection of premade trail posters — iconic hikes, marathons, and adventures, printed on archival paper and shipped worldwide.' },
  ],
})
</script>
