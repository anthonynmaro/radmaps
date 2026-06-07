#!/usr/bin/env node
/**
 * bulk-marathon-premade.mjs
 *
 * Bulk-creates RadMaps premade marathon posters from downloaded GPX files.
 *
 * Pipeline per GPX file:
 *   1. Parse GPX → GeoJSON + bbox + RouteStats
 *   2. For each "poster recipe" (theme + preset combo):
 *      a. Insert a `maps` row with the themed StyleConfig
 *      b. Insert a `premade_maps` row with marathon metadata
 *   3. Optionally generate low-res realistic thumbnails (if --generate-previews flag)
 *   4. Optionally publish (if --publish flag)
 *
 * Usage:
 *   node scripts/bulk-marathon-premade.mjs [--dry-run] [--publish] [--generate-previews] [--file <name.gpx>]
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_KEY in .env
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { gpx } from '@tmcw/togeojson'
import { DOMParser } from '@xmldom/xmldom'

// ─── Load .env manually (no dotenv dep needed) ─────────────────────────────
const envPath = resolve(import.meta.dirname, '..', '.env')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const SUPABASE_URL = env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const AUTO_PUBLISH = args.includes('--publish')
const GENERATE_PREVIEWS = args.includes('--generate-previews')
const fileFilter = args.includes('--file') ? args[args.indexOf('--file') + 1] : null

// ─── GPX Parsing (mirrors utils/gpx.ts parseGpxServer) ─────────────────────

function parseGpxFile(gpxText) {
  if (new TextEncoder().encode(gpxText).byteLength > 5 * 1024 * 1024) {
    throw new Error('GPX file too large (max 5 MB)')
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(gpxText)) {
    throw new Error('GPX with DOCTYPE/ENTITY not supported')
  }

  let parseError = null
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') parseError = message
    },
  })
  const dom = parser.parseFromString(gpxText, 'text/xml')
  if (parseError) throw new Error(`Malformed GPX: ${parseError}`)

  const geojson = gpx(dom)
  const coords = []

  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      coords.push(...feature.geometry.coordinates)
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        coords.push(...line)
      }
    }
  }

  if (coords.length === 0) throw new Error('No track coordinates found')

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  let distanceKm = 0
  for (let i = 1; i < coords.length; i++) {
    distanceKm += haversineKm(coords[i - 1], coords[i])
  }

  const elevations = coords.map(c => c[2] ?? 0).filter(e => e !== 0)
  let elevationGain = 0, elevationLoss = 0
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff > 0) elevationGain += diff
    else elevationLoss += Math.abs(diff)
  }

  return {
    geojson,
    bbox: [minLng, minLat, maxLng, maxLat],
    stats: {
      distance_km: Math.round(distanceKm * 100) / 100,
      elevation_gain_m: Math.round(elevationGain),
      elevation_loss_m: Math.round(elevationLoss),
      max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
      min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
    },
    trackName: geojson.features[0]?.properties?.name?.trim() || undefined,
  }
}

function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── DEFAULT_STYLE_CONFIG (mirrors types/index.ts) ──────────────────────────

const DEFAULT_STYLE_CONFIG = {
  preset: 'minimalist',
  background_color: '#F4EFE6',
  route_color: '#C1121F',
  route_width: 3,
  route_opacity: 0.9,
  route_smooth: 0,
  route_crop_start: 0,
  route_crop_end: 100,
  show_contours: true,
  contour_color: '#C8BDB0',
  contour_major_color: '#9E9082',
  contour_opacity: 0.75,
  contour_detail: 3,
  contour_minor_width: 1.0,
  contour_major_width: 1.0,
  show_elevation_labels: false,
  show_hillshade: false,
  hillshade_intensity: 0.5,
  hillshade_highlight: 0.3,
  water_color: '#B8D8E8',
  land_color: '#EDE8DF',
  font_family: 'Big Shoulders Display',
  body_font_family: 'DM Sans',
  title_size: 48,
  subtitle_size: 24,
  labels: {
    show_title: true,
    show_distance: true,
    show_elevation_gain: true,
    show_date: false,
    show_location: true,
  },
  label_position: 'bottom',
  border_style: 'thin',
  padding_factor: 0.15,
  color_theme: 'chalk',
  print_size: '24x36',
  base_tile_style: 'carto-light',
  trail_name: '',
  occasion_text: '',
  location_text: '',
  label_text_color: '#1C1917',
  label_bg_color: '#F4EFE6',
  show_branding: true,
  show_roads: true,
  show_place_labels: false,   // CARTO raster tiles already include place names
  show_poi_labels: false,
  tile_effect: 'none',
  tile_duotone_strength: 0.9,
  tile_posterize_levels: 4,
  tile_grain: 0,
  tile_contrast: 0,
  tile_saturation: 0,
  tile_hue_rotate: 0,
  show_vignette: false,
  vignette_intensity: 0.45,
  segment_casing_width: 3,
  segment_casing_color: '#FFFFFF',
  segment_dot_size: 1.5,
  leader_label_auto_fit: true,
  map_frozen: false,
  show_start_pin: true,
  show_finish_pin: true,
  show_logo: false,
  logo_position: 'map-top-right',
  logo_size: 8,
  text_overlays: [],
  trail_segments: [],
  trail_legend: { show: true, position: 'bottom-left' },
}

// ─── Theme Definitions (mirrors types/index.ts COLOR_THEMES) ────────────────

const THEMES = {
  chalk:        { dark: false, background_color: '#F4EFE6', label_bg_color: '#F4EFE6', label_text_color: '#1C1917', route_color: '#C1121F', water_color: '#B8D8E8', land_color: '#EBE6DC', base_tile_style: 'carto-light', contour_color: '#C8BDB0', contour_major_color: '#9E9082' },
  obsidian:     { dark: true,  background_color: '#161616', label_bg_color: '#161616', label_text_color: '#FAFAFA', route_color: '#FB923C', water_color: '#1A3A4A', land_color: '#1E1E1E', base_tile_style: 'carto-dark',  contour_color: '#8A8A8A', contour_major_color: '#BABABA' },
  editorial:    { dark: false, background_color: '#F8F6F2', label_bg_color: '#F8F6F2', label_text_color: '#1A1A1A', route_color: '#C1121F', water_color: '#C4D8E4', land_color: '#EEE8E0', base_tile_style: 'carto-light', contour_color: '#C8C0B0', contour_major_color: '#A09888', font_family: 'Playfair Display', border_style: 'none', tile_grain: 0 },
  vintage:      { dark: false, background_color: '#E8D5A0', label_bg_color: '#E8D5A0', label_text_color: '#2A1A0A', route_color: '#B5451B', water_color: '#8EB0BA', land_color: '#EDE0B8', base_tile_style: 'carto-light', contour_color: '#C0A070', contour_major_color: '#907040', font_family: 'DM Serif Display', border_style: 'none', tile_grain: 0.28 },
  'dark-sky':   { dark: true,  background_color: '#161616', label_bg_color: '#161616', label_text_color: '#F0F0F0', route_color: '#FF4444', water_color: '#0A1820', land_color: '#202020', base_tile_style: 'carto-dark',  contour_color: '#404040', contour_major_color: '#686868', font_family: 'Fjalla One', border_style: 'none', tile_grain: 0.14 },
  midnight:     { dark: true,  background_color: '#0F1B2D', label_bg_color: '#0F1B2D', label_text_color: '#E8EDF5', route_color: '#60A5FA', water_color: '#0A1F35', land_color: '#111A25', base_tile_style: 'carto-dark',  contour_color: '#4A80A8', contour_major_color: '#72B0D8' },
  bauhaus:      { dark: false, background_color: '#FFFFFF', label_bg_color: '#FFFFFF', label_text_color: '#111111', route_color: '#E52727', water_color: '#C8D8E8', land_color: '#F5F5F5', base_tile_style: 'carto-light', contour_color: '#D0D0D0', contour_major_color: '#A0A0A0', font_family: 'Big Shoulders Display', border_style: 'thick', tile_grain: 0 },
  'editorial-minimal': { audience: 'Gallery / collector', composition: 'editorial-tall', dark: false, background_color: '#F6F2EA', label_bg_color: '#F6F2EA', label_text_color: '#171513', route_color: '#B5251D', water_color: '#D6DCE0', land_color: '#EFE9DD', base_tile_style: 'carto-light', contour_color: '#CFC6B6', contour_major_color: '#A89C86', font_family: 'Playfair Display', body_font_family: 'Libre Baskerville', border_style: 'none', tile_grain: 0, map_defaults: { preset: 'contour-art', show_roads: false, show_place_labels: false, show_contours: true, show_hillshade: false, tile_effect: 'none', show_grid: false } },
  'usgs-vintage': { audience: 'National Park / tourist', composition: 'park-quad', dark: false, background_color: '#EDE3CC', label_bg_color: '#EDE3CC', label_text_color: '#3A2A14', route_color: '#B43A1F', water_color: '#9CB7C0', land_color: '#E8DCBE', base_tile_style: 'maptiler-topo', contour_color: '#9C7A48', contour_major_color: '#6B4D26', font_family: 'DM Serif Display', body_font_family: 'Libre Baskerville', border_style: 'thin', tile_grain: 0.32, map_defaults: { preset: 'natural-topo', show_roads: false, show_place_labels: true, show_contours: true, show_hillshade: false, tile_effect: 'none', show_grid: false } },
  blueprint:    { audience: 'Engineer / surveyor', composition: 'blueprint-grid', dark: true, background_color: '#0F2D52', label_bg_color: '#0F2D52', label_text_color: '#D0E4FF', route_color: '#FFD046', water_color: '#091F3A', land_color: '#143664', base_tile_style: 'carto-dark', contour_color: '#3D7AC2', contour_major_color: '#7CB0E8', font_family: 'Space Grotesk', body_font_family: 'Space Grotesk', border_style: 'thin', tile_grain: 0.04, show_grid: true, map_defaults: { preset: 'route-only', show_roads: false, show_place_labels: false, show_contours: true, show_hillshade: false, tile_effect: 'none', show_grid: true } },
  'splits-stats': { audience: 'Runner / cyclist', composition: 'splits-grid', dark: true, background_color: '#0E0E10', label_bg_color: '#0E0E10', label_text_color: '#F4F2EE', route_color: '#FC4C02', water_color: '#101820', land_color: '#161618', base_tile_style: 'carto-dark', contour_color: '#2A2A2E', contour_major_color: '#56565E', font_family: 'Space Grotesk', body_font_family: 'Space Grotesk', border_style: 'none', tile_grain: 0.08, map_defaults: { preset: 'road-network', show_roads: true, show_place_labels: false, show_contours: false, show_hillshade: false, tile_effect: 'none', show_grid: false } },
  'marathon-bib': { audience: 'Marathon / event', composition: 'bib-numerals', dark: false, background_color: '#FAFAF7', label_bg_color: '#FAFAF7', label_text_color: '#0A0A0A', route_color: '#1A4D8F', water_color: '#D8E2EC', land_color: '#F0EDE7', base_tile_style: 'carto-light', contour_color: '#D6CFC2', contour_major_color: '#A39A88', font_family: 'Bebas Neue', body_font_family: 'DM Sans', border_style: 'thick', tile_grain: 0, map_defaults: { preset: 'road-network', show_roads: true, show_place_labels: false, show_contours: false, show_hillshade: false, tile_effect: 'none', show_grid: false } },
  brutalist:    { audience: 'Urban runner / cyclist', composition: 'brutalist-slab', dark: false, background_color: '#E5E1D8', label_bg_color: '#E5E1D8', label_text_color: '#0A0A0A', route_color: '#FF1F1F', water_color: '#B8B8B0', land_color: '#D8D4CB', base_tile_style: 'carto-light', contour_color: '#9A968E', contour_major_color: '#4C4844', font_family: 'Bebas Neue', body_font_family: 'Space Grotesk', border_style: 'thick', tile_grain: 0.06, map_defaults: { preset: 'route-only', show_roads: false, show_place_labels: false, show_contours: false, show_hillshade: false, tile_effect: 'invert', show_grid: false } },
}

// ─── Poster Recipes: curated theme + preset combos ──────────────────────────
// Each recipe produces a visually distinct poster variant.

const POSTER_RECIPES = [
  { id: 'editorial',  theme: 'editorial-minimal', preset: 'contour-art',  composition: 'editorial-tall', label: 'Editorial' },
  { id: 'usgs',       theme: 'usgs-vintage',      preset: 'natural-topo', composition: 'park-quad',       label: 'USGS Heritage' },
  { id: 'blueprint',  theme: 'blueprint',         preset: 'route-only',   composition: 'blueprint-grid',  label: 'Blueprint' },
  { id: 'splits',     theme: 'splits-stats',      preset: 'road-network', composition: 'splits-grid',     label: 'Trail Profile' },
  { id: 'bib',        theme: 'marathon-bib',      preset: 'road-network', composition: 'bib-numerals',    label: 'Marathon Bib' },
  { id: 'brutalist',  theme: 'brutalist',         preset: 'route-only',   composition: 'brutalist-slab',  label: 'Brutalist' },
]

// ─── Marathon Metadata ──────────────────────────────────────────────────────
// Maps GPX filename stems to rich metadata for premade catalog entries.

const MARATHON_META = {
  austin_marathon_2026:                    { title: 'Austin Marathon 2026',                 region: 'Austin, Texas',           country: 'United States', date: '2026-02-15', tagline: 'Keep Austin running — the hill country capital marathon.' },
  barcelona_marathon_2026:                 { title: 'Barcelona Marathon 2026',              region: 'Barcelona, Catalonia',    country: 'Spain',         date: '2026-03-15', tagline: 'From Sagrada Familia to the sea — 26.2 miles through Barcelona.' },
  berlin_marathon_2025:                    { title: 'Berlin Marathon 2025',                 region: 'Berlin',                  country: 'Germany',       date: '2025-09-28', tagline: 'The world\'s fastest course, finishing at the Brandenburg Gate.' },
  boston_marathon_2026:                     { title: 'Boston Marathon 2026',                 region: 'Boston, Massachusetts',   country: 'United States', date: '2026-04-20', tagline: 'Hopkinton to Boylston — the world\'s oldest annual marathon.' },
  brighton_marathon_2026:                  { title: 'Brighton Marathon 2026',               region: 'Brighton, England',       country: 'United Kingdom',date: '2026-04-19', tagline: 'A seaside marathon along the English Channel.' },
  colorado_marathon_2026:                  { title: 'Colorado Marathon 2026',               region: 'Fort Collins, Colorado',  country: 'United States', date: '2026-05-03', tagline: 'Downhill through Poudre Canyon into Fort Collins.' },
  flying_pig_marathon_2026:                { title: 'Flying Pig Marathon 2026',             region: 'Cincinnati, Ohio',        country: 'United States', date: '2026-05-03', tagline: 'When pigs fly — Cincinnati\'s beloved hilly marathon.' },
  hamburg_marathon_2026:                   { title: 'Hamburg Marathon 2026',                region: 'Hamburg',                 country: 'Germany',       date: '2026-04-26', tagline: 'Through the historic port city along the Alster lakes.' },
  lincoln_marathon_2026:                   { title: 'Lincoln Marathon 2026',                region: 'Lincoln, Nebraska',       country: 'United States', date: '2026-05-03', tagline: 'Nebraska\'s premier spring marathon through the capital.' },
  london_marathon_2026:                    { title: 'London Marathon 2026',                 region: 'London, England',         country: 'United Kingdom',date: '2026-04-26', tagline: 'Greenwich to The Mall — one of the World Marathon Majors.' },
  los_angeles_marathon_2026:               { title: 'Los Angeles Marathon 2026',            region: 'Los Angeles, California', country: 'United States', date: '2026-03-08', tagline: 'Stadium to the sea through the heart of LA.' },
  manchester_marathon_2026:                { title: 'Manchester Marathon 2026',             region: 'Manchester, England',     country: 'United Kingdom',date: '2026-04-19', tagline: 'The UK\'s flattest and fastest marathon course.' },
  oakland_marathon_2026:                   { title: 'Oakland Marathon 2026',                region: 'Oakland, California',     country: 'United States', date: '2026-03-22', tagline: 'The Town\'s own marathon through diverse neighborhoods.' },
  oklahoma_city_memorial_marathon_2026:    { title: 'OKC Memorial Marathon 2026',           region: 'Oklahoma City, Oklahoma', country: 'United States', date: '2026-04-26', tagline: 'Run to remember — honoring the spirit of Oklahoma City.' },
  paris_marathon_2026:                     { title: 'Paris Marathon 2026',                  region: 'Paris',                   country: 'France',        date: '2026-04-05', tagline: 'Champs-Élysées to Bois de Vincennes — 26.2 through the City of Light.' },
  rome_marathon_2026:                      { title: 'Rome Marathon 2026',                   region: 'Rome',                    country: 'Italy',         date: '2026-03-22', tagline: 'Past the Colosseum, Vatican, and 2,000 years of history.' },
  rotterdam_marathon_2026:                 { title: 'Rotterdam Marathon 2026',              region: 'Rotterdam',               country: 'Netherlands',   date: '2026-04-12', tagline: 'Fast and flat through Europe\'s most modern skyline.' },
  st_louis_marathon_2026:                  { title: 'St. Louis Marathon 2026',              region: 'St. Louis, Missouri',     country: 'United States', date: '2026-04-04', tagline: 'Through Forest Park and under the Gateway Arch.' },
  tokyo_marathon_2025:                     { title: 'Tokyo Marathon 2025',                  region: 'Tokyo',                   country: 'Japan',         date: '2025-03-02', tagline: 'From Shinjuku to Tokyo Station — a World Major through the capital.' },
}

// ─── Slug helper (mirrors utils/premadeCatalog.ts) ──────────────────────────

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'premade-map'
}

async function uniqueSlug(base) {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data, error } = await supabase
      .from('premade_maps')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (error) throw new Error(`Slug check failed: ${error.message}`)
    if (!data) return candidate
  }
  throw new Error(`Could not generate unique slug for: ${base}`)
}

// ─── Resolve the owner user_id ──────────────────────────────────────────────

async function getOwnerUserId() {
  // Use the first admin user, or fall back to any user
  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (admin?.user_id) return admin.user_id

  // Fallback: look up by email
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 })
  if (users?.length) return users[0].id

  throw new Error('No user found to own maps. Create a user first.')
}

// ─── Apply a theme to the default StyleConfig ───────────────────────────────

function buildStyledConfig(recipe, marathonMeta) {
  const theme = THEMES[recipe.theme]
  if (!theme) throw new Error(`Unknown theme: ${recipe.theme}`)

  return {
    ...DEFAULT_STYLE_CONFIG,
    // Theme colors
    background_color: theme.background_color,
    label_bg_color: theme.label_bg_color,
    label_text_color: theme.label_text_color,
    route_color: theme.route_color,
    water_color: theme.water_color,
    land_color: theme.land_color,
    base_tile_style: theme.base_tile_style,
    contour_color: theme.contour_color,
    contour_major_color: theme.contour_major_color,
    color_theme: recipe.theme,
    composition: recipe.composition ?? theme.composition ?? 'editorial-tall',
    audience: theme.audience,
    dark: theme.dark,
    show_grid: theme.show_grid ?? theme.map_defaults?.show_grid ?? false,
    ...theme.map_defaults,
    // Theme-specific overrides
    ...(theme.font_family ? { font_family: theme.font_family } : {}),
    ...(theme.body_font_family ? { body_font_family: theme.body_font_family } : {}),
    ...(theme.border_style ? { border_style: theme.border_style } : {}),
    ...(theme.tile_grain != null ? { tile_grain: theme.tile_grain } : {}),
    // Preset
    preset: recipe.preset,
    // Marathon poster text
    location_text: marathonMeta.region,
    occasion_text: marathonMeta.date ? new Date(marathonMeta.date).getFullYear().toString() : '',
    // Ensure labels are on
    labels: {
      show_title: true,
      show_distance: true,
      show_elevation_gain: true,
      show_date: false,
      show_location: true,
    },
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏃 RadMaps Bulk Marathon Premade Creator`)
  console.log(`   Recipes: ${POSTER_RECIPES.length} theme variants per GPX`)
  if (DRY_RUN) console.log('   ⚠️  DRY RUN — no database writes')
  if (AUTO_PUBLISH) console.log('   📢  Auto-publish enabled')
  if (GENERATE_PREVIEWS) console.log('   🖼️  Thumbnail generation enabled')
  console.log()

  const gpxDir = resolve(import.meta.dirname, '..', '..', 'marathon_gpx_files')
  let gpxFiles = readdirSync(gpxDir).filter(f => f.endsWith('.gpx')).sort()

  if (fileFilter) {
    gpxFiles = gpxFiles.filter(f => f.includes(fileFilter))
    if (gpxFiles.length === 0) {
      console.error(`No GPX files matching "${fileFilter}"`)
      process.exit(1)
    }
  }

  console.log(`📂 Found ${gpxFiles.length} GPX files\n`)

  const userId = DRY_RUN ? 'dry-run-user' : await getOwnerUserId()
  console.log(`👤 Owner user: ${userId}\n`)

  let totalCreated = 0
  let totalErrors = 0
  const createdPremadeIds = []

  for (const gpxFile of gpxFiles) {
    const stem = gpxFile.replace('.gpx', '')
    const meta = MARATHON_META[stem]
    if (!meta) {
      console.log(`⏭️  Skipping ${gpxFile} — no metadata mapping`)
      continue
    }

    console.log(`\n━━━ ${meta.title} ━━━`)

    // Parse GPX
    let parsed
    try {
      const gpxText = readFileSync(resolve(gpxDir, gpxFile), 'utf8')
      parsed = parseGpxFile(gpxText)
      const km = parsed.stats.distance_km
      const gain = parsed.stats.elevation_gain_m
      console.log(`  📍 ${km} km, ${gain}m gain, ${parsed.geojson.features.length} features`)
    } catch (err) {
      console.error(`  ❌ Parse error: ${err.message}`)
      totalErrors++
      continue
    }

    // Enrich stats with metadata
    parsed.stats.location = meta.region
    if (meta.date) parsed.stats.date = meta.date

    // Create variants
    for (const recipe of POSTER_RECIPES) {
      const variantTitle = `${meta.title} — ${recipe.label}`
      const styleConfig = buildStyledConfig(recipe, meta)

      if (DRY_RUN) {
        console.log(`  [DRY] Would create: "${variantTitle}" (${recipe.theme}/${recipe.preset})`)
        totalCreated++
        continue
      }

      try {
        // 1. Insert map record
        const { data: map, error: mapErr } = await supabase
          .from('maps')
          .insert({
            user_id: userId,
            title: meta.title,
            subtitle: recipe.label,
            geojson: parsed.geojson,
            bbox: parsed.bbox,
            stats: parsed.stats,
            style_config: styleConfig,
            status: 'draft',
          })
          .select('id, title')
          .single()

        if (mapErr) throw new Error(`Map insert: ${mapErr.message}`)

        // 2. Insert premade record
        const baseSlug = slugify(`${meta.title} ${recipe.id}`)
        const slug = await uniqueSlug(baseSlug)

        const premadeRow = {
          source_map_id: map.id,
          slug,
          title: meta.title,
          subtitle: recipe.label,
          region: meta.region,
          country: meta.country,
          category: 'marathons',
          categories: ['marathons'],
          tagline: meta.tagline,
          description: `A beautiful ${recipe.label.toLowerCase()} poster of the ${meta.title} route. ${parsed.stats.distance_km} km through ${meta.region}.`,
          badges: [],
          stats: parsed.stats,
          bbox: parsed.bbox,
          geojson: parsed.geojson,
          style_config: styleConfig,
          homepage_visible: false,
          homepage_sort_order: 1000,
          needs_preview: true,
          base_price_cents: 2499,
          status: 'draft',
          created_by: userId,
          updated_by: userId,
        }

        const { data: premade, error: premadeErr } = await supabase
          .from('premade_maps')
          .insert(premadeRow)
          .select('id, slug, status')
          .single()

        if (premadeErr) throw new Error(`Premade insert: ${premadeErr.message}`)
        createdPremadeIds.push(premade.id)

        if (AUTO_PUBLISH) {
          console.log(`  ✅ ${slug} (draft — publish after preview + print asset validation)`)
        } else {
          console.log(`  ✅ ${slug}`)
        }

        totalCreated++
      } catch (err) {
        console.error(`  ❌ ${recipe.id}: ${err.message}`)
        totalErrors++
      }
    }
  }

  if (!DRY_RUN && GENERATE_PREVIEWS && createdPremadeIds.length > 0) {
    console.log(`\n🖼️  Generating ${createdPremadeIds.length} premade thumbnail(s)…`)
    const result = spawnSync(
      process.execPath,
      [
        resolve(import.meta.dirname, 'backfill-premade-thumbnails.mjs'),
        '--ids',
        createdPremadeIds.join(','),
        '--limit',
        String(createdPremadeIds.length),
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) totalErrors++
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Created: ${totalCreated}`)
  console.log(`❌ Errors:  ${totalErrors}`)
  console.log(`📊 Total:   ${totalCreated + totalErrors}`)
  if (DRY_RUN) console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to create records.`)
  console.log()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
