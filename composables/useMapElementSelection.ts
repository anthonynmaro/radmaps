// Editor-v2 E3 map selection mode (docs/STYLE_SYSTEM_EVOLUTION.md "The model",
// "Camera vs selection", "Domain 2"). Owns the single map-element selection:
// frozen map = selection mode, clicks hit-test graph-selectable slots via
// queryRenderedFeatures; unfrozen = camera mode, clicks do nothing.
//
// Everything here is editor-only chrome behind FLAGS.EDITOR_V2 — callers gate
// via `enabled`. Nothing in this file may influence buildMapStyle output.

import type { Map as MapLibreMap, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl'
import type { StyleConfig } from '~/types'
import {
  getGraphSlotLayerIds,
  getSelectableLayerSlots,
  type LayerSlot,
} from '~/utils/styleLayerGraph'

export interface MapElementSelection {
  domain: 'map'
  slot: LayerSlot
  /**
   * Stable per-feature key: atlas `rm_id` when the tileset carries it
   * (docs/ATLAS_STABLE_FEATURE_IDS.md — not in tiles yet, so labels resolve to
   * null today), the app-owned segment id for trail segments, null otherwise.
   */
  featureKey: string | null
  displayName: string
  lngLat: [number, number]
  properties: Record<string, unknown>
}

/**
 * Hit-test priority when overlapping features match: segments > pins > route >
 * labels. Pins are intentionally absent from this list: they are DOM markers
 * (maplibregl.Marker), never rendered map features, so they cannot appear in
 * queryRenderedFeatures results — they sit above the canvas and naturally win
 * any overlap. Their selection wiring is app-owned and lands with E4+.
 */
export const MAP_SELECTION_HIT_PRIORITY: readonly LayerSlot[] = ['segments-handles', 'route', 'labels-pois']

const HIT_TOLERANCE_PX = 6

const SLOT_KIND_LABELS: Partial<Record<LayerSlot, string>> = {
  'segments-handles': 'Trail segment',
  'route': 'Route',
  'labels-pois': 'Map label',
}

export function mapSelectionKindLabel(slot: LayerSlot): string {
  return SLOT_KIND_LABELS[slot] ?? 'Map element'
}

/**
 * Resolve the live MapLibre layer ids backing a selectable slot.
 * - labels-pois: canonical graph ids match generated style ids (pinned by
 *   tests/style-layer-graph.test.ts), filtered to layers present right now.
 * - route: the primary route renders as a family of art-variant line layers,
 *   all on the shared app-owned 'route' source — any of them is "the route".
 * - segments-handles: app-owned per-segment GeoJSON sources (`trail-seg-<id>`),
 *   plus the shared 'segment-handles' endpoint-dot circle layer (its features
 *   carry `seg_id` since E4, so endpoint dots select their segment too);
 *   ids are data-driven, not preset-driven, so they resolve from the live style.
 * This is data-path resolution, not a preset check — which slots are
 * selectable at all is decided exclusively by the style layer graph.
 */
function liveLayerIdsForSlot(map: MapLibreMap, preset: StyleConfig['preset'], slot: LayerSlot): string[] {
  if (slot === 'route' || slot === 'segments-handles') {
    const styleLayers = map.getStyle()?.layers ?? []
    return styleLayers
      .filter(layer => {
        if (!('source' in layer) || typeof layer.source !== 'string') return false
        if (layer.type === 'line') {
          return slot === 'route'
            ? layer.source === 'route'
            : layer.source.startsWith('trail-seg-')
        }
        return slot === 'segments-handles' && layer.type === 'circle' && layer.source === 'segment-handles'
      })
      .map(layer => layer.id)
  }
  return getGraphSlotLayerIds(preset, slot).filter(id => Boolean(map.getLayer(id)))
}

function featureAnchor(feature: MapGeoJSONFeature, clickLngLat: { lng: number; lat: number }): [number, number] {
  const geometry = feature.geometry
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    return [Number(geometry.coordinates[0]), Number(geometry.coordinates[1])]
  }
  return [clickLngLat.lng, clickLngLat.lat]
}

function buildSelection(
  slot: LayerSlot,
  feature: MapGeoJSONFeature,
  clickLngLat: { lng: number; lat: number },
  config: StyleConfig,
): MapElementSelection {
  const properties = (feature.properties ?? {}) as Record<string, unknown>
  const lngLat = featureAnchor(feature, clickLngLat)

  if (slot === 'segments-handles') {
    const sourceId = typeof feature.source === 'string' ? feature.source : ''
    const segmentId = sourceId.startsWith('trail-seg-')
      ? sourceId.slice('trail-seg-'.length)
      // Endpoint dots live on the shared 'segment-handles' source; their
      // features carry the owning segment id as `seg_id` (set in trail.ts).
      : typeof properties.seg_id === 'string' && properties.seg_id
        ? properties.seg_id
        : null
    const segment = segmentId ? (config.trail_segments ?? []).find(s => s.id === segmentId) : undefined
    return {
      domain: 'map',
      slot,
      featureKey: segmentId,
      displayName: segment?.name?.trim() || 'Trail segment',
      lngLat,
      properties,
    }
  }

  if (slot === 'route') {
    return {
      domain: 'map',
      slot,
      featureKey: null,
      displayName: config.trail_name?.trim() || 'Route',
      lngLat,
      properties,
    }
  }

  const rmId = typeof properties.rm_id === 'string' || typeof properties.rm_id === 'number'
    ? String(properties.rm_id)
    : null
  const name = typeof properties.name === 'string' && properties.name.trim()
    ? properties.name.trim()
    : 'Map label'
  return { domain: 'map', slot, featureKey: rmId, displayName: name, lngLat, properties }
}

export function useMapElementSelection(options: {
  getMap: () => MapLibreMap | null
  getStyleConfig: () => StyleConfig
  /** FLAGS.EDITOR_V2 && editable surface. False = never attaches, never selects. */
  enabled: () => boolean
  /** Frozen map without an active draw/plot/brush mode = selection mode. */
  selectionModeActive: () => boolean
}) {
  const selection = shallowRef<MapElementSelection | null>(null)
  let attachedMap: MapLibreMap | null = null

  function clearSelection() {
    selection.value = null
  }

  /**
   * Programmatically select a trail segment (post-split reselection, label
   * double-click rename). App-owned gesture — bypasses hit-testing but honors
   * the enabled gate so flag-off behavior is untouched.
   */
  function selectSegment(segmentId: string, lngLat: [number, number]) {
    if (!options.enabled()) return
    const config = options.getStyleConfig()
    const segment = (config.trail_segments ?? []).find(s => s.id === segmentId)
    if (!segment) return
    selection.value = {
      domain: 'map',
      slot: 'segments-handles',
      featureKey: segmentId,
      displayName: segment.name?.trim() || 'Trail segment',
      lngLat,
      properties: {},
    }
  }

  function hitTest(map: MapLibreMap, e: MapMouseEvent): MapElementSelection | null {
    const config = options.getStyleConfig()
    const selectableSlots = getSelectableLayerSlots(config.preset)
    const bbox: [[number, number], [number, number]] = [
      [e.point.x - HIT_TOLERANCE_PX, e.point.y - HIT_TOLERANCE_PX],
      [e.point.x + HIT_TOLERANCE_PX, e.point.y + HIT_TOLERANCE_PX],
    ]
    for (const slot of MAP_SELECTION_HIT_PRIORITY) {
      if (!selectableSlots[slot]) continue
      const layerIds = liveLayerIdsForSlot(map, config.preset, slot)
      if (!layerIds.length) continue
      const features = map.queryRenderedFeatures(bbox, { layers: layerIds })
      if (features.length) return buildSelection(slot, features[0], e.lngLat, config)
    }
    return null
  }

  function onMapClick(e: MapMouseEvent) {
    if (!options.enabled() || !options.selectionModeActive()) return
    const map = options.getMap()
    if (!map) return
    // Empty-map clicks return null → selection clears (spec).
    selection.value = hitTest(map, e)
  }

  function attachToMap() {
    if (!options.enabled()) return
    const map = options.getMap()
    if (!map || map === attachedMap) return
    detachFromMap()
    attachedMap = map
    map.on('click', onMapClick)
  }

  function detachFromMap() {
    if (attachedMap) {
      try {
        attachedMap.off('click', onMapClick)
      } catch {
        // Map may already be destroyed — nothing to detach.
      }
      attachedMap = null
    }
    clearSelection()
  }

  onScopeDispose(detachFromMap)

  return { selection, clearSelection, selectSegment, attachToMap, detachFromMap }
}
