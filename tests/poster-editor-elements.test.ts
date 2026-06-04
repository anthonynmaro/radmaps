import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type MapAsset, type StyleConfig, type TextOverlay } from '~/types'
import {
  addPosterEditorIcon,
  addPosterEditorText,
  duplicatePosterEditorElement,
  getPosterEditorElements,
  normalizePosterEditorConfig,
  patchPosterEditorElement,
  removePosterEditorElement,
} from '~/utils/posterEditorElements'

function config(patch: Partial<StyleConfig> = {}): StyleConfig {
  return {
    ...DEFAULT_STYLE_CONFIG,
    ...patch,
    labels: {
      ...DEFAULT_STYLE_CONFIG.labels,
      ...patch.labels,
    },
  }
}

const textOverlay: TextOverlay = {
  id: 'text-1',
  content: 'Aid station',
  x: 40,
  y: 30,
  font_size: 2,
  color: '#123456',
  font_family: 'Work Sans',
  alignment: 'center',
  opacity: 1,
  bold: true,
  italic: false,
  rotation: 0,
  z_index: 30,
}

const imageAsset: MapAsset = {
  id: 'asset-1',
  kind: 'image',
  source_url: 'https://example.com/image.png',
  render_url: 'https://example.com/image.png',
  mime_type: 'image/png',
  width_px: 1200,
  height_px: 800,
  file_size_bytes: 42,
  x: 10,
  y: 12,
  width: 20,
  height: 12,
  rotation: 0,
  opacity: 1,
  z_index: 35,
  quality_status: 'excellent',
}

describe('poster editor elements adapter', () => {
  it('maps existing chrome, text, image, and icon storage into editable layers', () => {
    const style = config({
      show_grid: true,
      text_overlays: [textOverlay],
      image_overlays: [imageAsset],
      icon_overlays: [{
        id: 'icon-1',
        icon: 'mountain',
        x: 60,
        y: 45,
        width: 8,
        height: 8,
        color: '#654321',
        opacity: 0.8,
        rotation: 15,
        z_index: 40,
      }],
    })

    const elements = getPosterEditorElements(style)
    expect(elements.map(element => element.id)).toContain('system:map')
    expect(elements.map(element => element.id)).toContain('system:printed-grid')
    expect(elements.find(element => element.id.startsWith('theme:'))?.locked).toBe(true)
    expect(elements.find(element => element.id === 'text:text-1')).toMatchObject({
      kind: 'free-text',
      canTransform: true,
      color: '#123456',
    })
    expect(elements.find(element => element.id === 'asset:asset-1')).toMatchObject({
      kind: 'image',
      width: 20,
      height: 12,
    })
    expect(elements.find(element => element.id === 'icon:icon-1')).toMatchObject({
      kind: 'icon',
      label: 'Mountain',
      rotation: 15,
    })
  })

  it('patches unified layer changes back into the existing StyleConfig fields', () => {
    const style = config({
      text_overlays: [textOverlay],
      image_overlays: [imageAsset],
      icon_overlays: [{
        id: 'icon-1',
        icon: 'mountain',
        x: 60,
        y: 45,
        width: 8,
        height: 8,
        color: '#654321',
        opacity: 0.8,
        rotation: 15,
        z_index: 40,
      }],
    })

    const textNext = patchPosterEditorElement(style, 'text:text-1', {
      content: 'Finish chute',
      x: 110,
      y: -10,
      font_size: 14,
      rotation: 12.34,
      opacity: -1,
    })
    expect(textNext.text_overlays?.[0]).toMatchObject({
      content: 'Finish chute',
      x: 100,
      y: 0,
      font_size: 12,
      rotation: 12.3,
      opacity: 0.1,
    })

    const assetNext = patchPosterEditorElement(style, 'asset:asset-1', {
      allow_bleed: true,
      x: -18,
      y: -20,
      width: 1,
      height: 120,
      opacity: 0.5,
    })
    expect(assetNext.image_overlays?.[0]).toMatchObject({
      allow_bleed: true,
      x: -18,
      y: -12,
      width: 2,
      height: 100,
      opacity: 0.5,
    })

    const iconNext = patchPosterEditorElement(style, 'icon:icon-1', {
      icon: 'compass',
      color: '#FF0000',
      width: 100,
      height: 1,
      opacity: 2,
      locked: true,
    })
    expect(iconNext.icon_overlays?.[0]).toMatchObject({
      icon: 'compass',
      color: '#FF0000',
      width: 80,
      height: 2,
      opacity: 1,
      locked: true,
    })
  })

  it('adds, duplicates, removes, and normalizes V2 fields without rewriting legacy maps', () => {
    const legacy = config({
      text_overlays: undefined,
      image_overlays: undefined,
      icon_overlays: undefined,
      grid_spacing: undefined,
    })

    const normalized = normalizePosterEditorConfig(legacy)
    expect(normalized.grid_spacing).toBe(DEFAULT_STYLE_CONFIG.grid_spacing)
    expect(normalized.text_overlays).toEqual([])
    expect(normalized.image_overlays).toEqual([])
    expect(normalized.icon_overlays).toEqual([])

    const withText = addPosterEditorText(legacy, { content: 'Center title' })
    expect(withText.id).toMatch(/^text:/)
    expect(withText.config.text_overlays?.[0]).toMatchObject({
      content: 'Center title',
      x: 50,
      y: 50,
      constrain_to_safe_area: true,
    })

    const withIcon = addPosterEditorIcon(withText.config, 'trailhead')
    expect(withIcon.id).toMatch(/^icon:/)
    expect(withIcon.config.icon_overlays?.[0]).toMatchObject({
      icon: 'trailhead',
      constrain_to_safe_area: true,
    })

    const duplicated = duplicatePosterEditorElement(withIcon.config, withIcon.id)
    expect(duplicated.id).toMatch(/^icon:/)
    expect(duplicated.config.icon_overlays).toHaveLength(2)

    const removed = removePosterEditorElement(duplicated.config, duplicated.id!)
    expect(removed.icon_overlays).toHaveLength(1)
  })
})
