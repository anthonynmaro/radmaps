/**
 * useStyleAgent — wrapper around the streaming AI styling agent.
 * Handles SSE parsing, tool call extraction, and StyleConfig mutation.
 */
import type { StyleConfig, RouteStats, AgentMessage, AgentStep } from '~/types'

export function useStyleAgent(
  styleConfig: Ref<StyleConfig>,
  routeStats: Ref<RouteStats>,
  onStyleUpdate: (updates: Partial<StyleConfig>) => void,
) {
  const messages = ref<AgentMessage[]>([])
  const currentStep = ref<AgentStep>('preset')
  const isThinking = ref(false)
  const error = ref<string | null>(null)
  const partialToolInput = ref('')

  // Greeting on first load
  onMounted(() => {
    messages.value.push({
      role: 'assistant',
      content: `Hey! Let's design your trail map. 🗺️\n\nI can see your route: **${routeStats.value.distance_km} km** with **${routeStats.value.elevation_gain_m}m elevation gain**.\n\nFirst up — which style feels right?\n\n**A) Minimalist Poster** — clean, modern, perfect for framing\n**B) Topographic Art** — elevation contours, earthy and detailed\n\nWhich would you prefer?`,
    })
  })

  async function sendMessage(userMessage: string) {
    messages.value.push({ role: 'user', content: userMessage })
    isThinking.value = true
    error.value = null

    let assistantText = ''
    partialToolInput.value = ''

    try {
      const response = await fetch('/api/agent/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.value,
          style_config: styleConfig.value,
          route_stats: routeStats.value,
        }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'text') {
            assistantText += data.content
          }

          if (data.type === 'tool_delta') {
            partialToolInput.value += data.content
          }

          if (data.type === 'done' && data.tool_calls?.length) {
            for (const toolCall of data.tool_calls) {
              if (toolCall.name === 'update_style') {
                const { updates, step_complete } = toolCall.input as {
                  updates: Partial<StyleConfig>
                  step_complete?: AgentStep
                }
                onStyleUpdate(updates)
                if (step_complete) {
                  currentStep.value = step_complete
                }
              }
            }
          }
        }
      }

      if (assistantText) {
        messages.value.push({ role: 'assistant', content: assistantText })
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isThinking.value = false
      partialToolInput.value = ''
    }
  }

  function reset() {
    messages.value = []
    currentStep.value = 'preset'
    error.value = null
  }

  return { messages, currentStep, isThinking, error, sendMessage, reset }
}
