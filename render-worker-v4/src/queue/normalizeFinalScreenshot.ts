import sharp from 'sharp'

export async function normalizeFinalScreenshot(input: {
  buffer: Buffer
  expectedWidth: number
  expectedHeight: number
  maxOversizePx?: number
  quality?: number
  densityDpi?: number
}): Promise<Buffer> {
  const maxOversizePx = input.maxOversizePx ?? 2
  const quality = input.quality ?? 95
  const metadata = await sharp(input.buffer).metadata()
  const width = metadata.width
  const height = metadata.height

  if (!width || !height) {
    throw new Error('Renderer screenshot dimensions are unreadable')
  }

  if (width < input.expectedWidth || height < input.expectedHeight) {
    throw new Error(`Renderer screenshot is undersized: got ${width}x${height}, expected ${input.expectedWidth}x${input.expectedHeight}`)
  }

  const oversizeX = width - input.expectedWidth
  const oversizeY = height - input.expectedHeight
  if (oversizeX > maxOversizePx || oversizeY > maxOversizePx) {
    throw new Error(`Renderer screenshot oversize exceeds crop tolerance: got ${width}x${height}, expected ${input.expectedWidth}x${input.expectedHeight}`)
  }

  let image = sharp(input.buffer)
  if (width !== input.expectedWidth || height !== input.expectedHeight) {
    image = image.extract({ left: 0, top: 0, width: input.expectedWidth, height: input.expectedHeight })
  }

  if (input.densityDpi) {
    image = image.withMetadata({ density: input.densityDpi })
  }

  return image
    .jpeg({ quality })
    .toBuffer()
}
