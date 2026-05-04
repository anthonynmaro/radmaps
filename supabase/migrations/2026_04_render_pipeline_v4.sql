-- ─── Render Pipeline v4 schema additions ─────────────────────────────────────
-- See RadMaps_Render_Pipeline_Plan_v4.md (§"Schema additions").
-- Apply this migration via Supabase SQL Editor or `supabase db push`.
--
-- Adds:
--   • order_snapshots         — frozen design per Stripe Checkout session.
--   • print_render_jobs       — Postgres-backed job queue for the worker.
--   • render_cache            — content-addressable map-image cache.
--   • product_renders         — final print artifacts per session × product.
--   • maps:   map_content_hash, chrome_hash, proof_render_hash, proof_render_url
--   • orders: fulfillment_status, active_stripe_session_id, print_file_url
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── Stripe webhook event dedup ─────────────────────────────────────────────
-- Table is owned by 2026_04_security_fixes.sql with column `created_at`.
-- v4 reuses the existing schema as-is — no parallel `processed_at` column.
-- Webhook handler should INSERT (event_id) ON CONFLICT DO NOTHING and treat
-- a conflict as "already processed; exit early".
COMMENT ON TABLE public.processed_stripe_events IS
  'Idempotency log for Stripe webhook deliveries; PK event_id prevents duplicate Gelato submissions on retry. Owned by 2026_04_security_fixes.sql.';

-- ─── order_snapshots ────────────────────────────────────────────────────────
-- Per-session immutable snapshot of the design the customer approved.
-- Keyed by stripe_session_id (NOT order_id) so multiple checkout sessions
-- against the same cart cannot collide.  Insert-once, never updated.
--
-- order_id is NULLABLE because this row is inserted at Stripe Checkout
-- session creation, before the orders row is created (which still happens
-- at webhook time in the existing flow).  The webhook handler populates
-- order_id when it creates the orders row.  Abandoned sessions therefore
-- have order_id = NULL and are kept as historical state — that's fine,
-- they tell us "a customer once approved this design through this session."
CREATE TABLE IF NOT EXISTS public.order_snapshots (
  stripe_session_id    TEXT PRIMARY KEY,
  order_id             UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- session originator
  map_id               UUID REFERENCES public.maps(id) ON DELETE SET NULL,     -- source map (for joins)
  product_uid          TEXT NOT NULL,
  style_config         JSONB NOT NULL,
  geojson              JSONB NOT NULL,
  stats                JSONB NOT NULL,
  bbox                 FLOAT8[4] NOT NULL,  -- [minLng, minLat, maxLng, maxLat]
  proof_render_hash    TEXT NOT NULL,
  proof_render_url     TEXT NOT NULL,
  map_content_hash     TEXT NOT NULL,
  chrome_hash          TEXT NOT NULL,
  hash_version         JSONB NOT NULL,
  provider_profile     JSONB NOT NULL,
  frozen_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_snapshots_bbox_len_chk CHECK (array_length(bbox, 1) = 4)
);

CREATE INDEX IF NOT EXISTS order_snapshots_order_idx
  ON public.order_snapshots (order_id);

COMMENT ON TABLE public.order_snapshots IS
  'Immutable design snapshot frozen at Stripe Checkout session creation; one row per session, consumed verbatim by the print render worker.';

-- ─── print_render_jobs ──────────────────────────────────────────────────────
-- Postgres-backed job queue.  Worker claims rows via direct pg
-- `SELECT … FOR UPDATE SKIP LOCKED` (PostgREST cannot do this).
CREATE TABLE IF NOT EXISTS public.print_render_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id   TEXT NOT NULL REFERENCES public.order_snapshots(stripe_session_id),
  print_hash          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','rendering','validating','ready','submitted','failed')),
  attempts            INT NOT NULL DEFAULT 0,
  max_attempts        INT NOT NULL DEFAULT 3,
  last_error          TEXT,
  worker_id           TEXT,
  claimed_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT print_render_jobs_session_hash_uniq
    UNIQUE (stripe_session_id, print_hash)
);

CREATE INDEX IF NOT EXISTS print_render_jobs_status_idx
  ON public.print_render_jobs (status);

DROP TRIGGER IF EXISTS set_print_render_jobs_updated_at ON public.print_render_jobs;
CREATE TRIGGER set_print_render_jobs_updated_at
  BEFORE UPDATE ON public.print_render_jobs
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.print_render_jobs IS
  'Print render job queue; worker claims jobs with FOR UPDATE SKIP LOCKED, retries up to max_attempts before flipping the order to manual_review.';

-- ─── render_cache ──────────────────────────────────────────────────────────
-- Map-layer (no chrome) image cache.  render_backend is part of the cache key
-- per locked decision #4 — Native and Browser caches occupy separate
-- namespaces; cross-backend sharing would be a bug.
CREATE TABLE IF NOT EXISTS public.render_cache (
  render_cache_key  TEXT PRIMARY KEY,
  map_content_hash  TEXT NOT NULL,
  render_class      TEXT NOT NULL CHECK (render_class IN ('proof','final')),
  render_backend    TEXT NOT NULL CHECK (render_backend IN ('native','browser')),
  map_image_path    TEXT NOT NULL,
  width_px          INT NOT NULL,
  height_px         INT NOT NULL,
  dpi               INT NOT NULL,
  render_ms         INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count         INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS render_cache_lru
  ON public.render_cache (last_used_at);

COMMENT ON TABLE public.render_cache IS
  'Content-addressable cache of rendered map images (no chrome); LRU eviction via last_used_at; render_backend is part of the cache key.';

-- ─── product_renders ───────────────────────────────────────────────────────
-- Final print artifacts.  Keyed on stripe_session_id × product_uid × print_hash
-- so each session gets the file produced from its own snapshot, even if a
-- later session for the same order had a different design.
CREATE TABLE IF NOT EXISTS public.product_renders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id  TEXT NOT NULL REFERENCES public.order_snapshots(stripe_session_id),
  product_uid        TEXT NOT NULL,
  trim_width_in      NUMERIC NOT NULL,
  trim_height_in     NUMERIC NOT NULL,
  dpi                INT NOT NULL,
  bleed_mm           NUMERIC NOT NULL,
  render_backend     TEXT NOT NULL CHECK (render_backend IN ('native','browser')),
  map_content_hash   TEXT NOT NULL,
  chrome_hash        TEXT NOT NULL,
  print_hash         TEXT NOT NULL,
  artifact_path      TEXT NOT NULL,
  validation_result  JSONB NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_renders_session_product_hash_uniq
    UNIQUE (stripe_session_id, product_uid, print_hash)
);

COMMENT ON TABLE public.product_renders IS
  'Final print artifacts per (session, product, print_hash) with full ValidationResult JSON; what was uploaded to Gelato for this Stripe session.';

-- ─── maps additions ────────────────────────────────────────────────────────
ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS map_content_hash  TEXT,
  ADD COLUMN IF NOT EXISTS chrome_hash       TEXT,
  ADD COLUMN IF NOT EXISTS proof_render_hash TEXT,
  ADD COLUMN IF NOT EXISTS proof_render_url  TEXT;

CREATE INDEX IF NOT EXISTS maps_map_content_hash_idx
  ON public.maps (map_content_hash);

-- ─── orders additions ──────────────────────────────────────────────────────
-- 'pending_payment' is intentionally in the CHECK list (v3.4 bug fix).
--
-- Historical orders already carry a value under the legacy `status` column
-- (pending/paid/in_production/shipped/delivered/cancelled/failed/fulfillment_failed).
-- A blind `DEFAULT 'pending_payment' NOT NULL` on existing rows would mark
-- delivered orders as "pending_payment", which is wrong and confusing.
--
-- Safe ordering for the backfill:
--   1. Add fulfillment_status as NULLABLE with no default.
--   2. UPDATE every existing row by mapping legacy status → new vocabulary.
--   3. THEN add the CHECK, set NOT NULL, and set the default for future rows.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status        TEXT,
  ADD COLUMN IF NOT EXISTS active_stripe_session_id  TEXT,
  ADD COLUMN IF NOT EXISTS print_file_url            TEXT;

UPDATE public.orders
   SET fulfillment_status = CASE status
     WHEN 'pending'            THEN 'pending_payment'
     WHEN 'paid'               THEN 'paid'
     WHEN 'in_production'      THEN 'rendering_print'
     WHEN 'shipped'            THEN 'submitted_to_gelato'
     WHEN 'delivered'          THEN 'submitted_to_gelato'
     -- 'cancelled' has no first-class fulfillment_status equivalent; map to
     -- 'paid' as a neutral state.  If a 'cancelled'/'refunded' value is added
     -- to fulfillment_status later, revisit this mapping.
     WHEN 'cancelled'          THEN 'paid'
     WHEN 'failed'             THEN 'failed'
     WHEN 'fulfillment_failed' THEN 'failed'
     ELSE 'paid'
   END
 WHERE fulfillment_status IS NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_status_check
    CHECK (fulfillment_status IN (
      'pending_payment','paid','rendering_print','print_ready',
      'submitted_to_gelato','manual_review','failed'
    ));

ALTER TABLE public.orders
  ALTER COLUMN fulfillment_status SET DEFAULT 'pending_payment',
  ALTER COLUMN fulfillment_status SET NOT NULL;

-- ─── Row Level Security ────────────────────────────────────────────────────
-- All new tables are server-only (service role bypasses RLS).  Mirror the
-- existing project pattern: enable RLS so anon/authenticated keys cannot
-- read anything, then grant a narrow SELECT for owners of the parent order
-- where it makes sense (order_snapshots, product_renders).

ALTER TABLE public.order_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_render_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_renders    ENABLE ROW LEVEL SECURITY;

-- order_snapshots: a logged-in user can read their own snapshots.
-- Two paths: direct user_id match (for snapshots whose order isn't created
-- yet, or for guest-flow sessions) OR via the linked orders row.
DROP POLICY IF EXISTS "Users read own order snapshots" ON public.order_snapshots;
CREATE POLICY "Users read own order snapshots" ON public.order_snapshots
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_snapshots.order_id
        AND o.user_id = auth.uid()
    )
  );

-- product_renders: same pattern, joined through order_snapshots → orders.
DROP POLICY IF EXISTS "Users read own product renders" ON public.product_renders;
CREATE POLICY "Users read own product renders" ON public.product_renders
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.order_snapshots s
      JOIN public.orders o ON o.id = s.order_id
      WHERE s.stripe_session_id = product_renders.stripe_session_id
        AND o.user_id = auth.uid()
    )
  );

-- print_render_jobs and render_cache: server-only, no end-user policies.
-- (Service role still bypasses RLS; authenticated/anon get nothing.)

COMMIT;
