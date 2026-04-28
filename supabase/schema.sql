-- ─── TrailMaps Database Schema ────────────────────────────────────────────────
-- Run this via: supabase db push  (or paste into Supabase SQL Editor)

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maps_user_id_idx ON public.maps (user_id);
CREATE INDEX IF NOT EXISTS maps_status_idx ON public.maps (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_maps_updated_at ON public.maps;
CREATE TRIGGER set_maps_updated_at
  BEFORE UPDATE ON public.maps
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
  total_cents           INT NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'usd',
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

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

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
ALTER TABLE public.orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

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

-- ─── Storage Buckets ──────────────────────────────────────────────────────────
-- Create these via Supabase dashboard or CLI:
-- supabase storage buckets create maps --public=false
-- supabase storage buckets create thumbnails --public=true
-- supabase storage buckets create gpx-uploads --public=false
