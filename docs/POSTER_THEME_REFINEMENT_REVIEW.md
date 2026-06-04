# Poster Theme Refinement Review

Date: June 4, 2026

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
- Tuned typography scale/tracking across refined themes to reduce oversized
  title behavior and restore distinct editorial, technical, travel, and
  performance personalities.
- Added explicit thumbnail typography metadata for refined themes that were
  falling back to generic card previews.
- Added a unit guard that every refined label band maintains at least WCAG AA
  text contrast against its label background.

## Theme Direction

Gallery and heritage:
`editorial-minimal`, `usgs-vintage`, `classic-trail`, `field-journal`,
`botanical`.

These now lean on paper tone, restrained terrain, serif-driven hierarchy, and
more natural map colors. The route remains the primary graphic mark.

Expressive and rad:
`midcentury-travel`, `risograph`, `ranch-ochre`, `daybreak-trace`,
`night-ride`, `electric-atlas`, `copper-night`.

These keep a stronger personality, but the palettes are less blunt and the map
defaults are constrained so they still print cleanly.

Refined/professional wall-art:
`blackline`, `moonstone`, `contour-wash`.

These prioritize architectural restraint, quiet grids, low-noise contours, and
clean data-forward layouts.

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

## Next Steps

- Add visual regression snapshots for all 22 refined themes at desktop and final
  print geometry.
- Generate proof/final smoke renders for a small accepted theme set before
  shipping the new picker as the default user path.
- Review the 22-theme list as a product set; archive any theme that does not
  earn a clear role in the picker.
- Print physical samples for at least one heritage, one expressive, and one
  professional theme at 24x36 inches.
- Continue template editor interaction polish separately from theme approval:
  drag-to-reorder, mobile bottom sheets, image/logo/icon blocks, and true map
  interaction lock semantics.
