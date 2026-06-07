import type { StyleConfig } from '~/types'
import { shouldRenderPrimaryRoute } from '~/utils/mapStyle'
import { getAllRouteCoords } from '~/utils/trail'

export function hasRenderableRouteGeometry(geojson?: GeoJSON.FeatureCollection | null): boolean {
  return getAllRouteCoords(geojson ?? { type: 'FeatureCollection', features: [] }).length > 1
}

export function shouldExpectPrimaryRouteContent(
  config: Pick<StyleConfig, 'trail_segments' | 'show_primary_route'>,
  geojson?: GeoJSON.FeatureCollection | null,
): boolean {
  return shouldRenderPrimaryRoute(config) && hasRenderableRouteGeometry(geojson)
}
