import type { AtlasLayerId } from '~/types'

export type AtlasUsageEventName =
  | 'atlas_lab_preview_loaded'
  | 'style_selected'
  | 'layer_toggled'
  | 'layer_setting_changed'
  | 'proof_render_requested'
  | 'final_render_completed'
  | 'checkout_completed'
  | 'order_placed'

export type AtlasUsagePayload = {
  eventName: AtlasUsageEventName
  atlasManifestId?: string
  atlasStyleId?: string
  atlasVersion?: string
  tileSchemaVersion?: string
  enabledLayers?: AtlasLayerId[]
  artifactIds?: string[]
  renderClass?: string
  printSize?: string
  providerId?: string
  mapId?: string
  orderId?: string
  anonymousId?: string
  source?: string
  metadata?: Record<string, unknown>
}

export function trackAtlasUsageEvent(payload: AtlasUsagePayload) {
  if (!import.meta.client) return

  const body = JSON.stringify(payload)
  const url = '/api/atlas/usage'

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(url, blob)) return
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch((error) => {
    console.warn(`Atlas usage event failed: ${error instanceof Error ? error.message : String(error)}`)
  })
}
