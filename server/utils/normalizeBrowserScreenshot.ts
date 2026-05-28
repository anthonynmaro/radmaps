import sharp from 'sharp'

export async function normalizeBrowserScreenshot(input: {
  buffer: Buffer
  expectedWidth: number
  expectedHeight: number
  maxOversizePx?: number
  quality?: number
}): Promise<Buffer> {
  const maxOversizePx = input.maxOversizePx ?? 2
  const quality = input.quality ?? 95
  const metadata = await sharp(input.buffer).metadata()
  const width = metadata.width
  const height = metadata.height

  if (!width || !height) {
    throw new Error('Browser screenshot dimensions are unreadable')
  }

  if (width === input.expectedWidth && height === input.expectedHeight) {
    return input.buffer
  }

  if (width < input.expectedWidth || height < input.expectedHeight) {
    throw new Error(`Browser screenshot is undersized: got ${width}x${height}, expected ${input.expectedWidth}x${input.expectedHeight}`)
  }

  const oversizeX = width - input.expectedWidth
  const oversizeY = height - input.expectedHeight
  if (oversizeX > maxOversizePx || oversizeY > maxOversizePx) {
    throw new Error(`Browser screenshot oversize exceeds crop tolerance: got ${width}x${height}, expected ${input.expectedWidth}x${input.expectedHeight}`)
  }

  return sharp(input.buffer)
    .extract({ left: 0, top: 0, width: input.expectedWidth, height: input.expectedHeight })
    .jpeg({ quality })
    .toBuffer()
}
