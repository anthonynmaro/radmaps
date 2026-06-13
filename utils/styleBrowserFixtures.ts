import type { RouteStats } from '~/types'
import archetypeManifest from './themes/routeArchetypes.json'

// Dev-only fixture data for pages/style-browser-fixture.vue and the theme
// capture tooling (scripts/capture-theme-audit.mjs --matrix). This module is
// NOT production behavior: the fixture page 404s outside dev, and nothing in
// app code imports these regions.

export interface SampleRegionFixture {
  title: string
  location: string
  bbox: [number, number, number, number]
  route: number[][]
  stats?: Partial<RouteStats>
}

export interface RouteArchetype {
  id: string
  label: string
  stresses: string
}

/**
 * Route archetypes for the theme review matrix: one entry per customer data
 * shape we grade every theme against. Each id is also a SAMPLE_REGIONS key.
 * Source of truth is utils/themes/routeArchetypes.json so the plain-node
 * capture script can read the same manifest without a TS loader.
 */
export const ARCHETYPES: RouteArchetype[] = archetypeManifest

const BASE_REGIONS = {
  chicago: {
    title: 'Kickapoo Endurance Race',
    location: 'Chicago, Illinois',
    bbox: [-87.75, 41.83, -87.58, 41.92],
    stats: { distance_km: 30.7, elevation_gain_m: 96, elevation_loss_m: 92, min_elevation_m: 176, max_elevation_m: 226 },
    route: [
      [-87.733, 41.905],
      [-87.71, 41.91],
      [-87.698, 41.89],
      [-87.682, 41.898],
      [-87.664, 41.875],
      [-87.647, 41.884],
      [-87.628, 41.861],
      [-87.609, 41.875],
      [-87.592, 41.842],
    ],
  },
  whitney: {
    title: 'Mount Whitney',
    location: 'Sierra Nevada, California',
    bbox: [-118.37, 36.51, -118.17, 36.69],
    stats: { distance_km: 34.6, elevation_gain_m: 1910, elevation_loss_m: 1910, min_elevation_m: 2550, max_elevation_m: 4418 },
    route: [
      [-118.333, 36.592],
      [-118.315, 36.602],
      [-118.295, 36.609],
      [-118.280, 36.617],
      [-118.268, 36.610],
      [-118.276, 36.598],
      [-118.284, 36.580],
      [-118.276, 36.562],
      [-118.254, 36.548],
      [-118.226, 36.540],
      [-118.202, 36.539],
    ],
  },
  rainier: {
    title: 'Wonderland',
    location: 'Mount Rainier, Washington',
    bbox: [-121.95, 46.72, -121.58, 46.98],
    stats: { distance_km: 149.7, elevation_gain_m: 4331, elevation_loss_m: 4331, min_elevation_m: 730, max_elevation_m: 2085 },
    route: [
      [-121.840, 46.802],
      [-121.805, 46.828],
      [-121.758, 46.858],
      [-121.705, 46.890],
      [-121.640, 46.918],
      [-121.622, 46.900],
      [-121.692, 46.870],
      [-121.760, 46.840],
      [-121.824, 46.770],
    ],
  },
  'rainier-riso': {
    title: 'Wonderland',
    location: 'Mount Rainier, Washington',
    bbox: [-121.95, 46.72, -121.58, 46.98],
    stats: { distance_km: 149.7, elevation_gain_m: 4331, elevation_loss_m: 4331, min_elevation_m: 730, max_elevation_m: 2085 },
    route: [
      [-121.840, 46.875],
      [-121.780, 46.902],
      [-121.685, 46.924],
      [-121.624, 46.919],
      [-121.646, 46.904],
      [-121.756, 46.872],
      [-121.838, 46.802],
    ],
  },
  'whitney-blueprint': {
    title: 'Mount Whitney',
    location: 'Sierra Nevada, California',
    bbox: [-118.34, 36.475, -118.215, 36.635],
    stats: { distance_km: 35.4, elevation_gain_m: 1910, elevation_loss_m: 1910, min_elevation_m: 2550, max_elevation_m: 4418 },
    route: [
      [-118.350, 36.540],
      [-118.338, 36.548],
      [-118.322, 36.552],
      [-118.305, 36.548],
      [-118.288, 36.535],
      [-118.272, 36.515],
      [-118.260, 36.497],
      [-118.254, 36.482],
      [-118.249, 36.480],
      [-118.245, 36.488],
      [-118.247, 36.516],
      [-118.250, 36.543],
      [-118.247, 36.566],
      [-118.240, 36.590],
      [-118.257, 36.604],
    ],
  },
  dolomites: {
    title: 'Tre Cime',
    location: 'Dolomiti, Italia',
    bbox: [12.18, 46.54, 12.42, 46.72],
    stats: { distance_km: 10.5, elevation_gain_m: 740, elevation_loss_m: 740, min_elevation_m: 1960, max_elevation_m: 2455 },
    route: [
      [12.217, 46.6186],
      [12.234, 46.642],
      [12.250, 46.674],
      [12.270, 46.690],
      [12.294, 46.662],
      [12.318, 46.625],
      [12.348, 46.588],
      [12.386, 46.602],
      [12.350, 46.574],
      [12.306, 46.562],
      [12.282, 46.585],
    ],
  },
  'dolomites-copper': {
    title: 'Tre Cime',
    location: 'Dolomiti, Italia',
    bbox: [12.18, 46.54, 12.42, 46.72],
    stats: { distance_km: 10.5, elevation_gain_m: 740, elevation_loss_m: 740, min_elevation_m: 1960, max_elevation_m: 2455 },
    route: [
      [12.213, 46.582],
      [12.226, 46.588],
      [12.246, 46.593],
      [12.267, 46.592],
      [12.288, 46.588],
      [12.270, 46.585],
      [12.244, 46.586],
      [12.224, 46.584],
      [12.215, 46.581],
      [12.236, 46.578],
      [12.265, 46.577],
      [12.294, 46.572],
      [12.323, 46.562],
      [12.345, 46.548],
      [12.358, 46.553],
      [12.369, 46.574],
      [12.383, 46.595],
      [12.397, 46.612],
    ],
  },
  moab: {
    title: 'Moab',
    location: 'Sand Flats, Utah',
    bbox: [-109.65, 38.49, -109.42, 38.66],
    stats: { distance_km: 24.2, elevation_gain_m: 530, elevation_loss_m: 530, min_elevation_m: 1220, max_elevation_m: 1635 },
    route: [
      [-109.604, 38.548],
      [-109.575, 38.568],
      [-109.562, 38.602],
      [-109.535, 38.628],
      [-109.494, 38.618],
      [-109.474, 38.586],
      [-109.507, 38.556],
      [-109.553, 38.535],
    ],
  },
  napa: {
    title: 'Napa Valley',
    location: 'Calistoga · Napa · California',
    bbox: [-122.68, 38.42, -122.34, 38.78],
    stats: { distance_km: 35.6, elevation_gain_m: 320, elevation_loss_m: 315, min_elevation_m: 35, max_elevation_m: 235 },
    route: [
      [-122.618, 38.718],
      [-122.570, 38.684],
      [-122.540, 38.642],
      [-122.497, 38.596],
      [-122.470, 38.550],
      [-122.438, 38.492],
    ],
  },
  boston: {
    title: 'Boston',
    location: 'Boston, Massachusetts',
    bbox: [-71.13, 42.32, -71.03, 42.39],
    stats: { distance_km: 42.1648, elevation_gain_m: 265, elevation_loss_m: 260, min_elevation_m: 0, max_elevation_m: 75 },
    route: [
      [-71.0656, 42.3554],
      [-71.0785, 42.3496],
      [-71.1016, 42.3489],
      [-71.1229, 42.3528],
      [-71.1175, 42.3663],
      [-71.1052, 42.3744],
      [-71.0869, 42.3796],
      [-71.0713, 42.3717],
      [-71.0591, 42.3810],
      [-71.0452, 42.3702],
      [-71.0392, 42.3561],
      [-71.0496, 42.3414],
      [-71.0643, 42.3339],
      [-71.0831, 42.3312],
      [-71.0965, 42.3410],
      [-71.0880, 42.3517],
      [-71.0758, 42.3606],
      [-71.0629, 42.3662],
      [-71.0656, 42.3554],
    ],
  },
  scotland: {
    title: 'The Cobbler',
    location: 'Argyll, Scotland',
    bbox: [-4.86, 56.15, -4.70, 56.29],
    stats: { distance_km: 12.4, elevation_gain_m: 950, elevation_loss_m: 950, min_elevation_m: 20, max_elevation_m: 884 },
    route: [
      [-4.815, 56.182],
      [-4.792, 56.197],
      [-4.775, 56.218],
      [-4.768, 56.242],
      [-4.748, 56.263],
      [-4.724, 56.254],
    ],
  },
  cdmx: {
    title: 'Centro Histórico',
    location: 'Mexico City, Mexico',
    bbox: [-99.158, 19.420, -99.115, 19.452],
    stats: { distance_km: 7.2, elevation_gain_m: 54, elevation_loss_m: 48, min_elevation_m: 2230, max_elevation_m: 2260 },
    route: [
      [-99.151, 19.432],
      [-99.144, 19.438],
      [-99.136, 19.435],
      [-99.130, 19.441],
      [-99.123, 19.436],
    ],
  },
  banff: {
    title: 'Banff Ridge Traverse',
    location: 'Banff, Alberta',
    bbox: [-115.66, 51.14, -115.49, 51.23],
    route: [
      [-115.625, 51.158],
      [-115.600, 51.168],
      [-115.574, 51.181],
      [-115.548, 51.193],
      [-115.522, 51.205],
    ],
  },
  mexico: {
    title: 'Volcanic Valley Run',
    location: 'Mexico City, Mexico',
    bbox: [-99.19, 19.40, -99.07, 19.47],
    route: [
      [-99.176, 19.412],
      [-99.154, 19.422],
      [-99.132, 19.434],
      [-99.110, 19.446],
      [-99.086, 19.456],
    ],
  },
  patagonia: {
    title: 'Torres del Paine W Trek',
    location: 'Patagonia, Chile',
    bbox: [-73.18, -51.08, -72.75, -50.88],
    route: [
      [-73.139, -50.964],
      [-73.071, -50.976],
      [-73.006, -50.944],
      [-72.941, -50.970],
      [-72.870, -50.927],
      [-72.792, -50.942],
    ],
  },
  camino: {
    title: 'Camino Frances',
    location: 'Northern Spain',
    bbox: [-2.55, 42.38, -1.55, 42.9],
    route: [
      [-1.644, 42.812],
      [-1.814, 42.672],
      [-2.031, 42.672],
      [-2.192, 42.552],
      [-2.445, 42.466],
    ],
  },
  fuji: {
    title: 'Mount Fuji Ascent',
    location: 'Fuji-Hakone, Japan',
    bbox: [138.62, 35.28, 138.84, 35.46],
    stats: { distance_km: 12.8, elevation_gain_m: 1460, elevation_loss_m: 320, min_elevation_m: 720, max_elevation_m: 3776 },
    route: [
      [138.731, 35.365],
      [138.727, 35.377],
      [138.724, 35.389],
      [138.728, 35.401],
      [138.735, 35.412],
      [138.742, 35.421],
    ],
  },
  newzealand: {
    title: 'Queenstown High Country',
    location: 'Queenstown, New Zealand',
    bbox: [168.55, -45.10, 168.78, -44.94],
    route: [
      [168.594, -45.046],
      [168.622, -45.031],
      [168.653, -45.010],
      [168.684, -44.989],
      [168.724, -44.965],
    ],
  },
} satisfies Record<string, SampleRegionFixture>

/**
 * Archetype fixtures for the theme review matrix. Keys match the ids in
 * utils/themes/routeArchetypes.json.
 *
 * - mountain-loop: new closed-loop Wonderland circuit (the existing `rainier`
 *   fixtures are open lines, so a genuinely closed alpine loop was added; it
 *   reuses the rainier bbox/title/location/stats).
 * - flat-marathon: true alias of the existing `boston` marathon loop fixture.
 * - thru-hike: new ~25-point Sierra crest point-to-point section, >80 km.
 * - place-only: new place fixture with no route line and zeroed
 *   distance/elevation stats (the data contract classifies this as
 *   purpose `place` and drops route-only slots).
 */
export const ARCHETYPE_REGIONS: Record<string, SampleRegionFixture> = {
  'archetype-mountain-loop': {
    title: 'Wonderland',
    location: 'Mount Rainier, Washington',
    bbox: [-121.95, 46.72, -121.58, 46.98],
    stats: { distance_km: 149.7, elevation_gain_m: 4331, elevation_loss_m: 4331, min_elevation_m: 730, max_elevation_m: 2085 },
    route: [
      [-121.840, 46.802],
      [-121.880, 46.853],
      [-121.846, 46.906],
      [-121.760, 46.930],
      [-121.668, 46.915],
      [-121.624, 46.862],
      [-121.642, 46.806],
      [-121.706, 46.770],
      [-121.778, 46.762],
      [-121.826, 46.778],
      [-121.840, 46.802],
    ],
  },
  'archetype-flat-marathon': BASE_REGIONS.boston,
  'archetype-thru-hike': {
    title: 'John Muir Corridor',
    location: 'Sierra Nevada, California',
    bbox: [-119.42, 37.17, -118.82, 37.94],
    stats: {
      distance_km: 96.6,
      elevation_gain_m: 4870,
      elevation_loss_m: 4690,
      min_elevation_m: 2320,
      max_elevation_m: 3690,
      duration_seconds: 244_800,
    },
    route: [
      [-119.358, 37.876],
      [-119.338, 37.852],
      [-119.310, 37.828],
      [-119.270, 37.806],
      [-119.252, 37.776],
      [-119.222, 37.752],
      [-119.196, 37.722],
      [-119.170, 37.700],
      [-119.152, 37.668],
      [-119.120, 37.648],
      [-119.088, 37.640],
      [-119.072, 37.612],
      [-119.046, 37.586],
      [-119.032, 37.556],
      [-119.012, 37.528],
      [-118.996, 37.498],
      [-118.978, 37.468],
      [-118.962, 37.440],
      [-118.952, 37.408],
      [-118.938, 37.378],
      [-118.920, 37.348],
      [-118.908, 37.318],
      [-118.896, 37.288],
      [-118.886, 37.258],
      [-118.876, 37.230],
    ],
  },
  'archetype-place-only': {
    title: 'Jackson Hole',
    location: 'Teton County, Wyoming',
    bbox: [-110.95, 43.35, -110.55, 43.70],
    stats: {
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      min_elevation_m: 0,
      max_elevation_m: 0,
      duration_seconds: 0,
      location: 'Teton County, Wyoming',
    },
    route: [],
  },
}

export const SAMPLE_REGIONS: Record<string, SampleRegionFixture> = {
  ...BASE_REGIONS,
  ...ARCHETYPE_REGIONS,
}
