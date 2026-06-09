import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type MapAsset, type StyleConfig, type TextOverlay } from '~/types'
import {
  addPosterEditorIcon,
  addPosterEditorText,
  duplicatePosterEditorElement,
  freeAssetAnchorId,
  freeTextAnchorId,
  getPosterEditorElements,
  normalizePosterEditorConfig,
  patchPosterEditorElement,
  removePosterEditorElement,
  resolveFreeOverlayBox,
  syncPosterOverlayAnchors,
} from '~/utils/posterEditorElements'
import { posterEditorAllowlistForStyle } from '~/utils/posterEditorAllowlist'
import { computePosterPrintGuardViolations } from '~/utils/posterPrintGuards'

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

  it('exposes refined theme text slots as bounded Tier 1 slot elements', () => {
    const style = config({
      color_theme: 'sea-chart',
      composition: 'sea-chart',
      trail_name: 'H&H Connector Ridge Traverse',
      location_text: 'Bentonville, Arkansas',
    })
    const allowlist = posterEditorAllowlistForStyle(style)
    const elements = getPosterEditorElements(style, undefined, { editableTextSlots: allowlist.textSlots })

    expect(allowlist.textSlots).toContain('trail_name')
    expect(allowlist.textSlots).toContain('distance')
    expect(allowlist.textSlots).not.toContain('composition_meta')
    expect(elements.find(element => element.id === 'slot:trail_name')).toMatchObject({
      kind: 'theme-text',
      locked: false,
      canTransform: true,
      canEditContent: true,
      slot: 'trail_name',
    })
    expect(elements.find(element => element.slot === 'composition_meta')).toMatchObject({
      locked: true,
      canTransform: false,
      canEditContent: false,
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

  it('patches Tier 1 slot edits through poster_text_overrides only', () => {
    const style = config({ color_theme: 'editorial-minimal' })
    const next = patchPosterEditorElement(style, 'slot:trail_name', {
      content: 'Manual trail title',
      color: '#aa0033',
      font_size_pt: 72,
      opacity: 0.55,
    })

    expect(next.poster_text_overrides?.trail_name).toEqual({
      text: 'Manual trail title',
      color: '#aa0033',
      font_size_pt: 72,
      opacity: 0.55,
    })
    expect(next.poster_layout).toBeUndefined()
    expect(next.text_overlays).toEqual(style.text_overlays)
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
    expect(withText.config.poster_layout?.anchors?.[0]).toMatchObject({
      id: freeTextAnchorId(withText.config.text_overlays![0].id),
      anchorTo: 'poster',
      displacesMap: false,
      userPinned: true,
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

  it('keeps text and image overlay position in free AnchorFrames for Tier 2 edits', () => {
    const style = syncPosterOverlayAnchors(config({
      text_overlays: [textOverlay],
      image_overlays: [imageAsset],
    }))

    expect(resolveFreeOverlayBox(style, 'text:text-1')).toMatchObject({ x: 40, y: 30, zIndex: 30 })
    expect(resolveFreeOverlayBox(style, 'asset:asset-1')).toMatchObject({ x: 10, y: 12, width: 20, height: 12, zIndex: 35 })

    const movedText = patchPosterEditorElement(style, 'text:text-1', { x: 58, y: 18, zIndex: 44 })
    expect(movedText.text_overlays?.[0]).toMatchObject({ x: 58, y: 18, z_index: 44 })
    expect(resolveFreeOverlayBox(movedText, 'text:text-1')).toMatchObject({ x: 58, y: 18, zIndex: 44 })

    const resizedAsset = patchPosterEditorElement(style, 'asset:asset-1', { x: 22, y: 24, width: 30, height: 18, zIndex: 50 })
    expect(resizedAsset.image_overlays?.[0]).toMatchObject({ x: 22, y: 24, width: 30, height: 18, z_index: 50 })
    expect(resolveFreeOverlayBox(resizedAsset, 'asset:asset-1')).toMatchObject({ x: 22, y: 24, width: 30, height: 18, zIndex: 50 })

    const elements = getPosterEditorElements(resizedAsset)
    expect(elements.find(element => element.id === 'asset:asset-1')).toMatchObject({ x: 22, y: 24, width: 30, height: 18 })
  })

  it('warns and blocks print-unsafe free overlays', () => {
    const unsafe = syncPosterOverlayAnchors(config({
      print_size: '24x36',
      label_bg_color: '#FFFFFF',
      text_overlays: [{
        ...textOverlay,
        x: 2,
        y: 2,
        font_size: 0.1,
        color: '#FFFFFF',
        bg_color: '#FFFFFF',
      }],
      image_overlays: [{
        ...imageAsset,
        x: 1,
        y: 1,
        width: 80,
        height: 60,
        width_px: 800,
        height_px: 600,
      }],
    }))

    expect(computePosterPrintGuardViolations(unsafe).map(violation => violation.code)).toEqual(expect.arrayContaining([
      'text-min-font',
      'text-contrast',
      'text-safe-area',
      'image-min-dpi',
      'image-safe-area',
    ]))

    const safe = syncPosterOverlayAnchors(config({
      print_size: '24x36',
      text_overlays: [{
        ...textOverlay,
        x: 50,
        y: 50,
        font_size: 1,
        color: '#FFFFFF',
        bg_color: '#111111',
      }],
      image_overlays: [{
        ...imageAsset,
        x: 20,
        y: 30,
        width: 10,
        height: 8,
        width_px: 1200,
        height_px: 1200,
      }],
    }))
    expect(computePosterPrintGuardViolations(safe)).toEqual([])
    expect(safe.poster_layout?.anchors?.map(anchor => anchor.id)).toEqual(expect.arrayContaining([
      freeTextAnchorId('text-1'),
      freeAssetAnchorId('asset-1'),
    ]))
  })
})
