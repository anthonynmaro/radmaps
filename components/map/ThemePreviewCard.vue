<template>
  <button
    ref="cardEl"
    type="button"
    class="theme-preview-card"
    :class="{ 'is-selected': selected }"
    :data-theme-id="theme.id"
    data-testid="theme-preview-card"
    @click="emit('select', theme.id)"
  >
    <div
      class="theme-preview-frame"
      :style="{ backgroundColor: theme.background_color }"
    >
      <ClientOnly>
        <MapPreview
          v-if="liveEnabled"
          :key="`live-${theme.id}`"
          :map="map"
          :style-config="previewConfig"
          :editable="false"
          class="theme-preview-live"
        />
        <template #fallback>
          <ThemePlaceholder
            :theme="theme"
            :route-width="previewRouteWidth"
            :route-opacity="previewRouteOpacity"
            :path="routePath"
            :point="routePoint"
            :title="posterTitle"
          />
        </template>
      </ClientOnly>
      <ThemePlaceholder
        v-if="!liveEnabled"
        :theme="theme"
        :route-width="previewRouteWidth"
        :route-opacity="previewRouteOpacity"
        :path="routePath"
        :point="routePoint"
        :title="posterTitle"
      />
      <span v-if="selected" class="theme-check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>
    <span class="theme-card-meta">
      <span class="theme-card-label">{{ theme.label }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue'
import type { ColorTheme, StyleConfig, ThemeDefinition, TrailMap } from '~/types'
import MapPreview from '~/components/map/MapPreview.vue'
import { getThemeFontPreview, getThemeThumbnailProfile } from '~/utils/themeOptions'

const props = defineProps<{
  map: TrailMap
  theme: ThemeDefinition
  previewConfig: StyleConfig
  selected?: boolean
  liveEnabled?: boolean
}>()

const emit = defineEmits<{
  select: [themeId: ColorTheme]
  visible: [themeId: ColorTheme]
}>()

const cardEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const posterTitle = computed(() =>
  props.previewConfig.trail_name || props.map.title || 'Trail Map',
)

const routeGeometry = computed(() => routePreviewGeometry(props.map.geojson as GeoJSON.FeatureCollection | undefined))
const routePath = computed(() => routeGeometry.value.path)
const routePoint = computed(() => routeGeometry.value.point)
const previewRouteWidth = computed(() => {
  const configuredWidth = props.previewConfig.route_width ?? 3
  return Math.min(2.2, Math.max(1.15, configuredWidth * 0.42))
})
const previewRouteOpacity = computed(() => Math.min(0.92, Math.max(0.55, props.previewConfig.route_opacity ?? 0.9)))

onMounted(() => {
  if (!cardEl.value || typeof IntersectionObserver === 'undefined') {
    emit('visible', props.theme.id)
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      emit('visible', props.theme.id)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '240px 0px' })

  observer.observe(cardEl.value)
})

onBeforeUnmount(() => observer?.disconnect())

function routePreviewGeometry(geojson?: GeoJSON.FeatureCollection): {
  path: string
  point: { x: number; y: number } | null
} {
  const coords = firstRenderableCoords(geojson)
  if (coords.length === 1) {
    return { path: '', point: projectCoords(coords)[0] ?? { x: 50, y: 70 } }
  }
  if (coords.length < 2) return { path: '', point: null }

  const points = projectCoords(coords)
  return {
    path: points.map((pt, index) => `${index === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' '),
    point: null,
  }
}

function firstRenderableCoords(geojson?: GeoJSON.FeatureCollection): number[][] {
  for (const feature of geojson?.features ?? []) {
    const geometry = feature.geometry
    if (geometry.type === 'LineString' && geometry.coordinates.length) return geometry.coordinates as number[][]
    if (geometry.type === 'MultiLineString') {
      const line = geometry.coordinates.find(coords => coords.length)
      if (line) return line as number[][]
    }
    if (geometry.type === 'Point') return [geometry.coordinates as number[]]
  }
  return []
}

function projectCoords(coords: number[][]) {
  const lngs = coords.map(coord => coord[0] ?? 0)
  const lats = coords.map(coord => coord[1] ?? 0)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const midLat = (minLat + maxLat) / 2
  const lngScale = Math.max(0.1, Math.cos((midLat * Math.PI) / 180))
  const rawPoints = coords.map(coord => ({
    x: ((coord[0] ?? minLng) - minLng) * lngScale,
    y: (coord[1] ?? minLat) - minLat,
  }))
  const rawMinX = Math.min(...rawPoints.map(point => point.x))
  const rawMaxX = Math.max(...rawPoints.map(point => point.x))
  const rawMinY = Math.min(...rawPoints.map(point => point.y))
  const rawMaxY = Math.max(...rawPoints.map(point => point.y))
  const rawWidth = Math.max(0.000001, rawMaxX - rawMinX)
  const rawHeight = Math.max(0.000001, rawMaxY - rawMinY)
  const box = { x: 14, y: 14, width: 72, height: 72 }
  const scale = Math.min(box.width / rawWidth, box.height / rawHeight)
  const rawCenterX = (rawMinX + rawMaxX) / 2
  const rawCenterY = (rawMinY + rawMaxY) / 2
  const boxCenterX = box.x + box.width / 2
  const boxCenterY = box.y + box.height / 2

  return rawPoints.map(point => ({
    x: boxCenterX + (point.x - rawCenterX) * scale,
    y: boxCenterY - (point.y - rawCenterY) * scale,
  }))
}

const ThemePlaceholder = defineComponent({
  props: {
    theme: { type: Object as () => ThemeDefinition, required: true },
    routeWidth: { type: Number, default: 1.8 },
    routeOpacity: { type: Number, default: 0.85 },
    path: { type: String, default: '' },
    point: { type: Object as () => { x: number; y: number } | null, default: null },
    title: { type: String, required: true },
  },
  setup(componentProps) {
    return () => {
      const thumb = getThemeThumbnailProfile(componentProps.theme)
      const titleText = componentProps.title.split(/\s+/).slice(0, 3).join(' ')
      const header = h('div', {
        class: 'theme-placeholder-header',
        style: {
          order: thumb.titlePosition === 'bottom' ? 1 : 0,
          alignItems: thumb.titleAlign === 'left' ? 'flex-start' : 'center',
          backgroundColor: thumb.headerBackground === 'label' ? componentProps.theme.label_bg_color : componentProps.theme.background_color,
        },
      }, [
        h('span', {
          style: {
            color: componentProps.theme.label_text_color,
            fontFamily: getThemeFontPreview(componentProps.theme),
            fontSize: thumb.fontSize,
            fontWeight: thumb.fontWeight,
            letterSpacing: thumb.letterSpacing,
            textTransform: thumb.textTransform,
            lineHeight: thumb.lineHeight,
            textAlign: thumb.titleAlign === 'left' ? 'left' : 'center',
          },
        }, titleText),
      ])

      const map = h('div', {
        class: 'theme-placeholder-map',
        style: { order: thumb.titlePosition === 'bottom' ? 0 : 1 },
      }, [
        h('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid meet' }, [
          h('path', {
            d: 'M-6 78 C16 62 35 70 54 52 C72 34 88 36 108 18',
            fill: 'none',
            stroke: componentProps.theme.water_color,
            'stroke-width': '5.8',
            opacity: '0.12',
          }),
          h('path', {
            d: 'M6 26 C23 12 43 24 59 14 C77 3 91 9 101 0',
            fill: 'none',
            stroke: componentProps.theme.contour_major_color ?? componentProps.theme.label_text_color,
            'stroke-width': '0.7',
            opacity: '0.14',
          }),
          h('path', {
            d: 'M3 86 C21 70 39 92 58 60 C75 30 88 42 101 22',
            fill: 'none',
            stroke: componentProps.theme.contour_major_color ?? componentProps.theme.label_text_color,
            'stroke-width': '0.8',
            opacity: '0.16',
          }),
          h('path', {
            d: '-4 63 C20 52 42 59 63 42 C80 28 95 30 105 18',
            fill: 'none',
            stroke: componentProps.theme.water_color,
            'stroke-width': '2.8',
            opacity: '0.18',
          }),
          componentProps.path
            ? h('path', {
                d: componentProps.path,
                fill: 'none',
                stroke: componentProps.theme.route_color,
                'stroke-width': String(componentProps.routeWidth),
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                opacity: String(componentProps.routeOpacity),
              })
            : null,
          componentProps.point
            ? h('circle', {
                cx: componentProps.point.x,
                cy: componentProps.point.y,
                r: String(componentProps.routeWidth + 1),
                fill: componentProps.theme.route_color,
                opacity: String(componentProps.routeOpacity),
              })
            : null,
        ]),
      ])

      const footer = h('div', {
        class: 'theme-placeholder-footer',
        style: {
          order: 2,
          backgroundColor: thumb.footerBackground === 'label' ? componentProps.theme.label_bg_color : componentProps.theme.background_color,
        },
      }, h('span', { style: { backgroundColor: componentProps.theme.label_text_color } }))

      return h('div', {
        class: 'theme-placeholder',
        style: { backgroundColor: componentProps.theme.background_color },
      }, [header, map, footer])
    }
  },
})
</script>

<style>
.theme-preview-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.theme-preview-frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 2 / 3;
  width: 100%;
  border: 2px solid #e7e5e4;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(28, 25, 23, 0.05);
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.theme-preview-card:hover .theme-preview-frame,
.theme-preview-card.is-selected .theme-preview-frame {
  border-color: #2d6a4f;
  box-shadow: 0 10px 24px rgba(28, 25, 23, 0.12);
  transform: translateY(-2px);
}

.theme-preview-live {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.theme-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.theme-placeholder-header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 25%;
  padding: 9% 9% 5%;
  overflow: hidden;
}

.theme-placeholder-map {
  flex: 1;
  overflow: hidden;
}

.theme-placeholder-map svg {
  width: 100%;
  height: 100%;
  display: block;
}

.theme-placeholder-footer {
  display: flex;
  align-items: center;
  height: 13%;
  padding: 0 9%;
  border-top: 1px solid rgba(28, 25, 23, 0.08);
}

.theme-placeholder-footer span {
  display: block;
  width: 34%;
  height: 1px;
  opacity: 0.25;
}

.theme-check {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: #2d6a4f;
  color: white;
  box-shadow: 0 6px 16px rgba(28, 25, 23, 0.18);
}

.theme-check svg {
  width: 15px;
  height: 15px;
}

.theme-card-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #57534e;
}

.theme-card-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

</style>
