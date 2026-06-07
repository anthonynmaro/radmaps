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
- `sea-chart`: semantic checks now pass (`112/112`) after tightening the map
  field, chart overlay, and integrated titleblock checks. Latest parity reported
  `97.2%` pixel, `97.5%` map, `100.0%` chrome, and `100.0%` semantic. It still
  needs final human visual approval before it can be marked done.

## Next Steps

1. Get human visual approval or requested corrections for `sea-chart`.
2. Continue one theme at a time, using the token contract as the gate and the
   contact sheet as required visual review.
