import { distanceMeters, getAllRouteCoords } from './trail'

export type TransitPoint = { x: number, y: number }
export type TransitBbox = [number, number, number, number]

export function sampleRouteByDistance(coords: number[][], count: number): number[][] {
  if (coords.length <= count) return coords.map(coord => coord.slice())

  const distances = [0]
  for (let i = 1; i < coords.length; i++) {
    distances[i] = distances[i - 1] + distanceMeters(coords[i - 1], coords[i])
  }
  const total = distances[distances.length - 1] || 0
  if (!total) return [coords[0].slice(), coords[coords.length - 1].slice()]

  const sampled: number[][] = []
  for (let i = 0; i < count; i++) {
    const target = (total * i) / Math.max(count - 1, 1)
    const idx = distances.findIndex(distance => distance >= target)
    if (idx <= 0) {
      sampled.push(coords[0].slice())
      continue
    }
    const prev = coords[idx - 1]
    const next = coords[idx]
    const span = distances[idx] - distances[idx - 1]
    const t = span ? (target - distances[idx - 1]) / span : 0
    sampled.push([
      prev[0] + ((next[0] - prev[0]) * t),
      prev[1] + ((next[1] - prev[1]) * t),
      prev[2] != null || next[2] != null
        ? (prev[2] ?? next[2] ?? 0) + (((next[2] ?? prev[2] ?? 0) - (prev[2] ?? next[2] ?? 0)) * t)
        : undefined,
    ].filter(value => value != null) as number[])
  }
  return sampled
}

export function normalizeRoutePoint(coord: number[], bbox: TransitBbox): TransitPoint {
  const [minLng, minLat, maxLng, maxLat] = bbox
  const lngSpan = Math.max(0.000001, maxLng - minLng)
  const latSpan = Math.max(0.000001, maxLat - minLat)
  return {
    x: (coord[0] - minLng) / lngSpan,
    y: (maxLat - coord[1]) / latSpan,
  }
}

export function denormalizeRoutePoint(point: TransitPoint, bbox: TransitBbox): number[] {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return [
    minLng + ((maxLng - minLng) * point.x),
    maxLat - ((maxLat - minLat) * point.y),
  ]
}

export function fitDiagramPointsToRouteBounds(points: TransitPoint[], target: TransitPoint[]): TransitPoint[] {
  const frameMin = 0.02
  const frameMax = 0.98
  const frameSpan = frameMax - frameMin
  const extents = (items: TransitPoint[]) => ({
    minX: Math.min(...items.map(point => point.x)),
    maxX: Math.max(...items.map(point => point.x)),
    minY: Math.min(...items.map(point => point.y)),
    maxY: Math.max(...items.map(point => point.y)),
  })
  const from = extents(points)
  const to = extents(target)
  const fromW = Math.max(0.001, from.maxX - from.minX)
  const fromH = Math.max(0.001, from.maxY - from.minY)
  const toW = Math.max(0.001, to.maxX - to.minX)
  const toH = Math.max(0.001, to.maxY - to.minY)
  const scale = Math.min(toW / fromW, toH / fromH, frameSpan / fromW, frameSpan / fromH) || 1
  const fromCx = (from.minX + from.maxX) / 2
  const fromCy = (from.minY + from.maxY) / 2
  const halfW = (fromW * scale) / 2
  const halfH = (fromH * scale) / 2
  const toCx = Math.min(frameMax - halfW, Math.max(frameMin + halfW, (to.minX + to.maxX) / 2))
  const toCy = Math.min(frameMax - halfH, Math.max(frameMin + halfH, (to.minY + to.maxY) / 2))
  return points.map(point => ({
    x: toCx + ((point.x - fromCx) * scale),
    y: toCy + ((point.y - fromCy) * scale),
  }))
}

export function buildTransitDiagramGeojson(
  source: GeoJSON.FeatureCollection,
  bbox?: TransitBbox | null,
): GeoJSON.FeatureCollection {
  const coords = getAllRouteCoords(source)
  if (coords.length < 2 || !bbox) return source

  const stationCount = Math.min(7, Math.max(5, coords.length <= 12 ? coords.length : Math.round(Math.sqrt(coords.length) * 1.8)))
  const samples = sampleRouteByDistance(coords, stationCount)
  const normalized = samples.map(coord => normalizeRoutePoint(coord, bbox))
  const diagram = [normalized[0]]

  for (let i = 1; i < normalized.length; i++) {
    const prev = diagram[diagram.length - 1]
    const rawPrev = normalized[i - 1]
    const rawNext = normalized[i]
    const dx = rawNext.x - rawPrev.x
    const dy = rawNext.y - rawPrev.y
    const len = Math.max(0.035, Math.hypot(dx, dy))
    const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    diagram.push({
      x: prev.x + (Math.cos(snapped) * len),
      y: prev.y + (Math.sin(snapped) * len),
    })
  }

  const fitted = fitDiagramPointsToRouteBounds(diagram, normalized)
  const coordinates = fitted.map(point => denormalizeRoutePoint(point, bbox))
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { radmaps_transit_diagram: true },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    }],
  }
}

export function buildTransitStationGeojson(routeGeojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const coords = getAllRouteCoords(routeGeojson)
  const labels = ['START', 'RIDGE', 'OVERLOOK', 'CELLAR', 'VINEYARD', 'SUMMIT', 'FINISH']
  return {
    type: 'FeatureCollection',
    features: coords.map((coord, index) => ({
      type: 'Feature',
      properties: {
        label: index === 0 ? 'START' : index === coords.length - 1 ? 'FINISH' : (labels[index] ?? `STOP ${String(index + 1).padStart(2, '0')}`),
        terminal: index === 0 || index === coords.length - 1,
        secondary: index > 0 && index < coords.length - 1 && index % 2 === 0,
      },
      geometry: { type: 'Point', coordinates: coord },
    })),
  }
}
