# Theme Feedback — Round 2 (human review handoff)

Handoff doc for Codex after Anthony's review of the live themes: **per-theme
design feedback**. (The title/text-sizing bug is tracked separately in
`docs/POSTER_TEXT_FIT_PLAN.md`.) Same rules as the overnight run: one theme/fix per commit,
clean worktree, never proceed on red, never mark `approved`, regenerate the live
render into `docs/theme_audit_output/` after each change.

## How this doc is used

For each theme, Anthony's raw notes get translated into **implementable items**
in this format:

> **[priority] what's wrong → the specific token / contract / composition / file
> to change.**

Priorities: **P0** = functional bug, **P1** = clearly off vs design, **P2** = polish.

---

## Title/text sizing bug — moved to its own initiative

The title auto-fit / overflow / un-editable-size bug is **not** part of
theme review. It is scoped separately in [`docs/POSTER_TEXT_FIT_PLAN.md`](./POSTER_TEXT_FIT_PLAN.md) — auto-fit
down to a per-theme floor, bounded slot regions, clip-to-preserve-layout,
and manual takeover. Track it there, not here.

---

## Per-theme design feedback

Current vision status carried over from `THEME_PARITY_FEEDBACK.md` is noted per
theme. Anthony adds notes under each; I convert them to implementable items.

> Paste your raw notes per theme however rough — I'll translate each into the
> `[priority] problem → token/area` format and fill the "Items" lines.

### Gallery / heritage
- **editorial-minimal** — status: LGTM. Items: _(awaiting notes)_
- **usgs-vintage** — status: LGTM (nit: contours a touch cool/grey vs target brown). Items: _(awaiting notes)_
- **classic-trail** — status: LGTM (nit: contours fainter/sparser than parent). Items: _(awaiting notes)_
- **field-journal** — status: LGTM (spec). Items: _(awaiting notes)_
- **botanical** — status: LGTM. Items: _(awaiting notes)_
- **cartouche-place** — status: LGTM. Items: _(awaiting notes)_
- **relief-shaded** — status: LGTM. Items: _(awaiting notes)_

### Expressive / rad
- **midcentury-travel** — status: LGTM. Items: _(awaiting notes)_
- **ranch-ochre** — status: LGTM (paper was too light/cool — confirm fixed). Items: _(awaiting notes)_
- **daybreak-trace** — status: LGTM. Items: _(awaiting notes)_
- **risograph** — status: LGTM (paper too light earlier; route duotone). Items: _(awaiting notes)_
- **electric-atlas** — status: LGTM. Items: _(awaiting notes)_
- **sea-chart** — status: LGTM (nit: compass rose should be magenta, not grey). Items: _(awaiting notes)_
- **plein-air** — status: LGTM (spec). Items: _(awaiting notes)_

### Professional / wall-art
- **bold-modern** — status: LGTM. Items: _(awaiting notes)_
- **blackline** — status: LGTM. Items: _(awaiting notes)_
- **blueprint** — status: LGTM (nit: title weight a touch heavy). Items: _(awaiting notes)_
- **moonstone** — status: LGTM. Items: _(awaiting notes)_
- **contour-wash** — status: **CHANGES REQUESTED** — mottled wash instead of crisp concentric contour lines; thin dark echo route missing; add top eyebrow. Items: _(awaiting notes)_
- **transit-diagram** — status: LGTM (spec). Items: _(awaiting notes)_

### Data / performance / atmospheric
- **splits-stats** — status: LGTM. Items: _(awaiting notes)_
- **night-ride** — status: LGTM. Items: _(awaiting notes)_
- **blueprint-strava** — status: LGTM. Items: _(awaiting notes)_
- **marathon-bib** — status: LGTM. Items: _(awaiting notes)_
- **dark-sky** — status: LGTM (reference fix). Items: _(awaiting notes)_
- **copper-night** — status: LGTM (nit: stars read cream vs target's warmer copper). Items: _(awaiting notes)_
- **brutalist** — status: LGTM (nit: title could crop harder at the edge). Items: _(awaiting notes)_
