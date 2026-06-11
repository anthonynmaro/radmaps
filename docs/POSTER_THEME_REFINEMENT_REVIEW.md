# Poster Theme Refinement Review

Date: June 5, 2026, updated June 6, 2026

## Goal

This pass focused on making the refined RadMaps poster themes feel authored and
print-ready again after the template editor work flattened some of the original
character. The target is not more decoration. The target is stronger poster
identity with quieter map layers, better typography, intentional chrome spacing,
and enough contrast for high-quality 24x36 inch output.

`MapPreview.vue` remains the only poster renderer. The theme pass changes
structured theme recipes, composition profiles, layout defaults, and picker
metadata only.

## What Changed

- Reduced the global refined contour defaults so terrain reads as texture
  instead of visual noise.
- Reworked refined theme palettes toward warmer paper, less generic saturation,
  stronger route contrast, and calmer map backgrounds.
- Added theme-specific Atlas layer settings for the themes that need subtle
  land, water, park, contour, and label treatment instead of relying on generic
  preset defaults.
- Tightened composition insets by roughly 10-15% so posters use the fixed 2:3
  area with more confidence while preserving print-safe margins.
- Reduced starter spacer row proportions so blank areas remain editable spacer
  rows but no longer dominate the template.
- Tuned typography scale, case, tracking, and font pairings across refined
  themes to restore distinct editorial, technical, travel, performance, and
  expressive poster personalities.
- Fixed the fixed-template chrome path so theme title-case profiles can actually
  render mixed-case serif titles instead of forcing every title to uppercase.
- Updated theme picker thumbnail typography so picker cards preview the same
  display family, case, and rhythm as the opened poster.
- Added explicit thumbnail typography metadata for refined themes that were
  falling back to generic card previews.
- Added a unit guard that every refined label band maintains at least WCAG AA
  text contrast against its label background.
- Implemented the standalone theme-review consolidation: duplicate-looking
  themes stay renderable as explicit colorways, while five new directions
  (`cartouche-place`, `sea-chart`, `relief-shaded`, `transit-diagram`, and
  `plein-air`) are registered as real production themes.
- Corrected the June 6 implementation drift by removing speculative static
  overlay art from Sea Chart, Transit, Mid-Century, Journal, Botanical, Relief,
  Plein Air, and Bib-derived compositions. Theme identity now comes from the
  design spec's font, palette, editable chrome, owned map preset, and
  route-derived MapLibre styling.

## Typography Principles Used

The June 5 pass used a tighter print-poster typography rubric:

- Use one strong display family plus one quiet utility/body family per theme.
- Pair serif display faces with readable sans or text-serif support when the
  theme is editorial, heritage, botanical, or atmospheric.
- Use condensed sans display faces only for graphic, race, performance, and
  data-forward posters where strong distance readability is the point.
- Keep all-caps tracking intentional and moderate. Mixed-case serif titles use
  near-zero tracking so they feel typeset rather than letterspaced.
- Make footer stats subordinate to the route artwork unless the theme's promise
  is explicitly data-forward or race-oriented.
- Keep footer metadata/brand opacity below the stat hierarchy so small details
  do not become the first thing the eye sees.

Research references for this rubric: AIGA's font pairing/hierarchy teaching
material, Whitman College's poster hierarchy guidance, Creative Bloq's pairing
discussion on matching type sub-categories and context, and PrintWiki's line
length notes about matching measure, face width, and leading.

## Theme Direction

Gallery and heritage:
`editorial-minimal`, `usgs-vintage`, `field-journal`, `botanical`,
`cartouche-place`, `relief-shaded`.

These now lean on paper tone, restrained terrain, serif-driven hierarchy, and
more natural map colors. The route remains the primary graphic mark.

Expressive and rad:
`midcentury-travel`, `risograph`, `electric-atlas`, `sea-chart`, `plein-air`.
`ranch-ochre`, `daybreak-trace`, `night-ride`, and `copper-night` remain
renderable colorways.

These keep a stronger personality, but the palettes are less blunt and the map
defaults are constrained so they still print cleanly.

Refined/professional wall-art:
`bold-modern`, `blackline`, `moonstone`, `contour-wash`, `transit-diagram`.

These prioritize architectural restraint, quiet grids, low-noise contours, and
clean data-forward layouts.

## Theme-By-Theme Review

### Poster Themes

| Theme | Role | Typography review | Layout/map review | Adjustment |
|---|---|---|---|---|
| `editorial-minimal` | Gallery art print | Playfair Display + Source Serif 4 gives the poster a true editorial voice without novelty. | Left title and quiet footer keep the route as the art object. | Preserved mixed case and quieter footer brand. |
| `usgs-vintage` | Survey/park keepsake | Libre Baskerville + Source Sans 3 feels more archival than generic serif. | Park quad frame still supports labels and paper texture. | Kept title modest and map labels readable. |
| `midcentury-travel` | Classic travel poster | Oswald + Source Sans 3 gives stronger WPA-style poster rhythm. | Bottom banner stays bold but no longer overfills the map. | Increased display confidence and retained warm label band contrast. |
| `risograph` | Merch/printmaking | Big Shoulders Display + Work Sans adds print-shop personality. | Offset map shadow and duotone map can be expressive without extra decoration. | Made title more poster-native and stats more utilitarian. |
| `blueprint` | Technical wall print | Space Grotesk + IBM Plex Sans separates title geometry from data text. | Grid remains map-scoped so the whole poster does not feel busy. | Added measured all-caps tracking and tighter technical footer rhythm. |
| `blueprint-strava` | Data import / ride print | Space Grotesk display with IBM Plex stats reads precise and modern. | Data footer is allowed to lead more than heritage themes. | Kept numeric hierarchy strong but reduced metadata tracking slightly. |
| `field-journal` | Hiker/traveler keepsake | Cormorant Garamond + Source Serif 4 feels handbound and naturalist. | Journal spread still benefits from paper tone and quiet labels. | Restored mixed-case title and softer stat treatment. |
| `bold-modern` | Graphic collector print | Big Shoulders Display + DM Sans makes the block composition earn its name. | Side rails and label band can carry a bolder headline. | Enlarged title and tightened line-height for stronger poster impact. |
| `contour-wash` | Architectural topo study | Space Grotesk + Source Sans 3 fits the quiet contour palette. | Moved off `modernist-block` into `art-wash` so it reads as a full-bleed art print, not a recolor. | Softened title scale, increased contour wash identity, and kept route black. |
| `splits-stats` | Runner/cyclist data poster | Space Grotesk + IBM Plex Sans gives clear sport-tech hierarchy. | Data footer is appropriate here, but the map still needs primary presence. | Kept stats bold and title compact. |
| `marathon-bib` | Race commemorative | Bebas Neue + Atkinson Hyperlegible Next makes the theme read like an event bib. | Bib footer can be large because the theme promise is commemorative data. | Swapped title face and increased race-number confidence. |
| `dark-sky` | Backcountry atmospheric | Cormorant Garamond + Source Sans 3 adds night-sky elegance. | Star field remains secondary; route glow and dark terrain stay primary. | Restored mixed case and softened title tracking. |
| `botanical` | Naturalist plate | Cormorant Garamond + Source Serif 4 feels closer to specimen labeling. | Plate rules and paper texture frame the map without making it fussy. | Preserved quiet serif hierarchy and low footer opacity. |
| `brutalist` | Urban/concrete poster | Bebas Neue + IBM Plex Sans now feels intentionally blunt. | Bottom slab can carry heavy type while the map stays high contrast. | Increased display scale and line-height discipline. |
| `classic-trail` | USGS Slate colorway | Libre Baskerville + Source Sans 3 stays aligned with USGS Heritage. | Same park-quad language, cooler slate contour/route palette. | Marked as `colorway_of: usgs-vintage`. |
| `ranch-ochre` | Mid-Century Ochre colorway | Oswald + Source Sans 3 stays aligned with the travel-poster parent. | Desert palette and dark route, no separate typography identity. | Marked as `colorway_of: midcentury-travel`. |
| `blackline` | Modernist Blackline colorway | Big Shoulders Display + IBM Plex Sans creates a sharp mono system. | Modernist side rails work well with stripped black route linework. | Marked as `colorway_of: bold-modern`. |
| `copper-night` | Dark Sky Copper colorway | Cormorant Garamond + Source Sans 3 keeps the copper palette elegant. | Dark-sky composition remains, with bronze stars/route. | Marked as `colorway_of: dark-sky`. |
| `moonstone` | Blueprint Moonstone colorway | Space Grotesk + IBM Plex Sans supports a pale technical mood. | Grid is useful but intentionally low opacity. | Marked as `colorway_of: blueprint`. |
| `night-ride` | Trail Profile Night Ride colorway | Oswald + IBM Plex Sans gives speed without sci-fi excess. | Cyan route and deep navy profile treatment. | Marked as `colorway_of: splits-stats`. |
| `daybreak-trace` | Mid-Century Daybreak colorway | Oswald replaces Playfair so it stays in the travel-poster family. | Dawn palette and same banner rhythm as Mid-Century. | Marked as `colorway_of: midcentury-travel`. |
| `electric-atlas` | High-energy route/data print | Big Shoulders Display + IBM Plex Sans makes the theme finally feel electric. | Blueprint data composition works, with vivid magenta route and restrained map grid. | Enlarged title, kept grid scope map-only, and pushed route to electric magenta. |
| `cartouche-place` | Place portrait / no-route | Playfair Display + Source Serif 4 gives a decorative cartouche feel without custom assets. | Framed street-network map with roads, water, place labels, and coordinate-style footer. | Added as a new production theme for place maps. |
| `sea-chart` | Nautical route print | Libre Baskerville + IBM Plex Sans supports chart-like authority. | Pale water/land palette with chart grid and magenta course route. | Added as a new production theme for waterfront routes. |
| `relief-shaded` | Terrain wall print | Newsreader + Source Sans 3 gives a refined mountain-map voice. | Hypsometric natural terrain with hillshade and dense but quiet contours. | Added as a new production theme for high-relief routes. |
| `transit-diagram` | Tour/stops diagram | Outfit + IBM Plex Sans gives diagrammatic clarity. | Minimal map with a bold route line, stations/pins, and data footer. | Added as a new production theme for tours/stops. |
| `plein-air` | Painterly trip keepsake | Cormorant Garamond + Source Sans 3 gives a soft sentimental tone. | Watercolor Atlas preset plus restrained contour and brushed warm route. | Added as a new production theme for expressive trip prints. |

### Owned/Beta Map Themes

These live in the real editor as map-only Beta styles backed by RadMaps-hosted
Atlas tiles. They now appear in the Quick tab as a separate "Beta owned map
themes" section and remain available in the Map tab's owned Atlas map inventory.
Applying one changes the map preset/layer defaults while preserving the current
poster typography and chrome composition.

| Map theme | Role | Design review | Follow-up |
|---|---|---|---|
| `radmaps-minimalist` | Quiet owned replacement for CARTO-like context | Good understated base for refined poster themes; lets route and chrome lead. | Keep layer controls conservative by default. |
| `radmaps-topographic` | Owned outdoors/topographic map | Strong utility style with trails, contours, labels, and terrain context. | Watch label density in small route extents. |
| `radmaps-natural` | Green terrain/outdoor style | Useful for hiking and landscape routes that need more landcover presence. | Ensure green landcover does not fight warm poster palettes. |
| `radmaps-toner-light` | First-party light toner | Graphic blackline map language pairs well with modernist/brutalist posters. | Preserve route contrast and avoid excessive POI noise. |
| `radmaps-toner-dark` | First-party dark toner | High-contrast road network for night/performance posters. | Keep route casing and label opacity tuned for print. |
| `radmaps-contour-wash` | Pale contour study | Already overlaps the `contour-wash` poster theme and is a strong art-map option. | Keep as both a full poster recipe and a map-only option. |
| `radmaps-watercolor` | First-party watercolor art tiles | Important expressive owned style that was missing from the poster-theme review. | Needs proof smoke renders because raster art tiles carry the most print risk. |
| `radmaps-night-relief` | Dark terrain relief | Good atmospheric map-only companion for `dark-sky` and `copper-night`. | Validate contours/route contrast at 24x36. |
| `radmaps-simple-contour` | Sparse contour-first map | Excellent quiet foundation for editorial and travel posters. | Keep dense browser contours print-legible. |
| `radmaps-alidade` | Clean modern owned street/cartography | Good neutral map-only option for user-created custom poster typography. | Keep roads subtle enough for route-first posters. |
| `radmaps-alidade-dark` | Clean dark owned cartography | Useful for performance/night styles without the full relief mood. | Validate label halos and orange route contrast. |

## Code Review Notes

- No database migration was added.
- No saved maps are rewritten automatically.
- No raw HTML/CSS persistence was introduced.
- No second poster renderer was introduced.
- Theme application still clears stale theme-owned layout/style overrides so a
  newly selected refined theme can load its intended starter chrome.
- Existing legacy theme ids remain renderable and keep their migration targets.
- The fixed template editor continues to write back to `poster_layout` and
  `poster_text_overrides`.

## Test Coverage

The style contract suite now covers:

- refined theme count and registry wiring,
- standalone review new-direction themes and colorway metadata,
- valid composition ids,
- map defaults and Atlas style id mapping,
- print-safe label contrast for every refined theme,
- blueprint map-grid defaults,
- theme application reset behavior,
- Dark Sky no-hillshade leader-line behavior,
- composition typography/layout contracts,
- poster layout spacer/tombstone behavior.

Required commands for this pass:

```bash
npm run typecheck
npm run test:style-graph
PLAYWRIGHT_PORT=3002 npm run test:style-browser -- --workers=1
```

## Resolved Follow-Ups

- The 27-theme list now has a documented product role for every theme.
- The fixed-template title transform no longer defeats mixed-case typography.
- Theme picker typography metadata is aligned with the refined theme registry.
- Owned/Beta map themes now appear in the Quick tab as a separate map-only
  section, so the review surface no longer omits live RadMaps-owned styles.
- The standalone review's five new theme candidates are implemented in the
  typed theme/composition/typography registries.
- Duplicate-looking theme IDs now declare `review_decision: 'merge'` and
  `colorway_of` while staying renderable for saved maps and direct links.
- Footer stat hierarchy has composition-specific treatment for art, travel,
  technical, data, race, modernist, and brutalist layouts.
- The design handoff inventory is covered by tests for theme id, label,
  composition, primary font, secondary font, default owned map preset, and
  Atlas style id.
- `scripts/capture-theme-audit.mjs` captures all 27 poster themes and 11 owned
  map presets with dev overlays hidden so visual review reflects the poster.

## Remaining Validation

- Add screenshot-based visual regression snapshots for the approved 27-theme
  set at desktop editor geometry and final print geometry.
- Generate proof/final smoke renders for at least one heritage, one expressive,
  one data-forward, and one atmospheric theme before shipping the new picker as
  the default user path.
- Print physical samples for at least one heritage, one expressive, and one
  professional theme at 24x36 inches.
- Continue template editor interaction polish separately from theme approval:
  drag-to-reorder, mobile bottom sheets, image/logo/icon blocks, and true map
  interaction lock semantics.
