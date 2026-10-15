-- Drop unused DB functions (optimization)
-- Проверено: не вызываются из API и не используются триггерами.
-- Перед применением: бэкап БД. После: перезапуск API не обязателен.

-- Project stats (нигде не вызываются)
DROP FUNCTION IF EXISTS public.get_project_contentai_stats(uuid);
DROP FUNCTION IF EXISTS public.get_project_jtbd_stats(uuid);
DROP FUNCTION IF EXISTS public.get_project_research_stats(uuid);

-- Конкуренты / SWOT / активность (не используются в API)
DROP FUNCTION IF EXISTS public.get_competitive_landscape(uuid);
DROP FUNCTION IF EXISTS public.calculate_significance_score(jsonb, varchar);
DROP FUNCTION IF EXISTS public.calculate_swot_factor_priority();
DROP FUNCTION IF EXISTS public.calculate_user_activity_score(uuid, int4);

-- Floating widgets / layout presets (не используются в API)
DROP FUNCTION IF EXISTS public.get_user_floating_widgets(uuid);
DROP FUNCTION IF EXISTS public.update_floating_widget_position(uuid, uuid, int4, int4);
DROP FUNCTION IF EXISTS public.clone_dashboard_layout(uuid, varchar, uuid);
DROP FUNCTION IF EXISTS public.create_layout_from_preset(varchar, uuid, uuid);

-- Workflow (используется только start_workflow_execution)
DROP FUNCTION IF EXISTS public.create_workflow_from_template(uuid, uuid, varchar, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.complete_workflow_execution(uuid, varchar, jsonb, text, numeric, numeric);

-- Контент/шаринг (не вызываются в API)
DROP FUNCTION IF EXISTS public.check_content_access_with_friends(uuid, varchar, varchar, varchar, bool);
DROP FUNCTION IF EXISTS public.is_share_active(content_shares);

-- Конвертация документов (не используются в API)
DROP FUNCTION IF EXISTS public.get_conversion_targets(varchar);
DROP FUNCTION IF EXISTS public.get_format_info(varchar);
DROP FUNCTION IF EXISTS public.is_conversion_supported(varchar, varchar);

-- Дашборд/BI (не вызываются; refresh делается через invalidate cache)
DROP FUNCTION IF EXISTS public.refresh_user_dashboard_stats();
DROP FUNCTION IF EXISTS public.check_bi_views_freshness();
DROP FUNCTION IF EXISTS public.refresh_company_analyses_summary();

-- Аудит/активность (приложение пишет в audit_logs напрямую, не через функцию)
DROP FUNCTION IF EXISTS public.get_user_activity_summary(uuid, int4);
DROP FUNCTION IF EXISTS public.get_request_retry_stats(uuid);
DROP FUNCTION IF EXISTS public.compute_json_diff(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.log_audit_event(uuid, uuid, varchar, varchar, uuid, varchar, jsonb, jsonb, inet, text, jsonb);
DROP FUNCTION IF EXISTS public.create_audit_log();

-- Триггерная функция без триггера (trigger_track_failed_login ни на чём не висит)
DROP FUNCTION IF EXISTS public.trigger_track_failed_login();
