ALTER TABLE public.orders
  DROP COLUMN IF EXISTS pricing_synced_at,
  DROP COLUMN IF EXISTS pricing_rounding_rule,
  DROP COLUMN IF EXISTS pricing_markup_bps,
  DROP COLUMN IF EXISTS retail_unit_price_cents,
  DROP COLUMN IF EXISTS gelato_product_cost_cents,
  DROP COLUMN IF EXISTS pricing_country_code,
  DROP COLUMN IF EXISTS pricing_snapshot_id;

ALTER TABLE public.checkout_attempts
  DROP COLUMN IF EXISTS pricing_synced_at,
  DROP COLUMN IF EXISTS pricing_rounding_rule,
  DROP COLUMN IF EXISTS pricing_markup_bps,
  DROP COLUMN IF EXISTS retail_unit_price_cents,
  DROP COLUMN IF EXISTS gelato_product_cost_cents,
  DROP COLUMN IF EXISTS pricing_country_code,
  DROP COLUMN IF EXISTS pricing_snapshot_id;

DROP TRIGGER IF EXISTS set_gelato_product_prices_updated_at ON public.gelato_product_prices;
DROP TABLE IF EXISTS public.gelato_product_prices;
