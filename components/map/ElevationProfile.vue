<template>
  <div
    class="pointer-events-none overflow-hidden"
    :class="rootClass"
    :style="rootStyle"
    data-testid="elevation-profile"
  >
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      class="w-full h-full"
      style="display: block;"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" :stop-opacity="opacity" />
          <stop offset="100%" :stop-color="color" :stop-opacity="bottomOpacity" />
        </linearGradient>
      </defs>
      <path v-if="profile" :d="profile.svgPath" :fill="`url(#${gradientId})`" />
      <path
        v-if="profile"
        :d="profile.strokePath"
        :stroke="color"
        :stroke-opacity="opacity"
        :stroke-width="strokeWidth"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <!-- Min / max elevation labels — sized in cqh so they scale with the poster -->
    <template v-if="profile && showLabels">
      <span
        class="absolute bottom-[6%] left-[1%] leading-none font-semibold"
        style="font-size: 1.1cqh; letter-spacing: 0.06em;"
        :style="{ color, opacity }"
      >{{ fmtElev(profile.minElev) }}</span>
      <span
        class="absolute leading-none font-semibold"
        style="font-size: 1.1cqh; letter-spacing: 0.06em; top: 2%; right: 1%;"
        :style="{ color, opacity }"
      >{{ fmtElev(profile.maxElev) }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildElevationProfile } from '~/utils/trail'
import { resolveTonerRouteStyle } from '~/utils/mapStyle'
import type { TrailMap, StyleConfig } from '~/types'

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
  placement?: 'map-overlay' | 'separate-band'
}>()

const gradientId = `elev-grad-${Math.random().toString(36).slice(2, 8)}`

const color = computed(() => props.styleConfig.elevation_profile_color || resolveTonerRouteStyle(props.styleConfig).route_color || '#C1121F')
const opacity = computed(() => clampNumber(props.styleConfig.elevation_profile_opacity ?? 0.65, 0, 1))
const placement = computed(() => props.placement ?? props.styleConfig.elevation_profile_position ?? 'map-overlay')
const heightValue = computed(() => props.styleConfig.elevation_profile_height ?? (placement.value === 'separate-band' ? 12 : 22))
const relief = computed(() => clampNumber(props.styleConfig.elevation_profile_relief ?? 0.65, 0.35, 1))
const bottomOpacity = computed(() => opacity.value >= 0.995 ? 1 : opacity.value * 0.18)
const strokeWidth = 1.15
const showLabels = computed(() => heightValue.value >= 14)
const rootClass = computed(() => placement.value === 'map-overlay'
  ? 'absolute bottom-0 inset-x-0'
  : 'relative w-full h-full')
const rootStyle = computed(() => ({
  zIndex: placement.value === 'map-overlay' ? 12 : 1,
  height: placement.value === 'map-overlay' ? `${heightValue.value}%` : '100%',
  backgroundColor: placement.value === 'separate-band'
    ? props.styleConfig.label_bg_color ?? props.styleConfig.background_color
    : 'transparent',
}))

const profile = computed(() =>
  buildElevationProfile(props.map.geojson as GeoJSON.FeatureCollection, 250, relief.value),
)

function fmtElev(m: number): string {
  return `${Math.round(m * 3.28084).toLocaleString()} ft`
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
</script>
