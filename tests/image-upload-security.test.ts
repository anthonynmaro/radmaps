import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { MAX_LOGO_BYTES, processUploadedImageFile } from '../server/utils/imageUploadSecurity'

async function pngFile(type = 'image/png') {
  const buffer = await sharp({
    create: {
      width: 20,
      height: 10,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer()
  return new File([new Uint8Array(buffer)], 'logo.png', { type })
}

describe('image upload security', () => {
  it('normalizes valid PNG logos to PNG render derivatives', async () => {
    const result = await processUploadedImageFile(await pngFile(), 'logo')
    expect(result.detectedMime).toBe('image/png')
    expect(result.renderMime).toBe('image/png')
    expect(result.width).toBe(20)
    expect(result.height).toBe(10)
  })

  it('rejects SVG uploads before decode', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'logo.svg', { type: 'image/svg+xml' })
    await expect(processUploadedImageFile(file, 'logo')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects MIME spoofing between client type and file signature', async () => {
    await expect(processUploadedImageFile(await pngFile('image/jpeg'), 'logo')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects malformed image bytes', async () => {
    const file = new File(['not really an image'], 'image.png', { type: 'image/png' })
    await expect(processUploadedImageFile(file, 'image')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('enforces the logo byte limit before decoding', async () => {
    const file = new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'huge.png', { type: 'image/png' })
    await expect(processUploadedImageFile(file, 'logo')).rejects.toMatchObject({ statusCode: 413 })
  })
})
