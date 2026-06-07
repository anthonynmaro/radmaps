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
| `risograph` | `ready-for-review` | 100.0% (`103/103`) | `docs/theme_audit_output/poster-themes/print/risograph.png` | Riso contour plate, overprint route, paper grain, and title offset are visible; watch low chrome smoke against the large target PNG. |
| `brutalist` | `ready-for-review` | 100.0% (`96/96`) | `docs/theme_audit_output/poster-themes/print/brutalist.png` | Slab grid, registration marks, framed map, and orange route are present; watch low map smoke because dynamic Boston geometry diverges strongly from target. |
| `editorial-minimal` | `ready-for-review` | 100.0% (`100/100`) | `docs/theme_audit_output/poster-themes/print/editorial-minimal.png` | Claude feedback addressed: bottom-left gallery title, hidden stats footer, quieter sparse contours, and square route endpoints now pass. |
| `contour-wash` | `ready-for-review` | 100.0% (`99/99`) | `docs/theme_audit_output/poster-themes/print/contour-wash.png` | Full-bleed wash field, centered caption, and echo route treatment pass; watch lower map smoke from dynamic contour geometry. |
| `bold-modern` | `ready-for-review` | 100.0% (`97/97`) | `docs/theme_audit_output/poster-themes/print/bold-modern.png` | Modernist block tokens, accent slab, and print-trap route layers pass; watch low map smoke from dynamic map geometry. |
| `blackline` | `ready-for-review` | 100.0% (`101/101`) | `docs/theme_audit_output/poster-themes/print/blackline.png` | Mono modernist colorway and black route treatment pass; watch very low map smoke from dynamic fixture mismatch. |
| `blueprint` | `ready-for-review` | 100.0% (`105/105`) | `docs/theme_audit_output/poster-themes/print/blueprint.png` | Existing manifest review state left untouched; overnight live capture confirms drafting tokens, grid, titleblock, and yellow route still pass. |
| `moonstone` | `ready-for-review` | 100.0% (`102/102`) | `docs/theme_audit_output/poster-themes/print/moonstone.png` | Cool-paper blueprint colorway, map grid, and etched route treatment pass; watch low map smoke from fixture geometry. |
| `blueprint-strava` | `ready-for-review` | 100.0% (`103/103`) | `docs/theme_audit_output/poster-themes/print/blueprint-strava.png` | Technical data composition, map grid, restrained contours, and green GPX route pass; watch chrome smoke for data-band balance. |
| `electric-atlas` | `ready-for-review` | 100.0% (`106/106`) | `docs/theme_audit_output/poster-themes/print/electric-atlas.png` | Neon technical map, magenta glow route, grid density, trace motif, and chip motif all pass. |
| `splits-stats` | `ready-for-review` | 100.0% (`104/104`) | `docs/theme_audit_output/poster-themes/print/splits-stats.png` | Full-width dark map, elevation profile band, stats footer, and orange performance route layers pass; watch chrome smoke for data-band balance. |
| `night-ride` | `ready-for-review` | 100.0% (`97/97`) | `docs/theme_audit_output/poster-themes/print/night-ride.png` | Cyan night profile colorway, dark topo field, profile band, and performance route layers pass; map smoke is zero due to reference/live terrain mismatch. |
| `dark-sky` | `ready-for-review` | 100.0% (`103/103`) | `docs/theme_audit_output/poster-themes/print/dark-sky.png` | Claude feedback addressed: large top Cormorant sky title, visible star field, hidden generic footer, sparse contours, and gold route now pass. |
| `copper-night` | `ready-for-review` | 100.0% (`102/102`) | `docs/theme_audit_output/poster-themes/print/copper-night.png` | Claude feedback addressed by porting the dark-sky composition: large top Cormorant title, visible stars, hidden generic footer, and warm contour route treatment pass. |
| `marathon-bib` | `ready-for-review` | 100.0% (`103/103`) | `docs/theme_audit_output/poster-themes/print/marathon-bib.png` | Bib paper, ghost numeral motif, race collar, red route, and map tokens pass; watch low map smoke from fixture mismatch. |
| `botanical` | `ready-for-review` | 100.0% (`101/101`) | `docs/theme_audit_output/poster-themes/print/botanical.png` | Plate frame, ornamental corners, specimen caption, natural map tokens, and green route treatment pass. |
| `relief-shaded` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `cartouche-place` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `sea-chart` | `unchanged` | n/a | n/a | Already near-ready from previous checkpoint; will rerun only if queue/shared changes affect it. |
| `field-journal` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `transit-diagram` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `plein-air` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |

## Summary

- `ready-for-review`: 21
- `blocked`: 0
- `unchanged`: 6
