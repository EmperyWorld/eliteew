-- Remove personalized dashboard widgets API (product removed).
-- Drops table, trigger, and helper functions used only by dashboard_widgets router.

DROP TRIGGER IF EXISTS trigger_update_dashboard_widget_timestamp ON public.dashboard_widgets;

DROP TABLE IF EXISTS public.dashboard_widgets CASCADE;

DROP FUNCTION IF EXISTS public.update_dashboard_widget_timestamp();

DROP FUNCTION IF EXISTS public.create_default_dashboard_widgets(uuid);
DROP FUNCTION IF EXISTS public.get_user_dashboard_widgets(uuid);
DROP FUNCTION IF EXISTS public.reset_user_dashboard(uuid);
DROP FUNCTION IF EXISTS public.update_widget_position(uuid, uuid, integer, integer);

DROP FUNCTION IF EXISTS public.get_user_dashboard_stats(uuid);
DROP FUNCTION IF EXISTS public.get_user_dashboard_stats(character varying);

DROP FUNCTION IF EXISTS public.get_user_activity_timeline(uuid, integer);
