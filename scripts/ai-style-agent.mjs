#!/usr/bin/env node
/**
 * ai-style-agent.mjs
 *
 * Single-shot AI styling agent for RadMaps.
 * Given route context (stats, bbox, name, category), returns a fully tuned
 * StyleConfig via the Anthropic API — no human interaction needed.
 *
 * Usage:
 *   node scripts/ai-style-agent.mjs --gpx <path.gpx> [--title "Name"] [--category marathon]
 *   node scripts/ai-style-agent.mjs --test   # Run against 3 sample maps
 *
 * Can also be imported as a module:
 *   import { styleWithAI } from './ai-style-agent.mjs'
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { DOMParser } from '@xmldom/xmldom'
import { gpx as parseGpxToGeoJSON } from '@tmcw/togeojson'

// ─── Load .env ──────────────────────────────────────────────────────────────
const envPath = resolve(import.meta.dirname, '..', '.env')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env')
  process.exit(1)
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── The Style Schema (what the AI can tune) ────────────────────────────────
// We give the agent the full schema with descriptions so it understands each knob.

const STYLE_SCHEMA = {
  type: 'object',
  description: 'Complete RadMaps StyleConfig for a poster map. Every field is tunable.',
  properties: {
    // ── Preset & Base ──
    preset:           { type: 'string', enum: ['minimalist','topographic','route-only','road-network','contour-art','natural-topo','stadia-watercolor','stadia-toner','native-toner','native-watercolor','alidade-smooth','alidade-smooth-dark'], description: 'Base map style preset. minimalist = clean/sparse, topographic = contour-rich, route-only = just the route on solid background, road-network = shows streets, contour-art = artistic contour emphasis, natural-topo = terrain focus.' },
    base_tile_style:  { type: 'string', enum: ['carto-light','carto-dark','maptiler-outdoor','maptiler-topo','maptiler-winter'], description: 'Underlying raster tile style. carto-light for light themes, carto-dark for dark themes.' },

    // ── Colors ──
    color_theme:      { type: 'string', enum: ['chalk','topaz','dusk','obsidian','forest','midnight','editorial','bauhaus','vintage','brutalist','risograph','blueprint','kertok','mid-century','topo-art','dark-sky'], description: 'Named color theme — sets the overall palette mood.' },
    background_color: { type: 'string', description: 'Hex color for the poster background/border area.' },
    route_color:      { type: 'string', description: 'Hex color for the route line. Should contrast strongly with land_color.' },
    water_color:      { type: 'string', description: 'Hex color for water features (lakes, rivers, ocean).' },
    land_color:       { type: 'string', description: 'Hex color for land areas.' },
    contour_color:    { type: 'string', description: 'Hex color for minor contour lines.' },
    contour_major_color: { type: 'string', description: 'Hex color for major contour lines.' },
    label_text_color: { type: 'string', description: 'Hex color for text in the poster label band.' },
    label_bg_color:   { type: 'string', description: 'Hex color for the label band background.' },

    // ── Route Styling ──
    route_width:      { type: 'number', description: 'Route line width in px. 1-2 for dense networks, 3-4 for single routes, 5-6 for bold emphasis.' },
    route_opacity:    { type: 'number', description: 'Route opacity 0-1. Lower values let overlapping routes blend.' },
    route_smooth:     { type: 'number', description: 'Route smoothing 0-5. Higher = smoother curves.' },

    // ── Contours & Terrain ──
    show_contours:    { type: 'boolean', description: 'Show contour lines. Turn off for flat areas or dense urban maps.' },
    contour_opacity:  { type: 'number', description: 'Contour line opacity 0-1.' },
    contour_detail:   { type: 'number', description: 'Contour detail level 0-5. Higher = finer/denser contours.' },
    show_hillshade:   { type: 'boolean', description: 'Show terrain hillshading. Great for mountainous routes.' },
    hillshade_intensity: { type: 'number', description: 'Hillshade strength 0-1.' },
    show_elevation_labels: { type: 'boolean', description: 'Show elevation numbers on contour lines.' },

    // ── Roads & Labels ──
    show_roads:       { type: 'boolean', description: 'Show road network overlay. Good for urban context, distracting for wilderness.' },
    roads_opacity:    { type: 'number', description: 'Road overlay opacity 0-1.' },
    show_place_labels: { type: 'boolean', description: 'Show city/town place labels on the map.' },

    // ── Typography ──
    font_family:      { type: 'string', enum: ['Big Shoulders Display','Fjalla One','Oswald','Bebas Neue','DM Sans','Space Grotesk','Outfit','Work Sans','Playfair Display','Cormorant Garamond','Libre Baskerville','DM Serif Display'], description: 'Title font. Editorial = Playfair Display, modern = DM Sans/Space Grotesk, bold = Big Shoulders/Bebas Neue, classic = DM Serif Display.' },
    body_font_family: { type: 'string', enum: ['Big Shoulders Display','Fjalla One','Oswald','Bebas Neue','DM Sans','Space Grotesk','Outfit','Work Sans','Playfair Display','Cormorant Garamond','Libre Baskerville','DM Serif Display'], description: 'Body/stats font. Usually a clean sans-serif like DM Sans or Work Sans.' },

    // ── Layout & Chrome ──
    label_position:   { type: 'string', enum: ['bottom','top','overlay'], description: 'Where the text label band goes.' },
    border_style:     { type: 'string', enum: ['thin','thick','none'], description: 'Poster border style.' },
    padding_factor:   { type: 'number', description: 'Map padding 0.05-0.3. Lower = tighter crop. 0.08-0.12 for city networks, 0.15-0.2 for linear trails.' },
    print_size:       { type: 'string', enum: ['8x12','12x18','16x24','20x30','24x36','32x48'], description: 'Print size (portrait orientation).' },

    // ── Poster Text ──
    trail_name:       { type: 'string', description: 'Override title text on the poster. Leave empty to use map title.' },
    occasion_text:    { type: 'string', description: 'Optional subtitle line, e.g. year, event edition, personal text.' },
    location_text:    { type: 'string', description: 'Location line, e.g. "Chicago, Illinois" or "Swiss Alps".' },

    // ── Labels/Stats Display ──
    labels: {
      type: 'object',
      properties: {
        show_title:          { type: 'boolean' },
        show_distance:       { type: 'boolean' },
        show_elevation_gain: { type: 'boolean', description: 'Show elevation gain stat. Turn on for hilly routes, off for flat.' },
        show_date:           { type: 'boolean' },
        show_location:       { type: 'boolean' },
      }
    },

    // ── Pins ──
    show_start_pin:   { type: 'boolean', description: 'Show start marker. Good for point-to-point routes.' },
    show_finish_pin:  { type: 'boolean', description: 'Show finish marker.' },
    start_pin_label:  { type: 'string', description: 'Label for start pin, e.g. "Start", "Hopkinton".' },
    finish_pin_label: { type: 'string', description: 'Label for finish pin, e.g. "Finish", "Boylston St".' },

    // ── Elevation Profile ──
    show_elevation_profile: { type: 'boolean', description: 'Show elevation profile chart at bottom of map. Great for hilly routes with interesting profiles.' },
    elevation_profile_height: { type: 'number', description: 'Profile chart height as % of map area (8-40). Default 22.' },

    // ── Tile Effects (post-processing) ──
    tile_effect:      { type: 'string', enum: ['none','duotone','posterize','layer-color'], description: 'Post-processing effect on base tiles. duotone = two-tone wash, posterize = reduced colors, layer-color = tint shadow/mid/highlight independently.' },
    tile_grain:       { type: 'number', description: 'Film grain overlay 0-1. Subtle grain (0.05-0.15) adds texture.' },
    tile_contrast:    { type: 'number', description: 'Tile contrast adjustment -1 to 1.' },
    tile_saturation:  { type: 'number', description: 'Tile saturation adjustment -1 to 1. Negative = more muted.' },

    // ── Vignette ──
    show_vignette:    { type: 'boolean', description: 'Dark vignette around edges. Adds drama and focus.' },
    vignette_intensity: { type: 'number', description: 'Vignette strength 0-1.' },
  },
  required: ['preset', 'color_theme', 'route_color', 'route_width', 'font_family'],
}
void STYLE_SCHEMA

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert map poster designer for RadMaps, a service that creates beautiful printed trail and route maps. You make single-shot styling decisions — no conversation, just output.

Given a route's geographic context, you return a complete StyleConfig that produces a visually stunning, print-ready poster. Think like a graphic designer who understands cartography, typography, and color theory.

## Design Principles

1. **Route visibility is paramount.** The route must be the hero. Ensure strong contrast between route_color and land_color. For dense networks (many overlapping paths), use thinner lines (1.5-2.5) with slightly reduced opacity so overlaps create natural density heat.

2. **Match style to geography.** Mountainous terrain → show contours, hillshade, elevation profile. Flat urban areas → hide contours, show roads for grid context, use the city structure as visual interest. Coastal routes → emphasize water color contrast. Wilderness → natural palette, less chrome.

3. **Typography communicates personality.** A marathon poster wants bold, athletic type (Big Shoulders, Bebas Neue). A national park map wants refined serifs (Playfair Display, DM Serif). A city bike network wants modern/clean (Space Grotesk, Outfit). Always pair a display title font with a readable body font.

4. **Restraint over maximalism.** Don't turn everything on. A great poster might have contours OFF and roads ON, or hillshade ON but contours OFF. Each element should earn its place.

5. **Color harmony matters.** All colors should work as a cohesive palette. The label_bg_color and background_color usually match. The label_text_color must be legible against label_bg_color. Water should feel natural relative to land.

6. **Use tile effects deliberately.** A subtle grain (0.05-0.12) adds print texture. Duotone can unify a busy basemap. Posterize creates retro/artistic looks. Don't use effects just because they exist.

7. **Padding and framing.** Dense city networks need tighter padding (0.06-0.10) — the whole bbox IS the subject. Long linear trails need more padding (0.15-0.25) so they aren't edge-to-edge.

8. **Consider the poster text.** Set occasion_text to the year for dated events, or leave empty for timeless routes. location_text should be the human-readable place name. trail_name can override the title if the default is too long.

9. **Elevation profile is a feature, not a default.** Turn it on for routes where elevation IS the story (mountain marathons, canyon runs, big climbs). Turn it off for flat routes or where it would just be a boring flat line.

10. **Start/finish pins for point-to-point routes.** Marathons and long-distance trails with distinct start/finish locations benefit from labeled pins. Loop routes and city networks don't.

## STRICT Value Constraints (you MUST use these exact strings)

preset MUST be one of: "minimalist", "topographic", "route-only", "road-network", "contour-art", "natural-topo"
color_theme MUST be one of: "chalk", "topaz", "dusk", "obsidian", "forest", "midnight", "editorial", "bauhaus", "vintage", "brutalist", "risograph", "blueprint", "kertok", "mid-century", "topo-art", "dark-sky"
base_tile_style MUST be one of: "carto-light", "carto-dark"
font_family MUST be one of: "Big Shoulders Display", "Fjalla One", "Oswald", "Bebas Neue", "DM Sans", "Space Grotesk", "Outfit", "Work Sans", "Playfair Display", "Cormorant Garamond", "Libre Baskerville", "DM Serif Display"
body_font_family: same enum as font_family
border_style MUST be one of: "thin", "thick", "none"
label_position MUST be one of: "bottom", "top", "overlay"
print_size MUST be one of: "8x12", "12x18", "16x24", "20x30", "24x36", "32x48"
tile_effect MUST be one of: "none", "duotone", "posterize", "layer-color"

Numeric ranges:
- route_width: 1-6 (float)
- route_opacity: 0-1
- padding_factor: 0.05-0.30
- contour_detail: 0-5 (integer)
- contour_opacity: 0-1
- hillshade_intensity: 0-1
- roads_opacity: 0-1
- tile_grain: 0-1
- tile_contrast: -1 to 1
- tile_saturation: -1 to 1
- vignette_intensity: 0-1
- elevation_profile_height: 8-40

labels MUST be an object with boolean fields: { "show_title": true, "show_distance": true, "show_elevation_gain": true/false, "show_date": true/false, "show_location": true }

## Output Rules
- Return ONLY a raw JSON array of 3 objects. No markdown code fences. No explanation.
- Use EXACTLY the property names and enum values listed above.
- All color values must be hex strings (e.g. "#FF0000").
- Produce 3 DISTINCT creative directions. Each should have a different visual identity — different preset, different color_theme, different typography, different structural choices.`

// ─── Core Function ──────────────────────────────────────────────────────────

/**
 * Generate 3 AI-designed StyleConfig variants for a given route.
 *
 * @param {object} context
 * @param {string} context.title - Map title (e.g. "Boston Marathon 2026")
 * @param {string} context.category - Route category (marathon, adventure, national-park, etc.)
 * @param {object} context.stats - RouteStats (distance_km, elevation_gain_m, location, etc.)
 * @param {number[]} context.bbox - [minLng, minLat, maxLng, maxLat]
 * @param {number} context.featureCount - Number of GeoJSON features (1 = single route, 2659 = network)
 * @param {number} context.coordCount - Total coordinate points
 * @param {string} [context.description] - Optional description for extra context
 * @returns {Promise<object[]>} Array of 3 StyleConfig objects
 */
export async function styleWithAI(context) {
  const bboxWidth = context.bbox[2] - context.bbox[0]
  const bboxHeight = context.bbox[3] - context.bbox[1]
  const aspect = bboxWidth / bboxHeight
  const isNetwork = context.featureCount > 10
  const isFlat = (context.stats.elevation_gain_m || 0) < 100
  const isUrban = isNetwork || (context.stats.location || '').match(/city|metro|urban/i)
  const hasSignificantElevation = (context.stats.elevation_gain_m || 0) > 200

  const userPrompt = `Design 3 poster styles for this route:

TITLE: ${context.title}
CATEGORY: ${context.category}
LOCATION: ${context.stats.location || 'Unknown'}
${context.description ? `DESCRIPTION: ${context.description}` : ''}

ROUTE CHARACTERISTICS:
- Distance: ${context.stats.distance_km} km
- Elevation gain: ${context.stats.elevation_gain_m || 0}m
- Elevation loss: ${context.stats.elevation_loss_m || 0}m
- Max elevation: ${context.stats.max_elevation_m || 0}m
- Min elevation: ${context.stats.min_elevation_m || 0}m
- ${isFlat ? 'FLAT terrain' : hasSignificantElevation ? 'SIGNIFICANT elevation changes' : 'Moderate terrain'}

GEOMETRY:
- Features: ${context.featureCount} ${isNetwork ? '(DENSE NETWORK — many overlapping paths)' : '(single route)'}
- Coordinate points: ${context.coordCount}
- Bounding box: [${context.bbox.map(n => n.toFixed(3)).join(', ')}]
- Bbox aspect ratio: ${aspect.toFixed(2)} (${aspect > 1.3 ? 'wide/landscape' : aspect < 0.7 ? 'tall/portrait' : 'roughly square'})
- ${isUrban ? 'URBAN setting — road grid provides structure' : 'NON-URBAN — natural landscape'}

Return a JSON array of 3 StyleConfig objects. Each should have a fundamentally different visual approach.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  // Parse the JSON array from the response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error(`AI did not return valid JSON array. Response: ${text.slice(0, 200)}`)
  }

  const styles = JSON.parse(jsonMatch[0])
  if (!Array.isArray(styles) || styles.length === 0) {
    throw new Error('AI returned empty or non-array result')
  }

  // Sanitize and validate each variant
  return styles.map(s => sanitizeStyleConfig(s))
}

// ─── Sanitization / Validation ──────────────────────────────────────────────

const VALID_PRESETS = ['minimalist','topographic','route-only','road-network','contour-art','natural-topo','stadia-watercolor','stadia-toner','native-toner','native-watercolor','alidade-smooth','alidade-smooth-dark']
const VALID_THEMES = ['chalk','topaz','dusk','obsidian','forest','midnight','editorial','bauhaus','vintage','brutalist','risograph','blueprint','kertok','mid-century','topo-art','dark-sky']
const VALID_TILES = ['carto-light','carto-dark','maptiler-outdoor','maptiler-topo','maptiler-winter']
const VALID_FONTS = ['Big Shoulders Display','Fjalla One','Oswald','Bebas Neue','DM Sans','Space Grotesk','Outfit','Work Sans','Playfair Display','Cormorant Garamond','Libre Baskerville','DM Serif Display']
const VALID_BORDERS = ['thin','thick','none']
const VALID_LABEL_POS = ['bottom','top','overlay']
const VALID_SIZES = ['8x12','12x18','16x24','20x30','24x36','32x48']
const VALID_EFFECTS = ['none','duotone','posterize','layer-color']

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)) }

function sanitizeStyleConfig(s) {
  const out = { ...s }

  // Enum fields — fix or fall back to default
  if (!VALID_PRESETS.includes(out.preset)) out.preset = 'minimalist'
  if (!VALID_THEMES.includes(out.color_theme)) out.color_theme = 'chalk'
  if (!VALID_TILES.includes(out.base_tile_style)) {
    // Infer from theme darkness
    const darkThemes = ['dusk','obsidian','midnight','blueprint','dark-sky']
    out.base_tile_style = darkThemes.includes(out.color_theme) ? 'carto-dark' : 'carto-light'
  }
  if (!VALID_FONTS.includes(out.font_family)) out.font_family = 'Big Shoulders Display'
  if (!VALID_FONTS.includes(out.body_font_family)) out.body_font_family = 'DM Sans'
  if (!VALID_BORDERS.includes(out.border_style)) out.border_style = 'thin'
  if (!VALID_LABEL_POS.includes(out.label_position)) out.label_position = 'bottom'
  if (!VALID_SIZES.includes(out.print_size)) out.print_size = '24x36'
  if (!VALID_EFFECTS.includes(out.tile_effect)) out.tile_effect = 'none'

  // Numeric clamping
  if (typeof out.route_width === 'number') out.route_width = clamp(out.route_width, 1, 6)
  if (typeof out.route_opacity === 'number') out.route_opacity = clamp(out.route_opacity, 0, 1)
  if (typeof out.padding_factor === 'number') out.padding_factor = clamp(out.padding_factor, 0.05, 0.30)
  if (typeof out.contour_detail === 'number') out.contour_detail = clamp(Math.round(out.contour_detail), 0, 5)
  if (typeof out.contour_opacity === 'number') out.contour_opacity = clamp(out.contour_opacity, 0, 1)
  if (typeof out.hillshade_intensity === 'number') out.hillshade_intensity = clamp(out.hillshade_intensity, 0, 1)
  if (typeof out.roads_opacity === 'number') out.roads_opacity = clamp(out.roads_opacity, 0, 1)
  if (typeof out.tile_grain === 'number') out.tile_grain = clamp(out.tile_grain, 0, 1)
  if (typeof out.tile_contrast === 'number') out.tile_contrast = clamp(out.tile_contrast, -1, 1)
  if (typeof out.tile_saturation === 'number') out.tile_saturation = clamp(out.tile_saturation, -1, 1)
  if (typeof out.vignette_intensity === 'number') out.vignette_intensity = clamp(out.vignette_intensity, 0, 1)
  if (typeof out.elevation_profile_height === 'number') out.elevation_profile_height = clamp(out.elevation_profile_height, 8, 40)

  // Labels must be an object with boolean fields
  if (!out.labels || typeof out.labels !== 'object' || Array.isArray(out.labels)) {
    out.labels = { show_title: true, show_distance: true, show_elevation_gain: false, show_date: false, show_location: true }
  }

  // CARTO raster tiles bake in their own place names — adding MapLibre vector
  // place labels on top creates ugly double labels. Always disable them for CARTO.
  const cartoTiles = ['carto-light', 'carto-dark']
  if (cartoTiles.includes(out.base_tile_style)) {
    out.show_place_labels = false
    out.show_poi_labels = false
  }

  return out
}

// ─── GPX Parser (reused from bulk script) ───────────────────────────────────

function parseGpxFile(gpxText) {
  const parser = new DOMParser({
    onError: (level, msg) => { if (level !== 'warning') throw new Error(msg) },
  })
  const dom = parser.parseFromString(gpxText, 'text/xml')
  const geojson = parseGpxToGeoJSON(dom)

  const coords = []
  for (const f of geojson.features) {
    if (f.geometry.type === 'LineString') coords.push(...f.geometry.coordinates)
    else if (f.geometry.type === 'MultiLineString') f.geometry.coordinates.forEach(l => coords.push(...l))
  }
  if (!coords.length) throw new Error('No coordinates')

  let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity
  for (const [lng,lat] of coords) {
    if(lng<minLng)minLng=lng;if(lat<minLat)minLat=lat;if(lng>maxLng)maxLng=lng;if(lat>maxLat)maxLat=lat
  }

  let distKm=0
  for (let i=1;i<coords.length;i++){
    const R=6371,[ln1,la1]=coords[i-1],[ln2,la2]=coords[i]
    const dLa=(la2-la1)*Math.PI/180,dLn=(ln2-ln1)*Math.PI/180
    const a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLn/2)**2
    distKm+=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  }

  const elevations = coords.map(c=>c[2]??0).filter(e=>e!==0)
  let elevGain=0,elevLoss=0
  for(let i=1;i<elevations.length;i++){const d=elevations[i]-elevations[i-1];if(d>0)elevGain+=d;else elevLoss+=Math.abs(d)}

  return {
    geojson,
    bbox: [minLng,minLat,maxLng,maxLat],
    stats: {
      distance_km: Math.round(distKm*100)/100,
      elevation_gain_m: Math.round(elevGain),
      elevation_loss_m: Math.round(elevLoss),
      max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
      min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
    },
    featureCount: geojson.features.length,
    coordCount: coords.length,
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function runTest() {
  const testCases = [
    {
      gpx: resolve(import.meta.dirname, '..', '..', 'chicago_bike_gpx', 'chicago_complete_bike_network.gpx'),
      title: 'Chicago Bike Network',
      category: 'adventure',
      description: 'Every cycleway, bike lane, and trail across the Windy City — 2,659 path segments forming a dense urban network.',
    },
    {
      gpx: resolve(import.meta.dirname, '..', '..', 'marathon_gpx_files', 'boston_marathon_2026.gpx'),
      title: 'Boston Marathon 2026',
      category: 'marathon',
      description: 'Hopkinton to Boylston Street — the world\'s oldest annual marathon, 26.2 miles through Boston.',
    },
    {
      gpx: resolve(import.meta.dirname, '..', '..', 'marathon_gpx_files', 'tokyo_marathon_2025.gpx'),
      title: 'Tokyo Marathon 2025',
      category: 'marathon',
      description: 'From Shinjuku to Tokyo Station — a World Major through the Japanese capital.',
    },
  ]

  for (const tc of testCases) {
    console.log(`\n${'━'.repeat(60)}`)
    console.log(`🎨 ${tc.title}`)
    console.log(`${'━'.repeat(60)}`)

    const parsed = parseGpxFile(readFileSync(tc.gpx, 'utf8'))
    parsed.stats.location = tc.description?.match(/through (.+?)[.—]/)?.[1] || tc.title

    console.log(`   ${parsed.stats.distance_km} km | ${parsed.stats.elevation_gain_m}m gain | ${parsed.featureCount} features | ${parsed.coordCount} pts`)
    console.log(`   Calling Claude...`)

    const start = Date.now()
    const styles = await styleWithAI({
      title: tc.title,
      category: tc.category,
      stats: parsed.stats,
      bbox: parsed.bbox,
      featureCount: parsed.featureCount,
      coordCount: parsed.coordCount,
      description: tc.description,
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    console.log(`   Got ${styles.length} variants in ${elapsed}s\n`)

    for (let i = 0; i < styles.length; i++) {
      const s = styles[i]
      console.log(`   Variant ${i + 1}: ${s.color_theme || '?'}/${s.preset || '?'}`)
      console.log(`     Route: ${s.route_color} w=${s.route_width} | Font: ${s.font_family}`)
      console.log(`     BG: ${s.background_color} | Land: ${s.land_color} | Water: ${s.water_color}`)
      console.log(`     Contours: ${s.show_contours ?? '?'} | Roads: ${s.show_roads ?? '?'} | Hillshade: ${s.show_hillshade ?? '?'}`)
      console.log(`     Effect: ${s.tile_effect || 'none'} | Grain: ${s.tile_grain ?? 0} | Vignette: ${s.show_vignette ?? false}`)
      console.log(`     Elev profile: ${s.show_elevation_profile ?? false} | Pins: ${s.show_start_pin ?? false}/${s.show_finish_pin ?? false}`)
      console.log(`     Padding: ${s.padding_factor ?? '?'} | Border: ${s.border_style ?? '?'}`)
      if (s.occasion_text) console.log(`     Text: "${s.occasion_text}" | "${s.location_text || ''}"`)
      console.log()
    }
  }
}

// Entry point
const args = process.argv.slice(2)
if (args.includes('--test')) {
  runTest().catch(err => { console.error('Error:', err.message); process.exit(1) })
} else if (args.includes('--gpx')) {
  const gpxPath = resolve(args[args.indexOf('--gpx') + 1])
  const title = args.includes('--title') ? args[args.indexOf('--title') + 1] : 'Trail Map'
  const category = args.includes('--category') ? args[args.indexOf('--category') + 1] : 'adventure'

  const parsed = parseGpxFile(readFileSync(gpxPath, 'utf8'))
  styleWithAI({ title, category, stats: parsed.stats, bbox: parsed.bbox, featureCount: parsed.featureCount, coordCount: parsed.coordCount })
    .then(styles => console.log(JSON.stringify(styles, null, 2)))
    .catch(err => { console.error('Error:', err.message); process.exit(1) })
} else {
  console.log('Usage:')
  console.log('  node scripts/ai-style-agent.mjs --test')
  console.log('  node scripts/ai-style-agent.mjs --gpx <path> [--title "Name"] [--category marathon]')
}
