-- ─── TrailMaps Database Schema ────────────────────────────────────────────────
-- Run this via: supabase db push  (or paste into Supabase SQL Editor)

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ─── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email               TEXT NOT NULL,
  full_name           TEXT,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── maps ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  geojson         JSONB NOT NULL,
  bbox            FLOAT8[4] NOT NULL,  -- [minLng, minLat, maxLng, maxLat]
  stats           JSONB NOT NULL DEFAULT '{}',
  style_config    JSONB NOT NULL,
  thumbnail_url   TEXT,
  render_url      TEXT,
  pdf_url         TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'rendering', 'rendered', 'ordered')),
  is_public       BOOLEAN NOT NULL DEFAULT false,
  location_label  TEXT,
  location_city   TEXT,
  location_region TEXT,
  location_country TEXT,
  location_lng    DOUBLE PRECISION,
  location_lat    DOUBLE PRECISION,
  location        extensions.geography(POINT, 4326),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maps_location_lng_lat_chk CHECK (
    (location_lng IS NULL AND location_lat IS NULL)
    OR (
      location_lng BETWEEN -180 AND 180
      AND location_lat BETWEEN -90 AND 90
    )
  )
);

CREATE INDEX IF NOT EXISTS maps_user_id_idx ON public.maps (user_id);
CREATE INDEX IF NOT EXISTS maps_status_idx ON public.maps (status);
CREATE INDEX IF NOT EXISTS maps_location_gist_idx ON public.maps USING GIST (location);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_location_point_from_lnglat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.location_lng IS NULL OR NEW.location_lat IS NULL THEN
    NEW.location = NULL;
  ELSE
    NEW.location = extensions.st_setsrid(
      extensions.st_makepoint(NEW.location_lng, NEW.location_lat),
      4326
    )::extensions.geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_maps_updated_at ON public.maps;
CREATE TRIGGER set_maps_updated_at
  BEFORE UPDATE ON public.maps
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_maps_location_point ON public.maps;
CREATE TRIGGER set_maps_location_point
  BEFORE INSERT OR UPDATE OF location_lng, location_lat ON public.maps
  FOR EACH ROW EXECUTE PROCEDURE public.set_location_point_from_lnglat();

-- ─── coupons ────────────────────────────────────────────────────────────────
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
  CONSTRAINT coupons_slug_chk CHECK (slug ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  CONSTRAINT coupons_percent_off_chk CHECK (percent_off > 0 AND percent_off <= 100),
  CONSTRAINT coupons_max_redemptions_chk CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT coupons_email_chk CHECK (email IS NULL OR email = lower(btrim(email)))
);

CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons (active, expires_at);
CREATE INDEX IF NOT EXISTS coupons_email_idx ON public.coupons (email) WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS set_coupons_updated_at ON public.coupons;
CREATE TRIGGER set_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ─── orders ───────────────────────────────────────────────────────────────────
-- Supports both (a) logged-in user orders and (b) guest orders for premade
-- catalog purchases. Exactly one of user_id / guest_email must be present,
-- and exactly one of map_id / premade_slug must be present (enforced via
-- CHECK constraints below).
CREATE TABLE IF NOT EXISTS public.orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES public.profiles(id),   -- null for guest orders
  map_id                UUID REFERENCES public.maps(id),        -- null for premade orders
  guest_email           TEXT,                                   -- set when user_id is null
  premade_slug          TEXT,                                   -- set when map_id is null
  premade_title         TEXT,
  stripe_pi_id          TEXT NOT NULL UNIQUE,
  gelato_order_id       TEXT,              -- Gelato's internal order ID
  product_uid           TEXT NOT NULL,     -- Gelato productUid (e.g. 'flat_product_pf_18x24_...') or 'digital'
  print_size            TEXT NOT NULL,     -- Human-readable label (e.g. '18×24"')
  quantity              INT NOT NULL DEFAULT 1,
  shipping_address      JSONB NOT NULL,
  subtotal_cents         INT NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents         INT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents           INT NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'usd',
  coupon_id             UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_slug           TEXT CHECK (coupon_slug IS NULL OR coupon_slug ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','in_production','shipped','delivered','cancelled','failed','fulfillment_failed')),
  tracking_code         TEXT,             -- Carrier tracking code from Gelato
  carrier               TEXT,             -- Shipping carrier name
  digital_url           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_has_identity_chk
    CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL),
  CONSTRAINT orders_has_product_chk
    CHECK (map_id IS NOT NULL OR premade_slug IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx      ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_map_id_idx       ON public.orders (map_id);
CREATE INDEX IF NOT EXISTS orders_stripe_pi_idx    ON public.orders (stripe_pi_id);
CREATE INDEX IF NOT EXISTS orders_gelato_order_idx ON public.orders (gelato_order_id);
CREATE INDEX IF NOT EXISTS orders_guest_email_idx  ON public.orders (guest_email);
CREATE INDEX IF NOT EXISTS orders_premade_slug_idx ON public.orders (premade_slug);
CREATE INDEX IF NOT EXISTS orders_coupon_id_idx    ON public.orders (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_coupon_slug_idx  ON public.orders (coupon_slug) WHERE coupon_slug IS NOT NULL;

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ─── coupon_redemptions ─────────────────────────────────────────────────────
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
  CONSTRAINT coupon_redemptions_email_chk CHECK (buyer_email = lower(btrim(buyer_email)))
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

  IF p_cart_source NOT IN ('custom', 'premade') OR p_subtotal_cents IS NULL OR p_subtotal_cents <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_subtotal', NULL::UUID, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0;
    RETURN;
  END IF;

  SELECT * INTO v_coupon FROM public.coupons WHERE slug = v_slug FOR UPDATE;

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
    coupon_id, buyer_email, cart_source, map_id, premade_slug, product_uid,
    subtotal_cents, discount_cents, currency
  )
  VALUES (
    v_coupon.id, v_email, p_cart_source, p_map_id, p_premade_slug, p_product_uid,
    p_subtotal_cents, v_discount_cents, lower(coalesce(nullif(btrim(p_currency), ''), 'usd'))
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

REVOKE ALL ON FUNCTION public.reserve_coupon_redemption(TEXT, TEXT, TEXT, TEXT, INT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_coupon_redemption(TEXT, TEXT, TEXT, TEXT, INT, TEXT, UUID, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_coupon_summaries()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_coupon_summaries()
  TO service_role;

-- ─── strava_tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.strava_tokens (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      BIGINT NOT NULL,  -- Unix timestamp
  athlete_id      BIGINT NOT NULL
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO service_role;

-- profiles: users can read/update their own row
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- maps: full CRUD on own rows
CREATE POLICY "Users CRUD own maps" ON public.maps
  FOR ALL USING (auth.uid() = user_id);

-- maps: public share — read-only access to explicitly shared maps
CREATE POLICY "Public map share" ON public.maps
  FOR SELECT USING (is_public = true);

-- orders: users read own orders only
CREATE POLICY "Users read own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- strava_tokens: full access own row
CREATE POLICY "Users CRUD own strava tokens" ON public.strava_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ─── map_versions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.map_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id        UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label         TEXT,
  style_config  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_versions_map_id_idx ON public.map_versions (map_id);
CREATE INDEX IF NOT EXISTS map_versions_user_id_idx ON public.map_versions (user_id);

ALTER TABLE public.map_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own map versions" ON public.map_versions
  FOR ALL USING (auth.uid() = user_id);

-- ─── Stripe event deduplication ──────────────────────────────────────────────
-- Prevents duplicate Gelato orders when Stripe retries webhook delivery.
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id   TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- Accessible only via service key; no end-user RLS policies needed.
CREATE INDEX IF NOT EXISTS processed_stripe_events_created_at_idx
  ON public.processed_stripe_events (created_at);

-- ─── admin_users ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'curator', 'designer', 'support')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_role_idx
  ON public.admin_users (role)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ─── feature_flags ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feature_flag_rules_valid(rules JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(rules) = 'array'
    AND jsonb_array_length(rules) <= 10
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(rules) AS item(rule)
      WHERE jsonb_typeof(rule) IS DISTINCT FROM 'object'
        OR (rule->>'type') NOT IN ('user_list', 'admin_role', 'all_staff', 'percentage', 'everyone')
        OR jsonb_typeof(rule->'enabled') IS DISTINCT FROM 'boolean'
        OR (
          rule ? 'emails'
          AND (
            jsonb_typeof(rule->'emails') IS DISTINCT FROM 'array'
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(rule->'emails') AS email(value)
              WHERE jsonb_typeof(email.value) IS DISTINCT FROM 'string'
                OR email.value #>> '{}' IS DISTINCT FROM lower(btrim(email.value #>> '{}'))
            )
          )
        )
        OR (rule ? 'roles' AND jsonb_typeof(rule->'roles') IS DISTINCT FROM 'array')
        OR (rule ? 'user_ids' AND jsonb_typeof(rule->'user_ids') IS DISTINCT FROM 'array')
        OR (
          rule ? 'percentage'
          AND CASE
            WHEN jsonb_typeof(rule->'percentage') = 'number'
              THEN (rule->>'percentage')::NUMERIC < 0 OR (rule->>'percentage')::NUMERIC > 100
            ELSE true
          END
        )
    );
$$;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  environment  TEXT NOT NULL DEFAULT 'all'
    CHECK (environment IN ('development', 'preview', 'production', 'all')),
  enabled      BOOLEAN NOT NULL DEFAULT false,
  rules        JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at  TIMESTAMPTZ,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_key_chk CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT feature_flags_rules_valid_chk CHECK (public.feature_flag_rules_valid(rules))
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_environment_key_idx
  ON public.feature_flags (environment, key);

CREATE INDEX IF NOT EXISTS feature_flags_active_environment_idx
  ON public.feature_flags (environment, key)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS set_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER set_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.feature_flag_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id  UUID REFERENCES public.feature_flags(id) ON DELETE SET NULL,
  flag_key         TEXT NOT NULL,
  environment      TEXT NOT NULL
    CHECK (environment IN ('development', 'preview', 'production', 'all')),
  action           TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore')),
  actor_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  before           JSONB,
  after            JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_flag_events_flag_idx
  ON public.feature_flag_events (feature_flag_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feature_flag_events_key_environment_idx
  ON public.feature_flag_events (flag_key, environment, created_at DESC);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feature_flags FROM anon, authenticated;
REVOKE ALL ON TABLE public.feature_flag_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_events TO service_role;

CREATE POLICY "Service role manages feature flags" ON public.feature_flags
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role reads feature flag events" ON public.feature_flag_events
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role inserts feature flag events" ON public.feature_flag_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.feature_flags (key, name, description, environment, enabled, rules)
VALUES (
  'scout_style_agent',
  'Scout AI Style Agent',
  'Adds the Scout AI chat tab to the admin premade style editor and gates /api/agent/style.',
  'all',
  false,
  '[{"type":"admin_role","enabled":true,"roles":["admin","designer"]}]'::jsonb
)
ON CONFLICT (environment, key) DO NOTHING;

-- ─── Atlas usage accounting ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atlas_usage_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name          TEXT NOT NULL CHECK (event_name IN (
    'atlas_lab_preview_loaded',
    'style_selected',
    'layer_toggled',
    'layer_setting_changed',
    'proof_render_requested',
    'final_render_completed',
    'checkout_completed',
    'order_placed'
  )),
  atlas_manifest_id   TEXT,
  atlas_style_id      TEXT,
  atlas_version       TEXT,
  tile_schema_version TEXT,
  enabled_layers      TEXT[],
  artifact_ids        TEXT[],
  render_class        TEXT,
  print_size          TEXT,
  provider_id         TEXT,
  map_id              UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_id        TEXT,
  source              TEXT NOT NULL DEFAULT 'app',
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atlas_usage_events_metadata_object_chk
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS atlas_usage_events_created_at_idx
  ON public.atlas_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS atlas_usage_events_manifest_style_idx
  ON public.atlas_usage_events (atlas_manifest_id, atlas_style_id, created_at DESC);

CREATE INDEX IF NOT EXISTS atlas_usage_events_event_idx
  ON public.atlas_usage_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS atlas_usage_events_map_idx
  ON public.atlas_usage_events (map_id, created_at DESC)
  WHERE map_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS atlas_usage_events_order_idx
  ON public.atlas_usage_events (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.atlas_usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.atlas_usage_events FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.atlas_usage_events TO service_role;

CREATE POLICY "Service role manages atlas usage events" ON public.atlas_usage_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── premade_maps ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.premade_maps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_map_id          UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  slug                  TEXT NOT NULL UNIQUE,
  title                 TEXT NOT NULL,
  subtitle              TEXT,
  region                TEXT NOT NULL DEFAULT 'Region TBD',
  country               TEXT NOT NULL DEFAULT 'United States',
  category              TEXT NOT NULL DEFAULT 'hikes'
    CHECK (category IN ('hikes', 'trails', 'runs', 'marathons', 'mountain-biking', 'paddles', 'rivers', 'cityscapes', 'cycling', 'beaches', 'wine-trails')),
  categories            TEXT[] NOT NULL DEFAULT ARRAY['hikes']::TEXT[]
    CHECK (
      coalesce(array_length(categories, 1), 0) > 0
      AND categories <@ ARRAY['hikes', 'trails', 'runs', 'marathons', 'mountain-biking', 'paddles', 'rivers', 'cityscapes', 'cycling', 'beaches', 'wine-trails']::TEXT[]
    ),
  tagline               TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  badges                TEXT[] NOT NULL DEFAULT '{}',
  stats                 JSONB NOT NULL DEFAULT '{}',
  bbox                  FLOAT8[4],
  geojson               JSONB,
  style_config          JSONB,
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  homepage_visible      BOOLEAN NOT NULL DEFAULT false,
  homepage_sort_order   INT NOT NULL DEFAULT 1000,
  needs_preview         BOOLEAN NOT NULL DEFAULT true,
  base_price_cents      INT NOT NULL DEFAULT 2499,
  cover_gradient        TEXT[],
  preview_image_url     TEXT,
  render_url            TEXT,
  location_label        TEXT,
  location_city         TEXT,
  location_region       TEXT,
  location_country      TEXT,
  location_lng          DOUBLE PRECISION,
  location_lat          DOUBLE PRECISION,
  location              extensions.geography(POINT, 4326),
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT premade_maps_bbox_len_chk CHECK (bbox IS NULL OR array_length(bbox, 1) = 4),
  CONSTRAINT premade_maps_location_lng_lat_chk CHECK (
    (location_lng IS NULL AND location_lat IS NULL)
    OR (
      location_lng BETWEEN -180 AND 180
      AND location_lat BETWEEN -90 AND 90
    )
  )
);

CREATE INDEX IF NOT EXISTS premade_maps_status_homepage_idx
  ON public.premade_maps (status, homepage_visible, homepage_sort_order, title);
CREATE INDEX IF NOT EXISTS premade_maps_category_idx
  ON public.premade_maps (category)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS premade_maps_categories_gin_idx
  ON public.premade_maps
  USING GIN (categories)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS premade_maps_source_map_idx
  ON public.premade_maps (source_map_id);
CREATE INDEX IF NOT EXISTS premade_maps_location_published_gist_idx
  ON public.premade_maps
  USING GIST (location)
  WHERE status = 'published' AND location IS NOT NULL;

DROP TRIGGER IF EXISTS set_premade_maps_updated_at ON public.premade_maps;
CREATE TRIGGER set_premade_maps_updated_at
  BEFORE UPDATE ON public.premade_maps
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_premade_maps_location_point ON public.premade_maps;
CREATE TRIGGER set_premade_maps_location_point
  BEFORE INSERT OR UPDATE OF location_lng, location_lat ON public.premade_maps
  FOR EACH ROW EXECUTE PROCEDURE public.set_location_point_from_lnglat();

CREATE OR REPLACE FUNCTION public.nearby_published_premade_maps(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 250000,
  p_limit INT DEFAULT 48
)
RETURNS TABLE (
  id UUID,
  source_map_id UUID,
  slug TEXT,
  title TEXT,
  subtitle TEXT,
  region TEXT,
  country TEXT,
  location_label TEXT,
  location_city TEXT,
  location_region TEXT,
  location_country TEXT,
  location_lng DOUBLE PRECISION,
  location_lat DOUBLE PRECISION,
  category TEXT,
  categories TEXT[],
  tagline TEXT,
  description TEXT,
  badges TEXT[],
  stats JSONB,
  bbox FLOAT8[],
  geojson JSONB,
  style_config JSONB,
  status TEXT,
  homepage_visible BOOLEAN,
  homepage_sort_order INT,
  needs_preview BOOLEAN,
  base_price_cents INT,
  cover_gradient TEXT[],
  preview_image_url TEXT,
  render_url TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH origin AS (
    SELECT extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography AS point
  )
  SELECT
    p.id,
    p.source_map_id,
    p.slug,
    p.title,
    p.subtitle,
    p.region,
    p.country,
    p.location_label,
    p.location_city,
    p.location_region,
    p.location_country,
    p.location_lng,
    p.location_lat,
    p.category,
    p.categories,
    p.tagline,
    p.description,
    p.badges,
    p.stats,
    p.bbox,
    p.geojson,
    p.style_config,
    p.status,
    p.homepage_visible,
    p.homepage_sort_order,
    p.needs_preview,
    p.base_price_cents,
    p.cover_gradient,
    p.preview_image_url,
    p.render_url,
    p.created_by,
    p.updated_by,
    p.created_at,
    p.updated_at,
    extensions.st_distance(p.location, origin.point) AS distance_meters
  FROM public.premade_maps p, origin
  WHERE p.status = 'published'
    AND p.location IS NOT NULL
    AND p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND extensions.st_dwithin(
      p.location,
      origin.point,
      least(greatest(coalesce(p_radius_meters, 250000), 1000), 20000000)
    )
  ORDER BY p.location OPERATOR(extensions.<->) origin.point
  LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.nearby_published_premade_maps(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_published_premade_maps(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT)
  TO service_role;

ALTER TABLE public.premade_maps ENABLE ROW LEVEL SECURITY;

-- ─── Storage Buckets ──────────────────────────────────────────────────────────
-- Create these via Supabase dashboard or CLI:
-- supabase storage buckets create maps --public=false
-- supabase storage buckets create thumbnails --public=true
-- supabase storage buckets create gpx-uploads --public=false
