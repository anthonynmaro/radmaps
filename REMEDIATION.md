# RadMaps — Full-Stack Review & Remediation Plan

**Review date:** 2026-04-28  
**Scope:** Frontend (Vue/MapLibre), Backend (Nitro API routes), Security, Architecture  
**Health score:** 6.5 / 10 — functional MVP, not production-hardened

---

## Executive Summary

The core product loop (GPX upload → style → order) is solid. The biggest structural risks are:
1. **IDOR on the public map API** — any authenticated user can read any other user's private map data.
2. **SSRF in the render worker** — `logo_url` is embedded into Puppeteer HTML without domain validation.
3. **XML bomb vulnerability** in GPX parsing — a crafted upload can exhaust server memory.
4. **No state management layer** — StyleConfig exists in three places simultaneously (DB, composable, component), causing race conditions.
5. **Render worker is a single point of failure** — in-memory job queue, no retries, no rate limiting.

---

## P0 — Fix Before Next User-Facing Release

### SEC-1 · IDOR: Public Map Endpoint Bypasses RLS
**File:** `server/api/maps/public/[id].get.ts`  
**Risk:** Any UUID-holder reads any user's private map data (GeoJSON, style, render URL).  
The endpoint uses the Supabase service key (bypasses RLS) with no ownership check.

**Fix:**
```typescript
// Add is_public column to maps table
// In supabase/schema.sql:
ALTER TABLE maps ADD COLUMN is_public BOOLEAN DEFAULT false;

// In the route:
const { data: map } = await supabase
  .from('maps')
  .select('id, title, geojson, bbox, stats, style_config, render_url, thumbnail_url, status')
  .eq('id', id)
  .eq('is_public', true)   // Only return intentionally public maps
  .single()
```
Switch to anon client instead of service key for this endpoint — RLS handles the rest.

---

### SEC-2 · SSRF: Render Worker Embeds logo_url Without Validation
**File:** `render-worker/index.js` (logoHtml function)  
**Risk:** Authenticated user sets `logo_url` to `http://169.254.169.254/...` → headless Chrome fetches internal AWS metadata.

**Fix:**
```javascript
function validateLogoUrl(url) {
  try {
    const parsed = new URL(url)
    const allowedHosts = [
      'jzwpiifddtgxbfmdfqco.supabase.co',
      'radmaps.studio',
    ]
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    if (!allowedHosts.some(h => parsed.hostname.endsWith(h))) return null
    return url
  } catch {
    return null
  }
}

// In logoHtml():
const safeUrl = validateLogoUrl(style_config.logo_url)
if (!safeUrl) return ''
return `<img src="${safeUrl}" ... />`
```

---

### SEC-3 · DoS: GPX Parser Vulnerable to XML Bomb (Billion Laughs)
**File:** `utils/gpx.ts`, `server/api/maps/index.post.ts`  
**Risk:** Crafted GPX with recursive entity expansion exhausts server memory, crashing the Vercel function.

**Fix:**
```typescript
// Add file size guard before parsing (maps/index.post.ts)
const gpxText = await gpxFile.text()
if (gpxText.length > 5 * 1024 * 1024) {  // 5MB cap
  throw createError({ statusCode: 413, message: 'GPX file too large (max 5 MB)' })
}

// In gpx.ts, replace DOMParser with fast-xml-parser (no entity expansion by default)
// npm install fast-xml-parser
import { XMLParser } from 'fast-xml-parser'
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
const dom = parser.parse(gpxText)
```

---

### SEC-4 · Gelato Idempotency: Duplicate Orders on Webhook Retry
**File:** `server/api/orders/webhook.post.ts`  
**Risk:** Stripe retries webhooks on transient failures → duplicate Gelato orders placed → customer charged twice.

**Fix:**
```typescript
// Store stripe event ID and skip already-processed events
const eventId = stripeEvent.id
const { data: existing } = await supabase
  .from('processed_stripe_events')
  .select('id')
  .eq('event_id', eventId)
  .maybeSingle()

if (existing) {
  return { received: true }  // Idempotent — already handled
}

// After processing, record the event
await supabase.from('processed_stripe_events').insert({ event_id: eventId })
```
Add table: `CREATE TABLE processed_stripe_events (event_id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`

Also pass an idempotency key to Gelato:
```typescript
headers: { 'Idempotency-Key': `${session.id}-gelato` }
```

---

### SEC-5 · Gelato Webhook: Conditional Secret Check
**File:** `server/api/gelato/webhook.post.ts`  
**Risk:** If `GELATO_WEBHOOK_SECRET` is missing from env, the entire signature check is silently skipped.

**Fix:**
```typescript
// Fail hard if secret is not configured
const secret = config.gelatoWebhookSecret
if (!secret) {
  console.error('[gelato/webhook] GELATO_WEBHOOK_SECRET not set — refusing all requests')
  throw createError({ statusCode: 500, message: 'Webhook not configured' })
}
```

---

## P1 — Fix Within 1 Week

### BE-1 · Map Status Never Transitions to 'rendering'
**File:** `server/api/maps/[id]/render.post.ts:43`  
**Risk:** Client shows "draft" state during render — no indication that work is in progress.

**Fix:**
```typescript
// Add 'rendering' to MapStatus union in types/index.ts
export type MapStatus = 'draft' | 'rendering' | 'rendered' | 'ordered'

// In render.post.ts — update status before firing the worker
await supabase.from('maps').update({ status: 'rendering' }).eq('id', mapId)
```

---

### BE-2 · Gelato Order Marked in_production Despite Placement Failure
**File:** `server/api/orders/webhook.post.ts:119-138`  
**Risk:** Gelato throws → order status still set to `in_production` → customer expects shipment, nothing ships.

**Fix:**
```typescript
let status: OrderStatus = 'pending_payment'
let gelatoOrderId: string | null = null

if (!isDigital) {
  try {
    gelatoOrderId = await placeGelatoOrder(...)
    status = 'in_production'
  } catch (err) {
    console.error('[gelato] Order placement failed:', err)
    status = 'fulfillment_failed'
    // TODO: alert admin via email/Slack
  }
} else {
  status = 'delivered'
}

await supabase.from('orders').update({ gelato_order_id: gelatoOrderId, status }).eq('id', order.id)
```

---

### BE-3 · Render Worker Fire-and-Forget with No Error Recovery
**File:** `server/api/maps/[id]/render.post.ts:54-87`  
**Risk:** If Supabase write of error sentinel fails, the map stays in `rendering` forever.

**Fix:** Add guaranteed status update with retry:
```typescript
async function safeUpdateMapStatus(supabase, mapId, updates, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const { error } = await supabase.from('maps').update(updates).eq('id', mapId)
    if (!error) return
    await new Promise(r => setTimeout(r, 500 * (i + 1)))
  }
  console.error(`[render] Failed to update map ${mapId} after ${retries} retries`)
}
```

---

### BE-4 · Rate Limiting on Render Endpoint
**File:** `server/api/maps/[id]/render.post.ts`  
**Risk:** User can spam render jobs, exhausting Railway worker capacity and inflating cloud bills.

**Fix:** Add Nitro rate limit middleware or per-user guard:
```typescript
// server/api/maps/[id]/render.post.ts — add at top of handler
const cacheKey = `render:${user.id}`
const recentCount = await renderRateLimit.get(cacheKey) ?? 0
if (recentCount >= 5) {
  throw createError({ statusCode: 429, message: 'Render limit reached (5/hour). Try again later.' })
}
await renderRateLimit.set(cacheKey, recentCount + 1, { ex: 3600 })
```

---

### BE-5 · Logo Upload: Re-validate MIME Type + Sanitize mapId
**File:** `server/api/maps/[id]/logo.post.ts`  
The client-supplied `imageFile.type` can be spoofed. The `mapId` in the storage path is not validated as a UUID, risking path traversal.

**Fix:**
```typescript
import { z } from 'zod'
const mapIdSchema = z.string().uuid()
const safeMapId = mapIdSchema.parse(event.context.params?.id)

// Re-validate MIME type from actual content (using magic bytes)
// npm install file-type
const { fileTypeFromBuffer } = await import('file-type')
const buffer = Buffer.from(await imageFile.arrayBuffer())
const detected = await fileTypeFromBuffer(buffer)
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
if (!detected || !ALLOWED.has(detected.mime)) {
  throw createError({ statusCode: 400, message: 'Invalid image type' })
}
// SVG explicitly excluded — risk of stored XSS when rendered in browser
```

---

### BE-6 · GeoJSON Size + Bbox Validation
**File:** `server/api/maps/index.post.ts`  
**Risk:** 100MB GeoJSON upload crashes the render worker OOM.

**Fix:**
```typescript
const geojsonStr = JSON.stringify(body.geojson)
if (geojsonStr.length > 5 * 1024 * 1024) {
  throw createError({ statusCode: 413, message: 'Route GeoJSON exceeds 5 MB limit' })
}

if (body.bbox) {
  const [minLng, minLat, maxLng, maxLat] = body.bbox
  if (
    !isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat) ||
    minLng >= maxLng || minLat >= maxLat ||
    minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90
  ) {
    throw createError({ statusCode: 400, message: 'Invalid bounding box' })
  }
}
```

---

### FE-1 · Pointer Event Listener Leak on Overlay Resize
**File:** `components/map/MapPreview.vue` (onResizeStart)  
If the component unmounts mid-drag, `pointermove`/`pointerup` listeners persist forever.

**Fix:** Use AbortController tied to the resize lifecycle:
```typescript
const activeResizeAbort = ref<AbortController | null>(null)

function onResizeStart(e: PointerEvent, id: string) {
  activeResizeAbort.value?.abort()
  const ctrl = new AbortController()
  activeResizeAbort.value = ctrl

  function onUp() {
    ctrl.abort()
    activeResizeAbort.value = null
    // ... finalize
  }

  window.addEventListener('pointermove', onMove, { signal: ctrl.signal })
  window.addEventListener('pointerup', onUp, { signal: ctrl.signal })
}

onBeforeUnmount(() => activeResizeAbort.value?.abort())
```

---

### FE-2 · StyleConfig Watcher Race Condition (Overlapping setStyle Calls)
**File:** `components/map/MapPreview.vue` (style watcher)  
Rapid edits fire multiple async `setStyle()` calls before the previous one completes, corrupting map state.

**Fix:** Gate on a `styleUpdateInFlight` flag:
```typescript
let styleUpdateInFlight = false

watch(props.styleConfig, async (newConfig, oldConfig) => {
  if (!needsFullReload(oldConfig, newConfig)) {
    applyPaintUpdates(newConfig)
    return
  }
  if (styleUpdateInFlight) return  // Debounce overlapping full reloads
  styleUpdateInFlight = true
  try {
    mapReady.value = false
    mapInstance.setStyle(buildMapStyle(newConfig, tokens))
    await waitForStyleLoad(mapInstance)
    populateRouteSource()
  } finally {
    styleUpdateInFlight = false
  }
}, { deep: true, flush: 'post' })
```

---

### FE-3 · SSE Parsing in useStyleAgent Not Error-Guarded
**File:** `composables/useStyleAgent.ts` (~line 57)  
A malformed SSE chunk crashes the entire composable without recovery.

**Fix:**
```typescript
for (const line of lines) {
  if (!line.startsWith('data: ')) continue
  try {
    const data = JSON.parse(line.slice(6))
    // ... existing handling
  } catch (err) {
    console.warn('[useStyleAgent] Failed to parse SSE chunk, skipping:', line.slice(0, 80))
    continue
  }
}
```

---

## P2 — Fix Within 2 Weeks

### ARCH-1 · Implement Pinia Store (useEditorStore)
**Files:** `pages/create/[mapId]/style.vue`, `composables/useMap.ts`, `composables/useMapRenderer.ts`

StyleConfig currently lives in three places simultaneously. This causes optimistic update races, watcher complexity in `style.vue`, and untestable data flow.

**Plan:**
```typescript
// stores/editor.ts
export const useEditorStore = defineStore('editor', () => {
  const styleConfig = ref<StyleConfig>(cloneDeep(DEFAULT_STYLE_CONFIG))
  const isDirty = ref(false)
  const renderStatus = ref<'idle' | 'queued' | 'rendering' | 'done' | 'error'>('idle')
  const renderUrl = ref<string | null>(null)

  const { update: dbUpdate } = useMap()

  // Debounced DB sync
  const syncToDb = useDebounceFn(async () => {
    await dbUpdate(styleConfig.value)
    isDirty.value = false
  }, 600)

  function updateStyle(updates: Partial<StyleConfig>) {
    Object.assign(styleConfig.value, filterDefined(updates))
    isDirty.value = true
    syncToDb()
  }

  return { styleConfig, isDirty, renderStatus, renderUrl, updateStyle }
})
```

---

### ARCH-2 · StyleConfig Zod Validation (Shared Schema)
**Files:** `types/index.ts`, `server/api/maps/[id]/render.post.ts`, `server/api/maps/index.post.ts`

StyleConfig is modified by the client, the style agent, and the render worker with no validation. Add a shared Zod schema:

```typescript
// types/validation.ts
export const StyleConfigSchema = z.object({
  preset: z.enum(['minimalist', 'topographic']),
  route_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  route_width: z.number().min(0.5).max(20),
  map_zoom: z.number().min(0).max(28).optional(),
  map_center: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-85.051).max(85.051)
  ]).optional(),
  // ...
}).passthrough()  // Allow unknown keys during transition
```

Validate in: render.post.ts (before firing worker), agent/style.post.ts (after tool call), MapPreview (in dev mode).

---

### ARCH-3 · Render Worker: Exponential Backoff Polling
**File:** `composables/useMapRenderer.ts`  
Flat 3-second polling interval creates unnecessary DB reads (27+ polls for a 10s render).

**Fix:**
```typescript
let pollInterval = 1000
const MAX_INTERVAL = 10000
const BACKOFF_FACTOR = 1.5

async function startPolling() {
  clearTimeout(pollTimer)

  const done = await checkStatus()
  if (done) return

  pollInterval = Math.min(pollInterval * BACKOFF_FACTOR, MAX_INTERVAL)
  pollTimer = setTimeout(startPolling, pollInterval)
}
```

---

### ARCH-4 · Render Worker: Add 'rendering' Status to Map Status Type
Covered under BE-1 above, but also update `useMapRenderer.ts` to reflect 3-state polling:
- `rendering` → in progress, show spinner + progress
- `rendered` → complete, show preview
- `error:*` → failed, show error + retry button

---

### SEC-6 · Strava Token Handling: Validate Expiry Before Short-Circuit
**File:** `server/api/strava/connect.get.ts`  
If stored tokens are expired, the connect endpoint short-circuits and claims success even though the user can't import activities.

**Fix:**
```typescript
const nowSec = Math.floor(Date.now() / 1000)
if (token?.athlete_id && token.expires_at > nowSec + 300) {
  return sendRedirect(event, '/create?strava_connected=1')
}
// Otherwise, fall through to full re-auth flow
```

---

### SEC-7 · Add Security Headers in nuxt.config.ts / vercel.json
Currently no CSP, X-Frame-Options, or HSTS headers.

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```
CSP requires more careful configuration (MapLibre needs `unsafe-eval`, tile CDNs need `connect-src`).

---

### SEC-8 · Guest Order RLS Policy
**File:** `supabase/schema.sql`  
Guests have no way to retrieve their own order status after checkout.

**Fix:**
```sql
-- Add policy for guest order lookup by email
CREATE POLICY "Guests read own orders" ON public.orders
  FOR SELECT USING (
    auth.uid() IS NULL AND
    guest_email = current_setting('request.jwt.claims', true)::json->>'email'
  );
```
Or: create a server endpoint that accepts a signed JWT containing `guest_email` and returns orders.

---

### FE-4 · Accessibility: Add ARIA Labels to contenteditable Poster Fields
**File:** `components/map/MapPreview.vue`  
Screen readers cannot identify or edit the trail name / location / occasion fields.

**Fix:**
```vue
<h1
  :contenteditable="editable"
  role="textbox"
  :aria-label="`Trail name (editable)`"
  :aria-multiline="false"
  ...
/>
```

---

### FE-5 · Focus Trap in InlineEditSheet
**File:** `components/map/InlineEditSheet.vue`  
Keyboard tabbing escapes the modal sheet. Focus is not returned to trigger element on close.

**Fix:** Store the trigger ref before opening, restore on close:
```typescript
// In parent (MapPreview.vue)
const lastActiveBefore = ref<HTMLElement | null>(null)

function openInlineEdit(field) {
  lastActiveBefore.value = document.activeElement as HTMLElement
  activeEditField.value = field
}

function closeInlineEdit() {
  activeEditField.value = null
  nextTick(() => lastActiveBefore.value?.focus())
}
```

---

## P3 — Clean Up / Nice to Have

### DEBT-1 · Remove design_handoff_style_panel/
This directory contains old JSX/HTML design mockups. None are imported anywhere.
```bash
rm -rf design_handoff_style_panel/
```

### DEBT-2 · Extract StylePanel Sub-components
The inline `defineComponent` render functions at the bottom of `StylePanel.vue` should be extracted to separate files:
```
components/map/style/
├── ColorRow.vue
├── SliderRow.vue
├── FontButton.vue
└── SectionHeader.vue
```

### DEBT-3 · Add Unit Tests for Critical Utils
Zero tests cover `mapStyle.ts` (8 style builders), `gpx.ts`, `trail.ts`, or `products.ts`. These are the most failure-prone modules.

Priority test files to add:
- `tests/mapStyle.test.ts` — test each builder produces valid MapLibre style JSON
- `tests/gpx.test.ts` — test multi-track, missing elevation, malformed XML handling
- `tests/trail.test.ts` — test section slicing edge cases

### DEBT-4 · Constants File
Magic numbers are scattered across files (1350px preview width, 3s poll interval, 600ms debounce).
```typescript
// utils/constants.ts
export const RENDER_PREVIEW_WIDTH = 1350
export const RENDER_PRINT_WIDTH = 5470
export const POLL_INITIAL_MS = 1000
export const POLL_MAX_MS = 10000
export const STYLE_SAVE_DEBOUNCE_MS = 600
```

### DEBT-5 · Add npm Scripts
```json
{
  "scripts": {
    "dev:worker": "cd render-worker && node index.js",
    "typecheck": "nuxt typecheck",
    "validate": "npm run lint && npm run typecheck && npm run test"
  }
}
```

### DEBT-6 · Type Safety: Eliminate `as any` Casts
8 instances of `as any` exist primarily from `useSupabaseClient()` typing. Create a typed wrapper:
```typescript
// composables/useTypedSupabase.ts
export const useTypedSupabase = () => useSupabaseClient<Database>()
```

### DEBT-7 · Version Ordering Determinism
**File:** `server/api/maps/[id]/versions.get.ts`  
Add secondary sort by `id` to prevent non-deterministic results when two versions share the same `created_at` timestamp:
```typescript
.order('created_at', { ascending: false })
.order('id', { ascending: false })
```

---

## Issue Priority Matrix

| ID | Severity | Category | File | Description |
|----|----------|----------|------|-------------|
| SEC-1 | **CRITICAL** | Security/IDOR | `maps/public/[id].get.ts` | Any UUID reads any private map |
| SEC-2 | **CRITICAL** | Security/SSRF | `render-worker/index.js` | logo_url embeds arbitrary URLs in Puppeteer |
| SEC-3 | **CRITICAL** | Security/DoS | `utils/gpx.ts` | XML bomb in GPX upload |
| SEC-4 | **CRITICAL** | Backend | `orders/webhook.post.ts` | Duplicate Gelato orders on Stripe retry |
| SEC-5 | **HIGH** | Security | `gelato/webhook.post.ts` | Conditional secret check — may accept unsigned webhooks |
| BE-1 | **HIGH** | Backend | `maps/[id]/render.post.ts` | Map never transitions to 'rendering' status |
| BE-2 | **HIGH** | Backend | `orders/webhook.post.ts` | Order marked in_production despite Gelato failure |
| BE-3 | **HIGH** | Backend | `maps/[id]/render.post.ts` | No recovery if Supabase write fails after render error |
| BE-4 | **HIGH** | Backend/Security | `maps/[id]/render.post.ts` | No rate limiting — render spam exhausts Railway |
| BE-5 | **HIGH** | Security | `maps/[id]/logo.post.ts` | Client-spoofed MIME type + mapId path traversal |
| BE-6 | **HIGH** | Backend | `maps/index.post.ts` | No GeoJSON size/bbox validation |
| FE-1 | **HIGH** | Frontend | `MapPreview.vue` | Pointer event listener leak on overlay resize |
| FE-2 | **HIGH** | Frontend | `MapPreview.vue` | Overlapping setStyle() calls corrupt map state |
| FE-3 | **MEDIUM** | Frontend | `useStyleAgent.ts` | SSE parse crash on malformed chunk |
| ARCH-1 | **MEDIUM** | Architecture | `style.vue` | No Pinia store — 3 sources of truth for StyleConfig |
| ARCH-2 | **MEDIUM** | Architecture | `types/index.ts` | No Zod validation schema for StyleConfig |
| ARCH-3 | **MEDIUM** | Architecture | `useMapRenderer.ts` | Flat poll interval wastes DB reads |
| SEC-6 | **MEDIUM** | Security | `strava/connect.get.ts` | Expired token not detected in short-circuit path |
| SEC-7 | **MEDIUM** | Security | `nuxt.config.ts` | Missing security headers (CSP, HSTS, X-Frame) |
| SEC-8 | **MEDIUM** | Security/DB | `schema.sql` | No RLS policy for guest order lookup |
| FE-4 | **MEDIUM** | Accessibility | `MapPreview.vue` | contenteditable fields have no ARIA labels |
| FE-5 | **MEDIUM** | Accessibility | `InlineEditSheet.vue` | No focus trap or focus return on close |
| DEBT-1 | **LOW** | Tech Debt | `design_handoff_style_panel/` | Unused 160KB scratch directory |
| DEBT-2 | **LOW** | Tech Debt | `StylePanel.vue` | Inline sub-components should be extracted |
| DEBT-3 | **LOW** | Quality | `tests/` | Zero tests for mapStyle, gpx, trail, products |
| DEBT-4 | **LOW** | Maintainability | scattered | Magic numbers, no constants file |
| DEBT-5 | **LOW** | DX | `package.json` | Missing npm scripts for common workflows |
| DEBT-6 | **LOW** | Type Safety | composables | 8x `as any` casts from Supabase client typing |
| DEBT-7 | **LOW** | Backend | `versions.get.ts` | Non-deterministic ordering without secondary sort |

---

## Recommended Sprint Plan

**Week 1 — Security Hardening**
- [ ] SEC-1: Add `is_public` flag, fix public map IDOR
- [ ] SEC-2: Validate `logo_url` domain in render worker
- [ ] SEC-3: Add GPX size cap + switch to safe XML parser
- [ ] SEC-4: Stripe event deduplication table
- [ ] SEC-5: Hard-fail if Gelato webhook secret not set

**Week 2 — Backend Reliability**
- [ ] BE-1: Add `rendering` status to MapStatus type
- [ ] BE-2: Fix Gelato failure → order status logic
- [ ] BE-3: Retry on Supabase write after render error
- [ ] BE-4: Rate limit render endpoint (5/user/hour)
- [ ] BE-5: Re-validate MIME type + UUID-check mapId

**Week 3 — Frontend & State**
- [ ] FE-1: AbortController for overlay resize listeners
- [ ] FE-2: Gate overlapping setStyle calls with in-flight flag
- [ ] ARCH-1: Scaffold Pinia useEditorStore (replace local ref in style.vue)
- [ ] ARCH-3: Exponential backoff polling in useMapRenderer

**Week 4 — Test Coverage + Polish**
- [ ] DEBT-3: Add mapStyle.test.ts, gpx.test.ts, trail.test.ts
- [ ] ARCH-2: Add Zod StyleConfig schema, validate in render.post.ts
- [ ] SEC-7: Add security headers to vercel.json
- [ ] DEBT-1: Delete design_handoff_style_panel/
