-- Gelato production-cost snapshots used to compute RadMaps retail pricing.
-- Customer-facing prices are cost * 1.5, rounded to the nearest dollar.

CREATE TABLE IF NOT EXISTS public.gelato_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_uid TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  gelato_cost_cents INT NOT NULL CHECK (gelato_cost_cents > 0),
  retail_price_cents INT NOT NULL CHECK (retail_price_cents > 0),
  markup_bps INT NOT NULL DEFAULT 5000 CHECK (markup_bps >= 0),
  rounding_rule TEXT NOT NULL DEFAULT 'nearest_dollar'
    CHECK (rounding_rule IN ('nearest_dollar')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_uid, country_code, currency, quantity)
);

CREATE INDEX IF NOT EXISTS gelato_product_prices_lookup_idx
  ON public.gelato_product_prices (product_uid, country_code, currency, quantity);
CREATE INDEX IF NOT EXISTS gelato_product_prices_synced_idx
  ON public.gelato_product_prices (synced_at DESC);

DROP TRIGGER IF EXISTS set_gelato_product_prices_updated_at ON public.gelato_product_prices;
CREATE TRIGGER set_gelato_product_prices_updated_at
  BEFORE UPDATE ON public.gelato_product_prices
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

ALTER TABLE public.gelato_product_prices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gelato_product_prices TO service_role;

ALTER TABLE public.checkout_attempts
  ADD COLUMN IF NOT EXISTS pricing_snapshot_id UUID REFERENCES public.gelato_product_prices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_country_code TEXT CHECK (pricing_country_code IS NULL OR pricing_country_code ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS gelato_product_cost_cents INT CHECK (gelato_product_cost_cents IS NULL OR gelato_product_cost_cents > 0),
  ADD COLUMN IF NOT EXISTS retail_unit_price_cents INT CHECK (retail_unit_price_cents IS NULL OR retail_unit_price_cents > 0),
  ADD COLUMN IF NOT EXISTS pricing_markup_bps INT CHECK (pricing_markup_bps IS NULL OR pricing_markup_bps >= 0),
  ADD COLUMN IF NOT EXISTS pricing_rounding_rule TEXT CHECK (pricing_rounding_rule IS NULL OR pricing_rounding_rule IN ('nearest_dollar')),
  ADD COLUMN IF NOT EXISTS pricing_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS checkout_attempts_pricing_snapshot_idx
  ON public.checkout_attempts (pricing_snapshot_id)
  WHERE pricing_snapshot_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pricing_snapshot_id UUID REFERENCES public.gelato_product_prices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_country_code TEXT CHECK (pricing_country_code IS NULL OR pricing_country_code ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS gelato_product_cost_cents INT CHECK (gelato_product_cost_cents IS NULL OR gelato_product_cost_cents > 0),
  ADD COLUMN IF NOT EXISTS retail_unit_price_cents INT CHECK (retail_unit_price_cents IS NULL OR retail_unit_price_cents > 0),
  ADD COLUMN IF NOT EXISTS pricing_markup_bps INT CHECK (pricing_markup_bps IS NULL OR pricing_markup_bps >= 0),
  ADD COLUMN IF NOT EXISTS pricing_rounding_rule TEXT CHECK (pricing_rounding_rule IS NULL OR pricing_rounding_rule IN ('nearest_dollar')),
  ADD COLUMN IF NOT EXISTS pricing_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_pricing_snapshot_idx
  ON public.orders (pricing_snapshot_id)
  WHERE pricing_snapshot_id IS NOT NULL;
