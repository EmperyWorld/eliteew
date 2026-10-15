-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Удалить таблицы `public`, для которых в дереве `shared/api` не найдено упоминаний ни в `*.py`, ни в `*.sql`
-- (аудит 2026-05 — список «NO_HIT», в основном legacy Brotherhood/Telegram-расширения, старый content-batch контур и др.).
-- Invariants:
-- - Идемпотентно: `IF EXISTS`; внешние FK на эти таблицы снимаются через `CASCADE` (проверено: нет строк во внешних источниках).
-- - PostgreSQL может удалить зависимые **VIEW** без файлов в репозитории (на этом стенде: `v_content_analytics_dashboard`,
--   `v_active_research`, `v_voice_center_overview`, `v_voice_daily_stats`, `v_popular_voices`).
-- - Удаляются только перечисленные имена; остальные «пустые» таблицы — отдельными проходами после ревью.
-- Related:
-- - documentation/worklog/2026-05.md
-- ---

BEGIN;

SET LOCAL lock_timeout = '30s';
SET LOCAL statement_timeout = '120s';

DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS agent_config_history CASCADE;
DROP TABLE IF EXISTS analysis_type_favorites CASCADE;
DROP TABLE IF EXISTS brotherhood_agent_sessions CASCADE;
DROP TABLE IF EXISTS brotherhood_agents CASCADE;
DROP TABLE IF EXISTS brotherhood_creative_workspaces CASCADE;
DROP TABLE IF EXISTS brotherhood_members CASCADE;
DROP TABLE IF EXISTS brotherhood_tasks CASCADE;
DROP TABLE IF EXISTS competitor_snapshots CASCADE;
DROP TABLE IF EXISTS content_batch_items CASCADE;
DROP TABLE IF EXISTS content_batches CASCADE;
DROP TABLE IF EXISTS content_classifications CASCADE;
DROP TABLE IF EXISTS content_document_versions CASCADE;
DROP TABLE IF EXISTS content_entities CASCADE;
DROP TABLE IF EXISTS content_keywords CASCADE;
DROP TABLE IF EXISTS content_sentiments CASCADE;
DROP TABLE IF EXISTS content_topic_assignments CASCADE;
DROP TABLE IF EXISTS creative_works CASCADE;
DROP TABLE IF EXISTS elite_data_sources CASCADE;
DROP TABLE IF EXISTS elite_field_mappings CASCADE;
DROP TABLE IF EXISTS encryption_keys CASCADE;
DROP TABLE IF EXISTS entity_results CASCADE;
DROP TABLE IF EXISTS file_attachments CASCADE;
DROP TABLE IF EXISTS jtbd_clustering_tasks CASCADE;
DROP TABLE IF EXISTS jtbd_job_segments CASCADE;
DROP TABLE IF EXISTS marketing_ai_tasks CASCADE;
DROP TABLE IF EXISTS marketing_job_stories CASCADE;
DROP TABLE IF EXISTS project_hubs CASCADE;
DROP TABLE IF EXISTS research_activity_log CASCADE;
DROP TABLE IF EXISTS research_artifacts CASCADE;
DROP TABLE IF EXISTS research_collaborators CASCADE;
DROP TABLE IF EXISTS research_documents CASCADE;
DROP TABLE IF EXISTS research_insights CASCADE;
DROP TABLE IF EXISTS research_results CASCADE;
DROP TABLE IF EXISTS sentiment_results CASCADE;
DROP TABLE IF EXISTS sentiment_time_series CASCADE;
DROP TABLE IF EXISTS summary_results CASCADE;
DROP TABLE IF EXISTS swot_factor_validations CASCADE;
DROP TABLE IF EXISTS taggings CASCADE;
DROP TABLE IF EXISTS telegram_analytics CASCADE;
DROP TABLE IF EXISTS telegram_bot_custom_commands CASCADE;
DROP TABLE IF EXISTS telegram_bots CASCADE;
DROP TABLE IF EXISTS telegram_channels CASCADE;
DROP TABLE IF EXISTS telegram_comfyui_generations CASCADE;
DROP TABLE IF EXISTS telegram_groups CASCADE;
DROP TABLE IF EXISTS telegram_orchestrator_logs CASCADE;
DROP TABLE IF EXISTS telegram_orchestrator_tasks CASCADE;
DROP TABLE IF EXISTS telegram_recurring_tasks CASCADE;
DROP TABLE IF EXISTS telegram_scheduled_posts CASCADE;
DROP TABLE IF EXISTS telegram_user_states CASCADE;
DROP TABLE IF EXISTS topic_evolution CASCADE;
DROP TABLE IF EXISTS topic_results CASCADE;
DROP TABLE IF EXISTS user_calendar_events CASCADE;
DROP TABLE IF EXISTS user_security_logs CASCADE;
DROP TABLE IF EXISTS value_proposition_templates CASCADE;
DROP TABLE IF EXISTS voice_synthesis_history CASCADE;
DROP TABLE IF EXISTS workflow_execution_steps CASCADE;

COMMIT;
