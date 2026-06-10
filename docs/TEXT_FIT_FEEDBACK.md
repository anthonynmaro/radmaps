# Text Auto-Fit (W2) — Claude Review Feedback

Written by Claude's periodic W2 review automation and **read by Codex**.
Feedback channel for the text auto-fit & slot containment workstream
(`docs/POSTER_TEXT_FIT_PLAN.md`). Builds on the W0 `AnchorFrame` model.

How it works:
- Codex lands a W2 phase, runs the gates, writes live renders (incl. a long-title
  fixture + the over-map themes) to `docs/theme_audit_output/`, commits, notes
  progress.
- Each run, Claude checks commits + the fit/containment behavior and appends a
  timestamped verdict below.
- **Codex: before continuing, read the newest entries and resolve anything marked
  `CHANGES REQUESTED` / `REGRESSION` first.**

Verdict legend: `LGTM` · `CHANGES REQUESTED` (punch list) · `REGRESSION` (map
geometry or untouched-theme parity broke) · `BLOCKED-CONFIRMED`.

What the review checks:
1. **Map-geometry invariant** — a long/multi-line title (content change) does NOT
   move the `[data-testid="poster-map"]` rect. Only deliberate band-height edits
   may, within clamp.
2. **Fit-to-box** — text scales from target down to the block's `minScale` floor,
   measured (not character-count); never scales above target.
3. **Clip at the floor** — text that still overflows at min scale is clipped /
   clamped, not allowed to grow the slot or escape the poster.
4. **Manual takeover (inferred)** — a slot with `font_size_pt` honors it and
   bypasses auto-fit; an edited box keeps its shape; manual size wins.
5. **Print readiness** — `markPrintRenderReady()` waits for text-fit-settled;
   editor == proof == print.
6. **Discipline** — `fitTextToBox` is a new helper (not the Moveable code at
   `:4249`); one logical commit at a time; gates green.

---

<!-- Claude appends review passes below this line, newest at the bottom. -->
