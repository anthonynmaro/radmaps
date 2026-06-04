<template>
  <div class="puck-poster-spike" data-testid="puck-poster-spike">
    <div ref="mountEl" class="puck-poster-spike-react" data-testid="puck-poster-spike-react" />
    <aside class="puck-poster-spike-export" data-testid="puck-poster-spike-export">
      <div>
        <p>RadMaps Export</p>
        <span>Structured poster document, not HTML/CSS</span>
      </div>
      <pre data-testid="puck-poster-spike-json">{{ posterDocumentJson }}</pre>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watchEffect } from 'vue'
import type { StyleConfig, TrailMap } from '~/types'
import {
  createInitialPuckPosterData,
  puckPosterDataToDocument,
  type PuckPosterData,
} from '~/utils/puckPosterSpike'

const props = defineProps<{
  modelValue: StyleConfig
  map: TrailMap
}>()

defineEmits<{
  'update:modelValue': [value: StyleConfig]
}>()

const mountEl = ref<HTMLElement | null>(null)
const currentData = shallowRef<PuckPosterData>(createInitialPuckPosterData(props.modelValue, props.map.stats))
const posterDocument = computed(() => puckPosterDataToDocument(currentData.value))
const posterDocumentJson = computed(() => JSON.stringify(posterDocument.value, null, 2))

let reactRoot: { render: (children: unknown) => void; unmount: () => void } | null = null

watchEffect(() => {
  if (typeof window === 'undefined') return
  exposeSpikeApi(currentData.value)
})

onMounted(async () => {
  if (!mountEl.value) return

  const React = await import('react')
  const ReactDOM = await import('react-dom/client')
  const PuckCore = await import('@puckeditor/core')
  await import('@puckeditor/core/puck.css')

  const h = React.createElement
  const contentComponents = ['TextBlock', 'ImageBlock', 'IconBlock', 'SpacerBlock']
  const config = createPuckConfig(h, PuckCore, contentComponents)

  function onDataChange(data: PuckPosterData) {
    currentData.value = data
    exposeSpikeApi(data)
  }

  function PuckSpikeApp() {
    return h('div', { className: 'puck-poster-spike-app' },
      h(PuckCore.Puck, {
        config,
        data: currentData.value as never,
        iframe: { enabled: false },
        headerTitle: 'RadMaps Puck Spike',
        height: '100%',
        permissions: {
          drag: true,
          duplicate: true,
          delete: true,
          edit: true,
        },
        ui: {
          leftSideBarVisible: true,
          rightSideBarVisible: true,
          componentList: {
            structure: { expanded: true },
            content: { expanded: true },
            media: { expanded: true },
          },
        },
        viewports: [
          { width: 390, label: 'Mobile', icon: 'Smartphone' },
          { width: 820, label: 'Poster', icon: 'Monitor' },
        ],
        onChange: onDataChange,
        onPublish: onDataChange,
      }),
    )
  }

  reactRoot = ReactDOM.createRoot(mountEl.value) as unknown as { render: (children: unknown) => void; unmount: () => void }
  reactRoot.render(h(PuckSpikeApp))
  exposeSpikeApi(currentData.value)
})

onUnmounted(() => {
  reactRoot?.unmount()
  reactRoot = null
})

function exposeSpikeApi(data: PuckPosterData) {
  if (!import.meta.dev) return
  ;(window as unknown as {
    __RADMAPS_PUCK_POSTER_SPIKE__?: {
      getPuckData: () => PuckPosterData
      getPosterDocument: () => ReturnType<typeof puckPosterDataToDocument>
    }
  }).__RADMAPS_PUCK_POSTER_SPIKE__ = {
    getPuckData: () => data,
    getPosterDocument: () => puckPosterDataToDocument(data),
  }
}

function createPuckConfig(
  h: typeof import('react').createElement,
  PuckCore: typeof import('@puckeditor/core'),
  contentComponents: string[],
) {
  return {
    root: {
      fields: {
        aspect: {
          type: 'radio',
          label: 'Aspect',
          options: [
            { label: 'Portrait 2:3', value: '2:3' },
            { label: 'Landscape 3:2', value: '3:2' },
          ],
        },
        themeId: {
          type: 'text',
          label: 'Theme recipe',
        },
      },
      render: ({ children, aspect, themeId }: Record<string, unknown>) =>
        h('div', {
          className: 'radmaps-puck-root',
          'data-testid': 'radmaps-puck-root',
          'data-aspect': aspect,
          'data-theme-id': themeId,
        }, children as never),
    },
    categories: {
      structure: {
        title: 'Structure',
        defaultExpanded: true,
        components: ['Row', 'SpacerRow', 'MapBand'],
      },
      content: {
        title: 'Content',
        defaultExpanded: true,
        components: ['TextBlock', 'SpacerBlock'],
      },
      media: {
        title: 'Media',
        defaultExpanded: true,
        components: ['ImageBlock', 'IconBlock'],
      },
    },
    components: {
      Row: {
        label: 'Row',
        fields: {
          label: { type: 'text', label: 'Label' },
          band: {
            type: 'radio',
            label: 'Poster band',
            options: [
              { label: 'Header', value: 'header' },
              { label: 'Footer', value: 'footer' },
            ],
          },
          columns: {
            type: 'radio',
            label: 'Columns',
            options: [
              { label: '1', value: 1 },
              { label: '2', value: 2 },
              { label: '3', value: 3 },
            ],
          },
          heightFr: {
            type: 'number',
            label: 'Row height',
            min: 0.25,
            max: 4,
            step: 0.05,
          },
          col1: { type: 'slot', label: 'Column 1', allow: contentComponents },
          col2: { type: 'slot', label: 'Column 2', allow: contentComponents },
          col3: { type: 'slot', label: 'Column 3', allow: contentComponents },
        },
        defaultProps: {
          band: 'header',
          label: 'Content row',
          columns: 1,
          heightFr: 1,
          col1: [{
            type: 'TextBlock',
            props: {
              text: 'Write here...',
              role: 'body',
              align: 'left',
            },
          }],
          col2: [],
          col3: [],
        },
        render: (rowProps: Record<string, unknown>) => {
          const columns = clampColumnCount(rowProps.columns)
          const slots = [rowProps.col1, rowProps.col2, rowProps.col3]
          const heightFr = typeof rowProps.heightFr === 'number' ? rowProps.heightFr : 1

          return h('section', {
            className: 'radmaps-puck-row',
            'data-testid': 'radmaps-puck-row',
            'data-band': rowProps.band,
            style: {
              minHeight: `${Math.max(48, heightFr * 62)}px`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            },
          }, slots.slice(0, columns).map((Slot, index) =>
            h('div', {
              key: index,
              className: 'radmaps-puck-cell',
              'data-testid': 'radmaps-puck-cell',
            }, h(Slot as never, {
              allow: contentComponents,
              className: 'radmaps-puck-slot',
              minEmptyHeight: 36,
            })),
          ))
        },
      },
      SpacerRow: {
        label: 'Spacer row',
        fields: {
          band: {
            type: 'radio',
            label: 'Poster band',
            options: [
              { label: 'Header', value: 'header' },
              { label: 'Footer', value: 'footer' },
            ],
          },
          heightFr: {
            type: 'number',
            label: 'Height',
            min: 0.25,
            max: 4,
            step: 0.05,
          },
        },
        defaultProps: {
          band: 'header',
          heightFr: 0.7,
        },
        render: ({ heightFr, band }: Record<string, unknown>) =>
          h('div', {
            className: 'radmaps-puck-spacer-row',
            'data-testid': 'radmaps-puck-spacer-row',
            'data-band': band,
            style: { minHeight: `${Math.max(24, (typeof heightFr === 'number' ? heightFr : 0.7) * 54)}px` },
          }, 'Spacer'),
      },
      MapBand: {
        label: 'Map band',
        fields: {
          heightFr: {
            type: 'number',
            label: 'Map height',
            min: 1,
            max: 8,
            step: 0.1,
          },
        },
        permissions: {
          drag: false,
          duplicate: false,
          delete: false,
          edit: true,
        },
        defaultProps: {
          heightFr: 4.8,
        },
        render: ({ heightFr }: Record<string, unknown>) =>
          h('section', {
            className: 'radmaps-puck-map-band',
            'data-testid': 'radmaps-puck-map-band',
            style: { minHeight: `${Math.max(220, (typeof heightFr === 'number' ? heightFr : 4.8) * 82)}px` },
          }, [
            h('div', { key: 'line', className: 'radmaps-puck-route-line' }),
            h('strong', { key: 'title' }, 'MapPreview.vue stays render truth'),
            h('span', { key: 'note' }, 'Puck edits poster content structure around this locked map band.'),
          ]),
      },
      TextBlock: {
        label: 'Text',
        fields: {
          text: {
            type: 'textarea',
            label: 'Text',
            contentEditable: true,
          },
          role: {
            type: 'select',
            label: 'Role',
            options: [
              { label: 'Title', value: 'title' },
              { label: 'Caption', value: 'caption' },
              { label: 'Stat', value: 'stat' },
              { label: 'Body', value: 'body' },
            ],
          },
          align: {
            type: 'radio',
            label: 'Align',
            options: [
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
        },
        defaultProps: {
          text: 'Write here...',
          role: 'body',
          align: 'left',
        },
        render: ({ text, role, align }: Record<string, unknown>) =>
          h('div', {
            className: `radmaps-puck-text radmaps-puck-text--${role || 'body'}`,
            'data-testid': 'radmaps-puck-text-block',
            style: { textAlign: typeof align === 'string' ? align : 'left' },
          }, typeof text === 'string' && text.trim() ? text : 'Write here...'),
      },
      ImageBlock: {
        label: 'Image',
        fields: {
          assetRole: {
            type: 'radio',
            label: 'Asset role',
            options: [
              { label: 'Image', value: 'image' },
              { label: 'Logo', value: 'logo' },
            ],
          },
        },
        defaultProps: {
          assetRole: 'image',
        },
        render: ({ assetRole }: Record<string, unknown>) =>
          h('div', {
            className: 'radmaps-puck-image',
            'data-testid': 'radmaps-puck-image-block',
          }, [
            h('span', { key: 'icon' }, assetRole === 'logo' ? 'LOGO' : 'IMG'),
            h('strong', { key: 'label' }, assetRole === 'logo' ? 'Local logo slot' : 'Local image slot'),
          ]),
      },
      IconBlock: {
        label: 'Icon',
        fields: {
          icon: {
            type: 'radio',
            label: 'Icon',
            options: [
              { label: 'Mountain', value: 'mountain' },
              { label: 'Pin', value: 'pin' },
              { label: 'Route', value: 'route' },
            ],
          },
        },
        defaultProps: {
          icon: 'mountain',
        },
        render: ({ icon }: Record<string, unknown>) =>
          h('div', {
            className: 'radmaps-puck-icon',
            'data-testid': 'radmaps-puck-icon-block',
          }, [
            h('span', { key: 'mark' }, icon === 'pin' ? 'PIN' : icon === 'route' ? 'RTE' : 'MTN'),
          ]),
      },
      SpacerBlock: {
        label: 'Spacer',
        fields: {
          heightFr: {
            type: 'number',
            label: 'Height',
            min: 0.25,
            max: 4,
            step: 0.05,
          },
        },
        defaultProps: {
          heightFr: 0.5,
        },
        render: ({ heightFr }: Record<string, unknown>) =>
          h('div', {
            className: 'radmaps-puck-spacer-block',
            'data-testid': 'radmaps-puck-spacer-block',
            style: { minHeight: `${Math.max(18, (typeof heightFr === 'number' ? heightFr : 0.5) * 42)}px` },
          }, 'Spacer'),
      },
    },
  }

  function clampColumnCount(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 1
    return Math.min(3, Math.max(1, Math.round(value)))
  }
}
</script>

<style>
.puck-poster-spike {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f4f1ea;
}

.puck-poster-spike-react,
.puck-poster-spike-app {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.puck-poster-spike-export {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 5;
  width: min(340px, calc(100% - 36px));
  max-height: 280px;
  overflow: hidden;
  border: 1px solid rgba(34, 31, 27, 0.14);
  border-radius: 8px;
  background: rgba(255, 253, 248, 0.94);
  box-shadow: 0 18px 60px rgba(26, 23, 18, 0.16);
}

.puck-poster-spike-export > div {
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(34, 31, 27, 0.1);
}

.puck-poster-spike-export p {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #1f2933;
}

.puck-poster-spike-export span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #756f66;
}

.puck-poster-spike-export pre {
  max-height: 210px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 10px;
  line-height: 1.45;
  color: #243040;
  white-space: pre-wrap;
}

.radmaps-puck-root {
  width: min(420px, 82vw);
  min-height: 630px;
  margin: 32px auto;
  overflow: hidden;
  container-type: inline-size;
  aspect-ratio: 2 / 3;
  border: 1px solid rgba(34, 31, 27, 0.12);
  background: #fbf7ee;
  box-shadow: 0 22px 80px rgba(37, 32, 24, 0.16);
  color: #171512;
  font-family: Georgia, "Times New Roman", serif;
}

.radmaps-puck-root[data-aspect="3:2"] {
  width: min(640px, 82vw);
  min-height: 0;
  aspect-ratio: 3 / 2;
}

.radmaps-puck-row {
  display: grid;
  gap: 10px;
  padding: 18px 30px;
  border-bottom: 1px solid rgba(35, 31, 25, 0.12);
}

.radmaps-puck-cell {
  min-width: 0;
  overflow: hidden;
}

.radmaps-puck-slot {
  display: grid;
  gap: 7px;
  min-height: 36px;
  outline: 1px dashed rgba(33, 111, 219, 0.25);
  outline-offset: 4px;
}

.radmaps-puck-map-band {
  position: relative;
  display: grid;
  place-items: center;
  gap: 8px;
  overflow: hidden;
  padding: 28px;
  background:
    linear-gradient(120deg, rgba(231, 221, 202, 0.32), rgba(220, 233, 238, 0.58)),
    repeating-linear-gradient(0deg, rgba(68, 90, 104, 0.06) 0 1px, transparent 1px 32px),
    repeating-linear-gradient(90deg, rgba(68, 90, 104, 0.06) 0 1px, transparent 1px 32px);
  color: rgba(31, 41, 55, 0.72);
  text-align: center;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.radmaps-puck-route-line {
  width: 180px;
  height: 96px;
  border-left: 4px solid #b5251d;
  border-bottom: 4px solid #b5251d;
  transform: rotate(-22deg) skewX(-18deg);
  opacity: 0.84;
}

.radmaps-puck-map-band strong {
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.radmaps-puck-map-band span {
  max-width: 260px;
  font-size: 12px;
  line-height: 1.4;
}

.radmaps-puck-text {
  display: block;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: normal;
  word-break: normal;
  hyphens: none;
}

.radmaps-puck-text--title {
  font-size: clamp(28px, 10cqw, 44px);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: 0;
}

.radmaps-puck-text--caption {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.35;
  text-transform: uppercase;
}

.radmaps-puck-text--stat {
  font-size: 24px;
  font-weight: 800;
  line-height: 0.95;
}

.radmaps-puck-text--body {
  font-size: 15px;
  line-height: 1.45;
}

.radmaps-puck-image,
.radmaps-puck-icon,
.radmaps-puck-spacer-block,
.radmaps-puck-spacer-row {
  display: grid;
  place-items: center;
  border: 1px dashed rgba(34, 31, 27, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.5);
  color: rgba(31, 41, 55, 0.72);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.radmaps-puck-image {
  min-height: 72px;
  gap: 5px;
}

.radmaps-puck-image span,
.radmaps-puck-icon span {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.radmaps-puck-image strong {
  font-size: 12px;
}

.radmaps-puck-icon {
  min-height: 54px;
}

.radmaps-puck-spacer-block,
.radmaps-puck-spacer-row {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.puck-poster-spike .Puck {
  height: 100%;
}

@media (max-width: 760px) {
  .puck-poster-spike-export {
    display: none;
  }

  .radmaps-puck-root {
    width: min(330px, 88vw);
    margin: 20px auto 96px;
  }
}
</style>
