-- ─── Admin coupons + checkout redemptions ───────────────────────────────────
--
-- RadMaps owns coupon validation and reservation state. Stripe receives only
-- the matching coupon id on Checkout Session creation so payment totals remain
-- handled by Stripe while email restrictions and use-limit race protection stay
-- in Postgres.

BEGIN;

CREATE TABLE IF NOT EXISTS public.coupons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  percent_off        NUMERIC(5,2) NOT NULL,
  expires_at         TIMESTAMPTZ,
  max_redemptions    INT,
  email              TEXT,
  active             BOOLEAN NOT NULL DEFAULT true,
  stripe_coupon_id   TEXT NOT NULL UNIQUE,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupons_slug_chk
    CHECK (slug ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  CONSTRAINT coupons_percent_off_chk
    CHECK (percent_off > 0 AND percent_off <= 100),
  CONSTRAINT coupons_max_redemptions_chk
    CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT coupons_email_chk
    CHECK (email IS NULL OR email = lower(btrim(email)))
);

CREATE INDEX IF NOT EXISTS coupons_active_idx
  ON public.coupons (active, expires_at);
CREATE INDEX IF NOT EXISTS coupons_email_idx
  ON public.coupons (email)
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS set_coupons_updated_at ON public.coupons;
CREATE TRIGGER set_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id          UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  stripe_session_id  TEXT,
  order_id           UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_email        TEXT NOT NULL,
  cart_source        TEXT NOT NULL CHECK (cart_source IN ('custom','premade')),
  map_id             UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  premade_slug       TEXT,
  product_uid        TEXT NOT NULL,
  subtotal_cents     INT NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents     INT NOT NULL CHECK (discount_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'usd',
  status             TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','redeemed','released','expired')),
  reserved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '25 hours'),
  redeemed_at        TIMESTAMPTZ,
  released_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemptions_email_chk
    CHECK (buyer_email = lower(btrim(buyer_email)))
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_status_idx
  ON public.coupon_redemptions (coupon_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_session_uniq
  ON public.coupon_redemptions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupon_redemptions_order_idx
  ON public.coupon_redemptions (order_id)
  WHERE order_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_coupon_redemptions_updated_at ON public.coupon_redemptions;
CREATE TRIGGER set_coupon_redemptions_updated_at
  BEFORE UPDATE ON public.coupon_redemptions
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal_cents INT,
  ADD COLUMN IF NOT EXISTS discount_cents INT,
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_slug TEXT;

UPDATE public.orders
   SET subtotal_cents = COALESCE(subtotal_cents, total_cents),
       discount_cents = COALESCE(discount_cents, 0)
 WHERE subtotal_cents IS NULL
    OR discount_cents IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN subtotal_cents SET DEFAULT 0,
  ALTER COLUMN subtotal_cents SET NOT NULL,
  ALTER COLUMN discount_cents SET DEFAULT 0,
  ALTER COLUMN discount_cents SET NOT NULL,
  DROP CONSTRAINT IF EXISTS orders_subtotal_cents_chk,
  ADD CONSTRAINT orders_subtotal_cents_chk CHECK (subtotal_cents >= 0),
  DROP CONSTRAINT IF EXISTS orders_discount_cents_chk,
  ADD CONSTRAINT orders_discount_cents_chk CHECK (discount_cents >= 0),
  DROP CONSTRAINT IF EXISTS orders_coupon_slug_chk,
  ADD CONSTRAINT orders_coupon_slug_chk
    CHECK (coupon_slug IS NULL OR coupon_slug ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');

CREATE INDEX IF NOT EXISTS orders_coupon_id_idx
  ON public.orders (coupon_id)
  WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_coupon_slug_idx
  ON public.orders (coupon_slug)
  WHERE coupon_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_coupon_redemption(
  p_slug TEXT,
  p_buyer_email TEXT,
  p_cart_source TEXT,
  p_product_uid TEXT,
  p_subtotal_cents INT,
  p_currency TEXT DEFAULT 'usd',
  p_map_id UUID DEFAULT NULL,
  p_premade_slug TEXT DEFAULT NULL
)
RETURNS TABLE (
  ok BOOLEAN,
  error_code TEXT,
  coupon_id UUID,
  redemption_id UUID,
  stripe_coupon_id TEXT,
  percent_off NUMERIC,
  discount_cents INT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug TEXT := upper(btrim(p_slug));
  v_email TEXT := lower(btrim(p_buyer_email));
  v_coupon public.coupons%ROWTYPE;
  v_redeemed_count INT := 0;
  v_reserved_count INT := 0;
  v_discount_cents INT := 0;
  v_redemption_id UUID;
BEGIN
  UPDATE public.coupon_redemptions
     SET status = 'expired'
   WHERE status = 'reserved'
     AND expires_at <= now();

  IF v_slug !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' THEN
    RETURN QUERY SELECT false, 'invalid_slug', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN QUERY SELECT false, 'invalid_email', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  IF p_cart_source NOT IN ('custom', 'premade') THEN
    RETURN QUERY SELECT false, 'invalid_cart_source', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  IF p_subtotal_cents IS NULL OR p_subtotal_cents <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_subtotal', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  SELECT *
    INTO v_coupon
    FROM public.coupons
   WHERE slug = v_slug
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  IF NOT v_coupon.active THEN
    RETURN QUERY SELECT false, 'inactive', v_coupon.id, NULL::UUID, NULL::TEXT, v_coupon.percent_off, 0;
    RETURN;
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'expired', v_coupon.id, NULL::UUID, NULL::TEXT, v_coupon.percent_off, 0;
    RETURN;
  END IF;

  IF v_coupon.email IS NOT NULL AND v_coupon.email <> v_email THEN
    RETURN QUERY SELECT false, 'email_mismatch', v_coupon.id, NULL::UUID, NULL::TEXT, v_coupon.percent_off, 0;
    RETURN;
  END IF;

  SELECT count(*) INTO v_redeemed_count
    FROM public.coupon_redemptions
   WHERE coupon_redemptions.coupon_id = v_coupon.id
     AND status = 'redeemed';

  SELECT count(*) INTO v_reserved_count
    FROM public.coupon_redemptions
   WHERE coupon_redemptions.coupon_id = v_coupon.id
     AND status = 'reserved'
     AND expires_at > now();

  IF v_coupon.max_redemptions IS NOT NULL
     AND (v_redeemed_count + v_reserved_count) >= v_coupon.max_redemptions THEN
    RETURN QUERY SELECT false, 'limit_reached', v_coupon.id, NULL::UUID, NULL::TEXT, v_coupon.percent_off, 0;
    RETURN;
  END IF;

  v_discount_cents := LEAST(
    p_subtotal_cents,
    GREATEST(0, round((p_subtotal_cents::NUMERIC * v_coupon.percent_off) / 100)::INT)
  );

  INSERT INTO public.coupon_redemptions (
    coupon_id,
    buyer_email,
    cart_source,
    map_id,
    premade_slug,
    product_uid,
    subtotal_cents,
    discount_cents,
    currency
  )
  VALUES (
    v_coupon.id,
    v_email,
    p_cart_source,
    p_map_id,
    p_premade_slug,
    p_product_uid,
    p_subtotal_cents,
    v_discount_cents,
    lower(coalesce(nullif(btrim(p_currency), ''), 'usd'))
  )
  RETURNING id INTO v_redemption_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_coupon.id, v_redemption_id, v_coupon.stripe_coupon_id, v_coupon.percent_off, v_discount_cents;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_coupon_summaries()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  percent_off NUMERIC,
  expires_at TIMESTAMPTZ,
  max_redemptions INT,
  email TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  redeemed_count BIGINT,
  reserved_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.slug,
    c.percent_off,
    c.expires_at,
    c.max_redemptions,
    c.email,
    c.active,
    c.created_at,
    c.updated_at,
    count(r.id) FILTER (WHERE r.status = 'redeemed') AS redeemed_count,
    count(r.id) FILTER (WHERE r.status = 'reserved' AND r.expires_at > now()) AS reserved_count
  FROM public.coupons c
  LEFT JOIN public.coupon_redemptions r
    ON r.coupon_id = c.id
   AND (
     r.status = 'redeemed'
     OR (r.status = 'reserved' AND r.expires_at > now())
   )
  GROUP BY c.id
  ORDER BY c.created_at DESC;
$$;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO service_role;

REVOKE ALL ON FUNCTION public.reserve_coupon_redemption(TEXT, TEXT, TEXT, TEXT, INT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_coupon_redemption(TEXT, TEXT, TEXT, TEXT, INT, TEXT, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_coupon_summaries()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_coupon_summaries()
  TO service_role;

COMMENT ON TABLE public.coupons IS
  'Server-managed RadMaps coupons. End users validate and redeem only through Nitro checkout APIs.';
COMMENT ON TABLE public.coupon_redemptions IS
  'Coupon reservation and redemption audit log. Reserved rows protect limited coupons while Stripe Checkout sessions are open.';

COMMIT;
