-- Drop functions that are no longer used by any trigger (after first and second wave).
-- См. docs/TRIGGERS_KEEP_VS_REMOVE.md §5. Применять после бэкапа БД.
-- Запуск: psql -U ai_user -d ai_services -f drop_functions_third_wave.sql

BEGIN;

DROP FUNCTION IF EXISTS public.audit_chat_attachment_changes();
DROP FUNCTION IF EXISTS public.calculate_ab_test_conversion_rates();
DROP FUNCTION IF EXISTS public.calculate_ab_test_metrics();
DROP FUNCTION IF EXISTS public.calculate_bi_run_duration();
DROP FUNCTION IF EXISTS public.calculate_jtbd_opportunity_score();
DROP FUNCTION IF EXISTS public.calculate_vp_overall_score();
DROP FUNCTION IF EXISTS public.content_documents_version_trigger();
DROP FUNCTION IF EXISTS public.ensure_single_active_layout();
DROP FUNCTION IF EXISTS public.increment_revision_count();
DROP FUNCTION IF EXISTS public.log_generation_attempt();
DROP FUNCTION IF EXISTS public.log_research_activity();
DROP FUNCTION IF EXISTS public.set_elite_documents_counts();
DROP FUNCTION IF EXISTS public.set_project_research_completed_at();
DROP FUNCTION IF EXISTS public.set_project_research_started_at();
DROP FUNCTION IF EXISTS public.trigger_alert_escalation();
DROP FUNCTION IF EXISTS public.trigger_refresh_dashboard_stats();
DROP FUNCTION IF EXISTS public.trigger_track_ai_generation();
DROP FUNCTION IF EXISTS public.update_porter_overall_attractiveness();

COMMIT;
