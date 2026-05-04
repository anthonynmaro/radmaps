// render-worker-v4/src/validation.ts
//
// Plan v4 §"Output validation" — 14 checks against the final composite.
//
//  1. Dimensions match framing (error)
//  2. File size under provider cap (error)
//  3. No alpha channel (error)         — JPEG should be RGB.
//  4. sRGB ICC tag present (warning)
//  5. Route visibility heuristic (warning)
//  6. Route padding into safe area (warning)
//  7. Tile completeness — no all-grey/blank patches (warning)
//  8. Viewport fill — non-trivial unique colours (error)
//  9. Text overflow — no overlap with bleed edge (warning)
// 10. Minimum text point size (warning)
// 11. Logo loaded (pre-render gate, surfaced as a check) (error)
// 12. Border placement — must be inside trim, ideally inside safe (error/warning)
// 13. No unresolved external URLs in chrome SVG (error)
// 14. Empty trail name (error)
//
// `validator_version: 'print-validator-v1'`. ValidationResult is stored
// verbatim into product_renders.validation_result.

import sharp from 'sharp'

import type { PrintFraming } from '../../utils/print/printFraming.js'
import type { PrintProviderProfile } from '../../utils/print/providerProfile.js'

import { logValidationResult } from './log.js'
import type {
  StyleConfig,
  ValidationIssue,
  ValidationResult,
} from './types.js'

export const VALIDATOR_VERSION = 'print-validator-v1' as const

export interface ValidationInput {
  jpegBuffer: Buffer
  framing: PrintFraming
  profile: PrintProviderProfile
  styleConfig: StyleConfig
  /** True if the logo pre-fetch succeeded (or no logo was requested). */
  logoOk: boolean
  /** Raw chrome SVG string — used to lint for unresolved URLs. */
  chromeSvg: string
  renderClass: 'proof' | 'final'
}

export async function validatePoster(input: ValidationInput): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const push = (issue: ValidationIssue) => {
    if (issue.severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  // Bounce the buffer through sharp once to read metadata + raw RGBA for
  // the pixel-sampling checks.
  const meta = await sharp(input.jpegBuffer).metadata()

  // ── 1. Dimensions match framing ──────────────────────────────────────────
  if (meta.width !== input.framing.fullWidthPx || meta.height !== input.framing.fullHeightPx) {
    push({
      check: 'dimensions',
      severity: 'error',
      message: `dimensions mismatch: got ${meta.width}×${meta.height}, expected ${input.framing.fullWidthPx}×${input.framing.fullHeightPx}`,
    })
  }

  // ── 2. File size under provider cap ──────────────────────────────────────
  const sizeMb = input.jpegBuffer.byteLength / (1024 * 1024)
  if (sizeMb > input.profile.maxFileSizeMb) {
    push({
      check: 'file_size',
      severity: 'error',
      message: `file size ${sizeMb.toFixed(1)} MB exceeds provider cap ${input.profile.maxFileSizeMb} MB`,
    })
  }

  // ── 3. No alpha channel (JPEG should be RGB) ─────────────────────────────
  if (meta.channels && meta.channels > 3) {
    push({
      check: 'alpha_channel',
      severity: 'error',
      message: `output has ${meta.channels} channels; JPEG must be RGB (3 channels)`,
    })
  }

  // ── 4. sRGB ICC tag ──────────────────────────────────────────────────────
  if (input.profile.colorProfile === 'sRGB') {
    const space = (meta as { space?: string }).space
    if (space && space !== 'srgb') {
      push({
        check: 'icc_srgb',
        severity: 'warning',
        message: `colour space is "${space}", expected sRGB`,
      })
    }
  }

  // ── Pixel sampling: downsample for speed (200×266 max). ──────────────────
  const sample = await sharp(input.jpegBuffer)
    .resize(200, null, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px = sample.data
  const { width: sw, height: sh, channels: sc } = sample.info

  // ── 5. Route visibility heuristic — proxy: stdev of luminance ────────────
  let sumLum = 0
  let sumLumSq = 0
  let count = 0
  let blankPixels = 0
  const blankThreshold = 12 // distance from grey 235±
  const colourCounts = new Map<number, number>()
  for (let i = 0; i < px.length; i += sc) {
    const r = px[i]!
    const g = px[i + 1]!
    const b = px[i + 2]!
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    sumLum += lum
    sumLumSq += lum * lum
    count++
    // Tile completeness proxy: count near-uniform near-white pixels.
    if (
      Math.abs(r - 235) < blankThreshold &&
      Math.abs(g - 235) < blankThreshold &&
      Math.abs(b - 235) < blankThreshold
    ) {
      blankPixels++
    }
    // Quantise to a 32-bin RGB histogram for viewport-fill check.
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5)
    colourCounts.set(key, (colourCounts.get(key) ?? 0) + 1)
  }
  const meanLum = sumLum / count
  const variance = sumLumSq / count - meanLum * meanLum
  const stdev = Math.sqrt(Math.max(0, variance))
  if (stdev < 6) {
    push({
      check: 'route_visibility',
      severity: 'warning',
      message: `low contrast (stdev=${stdev.toFixed(1)}) — route may be invisible`,
    })
  }

  // ── 6. Route padding — heuristic: edge band should differ from interior ──
  // We approximate by sampling the safe-box border vs. the centre. Skip
  // unless the framing has a safe box.
  if (input.framing.safeBox.w > 0) {
    // Use 8% of width as the band thickness.
    const bandPx = Math.max(2, Math.round(sw * 0.08))
    let edgeSum = 0
    let edgeCount = 0
    let centreSum = 0
    let centreCount = 0
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * sc
        const lum = 0.299 * px[idx]! + 0.587 * px[idx + 1]! + 0.114 * px[idx + 2]!
        const onEdge =
          x < bandPx || y < bandPx || x >= sw - bandPx || y >= sh - bandPx
        if (onEdge) {
          edgeSum += lum
          edgeCount++
        } else {
          centreSum += lum
          centreCount++
        }
      }
    }
    const edgeMean = edgeSum / Math.max(1, edgeCount)
    const centreMean = centreSum / Math.max(1, centreCount)
    if (Math.abs(edgeMean - centreMean) > 60) {
      push({
        check: 'route_padding',
        severity: 'warning',
        message: `large luminance gap edge↔centre (${(edgeMean - centreMean).toFixed(0)}) — route may be cropping into the safe area`,
      })
    }
  }

  // ── 7. Tile completeness — too many blank patches ────────────────────────
  const blankFraction = blankPixels / count
  if (blankFraction > 0.35) {
    push({
      check: 'tile_completeness',
      severity: 'warning',
      message: `${(blankFraction * 100).toFixed(0)}% of sampled pixels look blank — possible tile gap`,
    })
  }

  // ── 8. Viewport fill — at least N distinct colour buckets ────────────────
  // Threshold calibration: a uniform JPEG produces 1-3 buckets; a render
  // with just chrome text on a single background colour ~10. A healthy
  // synthetic fixture (a few solid fills + JPEG compression noise) sits
  // around 25. Real map renders are hundreds. 16 is the sweet spot:
  // catches truly empty viewports without false-positives on lightly
  // coloured fixtures. Tighter thresholds were rejecting healthy renders.
  if (colourCounts.size < 16) {
    push({
      check: 'viewport_fill',
      severity: 'error',
      message: `only ${colourCounts.size} distinct colour buckets — viewport may be empty`,
    })
  }

  // ── 9. Text overflow — heuristic: chrome SVG text x outside trim box ─────
  // Walk the SVG for `<text x="N"` and ensure all xs are inside trimBox.
  const textXs = [...input.chromeSvg.matchAll(/<text[^>]*\sx="(-?\d+(?:\.\d+)?)"/g)].map(
    (m) => Number(m[1]),
  )
  for (const x of textXs) {
    if (x < input.framing.trimBox.x || x > input.framing.trimBox.x + input.framing.trimBox.w) {
      push({
        check: 'text_overflow',
        severity: 'warning',
        message: `chrome text at x=${x} falls outside trim box [${input.framing.trimBox.x}..${input.framing.trimBox.x + input.framing.trimBox.w}]`,
      })
      break
    }
  }

  // ── 10. Minimum text point size ──────────────────────────────────────────
  // Pull every font-size attribute and convert px → pt at the framing DPI.
  const fontSizesPx = [...input.chromeSvg.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((m) =>
    Number(m[1]),
  )
  const pxPerPt = input.framing.dpi / 72
  const minPt = Math.min(...fontSizesPx.map((px) => px / pxPerPt), Infinity)
  // 6pt is the de-facto minimum legible point size on print posters.
  if (Number.isFinite(minPt) && minPt < 6) {
    push({
      check: 'min_text_size',
      severity: 'warning',
      message: `smallest chrome text is ${minPt.toFixed(1)} pt; recommended ≥ 6 pt`,
    })
  }

  // ── 11. Logo loaded (pre-render gate) ────────────────────────────────────
  if (!input.logoOk) {
    push({
      check: 'logo_loaded',
      severity: 'error',
      message: 'logo URL was provided but failed pre-fetch',
    })
  }

  // ── 12. Border placement ─────────────────────────────────────────────────
  const borderStyle = (input.styleConfig as { border_style?: string }).border_style ?? 'none'
  if (borderStyle !== 'none') {
    // We embed the border via a <rect ...>. Pull the rect attributes out of
    // the SVG and check geometry.
    const rectMatch = input.chromeSvg.match(
      /<rect[^>]*\sx="(-?\d+(?:\.\d+)?)"[^>]*\sy="(-?\d+(?:\.\d+)?)"[^>]*\swidth="(-?\d+(?:\.\d+)?)"[^>]*\sheight="(-?\d+(?:\.\d+)?)"[^>]*stroke=/,
    )
    if (rectMatch) {
      const bx = Number(rectMatch[1])
      const by = Number(rectMatch[2])
      const bw = Number(rectMatch[3])
      const bh = Number(rectMatch[4])
      const t = input.framing.trimBox
      const inTrim = bx >= t.x && by >= t.y && bx + bw <= t.x + t.w && by + bh <= t.y + t.h
      const s = input.framing.safeBox
      const inSafe = bx >= s.x && by >= s.y && bx + bw <= s.x + s.w && by + bh <= s.y + s.h
      if (!inTrim) {
        push({
          check: 'border_in_trim',
          severity: 'error',
          message: 'border is in the bleed area — will be cut off',
        })
      } else if (!inSafe) {
        push({
          check: 'border_in_safe',
          severity: 'warning',
          message: 'border is between trim and safe — risk of being trimmed',
        })
      }
    }
  }

  // ── 13. No unresolved external URLs in chrome SVG ────────────────────────
  // Logos must be embedded as data: URIs (pre-fetched). Anything else is a
  // build-time bug that would result in Sharp rendering a broken image.
  const externalRefs = [
    ...input.chromeSvg.matchAll(/(?:href|xlink:href)="(https?:\/\/[^"]+)"/g),
  ].map((m) => m[1])
  if (externalRefs.length > 0) {
    push({
      check: 'external_urls',
      severity: 'error',
      message: `chrome SVG contains ${externalRefs.length} unresolved external URL(s); all assets must be pre-fetched`,
      details: { sample: externalRefs.slice(0, 3) },
    })
  }

  // ── 14. Empty trail name ─────────────────────────────────────────────────
  const trailName = (input.styleConfig as { trail_name?: string }).trail_name?.trim() ?? ''
  if (!trailName) {
    push({
      check: 'trail_name_present',
      severity: 'error',
      message: 'trail_name is empty',
    })
  }

  const result: ValidationResult = {
    errors,
    warnings,
    checked_at: new Date().toISOString(),
    validator_version: VALIDATOR_VERSION,
    passed: errors.length === 0,
  }
  logValidationResult({
    render_class: input.renderClass,
    passed: result.passed,
    errors: errors.length,
    warnings: warnings.length,
  })
  return result
}
