<template>
  <AdminShell title="Map Tools">
    <div class="space-y-6">
      <section class="rounded-lg border border-stone-200 bg-white p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-sm font-semibold text-stone-900">Provider, tile, and layer inventory</p>
            <p class="mt-2 text-sm leading-6 text-stone-600">
              A working ledger for every map source RadMaps renders today or is planning to own. Keep this page and
              <code class="rounded bg-stone-100 px-1.5 py-0.5 text-xs">docs/MAP_TOOLS_CATALOG.md</code>
              updated whenever a provider, preset, source URL, layer capability, attribution rule, or tracking key changes.
            </p>
          </div>
          <NuxtLink to="/create" class="admin-secondary">
            Open Editor
          </NuxtLink>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-5">
          <div v-for="step in renderFlow" :key="step.label" class="rounded-lg border border-stone-200 bg-[#FAF8F4] p-3">
            <div class="flex items-center gap-2 text-stone-900">
              <UIcon :name="step.icon" class="h-4 w-4 text-[#2D6A4F]" />
              <p class="text-xs font-bold uppercase tracking-[0.12em]">{{ step.label }}</p>
            </div>
            <p class="mt-2 text-xs leading-5 text-stone-600">{{ step.body }}</p>
          </div>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-4">
        <div v-for="summary in summaries" :key="summary.label" class="rounded-lg border border-stone-200 bg-white p-4">
          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{{ summary.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-stone-900">{{ summary.value }}</p>
          <p class="mt-1 text-xs text-stone-500">{{ summary.body }}</p>
        </div>
      </section>

      <section class="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div class="border-b border-stone-200 p-4">
          <p class="text-sm font-semibold text-stone-900">Current and Planned Map Systems</p>
          <p class="mt-1 text-xs text-stone-500">Names here should match StyleConfig, StylePanel labels, style graph sources, and analytics dimensions.</p>
        </div>

        <div class="divide-y divide-stone-100">
          <article v-for="tool in catalog" :key="tool.id" class="p-4">
            <div class="grid gap-4 xl:grid-cols-[280px_1fr]">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" :class="statusClass(tool.status)">
                    {{ tool.status }}
                  </span>
                  <span class="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">
                    {{ tool.costModel }}
                  </span>
                </div>
                <h2 class="mt-3 text-base font-semibold text-stone-900">{{ tool.name }}</h2>
                <p class="mt-1 text-xs text-stone-500">{{ tool.provider }}</p>
                <p class="mt-3 text-xs leading-5 text-stone-600">{{ tool.notes }}</p>
              </div>

              <div class="grid gap-3 lg:grid-cols-2">
                <InfoBlock title="App Names" :items="tool.appNames" mono />
                <InfoBlock title="Used By Presets" :items="tool.usedByPresets" mono />
                <InfoBlock title="Sources" :items="tool.sources" />
                <InfoBlock title="Capabilities" :items="tool.capabilities" />
                <InfoBlock title="High-Level Attributes" :items="tool.layerAttributes" mono />
                <InfoBlock title="Tracking Keys" :items="tool.trackingKeys" mono />
              </div>
            </div>

            <div class="mt-4 grid gap-3 lg:grid-cols-3">
              <div class="rounded-lg bg-stone-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Runtime Surfaces</p>
                <p class="mt-2 text-xs leading-5 text-stone-600">{{ tool.runtimeSurfaces.join(', ') }}</p>
              </div>
              <div class="rounded-lg bg-stone-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Attribution</p>
                <p class="mt-2 text-xs leading-5 text-stone-600">{{ tool.attribution }}</p>
              </div>
              <div class="rounded-lg bg-stone-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Spend Risk</p>
                <p class="mt-2 text-xs leading-5 text-stone-600">{{ tool.spendRisk }}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <div class="border-b border-stone-200 p-4">
          <p class="text-sm font-semibold text-stone-900">Big Build Tracks</p>
          <p class="mt-1 text-xs text-stone-500">The long-term path toward provider-light, print-first map rendering.</p>
        </div>
        <div class="grid gap-4 p-4 xl:grid-cols-3">
          <article v-for="track in buildTracks" :key="track.id" class="rounded-lg border border-stone-200 p-4">
            <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2D6A4F]">{{ track.posture }}</p>
            <h2 class="mt-2 text-base font-semibold text-stone-900">{{ track.title }}</h2>
            <p class="mt-2 text-sm leading-6 text-stone-600">{{ track.goal }}</p>
            <InfoBlock class="mt-4" title="Automation" :items="track.automation" />
            <InfoBlock class="mt-4" title="Unlocks" :items="track.unlocks" />
            <InfoBlock class="mt-4" title="Risks" :items="track.risks" />
          </article>
        </div>
      </section>

      <section class="rounded-lg border border-stone-200 bg-white p-5">
        <p class="text-sm font-semibold text-stone-900">Analytics Convention</p>
        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div>
            <p class="text-xs font-semibold text-stone-900">Event points</p>
            <p class="mt-2 text-xs leading-5 text-stone-600">Record on style preset select, proof render request, checkout proof render, final render, and public share render.</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-stone-900">Core dimensions</p>
            <p class="mt-2 text-xs leading-5 text-stone-600">provider_id, preset, base_tile_style, render_class, print_size, map_id, user_id, tile_effect, enabled_layers, atlas_version.</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-stone-900">Spend questions</p>
            <p class="mt-2 text-xs leading-5 text-stone-600">Which providers drive proof churn, which styles convert to orders, and which paid tiles should move into RadMaps-owned atlases first.</p>
          </div>
        </div>
      </section>
    </div>
  </AdminShell>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, type PropType } from 'vue'
import { MAP_BUILD_TRACKS, MAP_TOOL_CATALOG, type MapToolStatus } from '~/utils/mapToolCatalog'

definePageMeta({ layout: 'default', middleware: 'auth' })

const catalog = MAP_TOOL_CATALOG
const buildTracks = MAP_BUILD_TRACKS

const renderFlow = [
  { label: 'Intent', icon: 'i-heroicons-swatch', body: 'StyleConfig stores poster intent: preset, base tile style, overlays, route styling, and map controls.' },
  { label: 'Graph', icon: 'i-heroicons-share', body: 'styleLayerGraph gates which controls are supported, baked, required, ignored, or editable for the active preset.' },
  { label: 'Style', icon: 'i-heroicons-map', body: 'mapStyle.ts turns the effective config into MapLibre sources, layers, attribution, and update behavior.' },
  { label: 'Render', icon: 'i-heroicons-camera', body: 'MapPreview.vue renders the editor, proof, checkout, public share, and final Browserless screenshots.' },
  { label: 'Account', icon: 'i-heroicons-chart-bar', body: 'Analytics should attribute every style and render event to provider, tile source, atlas version, and render class.' },
]

const summaries = computed(() => [
  {
    label: 'Active Systems',
    value: catalog.filter(tool => tool.status === 'active').length,
    body: 'Currently wired into MapPreview/mapStyle.',
  },
  {
    label: 'Self-Hosted Tracks',
    value: catalog.filter(tool => tool.costModel === 'self-hosted').length,
    body: 'Planned paths to reduce third-party tile spend.',
  },
  {
    label: 'Provider Exposures',
    value: catalog.filter(tool => tool.costModel !== 'self-hosted' && tool.costModel !== 'free-public').length,
    body: 'Licensing or payment relationship required.',
  },
  {
    label: 'Build Tracks',
    value: buildTracks.length,
    body: 'Strategic automation programs to explore next.',
  },
])

function statusClass(status: MapToolStatus): string {
  if (status === 'active') return 'bg-green-50 text-green-700'
  if (status === 'beta') return 'bg-blue-50 text-blue-700'
  if (status === 'candidate') return 'bg-amber-50 text-amber-700'
  return 'bg-stone-100 text-stone-600'
}

const InfoBlock = defineComponent({
  props: {
    title: { type: String, required: true },
    items: { type: Array as PropType<string[]>, required: true },
    mono: { type: Boolean, default: false },
  },
  setup(props) {
    return () => h('div', { class: 'min-w-0' }, [
      h('p', { class: 'text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500' }, props.title),
      h('div', { class: 'mt-2 flex flex-wrap gap-1.5' }, props.items.map(item =>
        h('span', {
          class: [
            'rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] leading-4 text-stone-700',
            props.mono ? 'font-mono' : '',
          ],
        }, item),
      )),
    ])
  },
})
</script>

<style scoped>
.admin-secondary { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid rgb(231 229 228); background:white; color:rgb(68 64 60); padding:0.6rem 1rem; font-size:0.8rem; font-weight:700; transition:background-color 150ms ease, border-color 150ms ease; white-space:nowrap; }
.admin-secondary:hover { background:rgb(245 245 244); border-color:rgb(214 211 209); }
</style>
