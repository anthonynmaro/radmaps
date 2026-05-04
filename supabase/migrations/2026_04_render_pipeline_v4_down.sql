-- ─── Render Pipeline v4 — DOWN migration ─────────────────────────────────────
-- Reverts 2026_04_render_pipeline_v4.sql.  Safe to re-run.
--
-- Drop order respects FK dependencies:
--   • print_render_jobs and product_renders both FK → order_snapshots, so they
--     must be dropped first.
--   • order_snapshots FK → orders (already exists, untouched).
--   • render_cache is independent.
-- After tables, ALTER TABLE … DROP COLUMN IF EXISTS reverts the maps/orders
-- additions.  The processed_stripe_events table is NOT touched — it was
-- created in 2026_04_security_fixes.sql, which this migration does not own.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── Drop policies first (so dropping the tables is clean) ──────────────────
DROP POLICY IF EXISTS "Users read own product renders" ON public.product_renders;
DROP POLICY IF EXISTS "Users read own order snapshots" ON public.order_snapshots;

-- ─── Drop tables in reverse FK-dependency order ─────────────────────────────
-- Children of order_snapshots first.
DROP TABLE IF EXISTS public.print_render_jobs;
DROP TABLE IF EXISTS public.product_renders;

-- order_snapshots is now safe to drop.
DROP TABLE IF EXISTS public.order_snapshots;

-- Independent tables.
DROP TABLE IF EXISTS public.render_cache;

-- ─── Revert orders ALTERs ──────────────────────────────────────────────────
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS fulfillment_status,
  DROP COLUMN IF EXISTS active_stripe_session_id,
  DROP COLUMN IF EXISTS print_file_url;
-- Backfilled values in fulfillment_status are lost on rollback; the legacy
-- `status` column is untouched and remains the source of truth.

-- ─── Revert maps ALTERs ────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.maps_map_content_hash_idx;

ALTER TABLE public.maps
  DROP COLUMN IF EXISTS map_content_hash,
  DROP COLUMN IF EXISTS chrome_hash,
  DROP COLUMN IF EXISTS proof_render_hash,
  DROP COLUMN IF EXISTS proof_render_url;

-- processed_stripe_events: untouched (owned by 2026_04_security_fixes.sql).

COMMIT;
