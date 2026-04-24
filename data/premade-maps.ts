import { DEFAULT_STYLE_CONFIG, type PremadeMap, type StyleConfig } from '~/types'

/**
 * ───────────────────────────────────────────────────────────────────────────
 * Premade Map Catalog
 * ───────────────────────────────────────────────────────────────────────────
 * Curated posters sold directly without a sign-in. Guests can purchase any of
 * these; logged-in users can also clone one into their own `maps` collection
 * and fully customize it from the editor.
 *
 * Each entry ships with:
 *   • A plausible route traced between real trailhead waypoints (for visual
 *     previews). Swap in proper GPX-derived coordinates before launch.
 *   • A pre-tuned StyleConfig that reflects the trail's mood.
 *   • `preview_image_url` / `render_url` — point these at pre-generated
 *     Supabase Storage URLs in production. Gelato needs the 300 DPI render
 *     to fulfil guest orders.
 * ───────────────────────────────────────────────────────────────────────────
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const bboxFromCoords = (coords: [number, number][]): [number, number, number, number] => {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  // Add 5% padding
  const padX = (maxLng - minLng) * 0.05
  const padY = (maxLat - minLat) * 0.05
  return [minLng - padX, minLat - padY, maxLng + padX, maxLat + padY]
}

const toFeatureCollection = (coords: [number, number][]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
  ],
})

/**
 * Smoothly densify a waypoint sequence by inserting intermediate points
 * with a small, deterministic meander — produces trail-like curves instead
 * of straight segments between waypoints.
 */
const trace = (waypoints: [number, number][], resolution = 8, jitter = 0.4): [number, number][] => {
  const pts: [number, number][] = []
  let seed = 1234
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lng1, lat1] = waypoints[i]
    const [lng2, lat2] = waypoints[i + 1]
    const dx = lng2 - lng1
    const dy = lat2 - lat1
    const segLen = Math.sqrt(dx * dx + dy * dy)
    const perpX = -dy / (segLen || 1)
    const perpY = dx / (segLen || 1)
    const amp = segLen * jitter * 0.12
    for (let s = 0; s < resolution; s++) {
      const t = s / resolution
      const waveA = Math.sin(t * Math.PI * 2 + i) * amp
      const waveB = (rand() - 0.5) * amp * 0.4
      const offset = waveA + waveB
      pts.push([lng1 + dx * t + perpX * offset, lat1 + dy * t + perpY * offset])
    }
  }
  pts.push(waypoints[waypoints.length - 1])
  return pts
}

/** Merge a base config with overrides, typed. */
const styled = (overrides: Partial<StyleConfig>): StyleConfig => ({
  ...DEFAULT_STYLE_CONFIG,
  ...overrides,
  labels: { ...DEFAULT_STYLE_CONFIG.labels, ...(overrides.labels || {}) },
})

// ─── Route waypoints (hand-crafted, illustrative) ───────────────────────────

const JMT_WAYPOINTS: [number, number][] = [
  [-119.5581, 37.7321], // Happy Isles, Yosemite Valley
  [-119.5419, 37.7301],
  [-119.5235, 37.7099],
  [-119.4988, 37.6882],
  [-119.4531, 37.6444], // Tuolumne Meadows area
  [-119.4018, 37.5895],
  [-119.3654, 37.5122],
  [-119.3232, 37.4389],
  [-119.2851, 37.3572], // Devils Postpile
  [-119.2367, 37.2641],
  [-119.1998, 37.1750], // Mammoth area
  [-119.1434, 37.0935],
  [-119.0788, 36.9812],
  [-119.0124, 36.8921], // Muir Trail Ranch
  [-118.9567, 36.8011],
  [-118.8823, 36.7412],
  [-118.8104, 36.6934],
  [-118.7435, 36.6612], // Onion Valley / Kearsarge
  [-118.6712, 36.6285],
  [-118.5921, 36.5988],
  [-118.5123, 36.5789],
  [-118.4389, 36.5712],
  [-118.3712, 36.5752],
  [-118.2923, 36.5785], // Mt Whitney Portal (end)
]

const NYC_MARATHON_WAYPOINTS: [number, number][] = [
  [-74.0645, 40.6059], // Fort Wadsworth, Staten Island (start)
  [-74.0555, 40.6099], // Verrazzano approach
  [-74.0418, 40.6182], // Verrazzano-Narrows Bridge
  [-74.0329, 40.6283],
  [-74.0241, 40.6382], // Brooklyn entry, 4th Ave
  [-73.9996, 40.6578], // Park Slope / Atlantic Ave
  [-73.9775, 40.6889], // Williamsburg
  [-73.9568, 40.7142], // Pulaski Bridge to Queens
  [-73.9473, 40.7432], // Long Island City
  [-73.9425, 40.7608], // Queensboro Bridge approach
  [-73.9621, 40.7635], // Onto 1st Ave, Manhattan
  [-73.9572, 40.7812],
  [-73.9488, 40.8013], // Willis Ave Bridge to Bronx
  [-73.9316, 40.8089], // Bronx loop
  [-73.9394, 40.8204],
  [-73.9476, 40.8133],
  [-73.9544, 40.7982], // Back onto Madison Ave Bridge
  [-73.9612, 40.7921], // Into Harlem
  [-73.9689, 40.7822],
  [-73.9742, 40.7712], // 5th Ave down
  [-73.9768, 40.7622],
  [-73.9693, 40.7528], // Into Central Park at 90th
  [-73.9734, 40.7452],
  [-73.9775, 40.7346],
  [-73.9823, 40.7259], // Central Park South
  [-73.9818, 40.7198],
  [-73.9758, 40.7144],
  [-73.9712, 40.7068],
  [-73.9692, 40.7009],
  [-73.9712, 40.7009], // Tavern on the Green, finish
]

const WTREK_WAYPOINTS: [number, number][] = [
  [-73.0132, -50.9391], // Paine Grande
  [-73.0398, -50.9512],
  [-73.0712, -50.9702],
  [-73.0989, -50.9712], // Grey Glacier lookout (west arm)
  [-73.0823, -50.9614],
  [-73.0592, -50.9498],
  [-73.0243, -50.9412],
  [-72.9881, -50.9412], // Italiano Camp
  [-72.9502, -50.9349], // French Valley lookout
  [-72.9211, -50.9455],
  [-72.8833, -50.9585],
  [-72.8421, -50.9712], // Los Cuernos
  [-72.7932, -50.9843],
  [-72.7544, -51.0001], // Chileno
  [-72.7198, -51.0122],
  [-72.6923, -51.0182], // Torres del Paine base
  [-72.6712, -51.0254],
  [-72.6589, -51.0422],
  [-72.6732, -51.0512], // Hotel Las Torres
]

const CAMINO_WAYPOINTS: [number, number][] = [
  [-1.2368, 43.1624], // Saint-Jean-Pied-de-Port, France
  [-1.3198, 43.1512], // Roncesvalles pass
  [-1.4552, 43.1401],
  [-1.6812, 42.9721], // Pamplona
  [-1.9012, 42.8234],
  [-2.1889, 42.7389], // Logroño
  [-2.4521, 42.5989],
  [-2.7812, 42.4612], // Burgos
  [-3.2311, 42.4123],
  [-3.7812, 42.4021],
  [-4.2122, 42.3712],
  [-4.7234, 42.3521], // Frómista
  [-5.3123, 42.3389], // Sahagún
  [-5.5612, 42.6012], // León
  [-5.9712, 42.6312],
  [-6.3212, 42.4912], // Astorga
  [-6.5912, 42.4712],
  [-6.8221, 42.6121], // Ponferrada
  [-7.1121, 42.6712],
  [-7.3989, 42.8123],
  [-7.6623, 42.8712], // Sarria
  [-7.9823, 42.8921],
  [-8.3234, 42.8823],
  [-8.5412, 42.8812], // Santiago de Compostela (finish)
]

const R2R_WAYPOINTS: [number, number][] = [
  [-112.1129, 36.0544], // South Kaibab Trailhead
  [-112.1081, 36.0642], // Ooh-Aah Point
  [-112.0981, 36.0723], // Cedar Ridge
  [-112.0923, 36.0821],
  [-112.0872, 36.0898], // Skeleton Point
  [-112.0891, 36.0988],
  [-112.0958, 36.1081], // Tip-Off
  [-112.0923, 36.1175],
  [-112.0892, 36.1201], // Bright Angel Bridge
  [-112.0855, 36.1238],
  [-112.0812, 36.1278], // Phantom Ranch
  [-112.0729, 36.1321],
  [-112.0638, 36.1398], // Ribbon Falls turnoff
  [-112.0582, 36.1481],
  [-112.0522, 36.1566], // Cottonwood Campground
  [-112.0455, 36.1672],
  [-112.0412, 36.1789],
  [-112.0389, 36.1889], // Manzanita
  [-112.0378, 36.1989],
  [-112.0459, 36.2088],
  [-112.0502, 36.2172], // Supai Tunnel
  [-112.0562, 36.2231],
  [-112.0629, 36.2272], // North Kaibab Trailhead
]

const MT_FUJI_WAYPOINTS: [number, number][] = [
  [138.7278, 35.3833], // Yoshida 5th Station
  [138.7328, 35.3766],
  [138.7338, 35.3714], // 6th Station
  [138.7348, 35.3672],
  [138.7356, 35.3622],
  [138.7361, 35.3582], // 7th Station
  [138.7365, 35.3548],
  [138.7368, 35.3512], // 8th Station
  [138.7372, 35.3478],
  [138.7373, 35.3452],
  [138.7372, 35.3428], // 9th Station
  [138.7369, 35.3411],
  [138.7365, 35.3399], // Summit crater rim
  [138.7361, 35.3394],
  [138.7378, 35.3401], // Crater walk
  [138.7389, 35.3411],
  [138.7381, 35.3422], // Kengamine (highest point)
  [138.7365, 35.3421],
  // Descent via Subashiri
  [138.7412, 35.3458],
  [138.7478, 35.3512],
  [138.7544, 35.3572], // Shimojaya
  [138.7598, 35.3642],
  [138.7634, 35.3712],
  [138.7658, 35.3778], // Subashiri 5th
]

// ─── Catalog ────────────────────────────────────────────────────────────────

export const PREMADE_MAPS: PremadeMap[] = [
  {
    slug: 'john-muir-trail',
    title: 'John Muir Trail',
    subtitle: 'Happy Isles to Mount Whitney',
    region: 'Sierra Nevada, California',
    country: 'United States',
    category: 'long-distance',
    tagline: '211 miles through the Range of Light.',
    description:
      'From the granite walls of Yosemite Valley to the 14,505-foot summit of Mount Whitney, the JMT traces the spine of the Sierra Nevada — Thousand Island Lake, Muir Pass, Evolution Basin, and eleven passes above 11,000 feet. A cartographic tribute to three weeks in the backcountry.',
    badges: ['Iconic', 'Long-distance'],
    stats: {
      distance_km: 340,
      elevation_gain_m: 14000,
      elevation_loss_m: 13800,
      max_elevation_m: 4421,
      min_elevation_m: 1220,
      activity_type: 'hiking',
      location: 'Sierra Nevada, CA',
    },
    bbox: bboxFromCoords(JMT_WAYPOINTS),
    geojson: toFeatureCollection(trace(JMT_WAYPOINTS, 6, 0.35)),
    style_config: styled({
      color_theme: 'topaz',
      preset: 'topographic',
      show_contours: true,
      show_hillshade: true,
      background_color: '#F0F4F2',
      label_bg_color: '#E8EEE9',
      label_text_color: '#1A2E24',
      route_color: '#C1121F',
      water_color: '#A8CDCA',
      land_color: '#E4EDE5',
      contour_color: '#B8CCBC',
      contour_major_color: '#7CA98C',
      font_family: 'Big Shoulders Display',
      body_font_family: 'Space Grotesk',
      trail_name: 'John Muir Trail',
      location_text: 'Sierra Nevada · California',
      occasion_text: '',
      print_size: '18x24',
    }),
    featured: true,
    base_price_cents: 2999,
    cover_gradient: ['#2D6A4F', '#081C15'],
  },
  {
    slug: 'nyc-marathon',
    title: 'New York City Marathon',
    subtitle: '26.2 miles · Five Boroughs',
    region: 'New York, New York',
    country: 'United States',
    category: 'marathon',
    tagline: 'From Staten Island to Tavern on the Green.',
    description:
      'Trace the blue line through all five boroughs — over the Verrazzano, up 4th Avenue, across the Queensboro, up 1st, into the Bronx, and down 5th into Central Park. The world\'s most celebrated city marathon, framed.',
    badges: ['Bestseller'],
    stats: {
      distance_km: 42.2,
      elevation_gain_m: 250,
      elevation_loss_m: 240,
      max_elevation_m: 80,
      min_elevation_m: 1,
      activity_type: 'running',
      location: 'New York City, NY',
    },
    bbox: bboxFromCoords(NYC_MARATHON_WAYPOINTS),
    geojson: toFeatureCollection(trace(NYC_MARATHON_WAYPOINTS, 5, 0.1)),
    style_config: styled({
      color_theme: 'obsidian',
      preset: 'minimalist',
      base_tile_style: 'carto-dark',
      show_contours: false,
      show_hillshade: false,
      background_color: '#121212',
      label_bg_color: '#0E0E0E',
      label_text_color: '#F0EDE8',
      route_color: '#FFB703',
      water_color: '#0F1F2A',
      land_color: '#1A1A1A',
      font_family: 'Oswald',
      body_font_family: 'Space Grotesk',
      trail_name: 'NYC MARATHON',
      location_text: 'Five Boroughs · 42.2 km',
      occasion_text: '',
      print_size: '18x24',
    }),
    featured: true,
    base_price_cents: 2999,
    cover_gradient: ['#FFB703', '#0A0A0A'],
  },
  {
    slug: 'torres-del-paine-w-trek',
    title: 'Torres del Paine W Trek',
    subtitle: 'Patagonia · Chile',
    region: 'Patagonia, Chile',
    country: 'Chile',
    category: 'adventure',
    tagline: 'Five days among the towers.',
    description:
      'Glaciers, hanging valleys, and the three granite spires at dawn. The W traces a 50-mile letter through Torres del Paine National Park — Grey, French Valley, and the Torres base — ending above the emerald tarn at sunrise.',
    badges: ['New'],
    stats: {
      distance_km: 80,
      elevation_gain_m: 2900,
      elevation_loss_m: 2900,
      max_elevation_m: 925,
      min_elevation_m: 40,
      activity_type: 'hiking',
      location: 'Torres del Paine, Chile',
    },
    bbox: bboxFromCoords(WTREK_WAYPOINTS),
    geojson: toFeatureCollection(trace(WTREK_WAYPOINTS, 8, 0.5)),
    style_config: styled({
      color_theme: 'midnight',
      preset: 'topographic',
      base_tile_style: 'carto-dark',
      show_contours: true,
      show_hillshade: true,
      background_color: '#0D1421',
      label_bg_color: '#0A1018',
      label_text_color: '#F0E8C8',
      route_color: '#C9A84C',
      water_color: '#0A1F35',
      land_color: '#111A25',
      contour_color: '#4A80A8',
      contour_major_color: '#72B0D8',
      font_family: 'Playfair Display',
      body_font_family: 'DM Sans',
      trail_name: 'Torres del Paine',
      location_text: 'Patagonia · Chile',
      occasion_text: 'The W Circuit',
      print_size: '18x24',
    }),
    featured: true,
    base_price_cents: 3499,
    cover_gradient: ['#1F3B5C', '#0A0F18'],
  },
  {
    slug: 'camino-frances',
    title: 'Camino de Santiago',
    subtitle: 'Camino Francés · 780 km',
    region: 'Northern Spain',
    country: 'Spain',
    category: 'pilgrimage',
    tagline: 'Saint-Jean-Pied-de-Port to Santiago.',
    description:
      'Nine hundred years of footsteps. The French Way crosses the Pyrenees, the Meseta, and the hills of Galicia — 780 kilometers ending at the cathedral square in Santiago de Compostela. A map for the long walk.',
    badges: ['Iconic'],
    stats: {
      distance_km: 780,
      elevation_gain_m: 12500,
      elevation_loss_m: 12800,
      max_elevation_m: 1450,
      min_elevation_m: 120,
      activity_type: 'walking',
      location: 'Camino Francés, Spain',
    },
    bbox: bboxFromCoords(CAMINO_WAYPOINTS),
    geojson: toFeatureCollection(trace(CAMINO_WAYPOINTS, 5, 0.25)),
    style_config: styled({
      color_theme: 'dusk',
      preset: 'minimalist',
      show_contours: false,
      show_hillshade: false,
      background_color: '#FAF3E8',
      label_bg_color: '#FAF3E8',
      label_text_color: '#2C1810',
      route_color: '#C4622D',
      water_color: '#AECDD8',
      land_color: '#EEE4CC',
      font_family: 'Cormorant Garamond',
      body_font_family: 'Libre Baskerville',
      trail_name: 'Camino de Santiago',
      location_text: 'Camino Francés · España',
      occasion_text: '',
      print_size: '18x24',
    }),
    featured: false,
    base_price_cents: 2999,
    cover_gradient: ['#C4622D', '#5A2E11'],
  },
  {
    slug: 'grand-canyon-r2r',
    title: 'Grand Canyon Rim to Rim',
    subtitle: 'South Kaibab to North Kaibab',
    region: 'Grand Canyon, Arizona',
    country: 'United States',
    category: 'national-park',
    tagline: '24 miles · One mile deep.',
    description:
      'Descend the South Kaibab into the Inner Gorge, cross Bright Angel Creek at Phantom Ranch, and climb the North Kaibab back to the rim — nearly 11,000 feet of vertical in a single day-hike legend.',
    stats: {
      distance_km: 38,
      elevation_gain_m: 1800,
      elevation_loss_m: 1500,
      max_elevation_m: 2512,
      min_elevation_m: 740,
      activity_type: 'hiking',
      location: 'Grand Canyon NP, AZ',
    },
    bbox: bboxFromCoords(R2R_WAYPOINTS),
    geojson: toFeatureCollection(trace(R2R_WAYPOINTS, 8, 0.45)),
    style_config: styled({
      color_theme: 'dusk',
      preset: 'topographic',
      show_contours: true,
      show_hillshade: true,
      background_color: '#F7ECDC',
      label_bg_color: '#EBDEC5',
      label_text_color: '#3A1E0E',
      route_color: '#A83200',
      water_color: '#A8C6D0',
      land_color: '#E8D8B8',
      contour_color: '#C4A574',
      contour_major_color: '#8B6332',
      font_family: 'Fjalla One',
      body_font_family: 'DM Sans',
      trail_name: 'Rim to Rim',
      location_text: 'Grand Canyon · Arizona',
      occasion_text: '',
      print_size: '18x24',
    }),
    featured: true,
    base_price_cents: 2999,
    cover_gradient: ['#C25E2E', '#3D1A0A'],
  },
  {
    slug: 'mount-fuji',
    title: 'Mount Fuji',
    subtitle: 'Yoshida Trail · 富士山',
    region: 'Honshu, Japan',
    country: 'Japan',
    category: 'peak',
    tagline: 'From the 5th station to the summit.',
    description:
      'Nine hours of volcanic scree and tori gates under a black sky, chasing goraiko — the sunrise from 3,776 meters. This poster marks the Yoshida trail, the most trodden of the four routes up Japan\'s sacred mountain.',
    badges: ['New'],
    stats: {
      distance_km: 14,
      elevation_gain_m: 1471,
      elevation_loss_m: 1471,
      max_elevation_m: 3776,
      min_elevation_m: 2305,
      activity_type: 'hiking',
      location: 'Mt. Fuji, Japan',
    },
    bbox: bboxFromCoords(MT_FUJI_WAYPOINTS),
    geojson: toFeatureCollection(trace(MT_FUJI_WAYPOINTS, 6, 0.25)),
    style_config: styled({
      color_theme: 'chalk',
      preset: 'topographic',
      show_contours: true,
      show_hillshade: true,
      background_color: '#F7F4EF',
      label_bg_color: '#F7F4EF',
      label_text_color: '#1C1917',
      route_color: '#B42B2B',
      water_color: '#B8D8E8',
      land_color: '#EDE8DF',
      contour_color: '#C8BDB0',
      contour_major_color: '#9E9082',
      font_family: 'DM Serif Display',
      body_font_family: 'DM Sans',
      trail_name: 'Mount Fuji',
      location_text: '富士山 · Yoshida Trail',
      occasion_text: '',
      print_size: '18x24',
    }),
    featured: false,
    base_price_cents: 2999,
    cover_gradient: ['#D4DCE8', '#2A3F5F'],
  },
]

// ─── Lookup helpers ─────────────────────────────────────────────────────────

export function getPremadeBySlug(slug: string): PremadeMap | undefined {
  return PREMADE_MAPS.find((m) => m.slug === slug)
}

export function listPremadeMaps(opts?: {
  category?: PremadeMap['category']
  featuredOnly?: boolean
}): PremadeMap[] {
  let list = [...PREMADE_MAPS]
  if (opts?.category) list = list.filter((m) => m.category === opts.category)
  if (opts?.featuredOnly) list = list.filter((m) => m.featured)
  return list
}

export const PREMADE_CATEGORIES: { id: PremadeMap['category']; label: string }[] = [
  { id: 'national-park', label: 'National Parks' },
  { id: 'long-distance', label: 'Long-distance' },
  { id: 'marathon', label: 'Marathons' },
  { id: 'peak', label: 'Peaks' },
  { id: 'pilgrimage', label: 'Pilgrimage' },
  { id: 'adventure', label: 'Adventure' },
]
