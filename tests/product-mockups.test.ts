import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '~/utils/products'
import { getProductMockupChromeBoxes } from '~/utils/productMockupChrome'
import { getProductMockupArtworkBleedPx, getOverprintedProductMockupArtworkBox } from '~/utils/productMockupGeometry'
import { getProductMockupAcrylicRivetBoxes } from '~/utils/productMockupHardware'
import {
  computeProductMockupHash,
  getMockupSupportedProducts,
  getProductMockupTemplate,
  getProductMockupTemplates,
  PRODUCT_MOCKUP_SCENE_FILES,
  PRODUCT_MOCKUP_PROVIDER,
  PRODUCT_MOCKUP_RENDERER_VERSION,
  PRODUCT_MOCKUP_TEMPLATE_VERSION,
} from '~/utils/productMockups'
import { getProductMockupPath } from '~/utils/render/storagePaths'

describe('product mockups', () => {
  it('supports every physical template-backed product and excludes digital', () => {
    const physicalProducts = PRODUCTS.filter(product => product.type !== 'digital')
    expect(PRODUCT_MOCKUP_PROVIDER).toBe('gelato_template_asset')
    expect(getMockupSupportedProducts().map(product => product.product_uid)).toEqual(
      physicalProducts.map(product => product.product_uid),
    )
  })

  it('resolves every physical product to an existing saved template image', () => {
    for (const product of PRODUCTS.filter(product => product.type !== 'digital')) {
      const template = getProductMockupTemplate(product)
      expect(template, product.product_uid).toBeTruthy()
      expect(
        existsSync(join(process.cwd(), template!.relativePath)),
        template!.relativePath,
      ).toBe(true)
    }
  })

  it('uses the provided room and lobby scenes instead of the plain gray close-up', () => {
    const scenes = new Set(
      PRODUCTS
        .filter(product => product.type !== 'digital')
        .map(product => getProductMockupTemplate(product)?.sceneFile),
    )
    expect(scenes).toEqual(new Set([
      PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
      PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
    ]))

    for (const product of PRODUCTS.filter(product => product.type === 'framed')) {
      expect(getProductMockupTemplate(product)?.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald)
    }
    for (const product of PRODUCTS.filter(product => product.type !== 'digital' && product.type !== 'framed')) {
      expect(getProductMockupTemplate(product)?.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)
    }
  })

  it('exposes checkout wall-scene variants for a selected product', () => {
    const poster = PRODUCTS.find(product => product.product_uid.startsWith('flat_400x600-mm-16x24-inch'))!
    const framed = PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_300x450-mm-12x18-inch_black'))!
    const aluminum = PRODUCTS.find(product => product.product_uid.startsWith('metallic_400x600-mm-16x24-inch'))!

    expect(getProductMockupTemplates(poster).map(template => template.sceneFile)).toEqual([
      PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
      PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
      PRODUCT_MOCKUP_SCENE_FILES.plainGray,
    ])
    expect(getProductMockupTemplates(framed).map(template => template.sceneFile)).toEqual([
      PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
      PRODUCT_MOCKUP_SCENE_FILES.plainGray,
    ])
    expect(getProductMockupTemplates(aluminum).map(template => template.sceneFile)).toEqual([
      PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
      PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
      PRODUCT_MOCKUP_SCENE_FILES.plainGray,
    ])
  })

  it('does not expose the product-only saved scene in checkout galleries', () => {
    for (const product of PRODUCTS.filter(product => product.type !== 'digital')) {
      const templates = getProductMockupTemplates(product)
      expect(templates.map(template => template.sceneFile), product.product_uid).not.toContain(PRODUCT_MOCKUP_SCENE_FILES.simple)
      expect(templates.map(template => template.sceneLabel), product.product_uid).not.toContain('Product')
    }
  })

  it('resolves a requested scene template for gallery rendering', () => {
    const product = PRODUCTS.find(item => item.product_uid.startsWith('flat_400x600-mm-16x24-inch'))!
    const closeUp = getProductMockupTemplate(product, PRODUCT_MOCKUP_SCENE_FILES.plainGray)

    expect(closeUp?.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.plainGray)
    expect(closeUp?.sceneLabel).toBe('Close-up')
    expect(getProductMockupTemplate(product, closeUp!.id)?.id).toBe(closeUp!.id)
  })

  it('uses canonical traced template assets instead of resizing mockups per product size', () => {
    const poster8 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('flat_a4-8x12-inch'))!)!
    const poster24 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('flat_600x900-mm-24x36-inch'))!)!
    const framed8 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_210x297mm-8x12-inch_black'))!)!
    const framed12 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_300x450-mm-12x18-inch'))!)!

    expect(poster8.assetProductUid).toBe(poster24.assetProductUid)
    expect(poster8.artworkBox).toEqual(poster24.artworkBox)
    expect(framed8.assetProductUid).toBe(framed12.assetProductUid)
    expect(framed8.artworkBox).toEqual(framed12.artworkBox)
    expect(framed12.assetProductUid).toContain('600x900-mm-24x36-inch')
  })

  it('exposes wall-hanging chrome boxes for browser template previews', () => {
    const wallHanging = PRODUCTS.find(product => product.product_uid.startsWith('wall_hanging_poster_410-mm_black'))!
    const template = getProductMockupTemplate(wallHanging, PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)!
    const chromeBoxes = getProductMockupChromeBoxes(template)

    expect(chromeBoxes.map(chrome => chrome.id)).toEqual(['top_rail', 'bottom_rail'])
    for (const chrome of chromeBoxes) {
      expect(chrome.box.x).toBeGreaterThanOrEqual(0)
      expect(chrome.box.y).toBeGreaterThanOrEqual(0)
      expect(chrome.box.x + chrome.box.w).toBeLessThanOrEqual(1)
      expect(chrome.box.y + chrome.box.h).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the room wall-hanging artwork inside the traced rail body', () => {
    const wallHanging = PRODUCTS.find(product => product.product_uid.startsWith('wall_hanging_poster_410-mm_black'))!
    const template = getProductMockupTemplate(wallHanging, PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)!
    const chromeBoxes = getProductMockupChromeBoxes(template)
    const topRail = chromeBoxes.find(chrome => chrome.id === 'top_rail')!
    const artworkLeft = Math.round(template.artworkBox.x * 3000)
    const artworkRight = Math.round((template.artworkBox.x + template.artworkBox.w) * 3000)
    const railRight = Math.round((topRail.box.x + topRail.box.w) * 3000)
    const bleed = getProductMockupArtworkBleedPx(template.finish, template.sceneFile)

    expect(artworkLeft).toBe(942)
    expect(artworkRight).toBe(2075)
    expect(artworkRight).toBeLessThan(railRight)
    expect(bleed.left).toBe(0)
    expect(bleed.top).toBe(0)
    expect(bleed.right).toBe(0)
    expect(bleed.bottom).toBe(0)
  })

  it('uses an aluminum-specific room face trace that covers the saved poster art', () => {
    const aluminum = PRODUCTS.find(product => product.product_uid.startsWith('metallic_400x600-mm-16x24-inch'))!
    const template = getProductMockupTemplate(aluminum, PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)!
    const bleed = getProductMockupArtworkBleedPx(template.finish, template.sceneFile)
    const artworkLeft = Math.round(template.artworkBox.x * 3000)
    const artworkRight = Math.round((template.artworkBox.x + template.artworkBox.w) * 3000)
    const artworkTop = Math.round(template.artworkBox.y * 3000)
    const artworkBottom = Math.round((template.artworkBox.y + template.artworkBox.h) * 3000)

    expect(template.finish).toBe('metallic')
    expect(artworkLeft).toBe(935)
    expect(artworkRight).toBe(2083)
    expect(artworkTop).toBe(441)
    expect(artworkBottom).toBe(2163)
    expect(artworkLeft - bleed.left).toBeLessThanOrEqual(935)
    expect(artworkTop - bleed.top).toBeLessThanOrEqual(441)
    expect(artworkRight + bleed.right).toBeGreaterThanOrEqual(2083)
    expect(artworkBottom + bleed.bottom).toBeGreaterThanOrEqual(2163)
  })

  it('keeps the emerald wall-hanging artwork between the rail chrome', () => {
    const wallHanging = PRODUCTS.find(product => product.product_uid.startsWith('wall_hanging_poster_410-mm_natural'))!
    const template = getProductMockupTemplate(wallHanging, PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald)!
    const chromeBoxes = getProductMockupChromeBoxes(template)
    const topRail = chromeBoxes.find(chrome => chrome.id === 'top_rail')!
    const bottomRail = chromeBoxes.find(chrome => chrome.id === 'bottom_rail')!
    const artworkTop = Math.round(template.artworkBox.y * 3000)
    const artworkBottom = Math.round((template.artworkBox.y + template.artworkBox.h) * 3000)
    const topRailBottom = Math.round((topRail.box.y + topRail.box.h) * 3000)
    const bottomRailTop = Math.round(bottomRail.box.y * 3000)

    expect(artworkTop).toBe(656)
    expect(artworkBottom).toBe(2372)
    expect(artworkTop).toBeGreaterThanOrEqual(topRailBottom)
    expect(artworkBottom).toBeLessThanOrEqual(bottomRailTop)
  })

  it('exposes framed chrome boxes for browser template previews', () => {
    const framed = PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_600x900-mm-24x36-inch_black'))!
    const template = getProductMockupTemplate(framed, PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald)!
    const chromeBoxes = getProductMockupChromeBoxes(template)

    expect(chromeBoxes.map(chrome => chrome.id).sort()).toEqual(['frame_bottom', 'frame_left', 'frame_right', 'frame_top'])
    const topFrame = chromeBoxes.find(chrome => chrome.id === 'frame_top')!
    const bottomFrame = chromeBoxes.find(chrome => chrome.id === 'frame_bottom')!
    expect(Math.round(topFrame.box.h * 3000)).toBe(42)
    expect(Math.round(bottomFrame.box.h * 3000)).toBe(42)
    for (const chrome of chromeBoxes) {
      expect(chrome.box.x).toBeGreaterThanOrEqual(0)
      expect(chrome.box.y).toBeGreaterThanOrEqual(0)
      expect(chrome.box.x + chrome.box.w).toBeLessThanOrEqual(1)
      expect(chrome.box.y + chrome.box.h).toBeLessThanOrEqual(1)
    }
  })

  it('positions acrylic template rivet crops around the overprinted artwork corners', () => {
    const acrylic = PRODUCTS.find(product => product.product_uid.startsWith('acrylic_400x600-mm-16x24-inch'))!
    const template = getProductMockupTemplate(acrylic, PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)!
    const rivets = getProductMockupAcrylicRivetBoxes(template.artworkBox, template.finish, template.sceneFile)
    const overprintedBox = getOverprintedProductMockupArtworkBox(template.artworkBox, template.finish, template.sceneFile)

    expect(rivets.map(rivet => rivet.id)).toEqual(['top_left', 'top_right', 'bottom_left', 'bottom_right'])
    for (const rivet of rivets) {
      expect(rivet.box.w).toBeGreaterThan(0)
      expect(rivet.box.h).toBe(rivet.box.w)
      expect(rivet.box.x).toBeGreaterThanOrEqual(0)
      expect(rivet.box.y).toBeGreaterThanOrEqual(0)
      expect(rivet.box.x + rivet.box.w).toBeLessThanOrEqual(1)
      expect(rivet.box.y + rivet.box.h).toBeLessThanOrEqual(1)
    }

    expect(rivets[0].box.x).toBeLessThan(overprintedBox.x)
    expect(rivets[0].box.y).toBeLessThan(overprintedBox.y)
    expect(rivets[1].box.x + rivets[1].box.w).toBeGreaterThan(overprintedBox.x + overprintedBox.w - rivets[1].box.w)
    expect(rivets[3].box.y + rivets[3].box.h).toBeLessThan(overprintedBox.y + overprintedBox.h)

    expect(Math.round(rivets[0].box.x * 3000)).toBe(922)
    expect(Math.round(rivets[0].box.y * 3000)).toBe(419)
    expect(Math.round((rivets[1].box.x + rivets[1].box.w) * 3000)).toBe(2121)
    expect(Math.round((rivets[3].box.y + rivets[3].box.h) * 3000)).toBe(2162)

    const poster = PRODUCTS.find(product => product.product_uid.startsWith('flat_400x600-mm-16x24-inch'))!
    const posterTemplate = getProductMockupTemplate(poster, PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)!
    expect(getProductMockupAcrylicRivetBoxes(posterTemplate.artworkBox, posterTemplate.finish, posterTemplate.sceneFile)).toEqual([])
  })

  it('overprints framed close-up artwork just enough to hide top-left seams', () => {
    const framed = PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_600x900-mm-24x36-inch_black'))!
    const template = getProductMockupTemplate(framed, PRODUCT_MOCKUP_SCENE_FILES.plainGray)!
    const bleed = getProductMockupArtworkBleedPx(template.finish, template.sceneFile)
    const artworkLeft = Math.round(template.artworkBox.x * 3000)
    const artworkRight = Math.round((template.artworkBox.x + template.artworkBox.w) * 3000)
    const artworkTop = Math.round(template.artworkBox.y * 3000)
    const artworkBottom = Math.round((template.artworkBox.y + template.artworkBox.h) * 3000)

    expect(artworkLeft).toBe(657)
    expect(artworkRight).toBe(2338)
    expect(artworkTop).toBe(233)
    expect(artworkBottom).toBe(2748)
    expect(bleed).toEqual({ left: 6, top: 6, right: 0, bottom: 0 })
  })

  it('changes hash when the source render, product, template, or renderer changes', () => {
    const product = getMockupSupportedProducts()[0]
    const template = getProductMockupTemplate(product)!
    const base = {
      sourceType: 'map' as const,
      sourceId: '11111111-1111-1111-1111-111111111111',
      sourceRenderHash: 'proof-a',
      productUid: product.product_uid,
      templateId: template.id,
      templateVersion: PRODUCT_MOCKUP_TEMPLATE_VERSION,
      rendererVersion: PRODUCT_MOCKUP_RENDERER_VERSION,
    }
    const hash = computeProductMockupHash(base)
    expect(computeProductMockupHash({ ...base, sourceRenderHash: 'proof-b' })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, productUid: getMockupSupportedProducts()[1].product_uid })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, templateId: `${template.id}-next` })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, templateVersion: 'gelato-saved-template-traced-slots-v8' })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, rendererVersion: 'template-asset-compositor-v-next' })).not.toBe(hash)
  })

  it('keeps the mockup storage path helper stable', () => {
    expect(getProductMockupPath('premade', '22222222-2222-2222-2222-222222222222', 'flat_8x12', 'abc123')).toBe(
      'renders/mockups/premade/22222222-2222-2222-2222-222222222222/flat_8x12/abc123.jpg',
    )
  })
})
