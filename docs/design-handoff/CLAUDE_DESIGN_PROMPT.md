# Claude Design Prompt

You are reviewing RadMaps, a poster editor for turning GPX trail tracks into
print-quality trail map posters. Your job is to improve the design quality of
the poster theme system with a focus on typography, layout, composition,
palette, cartographic art direction, and theme distinctiveness.

You will receive screenshots/contact sheets plus implementation context files.
Please review theme by theme, including the owned/Beta map styles, and return
specific implementable recommendations.

## Product Context

RadMaps posters are 2:3 print products. Users upload a route, choose a poster
theme, tune the map style, then order a physical print. The app screenshots the
real Vue/Nuxt/MapLibre poster in Chromium for proofs and final prints.

The design system has two related layers:

- Poster themes: full visual recipes with palette, typography, composition,
  route styling, map defaults, and theme picker metadata.
- Owned/Beta map styles: RadMaps-owned Atlas map presets that can be applied
  inside a poster theme. These are map-only presets, not separate poster
  compositions.

The current registry contains 27 renderable poster theme IDs: 15 primary
anchors, 7 colorways, and 5 new candidate directions now implemented for
review. Please review colorways for visibility and grouping, not just raw
palette quality.

## Hard Constraints

- Keep the poster aspect ratio at 2:3.
- Do not propose a second poster renderer.
- Do not propose external image assets, remote font dependencies, or custom
  one-off CSS outside the existing theme system.
- Prefer changes that can be implemented as theme recipe, typography profile,
  composition profile, map defaults, thumbnail metadata, or restrained
  component polish.
- Typography must remain print-worthy and legible at poster scale.
- Route lines, labels, footer text, and title text must remain readable.
- Do not flatten all themes into the same premium/minimal look. Theme
  distinctiveness matters.

## Current Implementation Files

- Poster renderer: `components/map/MapPreview.vue`
- Editor panel and theme picker: `components/map/StylePanel.vue`
- Refined theme registry: `utils/themes/refined.ts`
- Poster typography and composition data: `utils/posterData.ts`
- Theme picker options/thumbnails: `utils/themeOptions.ts`
- Composition routing: `utils/posterCompositions.ts`
- Style graph and map constraints: `utils/styleLayerGraph.ts`

## Available Font Families

Use only font families already available or intended in the RadMaps theme
system:

- Source Sans 3
- Source Serif 4
- IBM Plex Sans
- Atkinson Hyperlegible Next
- Newsreader
- Big Shoulders Display
- Fjalla One
- Oswald
- Bebas Neue
- DM Sans
- Space Grotesk
- Outfit
- Work Sans
- Playfair Display
- Cormorant Garamond
- Libre Baskerville
- DM Serif Display

## Review Goals

For each poster theme:

- Decide whether it should be kept, revised, merged, retired, or marked for
  print proofing.
- Evaluate typography fit: title face, support face, scale, tracking, case,
  rhythm, hierarchy, and print legibility.
- Evaluate layout and composition: title/map/footer balance, density, margins,
  alignment, visual tension, and whether the composition suits the theme name.
- Evaluate palette and route styling: contrast, print character, originality,
  map readability, and whether the route remains the visual subject.
- Identify themes that feel too similar and recommend how to separate them.
- Recommend any "rad" new directions that fit RadMaps and can be implemented
  within the current registry.
- For colorways, identify the parent theme they should live under and whether
  the colorway is distinct enough for the main picker.

For each owned/Beta map style:

- Evaluate cartographic character and poster usefulness.
- Recommend whether it should appear as a map preset, a default within specific
  poster themes, or a full theme candidate.
- Suggest route color/weight/opacity, label contrast, terrain/contour treatment,
  and thumbnail presentation improvements.

## Output Format

Return JSON matching `RESPONSE_SCHEMA.json`.

Keep recommendations specific and implementable. Avoid generic comments like
"make it more modern." Instead say what to change, why, and which file or theme
field it likely maps to.
