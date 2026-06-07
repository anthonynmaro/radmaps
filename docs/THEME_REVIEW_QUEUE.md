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
| `editorial-minimal` | `ready-for-review` | 100.0% (`92/92`) | `docs/theme_audit_output/poster-themes/print/editorial-minimal.png` | Editorial-tall palette, typography, and gallery route tokens pass; watch lower map smoke from fixture terrain differences. |
| `contour-wash` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `bold-modern` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `blackline` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `blueprint` | `unchanged` | n/a | n/a | Existing manifest review state left untouched per guardrail. |
| `moonstone` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `blueprint-strava` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `electric-atlas` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `splits-stats` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `night-ride` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `dark-sky` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `copper-night` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `marathon-bib` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `botanical` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `relief-shaded` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `cartouche-place` | `unchanged` | n/a | n/a | Awaiting queue pass. |
| `sea-chart` | `unchanged` | n/a | n/a | Already near-ready from previous checkpoint; will rerun only if queue/shared changes affect it. |
| `field-journal` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `transit-diagram` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |
| `plein-air` | `unchanged` | n/a | n/a | Awaiting spec-only queue pass. |

## Summary

- `ready-for-review`: 8
- `blocked`: 0
- `unchanged`: 19
