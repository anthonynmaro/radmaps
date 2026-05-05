import sharp from 'sharp'
import type { Metadata } from 'sharp'

import type { ValidationIssue, ValidationResult } from '../types.js'

export const VALIDATOR_VERSION = 'print-validator-v1' as const

export async function validateBrowserScreenshot(input: {
  jpegBuffer: Buffer
  expectedWidth: number
  expectedHeight: number
  maxFileSizeMb: number
}): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const push = (issue: ValidationIssue) => {
    if (issue.severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  let meta: Metadata
  try {
    meta = await sharp(input.jpegBuffer).metadata()
  } catch (err) {
    push({ check: 'jpeg_readable', severity: 'error', message: `JPEG unreadable: ${(err as Error).message}` })
    return finish(errors, warnings)
  }

  if (meta.format !== 'jpeg') {
    push({ check: 'jpeg_format', severity: 'error', message: `expected jpeg, got ${meta.format ?? 'unknown'}` })
  }
  if (meta.width !== input.expectedWidth || meta.height !== input.expectedHeight) {
    push({
      check: 'dimensions',
      severity: 'error',
      message: `dimensions mismatch: got ${meta.width}x${meta.height}, expected ${input.expectedWidth}x${input.expectedHeight}`,
    })
  }

  const sizeMb = input.jpegBuffer.byteLength / (1024 * 1024)
  if (input.jpegBuffer.byteLength < 100_000) {
    push({ check: 'minimum_file_size', severity: 'error', message: `file is only ${input.jpegBuffer.byteLength} bytes` })
  }
  if (sizeMb > input.maxFileSizeMb) {
    push({ check: 'file_size', severity: 'error', message: `file size ${sizeMb.toFixed(1)} MB exceeds cap ${input.maxFileSizeMb} MB` })
  }
  if (meta.space && meta.space !== 'srgb') {
    push({ check: 'icc_srgb', severity: 'warning', message: `colour space is "${meta.space}", expected sRGB` })
  }

  try {
    const sample = await sharp(input.jpegBuffer)
      .resize(96, 96, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const px = sample.data
    const channels = sample.info.channels
    let sum = 0
    let sumSq = 0
    const colours = new Set<number>()
    let count = 0
    for (let i = 0; i < px.length; i += channels) {
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      sum += lum
      sumSq += lum * lum
      colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
      count++
    }
    const mean = sum / Math.max(1, count)
    const stdev = Math.sqrt(Math.max(0, sumSq / Math.max(1, count) - mean * mean))
    if (colours.size < 8 || stdev < 3) {
      push({ check: 'blank_canvas', severity: 'error', message: `low visual variation (colours=${colours.size}, stdev=${stdev.toFixed(1)})` })
    }
  } catch (err) {
    push({ check: 'blank_canvas', severity: 'warning', message: `blank-canvas sampling failed: ${(err as Error).message}` })
  }

  return finish(errors, warnings)
}

function finish(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  return {
    errors,
    warnings,
    checked_at: new Date().toISOString(),
    validator_version: VALIDATOR_VERSION,
    passed: errors.length === 0,
  }
}
