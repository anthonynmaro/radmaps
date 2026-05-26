-- Hardened Stripe + Gelato shipping support.
--
-- Adds quote-first checkout state, Stripe event/payment audit tables, support
-- timelines, refund/dispute records, and durable premade fulfillment jobs.
-- All new tables are server-managed. RLS is enabled as defense-in-depth; app
-- access goes through service-role server APIs.

BEGIN;

-- ─── Orders: Stripe/support canonical fields ───────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS amount_subtotal_cents INT NOT NULL DEFAULT 0 CHECK (amount_subtotal_cents >= 0),
  ADD COLUMN IF NOT EXISTS amount_shipping_cents INT NOT NULL DEFAULT 0 CHECK (amount_shipping_cents >= 0),
  ADD COLUMN IF NOT EXISTS amount_tax_cents INT NOT NULL DEFAULT 0 CHECK (amount_tax_cents >= 0),
  ADD COLUMN IF NOT EXISTS amount_discount_cents INT NOT NULL DEFAULT 0 CHECK (amount_discount_cents >= 0),
  ADD COLUMN IF NOT EXISTS amount_total_cents INT NOT NULL DEFAULT 0 CHECK (amount_total_cents >= 0),
  ADD COLUMN IF NOT EXISTS amount_refunded_cents INT NOT NULL DEFAULT 0 CHECK (amount_refunded_cents >= 0),
  ADD COLUMN IF NOT EXISTS shipping_quote_id UUID,
  ADD COLUMN IF NOT EXISTS shipment_method_uid TEXT,
  ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dispute_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS risk_level TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_uniq
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stripe_customer_idx
  ON public.orders (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (payment_status)
  WHERE payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx
  ON public.orders (fulfillment_status)
  WHERE fulfillment_status IS NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending','paid','in_production','shipped','delivered','cancelled','failed',
    'fulfillment_failed','manual_review','refunded','partially_refunded'
  ));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status IN (
    'pending_payment','paid','rendering_print','print_ready',
    'submitted_to_gelato','manual_review','failed','render_queue_failed',
    'snapshot_missing','quote_mismatch','fraud_review','cancelled',
    'refunded','partially_refunded'
  ));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_refund_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_refund_status_check
  CHECK (refund_status IN ('none','pending','partial','full','failed'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_dispute_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_dispute_status_check
  CHECK (dispute_status IN ('none','warning_needs_response','under_review','needs_response','won','lost','closed'));

-- ─── checkout_attempts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_source TEXT NOT NULL CHECK (cart_source IN ('custom','premade')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  map_id UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  premade_slug TEXT,
  product_uid TEXT NOT NULL,
  print_size TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  shipping_address JSONB,
  address_hash TEXT,
  quote_id UUID,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','quoted','session_created','expired','completed','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_attempts_user_idx ON public.checkout_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_attempts_session_idx ON public.checkout_attempts (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_checkout_attempts_updated_at ON public.checkout_attempts;
CREATE TRIGGER set_checkout_attempts_updated_at
  BEFORE UPDATE ON public.checkout_attempts
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ─── shipping_quotes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_attempt_id UUID REFERENCES public.checkout_attempts(id) ON DELETE SET NULL,
  cart_source TEXT NOT NULL CHECK (cart_source IN ('custom','premade')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  map_id UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  premade_slug TEXT,
  product_uid TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  shipping_address JSONB NOT NULL,
  address_hash TEXT NOT NULL,
  shipment_method_uid TEXT NOT NULL,
  shipment_method_name TEXT NOT NULL DEFAULT 'Standard shipping',
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  min_delivery_date TEXT,
  max_delivery_date TEXT,
  raw_quote JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'quoted'
    CHECK (status IN ('quoted','selected','expired','used','failed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_quotes_lookup_idx
  ON public.shipping_quotes (id, status, expires_at);
CREATE INDEX IF NOT EXISTS shipping_quotes_attempt_idx
  ON public.shipping_quotes (checkout_attempt_id);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_quote_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_shipping_quote_id_fkey
  FOREIGN KEY (shipping_quote_id) REFERENCES public.shipping_quotes(id) ON DELETE SET NULL;

-- ─── Stripe/payment audit ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  object_id TEXT,
  object_type TEXT,
  api_version TEXT,
  livemode BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','ignored','failed')),
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stripe_events_type_created_idx
  ON public.stripe_events (event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS stripe_events_object_idx
  ON public.stripe_events (object_type, object_id)
  WHERE object_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  checkout_attempt_id UUID REFERENCES public.checkout_attempts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  failure_code TEXT,
  failure_message TEXT,
  payment_method_type TEXT,
  raw_payment JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON public.payment_attempts (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_attempts_pi_idx ON public.payment_attempts (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ─── Order support records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','staff','stripe','gelato','customer')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_idx ON public.order_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_refund_id TEXT UNIQUE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  raw_refund JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON public.order_refunds (order_id, created_at DESC);
DROP TRIGGER IF EXISTS set_order_refunds_updated_at ON public.order_refunds;
CREATE TRIGGER set_order_refunds_updated_at
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.order_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  amount_cents INT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL,
  evidence_due_by TIMESTAMPTZ,
  raw_dispute JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_disputes_order_idx ON public.order_disputes (order_id, created_at DESC);
DROP TRIGGER IF EXISTS set_order_disputes_updated_at ON public.order_disputes;
CREATE TRIGGER set_order_disputes_updated_at
  BEFORE UPDATE ON public.order_disputes
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_notes_order_idx ON public.support_notes (order_id, created_at DESC);

-- ─── Durable premade/reprint fulfillment queue ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.fulfillment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'gelato_submit'
    CHECK (job_type IN ('gelato_submit','reprint')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','submitting','submitted','failed','manual_review','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  worker_id TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fulfillment_jobs_status_idx ON public.fulfillment_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS fulfillment_jobs_order_idx ON public.fulfillment_jobs (order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_jobs_single_gelato_submit_idx
  ON public.fulfillment_jobs (order_id)
  WHERE job_type = 'gelato_submit';
DROP TRIGGER IF EXISTS set_fulfillment_jobs_updated_at ON public.fulfillment_jobs;
CREATE TRIGGER set_fulfillment_jobs_updated_at
  BEFORE UPDATE ON public.fulfillment_jobs
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ─── RLS and service-role grants ────────────────────────────────────────────
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_refunds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_disputes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_jobs TO service_role;

INSERT INTO public.feature_flags (key, name, description, environment, enabled, rules)
VALUES
  (
    'stripe_hardened_checkout',
    'Stripe Hardened Checkout',
    'Enables quote-first Gelato shipping and hardened Stripe Checkout session creation.',
    'all',
    false,
    '[{"type":"all_staff","enabled":true}]'::jsonb
  ),
  (
    'order_support_actions',
    'Order Support Actions',
    'Enables staff refund, reprint, cancellation, manual-review, and support-note actions.',
    'all',
    false,
    '[{"type":"admin_role","enabled":true,"roles":["admin","support"]}]'::jsonb
  )
ON CONFLICT (environment, key) DO NOTHING;

COMMIT;
