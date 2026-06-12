<template>
  <!--
    EDITOR-V2 D1 UNIFIED FLOATING TOOLBAR SHELL (docs/EDITOR_UX_NORTH_STAR.md
    gesture 1). One visual language for every selectable element — poster text
    slots, free overlays, and map elements all present through this card:
    domain badge + display name + close, then per-domain control rows in the
    default slot. The styling is lifted from the E3/E4 MapSelectionOverlay
    card (white blur card, stone palette, pill kind badge).

    Editor-only chrome behind FLAGS.EDITOR_V2 — callers gate the mount. Never
    mounted on /render pages, never prints.
  -->
  <Teleport to="body">
    <div
      ref="cardRef"
      class="element-toolbar"
      :class="{ 'is-mobile': mobilePinned }"
      :style="cardStyle"
      v-bind="$attrs"
      @pointerdown.stop
      @click.stop
    >
      <div class="toolbar-header">
        <span class="element-kind" data-testid="element-toolbar-kind">{{ kindLabel }}</span>
        <!-- #name lets a domain swap in an inline editor (e.g. segment rename input). -->
        <slot name="name">
          <span v-if="displayName" class="element-name" :title="displayName">{{ displayName }}</span>
          <span v-else class="element-name-spacer" />
        </slot>
        <button class="toolbar-icon-btn" title="Close" data-testid="element-toolbar-close" @click="$emit('close')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Domain badge text, e.g. 'Trail name', 'Trail segment', 'Route'. */
  kindLabel: string
  /** Read-only display name shown beside the badge (omit when using #name). */
  displayName?: string
  /** Viewport-space point anchor (map-projected selections). */
  anchorPoint?: { x: number; y: number } | null
  /** Element bounding rect anchor (poster DOM selections). */
  anchorRect?: DOMRect | null
  /** Card width in px. */
  width?: number
  /** Flip-above estimate before the card has rendered. */
  estimatedHeight?: number
  /** Pin to the bottom edge on small screens (InlineTextToolbar parity). */
  allowMobilePin?: boolean
}>(), {
  displayName: '',
  anchorPoint: null,
  anchorRect: null,
  width: 300,
  estimatedHeight: 120,
  allowMobilePin: false,
})

defineEmits<{ close: [] }>()

const cardRef = ref<HTMLElement | null>(null)
const isMobileViewport = ref(false)
const viewportBottomInset = ref(0)
// Bumped on resize so cardStyle recomputes against the live viewport.
const viewportTick = ref(0)

const mobilePinned = computed(() => props.allowMobilePin && isMobileViewport.value)

function syncViewport() {
  isMobileViewport.value = window.matchMedia('(max-width: 767px)').matches
  const vv = window.visualViewport
  viewportBottomInset.value = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
  viewportTick.value++
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('resize', syncViewport)
  window.visualViewport?.addEventListener('scroll', syncViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
})

const cardStyle = computed<Record<string, string>>(() => {
  void viewportTick.value

  if (mobilePinned.value) {
    const style: Record<string, string> = {
      left: '12px',
      right: '12px',
      bottom: `${viewportBottomInset.value + 12}px`,
      width: 'auto',
    }
    return style
  }

  const anchor = props.anchorRect
    ? {
        x: props.anchorRect.left + props.anchorRect.width / 2,
        topY: props.anchorRect.top,
        bottomY: props.anchorRect.bottom,
        gap: 10,
      }
    : props.anchorPoint
      ? { x: props.anchorPoint.x, topY: props.anchorPoint.y, bottomY: props.anchorPoint.y, gap: 18 }
      : null
  if (!anchor) {
    const style: Record<string, string> = { display: 'none' }
    return style
  }

  const width = props.width
  const height = cardRef.value?.offsetHeight || props.estimatedHeight
  const left = Math.min(
    Math.max(12, anchor.x - width / 2),
    window.innerWidth - width - 12,
  )
  const below = anchor.bottomY + anchor.gap
  const top = below + height < window.innerHeight - 12
    ? below
    : Math.max(12, anchor.topY - height - anchor.gap)

  const style: Record<string, string> = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
  return style
})
</script>

<style scoped>
/* Visual language: the E3/E4 map-selection card (white blur card, stone palette). */
.element-toolbar {
  position: fixed;
  z-index: 10000;
  padding: 8px 10px;
  border: 1px solid rgba(28, 25, 23, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 44px rgba(28, 25, 23, 0.18);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.element-toolbar.is-mobile {
  border-radius: 14px;
}

.toolbar-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.element-kind {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2d6a4f;
  background: #dcebe2;
  border-radius: 999px;
  padding: 2px 7px;
}

.element-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1c1917;
  font-size: 12px;
  font-weight: 700;
}

.element-name-spacer {
  flex: 1;
  min-width: 0;
}

.toolbar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  background: #ffffff;
  color: #44403c;
  cursor: pointer;
}
</style>
