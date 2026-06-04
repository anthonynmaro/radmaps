<template>
  <span class="product-mockup-preview">
    <img
      :src="templateImageUrl"
      :alt="label"
      class="product-mockup-preview__scene"
      draggable="false"
    >
    <span
      class="product-mockup-preview__artwork"
      :style="artworkStyle(overprintedArtworkBox(safeArtworkBox, finish, sceneFile), artworkUrl)"
      aria-hidden="true"
    />
    <img
      v-for="chrome in safeChromeBoxes"
      :key="chrome.id"
      :src="templateImageUrl"
      alt=""
      class="product-mockup-preview__chrome"
      :style="chromeStyle(chrome.box)"
      draggable="false"
    >
    <span
      v-if="finish === 'metallic'"
      class="product-mockup-preview__finish product-mockup-preview__finish--metallic"
      :style="finishStyle(safeArtworkBox, finish, sceneFile)"
      aria-hidden="true"
    />
    <span
      v-else-if="finish === 'acrylic'"
      class="product-mockup-preview__finish product-mockup-preview__finish--acrylic"
      :style="finishStyle(safeArtworkBox, finish, sceneFile)"
      aria-hidden="true"
    />
    <span
      v-for="rivet in acrylicRivetBoxes(safeArtworkBox, finish, sceneFile)"
      :key="rivet.id"
      class="product-mockup-preview__rivet"
      :style="rivetStyle(rivet.box)"
      aria-hidden="true"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getOverprintedProductMockupArtworkBox } from '~/utils/productMockupGeometry'
import { getProductMockupAcrylicRivetBoxes } from '~/utils/productMockupHardware'

type Box = {
  x: number
  y: number
  w: number
  h: number
}

type ChromeBox = {
  id: string
  box: Box
}

const props = withDefaults(defineProps<{
  templateImageUrl: string
  artworkUrl: string
  artworkBox: Box
  chromeBoxes?: ChromeBox[]
  label?: string
  finish?: string
  sceneFile?: string
}>(), {
  chromeBoxes: () => [],
  label: 'Wall mockup preview',
  finish: 'paper',
  sceneFile: '',
})

const FALLBACK_ARTWORK_BOX: Box = { x: 0, y: 0, w: 1, h: 1 }

const safeArtworkBox = computed(() =>
  isBox(props.artworkBox) ? props.artworkBox : FALLBACK_ARTWORK_BOX
)

const safeChromeBoxes = computed(() =>
  Array.isArray(props.chromeBoxes)
    ? props.chromeBoxes.filter(chrome => chrome?.id && isBox(chrome.box))
    : []
)

function pct(value: number): string {
  return `${value * 100}%`
}

function isBox(value: unknown): value is Box {
  if (!value || typeof value !== 'object') return false
  const box = value as Partial<Box>
  return [box.x, box.y, box.w, box.h].every(number => typeof number === 'number' && Number.isFinite(number))
}

function overprintedArtworkBox(box: Box, finish?: string, sceneFile?: string): Box {
  return getOverprintedProductMockupArtworkBox(box, finish, sceneFile)
}

function boxStyle(box: Box) {
  return {
    left: pct(box.x),
    top: pct(box.y),
    width: pct(box.w),
    height: pct(box.h),
  }
}

function artworkStyle(box: Box, url: string) {
  return {
    ...boxStyle(box),
    backgroundImage: `url("${url}")`,
    backgroundSize: '100% 100%',
  }
}

function finishStyle(box: Box, finish?: string, sceneFile?: string) {
  return boxStyle(overprintedArtworkBox(box, finish, sceneFile))
}

function acrylicRivetBoxes(box: Box, finish?: string, sceneFile?: string) {
  return getProductMockupAcrylicRivetBoxes(box, finish, sceneFile)
}

function chromeStyle(box: Box) {
  return {
    clipPath: `inset(${pct(box.y)} ${pct(1 - box.x - box.w)} ${pct(1 - box.y - box.h)} ${pct(box.x)})`,
  }
}

function rivetStyle(box: Box) {
  return boxStyle(box)
}

</script>

<style scoped>
.product-mockup-preview {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #f5f3ef;
}

.product-mockup-preview__scene,
.product-mockup-preview__chrome {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.product-mockup-preview__scene {
  z-index: 1;
}

.product-mockup-preview__artwork {
  position: absolute;
  z-index: 2;
  background-position: center;
  background-repeat: no-repeat;
}

.product-mockup-preview__chrome {
  z-index: 3;
  pointer-events: none;
}

.product-mockup-preview__finish {
  position: absolute;
  z-index: 4;
  pointer-events: none;
}

.product-mockup-preview__rivet {
  position: absolute;
  z-index: 5;
  border-radius: 999px;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.98) 0 8%, rgba(255, 255, 255, 0) 24%),
    repeating-conic-gradient(from 28deg, rgba(255, 255, 255, 0.34) 0deg 7deg, rgba(92, 96, 96, 0.34) 8deg 13deg, rgba(221, 224, 222, 0.32) 14deg 20deg),
    radial-gradient(circle at 50% 50%, #d7d9d6 0 42%, #a8aca9 58%, #565b5e 78%, #2c3033 100%);
  background-blend-mode: screen, overlay, normal;
  box-shadow:
    0 0.08em 0.18em rgba(0, 0, 0, 0.34),
    0 0 0 0.04em rgba(255, 255, 255, 0.52) inset,
    0 -0.05em 0.08em rgba(0, 0, 0, 0.28) inset;
}

.product-mockup-preview__finish--metallic {
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0) 36%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(20, 20, 20, 0.08));
  mix-blend-mode: screen;
}

.product-mockup-preview__finish--acrylic {
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0) 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
}

</style>
