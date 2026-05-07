import { describe, expect, it } from 'vitest'
import { createRenderTicket, verifyRenderTicket } from '~/utils/render/renderTicket'
import { getPremadeThumbnailPath } from '~/utils/render/storagePaths'
import {
  PREMADE_THUMBNAIL_HEIGHT_PX,
  PREMADE_THUMBNAIL_WIDTH_PX,
  getPremadeThumbnailFraming,
} from '~/utils/render/thumbnailFraming'

describe('premade thumbnail rendering primitives', () => {
  it('uses fixed 2:3 web thumbnail geometry', () => {
    const framing = getPremadeThumbnailFraming()
    expect(framing.fullWidthPx).toBe(PREMADE_THUMBNAIL_WIDTH_PX)
    expect(framing.fullHeightPx).toBe(PREMADE_THUMBNAIL_HEIGHT_PX)
    expect(framing.fullWidthPx / framing.fullHeightPx).toBeCloseTo(2 / 3)
    expect(framing.bleedIn).toBe(0)
  })

  it('accepts signed premade thumbnail render tickets', () => {
    const ticket = createRenderTicket({
      kind: 'premade',
      subject: 'premade-1',
      renderClass: 'thumbnail',
      widthPx: PREMADE_THUMBNAIL_WIDTH_PX,
      heightPx: PREMADE_THUMBNAIL_HEIGHT_PX,
      deviceScaleFactor: 1,
      productUid: 'premade-thumbnail',
      expiresAt: Date.now() + 60_000,
    }, 'secret')

    expect(verifyRenderTicket(ticket, 'secret')).toMatchObject({
      kind: 'premade',
      subject: 'premade-1',
      renderClass: 'thumbnail',
      productUid: 'premade-thumbnail',
    })
  })

  it('stores premade thumbnails away from print-ready renders', () => {
    expect(getPremadeThumbnailPath('premade-1', 'hash')).toBe('renders/thumb/premade/premade-1/hash.jpg')
  })
})
