<template>
  <!-- Floating freeze control — bottom-right of map container, editable mode only -->
  <div class="freeze-control" :class="{ 'is-frozen': frozen }">
    <template v-if="!frozen">
      <button class="freeze-btn" title="Lock the map position and zoom for precise tile processing" @click="$emit('freeze')">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
          <rect x="5" y="9" width="10" height="8" rx="1.5"/>
          <path d="M7 9V6.5a3 3 0 016 0V9"/>
        </svg>
        <span>Freeze View</span>
      </button>
    </template>
    <template v-else>
      <div class="frozen-badge">
        <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11" style="opacity:0.9">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
        </svg>
        <span>Frozen</span>
        <span v-if="zoom != null" class="zoom-label">Z {{ zoom.toFixed(1) }}</span>
      </div>
      <button class="recompose-btn" title="Unlock the map to reposition" @click="$emit('unfreeze')">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11">
          <path d="M13 3l4 4-4 4M17 7H8a4 4 0 000 8h1"/>
        </svg>
        Recompose
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  frozen: boolean
  zoom?: number
}>()

defineEmits<{
  freeze: []
  unfreeze: []
}>()
</script>

<style scoped>
.freeze-control {
  position: absolute;
  bottom: 28px;
  right: 10px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.freeze-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
  line-height: 1;
}
.freeze-btn:hover {
  background: rgba(255, 255, 255, 0.97);
  border-color: rgba(0, 0, 0, 0.2);
}

.frozen-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  background: #16a34a;
  border-radius: 6px 0 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  line-height: 1;
}

.zoom-label {
  opacity: 0.75;
  font-weight: 400;
  margin-left: 2px;
}

.recompose-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(22, 163, 74, 0.4);
  border-left: none;
  border-radius: 0 6px 6px 0;
  font-size: 10px;
  font-weight: 500;
  color: #15803d;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  line-height: 1;
}
.recompose-btn:hover {
  background: rgba(240, 253, 244, 0.97);
}
</style>
