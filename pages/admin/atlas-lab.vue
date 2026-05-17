<template>
  <AdminShell title="Atlas Lab" :allow-local-preview="true">
    <div class="space-y-6">
      <section class="rounded-lg border border-stone-200 bg-white p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-sm font-semibold text-stone-900">RadMaps owned atlas PMTiles</p>
            <p class="mt-2 text-sm leading-6 text-stone-600">
              Real Planetiler PMTiles rendered locally through MapLibre. One vector tile archive feeds multiple RadMaps
              art directions so we can tune print styles without duplicating geography or vendor calls.
            </p>
          </div>
          <NuxtLink to="/admin/map-tools" class="admin-secondary">
            Map Tools Catalog
          </NuxtLink>
        </div>
      </section>

      <section class="rounded-lg border border-stone-200 bg-white p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-sm font-semibold text-stone-900">US showcase window</p>
            <p class="mt-1 text-xs leading-5 text-stone-600">
              Jump the same owned PMTiles archive across sellable regions and compare every house style against live vector tiles.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="showcase in showcases"
              :key="showcase.id"
              type="button"
              class="showcase-button"
              :class="{ 'showcase-button--active': showcase.id === activeShowcaseId }"
              @click="setActiveShowcase(showcase.id)"
            >
              {{ showcase.name }}
            </button>
          </div>
        </div>
      </section>

      <section class="grid gap-5 xl:grid-cols-2">
        <article
          v-for="style in styles"
          :key="style.id"
          class="atlas-style-card overflow-hidden rounded-lg border border-stone-200 bg-white"
          :class="`atlas-style-card--${style.id}`"
        >
          <div class="grid gap-0 lg:grid-cols-[1fr_300px]">
            <div class="relative h-[390px] bg-stone-100">
              <div :ref="(el) => setMapEl(style.id, el)" class="atlas-map-shell" />
              <div v-if="style.id === 'radmaps-watercolor-wash'" class="watercolor-art-overlay">
                <span class="watercolor-bloom watercolor-bloom--blue" />
                <span class="watercolor-bloom watercolor-bloom--green" />
                <span class="watercolor-bloom watercolor-bloom--ochre" />
                <span class="watercolor-bloom watercolor-bloom--rose" />
              </div>
              <div class="pointer-events-none absolute left-3 top-3 rounded-md bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{{ style.preset }}</p>
                <p class="text-sm font-semibold text-stone-900">{{ style.name }}</p>
              </div>
              <div class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 shadow-sm backdrop-blur">
                {{ activeShowcase.name }} - {{ atlasLabel }} - {{ activeShowcase.contourUrl ? 'regional contours z8-14' : atlasCoverageLabel }}
              </div>
              <div
                v-if="mapStatus[style.id]"
                class="pointer-events-none absolute bottom-3 right-3 max-w-[60%] rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 shadow-sm backdrop-blur"
              >
                {{ mapStatus[style.id] }}
              </div>
            </div>

            <div class="border-t border-stone-200 p-4 lg:border-l lg:border-t-0">
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in style.tags"
                  :key="tag"
                  class="rounded-md border border-stone-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500"
                >
                  {{ tag }}
                </span>
              </div>
              <p class="mt-4 text-sm font-semibold text-stone-900">{{ style.name }}</p>
              <p class="mt-2 text-xs leading-5 text-stone-600">{{ style.thesis }}</p>
              <div class="mt-4 space-y-3">
                <InfoBlock title="Source Layers" :items="style.layers" />
                <InfoBlock title="Print Notes" :items="style.printNotes" />
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, type ComponentPublicInstance, type PropType } from 'vue'
import { PMTiles, Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  createFallbackAtlasManifest,
  resolveAtlasArtifacts as resolveManifestArtifacts,
  type AtlasManifest,
} from '~/utils/atlasManifest'
import { trackAtlasUsageEvent } from '~/utils/atlasUsage'

definePageMeta({ layout: 'default' })

type PaintPalette = {
  background: string
  landcover: string
  landuse: string
  park: string
  water: string
  waterLine: string
  building: string
  roadCasing: string
  road: string
  roadMinor: string
  path: string
  route: string
  routeHalo: string
  label: string
  labelHalo: string
  poi: string
  contour: string
  contourMajor: string
}

type AtlasStyle = {
  id: string
  name: string
  preset: string
  thesis: string
  tags: string[]
  layers: string[]
  printNotes: string[]
  palette: PaintPalette
}

const config = useRuntimeConfig()
const configuredManifestUrl = String(config.public.radmapsAtlasManifestUrl || '')
const configuredAtlasUrl = String(config.public.radmapsAtlasPmtilesUrl || '')
const configuredContourUrl = String(config.public.radmapsContourPmtilesUrl || '')
const localAtlasUrl = '/atlas/radmaps-driftless-planetiler.pmtiles'
const localContourUrl = '/atlas/radmaps-driftless-contours.pmtiles'
const atlasLabel = ref('Driftless / Madison lab pack')
const atlasCoverageLabel = ref('manifest pending')
const maps: Array<{
  style: AtlasStyle
  remove: () => void
  flyTo: (options: { center: [number, number], zoom: number, duration?: number }) => void
  getSource: (id: string) => unknown
  queryRenderedFeatures: (options: { layers: string[] }) => unknown[]
  resize: () => void
  setStyle: (style: unknown) => void
}> = []
const mapEls = new Map<string, HTMLElement>()
const mapStatus = reactive<Record<string, string>>({})

type ShowcaseLocation = {
  id: string
  name: string
  center: [number, number]
  zoom: number
  route: [number, number][]
  contourUrl?: string
}

const showcases: ShowcaseLocation[] = [
  {
    id: 'yosemite',
    name: 'Yosemite',
    center: [-119.573, 37.748],
    zoom: 12.2,
    route: [[-119.628, 37.731], [-119.604, 37.742], [-119.580, 37.754], [-119.557, 37.771], [-119.536, 37.787]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles',
  },
  {
    id: 'rocky-mountain',
    name: 'Rocky Mountain',
    center: [-105.646, 40.325],
    zoom: 12.1,
    route: [[-105.684, 40.310], [-105.666, 40.324], [-105.643, 40.337], [-105.621, 40.352], [-105.603, 40.366]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/rocky-mountain/2026-05-17/radmaps-rocky-mountain-contours.pmtiles',
  },
  {
    id: 'smokies',
    name: 'Smokies',
    center: [-83.507, 35.611],
    zoom: 12.4,
    route: [[-83.548, 35.586], [-83.529, 35.600], [-83.506, 35.616], [-83.487, 35.632], [-83.470, 35.648]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/smokies/2026-05-17/radmaps-smokies-contours.pmtiles',
  },
  {
    id: 'superior',
    name: 'North Shore',
    center: [-91.109, 47.309],
    zoom: 11.9,
    route: [[-91.170, 47.278], [-91.145, 47.295], [-91.117, 47.314], [-91.087, 47.335], [-91.055, 47.354]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/superior/2026-05-17/radmaps-superior-contours.pmtiles',
  },
  {
    id: 'madison',
    name: 'Driftless',
    center: [-89.396, 43.077],
    zoom: 14,
    route: [[-89.430, 43.058], [-89.418, 43.066], [-89.402, 43.075], [-89.387, 43.083], [-89.372, 43.092]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles',
  },
]

const activeShowcaseId = ref(showcases[0].id)
const activeShowcase = computed(() => showcases.find(showcase => showcase.id === activeShowcaseId.value) ?? showcases[0])
let activeBasePmtilesUrl = ''
let defaultContourPmtilesUrl = ''

const styles: AtlasStyle[] = [
  {
    id: 'radmaps-toner',
    name: 'RadMaps Toner',
    preset: 'radmaps-toner',
    thesis: 'Owned high-contrast linework style built from RadMaps vector layers, replacing the toner dependency path.',
    tags: ['owned', 'toner', 'print'],
    layers: ['water', 'landcover', 'transportation', 'building', 'poi', 'place'],
    printNotes: ['crisp black ink', 'label-forward', 'vendor-free art direction'],
    palette: {
      background: '#F7F6F1',
      landcover: '#ECE9E0',
      landuse: '#E4E0D5',
      park: '#DDDCCF',
      water: '#D7DEE0',
      waterLine: '#7A8588',
      building: '#CFC9BC',
      roadCasing: '#F7F6F1',
      road: '#171717',
      roadMinor: '#595959',
      path: '#4B4B4B',
      route: '#111111',
      routeHalo: '#F7F6F1',
      label: '#111111',
      labelHalo: '#F7F6F1',
      poi: '#262626',
      contour: '#9A9488',
      contourMajor: '#59544C',
    },
  },
  {
    id: 'radmaps-field-topo',
    name: 'RadMaps Field Topo',
    preset: 'radmaps-field-topo',
    thesis: 'A print-first house topo with owned vector basemap styling and generated contour hierarchy.',
    tags: ['owned', 'topo', 'terrain'],
    layers: ['contour', 'water', 'waterway', 'park', 'landcover', 'transportation', 'poi', 'place'],
    printNotes: ['contour hierarchy', 'USGS warmth', 'route-forward'],
    palette: {
      background: '#F3EBDD',
      landcover: '#D4D0A8',
      landuse: '#E2D4B8',
      park: '#B6C58E',
      water: '#8AAFC0',
      waterLine: '#5B8FA6',
      building: '#D1C4B1',
      roadCasing: '#F8F0E2',
      road: '#776D61',
      roadMinor: '#A39280',
      path: '#8D6F42',
      route: '#C44F24',
      routeHalo: '#F8F0E2',
      label: '#372A1F',
      labelHalo: '#F3EBDD',
      poi: '#7C6035',
      contour: '#B49772',
      contourMajor: '#6F5436',
    },
  },
  {
    id: 'radmaps-watercolor-wash',
    name: 'RadMaps Watercolor Wash',
    preset: 'radmaps-watercolor-wash',
    thesis: 'Painterly owned map treatment with simplified geography, pigment blooms, softened linework, and paper texture.',
    tags: ['owned', 'watercolor', 'art'],
    layers: ['water', 'park', 'landcover', 'landuse', 'transportation', 'place'],
    printNotes: ['pigment blooms', 'soft linework', 'paper texture'],
    palette: {
      background: '#FBF1DE',
      landcover: '#DED9A8',
      landuse: '#EBC7A7',
      park: '#AFCB86',
      water: '#75B7C9',
      waterLine: '#3E94A9',
      building: '#D8B99C',
      roadCasing: '#FFF6E7',
      road: '#AF705D',
      roadMinor: '#D39A81',
      path: '#7F985F',
      route: '#A84931',
      routeHalo: '#FFF3D8',
      label: '#563526',
      labelHalo: '#FFF7EA',
      poi: '#8C6F3C',
      contour: '#C09368',
      contourMajor: '#91623F',
    },
  },
  {
    id: 'radmaps-night-relief',
    name: 'RadMaps Night Relief',
    preset: 'radmaps-night-relief',
    thesis: 'Dark premium terrain style with owned contours, muted basemap layers, and copper route contrast.',
    tags: ['owned', 'dark', 'relief'],
    layers: ['contour', 'water', 'waterway', 'park', 'landcover', 'transportation', 'building', 'poi', 'place'],
    printNotes: ['premium dark mode', 'terrain drama', 'strong route pop'],
    palette: {
      background: '#151A1D',
      landcover: '#243126',
      landuse: '#242A25',
      park: '#2F4A34',
      water: '#1E5D78',
      waterLine: '#58A4C5',
      building: '#2C3031',
      roadCasing: '#151A1D',
      road: '#8B8073',
      roadMinor: '#555F61',
      path: '#6B7868',
      route: '#F08A46',
      routeHalo: '#101416',
      label: '#F3E8D0',
      labelHalo: '#151A1D',
      poi: '#D6B15F',
      contour: '#39495C',
      contourMajor: '#6C86A4',
    },
  },
  {
    id: 'radmaps-simple-contour',
    name: 'RadMaps Simple Contour',
    preset: 'radmaps-simple-contour',
    thesis: 'A contour-first print product: quiet land, optional context, strong terrain lines, and route clarity for minimal topo posters.',
    tags: ['owned', 'contour', 'minimal'],
    layers: ['contour', 'water', 'park', 'transportation'],
    printNotes: ['contours required', 'roads subdued', 'simple map target'],
    palette: {
      background: '#FAF8F1',
      landcover: '#F1EEE3',
      landuse: '#F4EFE2',
      park: '#E8E6D8',
      water: '#D7E5EA',
      waterLine: '#8AADB8',
      building: '#EEE8DA',
      roadCasing: '#FAF8F1',
      road: '#B9AEA0',
      roadMinor: '#D2CABF',
      path: '#A78F69',
      route: '#BC3D28',
      routeHalo: '#FAF8F1',
      label: '#50463A',
      labelHalo: '#FAF8F1',
      poi: '#9B8B76',
      contour: '#A98F70',
      contourMajor: '#5F4A35',
    },
  },
]

function toAbsoluteUrl(url: string) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
}

function fallbackManifest(): AtlasManifest {
  return createFallbackAtlasManifest({
    baseUrl: configuredAtlasUrl || localAtlasUrl,
    contourUrl: configuredContourUrl || localContourUrl,
    label: 'Driftless / Madison lab pack',
  })
}

async function loadAtlasManifest() {
  const manifestUrl = configuredManifestUrl || '/atlas/manifests/production.json'
  try {
    const response = await fetch(toAbsoluteUrl(manifestUrl), {
      headers: { accept: 'application/json' },
      cache: 'no-cache',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json() as AtlasManifest
  } catch (error) {
    console.warn(`Atlas manifest unavailable, using fallback PMTiles URLs: ${error instanceof Error ? error.message : String(error)}`)
    return fallbackManifest()
  }
}

function resolveAtlasArtifacts(manifest: AtlasManifest) {
  const fallback = fallbackManifest()
  const resolved = resolveManifestArtifacts(manifest, fallback)

  atlasLabel.value = resolved.label
  atlasCoverageLabel.value = resolved.coverageLabel
  return {
    baseUrl: resolved.baseUrl || configuredAtlasUrl || localAtlasUrl,
    contourUrl: resolved.contourUrl || configuredContourUrl || localContourUrl,
  }
}

function setMapEl(id: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) mapEls.set(id, el)
}

function pmtilesSourceUrl(url: string) {
  return `pmtiles://${url}`
}

function contourUrlForShowcase(showcase: ShowcaseLocation) {
  return toAbsoluteUrl(showcase.contourUrl || defaultContourPmtilesUrl)
}

function sampleRouteGeojson(showcase: ShowcaseLocation) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: showcase.route,
        },
      },
    ],
  }
}

function setActiveShowcase(id: string) {
  activeShowcaseId.value = id
  const showcase = activeShowcase.value
  for (const map of maps) {
    map.setStyle(buildStyle(map.style, {
      baseUrl: activeBasePmtilesUrl,
      contourUrl: contourUrlForShowcase(showcase),
    }))
    map.flyTo({ center: showcase.center, zoom: showcase.zoom, duration: 700 })
    requestAnimationFrame(() => map.resize())
  }
}

function buildStyle(style: AtlasStyle, urls: { baseUrl: string, contourUrl: string }) {
  const p = style.palette
  const isToner = style.id === 'radmaps-toner'
  const isTopo = style.id === 'radmaps-field-topo'
  const isWatercolor = style.id === 'radmaps-watercolor-wash'
  const isNight = style.id === 'radmaps-night-relief'
  const isSimpleContour = style.id === 'radmaps-simple-contour'
  const landcoverOpacity = isSimpleContour ? 0.05 : isWatercolor ? 0.16 : isNight ? 0.62 : 0.45
  const landuseOpacity = isSimpleContour ? 0.03 : isWatercolor ? 0.12 : isNight ? 0.50 : 0.34
  const parkOpacity = isSimpleContour ? 0.10 : isWatercolor ? 0.24 : isNight ? 0.62 : 0.55
  const waterOpacity = isSimpleContour ? 0.22 : isWatercolor ? 0.42 : isNight ? 0.86 : 0.92
  const buildingOpacity = isSimpleContour ? 0.02 : isWatercolor ? 0.04 : isNight ? 0.38 : 0.62
  const roadCasingOpacity = isSimpleContour ? 0.08 : isWatercolor ? 0.08 : isNight ? 0.36 : 0.78
  const majorRoadOpacity = isSimpleContour ? 0.16 : isWatercolor ? 0.20 : isNight ? 0.48 : 0.86
  const minorRoadOpacity = isSimpleContour ? 0.04 : isWatercolor ? 0.07 : isNight ? 0.28 : 0.68
  const pathOpacity = isSimpleContour ? 0.24 : isWatercolor ? 0.12 : isNight ? 0.38 : isTopo ? 0.55 : 0.78
  const contourMinorOpacity = isSimpleContour ? 0.52 : isWatercolor ? 0.08 : isNight ? 0.40 : isTopo ? 0.50 : 0.24
  const contourIndexOpacity = isSimpleContour ? 0.76 : isWatercolor ? 0.14 : isNight ? 0.54 : isTopo ? 0.68 : 0.34
  const contourMajorOpacity = isSimpleContour ? 0.92 : isWatercolor ? 0.22 : isNight ? 0.72 : isTopo ? 0.84 : 0.46
  const poiOpacity = isSimpleContour ? 0.02 : isWatercolor ? 0.04 : isNight ? 0.34 : isToner ? 0.22 : 0.28
  const labelOpacity = isSimpleContour ? 0.36 : isWatercolor ? 0.42 : 1

  return {
    version: 8,
    name: style.name,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      atlas: { type: 'vector', url: pmtilesSourceUrl(urls.baseUrl) },
      terrain: { type: 'vector', url: pmtilesSourceUrl(urls.contourUrl) },
      'sample-route': {
        type: 'geojson',
        data: sampleRouteGeojson(activeShowcase.value),
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.background } },
      ...(isWatercolor ? [
        { id: 'landcover-pigment', type: 'fill', source: 'atlas', 'source-layer': 'landcover', paint: { 'fill-color': p.landcover, 'fill-opacity': 0.12, 'fill-translate': ['literal', [-4, 3]] } },
        { id: 'landuse-pigment', type: 'fill', source: 'atlas', 'source-layer': 'landuse', paint: { 'fill-color': p.landuse, 'fill-opacity': 0.10, 'fill-translate': ['literal', [5, -3]] } },
        { id: 'park-pigment', type: 'fill', source: 'atlas', 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': 0.16, 'fill-translate': ['literal', [-6, -2]] } },
        { id: 'water-pigment', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': 0.26, 'fill-translate': ['literal', [4, 4]] } },
      ] : []),
      { id: 'landcover', type: 'fill', source: 'atlas', 'source-layer': 'landcover', paint: { 'fill-color': p.landcover, 'fill-opacity': landcoverOpacity } },
      { id: 'landuse', type: 'fill', source: 'atlas', 'source-layer': 'landuse', paint: { 'fill-color': p.landuse, 'fill-opacity': landuseOpacity } },
      { id: 'park', type: 'fill', source: 'atlas', 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': parkOpacity } },
      { id: 'water-wash', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': isWatercolor ? 0.20 : 0, 'fill-translate': ['literal', isWatercolor ? [-3, 2] : [0, 0]] } },
      { id: 'water', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': waterOpacity } },
      ...(isWatercolor ? [
        { id: 'water-edge-bleed', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': p.waterLine, 'line-opacity': 0.18, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 14, 4.4], 'line-blur': 3.2 } },
      ] : []),
      { id: 'waterway', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': p.waterLine, 'line-opacity': isWatercolor ? 0.22 : 0.72, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, isWatercolor ? 0.35 : 0.45, 14, isWatercolor ? 1.2 : 1.5], 'line-blur': isWatercolor ? 1.1 : 0 } },
      { id: 'building', type: 'fill', source: 'atlas', 'source-layer': 'building', minzoom: isWatercolor ? 13 : 12, paint: { 'fill-color': p.building, 'fill-opacity': buildingOpacity } },
      ...(isWatercolor ? [
        { id: 'road-pigment-major', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]], paint: { 'line-color': p.road, 'line-opacity': 0.12, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.6, 10, 4.0, 14, 7.2], 'line-blur': 4.2, 'line-translate': ['literal', [2, -1]] } },
        { id: 'route-underwash', type: 'line', source: 'sample-route', paint: { 'line-color': p.route, 'line-width': 18, 'line-opacity': 0.12, 'line-blur': 8 } },
      ] : []),
      { id: 'road-casing', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'path', 'track']]], paint: { 'line-color': p.roadCasing, 'line-opacity': roadCasingOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, isWatercolor ? 0.3 : 1.2, 10, isWatercolor ? 0.7 : 2.4, 14, isWatercolor ? 1.6 : 5.4], 'line-blur': isWatercolor ? 2.8 : 0 } },
      { id: 'roads-major', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]], paint: { 'line-color': p.road, 'line-opacity': majorRoadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, isWatercolor ? 0.28 : 0.8, 10, isWatercolor ? 0.6 : 1.6, 14, isWatercolor ? 1.2 : 3.8], 'line-blur': isWatercolor ? 1.6 : 0 } },
      { id: 'roads-minor', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]], paint: { 'line-color': p.roadMinor, 'line-opacity': minorRoadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, isWatercolor ? 0.18 : 0.45, 14, isWatercolor ? 0.58 : 1.6], 'line-blur': isWatercolor ? 1.8 : 0 } },
      { id: 'paths-trails', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]], paint: { 'line-color': p.path, 'line-opacity': pathOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, isWatercolor ? 0.36 : 0.8, 14, isWatercolor ? 0.85 : 2.2], 'line-blur': isWatercolor ? 1.1 : 0, 'line-dasharray': ['literal', isWatercolor ? [0.8, 2.6] : [2, 1.4]] } },
      { id: 'contours-minor', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'minor'], paint: { 'line-color': p.contour, 'line-opacity': contourMinorOpacity, 'line-width': isSimpleContour ? 0.38 : isWatercolor ? 0.22 : 0.45, 'line-blur': isWatercolor ? 1.3 : 0 } },
      { id: 'contours-index', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'index'], paint: { 'line-color': p.contour, 'line-opacity': contourIndexOpacity, 'line-width': isSimpleContour ? 0.74 : isWatercolor ? 0.38 : 0.7, 'line-blur': isWatercolor ? 1.0 : 0 } },
      { id: 'contours-major', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'major'], paint: { 'line-color': p.contourMajor, 'line-opacity': contourMajorOpacity, 'line-width': isSimpleContour ? 1.22 : isWatercolor ? 0.56 : 1.05, 'line-blur': isWatercolor ? 0.8 : 0 } },
      { id: 'poi', type: 'circle', source: 'atlas', 'source-layer': 'poi', minzoom: isWatercolor ? 16 : 15, paint: { 'circle-color': p.poi, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 1.1, 17, 2.6], 'circle-opacity': poiOpacity, 'circle-stroke-color': p.labelHalo, 'circle-stroke-width': isWatercolor ? 0.35 : 0.7 } },
      { id: 'place-labels', type: 'symbol', source: 'atlas', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': [isWatercolor ? 'Open Sans Regular' : 'Open Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, isWatercolor ? 9 : 10, 11, isWatercolor ? 12 : 14, 14, isWatercolor ? 15 : 17], 'text-letter-spacing': isWatercolor ? 0.01 : 0.02 }, paint: { 'text-color': p.label, 'text-opacity': labelOpacity, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.8 : 1.4, 'text-halo-blur': isWatercolor ? 0.7 : 0.25 } },
      { id: 'road-labels', type: 'symbol', source: 'atlas', 'source-layer': 'transportation_name', minzoom: isWatercolor ? 14 : 12, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Open Sans Regular'], 'text-size': isWatercolor ? 9 : 10 }, paint: { 'text-color': p.label, 'text-opacity': isWatercolor ? 0.36 : 0.86, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.7 : 1.2, 'text-halo-blur': isWatercolor ? 0.8 : 0.2 } },
      { id: 'sample-route-casing', type: 'line', source: 'sample-route', paint: { 'line-color': p.routeHalo, 'line-width': isWatercolor ? 8.8 : 7.5, 'line-opacity': isWatercolor ? 0.44 : 0.94, 'line-blur': isWatercolor ? 2.4 : 0 } },
      { id: 'sample-route', type: 'line', source: 'sample-route', paint: { 'line-color': p.route, 'line-width': isWatercolor ? 4.6 : 4.2, 'line-opacity': isWatercolor ? 0.70 : 0.98, 'line-blur': isWatercolor ? 0.9 : 0 } },
      ...(isWatercolor ? [
        { id: 'route-drybrush', type: 'line', source: 'sample-route', paint: { 'line-color': '#6F2E25', 'line-width': 1.2, 'line-opacity': 0.36, 'line-dasharray': ['literal', [0.7, 1.8]], 'line-translate': ['literal', [1.2, -0.8]] } },
      ] : []),
    ],
  }
}

onMounted(async () => {
  const maplibregl = await import('maplibre-gl')
  const protocol = new Protocol()
  const manifest = await loadAtlasManifest()
  const { baseUrl, contourUrl } = resolveAtlasArtifacts(manifest)
  const pmtilesUrl = toAbsoluteUrl(baseUrl)
  const contourPmtilesUrl = toAbsoluteUrl(contourUrl)
  activeBasePmtilesUrl = pmtilesUrl
  defaultContourPmtilesUrl = contourPmtilesUrl
  protocol.add(new PMTiles(pmtilesUrl))
  if (contourPmtilesUrl) protocol.add(new PMTiles(contourPmtilesUrl))
  for (const showcase of showcases) {
    const showcaseContourUrl = contourUrlForShowcase(showcase)
    if (showcaseContourUrl && showcaseContourUrl !== contourPmtilesUrl) protocol.add(new PMTiles(showcaseContourUrl))
  }
  maplibregl.addProtocol('pmtiles', protocol.tile)
  trackAtlasUsageEvent({
    eventName: 'atlas_lab_preview_loaded',
    atlasManifestId: manifest.atlasVersion,
    atlasVersion: manifest.atlasVersion,
    tileSchemaVersion: manifest.schemaVersion,
    enabledLayers: manifest.layerCatalog,
    artifactIds: Object.values(manifest.artifacts ?? {}).map(artifact => artifact?.id).filter((id): id is string => Boolean(id)),
    providerId: manifest.storage?.provider || 'local',
    source: 'admin_atlas_lab',
    metadata: {
      coverage: manifest.coverage,
      styles: styles.map(style => style.id),
      showcase: activeShowcase.value.id,
    },
  })
  await nextTick()

  for (const style of styles) {
    const el = mapEls.get(style.id)
    if (!el) continue

    const map = new maplibregl.Map({
      container: el,
      interactive: true,
      attributionControl: { compact: true },
      style: buildStyle(style, { baseUrl: pmtilesUrl, contourUrl: contourUrlForShowcase(activeShowcase.value) }) as never,
      center: activeShowcase.value.center,
      zoom: activeShowcase.value.zoom,
      preserveDrawingBuffer: true,
    })

    mapStatus[style.id] = 'loading owned PMTiles'
    map.on('load', () => {
      mapStatus[style.id] = 'loaded'
    })
    map.on('idle', () => {
      const renderedFeatures = map.queryRenderedFeatures({
        layers: ['landcover', 'landuse', 'park', 'water', 'roads-major', 'roads-minor', 'paths-trails', 'contours-minor', 'contours-index', 'contours-major', 'sample-route'],
      }).length
      mapStatus[style.id] = `tiles ready - ${renderedFeatures} rendered`
    })
    map.on('error', (event) => {
      mapStatus[style.id] = event.error?.message ?? 'map error'
    })
    requestAnimationFrame(() => map.resize())
    window.setTimeout(() => map.resize(), 250)

    maps.push({
      style,
      remove: () => map.remove(),
      flyTo: options => map.flyTo(options),
      getSource: id => map.getSource(id),
      queryRenderedFeatures: options => map.queryRenderedFeatures(options),
      resize: () => map.resize(),
      setStyle: nextStyle => {
        map.setStyle(nextStyle as never)
      },
    })
  }
})

onBeforeUnmount(() => {
  for (const map of maps) map.remove()
})

const InfoBlock = defineComponent({
  props: {
    title: { type: String, required: true },
    items: { type: Array as PropType<string[]>, required: true },
  },
  setup(props) {
    return () => h('div', [
      h('p', { class: 'text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500' }, props.title),
      h('div', { class: 'mt-2 flex flex-wrap gap-1.5' }, props.items.map(item =>
        h('span', { class: 'rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] leading-4 text-stone-700' }, item),
      )),
    ])
  },
})
</script>

<style scoped>
.admin-secondary { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.6rem 1rem; font-size:0.8rem; font-weight:700; transition:background-color 150ms ease, border-color 150ms ease; white-space:nowrap; }
.admin-secondary:hover { background:rgb(245 245 244); border-color:rgb(214 211 209); }
.showcase-button { display:inline-flex; align-items:center; justify-content:center; min-height:2rem; border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.42rem 0.74rem; font-size:0.75rem; font-weight:700; transition:background-color 150ms ease, border-color 150ms ease, color 150ms ease; white-space:nowrap; }
.showcase-button:hover { background:rgb(245 245 244); border-color:rgb(214 211 209); }
.showcase-button--active { background:rgb(28 25 23); border-color:rgb(28 25 23); color:white; }
.atlas-style-card--radmaps-toner :deep(.maplibregl-canvas) { filter: contrast(1.18) grayscale(0.72); }
.atlas-style-card--radmaps-field-topo :deep(.maplibregl-canvas) { filter: saturate(0.92) contrast(1.04); }
.atlas-style-card--radmaps-watercolor-wash :deep(.maplibregl-canvas) { filter: saturate(0.86) contrast(0.72) brightness(1.12) sepia(0.12); }
.atlas-style-card--radmaps-night-relief :deep(.maplibregl-canvas) { filter: saturate(1.12) contrast(1.12); }
.atlas-style-card--radmaps-simple-contour :deep(.maplibregl-canvas) { filter: saturate(0.76) contrast(1.08) brightness(1.04); }
.watercolor-art-overlay {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  opacity: 0.82;
  mix-blend-mode: multiply;
  background:
    radial-gradient(ellipse at 24% 18%, rgba(255,255,255,0.74) 0 11%, rgba(255,255,255,0) 32%),
    radial-gradient(ellipse at 72% 24%, rgba(111,171,185,0.24) 0 12%, rgba(111,171,185,0) 36%),
    radial-gradient(ellipse at 45% 72%, rgba(196,132,83,0.18) 0 14%, rgba(196,132,83,0) 38%),
    repeating-linear-gradient(7deg, rgba(80,59,36,0.08) 0 1px, rgba(255,255,255,0) 1px 5px),
    repeating-linear-gradient(97deg, rgba(255,255,255,0.22) 0 1px, rgba(91,68,42,0.05) 1px 7px);
}
.watercolor-art-overlay::before,
.watercolor-art-overlay::after {
  content: '';
  position: absolute;
  inset: -16%;
  opacity: 0.28;
  mix-blend-mode: multiply;
}
.watercolor-art-overlay::before {
  background:
    radial-gradient(closest-side at 12% 44%, rgba(111,171,185,0.22), rgba(111,171,185,0) 72%),
    radial-gradient(closest-side at 64% 58%, rgba(144,184,100,0.18), rgba(144,184,100,0) 70%),
    radial-gradient(closest-side at 38% 18%, rgba(213,146,91,0.16), rgba(213,146,91,0) 74%);
  filter: blur(10px);
}
.watercolor-art-overlay::after {
  background-image:
    linear-gradient(112deg, rgba(117,76,44,0.13), rgba(255,255,255,0) 24% 70%, rgba(70,123,138,0.12)),
    repeating-radial-gradient(circle at 50% 50%, rgba(81,58,34,0.08) 0 1px, rgba(255,255,255,0) 1px 5px);
  filter: blur(0.4px);
}
.watercolor-bloom {
  position: absolute;
  display: block;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.34;
  mix-blend-mode: multiply;
}
.watercolor-bloom--blue {
  left: 5%;
  top: 5%;
  width: 46%;
  height: 38%;
  background: rgba(82,155,174,0.30);
}
.watercolor-bloom--green {
  right: 8%;
  top: 32%;
  width: 36%;
  height: 42%;
  background: rgba(132,170,90,0.24);
}
.watercolor-bloom--ochre {
  left: 30%;
  bottom: 4%;
  width: 44%;
  height: 34%;
  background: rgba(197,128,76,0.22);
}
.watercolor-bloom--rose {
  right: 18%;
  top: 8%;
  width: 22%;
  height: 28%;
  background: rgba(169,82,70,0.14);
}
:deep(.atlas-map-shell.maplibregl-map) { position: absolute; inset: 0; width: 100%; height: 100%; }
:deep(.maplibregl-canvas) { outline: none; }
:deep(.maplibregl-ctrl-attrib) { font-size: 10px; }
</style>
