<template>
  <div class="product-mockup-preview">
    <img
      :src="templateImageUrl"
      :alt="label"
      class="product-mockup-preview__scene"
      draggable="false"
    >
    <img
      :src="artworkUrl"
      alt=""
      class="product-mockup-preview__artwork"
      :style="boxStyle(artworkBox)"
      draggable="false"
    >
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
    <img
      v-if="renderedUrl"
      :src="renderedUrl"
      :alt="label"
      class="product-mockup-preview__rendered"
      draggable="false"
    >
  </div>
</template>

<script setup lang="ts">
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
  renderedUrl?: string | null
  label?: string
  finish?: string
}>(), {
  chromeBoxes: () => [],
  renderedUrl: null,
  label: 'Wall mockup preview',
  finish: 'paper',
})

function pct(value: number): string {
  return `${value * 100}%`
}

function boxStyle(box: Box) {
  return {
    left: pct(box.x),
    top: pct(box.y),
    width: pct(box.w),
    height: pct(box.h),
  }
}

function chromeStyle(box: Box) {
  return {
    clipPath: `inset(${pct(box.y)} ${pct(1 - box.x - box.w)} ${pct(1 - box.y - box.h)} ${pct(box.x)})`,
  }
}
</script>

<style scoped>
.product-mockup-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f3ef;
}

.product-mockup-preview__scene,
.product-mockup-preview__chrome,
.product-mockup-preview__rendered {
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
  object-fit: fill;
  user-select: none;
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

.product-mockup-preview__rendered {
  z-index: 5;
}
</style>
