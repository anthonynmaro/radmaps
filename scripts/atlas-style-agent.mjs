#!/usr/bin/env node
/**
 * atlas-style-agent.mjs
 *
 * Anthropic-powered ideation agent for RadMaps-owned atlas styles.
 * Produces structured tileset/style recipes for the Planetiler + PMTiles atlas
 * workstream. This does not generate map tiles directly; it creates build-ready
 * concepts that describe source layers, derived terrain art, MapLibre styling,
 * app naming, and validation fixtures.
 *
 * Usage:
 *   node scripts/atlas-style-agent.mjs
 *   node scripts/atlas-style-agent.mjs --count 8 --out atlas/style-ideas/run.json
 *   node scripts/atlas-style-agent.mjs --brief "More Midwest gravel and Great Lakes styles"
 */

import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {
    count: 6,
    model: 'claude-sonnet-4-6',
    out: 'atlas/style-ideas/latest.json',
    markdown: 'atlas/style-ideas/latest.md',
    brief: '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--count') args.count = Number(argv[++i] || args.count)
    else if (arg === '--model') args.model = argv[++i] || args.model
    else if (arg === '--out') args.out = argv[++i] || args.out
    else if (arg === '--markdown') args.markdown = argv[++i] || args.markdown
    else if (arg === '--brief') args.brief = argv[++i] || ''
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  if (!Number.isFinite(args.count) || args.count < 1 || args.count > 12) {
    throw new Error('--count must be between 1 and 12')
  }

  return args
}

function printHelp() {
  console.log(`RadMaps Atlas Style Agent

Usage:
  node scripts/atlas-style-agent.mjs [options]

Options:
  --count <n>       Number of tileset concepts to generate, 1-12. Default: 6
  --model <name>    Anthropic model. Default: claude-sonnet-4-6
  --out <path>      JSON output path. Default: atlas/style-ideas/latest.json
  --markdown <path> Markdown summary path. Default: atlas/style-ideas/latest.md
  --brief <text>    Extra creative or regional direction
`)
}

function loadEnv() {
  const candidates = [
    resolve(repoRoot, '.env'),
    resolve(repoRoot, '..', 'trailmaps-app', '.env'),
  ]

  const env = { ...process.env }
  let loadedFrom = null

  for (const path of candidates) {
    if (!existsSync(path)) continue
    loadedFrom = path
    const lines = readFileSync(path, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (env[key]) continue
      env[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
    }
    break
  }

  return { env, loadedFrom }
}

const SYSTEM_PROMPT = `You are the RadMaps Atlas Cartography Agent.

RadMaps makes print-quality trail map posters from GPX/Strava routes. We are
building our own map atlas to reduce dependency on CARTO, Mapbox, MapTiler, and
Stadia while gaining deeper art direction.

Design tileset/style concepts for this target stack:
- Planetiler-only tile generation
- PMTiles delivery into MapLibre
- RadMaps-native minimal vector schema
- US-first coverage with Midwest included
- Internal atlas lab first, not public customer presets yet
- Required source layers: water, waterway, road, trail, landcover, park,
  building, place_label, poi, boundary, contour, hillshade, terrain_art
- Terrain v1 includes vector contours, raster hillshade, and automated vector
  terrain art such as ridge emphasis, slope bands, drainage marks, landform
  texture, and generalized contour hierarchy
- NAIP aerial can be a candidate layer, but do not make every idea depend on it

Think like a print cartographer and a map-rendering engineer. Every concept must
be beautiful, technically plausible, and actionable for a Planetiler/MapLibre
implementation. Prefer styles that prove different data/layer needs.

Return your final answer by calling the record_tileset_ideas tool. Keep each
string concise enough for a practical build brief.`

const tools = [
  {
    name: 'record_tileset_ideas',
    description: 'Record structured RadMaps owned-atlas tileset concepts.',
    input_schema: {
      type: 'object',
      properties: {
        generated_at: { type: 'string' },
        brief: { type: 'string' },
        tilesets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              audience: { type: 'string' },
              regions_to_test: { type: 'array', items: { type: 'string' } },
              visual_thesis: { type: 'string' },
              source_layers: { type: 'array', items: { type: 'string' } },
              derived_layers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    generation_rule: { type: 'string' },
                    maplibre_use: { type: 'string' },
                  },
                  required: ['id', 'source', 'generation_rule', 'maplibre_use'],
                },
              },
              maplibre_recipe: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  water: { type: 'string' },
                  roads: { type: 'string' },
                  trails: { type: 'string' },
                  contours: { type: 'string' },
                  hillshade: { type: 'string' },
                  labels: { type: 'string' },
                },
                required: ['background', 'water', 'roads', 'trails', 'contours', 'hillshade', 'labels'],
              },
              planetiler_profile_notes: { type: 'array', items: { type: 'string' } },
              style_config_defaults: {
                type: 'object',
                properties: {
                  candidate_preset: { type: 'string' },
                  route_color: { type: 'string' },
                  background_color: { type: 'string' },
                  label_text_color: { type: 'string' },
                  show_roads: { type: 'boolean' },
                  show_contours: { type: 'boolean' },
                  show_hillshade: { type: 'boolean' },
                },
                required: ['candidate_preset', 'route_color', 'background_color', 'label_text_color', 'show_roads', 'show_contours', 'show_hillshade'],
              },
              attribution_notes: { type: 'string' },
              acceptance_fixtures: { type: 'array', items: { type: 'string' } },
              risk: { type: 'string' },
            },
            required: [
              'id',
              'name',
              'audience',
              'regions_to_test',
              'visual_thesis',
              'source_layers',
              'derived_layers',
              'maplibre_recipe',
              'planetiler_profile_notes',
              'style_config_defaults',
              'attribution_notes',
              'acceptance_fixtures',
              'risk',
            ],
          },
        },
      },
      required: ['generated_at', 'brief', 'tilesets'],
    },
  },
]

const SHAPE_REFERENCE = `Tool input shape:
{
  "generated_at": "ISO timestamp from the user prompt",
  "brief": "short brief summary",
  "tilesets": [
    {
      "id": "kebab-case-stable-id",
      "name": "Human name",
      "audience": "who this style is for",
      "regions_to_test": ["Colorado Front Range", "..."],
      "visual_thesis": "one paragraph",
      "source_layers": ["water", "road", "..."],
      "derived_layers": [
        {
          "id": "kebab-case-derived-layer",
          "source": "DEM/OSM/NAIP/etc",
          "generation_rule": "specific automated generation rule",
          "maplibre_use": "how the layer renders"
        }
      ],
      "maplibre_recipe": {
        "background": "#hex",
        "water": "#hex + behavior",
        "roads": "classes and styling",
        "trails": "classes and styling",
        "contours": "intervals and styling",
        "hillshade": "palette/intensity/mix-blend style",
        "labels": "font/placement/density"
      },
      "planetiler_profile_notes": ["specific tags/filters/attributes to emit"],
      "style_config_defaults": {
        "candidate_preset": "radmaps-*",
        "route_color": "#hex",
        "background_color": "#hex",
        "label_text_color": "#hex",
        "show_roads": true,
        "show_contours": true,
        "show_hillshade": true
      },
      "attribution_notes": "data/source attribution reminder",
      "acceptance_fixtures": ["route/region fixtures that should look good"],
      "risk": "main implementation or visual risk"
    }
  ]
}`

function buildUserPrompt(args) {
  const generatedAt = new Date().toISOString()
  return `Generate ${args.count} distinct RadMaps owned-atlas tileset concepts.

Generated timestamp: ${generatedAt}

Must cover this region pack across the set:
- Colorado Front Range / Rocky Mountain terrain
- Moab or southern Utah desert
- Pacific Northwest forest and water
- Chicago / urban Midwest
- Wisconsin Driftless or Ice Age Trail
- Michigan / Great Lakes shoreline

Strategic goals:
- Prove owned vector basemap replacement for CARTO/Mapbox vector overlays
- Prove owned terrain art with contours, hillshade, and automated vector art
- Keep concepts compatible with an internal atlas lab route
- Use app-facing names that could later become StylePreset candidates
- Make each concept stress different layer requirements

${args.brief ? `Extra brief:\n${args.brief}` : ''}`
}

function parseToolResponse(response) {
  const toolUse = response.content.find(block => block.type === 'tool_use' && block.name === 'record_tileset_ideas')
  if (!toolUse) {
    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
      .trim()
    throw new Error(`Anthropic did not call record_tileset_ideas. Text preview: ${text.slice(0, 240)}`)
  }
  const input = toolUse.input
  if (input?.tilesets) return input

  for (const value of Object.values(input ?? {})) {
    if (value && typeof value === 'object' && Array.isArray(value.tilesets)) {
      return value
    }
  }

  return input
}

function validateResult(result) {
  if (!result || typeof result !== 'object') throw new Error('Result must be an object')
  if (!Array.isArray(result.tilesets)) {
    throw new Error(`Result must include tilesets[]. Received keys: ${Object.keys(result ?? {}).join(', ') || '(none)'}`)
  }
  if (result.tilesets.length === 0) throw new Error('Result tilesets[] is empty')

  for (const tileset of result.tilesets) {
    for (const key of ['id', 'name', 'visual_thesis', 'source_layers', 'derived_layers', 'maplibre_recipe', 'planetiler_profile_notes']) {
      if (!(key in tileset)) throw new Error(`Tileset missing required key: ${key}`)
    }
    if (!String(tileset.id).match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
      throw new Error(`Tileset id must be kebab-case: ${tileset.id}`)
    }
  }
}

function renderMarkdown(result) {
  const lines = [
    '# RadMaps Atlas Style Ideas',
    '',
    `Generated: ${result.generated_at ?? new Date().toISOString()}`,
    '',
    result.brief ? result.brief : 'Anthropic-generated owned-atlas tileset concepts.',
    '',
  ]

  for (const tileset of result.tilesets) {
    lines.push(`## ${tileset.name}`)
    lines.push('')
    lines.push(`- ID: \`${tileset.id}\``)
    lines.push(`- Audience: ${tileset.audience}`)
    lines.push(`- Candidate preset: \`${tileset.style_config_defaults?.candidate_preset ?? tileset.id}\``)
    lines.push(`- Regions: ${(tileset.regions_to_test ?? []).join(', ')}`)
    lines.push(`- Risk: ${tileset.risk}`)
    lines.push('')
    lines.push(tileset.visual_thesis)
    lines.push('')
    lines.push('Source layers: ' + (tileset.source_layers ?? []).map(layer => `\`${layer}\``).join(', '))
    lines.push('')
    lines.push('Derived layers:')
    for (const layer of tileset.derived_layers ?? []) {
      lines.push(`- \`${layer.id}\`: ${layer.generation_rule} Render use: ${layer.maplibre_use}`)
    }
    lines.push('')
    lines.push('Planetiler notes:')
    for (const note of tileset.planetiler_profile_notes ?? []) {
      lines.push(`- ${note}`)
    }
    lines.push('')
    lines.push(`Attribution: ${tileset.attribution_notes}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function writeOutput(path, content) {
  const absolute = resolve(repoRoot, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
  return absolute
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { env, loadedFrom } = loadEnv()
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY. Add it to .env in this worktree or the main trailmaps-app worktree.')
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: args.model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: 'tool', name: 'record_tileset_ideas' },
    messages: [{ role: 'user', content: `${buildUserPrompt(args)}\n\n${SHAPE_REFERENCE}` }],
  })

  const result = parseToolResponse(response)
  validateResult(result)

  const jsonPath = writeOutput(args.out, `${JSON.stringify(result, null, 2)}\n`)
  const mdPath = writeOutput(args.markdown, renderMarkdown(result))

  console.log(`Generated ${result.tilesets.length} atlas style ideas.`)
  console.log(`Env source: ${loadedFrom ? loadedFrom.replace(env.ANTHROPIC_API_KEY, '[redacted]') : 'process.env'}`)
  console.log(`JSON: ${jsonPath}`)
  console.log(`Markdown: ${mdPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
