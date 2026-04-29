<template>
  <div
    class="absolute bottom-0 inset-x-0 pointer-events-none"
    style="z-index: 12;"
    :style="{ height: heightCss }"
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
          <stop offset="100%" :stop-color="color" :stop-opacity="opacity * 0.15" />
        </linearGradient>
      </defs>
      <path v-if="profile" :d="profile.svgPath" :fill="`url(#${gradientId})`" />
      <path
        v-if="profile"
        :d="profile.strokePath"
        :stroke="color"
        :stroke-opacity="Math.min(1, opacity + 0.2)"
        stroke-width="2"
        fill="none"
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
import type { TrailMap, StyleConfig } from '~/types'

const props = defineProps<{
  map: TrailMap
  styleConfig: StyleConfig
}>()

const gradientId = `elev-grad-${Math.random().toString(36).slice(2, 8)}`

const color = computed(() => props.styleConfig.elevation_profile_color || props.styleConfig.route_color || '#C1121F')
const opacity = computed(() => props.styleConfig.elevation_profile_opacity ?? 0.65)
const heightCss = computed(() => `${props.styleConfig.elevation_profile_height ?? 22}%`)
const showLabels = computed(() => (props.styleConfig.elevation_profile_height ?? 22) >= 14)

const profile = computed(() =>
  buildElevationProfile(props.map.geojson as GeoJSON.FeatureCollection),
)

function fmtElev(m: number): string {
  return `${Math.round(m * 3.28084).toLocaleString()} ft`
}
</script>
