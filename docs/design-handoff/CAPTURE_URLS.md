# Capture URLs

Use these URLs in the local app to capture theme screenshots for Claude Design.

The current local review server is verified at:

`http://localhost:3003`

If Nuxt prints a different port, keep the same paths and query strings and
replace only the port.

For the standard full audit, use the capture command instead of manual browser
screenshots:

```bash
npm run themes:capture-audit -- --base-url=http://localhost:3003 --out=/tmp/radmaps-theme-audit
```

The command waits for the map band to paint before screenshotting, which is
important for slower owned art-tile presets such as `radmaps-watercolor`. For
poster themes it now writes a triptych contact sheet with the standalone HTML
reference, the live editor fixture, and live final-print mode.

## Base Review URL

```text
http://localhost:3003/style-browser-fixture?surface=1&theme=cartouche-place&composition=place-frame&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

## Poster Theme URL Template

```text
http://localhost:3003/style-browser-fixture?surface=1&theme=<theme_id>&composition=<composition_id>&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

Example:

```text
http://localhost:3003/style-browser-fixture?surface=1&theme=editorial-minimal&composition=editorial-tall&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

## Owned/Beta Map Preset URL Template

Use a neutral poster theme and swap the map preset:

```text
http://localhost:3003/style-browser-fixture?surface=1&theme=editorial-minimal&composition=editorial-tall&preset=<preset_id>&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

Example:

```text
http://localhost:3003/style-browser-fixture?surface=1&theme=editorial-minimal&composition=editorial-tall&preset=radmaps-watercolor&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

## Recommended Capture Set

Capture at least:

- One desktop screenshot for every poster theme.
- One screenshot for every owned/Beta map preset.
- A mobile-ish crop or narrow viewport for 5-7 highest-risk themes.
- Close crops for title band, map body, and footer for any theme with typography
  concerns.
- A colorway pass for the seven colorways listed in `THEME_INVENTORY.md`, so
  Claude Design can judge whether they should remain visible as distinct picks
  or be grouped under their parent anchors.

Use the theme inventory to pair each theme with its intended composition.
