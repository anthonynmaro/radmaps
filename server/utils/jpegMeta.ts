export interface JpegMetadata {
  width: number
  height: number
}

export function readJpegMetadata(buffer: Buffer): JpegMetadata {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Output is not a JPEG')
  }

  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error('Invalid JPEG marker')
    const marker = buffer[offset + 1]
    offset += 2

    if (marker === 0xd9 || marker === 0xda) break
    const length = buffer.readUInt16BE(offset)
    if (length < 2) throw new Error('Invalid JPEG segment length')

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      }
    }

    offset += length
  }

  throw new Error('JPEG dimensions not found')
}

export function validateJpegBasics(input: {
  buffer: Buffer
  expectedWidth: number
  expectedHeight: number
  maxFileSizeMb: number
  minFileSizeBytes?: number
}): void {
  const minFileSizeBytes = input.minFileSizeBytes ?? 100_000
  if (input.buffer.byteLength < minFileSizeBytes) {
    throw new Error(`JPEG too small (${input.buffer.byteLength} bytes); render may be blank or truncated`)
  }
  const sizeMb = input.buffer.byteLength / (1024 * 1024)
  if (sizeMb > input.maxFileSizeMb) {
    throw new Error(`JPEG ${sizeMb.toFixed(1)} MB exceeds provider cap ${input.maxFileSizeMb} MB`)
  }
  const meta = readJpegMetadata(input.buffer)
  if (meta.width !== input.expectedWidth || meta.height !== input.expectedHeight) {
    throw new Error(`JPEG dimensions ${meta.width}x${meta.height} did not match ${input.expectedWidth}x${input.expectedHeight}`)
  }
}
