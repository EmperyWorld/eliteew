-- Drop triggers (first wave) — см. docs/TRIGGERS_KEEP_VS_REMOVE.md
-- Применять после бэкапа БД. Запуск: psql -U ai_user -d ai_services -f drop_triggers_first_wave.sql
-- Или: POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=30000 ... ./docker/scripts/apply-eliteew-migrations.sh (если скрипт поддерживает произвольный файл)

BEGIN;

-- Дубликат updated_at
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;

-- NOTIFY refresh (никто не слушает)
DROP TRIGGER IF EXISTS trigger_refresh_stats_chat_sessions ON public.chat_sessions;
DROP TRIGGER IF EXISTS trigger_refresh_stats_elite_docs ON public.elite_documents;
DROP TRIGGER IF EXISTS trigger_refresh_stats_presentations ON public.presentations;
DROP TRIGGER IF EXISTS trigger_refresh_stats_unified_content ON public.unified_content;

-- Аудит не на users
DROP TRIGGER IF EXISTS audit_companies ON public.companies;
DROP TRIGGER IF EXISTS audit_customer_segments ON public.customer_segments;
DROP TRIGGER IF EXISTS audit_financial_models ON public.financial_models;
DROP TRIGGER IF EXISTS audit_job_stories ON public.job_stories;
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
DROP TRIGGER IF EXISTS audit_swot_analyses ON public.swot_analyses;
DROP TRIGGER IF EXISTS audit_value_propositions ON public.value_propositions;

-- Логирование в триггерах
DROP TRIGGER IF EXISTS chat_attachment_audit_trigger ON public.chat_messages;
DROP TRIGGER IF EXISTS trigger_log_generation_attempt ON public.generation_requests;
DROP TRIGGER IF EXISTS research_projects_activity_log ON public.research_projects;

-- AI tracking, alert escalation
DROP TRIGGER IF EXISTS trigger_ai_generation_tracking ON public.ai_generations;
DROP TRIGGER IF EXISTS trigger_alert_auto_escalation ON public.alerts;

-- Доменная логика research/marketing/jtbd/porter/BI/elite
DROP TRIGGER IF EXISTS jtbd_ab_tests_calculate_metrics ON public.jtbd_ab_tests;
DROP TRIGGER IF EXISTS jtbd_jobs_calculate_opportunity ON public.jtbd_jobs;
DROP TRIGGER IF EXISTS jtbd_value_propositions_calculate_overall ON public.jtbd_value_propositions;
DROP TRIGGER IF EXISTS calculate_conversion_rates_on_update ON public.offer_ab_tests;
DROP TRIGGER IF EXISTS trg_content_documents_version ON public.content_documents;
DROP TRIGGER IF EXISTS porter_forces_update_overall ON public.porter_forces;
DROP TRIGGER IF EXISTS trigger_bi_run_duration ON public.bi_airflow_runs;
DROP TRIGGER IF EXISTS ensure_single_active_layout_trigger ON public.marketing_dashboard_layouts;
DROP TRIGGER IF EXISTS trigger_project_research_completed_at ON public.project_researches;
DROP TRIGGER IF EXISTS trigger_project_research_started_at ON public.project_researches;
DROP TRIGGER IF EXISTS trigger_elite_documents_counts ON public.elite_documents;
DROP TRIGGER IF EXISTS trigger_increment_revision_count ON public.elite_documents;

COMMIT;
