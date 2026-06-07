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
- `risograph`: Claude feedback remediation is ready for review. The live render
  was regenerated at `docs/theme_audit_output/poster-themes/print/risograph.png`;
  capture reported `83.7%` pixel, `90.5%` map, `67.8%` chrome, and `100.0%`
  semantic (`105/105`). Sampled warm paper, the bolder fluoro-pink route, and
  visible blue misregistration offset now pass; low chrome smoke is still noted
  for Claude review.
- `brutalist`: ready for Claude/human review. The live render was regenerated at
  `docs/theme_audit_output/poster-themes/print/brutalist.png`; capture reported
  `55.5%` pixel, `22.5%` map, `87.9%` chrome, and `100.0%` semantic (`98/98`).
  Claude feedback is addressed with sampled concrete/black/orange tokens, heavy
  black contour linework, visible plus-crosshair registration marks, and a
  thicker map frame.
- `editorial-minimal`: Claude feedback remediation is ready for review. The
  live render was regenerated at
  `docs/theme_audit_output/poster-themes/print/editorial-minimal.png`; capture
  reported `91.2%` pixel, `61.5%` map, `91.2%` chrome, and `100.0%` semantic
  (`100/100`). The render now uses a bottom-left Playfair gallery title, hides
  the generic stats footer/logo band, quiets the contour field, and shows square
  route endpoint markers. Review queue status remains `ready-for-review`.
- `contour-wash`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/contour-wash.png`; capture
  reported `89.1%` pixel, `92.5%` map, `100.0%` chrome, and `100.0%` semantic
  (`99/99`). Review queue status is `ready-for-review`. The image treatment
  check was corrected to assert the full-bleed contour field color instead of
  paper dominance.
- `bold-modern`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/bold-modern.png`; capture
  reported `23.9%` pixel, `47.6%` map, `24.1%` chrome, and `100.0%` semantic
  (`103/103`). Claude feedback is addressed with sampled rose paper/red accent
  tokens, a clean red GPX stroke, square endpoint markers, and no trap/register
  hatch layers.
- `blackline`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/blackline.png`; capture reported
  `69.2%` pixel, `96.2%` map, `20.3%` chrome, and `100.0%` semantic (`104/104`).
  Claude feedback is addressed with sampled neutral/black/white tokens, stronger
  contour density and contrast, and visible grey topo echo linework filling the
  map field.
- `blueprint`: overnight queue status is `ready-for-review` without changing
  the existing manifest review state. The live render was written to
  `docs/theme_audit_output/poster-themes/print/blueprint.png`; capture reported
  `89.9%` pixel, `93.8%` map, `86.7%` chrome, and `100.0%` semantic (`105/105`).
- `moonstone`: Claude feedback remediation is ready for review. The live render
  was regenerated at `docs/theme_audit_output/poster-themes/print/moonstone.png`;
  capture reported `87.0%` pixel, `41.1%` map, `90.1%` chrome, and `100.0%`
  semantic (`108/108`). The generic stats band is replaced with the metric
  `DIST / GAIN / JUL 2025` technical footer, the Dolomiti subtitle is restored,
  and the drafting labels, map grid, neatline, and etched route treatment still
  pass.
- `blueprint-strava`: Claude feedback remediation is ready for review. The live
  render was regenerated at
  `docs/theme_audit_output/poster-themes/print/blueprint-strava.png`; capture
  reported `92.6%` pixel, `98.4%` map, `83.1%` chrome, and `100.0%` semantic
  (`109/109`). The print render keeps the map-first technical sheet, large
  bottom BOSTON slab, and FIG. 01 route-plan label, now with the Boston Marathon
  subtitle and `26.2 mi / 813 ft / 04.21.2025` footer values.
- `electric-atlas`: Claude feedback remediation is ready for review. The live
  render was regenerated at
  `docs/theme_audit_output/poster-themes/print/electric-atlas.png`; capture
  reported `93.5%` pixel, `97.2%` map, `90.8%` chrome, and `100.0%` semantic
  (`113/113`). It now inherits the map-first data chrome with the Boston Marathon
  subtitle, cyan `26.2 mi / 813 ft / 04.21.2025` footer values, magenta slab
  title, and stronger violet topo/grid treatment.
- `splits-stats`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/splits-stats.png`; capture
  reported `80.4%` pixel, `100.0%` map, `80.4%` chrome, and `100.0%` semantic
  (`114/114`). The map-first profile sheet keeps the BOSTON slab, labeled
  elevation profile header and axis, and no generic stats/logo band, now with
  the Hopkinton to Boylston subtitle and `26.2 mi / 813 ft / 04.21.2025`
  footer/profile values.
- `night-ride`: ready for Claude/human review. The live render was written to
  `docs/theme_audit_output/poster-themes/print/night-ride.png`; capture reported
  `75.5%` pixel, `100.0%` map, `75.5%` chrome, and `100.0%` semantic
  (`107/107`). The cyan profile sheet keeps the large MOAB slab, labeled profile
  header and axis, and no generic stats/logo band, now with the Sand Flats
  subtitle and `6.5 mi / 1,100 ft / MAY 2025` footer/profile values.
- `dark-sky`: Claude feedback remediation is ready for review. The live render
  was regenerated at `docs/theme_audit_output/poster-themes/print/dark-sky.png`;
  capture reported `91.6%` pixel, `93.8%` map, `97.4%` chrome, and `100.0%`
  semantic (`107/107`). The regression is addressed with a clean dark map field,
  sparse blue contour treatment, visible starfield and constellation overlay,
  restored gold eyebrow, longer low gold route treatment, and target Sierra /
  `22.0 mi` / `14 SEP 2025` footer values while keeping the generic stats/logo
  band removed.
- `copper-night`: Claude feedback remediation is ready for review after
  strengthening the copper starfield. The live render was regenerated at
  `docs/theme_audit_output/poster-themes/print/copper-night.png`; capture
  reported `93.8%` pixel, `64.6%` map, `98.7%` chrome, and `100.0%` semantic
  (`106/106`). The upper-field star density now reads with the summit
  constellation while preserving the lower soft route, `Tre Cime di Lavaredo`
  subtitle, `ITALIA · 46°38'N` kicker, and Dolomiti / `10.5 km` / `JUL 2025`
  footer values.
- `marathon-bib`: Claude feedback remediation is ready for review. The live
  render was regenerated at
  `docs/theme_audit_output/poster-themes/print/marathon-bib.png`; capture
  reported `84.6%` pixel, `100.0%` map, `84.6%` chrome, and `100.0%` semantic
  (`118/118`). The map-first bib sheet now shows the large navy BOSTON slab,
  pale `2025` ghost numeral behind the title block, red `FINISHER` collar with
  race time, marker-only endpoints, and the `26.2 mi / 813 ft GAIN / 42.3601°N`
  footer while keeping generic stats/logo chrome removed.
- `botanical`: Claude feedback remediation is ready for review. The live render
  was regenerated at `docs/theme_audit_output/poster-themes/print/botanical.png`;
  capture reported `94.7%` pixel, `97.2%` map, `95.6%` chrome, and `100.0%`
  semantic (`109/109`). The plate now uses a pale contour-only field, dark green
  route with round/square marker endpoints, bottom `PLATE IX — ITALIA`
  titleblock, `Dolomiti, Italia / 46.6186°N` captioning, and no generic
  stats/logo footer.
- `relief-shaded`: ready for Claude/human review. The live render was regenerated
  at `docs/theme_audit_output/poster-themes/print/relief-shaded.png`; capture
  reported `94.4%` pixel, `99.9%` map, `93.6%` chrome, and `100.0%` semantic
  (`105/105`). The 09:02 feedback pass is addressed with a pale/smoothed relief
  field, stronger hypsometric bands, black route ink with round/square endpoint
  markers, and a completed cream titleblock carrying the red `WASHINGTON` tag,
  `The Wonderland Trail` subtitle, and `46.8523°N 121.7603°W / 93.0 mi · AUG
  2025` metadata line.
- `cartouche-place`: ready for Claude/human review. The live render was
  regenerated at
  `docs/theme_audit_output/poster-themes/print/cartouche-place.png`; capture
  reported `7.2%` pixel, `35.9%` map, `100.0%` chrome, and `100.0%` semantic
  (`98/98`). Claude feedback is addressed with sampled parchment/ink tokens, a
  centered framed cartouche plate, quiet abstract drafting grid with faint hill
  silhouettes, a clearer neatline, and suppressed literal label clutter.
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
- `sea-chart`: Claude feedback remediation is ready for review. The live render
  was regenerated at `docs/theme_audit_output/poster-themes/print/sea-chart.png`;
  capture reported `95.4%` pixel, `96.2%` map, `100.0%` chrome, and `100.0%`
  semantic (`122/122`). The sampled mint chart field, dense soundings, stronger
  compass/rhumb treatment, double neatline, visible dotted maroon course, chart
  number, and fathoms metadata now pass.
- `field-journal`: ready for Claude/human review. The spec-only queue rerun
  generated `docs/theme_audit_output/poster-themes/print/field-journal.png`;
  capture reported `86.4%` pixel, `77.3%` map, `96.1%` chrome, and `100.0%`
  semantic (`110/110`). Claude feedback is addressed: the generic stats footer
  is hidden, the ruled notes and tipped-in plate treatment are stronger, and the
  drybrush route/specimen caption now pass.
- `transit-diagram`: Claude feedback remediation is ready for review. The
  spec-only capture regenerated
  `docs/theme_audit_output/poster-themes/print/transit-diagram.png`; capture
  reported `91.7%` pixel, `35.0%` map, `91.9%` chrome, and `100.0%` semantic
  (`97/97`). The literal basemap and generic stats footer are suppressed, the
  route renders as a 45/90 schematic, and visible station rings/labels plus the
  mono legend are present; low map smoke reflects intentional abstraction.
- `plein-air`: ready for Claude/human review. The spec-only queue rerun
  generated `docs/theme_audit_output/poster-themes/print/plein-air.png`;
  capture reported `94.8%` pixel, `96.1%` map, `100.0%` chrome, and `100.0%`
  semantic (`107/107`). Claude feedback is addressed: the torn deckle edge now
  renders as four irregular strokes, watercolor palette marks remain visible,
  and the brushed terracotta route/art-wash treatment passes.

## Overnight Queue Summary

- `ready-for-review`: 27
- `blocked`: 0
- `unchanged`: 0

## Next Steps

1. Get human visual approval or requested corrections for `sea-chart`,
   `usgs-vintage`, `classic-trail`, `risograph`, `brutalist`, and the
   travel-banner family.
2. Continue one theme at a time, using the token contract as the gate and the
   contact sheet as required visual review.
