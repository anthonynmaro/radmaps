# Theme Parity Progress

## Checkpoint

This checkpoint captures the current safe pause point for the refined theme
catalogue work. The implementation is not complete, and no theme should be
marked done without semantic checks plus visual review against the supplied
reference screenshot or spec contract.

## Current Validation State

- Focused contract tests passed:
  `npx vitest run tests/map-style-effects.test.ts tests/refined-themes.test.ts tests/poster-compositions.test.ts tests/theme-application.test.ts`
- Harness syntax passed:
  `node --check scripts/capture-theme-audit.mjs`
- Typecheck passed:
  `npx vue-tsc --noEmit --pretty false`
- Browser parity was run only in batches for completed review points, not after
  every edit.

## Theme Status Notes

- `usgs-vintage`: semantic checks pass and parity capture reports strong map and
  chrome scores. Visual review still needs final human approval.
- `classic-trail`: restored as a Slate colorway of the USGS/park-quad contract.
  Semantic checks pass and visual review looked materially closer after removing
  stale start/finish label artifacts.
- `risograph`, `brutalist`, and the travel-banner family have completed focused
  implementation passes, but still need final human visual approval before they
  are marked done.
- `sea-chart`: explicitly not done. Latest parity reported `97.8%` pixel and
  `100%` semantic, but the contact sheet exposed a false positive. The live
  output is too washed out, has weaker chart/neatline intensity, and the bottom
  titleblock still reads as a floating generic card instead of an integrated
  nautical label block.

## Next Steps

1. Tighten `sea-chart` with scoped changes only:
   - stronger teal nautical chart field
   - clearer neatline/graticule/rhumb/depth treatment
   - integrated bottom titleblock proportions
   - preserve GPX-sourced route/course layers
2. Add semantic checks that catch the Sea Chart false positive:
   - dominant chart field intensity
   - map/titleblock proportions
   - titleblock not rendered as a floating generic card
3. Rerun focused tests and one Sea Chart parity capture.
4. Continue one theme at a time, using the token contract as the gate and the
   contact sheet as required visual review.
