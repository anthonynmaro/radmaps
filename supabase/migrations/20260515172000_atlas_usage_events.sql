BEGIN;

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

COMMIT;
