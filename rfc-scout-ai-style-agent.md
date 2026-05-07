# RFC: Scout — AI Style Agent Chat Panel

**Status:** Proposed · **Author:** Anthony · **Date:** 2026-05-07

---

## Summary

Add an AI-powered chat panel called **Scout** to the admin premade style editor. Scout is a friendly map design assistant that can read the current map context (route, geography, existing style) and have a conversation with the admin to dial in styling. Admins can give natural-language instructions like "use the Chicago city flag colors" or "make this feel more vintage" and Scout will translate those into StyleConfig updates applied live on the map preview.

For the initial release, Scout is gated behind `FLAGS.SCOUT_STYLE_AGENT` from `utils/knownFlags.ts` (key: `scout_style_agent`). The flag is environment-scoped and targeted to admin and designer roles. On the client, the Scout tab is hidden unless `useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)` resolves true via the Nuxt server-prefetched flag state — no layout shift on hydration. On the server, `/api/agent/style` returns 404 after auth succeeds when the flag is off, so the endpoint doesn't acknowledge its existence to ungated users.

The existing `useStyleAgent` composable and `/api/agent/style` endpoint provide a working foundation — this RFC covers upgrading them into a proper chat panel experience.

---

## Naming

**Scout** — a friendly trail companion who helps you find the right path. Fits the outdoor/maps domain without being too literal. Short, memorable, easy to say in conversation ("ask Scout to try a darker palette").

Alternative names considered: Ranger, Guide, Trailblazer. Scout won over Ranger (too authoritative) and Guide (too generic).

---

## Goals

1. A persistent chat panel on the admin style page where admins can collaborate with Scout to tune StyleConfig
2. Real-time style updates — when Scout makes a change, the map preview updates live
3. Context-aware — Scout knows the route stats, geographic region, current style state, and available themes/presets
4. Undo-friendly — all Scout changes flow through the existing undo/redo history
5. Admin-only for now, gated by feature flag (see companion RFC)

## Non-Goals (v1)

- User-facing (public) access — future work after the feature flag system is in place
- Image generation or preview rendering from within the chat
- Multi-turn memory across sessions (each chat is ephemeral)
- Voice input

---

## Architecture

### UI: New Tab in StylePanel

Add a 5th tab to the existing `StylePanel.vue` tab bar:

```
Quick | Map | Style | Text | Scout ✨
```

The Scout tab renders a `ScoutChat.vue` component with:

- **Message list** — scrollable chat history with assistant/user messages. Assistant messages rendered as Markdown (bold, lists, emoji). Visual distinction between text messages and "style applied" action cards.
- **Input bar** — text input pinned to the bottom with send button. Supports Enter-to-send, Shift+Enter for newline.
- **Thinking indicator** — animated dots or shimmer when Scout is processing.
- **Action cards** — when Scout applies a style change, show a compact card: "Applied: obsidian theme, contour-art preset" with a small undo button that reverts just that change.
- **Quick prompts** — on first open (empty chat), show 3-4 suggestion chips: "Design something bold", "Match the local geography", "Try a vintage poster look", "Surprise me".

The tab is only rendered when the `scout_style_agent` feature flag is enabled for the current user. The flag is resolved server-side via the Nuxt feature flag plugin and hydrated into `useState`, so the tab bar renders correctly on first paint with no flash. When the flag is off, the tab simply doesn't appear — no empty state or "coming soon" needed.

### Conditional Tab Rendering

```vue
<!-- In StylePanel.vue -->
<button
  v-for="t in visibleTabs"
  :key="t.id"
  ...
>{{ t.label }}</button>
```

```ts
import { FLAGS } from '~/utils/knownFlags'

const scoutEnabled = useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)

const visibleTabs = computed(() => {
  const base = TABS // Quick, Map, Style, Text
  return scoutEnabled.value
    ? [...base, { id: 'scout', label: 'Scout ✨' }]
    : base
})
```

Use the typed constant from `utils/knownFlags.ts` rather than a string literal to prevent typos and make flag references greppable across the codebase.

### Component: `components/map/ScoutChat.vue`

Props:
- `styleConfig: StyleConfig` — current style (read)
- `routeStats: RouteStats` — route context
- `mapTitle: string` — map/premade title
- `mapRegion?: string` — geographic region
- `mapCategory?: PremadeCategory` — premade category

Events:
- `@update:style` — emits `Partial<StyleConfig>` when Scout applies changes
- `@reset` — emits when Scout suggests starting over

Internal state managed by a new `useScout()` composable (upgraded `useStyleAgent`).

### Composable: `composables/useScout.ts`

Replaces/upgrades `useStyleAgent.ts`. Key changes from the existing composable:

1. **Richer context in system prompt** — includes map title, region, category, geographic description (derived from bbox → reverse geocode), current theme name, and full StyleConfig.

2. **Multi-tool support** — beyond `update_style`, add:
   - `get_available_themes` — returns the list of 18 color themes with descriptions so Scout can recommend by name
   - `get_available_presets` — returns the 12 style presets
   - `get_current_style` — returns the current full StyleConfig (for when the conversation is long and context has drifted)
   - `preview_change` — describes what a change would look like without applying it (for "what if I..." questions)

3. **No rigid step sequence** — the existing agent walks through preset → colors → typography → labels → border → confirm. Scout should be freeform. The admin might say "just make the route thicker" without going through any steps. Remove the step-tracking logic.

4. **Streaming with partial rendering** — stream assistant text token-by-token into the chat so it feels responsive. The existing SSE infrastructure supports this.

5. **Style diff display** — when `update_style` is called, compute a human-readable diff of what changed and display it as an action card.

```ts
export function useScout(
  styleConfig: Ref<StyleConfig>,
  context: {
    routeStats: Ref<RouteStats>
    title: string
    region?: string
    category?: string
  },
) {
  const messages = ref<ScoutMessage[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  function sendMessage(text: string): Promise<void> { /* ... */ }
  function applyStyleUpdate(updates: Partial<StyleConfig>): void { /* ... */ }
  function undoLastChange(): void { /* ... */ }
  function reset(): void { /* ... */ }

  return { messages, isStreaming, error, sendMessage, undoLastChange, reset }
}
```

### API Endpoint: `/api/agent/style` (POST) — Upgraded

We upgrade the existing `/api/agent/style` endpoint in place rather than creating a new route. Key changes:

1. **Auth + flag gate** — requires `requireStaff(event)` first (existing auth check), then `isFeatureEnabled(event, FLAGS.SCOUT_STYLE_AGENT, { staffSession })`. If the flag is off, return **404** (not 403) so the endpoint doesn't reveal its existence to ungated users. The staff session is passed to `isFeatureEnabled` to avoid a redundant DB lookup.

2. **Richer system prompt** — the existing prompt is good but too rigid (step-by-step flow). The new prompt should:
   - Describe Scout's personality (friendly, opinionated about design, uses trail/outdoor metaphors)
   - List ALL StyleConfig fields it can modify with valid enum values
   - Include the sanitization rules inline so it doesn't emit invalid values
   - Provide geographic context so it can make location-aware suggestions
   - Explain the available themes and presets by name

3. **Tool definitions** — expanded set (see composable section above)

4. **Model** — `claude-sonnet-4-6` (same as current). Consider upgrading to Opus for especially complex styling requests, but Sonnet is fast and good enough for v1.

5. **Max tokens** — increase to 2048 (from 1024) to allow more detailed design explanations.

6. **Streaming** — keep SSE format, same as current.

Request body:
```ts
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  style_config: StyleConfig
  route_stats: RouteStats
  map_context: {
    title: string
    region?: string
    category?: string
    bbox: [number, number, number, number]
  }
}
```

### System Prompt (Draft)

```
You are Scout, a friendly and opinionated trail map design assistant for RadMaps.
You help admins create beautiful, print-ready trail map posters.

Your personality:
- Warm and enthusiastic about maps and the outdoors
- You have strong design opinions but defer to the user's taste
- You use trail/outdoor metaphors naturally ("let's blaze a new trail with this palette")
- You're concise — 2-3 sentences per response unless explaining a design concept
- When you make a change, briefly explain WHY it works

You have deep knowledge of:
- Color theory for cartography and poster design
- Typography pairing for outdoor/adventure brands
- How different map styles (topo, minimalist, route-only) work for different routes
- Geographic and cultural context — you can suggest styles that match a region's character

Available tools:
- update_style: Apply StyleConfig changes to the live map preview
- get_available_themes: List all 18 color themes with their visual character
- get_available_presets: List all 12 style presets

RULES:
- Always emit an update_style call when the user asks for a change
- Never suggest colors that make text unreadable against the background
- When suggesting themes, use their names (e.g., "obsidian", "editorial", "mid-century")
- For enum fields, ONLY use exact valid values: [list of all enums...]
- Keep numeric values in valid ranges: route_width 1-12, padding_factor 0.05-0.30, etc.
```

---

## Data Model Changes

No new database tables needed. Scout operates entirely on the in-memory StyleConfig and uses the existing save flow.

New types to add to `types/index.ts`:

```ts
export interface ScoutMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  styleUpdate?: Partial<StyleConfig>  // if this message included a style change
  timestamp: number
}
```

---

## Rollout Plan

**Prerequisite:** The feature flags system must be deployed and the `scout_style_agent` flag seeded (see Feature Flags RFC, Steps 1-4) before Scout work begins.

### Phase 1: Core Chat (1-2 weeks)
- Create `ScoutChat.vue` component
- Create `useScout.ts` composable
- Upgrade `/api/agent/style` endpoint with `requireStaff` + `isFeatureEnabled` gate
- Add Scout tab to StylePanel, conditionally rendered via `useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)`
- Wire up streaming + style updates
- Verify both gates: tab hidden when flag off, API returns 404 when flag off

### Phase 2: Polish (1 week)
- Quick-prompt suggestion chips
- Action cards for style changes with inline undo
- Markdown rendering in messages
- Thinking/streaming animation
- Error states and retry

### Phase 3: Smarter Context (future)
- Reverse geocode bbox to give Scout geographic context ("this route is in the Swiss Alps")
- Let Scout reference the map's elevation profile, terrain type
- "Style like [other premade map]" — reference existing maps in the catalog
- Suggested follow-up prompts after each Scout response

### Phase 4: User-Facing (future)
- Add `percentage` rule to `scout_style_agent` flag for gradual rollout
- Rate limiting per user
- Usage tracking / cost monitoring
- Simpler UX for non-admin users (fewer knobs exposed)

## Testing Requirements

- **Flag off, tab hidden:** With `scout_style_agent` disabled, the Scout tab must not appear in StylePanel for any user or role.
- **Flag off, API blocked:** `POST /api/agent/style` returns 404 for staff users when the flag is off (after auth succeeds).
- **Flag on, role-gated:** With the flag enabled for admin and designer roles, verify curator and support roles do not see the tab or get API access.
- **Non-staff blocked:** Non-staff users never see the tab and get 401 from the API regardless of flag state. The existing `requireStaff` check runs before the flag check.

---

## Cost Considerations

Each Scout message round-trip uses approximately:
- **Input:** ~2,000 tokens (system prompt + conversation history + style config)
- **Output:** ~300 tokens (response + tool call)
- **Cost:** ~$0.01 per exchange at Sonnet pricing

For admin-only usage with a small team, cost is negligible. If opened to users, implement per-session message limits (e.g., 20 messages) and consider caching common queries.

---

## Feature Flag Details

| Property | Value |
|----------|-------|
| Flag key | `scout_style_agent` |
| Known constant | `FLAGS.SCOUT_STYLE_AGENT` in `utils/knownFlags.ts` |
| Default state | `enabled: false` |
| Initial targeting | `[{ type: "admin_role", enabled: true, roles: ["admin", "designer"] }]` |
| Environment | Seeded per environment; enable in development first, then production |

**Client behavior:** `useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)` reads from server-prefetched `useState`. Defaults to `false` on fetch failure. No additional client fetch needed — the Nuxt plugin hydrates all flags on initial page load.

**Server behavior:** `isFeatureEnabled(event, FLAGS.SCOUT_STYLE_AGENT, { staffSession })` evaluates after `requireStaff(event)` succeeds. The staff session provides the user's role for rule evaluation without a second DB hit. Returns 404 when false.

**Evaluation order** (per Feature Flags RFC): user_list overrides → admin_role → all_staff → percentage → everyone. Deny rules win within a bucket. For Scout v1, only the `admin_role` rule is active.

---

## Open Questions

1. **Should Scout persist conversation history across page reloads?** Leaning no for v1 — each session is fresh. Could use `sessionStorage` for persistence within a tab session.

2. **Should Scout work on the user-facing style page too?** Not initially — feature flag gates it to admin and designer roles. The component is designed to be reusable, and the flag can be retargeted (e.g., add a `percentage` rule) when we're ready to open it up.

3. **Should there be a "Scout auto-style" button?** A one-shot "let Scout design this map" button that doesn't require chat interaction. Similar to the existing `ai-style-agent.mjs` script but triggered from the UI. Good v2 feature.

4. **Model choice:** Sonnet is fast (~2-3s) and good for most requests. Should we offer an "ask Scout to think harder" option that routes to Opus for complex multi-property styling?
