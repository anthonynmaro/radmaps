// utils/render/brandingMark.ts
//
// Shared "RAD MAPS" branding mark — the small mountain icon that
// appears with the radmaps.studio wordmark when show_branding=true.
// Source of truth so the editor template and the worker SVG composer
// emit byte-identical branding artwork.
//
// Editor usage (MapPreview.vue:335-341): renders the SVG inline via
// Vue template; CSS color comes from styleConfig.label_text_color and
// the icon is shown at 40% opacity.
//
// Worker usage: render-worker-v4/src/chrome/svgTemplate.ts inserts
// `getBrandingMarkSvg(...)` into the footer band when show_branding
// is true.

export interface BrandingMarkInput {
  /** Top-left X of the mark in the destination SVG canvas. */
  x: number
  /** Top-left Y. */
  y: number
  /** Render size in pixels (square). */
  size: number
  /** Stroke / fill color (typically styleConfig.label_text_color). */
  color: string
  /** Overall opacity. Editor uses 0.4. */
  opacity?: number
}

/**
 * Emit the mountain branding mark as an SVG `<g>` group, ready to
 * embed inside a parent <svg>. Group is positioned and scaled to
 * (x, y, size×size) using a transform; the inner paths use the
 * canonical 32×32 viewBox coordinates.
 */
export function getBrandingMarkSvg(input: BrandingMarkInput): string {
  const { x, y, size, color, opacity = 0.4 } = input
  const scale = size / 32
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}" stroke-linejoin="round">` +
    `<path d="M2 26 L11 8 L16 16 L21 10 L30 26Z" fill="${color}" opacity="0.12"/>` +
    `<path d="M2 26 L11 8 L16 16 L21 10 L30 26" stroke="${color}" stroke-width="1.6" fill="none"/>` +
    `<path d="M5 22 Q11 19 16 20.5 Q21 22 27 20" stroke="${color}" stroke-width="0.9" fill="none"/>` +
    `<path d="M8 18 Q13 16 16 17 Q19.5 18 23 16.5" stroke="${color}" stroke-width="0.65" fill="none" opacity="0.6"/>` +
    `<circle cx="11" cy="8" r="1.1" fill="${color}"/>` +
    `</g>`
  )
}
