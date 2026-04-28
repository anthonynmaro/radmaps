-- ─── Security & reliability fixes — 2026-04-28 ───────────────────────────────

-- 1. Add 'rendering' to maps status so the UI can show in-progress state.
ALTER TABLE public.maps DROP CONSTRAINT IF EXISTS maps_status_check;
ALTER TABLE public.maps ADD CONSTRAINT maps_status_check
  CHECK (status IN ('draft', 'rendering', 'rendered', 'ordered'));

-- 2. Add is_public flag so only explicitly shared maps are accessible via the
--    public share endpoint.  Set true automatically when a print render completes.
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- 3. RLS: allow unauthenticated reads of maps where is_public = true.
--    The existing "Users CRUD own maps" policy still gates everything else.
DROP POLICY IF EXISTS "Public map share" ON public.maps;
CREATE POLICY "Public map share" ON public.maps
  FOR SELECT USING (is_public = true);

-- 4. Add 'fulfillment_failed' to orders status so Gelato failures are visible.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'paid', 'in_production', 'shipped',
    'delivered', 'cancelled', 'failed', 'fulfillment_failed'
  ));

-- 5. Stripe event deduplication — prevents duplicate Gelato orders on webhook retry.
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id   TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- Accessible only via service key (webhooks run server-side).
-- Auto-cleanup: a scheduled job (or pg_cron) should purge rows older than 30 days.
CREATE INDEX IF NOT EXISTS processed_stripe_events_created_at_idx
  ON public.processed_stripe_events (created_at);
