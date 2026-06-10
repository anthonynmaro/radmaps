import coverageTargetsJson from '../atlas/coverage-targets.json'
import { DEFAULT_STYLE_CONFIG, type AtlasOutdoorRouteActivity, type PrintSize, type StyleConfig, type TrailMap } from '../types'

export type AtlasPrintQaBbox = [number, number, number, number]

export interface AtlasPrintQaFixture {
  id: string
  targetId: string
  targetLabel: string
  label: string
  activity: string
  printSize: PrintSize
  bbox: AtlasPrintQaBbox
}

interface CoverageTargetFixture {
  label: string
  activity: string
  printSize: PrintSize
  bbox: AtlasPrintQaBbox
}

interface CoverageTarget {
  id: string
  label: string
  qaFixtures: CoverageTargetFixture[]
}

interface CoverageTargetsFile {
  targets: CoverageTarget[]
}

const coverageTargets = coverageTargetsJson as unknown as CoverageTargetsFile

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function assertBbox(bbox: unknown, label: string): asserts bbox is AtlasPrintQaBbox {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error(`Atlas print QA fixture "${label}" must define a numeric bbox`)
  }
  const [west, south, east, north] = bbox
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    throw new Error(`Atlas print QA fixture "${label}" has an invalid bbox`)
  }
}

function routeForBbox(bbox: AtlasPrintQaBbox): number[][] {
  const [west, south, east, north] = bbox
  const width = east - west
  const height = north - south
  return [
    [west + width * 0.15, south + height * 0.18],
    [west + width * 0.30, south + height * 0.42],
    [west + width * 0.48, south + height * 0.35],
    [west + width * 0.66, south + height * 0.62],
    [west + width * 0.84, south + height * 0.78],
  ]
}

function routeDistanceKm(route: number[][]) {
  let distance = 0
  for (let index = 1; index < route.length; index += 1) {
    const [lng1, lat1] = route[index - 1]
    const [lng2, lat2] = route[index]
    const meanLat = ((lat1 + lat2) / 2) * Math.PI / 180
    const dx = (lng2 - lng1) * Math.cos(meanLat) * 111.32
    const dy = (lat2 - lat1) * 110.57
    distance += Math.sqrt(dx * dx + dy * dy)
  }
  return Math.round(distance * 10) / 10
}

function outdoorActivities(activity: string): AtlasOutdoorRouteActivity[] {
  if (activity === 'mountain-biking') return ['mountain-biking']
  if (activity === 'cycling') return ['cycling']
  if (activity === 'bikepacking') return ['bikepacking', 'cycling']
  if (activity === 'hiking') return ['hiking']
  return ['hiking', 'cycling', 'mountain-biking', 'bikepacking']
}

export function atlasPrintQaFixtures(): AtlasPrintQaFixture[] {
  return coverageTargets.targets.flatMap(target => target.qaFixtures.map((fixture) => {
    assertBbox(fixture.bbox, `${target.id}/${fixture.label}`)
    return {
      id: `${target.id}-${slugify(fixture.label)}`,
      targetId: target.id,
      targetLabel: target.label,
      label: fixture.label,
      activity: fixture.activity,
      printSize: fixture.printSize,
      bbox: fixture.bbox,
    }
  }))
}

export function findAtlasPrintQaFixture(id: string) {
  return atlasPrintQaFixtures().find(fixture => fixture.id === id) ?? null
}

export function buildAtlasPrintQaPayload(id: string): {
  fixture: AtlasPrintQaFixture
  map: TrailMap
  styleConfig: StyleConfig
} {
  const fixture = findAtlasPrintQaFixture(id)
  if (!fixture) throw new Error(`Unknown Atlas print QA fixture: ${id}`)
  const route = routeForBbox(fixture.bbox)
  const distanceKm = routeDistanceKm(route)
  const activities = outdoorActivities(fixture.activity)
  const styleConfig: StyleConfig = {
    ...DEFAULT_STYLE_CONFIG,
    preset: 'radmaps-field-topo',
    color_theme: 'field-journal',
    composition: 'editorial-tall',
    print_size: fixture.printSize,
    trail_name: fixture.label,
    location_text: fixture.targetLabel,
    occasion_text: `${fixture.activity.toUpperCase()} / ATLAS PRINT QA`,
    show_contours: true,
    show_hillshade: false,
    show_roads: true,
    show_place_labels: true,
    show_poi_labels: true,
    show_start_pin: true,
    show_finish_pin: true,
    map_frozen: true,
    atlas_layers: {
      contour: true,
      water: true,
      waterway: true,
      park: true,
      landcover: true,
      transportation: true,
      outdoorRoute: true,
      building: true,
      place: true,
      poi: true,
    },
    atlas_layer_settings: {
      transportation: {
        density: 'detailed',
        show_major: true,
        show_minor: true,
        show_trails: true,
        opacity: 0.9,
        major_width: 3.2,
        minor_width: 1.4,
        trail_width: 1.5,
        labels: true,
      },
      outdoorRoute: {
        density: 'detailed',
        activities,
        opacity: 0.86,
        width: fixture.activity === 'mountain-biking' ? 2.8 : 2.2,
        labels: true,
        label_opacity: 0.78,
      },
      poi: {
        density: 'balanced',
        labels: true,
        label_opacity: 0.72,
        icon_opacity: 0.8,
      },
      place: {
        label_opacity: 0.82,
      },
    },
  }

  const map: TrailMap = {
    id: `atlas-print-qa-${fixture.id}`,
    user_id: 'atlas-print-qa',
    title: fixture.label,
    subtitle: fixture.targetLabel,
    geojson: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route,
        },
      }],
    },
    bbox: fixture.bbox,
    stats: {
      distance_km: distanceKm,
      elevation_gain_m: Math.max(120, Math.round(distanceKm * 42)),
      elevation_loss_m: Math.max(90, Math.round(distanceKm * 37)),
      min_elevation_m: 80,
      max_elevation_m: Math.max(350, Math.round(distanceKm * 22)),
      date: '2026-06-10',
      location: fixture.targetLabel,
    },
    style_config: styleConfig,
    status: 'draft',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
  }

  return {
    fixture,
    map,
    styleConfig,
  }
}
