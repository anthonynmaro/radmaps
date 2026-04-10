/**
 * POST /api/agent/style
 * Streaming AI styling agent powered by Claude claude-sonnet-4-6.
 * Uses Vercel AI SDK to stream responses and emit tool calls that update StyleConfig.
 */
import Anthropic from '@anthropic-ai/sdk'
import { serverSupabaseUser } from '#supabase/server'
import type { StyleConfig, RouteStats, AgentStep } from '~/types'

const STYLE_AGENT_SYSTEM_PROMPT = `You are a friendly map design assistant helping users create beautiful,
personalised trail maps. Your job is to guide them through styling their map step by step.

You have access to the following information about their route:
- Route stats: distance, elevation gain, location, activity type
- Current style configuration (JSON)

Guide the conversation through these steps:
1. PRESET — Recommend Minimalist or Topographic based on the route (e.g. topo for mountain routes)
2. COLORS — Suggest a colour palette. Offer 3 options as concrete named schemes (e.g. "Alpine Sunset", "Forest Path", "Ocean Trail")
3. TYPOGRAPHY — Suggest a font pairing appropriate to the style
4. LABELS — Ask which stats to display (distance, elevation, date, location)
5. BORDER — Thin frame, thick frame, or no border?
6. CONFIRM — Show a summary and ask if they want to proceed to ordering

After each user response, emit a tool call to update the StyleConfig.
Keep responses concise and friendly. Use trail/outdoor language.
NEVER suggest colours that will make text unreadable.
ALWAYS provide at least 2 choices at each step.`

const tools: Anthropic.Tool[] = [
  {
    name: 'update_style',
    description: 'Update one or more fields of the map StyleConfig based on user choices. Call this after each user response to apply their selections.',
    input_schema: {
      type: 'object' as const,
      properties: {
        updates: {
          type: 'object',
          description: 'Partial StyleConfig updates to apply. Only include fields that should change.',
          additionalProperties: true,
        },
        step_complete: {
          type: 'string',
          enum: ['preset', 'colors', 'typography', 'labels', 'border', 'confirm'],
          description: 'Which step has just been completed by this update.',
        },
      },
      required: ['updates'],
    },
  },
]

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const { messages, style_config, route_stats } = body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    style_config: StyleConfig
    route_stats: RouteStats
  }

  const config = useRuntimeConfig()
  const client = new Anthropic({ apiKey: config.anthropicApiKey })

  // Build system context with current state
  const systemPrompt = `${STYLE_AGENT_SYSTEM_PROMPT}

Current route stats:
${JSON.stringify(route_stats, null, 2)}

Current StyleConfig:
${JSON.stringify(style_config, null, 2)}`

  // Set up SSE streaming
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  // Stream text deltas as SSE events
  const response = event.node.res
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      response.write(`data: ${JSON.stringify({ type: 'text', content: chunk.delta.text })}\n\n`)
    }

    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
      // Tool call delta — accumulate client-side
      response.write(`data: ${JSON.stringify({ type: 'tool_delta', content: chunk.delta.partial_json })}\n\n`)
    }

    if (chunk.type === 'message_delta' && chunk.delta.stop_reason === 'tool_use') {
      // Tool call complete — signal client to apply the update
      response.write(`data: ${JSON.stringify({ type: 'tool_complete' })}\n\n`)
    }
  }

  const finalMessage = await stream.finalMessage()

  // Extract any tool calls from the final message
  const toolCalls = finalMessage.content
    .filter(block => block.type === 'tool_use')
    .map(block => ({
      name: (block as Anthropic.ToolUseBlock).name,
      input: (block as Anthropic.ToolUseBlock).input,
    }))

  response.write(`data: ${JSON.stringify({ type: 'done', tool_calls: toolCalls })}\n\n`)
  response.end()
})
