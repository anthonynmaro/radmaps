/**
 * Three-way side-by-side: editor screenshot | v4 worker output | legacy worker output.
 * Lays out each at common width and stitches into one PNG so the gap
 * between v4-vs-editor (the parity target) and v4-vs-legacy (the actual
 * production baseline being replaced) is visible at a glance.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

// Fresh editor refs are captured by scripts/capture-editor.ts and live
// alongside the v4 outputs. Re-run that script to refresh.
const EDITOR_REFS: Record<string, string> = {
  'whiskey-off-road': path.join(import.meta.dirname, '..', 'outputs', 'editor-refs', 'whiskey-off-road.editor.png'),
  'kickapoo-mtb': path.join(import.meta.dirname, '..', 'outputs', 'editor-refs', 'kickapoo-mtb.editor.png'),
}

const OUT_DIR = path.join(import.meta.dirname, '..', 'outputs')
// Display columns at the editor's captured aspect (3:4 print = 18×24).
// Both editor PNG and v4 JPG are at 3:4 — using fit: 'inside' preserves
// aspect (no stretch) so any visible difference is a real rendering
// difference, not a resize artifact.
const COL_W = 768
const COL_H = 1024
const LABEL_H = 60
const GAP = 16

async function makeColumn(label: string, src: string, fallbackText: string): Promise<Buffer> {
  let img: Buffer
  if (await fs.stat(src).then(() => true).catch(() => false)) {
    // 'contain' resizes preserving aspect ratio AND pads to exact box.
    img = await sharp(src)
      .resize(COL_W, COL_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toBuffer()
  } else {
    img = await sharp({
      create: {
        width: COL_W,
        height: COL_H,
        channels: 4,
        background: { r: 255, g: 240, b: 240, alpha: 1 },
      },
    })
      .png()
      .toBuffer()
  }

  // Stack a label band above the image.
  const labelSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${COL_W}" height="${LABEL_H}">
      <rect width="${COL_W}" height="${LABEL_H}" fill="#1c1c1e"/>
      <text x="${COL_W / 2}" y="${LABEL_H * 0.6}" text-anchor="middle" fill="#ffffff" font-family="DM Sans, sans-serif" font-size="22" font-weight="600">${label}</text>
    </svg>`
  const labelPng = await sharp(Buffer.from(labelSvg)).png().toBuffer()

  return await sharp({
    create: {
      width: COL_W,
      height: COL_H + LABEL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: labelPng, left: 0, top: 0 },
      { input: img, left: 0, top: LABEL_H },
    ])
    .png()
    .toBuffer()
}

async function compareOne(label: string, editorPath: string) {
  const v4Path = path.join(OUT_DIR, `${label}.final.jpg`)
  const legacyPath = path.join(OUT_DIR, 'legacy-renders', `${label}.legacy.jpg`)

  const editorCol = await makeColumn('EDITOR (target)', editorPath, 'editor screenshot missing')
  const v4Col = await makeColumn('v4 WORKER (ours)', v4Path, 'v4 output missing')
  const legacyCol = await makeColumn('LEGACY (shipping today)', legacyPath, 'legacy output missing')

  const totalW = COL_W * 3 + GAP * 2
  const totalH = COL_H + LABEL_H

  const composite = await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 64, g: 64, b: 64, alpha: 1 },
    },
  })
    .composite([
      { input: editorCol, left: 0, top: 0 },
      { input: v4Col, left: COL_W + GAP, top: 0 },
      { input: legacyCol, left: (COL_W + GAP) * 2, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT_DIR, `${label}.3way.png`))

  console.log(`  ${label}.3way.png written (${totalW}×${totalH})`)
}

async function main() {
  console.log('=== editor / v4 / legacy 3-way comparison ===\n')
  for (const [label, ref] of Object.entries(EDITOR_REFS)) {
    await compareOne(label, ref)
  }
}

await main()
