import type { AnchorFitConfig } from '~/types'

export type TextFitOverflow = NonNullable<AnchorFitConfig['overflow']>

export interface TextFitBox {
  width: number
  height: number
}

export interface TextFitOptions {
  targetSizeCqh: number
  minScale: number
  maxLines?: number
  overflow?: TextFitOverflow
}

export interface TextFitResult {
  targetSizeCqh: number
  fittedSizeCqh: number
  scale: number
  clipped: boolean
  settled: boolean
}

const FIT_EPSILON_PX = 1
const FIT_SEARCH_STEPS = 12

export function normalizeTextFitOptions(options: TextFitOptions): Required<Pick<TextFitOptions, 'targetSizeCqh' | 'minScale' | 'overflow'>> & Pick<TextFitOptions, 'maxLines'> {
  const targetSizeCqh = Number.isFinite(options.targetSizeCqh) && options.targetSizeCqh > 0
    ? options.targetSizeCqh
    : 1
  const minScale = Number.isFinite(options.minScale)
    ? Math.min(1, Math.max(0.1, options.minScale))
    : 0.5
  return {
    targetSizeCqh,
    minScale,
    maxLines: options.maxLines,
    overflow: options.overflow ?? 'clip',
  }
}

export function textFitFloorCqh(options: TextFitOptions) {
  const normalized = normalizeTextFitOptions(options)
  return normalized.targetSizeCqh * normalized.minScale
}

function boxFromTarget(box: TextFitBox | HTMLElement): TextFitBox {
  if (box instanceof HTMLElement) {
    const rect = box.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }
  return box
}

async function waitForFonts() {
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
  if (fonts?.ready) await fonts.ready
}

function applyClampStyles(el: HTMLElement, maxLines: number | undefined, overflow: TextFitOverflow) {
  el.style.overflow = 'hidden'
  if (overflow === 'clamp' && maxLines && maxLines > 0) {
    el.style.display = '-webkit-box'
    el.style.setProperty('-webkit-line-clamp', String(maxLines))
    el.style.setProperty('-webkit-box-orient', 'vertical')
  } else {
    el.style.removeProperty('-webkit-line-clamp')
    el.style.removeProperty('-webkit-box-orient')
  }
}

function setFitSize(el: HTMLElement, sizeCqh: number, targetSizeCqh: number) {
  el.style.setProperty('--radmaps-text-fit-size-cqh', String(Number(sizeCqh.toFixed(4))))
  el.style.setProperty('--radmaps-text-fit-size', `${Number(sizeCqh.toFixed(4))}cqh`)
  el.style.setProperty('--radmaps-text-fit-scale', String(Number((sizeCqh / targetSizeCqh).toFixed(4))))
  el.style.setProperty('font-size', `${Number(sizeCqh.toFixed(4))}cqh`, 'important')
}

function elementFits(el: HTMLElement, box: TextFitBox) {
  return el.scrollWidth <= box.width + FIT_EPSILON_PX
    && el.scrollHeight <= box.height + FIT_EPSILON_PX
}

export async function fitTextToBox(
  el: HTMLElement,
  boxTarget: TextFitBox | HTMLElement,
  options: TextFitOptions,
): Promise<TextFitResult> {
  const normalized = normalizeTextFitOptions(options)
  await waitForFonts()

  const box = boxFromTarget(boxTarget)
  const targetSizeCqh = normalized.targetSizeCqh
  const floorSizeCqh = textFitFloorCqh(normalized)
  applyClampStyles(el, normalized.maxLines, normalized.overflow)

  if (box.width <= 0 || box.height <= 0) {
    setFitSize(el, targetSizeCqh, targetSizeCqh)
    el.dataset.textFitStatus = 'unmeasured'
    return {
      targetSizeCqh,
      fittedSizeCqh: targetSizeCqh,
      scale: 1,
      clipped: false,
      settled: false,
    }
  }

  setFitSize(el, targetSizeCqh, targetSizeCqh)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  if (elementFits(el, box)) {
    el.dataset.textFitStatus = 'fit'
    return {
      targetSizeCqh,
      fittedSizeCqh: targetSizeCqh,
      scale: 1,
      clipped: false,
      settled: true,
    }
  }

  let low = floorSizeCqh
  let high = targetSizeCqh
  let best = floorSizeCqh

  for (let i = 0; i < FIT_SEARCH_STEPS; i += 1) {
    const mid = (low + high) / 2
    setFitSize(el, mid, targetSizeCqh)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (elementFits(el, box)) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  setFitSize(el, best, targetSizeCqh)
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const clipped = !elementFits(el, box)
  el.dataset.textFitStatus = clipped ? 'clipped' : 'fit'
  return {
    targetSizeCqh,
    fittedSizeCqh: best,
    scale: best / targetSizeCqh,
    clipped,
    settled: true,
  }
}
