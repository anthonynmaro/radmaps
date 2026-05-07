# RadMaps Admin

The admin section lives at `/admin` and is backed by Supabase tables plus
server-only Nitro APIs. Staff pages never talk directly to privileged tables
from the browser; the server uses the Supabase service role after checking the
signed-in user's staff role.

## Super-Admin Bootstrap

`anthonynmaro@gmail.com` is the immutable default super-admin. The app also
reads comma-separated overrides from:

```bash
ADMIN_SUPER_ADMIN_EMAILS=anthonynmaro@gmail.com
ADMIN_BOOTSTRAP_EMAILS=anthonynmaro@gmail.com
```

Super-admin emails are always treated as `admin`, are upserted into
`admin_users` on first admin access, and cannot be demoted or removed from the
staff UI. `ADMIN_BOOTSTRAP_EMAILS` is only for first access and operational
recovery; day-to-day staff changes should happen in `/admin/staff`.

Production Vercel has both admin email variables set for `Production` and
`Development`.

## Roles

| Role | Access |
|---|---|
| `admin` | Staff management, premade drafts, publishing, homepage ordering, support lookup |
| `curator` | Premade create/edit/publish and homepage ordering |
| `designer` | Premade create/edit drafts and design metadata |
| `support` | Support-facing user/order lookup only |

The shared permission matrix is in
[`utils/adminPermissions.ts`](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/adminPermissions.ts).

## Feature Flags

Feature flags live at `/admin/flags` and require the admin-only `flags:manage`
permission. Flags are environment-scoped (`development`, `preview`,
`production`, or `all`) and the runtime environment resolves from
`FEATURE_FLAG_ENV`, then `VERCEL_ENV`, then `NODE_ENV`.

Code must reference keys through
[`utils/knownFlags.ts`](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/knownFlags.ts).
The public client receives only enabled flags as `{ flags: Record<string, true>
}`; missing, disabled, and archived flags all default to false. Archive flags
instead of deleting them so rollout history and audit context remain available.

Each create, update, archive, and restore writes a `feature_flag_events` row.
Use this history when investigating unexpected rollout changes.

## Database

The admin migration is
[`supabase/migrations/20260506052818_admin_premade_catalog.sql`](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/supabase/migrations/20260506052818_admin_premade_catalog.sql).

It creates:

- `public.admin_users`: active staff role assignments.
- `public.premade_maps`: database-backed premade catalog rows.

RLS is enabled on both tables. There are intentionally no client-facing RLS
policies because public catalog reads and all admin writes go through Nitro
handlers using the service role key. Newly-created Supabase tables may need Data
API exposure depending on project settings; verify with the Supabase dashboard
or a service-role REST request after applying the migration.

## Premade Creation

The preferred purchasable flow is `/admin/premade` -> "Create from map ID".

Only `map_id` is required for draft creation. The server copies the source map's
title, subtitle, GeoJSON, bbox, stats, style config, proof render URL,
thumbnail URL, and render URL into an immutable draft. It also generates:

- URL slug with collision suffixing.
- Region from `stats.location` when available.
- Category default: `adventure`.
- Base price from the smallest poster product.
- Preview image by `proof_render_url -> thumbnail_url -> render_url` when the
  source map already has one.

If the source map has no preview asset, the draft is created with
`needs_preview = true`. Use "Generate preview" or "Generate next 5 previews" to
call the signed Browserless thumbnail path. Premade thumbnails render directly
from the premade row at `720x1080`, update `preview_image_url`, and do not write
to `render_url`. Publishing still requires a complete map payload, preview
image, and print-ready render URL.

For batch work, run:

```bash
npm run premade:backfill-thumbnails -- --limit 25 --concurrency 2
```

Use `--dry-run` first to inspect which rows would be processed, and `--ids` to
resume a known subset.

Preview-image-only drafts can exist for homepage planning, but checkout and
customization only resolve published premade maps with route/render payloads.

## Public Catalog Behavior

Public pages call:

- `GET /api/premade`
- `GET /api/premade/:slug`

These APIs return only `status = 'published'` database rows. The old static file
[`data/premade-maps.ts`](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/data/premade-maps.ts)
is now seed/reference data only. It is used as a temporary fallback while the
`premade_maps` table is missing or completely empty; once any database catalog
row exists, unpublished static maps are not exposed.

## Operational Checklist

1. Apply the admin/premade migration locally and in production.
2. Confirm `ADMIN_SUPER_ADMIN_EMAILS` and `ADMIN_BOOTSTRAP_EMAILS` contain
   `anthonynmaro@gmail.com`.
3. Sign in as `anthonynmaro@gmail.com` and open `/admin`.
4. Assign staff roles from `/admin/staff`.
5. Open `/admin/flags` and confirm the seeded `scout_style_agent` flag exists.
6. Create a draft from a real `map_id`.
7. Generate a preview if the source map has none.
8. Fill metadata, publish, then feature/order it from `/admin/homepage`.
9. Verify `/api/premade` and guest checkout/customize flows use the published
   database row.
