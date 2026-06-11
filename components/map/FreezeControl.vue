<template>
  <button
    class="freeze-pill"
    :class="{ 'is-frozen': frozen, 'map-hovered': mapHovered }"
    :title="title"
    @click="toggleFreeze"
    style="position: static;"
  >
    <span class="zoom-label">View</span>

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
import { FLAGS } from '~/utils/knownFlags'

const props = defineProps<{
  frozen: boolean
  mapHovered?: boolean
}>()

const emit = defineEmits<{
  freeze: []
  unfreeze: []
}>()

// Editor-v2 reframes the freeze toggle (docs/STYLE_SYSTEM_EVOLUTION.md "Camera
// vs selection"): frozen = selection mode, unfrozen = camera mode. Tooltip only;
// behavior is unchanged.
const editorV2Enabled = useFeatureFlag(FLAGS.EDITOR_V2)
const title = computed(() => {
  if (editorV2Enabled.value) {
    return props.frozen
      ? 'Selection mode — click map elements; unlock to pan & zoom'
      : 'Camera mode — pan & zoom; lock the view to select map elements'
  }
  return props.frozen ? 'Edit map view' : 'Set current map view'
})

function toggleFreeze() {
  if (props.frozen) emit('unfreeze')
  else emit('freeze')
}
</script>

<style scoped>
.freeze-pill {
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
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.freeze-pill:hover {
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
