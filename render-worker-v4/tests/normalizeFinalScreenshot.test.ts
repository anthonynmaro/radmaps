import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { normalizeFinalScreenshot } from '../src/queue/normalizeFinalScreenshot.js'

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 180, b: 220 },
    },
  }).jpeg({ quality: 95 }).toBuffer()
}

describe('normalizeFinalScreenshot', () => {
  it('returns exact-size screenshots unchanged', async () => {
    const input = await makeJpeg(120, 180)
    const output = await normalizeFinalScreenshot({
      buffer: input,
      expectedWidth: 120,
      expectedHeight: 180,
    })

    expect(output).toBe(input)
  })

  it('crops small DPR rounding surplus to the expected final size', async () => {
    const output = await normalizeFinalScreenshot({
      buffer: await makeJpeg(121, 181),
      expectedWidth: 120,
      expectedHeight: 180,
      maxOversizePx: 2,
    })

    const metadata = await sharp(output).metadata()
    expect(metadata.width).toBe(120)
    expect(metadata.height).toBe(180)
    expect(metadata.format).toBe('jpeg')
  })

  it('rejects undersized screenshots', async () => {
    await expect(normalizeFinalScreenshot({
      buffer: await makeJpeg(119, 180),
      expectedWidth: 120,
      expectedHeight: 180,
    })).rejects.toThrow(/undersized/)
  })

  it('rejects screenshots outside the crop tolerance', async () => {
    await expect(normalizeFinalScreenshot({
      buffer: await makeJpeg(124, 180),
      expectedWidth: 120,
      expectedHeight: 180,
      maxOversizePx: 2,
    })).rejects.toThrow(/crop tolerance/)
  })
})
