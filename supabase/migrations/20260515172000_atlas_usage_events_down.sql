BEGIN;

DROP POLICY IF EXISTS "Service role manages atlas usage events" ON public.atlas_usage_events;
DROP INDEX IF EXISTS public.atlas_usage_events_order_idx;
DROP INDEX IF EXISTS public.atlas_usage_events_map_idx;
DROP INDEX IF EXISTS public.atlas_usage_events_event_idx;
DROP INDEX IF EXISTS public.atlas_usage_events_manifest_style_idx;
DROP INDEX IF EXISTS public.atlas_usage_events_created_at_idx;
DROP TABLE IF EXISTS public.atlas_usage_events;

COMMIT;
