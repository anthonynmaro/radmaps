/**
 * Pixel-diff our worker output against the editor screenshots the user
 * provided. Resamples both to a common resolution, computes per-pixel
 * delta, and writes a diff visualization.
 *
 * Usage: npx tsx scripts/diff-vs-editor.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const EDITOR_REFS: Record<string, string> = {
  'whiskey-off-road':
    '/Users/anthonymaro/.claude/image-cache/6e83afa6-2f18-43b6-98b8-5700fa1f6bc2/2.png',
  'kickapoo-mtb':
    '/Users/anthonymaro/.claude/image-cache/6e83afa6-2f18-43b6-98b8-5700fa1f6bc2/3.png',
}

const OUT_DIR = path.join(import.meta.dirname, '..', 'outputs')
const COMMON_W = 1024 // common width for diff comparison
const COMMON_H = 1366 // ~ 18x24 ratio (1024 / (24/18) = 1365.33)

async function compareOne(label: string, editorPath: string) {
  const workerPath = path.join(OUT_DIR, `${label}.final.jpg`)
  const exists = await fs
    .stat(workerPath)
    .then(() => true)
    .catch(() => false)
  if (!exists) {
    console.log(`  ⚠ ${label}: worker output missing at ${workerPath}`)
    return
  }

  // Resample both to the same dimensions.
  const editorRGBA = await sharp(editorPath)
    .resize(COMMON_W, COMMON_H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer()
  const workerRGBA = await sharp(workerPath)
    .resize(COMMON_W, COMMON_H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer()

  // Per-pixel L1 delta in RGB (ignore alpha).
  const N = COMMON_W * COMMON_H
  const diff = Buffer.alloc(N * 4)
  let totalDelta = 0
  let pixelsOver8 = 0 // pixels with delta > 8/255 (visible difference)
  let pixelsOver32 = 0 // pixels with delta > 32/255 (significant)
  for (let i = 0; i < N; i++) {
    const o = i * 4
    const dr = Math.abs(editorRGBA[o] - workerRGBA[o])
    const dg = Math.abs(editorRGBA[o + 1] - workerRGBA[o + 1])
    const db = Math.abs(editorRGBA[o + 2] - workerRGBA[o + 2])
    const d = (dr + dg + db) / 3
    totalDelta += d
    if (d > 8) pixelsOver8++
    if (d > 32) pixelsOver32++
    // Heat-map: red = strong diff, blue = small diff
    diff[o] = Math.min(255, d * 4)
    diff[o + 1] = 0
    diff[o + 2] = d > 8 ? 0 : 128
    diff[o + 3] = 255
  }

  const meanDelta = totalDelta / N
  const pctClose = (1 - pixelsOver8 / N) * 100
  const pctVeryClose = (1 - pixelsOver32 / N) * 100
  console.log(`  ${label}:`)
  console.log(`    mean delta:    ${meanDelta.toFixed(2)} / 255`)
  console.log(`    % within 8/255 (perceptually close): ${pctClose.toFixed(2)}%`)
  console.log(`    % within 32/255 (visually close):    ${pctVeryClose.toFixed(2)}%`)

  // Save diff visualization
  const diffPath = path.join(OUT_DIR, `${label}.diff.png`)
  await sharp(diff, { raw: { width: COMMON_W, height: COMMON_H, channels: 4 } })
    .png()
    .toFile(diffPath)
  console.log(`    diff visualization saved: ${diffPath}`)

  // Side-by-side composite for at-a-glance review.
  const sideBySide = await sharp({
    create: {
      width: COMMON_W * 2 + 20,
      height: COMMON_H,
      channels: 4,
      background: { r: 64, g: 64, b: 64, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(editorPath).resize(COMMON_W, COMMON_H, { fit: 'fill' }).png().toBuffer(),
        left: 0,
        top: 0,
      },
      {
        input: await sharp(workerPath).resize(COMMON_W, COMMON_H, { fit: 'fill' }).png().toBuffer(),
        left: COMMON_W + 20,
        top: 0,
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, `${label}.side-by-side.png`))
  console.log(`    side-by-side saved: ${label}.side-by-side.png`)
}

async function main() {
  console.log('=== editor vs worker pixel-diff ===\n')
  for (const [label, ref] of Object.entries(EDITOR_REFS)) {
    await compareOne(label, ref)
    console.log()
  }
}

await main()
