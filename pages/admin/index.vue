<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })
await navigateTo('/admin/premade', { replace: true })
</script>

<template>
  <div />
</template>
