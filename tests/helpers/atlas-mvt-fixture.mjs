/**
 * Synthetic MVT tile builder for atlas feature-id tests. Encodes with the
 * same libraries the pipeline uses (geojson-vt + vt-pbf) so fixtures resemble
 * real Planetiler output: one uncompressed MVT buffer per tile, multiple
 * named layers, extent 4096.
 */
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'

export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z
  const latRad = (lat * Math.PI) / 180
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
  }
}

export function pointFeature(lon, lat, properties) {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } }
}

export function lineFeature(coordinates, properties) {
  return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates } }
}

export function polygonFeature(coordinates, properties) {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates } }
}

/**
 * Build one uncompressed MVT tile buffer at z/x/y from
 * { layerName: GeoJSON Feature[] }. Layers that clip to empty are omitted.
 */
export function buildTileBuffer(layers, z, x, y) {
  const tileLayers = {}
  for (const [name, features] of Object.entries(layers)) {
    const index = geojsonvt(
      { type: 'FeatureCollection', features },
      { maxZoom: z, indexMaxZoom: z, extent: 4096, buffer: 64, tolerance: 0 },
    )
    const tile = index.getTile(z, x, y)
    if (tile && tile.features.length) tileLayers[name] = tile
  }
  return Buffer.from(vtpbf.fromGeojsonVt(tileLayers))
}
