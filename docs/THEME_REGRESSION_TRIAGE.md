# Theme Regression Triage

Date: June 8, 2026
Symptom (Anthony): "a LOT of issues — autosizing not working, many layouts off,
typography slipped" across the refined themes.

## Root cause of the blind spot

- **24 of 27 theme audit renders are stale** (dated June 7, *before* the anchor
  `a61e067` and text-fit `c89b2a3`/`fc1644d` commits). Only `copper-night`,
  `contour-wash`, `sea-chart` were re-rendered after. So every review since W2
  (incl. LGTMs) read old images — nobody has seen 24/27 themes through current code.
- **Golden parity 0px/54 gave false confidence.** It proves *stability vs a
  baseline*, not *fidelity to the design*. If the baseline was captured from the
  post-text-fit code, the themes can be broadly shifted from the targets and the
  gate stays green ("stably wrong").

## Leading hypothesis

W2 (text-fit) replaced the **hand-tuned per-theme title sizing** (built up across
the whole parity effort) with a generic measured fit. Likely bug: `fitTextToBox`
scales normal-length titles **down even when they fit**, instead of only shrinking
on overflow. Result reads as "autosizing not working / type slipped / layouts off."
Check first: the fit **target must be each theme's authored title size**, and the
helper must only scale **down on overflow**, never below the floor, never shrink a
title that already fits.

## Triage steps (Codex)

1. **Regenerate ALL 27 themes at BOTH editor and print geometry** through current
   HEAD into `docs/theme_audit_output/poster-themes/{editor,print}/` (overwrite the
   stale renders). This is the prerequisite — current state is invisible right now.
2. **Diff current HEAD vs last-known-good `8054196`** (the last `refined()` theme
   commit before anchor/text-fit). Produce a per-theme before/after so the *actual*
   regression surface is visible — not a diff against a moving baseline.
3. **Attribute by commit range** — capture the same themes at `8054196` (pre),
   `a61e067` (post-anchor), `caa2db7` (post-text-fit), `f83120d` (post-editor) — to
   pin which change introduced autosizing vs layout vs typography drift.
4. **Confirm/fix the fit target rule** (hypothesis above): target = authored theme
   title size; scale down only on overflow; floors per block kind; a title that
   fits renders at authored size. Re-tune per-theme target sizes if W2 generalized
   them away.
5. Do **not** trust 0px golden vs the current baseline. Re-anchor verification to
   (a) `8054196` known-good and (b) the design targets in `docs/theme_screenshots`,
   at **editor and print** geometry.

## Claude (vision) diagnosis — after step 1

Once fresh renders exist, Claude compares all 27 current renders to
`docs/theme_screenshots/<name>.png` and writes a per-theme punch list
(autosizing / layout / typography drift, ranked) to `docs/THEME_REGRESSION_FEEDBACK.md`.
This is the gate that was missing — fidelity to the design, not stability vs a baseline.

## The goal / Codex prompt (paste this)

> Theme regression triage per `docs/THEME_REGRESSION_TRIAGE.md`. The refined themes
> have autosizing/layout/typography regressions, and the committed renders are stale
> (24/27 predate the anchor + text-fit commits), so first make current state visible:
> regenerate ALL 27 themes at BOTH editor and print geometry through current HEAD into
> `docs/theme_audit_output/poster-themes/{editor,print}/`. Then diff current HEAD vs
> the last-known-good `8054196` per theme, and capture the same themes at `8054196`,
> `a61e067` (post-anchor), `caa2db7` (post-text-fit), `f83120d` (post-editor) to
> attribute each regression to a commit range. Investigate the leading hypothesis:
> `fitTextToBox` is shrinking normal titles that already fit — the fit target must be
> each theme's **authored** title size, scaling down ONLY on overflow, never below the
> per-block floor, never shrinking a title that fits. Re-tune per-theme target sizes if
> W2 generalized the hand-tuned values away. Do NOT rely on 0px golden parity vs the
> current baseline (it measures stability, not fidelity) — re-anchor to `8054196` and
> the design targets in `docs/theme_screenshots`. A Claude review will diagnose the
> fresh renders against the targets and write per-theme punch lists to
> `docs/THEME_REGRESSION_FEEDBACK.md`; read it before fixing. Fix one theme/cause per
> commit; gates green (`npx vue-tsc`, `npm run test:style-graph`, focused Playwright);
> clean worktree; `MapPreview.vue` stays the only renderer.
