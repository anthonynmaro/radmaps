import { buildMapStyle } from '../../utils/mapStyle.js'
import { applyPrintScaleToStyle, getPrintScale } from '../../utils/render/printScale.js'

const cfg: any = {
  preset: 'minimalist',
  route_width: 4.5,
  route_color: '#E8533C',
  route_opacity: 1,
  background_color: '#0F1B2D',
  label_text_color: '#E8EDF5',
  label_bg_color: '#0F1B2D',
  map_zoom: 12.8,
  map_center: [-87.7, 40.16],
  map_editor_width: 583,
  color_theme: 'midnight',
  font_family: 'Bebas Neue',
  body_font_family: 'DM Sans',
  show_contours: true,
  show_roads: true,
}
let s: any = buildMapStyle(cfg, 'TOK', 'TOK', undefined, 'TOK')
console.log('=== ALL layers ===')
for (const l of s.layers) console.log(' ', l.id, l.type)
console.log('\n=== route + trail-seg + contour BEFORE scale ===')
for (const l of s.layers) {
  if (l.id && (l.id.startsWith('route') || l.id.startsWith('trail-seg') || l.id.startsWith('contour'))) {
    console.log(' ', l.id, JSON.stringify({ paint: l.paint, layout: l.layout }))
  }
}
s = applyPrintScaleToStyle(s, getPrintScale({ dpi: 300 }))
console.log('\n=== AFTER scale (300 DPI) ===')
for (const l of s.layers) {
  if (l.id && (l.id.startsWith('route') || l.id.startsWith('trail-seg') || l.id.startsWith('contour'))) {
    console.log(' ', l.id, JSON.stringify({ paint: l.paint, layout: l.layout }))
  }
}
