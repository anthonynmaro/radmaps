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
      :style="artworkStyle(overprintedArtworkBox(artworkBox, finish, sceneFile), artworkUrl)"
      aria-hidden="true"
    />
    <img
      v-for="chrome in chromeBoxes"
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
      :style="boxStyle(artworkBox)"
      aria-hidden="true"
    />
    <span
      v-else-if="finish === 'acrylic'"
      class="product-mockup-preview__finish product-mockup-preview__finish--acrylic"
      :style="boxStyle(artworkBox)"
      aria-hidden="true"
    />
  </span>
</template>

<script setup lang="ts">
import { getProductMockupArtworkBleedUnit } from '~/utils/productMockupGeometry'

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

withDefaults(defineProps<{
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

function pct(value: number): string {
  return `${value * 100}%`
}

function overprintedArtworkBox(box: Box, finish?: string, sceneFile?: string): Box {
  const bleed = getProductMockupArtworkBleedUnit(finish, sceneFile)

  return clampBox({
    x: box.x - bleed.left,
    y: box.y - bleed.top,
    w: box.w + bleed.left + bleed.right,
    h: box.h + bleed.top + bleed.bottom,
  })
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

function chromeStyle(box: Box) {
  return {
    clipPath: `inset(${pct(box.y)} ${pct(1 - box.x - box.w)} ${pct(1 - box.y - box.h)} ${pct(box.x)})`,
  }
}

function clampBox(box: Box): Box {
  const x = clamp(box.x, 0, 1)
  const y = clamp(box.y, 0, 1)

  return {
    x,
    y,
    w: clamp(box.w, 0.001, 1 - x),
    h: clamp(box.h, 0.001, 1 - y),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
