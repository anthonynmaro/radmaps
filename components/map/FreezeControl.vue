<template>
  <button
    class="freeze-pill"
    :class="{ 'is-frozen': frozen, 'map-hovered': mapHovered }"
    :title="frozen ? 'Unlock to reposition' : 'Lock map view'"
    @click="$emit(frozen ? 'unfreeze' : 'freeze')"
  >
    <span class="zoom-label">Zoom</span>

    <!-- Open lock — unlocked state -->
    <svg v-if="!frozen" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
      <rect x="4" y="9" width="12" height="9" rx="2"/>
      <path d="M7 9V6a3 3 0 016 0"/>
    </svg>

    <!-- Closed lock — frozen state -->
    <svg v-else viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
      <rect x="4" y="9" width="12" height="9" rx="2"/>
      <path d="M7 9V6a3 3 0 016 0v3"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  frozen: boolean
  mapHovered?: boolean
}>()

defineEmits<{
  freeze: []
  unfreeze: []
}>()
</script>

<style scoped>
.freeze-pill {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  color: #6B7280;
  cursor: pointer;
  pointer-events: auto;
  opacity: 0.6;
  transition: opacity 0.2s ease, background 0.15s, border-color 0.15s, color 0.15s;
}
.freeze-pill.map-hovered {
  opacity: 0.9;
}
.freeze-pill:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(0, 0, 0, 0.18);
}

.freeze-pill.is-frozen {
  background: rgba(22, 163, 74, 0.12);
  border-color: rgba(22, 163, 74, 0.4);
  color: #15803D;
}
.freeze-pill.is-frozen:hover {
  background: rgba(22, 163, 74, 0.2);
}

.zoom-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
  opacity: 0.65;
}


</style>
