// render-worker-v4/src/chrome/svgTemplate.ts
//
// SVG generator for the poster chrome. Mirrors the layout decisions the
// browser editor makes in MapPreview.vue, by consuming the same
// `getPosterLayout()` + `getPosterTypography()` helpers from
// utils/posterData.ts. That keeps the print render in lockstep with what
// the customer just approved on screen — when you tweak typography or
// band placement in the editor, the worker tracks automatically.
//
// What lives here:
//   • Title band (header — at top OR bottom per layout.titlePosition)
//   • Footer band (stats: distance, elevation, occasion text)
//   • Border frame (inside the safe area)
//   • Logo (header-right / map-top-right / footer-left positions)
//
// Not yet here (planned follow-up — each is non-trivial):
//   • Trail segment legend (left-margin labels with leader lines)
//   • Start/finish pin dots and labels (the editor uses HTML
//     maplibregl.Marker overlays — they're not in the map raster, so
//     they need to be drawn in this SVG layer based on bbox geometry)
//   • Elevation profile band
//
// Editor parity strategy:
//   The editor's typography sizes use cqh units (1cqh = 1% of poster
//   height). For SVG output we convert: sizePx = sizeCqh * (totalHeightPx / 100).
//   Padding values are CSS-shaped ('5cqh 7cqw 2.8cqh') so we parse the
//   relevant ones we use.

import {
  getPosterLayout,
  getPosterTypography,
  toFontStack,
  type PosterLayoutProfile,
  type PosterTypographyProfile,
} from '../../../utils/posterData.js'
import type { PrintFraming } from '../../../utils/print/printFraming.js'
import { getBrandingMarkSvg } from '../../../utils/render/brandingMark.js'
import { clampWeightToAvailable } from '../../../utils/render/fontRegistry.js'
import { formatCoordsFromBbox, type Bbox } from '../../../utils/render/posterFormatters.js'
import type { OverlayLayoutResult } from '../../../utils/render/overlayLayout.js'

// Pull the first quoted family out of a CSS font-stack (e.g.
// `"'Bebas Neue', sans-serif"` → `Bebas Neue`). Used to look up
// available weights in the font registry.
function primaryFamily(stack: string): string {
  const m = stack.match(/^[\s,]*'([^']+)'/) ?? stack.match(/^[\s,]*"([^"]+)"/)
  return m ? m[1]! : stack.split(',')[0]!.trim()
}

import type { RouteStats, StyleConfig } from '../types.js'

export type LabelPosition = 'top' | 'bottom' | 'overlay'
export type BorderStyle = 'thin' | 'thick' | 'none'

export interface SvgChromeInput {
  framing: PrintFraming
  styleConfig: StyleConfig
  stats: RouteStats
  /** Resolved logo data URI, if any; pre-fetched into a Buffer upstream. */
  logoDataUri?: string
  /** Pre-computed pin + leader-line layout from utils/render/overlayLayout. */
  overlayLayout?: OverlayLayoutResult
  /** [minLng, minLat, maxLng, maxLat] — used for footer-band coords display. */
  bbox?: Bbox
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// XML-escape user-supplied text. Comprehensive enough for SVG attribute +
// element content contexts. NOTE: callers must `.toUpperCase()` BEFORE esc()
// — otherwise &quot; gets uppercased to &QUOT; which librsvg rejects.
//
// Also collapses internal whitespace (newlines, tabs) and trims edges.
// Database trail names sometimes arrive wrapped in \n; SVG <text> with
// text-anchor="end" treats edge whitespace as part of the run width and
// shifts visible glyphs off the intended position.
function esc(s: string): string {
  if (!s) return ''
  return String(s)
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// cqh → px. The editor sets `container-type: size` on the poster canvas
// and uses cqh, where 1cqh = 1% of container height. For our SVG the
// container is the full bleed canvas.
function cqhToPx(cqh: number, framing: PrintFraming): number {
  return cqh * 0.01 * framing.fullHeightPx
}

// cqw → px (1cqw = 1% of container width).
function cqwToPx(cqw: number, framing: PrintFraming): number {
  return cqw * 0.01 * framing.fullWidthPx
}

// Editor parity (MapPreview.vue:903-907 frameStyle):
//   inset: '14px',
//   border: `${borderW.value !== '0' ? borderW.value : '1px'} solid ${fg}`,
//   opacity: '0.18'
// The inset is FIXED 14px regardless of poster size — it's a hairline trim
// safe-zone, not a proportional margin.
function borderInsetPx(_framing: PrintFraming, style: BorderStyle): number {
  if (style === 'none') return 14 // editor still draws a 1px frame at 14px inset
  return 14
}

// Editor frameStyle width:
//   border_style 'thick' → '2px'
//   border_style 'thin'  → '1px'
//   border_style 'none'  → still draws a 1px frame at opacity 0.18
function borderStrokePx(style: BorderStyle): number {
  if (style === 'thick') return 2
  if (style === 'thin') return 1
  return 1 // even when 'none', editor draws 1px (it's the safe-zone hairline)
}

// Compute the height of a band. Mirrors MapPreview.vue's flex layout:
// the band shrinks to its content, but content is fully determined by
// typography sizes + padding rules — so we can compute it deterministically.
//
// Exported so callers (test-render harness, real worker) can pass band
// heights into computeOverlayLayout — leader labels need to stay clear
// of where these rects will paint, since chrome bands draw on top of
// the leader-line SVG layer.
//
// Header padding (MapPreview.vue:756):
//   titlePosition === 'top':    padding = 5cqh   7cqw  2.8cqh  (top right bottom)
//   titlePosition === 'bottom': padding = 2.4cqh 7cqw  3.5cqh
// Header content (in order):
//   1. (rule when titlePosition === 'bottom')
//   2. title (line-height = typo.titleLineHeight)
//   3. gap = 1.1cqh (header flex gap)
//   4. subtitle
//   5. (rule when titlePosition === 'top')
export function headerBandHeightPx(
  layout: PosterLayoutProfile,
  typo: PosterTypographyProfile,
  styleConfig: StyleConfig,
  framing: PrintFraming,
): number {
  const titleScale = (styleConfig as { title_scale?: number }).title_scale ?? 1
  const subScale = (styleConfig as { subtitle_scale?: number }).subtitle_scale ?? 1

  const titlePx = cqhToPx(typo.titleSize * titleScale, framing)
  const subPx = cqhToPx(typo.subSize * subScale, framing)
  const titleLineH = parseFloat(typo.titleLineHeight) || 1.0
  const gapPx = cqhToPx(1.1, framing) // header flex gap

  const topPad = cqhToPx(layout.titlePosition === 'top' ? 5.0 : 2.4, framing)
  const bottomPad = cqhToPx(layout.titlePosition === 'top' ? 2.8 : 3.5, framing)

  const rulePx = 1
  const locationLine = (styleConfig as { location_text?: string }).location_text ?? ''
  const subtitleH = locationLine.trim() ? subPx * 1.2 + gapPx : 0 // subtitle line-height ~1.2

  return Math.round(topPad + titlePx * titleLineH + subtitleH + bottomPad + rulePx)
}

// Footer layout (MapPreview.vue:805-901):
//   paddingTop = paddingBottom = border_style !== 'none' ? '1.8cqh + 14px' : '1.8cqh'
//   paddingLeft = paddingRight = 7cqw
//   align-items: center
// Tallest content is the stat block: number(2.6cqh, line-height=1) + 0.55cqh
// margin-top + unit(0.8cqh, line-height ~1.2). The branding cluster is also
// in the running but typically shorter at common scales; take max.
export function footerBandHeightPx(
  styleConfig: StyleConfig,
  framing: PrintFraming,
): number {
  const borderStyle = (styleConfig as { border_style?: BorderStyle }).border_style ?? 'none'
  const borderExtraPx = borderStyle !== 'none' ? 28 : 0 // 14 top + 14 bottom

  const padPx = cqhToPx(1.8, framing) * 2

  // Stat block content: number (2.6cqh × 1.0) + 0.55cqh gap + unit (0.8cqh × 1.2)
  const statBlockH =
    cqhToPx(2.6 * 1.0, framing) + cqhToPx(0.55, framing) + cqhToPx(0.8 * 1.2, framing)

  // Branding cluster: icon (4cqh) + 0.4cqh gap + RAD MAPS (0.55cqh × 1.2) +
  //                   0.4cqh gap + radmaps.studio (0.42cqh × 1.2)
  const showBranding = (styleConfig as { show_branding?: boolean }).show_branding !== false
  const brandingH = showBranding
    ? cqhToPx(4.0, framing) +
      cqhToPx(0.4, framing) +
      cqhToPx(0.55 * 1.2, framing) +
      cqhToPx(0.4, framing) +
      cqhToPx(0.42 * 1.2, framing)
    : 0

  const contentH = Math.max(statBlockH, brandingH)
  return Math.round(padPx + contentH + borderExtraPx)
}

// Stats display values. Falls back to common shapes that may appear in stats.
function deriveStats(stats: RouteStats) {
  const s = stats as {
    distance_km?: number
    distance_mi?: number
    elevation_gain_m?: number
    elevation_gain_ft?: number
    ascent_ft?: number
    location?: string
  }
  // Editor parity (MapPreview.vue:723-731): the formatted values are
  // computed ONLY when the underlying number is truthy. A GPX with no
  // elevation data has elevation_gain_m=0; the editor renders that as
  // an empty string and the v-if hides the block. Mirror that here so
  // we don't print a literal "0 FT GAIN" the editor would never show.
  const distanceMi =
    s.distance_mi
      ? s.distance_mi.toFixed(1)
      : s.distance_km
        ? (s.distance_km * 0.621371).toFixed(1)
        : ''
  const elevGainFt =
    s.elevation_gain_ft
      ? Math.round(s.elevation_gain_ft).toLocaleString()
      : s.ascent_ft
        ? Math.round(s.ascent_ft).toLocaleString()
        : s.elevation_gain_m
          ? Math.round(s.elevation_gain_m * 3.28084).toLocaleString()
          : ''
  return { distanceMi, elevGainFt }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the SVG chrome layer as a string. The compositor renders this via
 * Sharp at the same dimensions as the map raster.
 */
export function buildChromeSvg(input: SvgChromeInput): string {
  const { framing, styleConfig, stats } = input
  const { fullWidthPx: W, fullHeightPx: H, trimBox, safeBox } = framing

  // ─── Source-of-truth layout & typography (mirrors editor) ─────────────────
  const layout = getPosterLayout(styleConfig as never)
  const typo = getPosterTypography(styleConfig as never)

  const titleScale = (styleConfig as { title_scale?: number }).title_scale ?? 1
  const subtitleScale = (styleConfig as { subtitle_scale?: number }).subtitle_scale ?? 1
  const occasionScale = (styleConfig as { occasion_scale?: number }).occasion_scale ?? 1

  // ─── Colors ───────────────────────────────────────────────────────────────
  const fg = (styleConfig as { label_text_color?: string }).label_text_color ?? '#1C1917'
  const bg =
    (styleConfig as { label_bg_color?: string }).label_bg_color ??
    (styleConfig as { background_color?: string }).background_color ??
    '#F7F4EF'
  const borderStyle = (
    (styleConfig as { border_style?: BorderStyle }).border_style ?? 'none'
  ) as BorderStyle

  // ─── Text content (uppercase BEFORE escape — see esc() comment) ───────────
  const titleCase = typo.titleCase === 'uppercase'
  const trailNameRaw = (styleConfig as { trail_name?: string }).trail_name ?? 'Your Trail'
  const trailName = esc(titleCase ? trailNameRaw.toUpperCase() : trailNameRaw)

  const occasionRaw = (styleConfig as { occasion_text?: string }).occasion_text ?? ''
  const occasionText = esc(occasionRaw.toUpperCase())

  const locationRaw =
    (styleConfig as { location_text?: string }).location_text ??
    (stats as { location?: string }).location ??
    ''
  const locationLine = esc(locationRaw.toUpperCase())

  // ─── Resolve fonts (typography table → SVG font stacks) ───────────────────
  const titleFontOverride = (styleConfig as { font_family?: string }).font_family
  const bodyFontOverride =
    (styleConfig as { body_font_family?: string }).body_font_family ?? titleFontOverride
  const titleFont = titleFontOverride ? toFontStack(titleFontOverride) : typo.titleFont
  const subFont = bodyFontOverride ? toFontStack(bodyFontOverride) : typo.subFont
  const statsFont = bodyFontOverride ? toFontStack(bodyFontOverride) : typo.statsFont

  // Resolve every theme weight against the chosen family's available
  // weights. librsvg/CoreText doesn't synthesise faux-bold — it picks
  // a different family entirely if the requested weight isn't present.
  // Browsers DO synthesise, so the editor and worker would diverge
  // visually unless we clamp. After clamping, both stacks render the
  // same physical glyph file.
  const titleWeight = clampWeightToAvailable(primaryFamily(titleFont), typo.titleWeight)
  const subWeight = clampWeightToAvailable(primaryFamily(subFont), typo.subWeight)
  const statsWeight = clampWeightToAvailable(primaryFamily(statsFont), typo.statsWeight)

  // ─── Sizing in pixels (cqh → px conversion) ───────────────────────────────
  const titleSizePx = Math.round(cqhToPx(typo.titleSize * titleScale, framing))
  const subSizePx = Math.round(cqhToPx(typo.subSize * subtitleScale, framing))
  const statsNumberPx = Math.round(cqhToPx(2.6, framing)) // matches statNumberStyle
  const statsLabelPx = Math.round(cqhToPx(0.8, framing)) //  matches statUnitStyle
  const occasionPx = Math.round(cqhToPx(0.95 * occasionScale, framing))

  // ─── Geometry — band heights and positions ───────────────────────────────
  // MapPreview.vue flex column. Footer is ALWAYS order: 2 (at the bottom);
  // only the HEADER band swaps order with the map:
  //   titlePosition === 'top'    → [header][map     ][footer]
  //   titlePosition === 'bottom' → [map   ][header  ][footer]
  const headerH = headerBandHeightPx(layout, typo, styleConfig, framing)
  const footerH = footerBandHeightPx(styleConfig, framing)

  const footerY = trimBox.y + trimBox.h - footerH
  const headerY =
    layout.titlePosition === 'top'
      ? trimBox.y
      : trimBox.y + trimBox.h - footerH - headerH

  // ─── Border frame (editor parity: fixed 14px inset, opacity 0.18) ─────────
  // MapPreview.vue:903-907 frameStyle. Always drawn (1px when 'none' style),
  // opacity 0.18, stroke = label_text_color.
  const borderInset = borderInsetPx(framing, borderStyle)
  const borderStroke = borderStrokePx(borderStyle)
  const borderRect = `<rect x="${trimBox.x + borderInset}" y="${trimBox.y + borderInset}" width="${
    trimBox.w - 2 * borderInset
  }" height="${trimBox.h - 2 * borderInset}" fill="none" stroke="${fg}" stroke-opacity="0.18" stroke-width="${borderStroke}" />`

  // ─── Logo (data URI, pre-fetched) ────────────────────────────────────────
  const showLogo = !!(styleConfig as { show_logo?: boolean }).show_logo && !!input.logoDataUri
  const logoSize = (styleConfig as { logo_size?: number }).logo_size ?? 8
  const logoPx = (logoSize / 100) * trimBox.h
  const logoPosition =
    (styleConfig as { logo_position?: string }).logo_position ?? 'map-top-right'

  let logoSvg = ''
  if (showLogo && input.logoDataUri) {
    if (logoPosition === 'map-top-right') {
      const ly = trimBox.y + Math.round(trimBox.h * 0.02)
      const lx = trimBox.x + trimBox.w - logoPx - Math.round(trimBox.w * 0.02)
      logoSvg = `<image href="${input.logoDataUri}" x="${lx}" y="${ly}" width="${logoPx}" height="${logoPx}" preserveAspectRatio="xMidYMid meet" />`
    } else if (logoPosition === 'header-right') {
      const ly = headerY + Math.round(headerH * 0.5) - Math.round(logoPx * 0.5)
      const lx = trimBox.x + trimBox.w - logoPx - Math.round(trimBox.w * 0.07)
      logoSvg = `<image href="${input.logoDataUri}" x="${lx}" y="${ly}" width="${logoPx}" height="${logoPx}" preserveAspectRatio="xMidYMid meet" />`
    } else if (logoPosition === 'footer-right') {
      const ly = footerY + Math.round(footerH * 0.5) - Math.round(logoPx * 0.5)
      const lx = trimBox.x + trimBox.w - logoPx * 1.5 - Math.round(trimBox.w * 0.04)
      logoSvg = `<image href="${input.logoDataUri}" x="${lx}" y="${ly}" width="${logoPx * 1.5}" height="${logoPx}" preserveAspectRatio="xMaxYMid meet" />`
    } else if (logoPosition === 'footer-left') {
      const ly = footerY + Math.round(footerH * 0.5) - Math.round(logoPx * 0.5)
      const lx = trimBox.x + Math.round(trimBox.w * 0.07)
      logoSvg = `<image href="${input.logoDataUri}" x="${lx}" y="${ly}" width="${logoPx * 1.5}" height="${logoPx}" preserveAspectRatio="xMinYMid meet" />`
    }
  }
  void safeBox

  // ─── Header band (title + location subtitle) — editor parity ─────────────
  // MapPreview.vue:753-803. Header padding (CSS):
  //   titlePosition === 'top':    5cqh  7cqw  2.8cqh
  //   titlePosition === 'bottom': 2.4cqh 7cqw 3.5cqh
  // Header content order:
  //   when 'bottom' → rule, title, subtitle  (rule first so it draws above)
  //   when 'top'    → title, subtitle, rule
  // Header alignment:
  //   titleAlign 'left'   → text-anchor 'start', x at headerPadX
  //   titleAlign 'center' → text-anchor 'middle', x at trimBox center
  // Inter-line gap (flex `gap: 1.1cqh`) sits BETWEEN title and subtitle.
  //
  // SVG baseline math: the first-line baseline of CSS text sits at
  //   top + (lineHeight - 1)/2 × fontSize + 0.8 × fontSize
  // (half-leading + cap+ascent of typical sans-serif).
  const headerPadX = cqwToPx(7, framing)
  const titleAlign = layout.titleAlign
  const titleX = titleAlign === 'left' ? trimBox.x + headerPadX : trimBox.x + trimBox.w / 2
  const titleAnchor = titleAlign === 'left' ? 'start' : 'middle'

  const titleLineH = parseFloat(typo.titleLineHeight) || 1.0
  const titleHalfLead = ((titleLineH - 1) / 2) * titleSizePx
  const titleBaselineFromTop = 0.8 * titleSizePx + titleHalfLead

  const subLineH = 1.2 // typical sans-serif default; subtitle has no explicit line-height
  const subHalfLead = ((subLineH - 1) / 2) * subSizePx
  const subBaselineFromTop = 0.8 * subSizePx + subHalfLead

  const headerTopPad = cqhToPx(layout.titlePosition === 'top' ? 5 : 2.4, framing)
  const headerBottomPad = cqhToPx(layout.titlePosition === 'top' ? 2.8 : 3.5, framing)
  const headerGapPx = cqhToPx(1.1, framing) // flex gap between title and subtitle

  const hasSubtitle = !!locationLine

  // Title baseline position depends on whether a rule is drawn above it.
  // titlePosition 'bottom' → rule sits ABOVE the title (first child).
  const titleTopY =
    layout.titlePosition === 'top'
      ? headerY + headerTopPad
      : headerY + headerTopPad + 1 /* rule height */ + (hasSubtitle ? headerGapPx : 0)
  const titleBaselineY = titleTopY + titleBaselineFromTop

  // Subtitle below the title (always — when present).
  const subTopY = titleTopY + titleSizePx * titleLineH + headerGapPx
  const subBaselineY = subTopY + subBaselineFromTop

  const titleText = `<text x="${titleX}" y="${titleBaselineY}" text-anchor="${titleAnchor}" fill="${fg}" font-family="${titleFont}" font-size="${titleSizePx}" font-weight="${titleWeight}" letter-spacing="${typo.titleTracking}">${trailName}</text>`

  const subTextSvg = hasSubtitle
    ? `<text x="${titleX}" y="${subBaselineY}" text-anchor="${titleAnchor}" fill="${fg}" fill-opacity="0.5" font-family="${subFont}" font-size="${subSizePx}" font-weight="${subWeight}" letter-spacing="${typo.subTracking}">${locationLine}</text>`
    : ''

  // Header rule (1px hairline at fg, opacity 0.12). Width = 100% of content
  // area (which is band-width minus 2 × 7cqw of padding).
  //   titlePosition 'top'    → rule at the BOTTOM of the band  (after content)
  //   titlePosition 'bottom' → rule at the TOP of the band     (before content)
  const headerRuleY =
    layout.titlePosition === 'top'
      ? headerY + headerH - headerBottomPad - 1
      : headerY + headerTopPad
  const headerRule = `<rect x="${trimBox.x + headerPadX}" y="${headerRuleY}" width="${trimBox.w - 2 * headerPadX}" height="1" fill="${fg}" fill-opacity="0.12" />`

  // ─── Footer band — exact editor parity ────────────────────────────────────
  // MapPreview.vue:805-901. Footer is a flex row:
  //   justify-content: space-between
  //   align-items: center
  //   padding: (1.8cqh + 14px when border) 7cqw
  // Three groups:
  //   • Stats cluster  (LEFT)   — flex row of stat-blocks separated by dividers
  //   • Occasion text  (CENTER) — ABSOLUTELY positioned at left:50%
  //   • Branding cluster (RIGHT) — column: icon, RAD MAPS, radmaps.studio
  const { distanceMi: rawDistanceMi, elevGainFt: rawElevGainFt } = deriveStats(stats)
  const labels =
    (styleConfig as { labels?: { show_distance?: boolean; show_elevation_gain?: boolean; show_location?: boolean } })
      .labels ?? {}
  const showDistance = labels.show_distance !== false
  const showElev = labels.show_elevation_gain !== false
  const showLocation = labels.show_location !== false
  const distanceMi = showDistance ? rawDistanceMi : ''
  const elevGainFt = showElev ? rawElevGainFt : ''
  const coords = showLocation ? formatCoordsFromBbox(input.bbox) : null

  const footerPadX = cqwToPx(7, framing)
  const footerCenterY = footerY + footerH * 0.5

  // Stat block vertical layout (editor: stat-block is column, align-items
  // flex-start; statNumberStyle line-height = 1; statUnitStyle marginTop
  // = 0.55cqh). Block is centered in footer (footerBand align-items: center).
  const statBlockH = statsNumberPx /* lineHeight 1 */ +
    cqhToPx(0.55, framing) +
    statsLabelPx * 1.2 /* default sans-serif lh */
  const statBlockTop = footerCenterY - statBlockH / 2
  // Baselines: 0.8em from top of font for typical sans-serif faces.
  const statNumberBaselineY = statBlockTop + statsNumberPx * 0.8
  const statUnitBaselineY =
    statBlockTop + statsNumberPx + cqhToPx(0.55, framing) + statsLabelPx * 0.8

  // Inter-block flex gap (poster-stats gap: 2.4cqw on each side of dividers).
  const interBlockGap = cqwToPx(2.4, framing)
  const dividerWPx = 1
  const dividerHPx = cqhToPx(3, framing)
  const dividerTopY = footerCenterY - dividerHPx / 2

  // Approximate text width for left-to-right cursor advance. Char factor
  // 0.55 is a reasonable estimate for regular-weight sans-serif uppercase
  // and digits — it's only used to advance the X cursor, not to size text.
  const approxW = (text: string, sizePx: number, charFactor = 0.55): number =>
    text.length * charFactor * sizePx

  const statsPieces: string[] = []
  let statsCursor = trimBox.x + footerPadX
  let lastWasBlock = false

  // Distance block.
  if (distanceMi) {
    statsPieces.push(
      `<text x="${statsCursor}" y="${statNumberBaselineY}" text-anchor="start" fill="${fg}" font-family="${statsFont}" font-size="${statsNumberPx}" font-weight="${statsWeight}" letter-spacing="-0.01em">${esc(distanceMi)}</text>`,
      `<text x="${statsCursor}" y="${statUnitBaselineY}" text-anchor="start" fill="${fg}" fill-opacity="0.45" font-family="${statsFont}" font-size="${statsLabelPx}" font-weight="400" letter-spacing="0.18em">MILES</text>`,
    )
    const blockW = Math.max(approxW(distanceMi, statsNumberPx), approxW('MILES', statsLabelPx, 0.6))
    statsCursor += blockW
    lastWasBlock = true
  }

  // Divider between distance and elevation.
  if (distanceMi && elevGainFt) {
    statsCursor += interBlockGap
    statsPieces.push(
      `<rect x="${statsCursor}" y="${dividerTopY}" width="${dividerWPx}" height="${dividerHPx}" fill="${fg}" fill-opacity="0.15" />`,
    )
    statsCursor += dividerWPx + interBlockGap
    lastWasBlock = false
  }

  // Elevation block.
  if (elevGainFt) {
    if (!lastWasBlock && !distanceMi) {
      // No leading divider needed; cursor is at footerPadX
    }
    statsPieces.push(
      `<text x="${statsCursor}" y="${statNumberBaselineY}" text-anchor="start" fill="${fg}" font-family="${statsFont}" font-size="${statsNumberPx}" font-weight="${statsWeight}" letter-spacing="-0.01em">${esc(elevGainFt)}</text>`,
      `<text x="${statsCursor}" y="${statUnitBaselineY}" text-anchor="start" fill="${fg}" fill-opacity="0.45" font-family="${statsFont}" font-size="${statsLabelPx}" font-weight="400" letter-spacing="0.18em">FT GAIN</text>`,
    )
    const blockW = Math.max(approxW(elevGainFt, statsNumberPx), approxW('FT GAIN', statsLabelPx, 0.6))
    statsCursor += blockW
    lastWasBlock = true
  }

  // Coords block (lat / lng stacked, line-height 1.45).
  if (coords) {
    const coordSizePx = Math.round(cqhToPx(1.2, framing))
    if (lastWasBlock) {
      statsCursor += interBlockGap
      statsPieces.push(
        `<rect x="${statsCursor}" y="${dividerTopY}" width="${dividerWPx}" height="${dividerHPx}" fill="${fg}" fill-opacity="0.15" />`,
      )
      statsCursor += dividerWPx + interBlockGap
    }
    // Two lines stacked, line-height 1.45.
    const coordBlockH = coordSizePx + coordSizePx * 1.45 // 1st baseline at .8em, 2nd 1.45em later
    const coordBlockTop = footerCenterY - coordBlockH / 2
    const lat1Y = coordBlockTop + coordSizePx * 0.8
    const lat2Y = lat1Y + coordSizePx * 1.45
    statsPieces.push(
      `<text x="${statsCursor}" y="${lat1Y}" text-anchor="start" fill="${fg}" fill-opacity="0.65" font-family="${statsFont}" font-size="${coordSizePx}" font-weight="${statsWeight}" letter-spacing="0.04em">${esc(coords.lat)}</text>`,
      `<text x="${statsCursor}" y="${lat2Y}" text-anchor="start" fill="${fg}" fill-opacity="0.65" font-family="${statsFont}" font-size="${coordSizePx}" font-weight="${statsWeight}" letter-spacing="0.04em">${esc(coords.lng)}</text>`,
    )
  }

  const statsSvg = statsPieces.join('')

  // ─── Branding (RIGHT edge) — column: icon, RAD MAPS, radmaps.studio ─────
  // MapPreview.vue:334-344 + .poster-mark CSS at MapPreview.vue:2007-2018:
  //   display: flex; flex-direction: column; align-items: center; gap: 0.4cqh;
  //   .mark-svg { width: 4cqh; height: 4cqh; }
  //   markLabelStyle  : font-size 0.55cqh, weight 700, opacity 0.4, tracking 0.22em
  //   brandingNoteStyle: font-size 0.42cqh, weight 400, opacity 0.28, tracking 0.14em, lowercase
  let brandingSvg = ''
  const showBranding = (styleConfig as { show_branding?: boolean }).show_branding !== false
  if (showBranding) {
    const iconSizePx = cqhToPx(4, framing)
    const radMapsSizePx = Math.round(cqhToPx(0.55, framing))
    const radSubSizePx = Math.round(cqhToPx(0.42, framing))
    const brandGapPx = cqhToPx(0.4, framing)

    const radMapsLineH = radMapsSizePx * 1.2
    const radSubLineH = radSubSizePx * 1.2
    const brandingTotalH = iconSizePx + brandGapPx + radMapsLineH + brandGapPx + radSubLineH
    const brandingTopY = footerCenterY - brandingTotalH / 2

    // Cluster is right-aligned: rightEdge = trimBox.x + trimBox.w - footerPadX
    // .poster-mark items are CENTERED horizontally within the cluster.
    // Cluster's content width = max child width. The icon (4cqh) is widest
    // in nearly every realistic case; cluster width ≈ iconSizePx.
    const rightEdge = trimBox.x + trimBox.w - footerPadX
    const iconX = rightEdge - iconSizePx
    const iconY = brandingTopY
    const centerX = iconX + iconSizePx / 2

    const radMapsTopY = iconY + iconSizePx + brandGapPx
    const radMapsBaselineY = radMapsTopY + radMapsSizePx * 0.8 + (radMapsLineH - radMapsSizePx) / 2

    const radSubTopY = radMapsTopY + radMapsLineH + brandGapPx
    const radSubBaselineY = radSubTopY + radSubSizePx * 0.8 + (radSubLineH - radSubSizePx) / 2

    const mark = getBrandingMarkSvg({
      x: iconX,
      y: iconY,
      size: iconSizePx,
      color: fg,
      opacity: 0.4,
    })
    const radMapsWeight = clampWeightToAvailable(primaryFamily(statsFont), 700)
    brandingSvg =
      mark +
      `<text x="${centerX}" y="${radMapsBaselineY}" text-anchor="middle" fill="${fg}" fill-opacity="0.4" font-family="${statsFont}" font-size="${radMapsSizePx}" font-weight="${radMapsWeight}" letter-spacing="0.22em">RAD MAPS</text>` +
      `<text x="${centerX}" y="${radSubBaselineY}" text-anchor="middle" fill="${fg}" fill-opacity="0.28" font-family="${statsFont}" font-size="${radSubSizePx}" font-weight="400" letter-spacing="0.14em">radmaps.studio</text>`
  }

  // ─── Occasion (CENTER, absolute) — always centered horizontally ──────────
  // MapPreview.vue:866-881. position: absolute; left: 50%; transform: translateX(-50%).
  // Independent of stats/branding.
  const occChunk = occasionText
    ? `<text x="${trimBox.x + trimBox.w / 2}" y="${footerCenterY + occasionPx * 0.35}" text-anchor="middle" fill="${fg}" fill-opacity="0.5" font-family="${subFont}" font-size="${occasionPx}" font-weight="${subWeight}" letter-spacing="0.22em">${occasionText}</text>`
    : ''

  // ─── Footer assembly ──────────────────────────────────────────────────────
  // Editor's footer has `borderTop: 1px solid ${fg}0d` (≈ opacity 0.05).
  const footerBg = `<rect x="${trimBox.x}" y="${footerY}" width="${trimBox.w}" height="${footerH}" fill="${bg}" />`
  const footerTopRule = `<rect x="${trimBox.x}" y="${footerY}" width="${trimBox.w}" height="1" fill="${fg}" fill-opacity="0.10" />`
  const footerSvg = footerBg + footerTopRule + statsSvg + brandingSvg + occChunk

  // ─── Header band BG (drawn first so text overlays it) ────────────────────
  const headerBg = `<rect x="${trimBox.x}" y="${headerY}" width="${trimBox.w}" height="${headerH}" fill="${bg}" />`

  // ─── Pin labels + leader-line legend (drawn over the map raster) ─────────
  // The overlay layout is computed by utils/render/overlayLayout.ts (the
  // shared anti-drift module) and passed in pre-computed. We render with
  // the editor's exact SVG recipe so editor and worker SVGs match.
  let pinsSvg = ''
  let leaderLinesSvg = ''
  let pinDotsSvg = ''
  if (input.overlayLayout) {
    const haloColor = (styleConfig as { background_color?: string }).background_color ?? '#FFFFFF'
    // Editor scales these by container height; worker uses fullHeightPx.
    const svgDotR = Math.max(1.5, H * 0.00125)
    const svgDotStroke = Math.max(0.5, H * 0.0003)
    const svgLineW = Math.max(0.8, H * 0.0012)
    const svgPinFontSize = Math.max(11, H * 0.022)
    const leaderScale = (styleConfig as { leader_label_scale?: number }).leader_label_scale ?? 1.0
    const svgLeaderFontSize = Math.max(9, H * 0.014) * leaderScale

    const pinFontFamily = (styleConfig as { pin_font_family?: string }).pin_font_family
      ? toFontStack((styleConfig as { pin_font_family?: string }).pin_font_family!)
      : typo.statsFont
    const titleFamilyForLeader = (styleConfig as { font_family?: string }).font_family
      ? toFontStack((styleConfig as { font_family?: string }).font_family!)
      : typo.titleFont

    // Pins: leader line + uppercase label with halo. Editor renders each
    // pin as <line> + <text paint-order="stroke fill">. No dot in the
    // editor SVG (the dot is a separate maplibregl.Marker); we draw a
    // dot in the worker because there's no DOM marker on the print.
    // Editor's pin dot in `makePinDotEl` is sized at h * 0.015 (square
    // div); for SVG we use radius = that * 0.5 = h * 0.0075. Stroke is
    // editor's `border: max(2, size*0.18)px solid rgba(255,255,255,0.85)`.
    const pinDotRPx = Math.max(6, H * 0.0075)
    const pinDotStrokePx = Math.max(2, pinDotRPx * 0.18)
    const pinHaloStroke = Math.max(2, H * 0.0012)
    // librsvg silently drops `dominant-baseline="middle"` and treats y
    // as the baseline. Browsers honour it, vertically centring glyphs at
    // y. To match editor visuals, manually shift y down by ~0.35em so
    // the resulting baseline+ascent puts the visible glyphs centred at
    // the layout's labelY. (Half-cap-height + half-x-height for typical
    // sans-serif faces lands at ~0.35em from baseline.)
    const baselineMiddleOffset = (size: number) => size * 0.35
    const pinPieces: string[] = []
    const pinDotPieces: string[] = []
    for (const pin of input.overlayLayout.pins) {
      pinDotPieces.push(
        `<circle cx="${pin.dotX}" cy="${pin.dotY}" r="${pinDotRPx}" fill="${pin.color}" fill-opacity="${pin.opacity}" stroke="${haloColor}" stroke-opacity="0.85" stroke-width="${pinDotStrokePx}" />`,
      )
      const pinTextY = pin.labelY + baselineMiddleOffset(svgPinFontSize)
      const pinWeight = clampWeightToAvailable(primaryFamily(pinFontFamily), 600)
      pinPieces.push(
        `<line x1="${pin.dotX}" y1="${pin.dotY}" x2="${pin.labelX}" y2="${pin.labelY}" stroke="${pin.color}" stroke-width="${svgLineW}" stroke-opacity="${pin.opacity * 0.55}" />`,
        `<text x="${pin.labelX}" y="${pinTextY}" text-anchor="${pin.anchor}" font-size="${svgPinFontSize}" font-family="${pinFontFamily}" fill="${pin.color}" opacity="${pin.opacity}" stroke="${haloColor}" stroke-width="${pinHaloStroke}" paint-order="stroke fill" font-weight="${pinWeight}" letter-spacing="0.12em">${esc(pin.label.toUpperCase())}</text>`,
      )
    }
    pinDotsSvg = pinDotPieces.join('\n  ')
    pinsSvg = pinPieces.join('\n  ')

    // Leader-line legend: dot at segment start + line to label + label
    // with halo. Same baseline-middle offset trick as pins.
    const leaderPieces: string[] = []
    const haloStrokeWidth = Math.max(2, H * 0.0008)
    const leaderWeight = clampWeightToAvailable(primaryFamily(titleFamilyForLeader), 700)
    for (const leader of input.overlayLayout.leaderLines) {
      const leaderTextY = leader.labelY + baselineMiddleOffset(svgLeaderFontSize)
      // Segment names in the DB sometimes have stray \n wrappers ("\nTrail 10\n").
      // Whitespace inside <text> shifts the visible glyph position with
      // text-anchor="end" — chunks of CSS-space (including newlines)
      // count toward width measurement in some SVG renderers (librsvg
      // collapses-then-keeps a leading space). Trim before uppercasing.
      const cleanName = leader.name.replace(/[\r\n]+/g, ' ').trim()
      leaderPieces.push(
        `<circle cx="${leader.dotX}" cy="${leader.dotY}" r="${svgDotR}" fill="${leader.color}" stroke="${haloColor}" stroke-width="${svgDotStroke}" />`,
        `<line x1="${leader.dotX}" y1="${leader.dotY}" x2="${leader.labelX}" y2="${leader.labelY}" stroke="${leader.color}" stroke-width="${svgLineW}" stroke-opacity="0.6" />`,
        `<text x="${leader.labelX}" y="${leaderTextY}" text-anchor="${leader.anchor}" font-size="${svgLeaderFontSize}" font-family="${titleFamilyForLeader}" fill="${leader.color}" stroke="${haloColor}" stroke-width="${haloStrokeWidth}" paint-order="stroke fill" font-weight="${leaderWeight}" letter-spacing="0.1em">${esc(cleanName.toUpperCase())}</text>`,
      )
    }
    leaderLinesSvg = leaderPieces.join('\n  ')
  }

  // ─── Text overlays (e.g. "30 PROOF · FINISHER", "WHISKEY ROW") ───────────
  // Positioned by percent of canvas (x, y in 0-100). font_size in cqh.
  // Editor renders as draggable HTML; print render is static SVG text.
  let textOverlaysSvg = ''
  const textOverlays = (styleConfig as { text_overlays?: Array<{
    x: number; y: number; font_size: number;
    color: string; font_family?: string; alignment: string;
    opacity?: number; bold?: boolean; italic?: boolean; content: string;
  }> }).text_overlays
  if (textOverlays && textOverlays.length > 0) {
    const overlayPieces: string[] = []
    for (const ov of textOverlays) {
      const xPx = (ov.x / 100) * W
      const yPx = (ov.y / 100) * H
      const sizePx = Math.round(cqhToPx(ov.font_size, framing))
      const family = ov.font_family ? toFontStack(ov.font_family) : typo.statsFont
      const anchor =
        ov.alignment === 'left'
          ? 'start'
          : ov.alignment === 'right'
            ? 'end'
            : 'middle'
      const requestedWeight = ov.bold ? 700 : 400
      const weight = clampWeightToAvailable(primaryFamily(family), requestedWeight)
      const fontStyle = ov.italic ? 'italic' : 'normal'
      const opacity = ov.opacity ?? 1

      // Editor parity (MapPreview.vue:949-956): CSS `top: y%` positions
      // the TOP of the text box. SVG's default y attribute is the
      // baseline. We can't use `dominant-baseline="text-before-edge"`
      // — librsvg ignores it (#295) and falls back to default baseline.
      // So manually offset y by the font's ascent (~0.8em is the typical
      // cap-height + ascender for sans-serif faces) so the visible top
      // of the glyphs lands at the requested y%.
      //
      // librsvg also quirks <tspan x=…> by resetting text-anchor — so
      // emit one <text> element per line instead of stacking tspans.
      const lines = ov.content.split('\n')
      const lineSpacing = sizePx * 1.15
      const ascentOffset = sizePx * 0.8
      const commonAttrs = `text-anchor="${anchor}" fill="${ov.color}" opacity="${opacity}" font-family="${family}" font-size="${sizePx}" font-weight="${weight}" font-style="${fontStyle}"`
      for (let i = 0; i < lines.length; i++) {
        const ly = yPx + ascentOffset + i * lineSpacing
        overlayPieces.push(
          `<text x="${xPx}" y="${ly}" ${commonAttrs}>${esc(lines[i]!)}</text>`,
        )
      }
    }
    textOverlaysSvg = overlayPieces.join('\n  ')
  }

  // ─── Assemble. Order:
  //   1. pin dots + leader lines (under bands so bands cover the map fade)
  //   2. pin labels (above bands so they stay visible if the band crosses)
  //   3. bands + band-text + border + logo
  //      (branding is part of footerSvg, not separate)
  //   4. text overlays — TOP-MOST (editor renders these as z-index'd HTML
  //      overlays that float over everything; matched here)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${pinDotsSvg}
  ${leaderLinesSvg}
  ${pinsSvg}
  ${headerBg}
  ${footerSvg}
  ${headerRule}
  ${titleText}
  ${subTextSvg}
  ${borderRect}
  ${logoSvg}
  ${textOverlaysSvg}
</svg>`
}
