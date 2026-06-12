<template>
  <!--
    EDITOR-V2 D3 — object-domain control rows for the unified ElementToolbar:
    icon overlays and image assets (the two element kinds that joined the
    grammar at D3; they were deliberately excluded from D1). Patches ride the
    EXISTING poster-element write path (patchPosterEditorElement via
    poster-element-patched), move/resize/rotate stay with Moveable — this is
    presentation only, no new persistence.
  -->
  <div class="object-controls">
    <div class="toolbar-row">
      <!-- Icon swap (icons only) -->
      <div v-if="kind === 'icon'" class="icon-swap-group" aria-label="Icon">
        <button
          v-for="option in iconOptions"
          :key="option.id"
          class="icon-swap-btn"
          :class="{ active: icon === option.id }"
          type="button"
          :title="option.label"
          :data-testid="`object-icon-${option.id}`"
          @click="emitPatch({ icon: option.id })"
        >
          <svg :viewBox="option.viewBox" width="14" height="14" aria-hidden="true">
            <path v-for="path in option.paths" :key="path" :d="path" fill="currentColor" />
          </svg>
        </button>
      </div>

      <label v-if="kind === 'icon'" class="toolbar-color" title="Icon color">
        <input
          type="color"
          :value="color"
          data-testid="object-color"
          @input="emitPatch({ color: ($event.target as HTMLInputElement).value })"
        />
      </label>
    </div>

    <div class="toolbar-row">
      <span class="row-label">Opacity</span>
      <input
        class="opacity-slider"
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        :value="opacity"
        aria-label="Opacity"
        data-testid="object-opacity"
        @input="emitPatch({ opacity: Number(($event.target as HTMLInputElement).value) })"
      />
      <span class="row-value">{{ Math.round(opacity * 100) }}%</span>
    </div>

    <div v-if="kind === 'asset'" class="toolbar-row">
      <label class="bleed-toggle" title="Let the image extend past the poster edge (full-bleed art)">
        <input
          type="checkbox"
          :checked="allowBleed"
          data-testid="object-allow-bleed"
          @change="emitPatch({ allow_bleed: ($event.target as HTMLInputElement).checked })"
        />
        <span>Allow bleed off poster edge</span>
      </label>
    </div>

    <div class="toolbar-row toolbar-row--actions">
      <button class="toolbar-action toolbar-action--danger" data-testid="object-delete" @click="$emit('delete')">
        Delete
      </button>
      <span class="toolbar-row-spacer" />
      <button class="toolbar-action" data-testid="object-done" @click="$emit('done')">Done</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PosterIconId } from '~/types'
import type { PosterEditorElementPatch } from '~/utils/posterEditorElements'
import { POSTER_ICONS } from '~/utils/posterIcons'

defineProps<{
  kind: 'icon' | 'asset'
  opacity: number
  /** Icon overlays only. */
  color?: string
  icon?: PosterIconId
  /** Image assets only. */
  allowBleed?: boolean
}>()

const emit = defineEmits<{
  patch: [patch: PosterEditorElementPatch]
  delete: []
  done: []
}>()

const iconOptions = POSTER_ICONS

function emitPatch(patch: PosterEditorElementPatch) {
  emit('patch', patch)
}
</script>

<style scoped>
.object-controls {
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

.row-value {
  font-size: 10.5px;
  font-weight: 600;
  color: #44403c;
  min-width: 32px;
  text-align: right;
}

.opacity-slider { flex: 1; accent-color: #2d6a4f; }

.icon-swap-group { display: flex; gap: 3px; flex-wrap: wrap; flex: 1; }

.icon-swap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid #e7e5e4;
  border-radius: 7px;
  background: #ffffff;
  color: #57534e;
  cursor: pointer;
}

.icon-swap-btn.active {
  border-color: #2d6a4f;
  background: #dcebe2;
  color: #1f4d38;
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

.bleed-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #44403c;
  cursor: pointer;
}

.bleed-toggle input { accent-color: #2d6a4f; }

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

.toolbar-action--danger {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.3);
}

.toolbar-action--danger:hover { background: #fef2f2; }
.toolbar-action:hover { background: #f5f5f4; }
</style>
