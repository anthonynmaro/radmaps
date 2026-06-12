<template>
  <!--
    EDITOR-V2 D4 — band-domain control rows for the unified ElementToolbar
    (docs/EDITOR_UX_NORTH_STAR.md gesture 5: click empty band space → band
    properties). Writes ride the EXISTING poster_layout band paths
    (updateChromeBand background/padding; resetChromeBand for the per-band
    reset-to-template), so theme reset and undo semantics are unchanged.
  -->
  <div class="band-controls">
    <div class="toolbar-row">
      <span class="row-label">Background</span>
      <span class="toolbar-row-spacer" />
      <label class="toolbar-color" title="Band background color">
        <input
          type="color"
          :value="background"
          data-testid="band-background-color"
          @input="$emit('patch', { background: ($event.target as HTMLInputElement).value })"
        />
      </label>
    </div>

    <div class="toolbar-row">
      <span class="row-label">Padding</span>
      <span class="toolbar-row-spacer" />
      <div class="pad-group" aria-label="Vertical padding">
        <span class="pad-axis" title="Top & bottom padding">↕</span>
        <button class="pad-btn" data-testid="band-pad-v-minus" title="Less vertical padding" @click="$emit('nudge-padding', { axis: 'vertical', delta: -0.5 })">−</button>
        <button class="pad-btn" data-testid="band-pad-v-plus" title="More vertical padding" @click="$emit('nudge-padding', { axis: 'vertical', delta: 0.5 })">+</button>
      </div>
      <div class="pad-group" aria-label="Horizontal padding">
        <span class="pad-axis" title="Left & right padding">↔</span>
        <button class="pad-btn" data-testid="band-pad-h-minus" title="Less horizontal padding" @click="$emit('nudge-padding', { axis: 'horizontal', delta: -0.5 })">−</button>
        <button class="pad-btn" data-testid="band-pad-h-plus" title="More horizontal padding" @click="$emit('nudge-padding', { axis: 'horizontal', delta: 0.5 })">+</button>
      </div>
    </div>

    <div class="toolbar-row toolbar-row--actions">
      <button
        class="toolbar-action"
        :disabled="!canReset"
        :title="canReset ? 'Restore this band to the theme template' : 'This band already matches the theme template'"
        data-testid="band-reset"
        @click="$emit('reset')"
      >
        Reset to template
      </button>
      <span class="toolbar-row-spacer" />
      <button class="toolbar-action" data-testid="band-done" @click="$emit('done')">Done</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** Current effective band background (override or theme value). */
  background: string
  /** True when the band carries any poster_layout override to reset. */
  canReset: boolean
}>()

defineEmits<{
  patch: [patch: { background: string }]
  'nudge-padding': [payload: { axis: 'vertical' | 'horizontal'; delta: number }]
  reset: []
  done: []
}>()
</script>

<style scoped>
.band-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-row--actions { margin-top: 2px; }
.toolbar-row-spacer { flex: 1; }

.row-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #78716c;
  flex-shrink: 0;
}

.toolbar-color {
  display: inline-flex;
  width: 26px;
  height: 26px;
  border: 1px solid #e7e5e4;
  border-radius: 7px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}

.toolbar-color input {
  width: 34px;
  height: 34px;
  margin: -4px;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.pad-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 2px 4px;
}

.pad-axis {
  font-size: 11px;
  color: #78716c;
  padding: 0 2px;
}

.pad-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1c1917;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pad-btn:hover { background: #f5f5f4; }

.toolbar-action {
  padding: 5px 10px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #1c1917;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.toolbar-action:hover:not(:disabled) { background: #f5f5f4; }
.toolbar-action:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
