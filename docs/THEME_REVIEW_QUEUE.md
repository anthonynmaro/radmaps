# Theme Review Queue

This file is the Codex-to-Claude handoff for the theme parity overnight loop.
Statuses here are limited to `ready-for-review`, `blocked`, or `unchanged`.
Codex never marks a theme `approved`.

| Theme | Status | Semantic | Live render | Self-assessment |
|---|---|---:|---|---|
| `usgs-vintage` | `ready-for-review` | 100.0% (`115/115`) | `docs/theme_audit_output/poster-themes/print/usgs-vintage.png` | Full quad treatment is token-aligned; watch chrome pixel score because geometry differs, but semantic gate is clean. |
| `classic-trail` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/classic-trail.png` | Slate park-quad colorway is aligned to the strengthened USGS contract; watch lower chrome score as non-gating geometry/chrome smoke only. |
| `midcentury-travel` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/midcentury-travel.png` | Travel-banner tokens and sun motif pass; watch overall/chrome smoke score because screenshot balance may need vision review. |
| `ranch-ochre` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/ranch-ochre.png` | Ochre travel-banner colorway inherits the parent motif and passes tokens; watch map/chrome smoke because the target terrain differs. |
| `daybreak-trace` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/daybreak-trace.png` | Dawn travel-banner tokens and sun motif pass; watch chrome balance in Claude review because smoke score is low. |
| `risograph` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/risograph.png` | Claude feedback addressed: sampled warm paper, bolder fluoro-pink route, and visible blue misregistration offset now pass; watch chrome smoke against the large target PNG. |
| `brutalist` | `ready-for-review` | 100.0% (`96/96`) | `docs/theme_audit_output/poster-themes/print/brutalist.png` | Slab grid, registration marks, framed map, and orange route are present; watch low map smoke because dynamic Boston geometry diverges strongly from target. |
| `editorial-minimal` | `ready-for-review` | 100.0% (`100/100`) | `docs/theme_audit_output/poster-themes/print/editorial-minimal.png` | Claude feedback addressed: bottom-left gallery title, hidden stats footer, quieter sparse contours, and square route endpoints now pass. |
| `contour-wash` | `ready-for-review` | 100.0% (`99/99`) | `docs/theme_audit_output/poster-themes/print/contour-wash.png` | Full-bleed wash field, centered caption, and echo route treatment pass; watch lower map smoke from dynamic contour geometry. |
| `bold-modern` | `ready-for-review` | 100.0% (`97/97`) | `docs/theme_audit_output/poster-themes/print/bold-modern.png` | Modernist block tokens, accent slab, and print-trap route layers pass; watch low map smoke from dynamic map geometry. |
| `blackline` | `ready-for-review` | 100.0% (`101/101`) | `docs/theme_audit_output/poster-themes/print/blackline.png` | Mono modernist colorway and black route treatment pass; watch very low map smoke from dynamic fixture mismatch. |
| `blueprint` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/blueprint.png` | Existing manifest review state left untouched; overnight live capture confirms drafting tokens, grid, titleblock, and yellow route still pass. |
| `moonstone` | `ready-for-review` | 100.0% (`108/108`) | `docs/theme_audit_output/poster-themes/print/moonstone.png` | Claude feedback addressed: generic stats band replaced with DIST/GAIN/DATE metric footer, Dolomiti subtitle restored, and drafting labels/grid/neatline/etched route still pass. |
| `blueprint-strava` | `ready-for-review` | 100.0% (`109/109`) | `docs/theme_audit_output/poster-themes/print/blueprint-strava.png` | Claude footer nit addressed: map-first technical sheet keeps the large BOSTON slab and FIG. 01 label, now with Boston Marathon subtitle and 26.2 mi / 813 ft / 04.21.2025 footer values. |
| `electric-atlas` | `ready-for-review` | 100.0% (`113/113`) | `docs/theme_audit_output/poster-themes/print/electric-atlas.png` | Claude footer nit addressed: inherited map-first data chrome, magenta slab title, Boston Marathon subtitle, cyan 26.2 mi / 813 ft / 04.21.2025 footer values, and violet topo/grid pass. |
| `splits-stats` | `ready-for-review` | 100.0% (`114/114`) | `docs/theme_audit_output/poster-themes/print/splits-stats.png` | Claude footer nit addressed: map-first profile sheet keeps the BOSTON slab, labeled profile, START/HIGH POINT/FINISH axis, and now uses Hopkinton→Boylston plus 26.2 mi / 813 ft / 04.21.2025 values. |
| `night-ride` | `ready-for-review` | 100.0% (`107/107`) | `docs/theme_audit_output/poster-themes/print/night-ride.png` | Claude feedback addressed: cyan profile sheet keeps the large MOAB slab, labeled profile and axis, and now uses Sand Flats / 6.5 mi / 1,100 ft / MAY 2025 values. |
| `dark-sky` | `ready-for-review` | 100.0% (`107/107`) | `docs/theme_audit_output/poster-themes/print/dark-sky.png` | Claude regression addressed: clean dark field with sparse blue contours, visible starfield/constellation above the title, longer low gold route, and Sierra / 22.0 mi / 14 SEP 2025 footer values now pass. |
| `copper-night` | `ready-for-review` | 100.0% (`106/106`) | `docs/theme_audit_output/poster-themes/print/copper-night.png` | Claude feedback addressed: clean brown field with faint contours, visible starfield/summit constellation, lower copper route fixture, and Dolomiti / 10.5 km / JUL 2025 footer values now pass. |
| `marathon-bib` | `ready-for-review` | 100.0% (`118/118`) | `docs/theme_audit_output/poster-themes/print/marathon-bib.png` | Claude feedback addressed: map-first bib sheet now has the large navy BOSTON slab, pale 2025 ghost, red FINISHER collar, marker-only endpoints, and 26.2 mi / 813 ft GAIN / 42.3601°N footer. |
| `botanical` | `ready-for-review` | 100.0% (`109/109`) | `docs/theme_audit_output/poster-themes/print/botanical.png` | Claude feedback addressed: pale contour-only field, dark green route with round/square endpoint markers, bottom `PLATE IX — ITALIA` titleblock, coordinate caption, and no generic stats/logo footer. |
| `relief-shaded` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/relief-shaded.png` | Map-first terrain sheet now uses bottom Newsreader titleblock, black/cream relief route ink, target Rainier activity values, and no generic stats/logo footer; watch dense real-terrain map smoke. |
| `cartouche-place` | `ready-for-review` | 100.0% (`90/90`) | `docs/theme_audit_output/poster-themes/print/cartouche-place.png` | Place-frame poster now omits the GPX route, centers the cartouche plate, shows the red México kicker plus coordinate/elevation footer, and passes the no-route engraved-map contract; watch live map label geometry in visual review. |
| `sea-chart` | `unchanged` | n/a | n/a | Already near-ready from previous checkpoint; will rerun only if queue/shared changes affect it. |
| `field-journal` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `transit-diagram` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `plein-air` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |

## Summary

- `ready-for-review`: 23
- `blocked`: 0
- `unchanged`: 4
