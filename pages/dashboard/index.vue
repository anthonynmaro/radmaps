<script setup lang="ts">
// Legacy route: `/dashboard` now lives at `/`. Redirect permanently.
definePageMeta({
  layout: false,
})

await navigateTo('/', { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>
