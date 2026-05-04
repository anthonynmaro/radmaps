/**
 * Capture the editor's MapPreview rendering for Whiskey + Kickapoo via the
 * public /map/[id] page (which uses the same MapPreview component as the
 * editor — just non-editable). Saves PNGs at clean print-aspect-ratio
 * dimensions so the 3-way diff scales cleanly against the v4 worker.
 *
 * The /map/[id] CSS lets the canvas stretch when both `height: 100%`
 * and `max-width: 100%` are set (`aspect-ratio` is just a hint when
 * both axes are explicitly constrained). We force a fixed pixel size
 * matching the print's W:H ratio so what's captured is what would be
 * printed — without the editor's display distortion.
 */
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'

const TARGETS: Array<{
  id: string
  label: string
  // Print aspect — width × height in inches.
  ratio: { w: number; h: number }
}> = [
  { id: '50bf79ce-7a6b-47f5-bc7a-3fd5690f5c8e', label: 'whiskey-off-road', ratio: { w: 18, h: 24 } },
  { id: '6844d3ac-b1bc-45de-acbc-8d91f2c4d7ff', label: 'kickapoo-mtb', ratio: { w: 18, h: 24 } },
]

const outDir = path.join(import.meta.dirname, '..', 'outputs', 'editor-refs')
await fs.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
// Generous viewport so we can force the canvas to clean aspect and still
// fit on screen. deviceScaleFactor 2 = retina capture for sharper text.
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 2400 },
  deviceScaleFactor: 2,
})

for (const t of TARGETS) {
  const page = await ctx.newPage()
  console.log(`navigating to /map/${t.id}…`)
  await page.goto(`http://localhost:3000/map/${t.id}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.poster-canvas', { timeout: 20000 })

  // Force the print aspect on the canvas, override the page's flex
  // sizing constraints, and give MapLibre time to settle.
  const canvasW = 900
  const canvasH = Math.round(canvasW * (t.ratio.h / t.ratio.w))
  await page.evaluate(({ w, h }) => {
    const canvas = document.querySelector<HTMLElement>('.poster-canvas')
    if (!canvas) return
    // Tailwind utility classes (max-w-2xl etc.) on ancestors win against
    // inline max-width without !important. Use setProperty + 'important'.
    canvas.style.setProperty('width', `${w}px`, 'important')
    canvas.style.setProperty('height', `${h}px`, 'important')
    canvas.style.setProperty('max-width', `${w}px`, 'important')
    canvas.style.setProperty('max-height', `${h}px`, 'important')
    canvas.style.setProperty('aspect-ratio', 'auto', 'important')
    canvas.style.setProperty('flex', 'none', 'important')
    // Walk up to the parent (.max-w-2xl) and relax its constraints.
    let el: HTMLElement | null = canvas.parentElement
    while (el) {
      el.style.setProperty('max-width', `${w + 100}px`, 'important')
      el.style.setProperty('height', `${h + 100}px`, 'important')
      el.style.setProperty('max-height', `${h + 100}px`, 'important')
      if (el === document.body) break
      el = el.parentElement
    }
    window.dispatchEvent(new Event('resize'))
  }, { w: canvasW, h: canvasH })
  // Tiles + map fit settle.
  await page.waitForTimeout(6000)
  const handle = await page.$('.poster-canvas')
  if (!handle) {
    console.error(`  ✗ .poster-canvas not found for ${t.label}`)
    await page.close()
    continue
  }
  const out = path.join(outDir, `${t.label}.editor.png`)
  await handle.screenshot({ path: out })
  const box = await handle.boundingBox()
  console.log(`  ✓ ${t.label}: saved ${out} (canvas ${box?.width.toFixed(0)}×${box?.height.toFixed(0)})`)
  await page.close()
}
await browser.close()
console.log('done')
