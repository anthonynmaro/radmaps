<template>
  <div class="h-full min-h-[360px] flex flex-col">
    <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div
        v-for="(message, idx) in messages"
        :key="idx"
        class="rounded-lg px-3 py-2 text-xs leading-relaxed"
        :class="message.role === 'user'
          ? 'ml-8 bg-stone-900 text-white'
          : 'mr-8 bg-stone-100 text-stone-800'"
      >
        <p class="whitespace-pre-wrap">{{ message.content }}</p>
      </div>
      <div v-if="isThinking" class="mr-8 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
        Thinking...
      </div>
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
    </div>

    <form class="border-t border-stone-100 p-3 flex gap-2" @submit.prevent="submit">
      <textarea
        v-model="draft"
        rows="2"
        class="min-h-10 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-[#2D6A4F]"
        placeholder="Ask Scout for a style change"
        @keydown.enter.exact.prevent="submit"
      />
      <button
        class="h-10 rounded-lg bg-stone-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
        :disabled="isThinking || !draft.trim()"
      >
        Send
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { RouteStats, StyleConfig } from '~/types'

const props = defineProps<{
  styleConfig: StyleConfig
  routeStats: RouteStats
}>()

const emit = defineEmits<{
  'update-style': [updates: Partial<StyleConfig>]
}>()

const draft = ref('')
const styleRef = computed(() => props.styleConfig)
const statsRef = computed(() => props.routeStats)

const { messages, isThinking, error, sendMessage } = useStyleAgent(
  styleRef,
  statsRef,
  updates => emit('update-style', updates),
)

async function submit() {
  const value = draft.value.trim()
  if (!value || isThinking.value) return
  draft.value = ''
  await sendMessage(value)
}
</script>
