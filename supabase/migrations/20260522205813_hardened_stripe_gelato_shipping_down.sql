-- Rollback for 20260522205813_hardened_stripe_gelato_shipping.sql.

BEGIN;

DELETE FROM public.feature_flags
WHERE environment = 'all'
  AND key IN ('stripe_hardened_checkout', 'order_support_actions');

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_quote_id_fkey;

DROP INDEX IF EXISTS public.fulfillment_jobs_single_gelato_submit_idx;

DROP TABLE IF EXISTS public.fulfillment_jobs;
DROP TABLE IF EXISTS public.support_notes;
DROP TABLE IF EXISTS public.order_disputes;
DROP TABLE IF EXISTS public.order_refunds;
DROP TABLE IF EXISTS public.order_events;
DROP TABLE IF EXISTS public.payment_attempts;
DROP TABLE IF EXISTS public.stripe_events;
DROP TABLE IF EXISTS public.shipping_quotes;
DROP TABLE IF EXISTS public.checkout_attempts;

DROP INDEX IF EXISTS public.orders_stripe_session_uniq;
DROP INDEX IF EXISTS public.orders_stripe_customer_idx;
DROP INDEX IF EXISTS public.orders_payment_status_idx;
DROP INDEX IF EXISTS public.orders_fulfillment_status_idx;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_refund_status_check,
  DROP CONSTRAINT IF EXISTS orders_dispute_status_check;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','paid','in_production','shipped','delivered','cancelled','failed','fulfillment_failed'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status IN (
    'pending_payment','paid','rendering_print','print_ready',
    'submitted_to_gelato','manual_review','failed'
  ));

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_charge_id,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_method_type,
  DROP COLUMN IF EXISTS receipt_url,
  DROP COLUMN IF EXISTS amount_subtotal_cents,
  DROP COLUMN IF EXISTS amount_shipping_cents,
  DROP COLUMN IF EXISTS amount_tax_cents,
  DROP COLUMN IF EXISTS amount_discount_cents,
  DROP COLUMN IF EXISTS amount_total_cents,
  DROP COLUMN IF EXISTS amount_refunded_cents,
  DROP COLUMN IF EXISTS shipping_quote_id,
  DROP COLUMN IF EXISTS shipment_method_uid,
  DROP COLUMN IF EXISTS quote_expires_at,
  DROP COLUMN IF EXISTS refund_status,
  DROP COLUMN IF EXISTS dispute_status,
  DROP COLUMN IF EXISTS risk_level;

COMMIT;
