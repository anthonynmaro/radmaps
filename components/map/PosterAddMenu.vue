<template>
  <!--
    EDITOR-V2 D3 + ADD MENU (docs/EDITOR_UX_NORTH_STAR.md gesture 4).
    One + button → Text / Stat / Icon / Image. Editor-only chrome — the
    caller (MapPreview) gates the mount behind the unified grammar, so this
    never appears on /render pages and never prints.

    The Stat picker is data-bound: options come from the theme data contract
    (availablePosterStatBindings) — values without real data are simply not
    offered, so fabricated stats are not insertable by construction.
  -->
  <div class="poster-add-menu" data-testid="poster-add-menu" @pointerdown.stop @click.stop>
    <Transition name="add-menu-pop">
      <div v-if="open" class="add-menu-card" role="menu" aria-label="Add element">
        <!-- Stat submenu -->
        <div v-if="panel === 'stat'" class="add-submenu" data-testid="poster-add-stat-panel">
          <button
            v-for="option in statOptions"
            :key="option.binding"
            class="add-item"
            role="menuitem"
            :data-testid="`poster-add-stat-${option.binding}`"
            @click="onPickStat(option.binding)"
          >
            <span class="add-item-label">{{ option.label }}</span>
            <span class="add-item-preview">{{ option.value }}</span>
          </button>
          <p v-if="statOptions.length === 0" class="add-empty">
            No route data available for stats.
          </p>
          <button class="add-back" @click="panel = 'root'">&larr; Back</button>
        </div>

        <!-- Icon submenu -->
        <div v-else-if="panel === 'icon'" class="add-submenu add-submenu--icons" data-testid="poster-add-icon-panel">
          <button
            v-for="icon in iconOptions"
            :key="icon.id"
            class="add-icon-btn"
            role="menuitem"
            :title="icon.label"
            :data-testid="`poster-add-icon-${icon.id}`"
            @click="onPickIcon(icon.id)"
          >
            <svg :viewBox="icon.viewBox" width="18" height="18" aria-hidden="true">
              <path v-for="path in icon.paths" :key="path" :d="path" fill="currentColor" />
            </svg>
          </button>
          <button class="add-back" @click="panel = 'root'">&larr; Back</button>
        </div>

        <!-- Root menu -->
        <div v-else class="add-submenu" data-testid="poster-add-root-panel">
          <button class="add-item" role="menuitem" data-testid="poster-add-text" @click="onAddText">
            <span class="add-item-icon" aria-hidden="true">T</span>
            <span class="add-item-label">Text</span>
          </button>
          <button
            class="add-item"
            role="menuitem"
            data-testid="poster-add-stat"
            :disabled="statOptions.length === 0"
            :title="statOptions.length === 0 ? 'No route data available' : undefined"
            @click="panel = 'stat'"
          >
            <span class="add-item-icon" aria-hidden="true">#</span>
            <span class="add-item-label">Stat</span>
            <span class="add-item-chevron" aria-hidden="true">&rsaquo;</span>
          </button>
          <button class="add-item" role="menuitem" data-testid="poster-add-icon" @click="panel = 'icon'">
            <span class="add-item-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="13" height="13" aria-hidden="true">
                <path d="M2 26 L11 8 L16 16 L21 10 L30 26 Z" fill="currentColor"/>
              </svg>
            </span>
            <span class="add-item-label">Icon</span>
            <span class="add-item-chevron" aria-hidden="true">&rsaquo;</span>
          </button>
          <button class="add-item" role="menuitem" data-testid="poster-add-image" @click="onAddImage">
            <span class="add-item-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
              </svg>
            </span>
            <span class="add-item-label">Image</span>
          </button>
        </div>
      </div>
    </Transition>

    <button
      class="add-fab"
      :class="{ 'is-open': open }"
      type="button"
      :aria-expanded="open"
      aria-label="Add element"
      title="Add text, stat, icon, or image"
      data-testid="poster-add-button"
      @click="toggle"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
      </svg>
    </button>

    <!-- Hidden file input for the Image option; uploads ride the existing
         asset pipeline (server-side validation + quality classification). -->
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      data-testid="poster-add-image-input"
      @change="onFilePicked"
    >
  </div>
</template>

<script setup lang="ts">
import type { PosterIconId, PosterStatBinding } from '~/types'
import type { PosterStatOption } from '~/utils/posterEditorElements'
import { POSTER_ICONS } from '~/utils/posterIcons'

defineProps<{
  statOptions: PosterStatOption[]
}>()

const emit = defineEmits<{
  'add-text': []
  'add-stat': [binding: PosterStatBinding]
  'add-icon': [icon: PosterIconId]
  'add-image': [file: File]
}>()

const open = ref(false)
const panel = ref<'root' | 'stat' | 'icon'>('root')
const fileInput = ref<HTMLInputElement | null>(null)

const iconOptions = computed(() => POSTER_ICONS)

function toggle() {
  open.value = !open.value
  panel.value = 'root'
}

function close() {
  open.value = false
  panel.value = 'root'
}

function onAddText() {
  emit('add-text')
  close()
}

function onPickStat(binding: PosterStatBinding) {
  emit('add-stat', binding)
  close()
}

function onPickIcon(icon: PosterIconId) {
  emit('add-icon', icon)
  close()
}

function onAddImage() {
  fileInput.value?.click()
}

function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('add-image', file)
  input.value = ''
  close()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return
  if (event.target instanceof Node && event.composedPath().some(node =>
    node instanceof HTMLElement && node.classList?.contains('poster-add-menu'))) return
  close()
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true))
onUnmounted(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true))
</script>

<style scoped>
.poster-add-menu {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 40; /* above band dividers (30) and poster chrome */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.add-fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1.5px solid rgba(45, 106, 79, 0.55);
  background: rgba(255, 255, 255, 0.95);
  color: #2d6a4f;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(28, 25, 23, 0.22);
  backdrop-filter: blur(6px);
  transition: transform 140ms ease, background 140ms ease;
}

.add-fab:hover { background: #ffffff; transform: scale(1.06); }
.add-fab.is-open { transform: rotate(45deg); background: #2d6a4f; color: #ffffff; }

.add-menu-card {
  min-width: 168px;
  padding: 6px;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 16px 44px rgba(28, 25, 23, 0.18);
  backdrop-filter: blur(10px);
}

.add-submenu { display: flex; flex-direction: column; gap: 2px; }

.add-submenu--icons {
  flex-direction: row;
  flex-wrap: wrap;
  max-width: 168px;
  gap: 4px;
}

.add-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #1c1917;
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.add-item:hover:not(:disabled) { background: #f5f5f4; }
.add-item:disabled { opacity: 0.45; cursor: not-allowed; }

.add-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #dcebe2;
  color: #2d6a4f;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.add-item-label { flex: 1; }
.add-item-chevron { color: #a8a29e; font-size: 14px; }

.add-item-preview {
  color: #78716c;
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

.add-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #44403c;
  cursor: pointer;
}

.add-icon-btn:hover { border-color: #2d6a4f; background: #dcebe2; color: #1f4d38; }

.add-back {
  margin-top: 2px;
  padding: 5px 9px;
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #78716c;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.add-back:hover { background: #f5f5f4; }

.add-empty {
  margin: 0;
  padding: 7px 9px;
  color: #78716c;
  font-size: 11.5px;
}

.add-menu-pop-enter-active, .add-menu-pop-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.add-menu-pop-enter-from, .add-menu-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.97); }

.hidden { display: none; }
</style>
