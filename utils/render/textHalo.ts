// utils/render/textHalo.ts
//
// Shared text-halo recipe. The editor uses CSS `text-shadow` with 8
// directional offsets + a blur to keep titles readable when the map is
// busy underneath. The worker renders SVG with `paint-order="stroke fill"`
// + a stroke for the same effect. This module emits both from a single
// config so editor and worker can never drift.
//
// Editor source: MapPreview.vue:742-751 (formerly private).

export interface HaloConfig {
  /** The colour the halo paints with (typically the poster background). */
  color: string
  /**
   * Halo radius in CSS pixels (editor) / SVG units (worker).
   * Editor used hardcoded 2px / 4px-blur; we expose it for scale.
   */
  offsetPx?: number
  blurPx?: number
}

const DEFAULT_OFFSET = 2
const DEFAULT_BLUR = 4

/**
 * Editor-side: a CSS `text-shadow` value mirroring MapPreview.vue's
 * 9-direction halo (8 sharp offsets + a blur fill).
 */
export function getHaloCss(cfg: HaloConfig): string {
  const o = cfg.offsetPx ?? DEFAULT_OFFSET
  const b = cfg.blurPx ?? DEFAULT_BLUR
  const c = cfg.color
  return [
    `${-o}px ${-o}px 0 ${c}`,
    `0 ${-o}px 0 ${c}`,
    `${o}px ${-o}px 0 ${c}`,
    `${-o}px 0 0 ${c}`,
    `${o}px 0 0 ${c}`,
    `${-o}px ${o}px 0 ${c}`,
    `0 ${o}px 0 ${c}`,
    `${o}px ${o}px 0 ${c}`,
    `0 0 ${b}px ${c}`,
  ].join(', ')
}

/**
 * Worker-side: SVG attributes for halo via `paint-order` + stroke.
 * Returns the attributes as a string fragment to embed in a `<text>` tag,
 * e.g. `<text ${getHaloSvgAttrs({ color: '#fff' })}>…</text>`.
 *
 * `paint-order="stroke fill"` paints the stroke first so the fill sits
 * cleanly on top — same visual effect as the CSS multi-shadow halo.
 */
export function getHaloSvgAttrs(cfg: HaloConfig & { strokeWidth?: number }): string {
  const stroke = cfg.color
  const sw = cfg.strokeWidth ?? cfg.offsetPx ?? DEFAULT_OFFSET
  return `paint-order="stroke fill" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`
}
