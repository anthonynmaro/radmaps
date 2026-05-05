import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { validateBrowserScreenshot } from '../src/queue/validateBrowserScreenshot.js'

async function jpeg(width: number, height: number, uniform = false): Promise<Buffer> {
  if (uniform) {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: '#eeeeee',
      },
    }).jpeg({ quality: 95 }).toBuffer()
  }

  const pixels = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const routeBand = Math.abs(y - (height - 40 - x * 0.7)) < 8
      pixels[i] = routeBand ? 220 : (x * 13 + y * 3) % 256
      pixels[i + 1] = routeBand ? 38 : (x * 5 + y * 11) % 256
      pixels[i + 2] = routeBand ? 38 : (x * 7 + y * 17) % 256
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer()
}

describe('validateBrowserScreenshot', () => {
  it('passes a nonblank JPEG with expected dimensions', async () => {
    const buffer = await jpeg(900, 1350)
    const result = await validateBrowserScreenshot({
      jpegBuffer: buffer,
      expectedWidth: 900,
      expectedHeight: 1350,
      maxFileSizeMb: 25,
    })

    expect(result.passed).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('flags dimension mismatches', async () => {
    const buffer = await jpeg(900, 1350)
    const result = await validateBrowserScreenshot({
      jpegBuffer: buffer,
      expectedWidth: 901,
      expectedHeight: 1350,
      maxFileSizeMb: 25,
    })

    expect(result.passed).toBe(false)
    expect(result.errors.some((issue) => issue.check === 'dimensions')).toBe(true)
  })

  it('flags blank canvas output', async () => {
    const buffer = await jpeg(900, 1350, true)
    const result = await validateBrowserScreenshot({
      jpegBuffer: buffer,
      expectedWidth: 900,
      expectedHeight: 1350,
      maxFileSizeMb: 25,
    })

    expect(result.passed).toBe(false)
    expect(result.errors.some((issue) => issue.check === 'blank_canvas')).toBe(true)
  })
})
