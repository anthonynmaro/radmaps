<template>
  <div class="h-full flex flex-col bg-white overflow-hidden">

    <!-- Panel header -->
    <div class="px-5 py-3 border-b flex items-center justify-between shrink-0">
      <h2 class="text-sm font-semibold text-gray-700">Style</h2>
      <UBadge v-if="saving" color="gray" size="xs" variant="subtle">Saving…</UBadge>
    </div>

    <!-- Scrollable controls -->
    <div class="flex-1 overflow-y-auto divide-y divide-gray-100">

      <!-- ── Themes ── -->
      <Section label="Theme" icon="i-heroicons-swatch">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="theme in COLOR_THEMES"
            :key="theme.id"
            @click="applyTheme(theme)"
            :class="[
              'relative flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 text-xs font-medium transition-all',
              local.color_theme === theme.id
                ? 'border-green-600 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300',
            ]"
          >
            <!-- Swatch preview -->
            <div class="w-full rounded overflow-hidden" style="aspect-ratio: 3/2; position: relative;">
              <div class="absolute inset-0" :style="{ backgroundColor: theme.background_color }" />
              <!-- Route squiggle -->
              <svg viewBox="0 0 48 32" class="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="none">
                <path d="M4 24 Q12 18 20 20 Q28 22 36 14 Q40 10 44 12"
                  :stroke="theme.route_color" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              </svg>
              <!-- Dark indicator -->
              <div v-if="theme.dark" class="absolute top-1 right-1 w-2 h-2 rounded-full bg-white opacity-60" />
            </div>
            <span class="text-[10px] leading-none">{{ theme.label }}</span>
          </button>
        </div>
      </Section>

      <!-- ── Print Size ── -->
      <Section label="Print Size" icon="i-heroicons-rectangle-stack">
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="size in PRINT_SIZES"
            :key="size.id"
            @click="set('print_size', size.id)"
            :class="[
              'py-1.5 rounded border text-[10px] font-medium transition-all leading-tight text-center',
              local.print_size === size.id
                ? 'border-green-600 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300',
            ]"
          >{{ size.label }}</button>
        </div>
      </Section>

      <!-- ── Base Map ── -->
      <Section label="Base Map" icon="i-heroicons-map">
        <div class="space-y-3">
          <!-- Preset row -->
          <div class="grid grid-cols-2 gap-2">
            <PresetButton
              label="Minimalist"
              :active="local.preset === 'minimalist'"
              @click="set('preset', 'minimalist')"
            >
              <svg viewBox="0 0 48 32" class="w-full h-auto opacity-70" fill="none">
                <rect width="48" height="32" fill="#f0ece4"/>
                <path d="M4 24 Q12 20 24 22 Q36 24 44 18" stroke="#c8b8a2" stroke-width="1" fill="none"/>
                <path d="M8 16 Q18 10 28 14 Q38 18 44 12" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              </svg>
              Minimalist
            </PresetButton>
            <PresetButton
              label="Topographic"
              :active="local.preset === 'topographic'"
              @click="set('preset', 'topographic')"
            >
              <svg viewBox="0 0 48 32" class="w-full h-auto opacity-70" fill="none">
                <rect width="48" height="32" fill="#e8dfd0"/>
                <ellipse cx="24" cy="18" rx="18" ry="10" stroke="#b8a888" stroke-width="0.8" fill="none"/>
                <ellipse cx="24" cy="18" rx="12" ry="7" stroke="#a09070" stroke-width="0.8" fill="none"/>
                <ellipse cx="24" cy="18" rx="6" ry="4" stroke="#887850" stroke-width="0.8" fill="none"/>
                <path d="M8 10 Q18 4 28 8 Q38 12 44 6" stroke="#e63946" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              </svg>
              Topographic
            </PresetButton>
          </div>
          <!-- Tile style (minimalist only) -->
          <template v-if="local.preset === 'minimalist'">
            <p class="text-[10px] text-gray-400 -mb-1">Tile style</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button v-for="ts in TILE_STYLES" :key="ts.value"
                class="rounded border text-[10px] py-1 px-1.5 text-center transition-colors"
                :class="(local.base_tile_style ?? 'carto-light') === ts.value
                  ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'"
                @click="set('base_tile_style', ts.value)"
              >{{ ts.label }}</button>
            </div>
          </template>
        </div>
      </Section>

      <!-- ── Poster Text ── -->
      <Section label="Poster Text" icon="i-heroicons-pencil">
        <div class="space-y-3">
          <TextRow label="Trail name" :value="local.trail_name" placeholder="Defaults to map title"
            @change="set('trail_name', $event)" />
          <TextRow label="Occasion" :value="local.occasion_text" placeholder="e.g. Summit Day 2024"
            @change="set('occasion_text', $event)" />
          <TextRow label="Location" :value="local.location_text" placeholder="e.g. Moab, Utah"
            @change="set('location_text', $event)" />
        </div>
      </Section>

      <!-- ── Route ── -->
      <Section label="Route" icon="i-heroicons-map-pin">
        <div class="space-y-3">
          <ColorRow label="Colour" :value="local.route_color" @change="set('route_color', $event)" />
          <SliderRow label="Width" :value="local.route_width" :min="1" :max="10" :step="0.5"
            :display="v => v + 'px'" @change="set('route_width', $event)" />
          <SliderRow label="Opacity" :value="local.route_opacity" :min="0.1" :max="1" :step="0.05"
            :display="v => Math.round(v * 100) + '%'" @change="set('route_opacity', $event)" />
        </div>
      </Section>

      <!-- ── Terrain ── -->
      <Section label="Terrain" icon="i-heroicons-signal">
        <div class="space-y-3">
          <ToggleRow label="Hillshade" :value="local.show_hillshade" @change="set('show_hillshade', $event)" />
          <template v-if="local.show_hillshade">
            <SliderRow label="Intensity" :value="local.hillshade_intensity" :min="0" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('hillshade_intensity', $event)" />
          </template>
          <div class="pt-1 border-t border-gray-100" />
          <ToggleRow label="Contour lines" :value="local.show_contours" @change="set('show_contours', $event)" />
          <template v-if="local.show_contours">
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>Minor / Major colour</span>
              <div class="flex gap-2">
                <ColorSwatch :value="local.contour_color" @change="set('contour_color', $event)" title="Minor" />
                <ColorSwatch :value="local.contour_major_color" @change="set('contour_major_color', $event)" title="Major" />
              </div>
            </div>
            <SliderRow label="Opacity" :value="local.contour_opacity" :min="0" :max="1" :step="0.05"
              :display="v => Math.round(v * 100) + '%'" @change="set('contour_opacity', $event)" />
            <SliderRow label="Detail" :value="local.contour_detail ?? 2" :min="0" :max="4" :step="1"
              :display="v => (['~200m','~100m','~50m','~20m','~10m'] as const)[Math.round(v)]"
              @change="set('contour_detail', $event)" />
            <ToggleRow label="Elevation labels" :value="local.show_elevation_labels"
              @change="set('show_elevation_labels', $event)" />
          </template>
        </div>
      </Section>

      <!-- ── Colours ── -->
      <Section label="Colours" icon="i-heroicons-swatch">
        <p class="text-[10px] text-gray-400 mb-3 -mt-1">Auto-set by theme · override below</p>
        <div class="space-y-3">
          <ColorRow label="Background" :value="local.background_color" @change="set('background_color', $event)" />
          <ColorRow label="Label band" :value="local.label_bg_color" @change="set('label_bg_color', $event)" />
          <ColorRow label="Text" :value="local.label_text_color" @change="set('label_text_color', $event)" />
          <ColorRow label="Water" :value="local.water_color" @change="set('water_color', $event)" />
        </div>
      </Section>

      <!-- ── Typography ── -->
      <Section label="Typography" icon="i-heroicons-bars-3-bottom-left">
        <template v-for="group in fontGroups" :key="group.label">
          <p :class="['text-[9px] font-semibold tracking-widest uppercase text-gray-400 mb-1 mt-3', group === fontGroups[0] ? 'first:mt-0 mt-0' : '']">{{ group.label }}</p>
          <div class="grid grid-cols-2 gap-1.5">
            <FontButton
              v-for="fontName in group.fonts"
              :key="fontName"
              :label="fontName"
              :font="fontName"
              :active="local.font_family === fontName"
              @click="set('font_family', fontName)"
            />
          </div>
        </template>
      </Section>

      <!-- ── Labels ── -->
      <Section label="Labels" icon="i-heroicons-tag">
        <div class="space-y-2.5">
          <ToggleRow label="Trail name" :value="local.labels.show_title"
            @change="setLabel('show_title', $event)" />
          <ToggleRow label="Distance" :value="local.labels.show_distance"
            @change="setLabel('show_distance', $event)" />
          <ToggleRow label="Elevation gain" :value="local.labels.show_elevation_gain"
            @change="setLabel('show_elevation_gain', $event)" />
          <ToggleRow label="Date" :value="local.labels.show_date"
            @change="setLabel('show_date', $event)" />
          <ToggleRow label="Location" :value="local.labels.show_location"
            @change="setLabel('show_location', $event)" />
        </div>
      </Section>

      <!-- ── Frame ── -->
      <Section label="Frame & Padding" icon="i-heroicons-square-2-stack">
        <div class="space-y-3">
          <div>
            <p class="text-xs text-gray-500 mb-2">Border</p>
            <div class="grid grid-cols-3 gap-1.5">
              <SegmentButton v-for="b in BORDERS" :key="b.value"
                :label="b.label" :active="local.border_style === b.value"
                @click="set('border_style', b.value)" />
            </div>
          </div>
          <SliderRow label="Map padding" :value="local.padding_factor" :min="0.05" :max="0.35" :step="0.01"
            :display="v => Math.round(v * 100) + '%'" @change="set('padding_factor', $event)" />
        </div>
      </Section>

    </div>

    <!-- Reset footer -->
    <div class="px-5 py-3 border-t shrink-0">
      <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="$emit('reset')">
        Reset to defaults
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { StyleConfig, StyleLabels, FontFamily, BorderStyle, BaseTileStyle, ThemeDefinition } from '~/types'
import { COLOR_THEMES, PRINT_SIZES } from '~/types'

const props = defineProps<{
  modelValue: StyleConfig
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StyleConfig]
  'reset': []
}>()

const local = reactive<StyleConfig>({ ...props.modelValue })

watch(() => props.modelValue, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(local)) {
    Object.assign(local, v)
  }
}, { deep: true })

function set<K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) {
  (local as StyleConfig)[key] = value
  emit('update:modelValue', { ...local })
}

function setLabel(key: keyof StyleLabels, value: boolean) {
  local.labels = { ...local.labels, [key]: value }
  emit('update:modelValue', { ...local })
}

function applyTheme(theme: ThemeDefinition) {
  Object.assign(local, {
    color_theme: theme.id,
    background_color: theme.background_color,
    label_bg_color: theme.label_bg_color,
    label_text_color: theme.label_text_color,
    route_color: theme.route_color,
    water_color: theme.water_color,
    land_color: theme.land_color,
    base_tile_style: theme.base_tile_style,
    contour_color: theme.contour_color,
    contour_major_color: theme.contour_major_color,
  })
  emit('update:modelValue', { ...local })
}

const fontGroups: Array<{ label: string; fonts: FontFamily[] }> = [
  { label: 'SANS', fonts: ['DM Sans', 'Space Grotesk', 'Montserrat', 'Oswald', 'Raleway'] },
  { label: 'SERIF', fonts: ['Playfair Display', 'Lora', 'Cormorant Garamond'] },
  { label: 'DISPLAY', fonts: ['Bebas Neue', 'Anton'] },
]

const BORDERS: Array<{ label: string; value: BorderStyle }> = [
  { label: 'None', value: 'none' },
  { label: 'Thin', value: 'thin' },
  { label: 'Thick', value: 'thick' },
]

const TILE_STYLES: Array<{ label: string; value: BaseTileStyle }> = [
  { label: 'Light', value: 'carto-light' },
  { label: 'Dark', value: 'carto-dark' },
  { label: 'Outdoor', value: 'maptiler-outdoor' },
  { label: 'Topo', value: 'maptiler-topo' },
  { label: 'Winter', value: 'maptiler-winter' },
]
</script>

<!-- ─── Sub-components ─────────────────────────────────────────────────────── -->

<script lang="ts">
export const Section = defineComponent({
  props: { label: String, icon: String },
  setup(props, { slots }) {
    const open = ref(true)
    return () => h('div', { class: 'px-5 py-3' }, [
      h('button', {
        class: 'flex items-center justify-between w-full mb-3 group',
        onClick: () => { open.value = !open.value },
      }, [
        h('div', { class: 'flex items-center gap-1.5' }, [
          h(resolveComponent('UIcon'), { name: props.icon, class: 'w-3.5 h-3.5 text-gray-400' }),
          h('span', { class: 'text-xs font-semibold text-gray-500 uppercase tracking-wider' }, props.label),
        ]),
        h(resolveComponent('UIcon'), {
          name: open.value ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down',
          class: 'w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors',
        }),
      ]),
      open.value && slots.default ? h('div', slots.default()) : null,
    ])
  },
})

export const ToggleRow = defineComponent({
  props: { label: String, value: Boolean },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'flex items-center justify-between cursor-pointer' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('button', {
        class: ['relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none',
          props.value ? 'bg-green-600' : 'bg-gray-200'],
        onClick: () => emit('change', !props.value),
      }, [
        h('span', {
          class: ['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            props.value ? 'translate-x-4' : 'translate-x-0'],
        }),
      ]),
    ])
  },
})

export const SliderRow = defineComponent({
  props: {
    label: String,
    value: Number,
    min: Number,
    max: Number,
    step: Number,
    display: { type: Function as PropType<(v: number) => string | number>, default: null },
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'space-y-1' }, [
      h('div', { class: 'flex items-center justify-between' }, [
        h('span', { class: 'text-xs text-gray-600' }, props.label),
        h('span', { class: 'text-xs text-gray-400 tabular-nums' }, props.display?.(props.value ?? 0) ?? props.value),
      ]),
      h('input', {
        type: 'range', min: props.min, max: props.max, step: props.step, value: props.value,
        class: 'w-full h-1 rounded-full appearance-none bg-gray-200 accent-green-600 cursor-pointer',
        onInput: (e: Event) => emit('change', parseFloat((e.target as HTMLInputElement).value)),
      }),
    ])
  },
})

export const ColorRow = defineComponent({
  props: { label: String, value: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('label', { class: 'flex items-center gap-2 cursor-pointer' }, [
        h('span', { class: 'text-xs text-gray-400 font-mono' }, props.value?.toUpperCase()),
        h('input', {
          type: 'color', value: props.value,
          class: 'w-7 h-7 rounded cursor-pointer border border-gray-200 p-0.5 bg-white',
          onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
        }),
      ]),
    ])
  },
})

export const ColorSwatch = defineComponent({
  props: { value: String, title: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('label', { class: 'cursor-pointer', title: props.title }, [
      h('div', {
        class: 'w-6 h-6 rounded border-2 border-white ring-1 ring-gray-200 shadow-sm',
        style: { backgroundColor: props.value },
      }),
      h('input', {
        type: 'color', value: props.value, class: 'sr-only',
        onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

export const TextRow = defineComponent({
  props: { label: String, value: String, placeholder: String },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', { class: 'space-y-1' }, [
      h('span', { class: 'text-xs text-gray-600' }, props.label),
      h('input', {
        type: 'text', value: props.value, placeholder: props.placeholder,
        class: 'w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500',
        onInput: (e: Event) => emit('change', (e.target as HTMLInputElement).value),
      }),
    ])
  },
})

export const PresetButton = defineComponent({
  props: { label: String, active: Boolean },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      class: ['flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 text-xs font-medium transition-all',
        props.active ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'],
      onClick: () => emit('click'),
    }, slots.default?.())
  },
})

export const FontButton = defineComponent({
  props: { label: String, font: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      class: ['py-1.5 px-2 rounded border text-xs transition-all text-center',
        props.active ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'],
      style: { fontFamily: props.font },
      onClick: () => emit('click'),
    }, props.label)
  },
})

export const SegmentButton = defineComponent({
  props: { label: String, active: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      class: ['py-1.5 rounded border text-xs font-medium transition-all',
        props.active ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'],
      onClick: () => emit('click'),
    }, props.label)
  },
})
</script>
