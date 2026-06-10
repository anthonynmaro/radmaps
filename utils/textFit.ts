export interface TextFitBox {
  width: number
  height: number
}

export interface TextFitOptions {
  targetSizeCqh: number
  minScale: number
  maxLines?: number
  variableName?: string
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

  let low = floor
  let high = target
  let best = floor

  el.style.setProperty(variableName, `${target}cqh`)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (fits(el, box, options.maxLines)) {
    return { fontSizeCqh: target, clipped: false }
  }

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    el.style.setProperty(variableName, `${mid}cqh`)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (fits(el, box, options.maxLines)) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  el.style.setProperty(variableName, `${best}cqh`)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  return { fontSizeCqh: best, clipped: !fits(el, box, options.maxLines) }
}
