# RFC: First-Party Feature Flags

**Status:** Implemented v1 · **Author:** Anthony · **Date:** 2026-05-07

## Summary

RadMaps uses a lightweight first-party feature flag system backed by Supabase and managed from `/admin/flags`. v1 covers boolean feature gates, environment scoping, role/user targeting, deterministic percentage rollout, soft archive/restore, and audit history.

This is intentionally smaller than Vercel Flags, LaunchDarkly, Flagsmith, or Edge Config. It gives the small RadMaps team controlled rollouts without adding another vendor. Do not treat v1 as a full A/B testing platform until variants and analytics are added.

## Flag Keys

All code references must use typed constants from `utils/knownFlags.ts`:

```ts
export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
} as const
```

Use `useFeatureFlag(FLAGS.SCOUT_STYLE_AGENT)` instead of string literals. When a flag is retired, remove it from this file and TypeScript will reveal remaining references.

## Data Model

`feature_flags` stores one row per `(environment, key)`.

- `environment`: `development`, `preview`, `production`, or `all`.
- `enabled`: global kill switch. If false, evaluation always returns false.
- `rules`: JSON array of up to 10 targeting rules.
- `archived_at`: soft archive marker. Archived flags are ignored.
- `created_by` / `updated_by`: reference `public.profiles(id)`, consistent with existing admin tables.

`feature_flag_events` records `create`, `update`, `archive`, and `restore` actions with actor, before/after JSON, flag key, environment, and timestamp.

Runtime environment resolves as:

```text
FEATURE_FLAG_ENV || VERCEL_ENV || NODE_ENV || development
```

The resolver reads rows for both the current environment and `all`. Environment-specific rows override `all` rows with the same key.

## Evaluation

Flags fail closed. Disabled, archived, missing, malformed, or unmatched flags return false.

Rule buckets evaluate in this order:

1. `user_list`
2. `admin_role`
3. `all_staff`
4. `percentage`
5. `everyone`

Within a bucket, deny rules win over allow rules. If a bucket has a matching allow and no matching deny, evaluation returns true. If no bucket matches, evaluation returns false.

Public client resolution is intentionally opaque:

```ts
GET /api/flags -> { flags: Record<string, true> }
```

Disabled, archived, unknown, and missing flags are all absent. The client does not distinguish “off” from “does not exist.”

## Implementation

- Shared pure logic lives in `utils/featureFlags.ts`.
- Server Supabase/cache/request-context logic lives in `server/utils/featureFlags.ts`.
- Nuxt prefetch/hydration lives in `plugins/feature-flags.ts`.
- Client composables live in `composables/useFeatureFlags.ts`.
- Admin APIs live under `/api/admin/flags`.
- Admin UI lives at `/admin/flags` and is gated by `flags:manage`.

Scout v1 uses `FLAGS.SCOUT_STYLE_AGENT`. The admin premade StylePanel opts into the Scout tab, then `useFeatureFlag` decides whether it renders. `/api/agent/style` also requires staff auth and the same flag; when the flag is off it returns 404 after auth succeeds.

## Tests

Required coverage:

- Pure evaluation semantics for every rule type.
- Priority ordering and deny-over-allow behavior.
- Disabled, archived, malformed, and empty-rule fail-closed behavior.
- Deterministic percentage rollout boundaries.
- `flags:manage` is admin-only.
- Scout targeting contract: admin/designer staff allowed when the flag is enabled; support and non-staff rejected.

Verification before release:

```bash
npm run test
npm run typecheck
```

Apply the Supabase migration in development before testing `/admin/flags`.
