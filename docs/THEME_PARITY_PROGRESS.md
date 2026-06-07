# Theme Parity Progress

## Checkpoint

This checkpoint captures the current safe pause point for the refined theme
catalogue work. The implementation is not complete, and no theme should be
marked done without semantic checks plus visual review against the supplied
reference screenshot or spec contract.

## Current Validation State

- Pre-flight rerun on June 7, 2026: `npx vue-tsc --noEmit --pretty false`
  passed, and the focused contract suite passed with 4 files / 125 tests:
  `npx vitest run tests/map-style-effects.test.ts tests/refined-themes.test.ts tests/poster-compositions.test.ts tests/theme-application.test.ts`.
- Focused contract tests passed:
  `npx vitest run tests/map-style-effects.test.ts tests/refined-themes.test.ts tests/poster-compositions.test.ts tests/theme-application.test.ts`
- Harness syntax passed:
  `node --check scripts/capture-theme-audit.mjs`
- Typecheck passed:
  `npx vue-tsc --noEmit --pretty false`
- Browser parity was run only in batches for completed review points, not after
  every edit.
- Treatment-intensity checks have been backfilled for the most likely false
  positives: USGS/Classic park-quad, Risograph, Brutalist, and the
  travel-banner family.

## Theme Status Notes

- `usgs-vintage`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/usgs-vintage.png`; capture
  reported `95.0%` pixel, `98.2%` map, `91.3%` chrome, and `100.0%` semantic
  (`115/115`). Review queue status is `ready-for-review`.
- `classic-trail`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/classic-trail.png`; capture
  reported `96.8%` pixel, `99.9%` map, `91.5%` chrome, and `100.0%` semantic
  (`105/105`). Review queue status is `ready-for-review`.
- `midcentury-travel`: ready for Claude/human review. The live render was
  written to `docs/theme_audit_output/poster-themes/print/midcentury-travel.png`;
  capture reported `91.8%` pixel, `99.2%` map, `83.5%` chrome, and `100.0%`
  semantic (`105/105`). Review queue status is `ready-for-review`; the lower
  chrome smoke score is noted for visual review.
- `ranch-ochre`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/ranch-ochre.png`; capture
  reported `91.9%` pixel, `93.4%` map, `87.4%` chrome, and `100.0%` semantic
  (`105/105`). Review queue status is `ready-for-review`; lower smoke scores are
  noted for visual review.
- `daybreak-trace`: ready for Claude/human review. The live render was written
  to `docs/theme_audit_output/poster-themes/print/daybreak-trace.png`; capture
  reported `90.6%` pixel, `99.1%` map, `78.2%` chrome, and `100.0%` semantic
  (`105/105`). Review queue status is `ready-for-review`; lower chrome smoke
  score is noted for visual review.
- `risograph`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/risograph.png`; capture reported
  `84.8%` pixel, `91.9%` map, `67.8%` chrome, and `100.0%` semantic (`103/103`).
  Review queue status is `ready-for-review`; low visual smoke is noted for
  Claude review even though the riso motif is present.
- `brutalist`: ready for Claude/human review after retrying capture on fresh
  local port `3004` because the existing `3003` server stopped responding. The
  live render was written to `docs/theme_audit_output/poster-themes/print/brutalist.png`;
  capture reported `86.4%` pixel, `44.7%` map, `87.8%` chrome, and `100.0%`
  semantic (`96/96`). Review queue status is `ready-for-review`; low map smoke
  is noted for visual review.
- `editorial-minimal`: ready for Claude/human review. The live render was
  written to `docs/theme_audit_output/poster-themes/print/editorial-minimal.png`;
  capture reported `92.6%` pixel, `75.0%` map, `92.6%` chrome, and `100.0%`
  semantic (`92/92`). Review queue status is `ready-for-review`; lower map smoke
  is noted for visual review.
- `contour-wash`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/contour-wash.png`; capture
  reported `89.1%` pixel, `92.5%` map, `100.0%` chrome, and `100.0%` semantic
  (`99/99`). Review queue status is `ready-for-review`. The image treatment
  check was corrected to assert the full-bleed contour field color instead of
  paper dominance.
- `usgs-vintage`: strengthened semantic checks now pass (`115/115`) after
  increasing the quad neatline to a real 2px print stroke. Latest parity
  reported `95.0%` pixel, `98.2%` map, `91.3%` chrome, and `100.0%` semantic.
  Visual review still needs final human approval.
- `classic-trail`: restored as a Slate colorway of the USGS/park-quad contract.
  Semantic checks pass and visual review looked materially closer after removing
  stale start/finish label artifacts.
- `risograph`, `brutalist`, and the travel-banner family pass the strengthened
  treatment checks, but still need final human visual approval before they are
  marked done.
- `sea-chart`: semantic checks now pass (`117/117`) after correcting the map
  field to pale mint, adding treatment checks for the transparent titleblock,
  single rule, neatline, and sounding density. Latest parity reported `97.0%`
  pixel, `97.3%` map, `100.0%` chrome, and `100.0%` semantic. It still needs
  final human visual approval before it can be marked done.

## Next Steps

1. Get human visual approval or requested corrections for `sea-chart`,
   `usgs-vintage`, `classic-trail`, `risograph`, `brutalist`, and the
   travel-banner family.
2. Continue one theme at a time, using the token contract as the gate and the
   contact sheet as required visual review.
