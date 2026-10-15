-- Список функций в public, которые больше не вызываются ни одним триггером
-- (кандидаты на DROP после первой и второй волны удаления триггеров).
-- Запуск: psql -U ai_user -d ai_services -f list_orphan_trigger_functions.sql
-- ВНИМАНИЕ: перед DROP FUNCTION убедиться, что функцию не вызывает приложение (raw SQL, ORM).

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_trigger t ON t.tgfoid = p.oid AND NOT t.tgisinternal
WHERE n.nspname = 'public'
  AND t.tgfoid IS NULL
  AND p.proname IN (
    'trigger_refresh_dashboard_stats',
    'audit_chat_attachment_changes',
    'log_generation_attempt',
    'trigger_track_ai_generation',
    'trigger_alert_escalation',
    'calculate_ab_test_metrics',
    'calculate_jtbd_opportunity_score',
    'calculate_vp_overall_score',
    'calculate_ab_test_conversion_rates',
    'content_documents_version_trigger',
    'update_porter_overall_attractiveness',
    'calculate_bi_run_duration',
    'ensure_single_active_layout',
    'set_project_research_completed_at',
    'set_project_research_started_at',
    'set_elite_documents_counts',
    'increment_revision_count',
    'log_research_activity'
  )
ORDER BY 1, 2;
