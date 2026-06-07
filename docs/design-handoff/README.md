# RadMaps Design Handoff Kit

This kit is for handing the RadMaps poster theme system to Claude Design, or any
external design reviewer, and getting implementable feedback back into Codex.

## What To Send

Send these files:

- `docs/design-handoff/CLAUDE_DESIGN_PROMPT.md`
- `docs/design-handoff/THEME_INVENTORY.md`
- `docs/design-handoff/CAPTURE_URLS.md`
- `docs/design-handoff/RESPONSE_SCHEMA.json`
- `docs/POSTER_THEME_REFINEMENT_REVIEW.md`
- `docs/POSTER_CONTENT_EDITOR.md`
- Theme screenshots or contact sheets from the local app

Do not expect Claude Design to open `localhost` unless you are using a browser
inside the same machine/session. The safest handoff is screenshots plus the
markdown context in this kit.

## Exact Handoff Workflow

1. Open the local review app:
   `http://localhost:3003/style-browser-fixture?surface=1&theme=cartouche-place&composition=place-frame&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820`

   If Nuxt starts on a different port, keep the same path and query string and
   replace only the port.

2. Capture screenshots for the poster themes and the Beta owned map themes.
   Prefer the repeatable audit command:

   ```bash
   npm run themes:capture-audit -- --base-url=http://localhost:3003 --out=/tmp/radmaps-theme-audit
   ```

   If Nuxt starts on a different port, change only `--base-url`. The command
   writes poster and owned-map contact sheets plus individual PNG crops. Use the
   URL recipes in `CAPTURE_URLS.md` for any manual close crops.

3. Upload the screenshots/contact sheets and the markdown files listed above to
   Claude Design.

4. Paste the full contents of `CLAUDE_DESIGN_PROMPT.md`.

5. Ask Claude Design to return feedback as JSON matching
   `RESPONSE_SCHEMA.json`.

6. Bring the JSON response back to Codex with:
   "Implement this Claude Design feedback. Preserve the RadMaps renderer and
   style graph constraints."

7. Codex should implement in the existing files:
   - `utils/themes/refined.ts`
   - `utils/posterData.ts`
   - `utils/themeOptions.ts`
   - `components/map/MapPreview.vue`
   - `components/map/StylePanel.vue`
   - related tests and docs

## Guardrails For Reviewers

- RadMaps sells 2:3 posters only.
- `MapPreview.vue` is the only poster renderer.
- Refined poster themes live in `utils/themes/refined.ts`.
- Poster composition routing lives in `utils/posterCompositions.ts`.
- Theme typography profiles live in `utils/posterData.ts`.
- Theme picker metadata lives in `utils/themeOptions.ts`.
- Owned/Beta map styles are map presets, not full poster themes.
- Do not propose external assets, remote font dependencies, or a separate
  screenshot/render path.
- Feedback should be specific enough to implement as theme recipe, typography,
  palette, layout, map-default, or thumbnail changes.
