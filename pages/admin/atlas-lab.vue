<template>
  <AdminShell title="Atlas Lab" :allow-local-preview="true">
    <svg aria-hidden="true" class="atlas-svg-filters" focusable="false">
      <filter id="radmaps-watercolor-paint-filter" x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency="0.010 0.026" numOctaves="3" seed="17" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.8" xChannelSelector="R" yChannelSelector="G" result="wobbled" />
        <feGaussianBlur in="wobbled" stdDeviation="0.22" result="softened" />
        <feColorMatrix
          in="softened"
          type="matrix"
          values="1.04 0.03 0 0 0.01 0.02 1.02 0.02 0 0.01 0 0.02 1.02 0 0.01 0 0 0 1 0"
        />
      </filter>
    </svg>
    <div class="space-y-6">
      <section class="rounded-lg border border-stone-200 bg-white p-5">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="max-w-4xl">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-stone-900">RadMaps owned atlas PMTiles</p>
                <p class="mt-2 text-sm leading-6 text-stone-600">
                  This lab previews the owned RadMaps tile stack: Planetiler turns open geodata and elevation sources
                  into versioned PMTiles archives, Cloudflare R2 stores those archives, the RadMaps tile API serves
                  them to the app, and MapLibre applies print-grade style recipes at render time. The goal is one
                  reusable geography archive with many visual treatments.
                </p>
              </div>
              <NuxtLink to="/admin/map-tools" class="admin-secondary shrink-0">
                Map Tools Catalog
              </NuxtLink>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div class="atlas-info-pill">
                <p class="atlas-info-label">Planetiler</p>
                <p class="atlas-info-copy">
                  Our tile factory. It converts OSM-style geodata into optimized vector layers for water, parks,
                  landcover, roads, trails, buildings, POIs, and place labels.
                </p>
              </div>
              <div class="atlas-info-pill">
                <p class="atlas-info-label">PMTiles</p>
                <p class="atlas-info-copy">
                  Portable tile archives. Instead of millions of loose <span class="font-mono">z/x/y</span> files,
                  one PMTiles file can hold an entire regional or national vector atlas.
                </p>
              </div>
              <div class="atlas-info-pill">
                <p class="atlas-info-label">R2</p>
                <p class="atlas-info-copy">
                  Cloudflare object storage for immutable PMTiles and manifests. It keeps storage costs predictable
                  and gives us a simple path to edge-friendly tile delivery.
                </p>
              </div>
              <div class="atlas-info-pill">
                <p class="atlas-info-label">Styles</p>
                <p class="atlas-info-copy">
                  Toner, topo, watercolor A/B, night relief, survey, cyanotype, atlas, engraving, and simple contour
                  are MapLibre recipes over the same source layers. Style changes do not require rebuilding geography.
                </p>
              </div>
            </div>

            <div class="atlas-business-case mt-4">
              <div>
                <p class="atlas-info-label">Business justification</p>
                <p class="mt-2 text-sm leading-6 text-stone-700">
                  Owning the atlas lets RadMaps reduce commercial basemap dependency, avoid paying for every style
                  experiment, and build a differentiated print product that competitors cannot copy by switching a
                  provider preset. The same data can power customer layer controls, staff QA, proof renders, final
                  Browserless print renders, and usage analytics for spend optimization.
                </p>
              </div>
              <div class="atlas-business-grid">
                <span>Lower vendor risk</span>
                <span>Unlimited house styles</span>
                <span>Layer-level editor controls</span>
                <span>Print-first QA</span>
                <span>Usage and spend tracking</span>
                <span>Future worldwide scaling</span>
              </div>
            </div>

            <div class="mt-4 grid gap-3 lg:grid-cols-2">
              <div class="atlas-doc-panel">
                <p class="atlas-info-label">Update and sync process</p>
                <ol class="atlas-doc-list">
                  <li>Download the latest source extract, currently Geofabrik US OSM PBF for the base atlas.</li>
                  <li>Run the cloud atlas build workflow to create a new PMTiles snapshot with a new date/version.</li>
                  <li>Validate PMTiles headers, bounds, layer names, tile metadata, and representative sample tiles.</li>
                  <li>Upload the immutable PMTiles object to R2 and verify HTTP range reads return partial content.</li>
                  <li>Publish the staging manifest to point at the new object, QA in Atlas Lab, then promote production by updating the production manifest.</li>
                </ol>
                <p class="mt-3 text-xs leading-5 text-stone-500">
                  We do not mutate existing PMTiles in place. Each refresh creates a new object path so rollback is just a manifest pointer change.
                </p>
              </div>

              <div class="atlas-doc-panel">
                <p class="atlas-info-label">Tooling and cost posture</p>
                <p class="mt-2 text-xs leading-5 text-stone-600">
                  Planetiler is not a hosted service; it is an open-source build tool we run through Docker, Java, or GitHub Actions.
                  We do not pay Planetiler usage fees. Our costs are compute time for builds, R2 storage, occasional upload bandwidth,
                  and future tile/API observability. OSM and DEM source licenses still control attribution and downstream obligations.
                </p>
                <p class="mt-3 text-xs leading-5 text-stone-500">
                  Practical cadence: monthly base-atlas refreshes while product usage is low, faster regional terrain refreshes where
                  print demand is high, and a future scheduled pipeline once QA and rollback are boring.
                </p>
              </div>
            </div>

            <div class="atlas-architecture mt-5" aria-label="Atlas architecture diagram">
              <div class="atlas-architecture-node">
                <span>Open data</span>
                <strong>OSM + DEM</strong>
              </div>
              <span class="atlas-architecture-arrow">-></span>
              <div class="atlas-architecture-node">
                <span>Build</span>
                <strong>Planetiler + terrain jobs</strong>
              </div>
              <span class="atlas-architecture-arrow">-></span>
              <div class="atlas-architecture-node">
                <span>Storage</span>
                <strong>R2 PMTiles + manifest</strong>
              </div>
              <span class="atlas-architecture-arrow">-></span>
              <div class="atlas-architecture-node">
                <span>Delivery</span>
                <strong>RadMaps tile API</strong>
              </div>
              <span class="atlas-architecture-arrow">-></span>
              <div class="atlas-architecture-node">
                <span>Output</span>
                <strong>MapLibre previews + print renders</strong>
              </div>
            </div>

            <p class="mt-4 text-xs leading-5 text-stone-500">
              Base coverage is the contiguous United States at z0-14. Contour coverage is intentionally regional
              while we scale terrain generation: the mountain buttons use generated terrain packs, while the
              city/base buttons show the full-US atlas without a terrain overlay. In production, the same manifest
              should drive editor previews, proofs, final print renders, attribution, and atlas usage analytics.
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-stone-200 bg-white p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-sm font-semibold text-stone-900">US showcase window</p>
            <p class="mt-1 text-xs leading-5 text-stone-600">
              Jump the same owned PMTiles archive across contour regions and base-only city stress tests. Roads, trails,
              water, parks, places, POIs, and peaks are all styled from separate vector layers.
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

      <section class="grid gap-6">
        <article
          v-for="style in styles"
          :key="style.id"
          class="atlas-style-card overflow-hidden rounded-lg border border-stone-200 bg-white"
          :class="`atlas-style-card--${style.id}`"
        >
          <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_330px]">
            <div class="relative h-[460px] bg-stone-100 lg:h-[520px]">
              <div :ref="(el) => setMapEl(style.id, el)" class="atlas-map-shell" />
              <div
                v-if="style.id.startsWith('radmaps-watercolor')"
                class="watercolor-art-overlay"
                :class="`watercolor-art-overlay--${style.id}`"
              />
              <div class="pointer-events-none absolute left-3 top-3 rounded-md bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{{ style.preset }}</p>
                <p class="text-sm font-semibold text-stone-900">{{ style.name }}</p>
              </div>
              <div class="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 shadow-sm backdrop-blur">
                {{ activeShowcase.name }} - {{ atlasLabel }} - {{ activeShowcase.contourUrl ? 'regional contour pack inside outlined bbox z8-14' : 'base z0-14 roads/places/POIs' }}
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

const baseVectorLayers = [
  'landcover',
  'landuse',
  'mountain_peak',
  'park',
  'place',
  'transportation',
  'transportation_name',
  'water',
  'water_name',
  'waterway',
  'building',
  'poi',
].map(id => ({ id }))
const contourVectorLayers = [{ id: 'contour' }]

const config = useRuntimeConfig()
const configuredManifestUrl = String(config.public.radmapsAtlasManifestUrl || '')
const configuredAtlasUrl = String(config.public.radmapsAtlasPmtilesUrl || '')
const configuredContourUrl = String(config.public.radmapsContourPmtilesUrl || '')
const localAtlasUrl = '/atlas/radmaps-driftless-planetiler.pmtiles'
const localContourUrl = '/atlas/radmaps-driftless-contours.pmtiles'
const atlasLabel = ref('Driftless / Madison lab pack')
const maps: Array<{
  style: AtlasStyle
  remove: () => void
  flyTo: (options: { center: [number, number], zoom: number, duration?: number }) => void
  jumpTo: (options: { center: [number, number], zoom: number }) => void
  getSource: (id: string) => unknown
  queryRenderedFeatures: (options: { layers: string[] }) => unknown[]
  querySourceFeatures: (sourceId: string, options: { sourceLayer: string }) => unknown[]
  getCenter: () => { lng: number, lat: number }
  getZoom: () => number
  getLayer: (id: string) => unknown
  getStyle: () => unknown
  isSourceLoaded: (id: string) => boolean
  raw?: unknown
  resize: () => void
  setStyle: (style: unknown) => void
}> = []
const mapEls = new Map<string, HTMLElement>()
const mapStatus = reactive<Record<string, string>>({})
const mapErrors = reactive<Record<string, string>>({})

type ShowcaseLocation = {
  id: string
  name: string
  center: [number, number]
  zoom: number
  route: [number, number][]
  contourUrl?: string
  contourBounds?: [number, number, number, number]
}

const showcases: ShowcaseLocation[] = [
  {
    id: 'yosemite',
    name: 'Yosemite',
    center: [-119.573, 37.748],
    zoom: 12.2,
    route: [[-119.628, 37.731], [-119.604, 37.742], [-119.580, 37.754], [-119.557, 37.771], [-119.536, 37.787]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/yosemite/2026-05-17/radmaps-yosemite-contours.pmtiles',
    contourBounds: [-119.75, 37.6, -119.35, 37.92],
  },
  {
    id: 'rocky-mountain',
    name: 'Rocky Mountain',
    center: [-105.646, 40.325],
    zoom: 12.1,
    route: [[-105.684, 40.310], [-105.666, 40.324], [-105.643, 40.337], [-105.621, 40.352], [-105.603, 40.366]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/rocky-mountain/2026-05-17/radmaps-rocky-mountain-contours.pmtiles',
    contourBounds: [-105.85, 40.16, -105.45, 40.52],
  },
  {
    id: 'smokies',
    name: 'Smokies',
    center: [-83.507, 35.611],
    zoom: 12.4,
    route: [[-83.548, 35.586], [-83.529, 35.600], [-83.506, 35.616], [-83.487, 35.632], [-83.470, 35.648]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/smokies/2026-05-17/radmaps-smokies-contours.pmtiles',
    contourBounds: [-83.75, 35.44, -83.22, 35.8],
  },
  {
    id: 'superior',
    name: 'North Shore',
    center: [-91.109, 47.309],
    zoom: 11.9,
    route: [[-91.170, 47.278], [-91.145, 47.295], [-91.117, 47.314], [-91.087, 47.335], [-91.055, 47.354]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/superior/2026-05-17/radmaps-superior-contours.pmtiles',
    contourBounds: [-91.52, 47.08, -90.68, 47.58],
  },
  {
    id: 'madison',
    name: 'Driftless',
    center: [-89.396, 43.077],
    zoom: 14,
    route: [[-89.430, 43.058], [-89.418, 43.066], [-89.402, 43.075], [-89.387, 43.083], [-89.372, 43.092]],
    contourUrl: 'https://pub-983952a5b3574ca9aa049741eb7d7ce3.r2.dev/atlas/v1/terrain/driftless/2026-05-15/radmaps-driftless-contours.pmtiles',
    contourBounds: [-90.25, 42.85, -88.85, 43.55],
  },
  {
    id: 'chicago',
    name: 'Chicago',
    center: [-87.629, 41.879],
    zoom: 13.1,
    route: [[-87.642, 41.867], [-87.636, 41.874], [-87.629, 41.881], [-87.622, 41.888], [-87.615, 41.895]],
  },
  {
    id: 'moab',
    name: 'Moab',
    center: [-109.593, 38.574],
    zoom: 12.8,
    route: [[-109.635, 38.555], [-109.620, 38.566], [-109.603, 38.578], [-109.586, 38.590], [-109.570, 38.602]],
  },
  {
    id: 'seattle',
    name: 'Seattle',
    center: [-122.332, 47.606],
    zoom: 12.7,
    route: [[-122.362, 47.590], [-122.346, 47.599], [-122.329, 47.608], [-122.312, 47.617], [-122.295, 47.626]],
  },
  {
    id: 'acadia',
    name: 'Acadia',
    center: [-68.273, 44.338],
    zoom: 12.9,
    route: [[-68.315, 44.323], [-68.300, 44.332], [-68.282, 44.341], [-68.264, 44.350], [-68.246, 44.359]],
  },
]

const activeShowcaseId = ref(showcases[0].id)
const activeShowcase = computed(() => showcases.find(showcase => showcase.id === activeShowcaseId.value) ?? showcases[0])
let activeBasePmtilesUrl = ''

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
    thesis: 'A print-grade house topo with crisp owned vector linework, richer hydrography, and a stronger generated contour hierarchy.',
    tags: ['owned', 'topo', 'terrain'],
    layers: ['contour', 'water', 'waterway', 'park', 'landcover', 'transportation', 'poi', 'place'],
    printNotes: ['sharp contour hierarchy', 'survey-grade roads', 'clear water and labels'],
    palette: {
      background: '#F7EFD8',
      landcover: '#D9D5A6',
      landuse: '#E9D8BB',
      park: '#AFC982',
      water: '#6DAEC0',
      waterLine: '#327F96',
      building: '#C9BBA4',
      roadCasing: '#FFF6E4',
      road: '#5F554B',
      roadMinor: '#8B7E70',
      path: '#696E34',
      route: '#C44F24',
      routeHalo: '#F8F0E2',
      label: '#302319',
      labelHalo: '#F8F0DD',
      poi: '#6B542E',
      contour: '#AA855C',
      contourMajor: '#604327',
    },
  },
  {
    id: 'radmaps-watercolor-pigment-wash',
    name: 'RadMaps Watercolor A: Pigment Wash',
    preset: 'radmaps-watercolor-a',
    thesis: 'Wet-on-wet map treatment with warm rag-paper tone, transparent pigment blooms, soft roads, blue hydro pools, and fine granulation.',
    tags: ['owned', 'watercolor', 'art'],
    layers: ['water', 'waterway', 'park', 'landcover', 'landuse', 'transportation', 'place'],
    printNotes: ['wet pigment wash', 'blue water blooms', 'soft blended roads'],
    palette: {
      background: '#FFF4E2',
      landcover: '#D9C879',
      landuse: '#E7B58E',
      park: '#96BA67',
      water: '#49B6D0',
      waterLine: '#167E9B',
      building: '#C99D79',
      roadCasing: '#FFF4DB',
      road: '#9A594A',
      roadMinor: '#C88971',
      path: '#668F50',
      route: '#A43F2F',
      routeHalo: '#FFE8BD',
      label: '#5B3728',
      labelHalo: '#FFF5E5',
      poi: '#765B2E',
      contour: '#B57D52',
      contourMajor: '#875332',
    },
  },
  {
    id: 'radmaps-watercolor-brush-ink',
    name: 'RadMaps Watercolor B: Brush Ink',
    preset: 'radmaps-watercolor-b',
    thesis: 'A more painterly watercolor experiment with post-processed vector wobble, softened roads, brushed rivers, broken trail pigment, lighter land washes, and rough paper tooth.',
    tags: ['owned', 'watercolor', 'brush'],
    layers: ['water', 'waterway', 'park', 'landcover', 'landuse', 'transportation', 'place'],
    printNotes: ['post-process wobble', 'brushed rivers', 'soft vector pigment'],
    palette: {
      background: '#FFF7E8',
      landcover: '#E3D79B',
      landuse: '#EDC39C',
      park: '#A7C77A',
      water: '#63C7DC',
      waterLine: '#157F9D',
      building: '#CBA98A',
      roadCasing: '#FFF1D7',
      road: '#8E5A4B',
      roadMinor: '#C9967B',
      path: '#6F9458',
      route: '#9D3F32',
      routeHalo: '#FFE3B8',
      label: '#5A392B',
      labelHalo: '#FFF7E9',
      poi: '#7A6034',
      contour: '#BA895E',
      contourMajor: '#8C5836',
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
    id: 'radmaps-swiss-relief',
    name: 'RadMaps Swiss Relief',
    preset: 'radmaps-swiss-relief',
    thesis: 'Clean alpine cartography inspired by precise national survey maps: sharp terrain hierarchy, restrained fills, blue hydrography, and disciplined red route emphasis.',
    tags: ['owned', 'relief', 'survey'],
    layers: ['contour', 'water', 'waterway', 'park', 'landcover', 'transportation', 'building', 'poi', 'place'],
    printNotes: ['survey clarity', 'crisp contours', 'alpine print feel'],
    palette: {
      background: '#F8F4E8',
      landcover: '#E7E1BF',
      landuse: '#F0DDC1',
      park: '#B8CF91',
      water: '#9CC9D7',
      waterLine: '#3E8EA4',
      building: '#C7B7A0',
      roadCasing: '#FFF9EA',
      road: '#9F4D43',
      roadMinor: '#8F8374',
      path: '#6C7147',
      route: '#D93228',
      routeHalo: '#FFF6E4',
      label: '#2F2921',
      labelHalo: '#F8F4E8',
      poi: '#5E4C2D',
      contour: '#B18A61',
      contourMajor: '#6D452C',
    },
  },
  {
    id: 'radmaps-cyanotype',
    name: 'RadMaps Cyanotype',
    preset: 'radmaps-cyanotype',
    thesis: 'A deep blue printmaking concept with glowing linework, pale terrain, blueprint-like roads, and a warm route accent for modern poster compositions.',
    tags: ['owned', 'blueprint', 'print'],
    layers: ['contour', 'water', 'waterway', 'transportation', 'building', 'poi', 'place'],
    printNotes: ['cyanotype field', 'blueprint linework', 'warm route contrast'],
    palette: {
      background: '#0E2A3D',
      landcover: '#163B52',
      landuse: '#22475A',
      park: '#214F55',
      water: '#1F7084',
      waterLine: '#9DDBEA',
      building: '#315B6D',
      roadCasing: '#0E2A3D',
      road: '#E2F4F2',
      roadMinor: '#97C8CC',
      path: '#B6D7C6',
      route: '#F3A15E',
      routeHalo: '#082032',
      label: '#F2F4E8',
      labelHalo: '#0E2A3D',
      poi: '#E6D58E',
      contour: '#6BA8B8',
      contourMajor: '#B8E6EC',
    },
  },
  {
    id: 'radmaps-national-atlas',
    name: 'RadMaps National Atlas',
    preset: 'radmaps-national-atlas',
    thesis: 'A premium physical-atlas treatment with warm land tinting, rich park/water contrast, readable settlement labels, and classic travel-map road hierarchy.',
    tags: ['owned', 'atlas', 'editorial'],
    layers: ['contour', 'water', 'waterway', 'park', 'landcover', 'landuse', 'transportation', 'building', 'poi', 'place'],
    printNotes: ['physical atlas warmth', 'editorial labels', 'classic road hierarchy'],
    palette: {
      background: '#F4E8C8',
      landcover: '#D8C583',
      landuse: '#E8C094',
      park: '#92AF5F',
      water: '#6BB6C8',
      waterLine: '#2D7E9A',
      building: '#BEA47E',
      roadCasing: '#FFF1CA',
      road: '#B45B3F',
      roadMinor: '#8C735D',
      path: '#6E7D39',
      route: '#CB2F28',
      routeHalo: '#FFF2CA',
      label: '#372A1D',
      labelHalo: '#F8EDCF',
      poi: '#6E4D27',
      contour: '#AB8053',
      contourMajor: '#684124',
    },
  },
  {
    id: 'radmaps-engraved-terrain',
    name: 'RadMaps Engraved Terrain',
    preset: 'radmaps-engraved-terrain',
    thesis: 'Monochrome etching style for dramatic prints: dense contour structure, hachure-like texture, muted context, and one strong route color.',
    tags: ['owned', 'engraving', 'terrain'],
    layers: ['contour', 'water', 'waterway', 'park', 'transportation', 'building', 'place'],
    printNotes: ['engraved contours', 'single accent route', 'gallery print option'],
    palette: {
      background: '#F8F3E8',
      landcover: '#E9E0CF',
      landuse: '#EFE4D4',
      park: '#DDDCC2',
      water: '#CBD9D8',
      waterLine: '#647C7D',
      building: '#D1C6B5',
      roadCasing: '#F8F3E8',
      road: '#3E3930',
      roadMinor: '#777065',
      path: '#6D685E',
      route: '#B8322B',
      routeHalo: '#F8F3E8',
      label: '#2B2823',
      labelHalo: '#F8F3E8',
      poi: '#4F493E',
      contour: '#7D7466',
      contourMajor: '#2E2A25',
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
  return {
    baseUrl: resolved.baseUrl || configuredAtlasUrl || localAtlasUrl,
    contourUrl: resolved.contourUrl || configuredContourUrl || localContourUrl,
  }
}

function setMapEl(id: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) mapEls.set(id, el)
}

function atlasTileUrl(source: 'base' | 'terrain', url: string) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/api/atlas/tiles/${source}/{z}/{x}/{y}.mvt?url=${encodeURIComponent(url)}`
}

function contourUrlForShowcase(showcase: ShowcaseLocation) {
  return showcase.contourUrl ? toAbsoluteUrl(showcase.contourUrl) : ''
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

function contourCoverageGeojson(showcase: ShowcaseLocation) {
  const bounds = showcase.contourBounds
  if (!bounds) return { type: 'FeatureCollection', features: [] }

  const [west, south, east, north] = bounds
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ]],
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
    const moveToShowcase = () => {
      map.jumpTo({ center: showcase.center, zoom: showcase.zoom })
      map.resize()
    }
    map.flyTo({ center: showcase.center, zoom: showcase.zoom, duration: 700 })
    requestAnimationFrame(moveToShowcase)
    window.setTimeout(moveToShowcase, 300)
    window.setTimeout(moveToShowcase, 1000)
  }
}

function buildStyle(style: AtlasStyle, urls: { baseUrl: string, contourUrl?: string }) {
  const p = style.palette
  const isToner = style.id === 'radmaps-toner'
  const isTopo = style.id === 'radmaps-field-topo'
  const isWatercolor = style.id.startsWith('radmaps-watercolor')
  const isWatercolorA = style.id === 'radmaps-watercolor-pigment-wash'
  const isWatercolorB = style.id === 'radmaps-watercolor-brush-ink'
  const isNight = style.id === 'radmaps-night-relief'
  const isSimpleContour = style.id === 'radmaps-simple-contour'
  const isSwiss = style.id === 'radmaps-swiss-relief'
  const isCyanotype = style.id === 'radmaps-cyanotype'
  const isNationalAtlas = style.id === 'radmaps-national-atlas'
  const isEngraved = style.id === 'radmaps-engraved-terrain'
  const isSurveyStyle = isTopo || isSwiss || isNationalAtlas
  const isPrintmaking = isCyanotype || isEngraved
  const landcoverOpacity = isSimpleContour ? 0.05 : isWatercolorA ? 0.15 : isWatercolorB ? 0.12 : isSwiss ? 0.42 : isCyanotype ? 0.52 : isNationalAtlas ? 0.44 : isEngraved ? 0.18 : isTopo ? 0.34 : isNight ? 0.62 : 0.45
  const landuseOpacity = isSimpleContour ? 0.03 : isWatercolorA ? 0.11 : isWatercolorB ? 0.08 : isSwiss ? 0.28 : isCyanotype ? 0.36 : isNationalAtlas ? 0.36 : isEngraved ? 0.10 : isTopo ? 0.24 : isNight ? 0.50 : 0.34
  const parkOpacity = isSimpleContour ? 0.10 : isWatercolorA ? 0.28 : isWatercolorB ? 0.23 : isSwiss ? 0.56 : isCyanotype ? 0.42 : isNationalAtlas ? 0.62 : isEngraved ? 0.22 : isTopo ? 0.48 : isNight ? 0.62 : 0.55
  const waterOpacity = isSimpleContour ? 0.22 : isWatercolorA ? 0.84 : isWatercolorB ? 0.76 : isCyanotype ? 0.54 : isEngraved ? 0.42 : isTopo ? 0.96 : isNight ? 0.86 : 0.92
  const buildingOpacity = isSimpleContour ? 0.02 : isWatercolor ? 0.03 : isCyanotype ? 0.30 : isEngraved ? 0.16 : isTopo ? 0.54 : isNight ? 0.38 : 0.62
  const roadCasingOpacity = isSimpleContour ? 0.08 : isWatercolorA ? 0.30 : isWatercolorB ? 0.20 : isCyanotype ? 0.18 : isEngraved ? 0.44 : isTopo ? 0.92 : isNight ? 0.36 : 0.78
  const majorRoadOpacity = isSimpleContour ? 0.16 : isWatercolorA ? 0.72 : isWatercolorB ? 0.64 : isCyanotype ? 0.72 : isEngraved ? 0.64 : isTopo ? 0.96 : isNight ? 0.48 : 0.86
  const minorRoadOpacity = isSimpleContour ? 0.18 : isWatercolorA ? 0.50 : isWatercolorB ? 0.42 : isCyanotype ? 0.48 : isEngraved ? 0.38 : isTopo ? 0.84 : isNight ? 0.40 : 0.76
  const pathOpacity = isSimpleContour ? 0.48 : isWatercolorA ? 0.66 : isWatercolorB ? 0.56 : isCyanotype ? 0.58 : isEngraved ? 0.50 : isTopo ? 0.92 : isNight ? 0.54 : 0.86
  const contourMinorOpacity = isSimpleContour ? 0.46 : isWatercolor ? 0.05 : isSwiss ? 0.56 : isCyanotype ? 0.34 : isNationalAtlas ? 0.32 : isEngraved ? 0.66 : isNight ? 0.24 : isTopo ? 0.42 : 0.16
  const contourIndexOpacity = isSimpleContour ? 0.70 : isWatercolor ? 0.10 : isSwiss ? 0.76 : isCyanotype ? 0.54 : isNationalAtlas ? 0.52 : isEngraved ? 0.82 : isNight ? 0.36 : isTopo ? 0.66 : 0.24
  const contourMajorOpacity = isSimpleContour ? 0.90 : isWatercolor ? 0.18 : isSwiss ? 0.92 : isCyanotype ? 0.74 : isNationalAtlas ? 0.72 : isEngraved ? 0.96 : isNight ? 0.54 : isTopo ? 0.86 : 0.36
  const poiOpacity = isSimpleContour ? 0.22 : isWatercolor ? 0.22 : isCyanotype ? 0.50 : isEngraved ? 0.30 : isTopo ? 0.58 : isNight ? 0.54 : isToner ? 0.46 : 0.42
  const labelOpacity = isSimpleContour ? 0.36 : isWatercolor ? 0.62 : isCyanotype ? 0.92 : 1
  const majorRoadClasses = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']
  const minorRoadClasses = ['minor', 'service', 'residential', 'living_street', 'pedestrian']
  const pathClasses = ['path', 'track', 'cycleway', 'bridleway', 'steps']
  const allTransportClasses = [...majorRoadClasses, ...minorRoadClasses, ...pathClasses]
  const contourLayers = urls.contourUrl ? [
    ...(isEngraved ? [
      { id: 'contours-engraved-shadow', type: 'line', source: 'terrain', 'source-layer': 'contour', paint: { 'line-color': p.contourMajor, 'line-opacity': 0.18, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 14, 1.2], 'line-dasharray': ['literal', [0.9, 2.2]], 'line-translate': ['literal', [1.1, 0.8]] } },
    ] : []),
    { id: 'contours-minor', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'minor'], paint: { 'line-color': p.contour, 'line-opacity': contourMinorOpacity, 'line-width': isSimpleContour ? 0.38 : isWatercolor ? 0.24 : isSwiss ? 0.52 : isCyanotype ? 0.44 : isEngraved ? 0.48 : isTopo ? 0.50 : 0.42, 'line-blur': isWatercolor ? 0.35 : 0 } },
    { id: 'contours-index', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'index'], paint: { 'line-color': p.contour, 'line-opacity': contourIndexOpacity, 'line-width': isSimpleContour ? 0.74 : isWatercolor ? 0.42 : isSwiss ? 0.86 : isCyanotype ? 0.78 : isEngraved ? 0.78 : isTopo ? 0.82 : 0.64, 'line-blur': isWatercolor ? 0.25 : 0 } },
    { id: 'contours-major', type: 'line', source: 'terrain', 'source-layer': 'contour', filter: ['==', ['get', 'interval_class'], 'major'], paint: { 'line-color': p.contourMajor, 'line-opacity': contourMajorOpacity, 'line-width': isSimpleContour ? 1.22 : isWatercolor ? 0.68 : isSwiss ? 1.28 : isCyanotype ? 1.22 : isEngraved ? 1.18 : isTopo ? 1.25 : 0.95, 'line-blur': isWatercolor ? 0.15 : 0 } },
  ] : []
  const topoContourLabels = urls.contourUrl && (isTopo || isSwiss || isNationalAtlas) ? [
    {
      id: 'contour-elevation-labels',
      type: 'symbol',
      source: 'terrain',
      'source-layer': 'contour',
      minzoom: 12,
      filter: ['match', ['get', 'interval_class'], ['index', 'major'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'elevation_ft']], ' ft'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 14, 9.5],
        'text-letter-spacing': 0.01,
      },
      paint: {
        'text-color': p.contourMajor,
        'text-opacity': isSwiss ? 0.78 : 0.72,
        'text-halo-color': p.labelHalo,
        'text-halo-width': 1.6,
        'text-halo-blur': 0.12,
      },
    },
  ] : []

  return {
    version: 8,
    name: style.name,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      atlas: { type: 'vector', tiles: [atlasTileUrl('base', urls.baseUrl)], minzoom: 0, maxzoom: 14, vector_layers: baseVectorLayers },
      ...(urls.contourUrl ? { terrain: { type: 'vector', tiles: [atlasTileUrl('terrain', urls.contourUrl)], minzoom: 8, maxzoom: 14, vector_layers: contourVectorLayers } } : {}),
      ...(urls.contourUrl ? {
        'contour-coverage': {
          type: 'geojson',
          data: contourCoverageGeojson(activeShowcase.value),
        },
      } : {}),
      'sample-route': {
        type: 'geojson',
        data: sampleRouteGeojson(activeShowcase.value),
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.background } },
      ...(isWatercolor ? [
        { id: 'landcover-paper-stain', type: 'fill', source: 'atlas', 'source-layer': 'landcover', paint: { 'fill-color': isWatercolorB ? '#EAD999' : '#E7D98A', 'fill-opacity': isWatercolorB ? 0.06 : 0.08 } },
        { id: 'landuse-warm-stain', type: 'fill', source: 'atlas', 'source-layer': 'landuse', paint: { 'fill-color': isWatercolorB ? '#EAB387' : '#E9AE84', 'fill-opacity': isWatercolorB ? 0.04 : 0.055 } },
        { id: 'park-paper-stain', type: 'fill', source: 'atlas', 'source-layer': 'park', paint: { 'fill-color': isWatercolorB ? '#B8CE7E' : '#AFC978', 'fill-opacity': isWatercolorB ? 0.08 : 0.11 } },
        { id: 'water-soft-wash', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': isWatercolorB ? '#B7EAF0' : '#A5E2EC', 'fill-opacity': isWatercolorB ? 0.18 : 0.22 } },
        { id: 'water-pigment-pool', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': isWatercolorB ? '#45BED2' : '#3DB5D0', 'fill-opacity': isWatercolorB ? 0.11 : 0.16 } },
      ] : []),
      { id: 'landcover', type: 'fill', source: 'atlas', 'source-layer': 'landcover', paint: { 'fill-color': p.landcover, 'fill-opacity': landcoverOpacity } },
      { id: 'landuse', type: 'fill', source: 'atlas', 'source-layer': 'landuse', paint: { 'fill-color': p.landuse, 'fill-opacity': landuseOpacity } },
      { id: 'park', type: 'fill', source: 'atlas', 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': parkOpacity } },
      { id: 'water-wash', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': isWatercolor ? 0.18 : 0 } },
      { id: 'water', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-opacity': waterOpacity } },
      ...(isWatercolor ? [
        { id: 'water-shore-bloom', type: 'line', source: 'atlas', 'source-layer': 'water', paint: { 'line-color': isWatercolorB ? '#8FE1EA' : '#7ED4E3', 'line-opacity': isWatercolorB ? 0.18 : 0.28, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 12, 2.8, 14, 4.8], 'line-blur': isWatercolorB ? 1.15 : 0.85 } },
        { id: 'water-edge-bleed', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': '#5FC4D6', 'line-opacity': isWatercolorB ? 0.20 : 0.28, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 2.7], 'line-blur': isWatercolorB ? 0.55 : 0.35 } },
      ] : []),
      ...(isWatercolorB ? [
        { id: 'waterway-brush-bloom', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': '#BDEEF2', 'line-opacity': 0.24, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.2, 14, 6.8], 'line-blur': 1.8, 'line-translate': ['literal', [0.8, -0.4]] } },
        { id: 'waterway-brush-wet-edge-a', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': '#8FDEEA', 'line-opacity': 0.32, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 14, 4.6], 'line-blur': 1.05, 'line-translate': ['literal', [1.1, -0.8]] } },
        { id: 'waterway-brush-wet-edge-b', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': '#2DA8C1', 'line-opacity': 0.24, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 2.8], 'line-blur': 0.55, 'line-dasharray': ['literal', [3.2, 1.5, 1.1, 1.2]], 'line-translate': ['literal', [-0.9, 0.7]] } },
      ] : []),
      { id: 'waterway', type: 'line', source: 'atlas', 'source-layer': 'waterway', paint: { 'line-color': p.waterLine, 'line-opacity': isWatercolorB ? 0.42 : isWatercolor ? 0.74 : isTopo ? 0.84 : 0.72, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, isWatercolorB ? 1.05 : isWatercolor ? 0.75 : isTopo ? 0.7 : 0.45, 14, isWatercolorB ? 2.7 : isWatercolor ? 2.0 : isTopo ? 2.1 : 1.5], 'line-blur': isWatercolorB ? 0.55 : isWatercolor ? 0.08 : 0 } },
      ...(isSurveyStyle ? [
        { id: 'water-outline-topo', type: 'line', source: 'atlas', 'source-layer': 'water', paint: { 'line-color': p.waterLine, 'line-opacity': 0.42, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.35, 12, 0.8, 14, 1.2] } },
      ] : []),
      ...(isPrintmaking ? [
        { id: 'water-print-outline', type: 'line', source: 'atlas', 'source-layer': 'water', paint: { 'line-color': p.waterLine, 'line-opacity': isCyanotype ? 0.48 : 0.34, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.45, 14, 1.3], 'line-dasharray': ['literal', isCyanotype ? [3.5, 1.4] : [1.2, 1.8]] } },
      ] : []),
      ...(urls.contourUrl ? [
        { id: 'contour-coverage-fill', type: 'fill', source: 'contour-coverage', paint: { 'fill-color': '#F97316', 'fill-opacity': isWatercolor ? 0 : 0.035 } },
        { id: 'contour-coverage-line', type: 'line', source: 'contour-coverage', paint: { 'line-color': isWatercolor ? p.contourMajor : '#F97316', 'line-opacity': isWatercolor ? 0.26 : 0.82, 'line-width': 1.4, 'line-dasharray': ['literal', [2.5, 2]] } },
      ] : []),
      ...contourLayers,
      ...topoContourLabels,
      { id: 'building', type: 'fill', source: 'atlas', 'source-layer': 'building', minzoom: isWatercolor ? 13 : 12, paint: { 'fill-color': p.building, 'fill-opacity': buildingOpacity } },
      ...(isTopo || isSwiss || isNationalAtlas || isCyanotype ? [
        { id: 'building-outline-topo', type: 'line', source: 'atlas', 'source-layer': 'building', minzoom: 13, paint: { 'line-color': '#9B886E', 'line-opacity': 0.38, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.18, 15, 0.45] } },
      ] : []),
      ...(isWatercolor ? [
        { id: 'road-watercolor-major-understroke', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], majorRoadClasses, true, false], paint: { 'line-color': isWatercolorB ? '#CE907B' : '#D89A84', 'line-opacity': isWatercolorB ? 0.18 : 0.22, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2.7, 14, 4.8], 'line-blur': isWatercolorB ? 0.42 : 0.22 } },
        { id: 'road-watercolor-minor-understroke', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], minorRoadClasses, true, false], paint: { 'line-color': isWatercolorB ? '#E2B390' : '#E6B28F', 'line-opacity': isWatercolorB ? 0.13 : 0.17, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 14, 2.3], 'line-blur': isWatercolorB ? 0.34 : 0.18 } },
        { id: 'route-underwash', type: 'line', source: 'sample-route', paint: { 'line-color': p.route, 'line-width': isWatercolorB ? 13 : 11, 'line-opacity': isWatercolorB ? 0.09 : 0.12, 'line-blur': isWatercolorB ? 1.0 : 0.75 } },
      ] : []),
      ...(isWatercolorB ? [
        { id: 'road-brush-pigment-bloom', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], majorRoadClasses, true, false], paint: { 'line-color': '#E8B69B', 'line-opacity': 0.18, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2.4, 14, 6.2], 'line-blur': 1.4, 'line-translate': ['literal', [1.0, -0.7]] } },
        { id: 'road-brush-major-broken', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], majorRoadClasses, true, false], paint: { 'line-color': '#7D4038', 'line-opacity': 0.24, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 14, 2.7], 'line-blur': 0.35, 'line-dasharray': ['literal', [4.2, 1.7, 1.0, 1.0]], 'line-translate': ['literal', [-0.8, 0.6]] } },
        { id: 'road-brush-minor-broken', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], minorRoadClasses, true, false], paint: { 'line-color': '#B77764', 'line-opacity': 0.19, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 14, 1.45], 'line-blur': 0.42, 'line-dasharray': ['literal', [2.2, 1.8, 0.8, 1.2]], 'line-translate': ['literal', [0.7, -0.5]] } },
      ] : []),
      { id: 'roads-all-context', type: 'line', source: 'atlas', 'source-layer': 'transportation', paint: { 'line-color': p.roadMinor, 'line-opacity': isSimpleContour ? 0.18 : isWatercolor ? 0.18 : isNight ? 0.32 : 0.42, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 10, 0.95, 14, 2.1], 'line-blur': isWatercolorB ? 0.45 : 0 } },
      { id: 'road-casing', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], allTransportClasses, true, false], paint: { 'line-color': p.roadCasing, 'line-opacity': roadCasingOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, isWatercolorB ? 1.3 : isWatercolor ? 0.9 : 1.2, 10, isWatercolorB ? 2.1 : isWatercolor ? 1.65 : 2.4, 14, isWatercolorB ? 4.0 : isWatercolor ? 3.2 : 5.4], 'line-blur': isWatercolorB ? 0.52 : isWatercolor ? 0.16 : 0 } },
      { id: 'roads-major', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], majorRoadClasses, true, false], paint: { 'line-color': p.road, 'line-opacity': majorRoadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, isWatercolorB ? 0.9 : isWatercolor ? 0.7 : 0.8, 10, isWatercolorB ? 1.55 : isWatercolor ? 1.25 : 1.6, 14, isWatercolorB ? 2.9 : isWatercolor ? 2.45 : 3.8], 'line-blur': isWatercolorB ? 0.28 : 0 } },
      { id: 'roads-minor', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], minorRoadClasses, true, false], paint: { 'line-color': p.roadMinor, 'line-opacity': minorRoadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, isWatercolorB ? 0.85 : isWatercolor ? 0.65 : 0.55, 14, isWatercolorB ? 1.65 : isWatercolor ? 1.35 : 1.8], 'line-blur': isWatercolorB ? 0.36 : 0 } },
      { id: 'paths-trails', type: 'line', source: 'atlas', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], pathClasses, true, false], paint: { 'line-color': p.path, 'line-opacity': pathOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, isWatercolorB ? 1.05 : isWatercolor ? 0.85 : 0.95, 14, isWatercolorB ? 2.05 : isWatercolor ? 1.75 : 2.55], 'line-blur': isWatercolorB ? 0.38 : 0, 'line-dasharray': ['literal', isWatercolorB ? [1.1, 1.1, 0.45, 1.2] : isWatercolor ? [0.9, 2.4] : [2, 1.4]] } },
      { id: 'sample-route-casing', type: 'line', source: 'sample-route', paint: { 'line-color': p.routeHalo, 'line-width': isWatercolorB ? 8.8 : isWatercolor ? 7.4 : 7.5, 'line-opacity': isWatercolorB ? 0.42 : isWatercolor ? 0.64 : 0.94, 'line-blur': isWatercolorB ? 0.65 : isWatercolor ? 0.18 : 0 } },
      { id: 'sample-route', type: 'line', source: 'sample-route', paint: { 'line-color': p.route, 'line-width': isWatercolorB ? 4.8 : isWatercolor ? 4.2 : 4.2, 'line-opacity': isWatercolorB ? 0.78 : isWatercolor ? 0.92 : 0.98, 'line-blur': isWatercolorB ? 0.22 : isWatercolor ? 0.02 : 0 } },
      ...(isWatercolor ? [
        { id: 'route-drybrush', type: 'line', source: 'sample-route', paint: { 'line-color': '#6F2E25', 'line-width': isWatercolorB ? 1.6 : 1.2, 'line-opacity': isWatercolorB ? 0.42 : 0.36, 'line-dasharray': ['literal', isWatercolorB ? [1.2, 1.1] : [0.7, 1.8]], 'line-translate': ['literal', [1.2, -0.8]] } },
      ] : []),
      ...(isWatercolorB ? [
        { id: 'route-brush-ghost', type: 'line', source: 'sample-route', paint: { 'line-color': '#C96F54', 'line-width': 2.2, 'line-opacity': 0.20, 'line-dasharray': ['literal', [2.8, 1.7]], 'line-translate': ['literal', [-1.6, 1.1]] } },
      ] : []),
      { id: 'poi', type: 'circle', source: 'atlas', 'source-layer': 'poi', minzoom: isWatercolor ? 13 : 12, paint: { 'circle-color': p.poi, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 15, 2.2, 17, 3.2], 'circle-opacity': poiOpacity, 'circle-stroke-color': p.labelHalo, 'circle-stroke-width': isWatercolor ? 0.35 : 0.7 } },
      { id: 'peaks', type: 'circle', source: 'atlas', 'source-layer': 'mountain_peak', minzoom: 10, paint: { 'circle-color': p.poi, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 13, 2.0, 15, 3.0], 'circle-opacity': isWatercolor ? 0.34 : isNight ? 0.62 : 0.52, 'circle-stroke-color': p.labelHalo, 'circle-stroke-width': 0.8 } },
      { id: 'park-labels', type: 'symbol', source: 'atlas', 'source-layer': 'park', minzoom: 9, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9, 12, 11, 14, 13], 'text-letter-spacing': 0.02 }, paint: { 'text-color': p.poi, 'text-opacity': isSimpleContour ? 0.28 : isWatercolor ? 0.34 : 0.60, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.4 : 1.1, 'text-halo-blur': isWatercolor ? 0.7 : 0.2 } },
      { id: 'peak-labels', type: 'symbol', source: 'atlas', 'source-layer': 'mountain_peak', minzoom: 11, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 8.5, 13, 10, 15, 11.5], 'text-offset': ['literal', [0, 0.7]], 'text-anchor': 'top' }, paint: { 'text-color': p.label, 'text-opacity': isSimpleContour ? 0.42 : isWatercolor ? 0.44 : 0.76, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.5 : 1.2, 'text-halo-blur': isWatercolor ? 0.8 : 0.25 } },
      { id: 'poi-labels', type: 'symbol', source: 'atlas', 'source-layer': 'poi', minzoom: 13, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 8, 16, 10.5], 'text-offset': ['literal', [0, 0.8]], 'text-anchor': 'top' }, paint: { 'text-color': p.label, 'text-opacity': isSimpleContour ? 0.24 : isWatercolor ? 0.30 : 0.62, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.4 : 1.1, 'text-halo-blur': isWatercolor ? 0.8 : 0.2 } },
      ...(isTopo ? [
        { id: 'water-labels-topo', type: 'symbol', source: 'atlas', 'source-layer': 'water_name', minzoom: 8, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 13, 12], 'symbol-placement': 'line' }, paint: { 'text-color': p.waterLine, 'text-opacity': 0.68, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.12 } },
      ] : []),
      { id: 'place-labels', type: 'symbol', source: 'atlas', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': [isWatercolor ? 'Noto Sans Regular' : 'Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, isWatercolor ? 9 : 10, 11, isWatercolor ? 12 : 14, 14, isWatercolor ? 15 : 17], 'text-letter-spacing': isWatercolor ? 0.01 : 0.02 }, paint: { 'text-color': p.label, 'text-opacity': labelOpacity, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.8 : 1.4, 'text-halo-blur': isWatercolor ? 0.7 : 0.25 } },
      { id: 'road-labels', type: 'symbol', source: 'atlas', 'source-layer': 'transportation_name', minzoom: isWatercolor ? 12 : 11, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': isWatercolor ? 9 : 10 }, paint: { 'text-color': p.label, 'text-opacity': isWatercolor ? 0.48 : 0.86, 'text-halo-color': p.labelHalo, 'text-halo-width': isWatercolor ? 1.7 : 1.2, 'text-halo-blur': isWatercolor ? 0.8 : 0.2 } },
    ],
  }
}

onMounted(async () => {
  const maplibregl = await import('maplibre-gl')
  const manifest = await loadAtlasManifest()
  const { baseUrl } = resolveAtlasArtifacts(manifest)
  const pmtilesUrl = toAbsoluteUrl(baseUrl)
  activeBasePmtilesUrl = pmtilesUrl
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
      const auditLayers = [
        'landcover',
        'landuse',
        'park',
        'water',
        'waterway',
        'roads-all-context',
        'roads-major',
        'roads-minor',
        'paths-trails',
        'contours-minor',
        'contours-index',
        'contours-major',
        'poi',
        'peaks',
        'park-labels',
        'peak-labels',
        'poi-labels',
        'place-labels',
        'road-labels',
        'sample-route',
      ].filter(layerId => map.getLayer(layerId))
      const renderedFeatures = map.queryRenderedFeatures({
        layers: auditLayers,
      }).length
      mapStatus[style.id] = mapErrors[style.id]
        ? `tiles ready - ${renderedFeatures} rendered - ${mapErrors[style.id]}`
        : `tiles ready - ${renderedFeatures} rendered`
    })
    map.on('error', (event) => {
      mapErrors[style.id] = event.error?.message ?? 'map error'
      mapStatus[style.id] = mapErrors[style.id]
    })
    requestAnimationFrame(() => map.resize())
    window.setTimeout(() => map.resize(), 250)

    maps.push({
      style,
      remove: () => map.remove(),
      flyTo: options => map.flyTo(options),
      jumpTo: options => map.jumpTo(options),
      getSource: id => map.getSource(id),
      queryRenderedFeatures: options => map.queryRenderedFeatures(options),
      querySourceFeatures: (sourceId, options) => map.querySourceFeatures(sourceId, options),
      getCenter: () => map.getCenter(),
      getZoom: () => map.getZoom(),
      getLayer: id => map.getLayer(id),
      getStyle: () => map.getStyle(),
      isSourceLoaded: id => map.isSourceLoaded(id),
      raw: import.meta.dev ? map : undefined,
      resize: () => map.resize(),
      setStyle: nextStyle => {
        map.setStyle(nextStyle as never)
      },
    })
    if (import.meta.dev) Object.assign(window, { __RADMAPS_ATLAS_MAPS__: maps })
  }

  if (import.meta.dev) Object.assign(window, { __RADMAPS_ATLAS_MAPS__: maps })
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
.atlas-info-pill { border:1px solid rgb(231 229 228); border-radius:8px; background:rgb(250 250 249); padding:0.85rem; }
.atlas-info-label { color:rgb(68 64 60); font-size:0.66rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; }
.atlas-info-copy { margin-top:0.4rem; color:rgb(87 83 78); font-size:0.75rem; line-height:1.5; }
.atlas-business-case { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(18rem,0.9fr); gap:1rem; border:1px solid rgb(214 211 209); border-radius:8px; background:rgb(250 247 240); padding:1rem; }
.atlas-business-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-content:start; }
.atlas-business-grid span { border:1px solid rgb(231 229 228); border-radius:7px; background:rgba(255,255,255,0.72); color:rgb(68 64 60); font-size:0.72rem; font-weight:700; line-height:1.25; padding:0.55rem 0.6rem; }
.atlas-doc-panel { border:1px solid rgb(231 229 228); border-radius:8px; background:white; padding:1rem; }
.atlas-doc-list { margin-top:0.65rem; display:grid; gap:0.45rem; color:rgb(87 83 78); font-size:0.75rem; line-height:1.45; list-style-position:inside; }
.atlas-doc-list li::marker { color:rgb(120 113 108); font-weight:800; }
.atlas-architecture { display:grid; grid-template-columns:1fr auto 1fr auto 1fr auto 1fr auto 1fr; align-items:stretch; gap:0.5rem; border:1px solid rgb(231 229 228); border-radius:8px; background:linear-gradient(180deg, rgb(255 255 255), rgb(250 250 249)); padding:0.65rem; overflow-x:auto; }
.atlas-architecture-node { min-width:8.5rem; border:1px solid rgb(231 229 228); border-radius:7px; background:white; padding:0.65rem 0.7rem; }
.atlas-architecture-node span { display:block; color:rgb(120 113 108); font-size:0.62rem; font-weight:800; letter-spacing:0.11em; text-transform:uppercase; }
.atlas-architecture-node strong { display:block; margin-top:0.25rem; color:rgb(28 25 23); font-size:0.75rem; line-height:1.35; }
.atlas-architecture-arrow { align-self:center; color:rgb(120 113 108); font-size:0.75rem; font-weight:800; }
.showcase-button { display:inline-flex; align-items:center; justify-content:center; min-height:2rem; border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.42rem 0.74rem; font-size:0.75rem; font-weight:700; transition:background-color 150ms ease, border-color 150ms ease, color 150ms ease; white-space:nowrap; }
.showcase-button:hover { background:rgb(245 245 244); border-color:rgb(214 211 209); }
.showcase-button--active { background:rgb(28 25 23); border-color:rgb(28 25 23); color:white; }
.atlas-style-card--radmaps-toner :deep(.maplibregl-canvas) { filter: contrast(1.18) grayscale(0.72); }
.atlas-style-card--radmaps-field-topo :deep(.maplibregl-canvas) { filter: saturate(1.06) contrast(1.12) brightness(0.99); }
.atlas-style-card--radmaps-watercolor-pigment-wash :deep(.maplibregl-canvas) { filter: saturate(1.24) contrast(0.96) brightness(1.06) sepia(0.07); }
.atlas-style-card--radmaps-watercolor-brush-ink :deep(.maplibregl-canvas) { filter: url("#radmaps-watercolor-paint-filter") saturate(1.15) contrast(0.88) brightness(1.08) sepia(0.12); }
.atlas-style-card--radmaps-night-relief :deep(.maplibregl-canvas) { filter: saturate(1.12) contrast(1.12); }
.atlas-style-card--radmaps-swiss-relief :deep(.maplibregl-canvas) { filter: saturate(1.04) contrast(1.16) brightness(1.02); }
.atlas-style-card--radmaps-cyanotype :deep(.maplibregl-canvas) { filter: saturate(1.18) contrast(1.20) brightness(0.94); }
.atlas-style-card--radmaps-national-atlas :deep(.maplibregl-canvas) { filter: saturate(1.12) contrast(1.08) brightness(1.01); }
.atlas-style-card--radmaps-engraved-terrain :deep(.maplibregl-canvas) { filter: saturate(0.42) contrast(1.24) brightness(1.02); }
.atlas-style-card--radmaps-simple-contour :deep(.maplibregl-canvas) { filter: saturate(0.76) contrast(1.08) brightness(1.04); }
.atlas-svg-filters {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
.atlas-style-card--radmaps-watercolor-brush-ink .atlas-map-shell::before {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0.20;
  mix-blend-mode: soft-light;
  background:
    radial-gradient(ellipse at 20% 28%, rgba(255,255,255,0.70), rgba(255,255,255,0) 30%),
    radial-gradient(ellipse at 70% 24%, rgba(82,172,190,0.22), rgba(82,172,190,0) 36%),
    radial-gradient(ellipse at 40% 70%, rgba(178,120,72,0.18), rgba(178,120,72,0) 40%);
  filter: blur(8px);
}
.atlas-style-card--radmaps-cyanotype .atlas-map-shell::after {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.14;
  mix-blend-mode: screen;
  background-image:
    linear-gradient(rgba(194,239,240,0.28) 1px, transparent 1px),
    linear-gradient(90deg, rgba(194,239,240,0.28) 1px, transparent 1px);
  background-size: 24px 24px;
}
.atlas-style-card--radmaps-engraved-terrain .atlas-map-shell::after {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.12;
  mix-blend-mode: multiply;
  background-image:
    repeating-linear-gradient(108deg, rgba(52,46,38,0.12) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(18deg, rgba(52,46,38,0.08) 0 1px, transparent 1px 11px);
}
.watercolor-art-overlay {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  opacity: 0.30;
  mix-blend-mode: multiply;
  background:
    radial-gradient(ellipse at 17% 18%, rgba(255,255,255,0.34), rgba(255,255,255,0) 32%),
    radial-gradient(ellipse at 74% 22%, rgba(79,173,194,0.11), rgba(79,173,194,0) 42%),
    radial-gradient(ellipse at 58% 76%, rgba(116,151,70,0.075), rgba(116,151,70,0) 48%),
    radial-gradient(ellipse at 30% 58%, rgba(197,116,72,0.060), rgba(197,116,72,0) 44%),
    linear-gradient(112deg, rgba(131,86,47,0.050), rgba(255,255,255,0) 24% 72%, rgba(55,127,148,0.060));
}
.watercolor-art-overlay::before,
.watercolor-art-overlay::after {
  content: '';
  position: absolute;
  inset: -16%;
  mix-blend-mode: multiply;
}
.watercolor-art-overlay::before {
  opacity: 0.20;
  background:
    radial-gradient(closest-side at 12% 40%, rgba(70,170,193,0.12), rgba(70,170,193,0) 70%),
    radial-gradient(closest-side at 64% 62%, rgba(132,170,86,0.10), rgba(132,170,86,0) 72%),
    radial-gradient(closest-side at 39% 18%, rgba(213,145,91,0.075), rgba(213,145,91,0) 72%),
    radial-gradient(closest-side at 88% 84%, rgba(42,126,150,0.08), rgba(42,126,150,0) 66%);
  filter: none;
}
.watercolor-art-overlay::after {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.46' numOctaves='4' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0.65 0 0 0 0.15 0 0.58 0 0 0.12 0 0 0.46 0 0.08 0 0 0 0.42 0'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23paper)' opacity='0.34'/%3E%3C/svg%3E");
  background-size: 260px 260px;
  filter: contrast(0.82);
  opacity: 0.22;
}
.watercolor-art-overlay--radmaps-watercolor-pigment-wash { opacity: 0.34; }
.watercolor-art-overlay--radmaps-watercolor-brush-ink {
  opacity: 0.25;
  background:
    radial-gradient(ellipse at 22% 20%, rgba(255,255,255,0.38), rgba(255,255,255,0) 30%),
    radial-gradient(ellipse at 72% 28%, rgba(69,180,202,0.09), rgba(69,180,202,0) 38%),
    radial-gradient(ellipse at 48% 78%, rgba(124,155,72,0.060), rgba(124,155,72,0) 45%),
    linear-gradient(124deg, rgba(132,82,48,0.040), rgba(255,255,255,0) 21% 70%, rgba(45,148,170,0.052));
}
.watercolor-art-overlay--radmaps-watercolor-brush-ink::before {
  opacity: 0.14;
  filter: blur(0.5px);
}
.watercolor-art-overlay--radmaps-watercolor-brush-ink::after {
  opacity: 0.18;
  filter: contrast(0.76);
}
:deep(.atlas-map-shell.maplibregl-map) { position: absolute; inset: 0; width: 100%; height: 100%; }
:deep(.maplibregl-canvas) { outline: none; }
:deep(.maplibregl-ctrl-attrib) { font-size: 10px; }

@media (max-width: 900px) {
  .atlas-business-case { grid-template-columns:1fr; }
  .atlas-business-grid { grid-template-columns:1fr; }
  .atlas-architecture { grid-template-columns:1fr; }
  .atlas-architecture-arrow { justify-self:center; transform:rotate(90deg); }
  .atlas-architecture-node { min-width:0; }
}
</style>
