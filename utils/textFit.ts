export interface TextFitBox {
  width: number
  height: number
}

export interface TextFitOptions {
  targetSizeCqh: number
  minScale: number
  maxLines?: number
  variableName?: string
  /**
   * Word-break policy for the fit search (editor-v2 D2 word-break fix):
   *
   * - 'wrap' (default, legacy): fit the text as the element wraps it. With
   *   `overflow-wrap: anywhere` styling this can break words MID-WORD
   *   ("KICKAPO/O") because the width never overflows scrollWidth.
   * - 'shrink-before-wrap' (title kind): never break mid-word. Stage A pins
   *   `white-space: nowrap` and shrinks from target toward the floor looking
   *   for a single-line fit. Only when even the floor cannot hold one line
   *   does Stage B allow wrapping — at word boundaries only, so the element
   *   MUST carry `overflow-wrap: normal` + `word-break: keep-all` (the
   *   caller's CSS owns that persistent state; see MapPreview's
   *   `[data-poster-fit-mode]` rule). A single very-long word that cannot fit
   *   even at the floor shrinks to the floor and clips, per
   *   docs/POSTER_TEXT_FIT_PLAN.md.
   */
  fitMode?: 'wrap' | 'shrink-before-wrap'
}

export interface TextFitResult {
  fontSizeCqh: number
  clipped: boolean
}

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function numericLineHeight(el: HTMLElement, fontSizePx: number): number {
  const raw = getComputedStyle(el).lineHeight
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fontSizePx * 1.2
}

function fits(el: HTMLElement, box: TextFitBox, maxLines: number | undefined): boolean {
  const style = getComputedStyle(el)
  const fontSizePx = Number.parseFloat(style.fontSize) || 0
  const lineHeight = numericLineHeight(el, fontSizePx)
  const heightLimit = maxLines ? Math.min(box.height, lineHeight * maxLines + 1) : box.height
  return el.scrollWidth <= box.width + 1 && el.scrollHeight <= heightLimit + 1
}

async function nextFrame(): Promise<void> {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

export async function fitTextToBox(
  el: HTMLElement,
  box: TextFitBox,
  options: TextFitOptions,
): Promise<TextFitResult> {
  const target = finitePositive(options.targetSizeCqh)
  if (!target || box.width <= 0 || box.height <= 0) {
    return { fontSizeCqh: target ?? 0, clipped: false }
  }

  const variableName = options.variableName ?? '--poster-fit-font-size'
  const minScale = Math.min(1, Math.max(0.1, finitePositive(options.minScale) ?? 1))
  const floor = target * minScale
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
  if (fonts?.ready) await fonts.ready

  const setSize = async (size: number) => {
    el.style.setProperty(variableName, `${size}cqh`)
    await nextFrame()
  }

  // Stage A (shrink-before-wrap only): prefer shrinking toward the floor over
  // wrapping at all — find the largest size in [floor, target] that holds the
  // text on ONE line. Measured under white-space: nowrap so multi-word titles
  // are considered as a whole; restored afterwards either way.
  if (options.fitMode === 'shrink-before-wrap') {
    const previousWhiteSpace = el.style.whiteSpace
    let singleLine: number | null = null
    try {
      el.style.whiteSpace = 'nowrap'
      await setSize(target)
      if (fits(el, box, 1)) {
        singleLine = target
      } else {
        let low = floor
        let high = target
        for (let i = 0; i < 12; i++) {
          const mid = (low + high) / 2
          await setSize(mid)
          if (fits(el, box, 1)) {
            singleLine = mid
            low = mid
          } else {
            high = mid
          }
        }
        if (singleLine == null) {
          await setSize(floor)
          if (fits(el, box, 1)) singleLine = floor
        }
      }
    } finally {
      el.style.whiteSpace = previousWhiteSpace
    }
    if (singleLine != null) {
      await setSize(singleLine)
      return { fontSizeCqh: singleLine, clipped: false }
    }
    // Even the floor cannot hold one line — fall through to the wrap search.
    // The element's keep-all styling limits Stage B to word-boundary wraps.
  }

  let low = floor
  let high = target
  let best = floor

  await setSize(target)
  if (fits(el, box, options.maxLines)) {
    return { fontSizeCqh: target, clipped: false }
  }

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    await setSize(mid)
    if (fits(el, box, options.maxLines)) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  await setSize(best)
  return { fontSizeCqh: best, clipped: !fits(el, box, options.maxLines) }
}
