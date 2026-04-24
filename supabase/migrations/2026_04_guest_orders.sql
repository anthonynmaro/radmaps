-- ─── Guest orders + premade map purchases ────────────────────────────────
-- Apply this migration via Supabase SQL Editor or `supabase db push`.
--
-- Adds:
--   • `orders.user_id` nullable (guest purchases)
--   • `orders.map_id`  nullable (premade catalog purchases)
--   • `orders.guest_email`, `orders.premade_slug`, `orders.premade_title`
--   • CHECK constraints so every order still has a customer identity and a
--     product reference.
--   • RLS policies for guest lookup by order id (used on the success page).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- Relax NOT NULL
ALTER TABLE public.orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orders
  ALTER COLUMN map_id DROP NOT NULL;

-- New columns for guest + premade purchases
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_email   TEXT,
  ADD COLUMN IF NOT EXISTS premade_slug  TEXT,
  ADD COLUMN IF NOT EXISTS premade_title TEXT;

-- CHECK: every order must identify a customer (user_id OR guest_email)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_has_identity_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_has_identity_chk
    CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

-- CHECK: every order must reference a product (map_id OR premade_slug)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_has_product_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_has_product_chk
    CHECK (map_id IS NOT NULL OR premade_slug IS NOT NULL);

CREATE INDEX IF NOT EXISTS orders_guest_email_idx ON public.orders (guest_email);
CREATE INDEX IF NOT EXISTS orders_premade_slug_idx ON public.orders (premade_slug);

COMMIT;
