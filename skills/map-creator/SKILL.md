---
name: map-creator
description: Create beautiful premade trail maps from GPX files using the AI style agent. Use this skill whenever the user wants to create maps, generate poster designs, style maps, produce premade map entries, run bulk map creation from a folder of GPX files, or work with the AI styling agent. Triggers on any mention of "create map", "make a map", "bulk maps", "premade maps", "style a map", "poster", "GPX", "trail map", or any reference to generating map products from route data.
---

# RadMaps Map Creator

Create production-ready trail map posters from GPX files — one at a time or in bulk. Uses the AI style agent (Claude) to generate beautiful, audience-aware poster designs, then inserts them as premade map entries in Supabase.

## When to use this skill

- User wants to create a premade map from a GPX file
- User wants to bulk-create maps from a folder of GPX files (like the Hawaii hike collection)
- User wants the AI agent to style a map for a specific audience or theme
- User wants to generate poster variants (multiple themes) for the same route
- User is working with the `ai-style-agent.mjs` or `bulk-*-premade.mjs` scripts

## Architecture overview

The map creation pipeline has 4 stages:

1. **Parse GPX** — Extract GeoJSON, bounding box, and route stats (distance, elevation, coordinates)
2. **AI Style** — Claude generates 1-3 complete StyleConfig objects, each a unique poster design
3. **Insert to DB** — Each styled map goes into `maps` + `premade_maps` tables in Supabase
4. **Generate thumbnails** — Screenshot-based preview images via AWS renderer/Playwright

The core script is `scripts/create-premade-maps.mjs`. Read `references/theme-registry.md` for the full list of available themes, compositions, and their audiences.

## Before running

1. Read `references/theme-registry.md` to understand the 13 refined themes and when to use each
2. Ensure `.env` has `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY`
3. GPX files should be in a known directory with a `trail_metadata.json` if running bulk

## Single map creation

Run the script for one GPX file:

```bash
cd trailmaps-app
node scripts/create-premade-maps.mjs \
  --gpx ../hawaii_hike_gpx/kalalau-trail.gpx \
  --title "Kalalau Trail" \
  --region "Na Pali Coast" \
  --country "United States" \
  --category hiking \
  --variants 3
```

The `--variants` flag controls how many distinct poster designs the AI generates (1-6). Default is 3.

You can also specify a theme directly instead of using AI:

```bash
node scripts/create-premade-maps.mjs \
  --gpx ../hawaii_hike_gpx/kalalau-trail.gpx \
  --theme editorial-minimal \
  --title "Kalalau Trail"
```

## Bulk map creation

Point at a directory with GPX files and an optional `trail_metadata.json`:

```bash
node scripts/create-premade-maps.mjs \
  --bulk ../hawaii_hike_gpx/ \
  --category hiking \
  --variants 3 \
  --dry-run
```

The `--dry-run` flag shows what would be created without touching the database. Always use it first to review.

The `trail_metadata.json` file should have this shape:

```json
[
  {
    "file": "kalalau-trail.gpx",
    "name": "Kalalau Trail",
    "island": "Kauai",
    "region": "Na Pali Coast",
    "difficulty": "Strenuous",
    "distance_mi": 22.0,
    "elev_gain_ft": 6000,
    "type": "out-and-back"
  }
]
```

If no metadata file exists, the script infers names from filenames and uses AI to generate descriptions.

## How the AI style agent works

The agent receives route context (title, category, stats, geometry summary, geographic region) and returns complete StyleConfig objects. Each variant is a distinct poster design with a different theme, composition, typography, and color palette.

The agent is guided by a theme registry that maps audience segments to appropriate themes:

| Audience | Recommended themes |
|----------|-------------------|
| Hiker / National Park visitor | `usgs-vintage`, `midcentury-travel`, `field-journal`, `botanical` |
| Runner / marathon | `marathon-bib`, `splits-stats`, `brutalist` |
| Urban cyclist / Strava | `blueprint-strava`, `splits-stats`, `bold-modern` |
| Gallery / art collector | `editorial-minimal`, `bold-modern`, `risograph` |
| Backcountry / wilderness | `dark-sky`, `field-journal`, `usgs-vintage` |
| Trail marketing / merch | `risograph`, `brutalist`, `bold-modern` |

The AI selects themes from this matrix based on the route's characteristics, then builds a complete StyleConfig using the theme's color palette, composition, typography, and map defaults.

## Key rules for the AI agent

These rules are embedded in the agent's system prompt and enforced by the sanitizer:

1. **CARTO tile label guard** — CARTO raster tiles (carto-light, carto-dark) bake in place names. The agent must set `show_place_labels: false` and `show_poi_labels: false` for any CARTO-based theme. The sanitizer enforces this automatically.

2. **Theme-composition coupling** — Each theme has a default composition. The agent should respect this pairing unless explicitly overridden. The sanitizer enforces valid composition IDs.

3. **Map defaults per theme** — Each refined theme has a `map_defaults` object that prescribes the preset, road visibility, label visibility, hillshade, contours, and tile effects. The agent should start from these defaults and only deviate with good reason.

4. **Dark theme auto-detection** — Dark themes (`blueprint`, `blueprint-strava`, `dark-sky`, `splits-stats`) require `base_tile_style: 'carto-dark'` and `dark: true`. The sanitizer infers this from the theme ID.

5. **Print size** — Valid sizes are `8x12`, `12x18`, `16x24`, `20x30`, `24x36`, `32x48`. Default is `24x36`.

## Customizing the agent prompt

The system prompt is in `scripts/create-premade-maps.mjs` in the `buildSystemPrompt()` function. It includes:

- The full theme registry with colors, compositions, and audience data
- Route-specific context (stats, category, geography)
- The poster design rules (label guard, composition coupling, etc.)
- Output format instructions (valid JSON StyleConfig)

To change which themes the AI considers, edit the theme registry reference. To change how many variants are generated, use the `--variants` flag.

## Troubleshooting

- **Double labels on CARTO maps** — The sanitizer should catch this. If not, check that `show_place_labels` and `show_poi_labels` are both `false` for carto-light/carto-dark tile styles.
- **Missing composition** — Old maps without a `composition` field render through the `legacy-classic` layout. New maps should always have one.
- **Theme not found** — Check that the theme ID is in `VALID_THEMES` in the script and in `types/index.ts` ColorTheme union. All 13 refined + 16 legacy themes are valid.
- **Thumbnail generation fails** — Run `scripts/backfill-premade-thumbnails.mjs` separately. It needs either a AWS renderer URL or local Playwright.

## File reference

| File | Purpose |
|------|---------|
| `scripts/create-premade-maps.mjs` | Main creation script (single + bulk) |
| `skills/map-creator/references/theme-registry.md` | Complete theme definitions with colors, compositions, audiences |
| `utils/themes/refined.ts` | Canonical theme source of truth (TypeScript) |
| `types/index.ts` | StyleConfig, ThemeDefinition, enum types |
| `scripts/backfill-premade-thumbnails.mjs` | Thumbnail generation (unchanged) |
