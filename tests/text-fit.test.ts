// Editor-v2 D2 — fitTextToBox word-break behavior (the "KICKAPO/O" bug).
//
// Title-kind slots use fitMode 'shrink-before-wrap': never break mid-word —
// shrink toward the floor looking for a single-line fit first; only when even
// the floor cannot hold one line, wrap at WORD boundaries (the element carries
// overflow-wrap: normal + word-break: keep-all); a single very-long word
// shrinks to the floor and clips. Legacy 'wrap' mode stays byte-identical.
//
// The DOM is simulated with a measured layout model (node environment): the
// element reports scrollWidth/scrollHeight from a greedy word-wrap of its text
// at the font size fitTextToBox sets via --poster-fit-font-size, honoring the
// element's word-break mode and any white-space: nowrap the fitter pins.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fitTextToBox } from '../utils/textFit'

const PX_PER_CQH = 10
const CHAR_W = 0.6 // px per char per font px — flat-width model

type WordBreakMode = 'anywhere' | 'keep-all'

class FakeTitleElement {
  text: string
  cssWordBreak: WordBreakMode
  boxWidth: number
  fontCqh = 0
  style: { whiteSpace: string; setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void }
  private props = new Map<string, string>()

  constructor(text: string, cssWordBreak: WordBreakMode, boxWidth: number) {
    this.text = text
    this.cssWordBreak = cssWordBreak
    this.boxWidth = boxWidth
    this.style = {
      whiteSpace: '',
      setProperty: (name, value) => {
        this.props.set(name, value)
        if (name === '--poster-fit-font-size') this.fontCqh = Number.parseFloat(value)
      },
      removeProperty: (name) => { this.props.delete(name) },
    }
  }

  get fontPx() {
    return this.fontCqh * PX_PER_CQH
  }

  private wordWidth(word: string) {
    return word.length * CHAR_W * this.fontPx
  }

  private get spaceWidth() {
    return CHAR_W * this.fontPx
  }

  /** Greedy layout → [maxLineWidth, lineCount] for the current font + mode. */
  layout(): { maxLineWidth: number; lines: number } {
    const totalWidth = this.text.length * CHAR_W * this.fontPx
    if (this.style.whiteSpace === 'nowrap') {
      return { maxLineWidth: totalWidth, lines: 1 }
    }
    if (this.cssWordBreak === 'anywhere') {
      // Breaks anywhere, including mid-word: width never overflows the box.
      const lines = Math.max(1, Math.ceil(totalWidth / this.boxWidth))
      return { maxLineWidth: Math.min(totalWidth, this.boxWidth), lines }
    }
    // keep-all: wrap at word boundaries only; an overlong word overflows.
    // The wrap threshold carries the same 1px rounding slack fits() allows
    // (DOM scrollWidth is integer-rounded; the model is fractional).
    const words = this.text.split(/\s+/)
    let lines = 1
    let lineWidth = 0
    let maxLineWidth = 0
    for (const word of words) {
      const width = this.wordWidth(word)
      const proposed = lineWidth === 0 ? width : lineWidth + this.spaceWidth + width
      if (lineWidth > 0 && proposed > this.boxWidth + 1) {
        maxLineWidth = Math.max(maxLineWidth, lineWidth)
        lines += 1
        lineWidth = width
      } else {
        lineWidth = proposed
      }
    }
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
    return { maxLineWidth, lines }
  }

  get scrollWidth() {
    return this.layout().maxLineWidth
  }

  get scrollHeight() {
    // line-height == font size in this model (see getComputedStyle stub).
    return this.layout().lines * this.fontPx
  }
}

const globals = globalThis as Record<string, unknown>
const saved: Record<string, unknown> = {}

beforeAll(() => {
  for (const key of ['requestAnimationFrame', 'document', 'getComputedStyle']) {
    saved[key] = globals[key]
  }
  globals.requestAnimationFrame = (cb: (t: number) => void) => { cb(0); return 0 }
  globals.document = { fonts: { ready: Promise.resolve() } }
  globals.getComputedStyle = (el: FakeTitleElement) => ({
    fontSize: `${el.fontPx}px`,
    lineHeight: `${el.fontPx}px`,
  })
})

afterAll(() => {
  for (const key of ['requestAnimationFrame', 'document', 'getComputedStyle']) {
    if (saved[key] === undefined) delete globals[key]
    else globals[key] = saved[key]
  }
})

const TARGET = 12 // cqh → 120px in the model
const MIN_SCALE = 0.42 // title-kind floor (chromeBlockFitMinScale)
const FLOOR = TARGET * MIN_SCALE
const BOX = { width: 500, height: 1000 }

function fit(el: FakeTitleElement, fitMode?: 'wrap' | 'shrink-before-wrap') {
  return fitTextToBox(el as unknown as HTMLElement, BOX, {
    targetSizeCqh: TARGET,
    minScale: MIN_SCALE,
    maxLines: 3,
    fitMode,
  })
}

describe('fitTextToBox shrink-before-wrap (title kind)', () => {
  it('"KICKAPOO": a single word shrinks to a one-line fit instead of breaking mid-word', async () => {
    const el = new FakeTitleElement('KICKAPOO', 'keep-all', BOX.width)
    const result = await fit(el, 'shrink-before-wrap')
    expect(result.clipped).toBe(false)
    expect(result.fontSizeCqh).toBeLessThan(TARGET)
    expect(result.fontSizeCqh).toBeGreaterThanOrEqual(FLOOR)
    // At the fitted size the whole word holds one line — no wrap at all.
    expect(el.layout().lines).toBe(1)
    expect(el.scrollWidth).toBeLessThanOrEqual(BOX.width + 1)
  })

  it('"KICKAPOO" legacy wrap mode documents the bug shape: anywhere-wrap hides the overflow', async () => {
    // With overflow-wrap: anywhere the width never overflows, so legacy mode
    // keeps the target size and the browser breaks the word mid-word
    // ("KICKAPO/O"). This pins the flag-off behavior as unchanged.
    const el = new FakeTitleElement('KICKAPOO', 'anywhere', BOX.width)
    const result = await fit(el)
    expect(result.fontSizeCqh).toBe(TARGET)
    expect(el.layout().lines).toBeGreaterThan(1) // the mid-word break
  })

  it('"H&H Connector": short multi-word title shrinks onto a single line before wrapping', async () => {
    const el = new FakeTitleElement('H&H Connector', 'keep-all', BOX.width)
    const result = await fit(el, 'shrink-before-wrap')
    expect(result.clipped).toBe(false)
    expect(result.fontSizeCqh).toBeGreaterThanOrEqual(FLOOR)
    expect(result.fontSizeCqh).toBeLessThan(TARGET)
    expect(el.layout().lines).toBe(1)
  })

  it('"Yosemite Valley Loop Trail via Mirror Lake": long multi-word titles may wrap at word boundaries', async () => {
    const el = new FakeTitleElement('Yosemite Valley Loop Trail via Mirror Lake', 'keep-all', BOX.width)
    const result = await fit(el, 'shrink-before-wrap')
    expect(result.clipped).toBe(false)
    expect(result.fontSizeCqh).toBeGreaterThanOrEqual(FLOOR)
    expect(result.fontSizeCqh).toBeLessThan(TARGET)
    const layout = el.layout()
    // Cannot single-line above the floor → wrapped, but at word boundaries
    // within maxLines and within the box (keep-all model: no mid-word breaks).
    expect(layout.lines).toBeGreaterThan(1)
    expect(layout.lines).toBeLessThanOrEqual(3)
    expect(el.scrollWidth).toBeLessThanOrEqual(BOX.width + 1)
  })

  it('a single very-long word shrinks to the floor then clips (per the plan)', async () => {
    const el = new FakeTitleElement('PNEUMONOULTRAMICROSCOPICSILICOVOLCANOCONIOSIS', 'keep-all', BOX.width)
    const result = await fit(el, 'shrink-before-wrap')
    expect(result.fontSizeCqh).toBeCloseTo(FLOOR, 5)
    expect(result.clipped).toBe(true)
  })

  it('restores the element white-space after the single-line stage', async () => {
    const el = new FakeTitleElement('Yosemite Valley Loop Trail via Mirror Lake', 'keep-all', BOX.width)
    el.style.whiteSpace = ''
    await fit(el, 'shrink-before-wrap')
    expect(el.style.whiteSpace).toBe('')
  })

  it('keeps the target when it already fits on one line (no needless shrink)', async () => {
    const el = new FakeTitleElement('RIDGE', 'keep-all', BOX.width)
    const result = await fit(el, 'shrink-before-wrap')
    expect(result.fontSizeCqh).toBe(TARGET)
    expect(result.clipped).toBe(false)
  })
})

describe('fitTextToBox legacy wrap mode (unchanged)', () => {
  it('multi-line wrap fitting still works without fitMode', async () => {
    const el = new FakeTitleElement('Yosemite Valley Loop Trail via Mirror Lake', 'anywhere', BOX.width)
    const result = await fit(el)
    expect(result.fontSizeCqh).toBeLessThanOrEqual(TARGET)
    expect(result.fontSizeCqh).toBeGreaterThanOrEqual(FLOOR)
  })

  it('empty/degenerate boxes return the target unfitted', async () => {
    const el = new FakeTitleElement('KICKAPOO', 'keep-all', BOX.width)
    const result = await fitTextToBox(el as unknown as HTMLElement, { width: 0, height: 0 }, {
      targetSizeCqh: TARGET,
      minScale: MIN_SCALE,
      fitMode: 'shrink-before-wrap',
    })
    expect(result).toEqual({ fontSizeCqh: TARGET, clipped: false })
  })
})
