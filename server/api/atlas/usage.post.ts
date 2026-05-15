import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { AtlasUsageEventName } from '~/utils/atlasUsage'

const EVENT_NAMES = new Set<AtlasUsageEventName>([
  'atlas_lab_preview_loaded',
  'style_selected',
  'layer_toggled',
  'layer_setting_changed',
  'proof_render_requested',
  'final_render_completed',
  'checkout_completed',
  'order_placed',
])

function cleanString(value: unknown, maxLength = 300) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function cleanStringArray(value: unknown, maxItems = 32) {
  if (!Array.isArray(value)) return null
  return value
    .map(item => cleanString(item, 120))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems)
}

function cleanObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({})) as Record<string, unknown>
  const eventName = cleanString(body.eventName, 80) as AtlasUsageEventName | null

  if (!eventName || !EVENT_NAMES.has(eventName)) {
    throw createError({ statusCode: 400, message: 'Invalid atlas usage event' })
  }

  const user = await serverSupabaseUser(event).catch(() => null)
  const supabase = await serverSupabaseServiceRole(event)
  const { error } = await supabase.from('atlas_usage_events').insert({
    event_name: eventName,
    atlas_manifest_id: cleanString(body.atlasManifestId),
    atlas_style_id: cleanString(body.atlasStyleId),
    atlas_version: cleanString(body.atlasVersion),
    tile_schema_version: cleanString(body.tileSchemaVersion),
    enabled_layers: cleanStringArray(body.enabledLayers),
    artifact_ids: cleanStringArray(body.artifactIds),
    render_class: cleanString(body.renderClass, 80),
    print_size: cleanString(body.printSize, 80),
    provider_id: cleanString(body.providerId, 120),
    map_id: cleanString(body.mapId, 80),
    order_id: cleanString(body.orderId, 80),
    user_id: user?.id ?? null,
    anonymous_id: cleanString(body.anonymousId, 160),
    source: cleanString(body.source, 80) || 'app',
    metadata: cleanObject(body.metadata),
  })

  if (error) {
    console.warn(`Atlas usage event not stored: ${error.message}`)
    return { ok: true, stored: false }
  }

  return { ok: true, stored: true }
})
