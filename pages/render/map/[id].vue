<template>
  <div v-if="pending" class="render-shell render-shell--loading" />
  <div v-else-if="error || !payload" class="render-shell render-shell--error" />
  <div
    v-else
    class="render-shell"
    :style="{ width: `${cssWidth}px`, height: `${cssHeight}px` }"
  >
    <MapPreview
      :map="payload.map"
      :style-config="payload.styleConfig"
      :editable="false"
      render-mode="print"
      :print-context="printContext"
    />
  </div>
</template>

<script setup lang="ts">
import type { PrintFraming } from '~/utils/print/printFraming'
import type { RenderTicketPayload } from '~/utils/render/renderTicket'
import type { StyleConfig, TrailMap } from '~/types'

definePageMeta({ layout: false })
useHead({
  meta: [
    { name: 'robots', content: 'noindex,nofollow' },
  ],
})

interface RenderPayload {
  ticket: RenderTicketPayload
  framing: PrintFraming
  map: TrailMap
  styleConfig: StyleConfig
}

const route = useRoute()
const { data: payload, pending, error } = await useFetch<RenderPayload>('/api/render/payload', {
  query: { ticket: route.query.ticket },
})

const cssWidth = computed(() => Math.round((payload.value?.ticket.widthPx ?? 1) / (payload.value?.ticket.deviceScaleFactor ?? 1)))
const cssHeight = computed(() => Math.round((payload.value?.ticket.heightPx ?? 1) / (payload.value?.ticket.deviceScaleFactor ?? 1)))

const printContext = computed(() => payload.value
  ? {
      framing: payload.value.framing,
      cssWidthPx: cssWidth.value,
      cssHeightPx: cssHeight.value,
      deviceScaleFactor: payload.value.ticket.deviceScaleFactor,
    }
  : undefined)
</script>

<style scoped>
.render-shell {
  overflow: hidden;
  position: relative;
  background: #f7f4ef;
}

.render-shell--loading,
.render-shell--error {
  width: 100vw;
  height: 100vh;
}

:global(#nuxt-devtools-container),
:global(nuxt-devtools),
:global(.nuxt-devtools) {
  display: none !important;
}
</style>
