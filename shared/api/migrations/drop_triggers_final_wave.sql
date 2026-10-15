-- Финальная волна: удалить ВСЕ триггеры, кроме системно необходимых (docs/TRIGGERS_KEEP_VS_REMOVE.md §1).
-- Оставляем только: users (encrypt, updated_at, audit), user_credit_transactions (prevent modify),
-- unified_content (versioning, updated_at, search), ultimate_documents (versioning, updated_at),
-- user_sessions (login), chat_messages (stats), documents (upload security), system_metrics (set id).
-- После применения updated_at на остальных таблицах нужно проставлять в API при UPDATE.
-- Применять после бэкапа БД.

BEGIN;

-- ab_tests .. alerts
DROP TRIGGER IF EXISTS update_ab_tests_updated_at ON public.ab_tests;
DROP TRIGGER IF EXISTS trigger_agent_configs_updated_at ON public.agent_configs;
DROP TRIGGER IF EXISTS trigger_alerts_updated_at ON public.alerts;
DROP TRIGGER IF EXISTS app_access_groups_updated_at ON public.app_access_groups;

-- emperyworld chat tables (renamed from legacy schema)
DROP TRIGGER IF EXISTS update_emperyworld_chats_updated ON public.emperyworld_chats;
DROP TRIGGER IF EXISTS update_emperyworld_messages_updated ON public.emperyworld_messages;

-- chat_sessions, comments, companies, competitors, customer_segments
DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON public.chat_sessions;
DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
DROP TRIGGER IF EXISTS competitors_updated_at ON public.competitors;
DROP TRIGGER IF EXISTS update_customer_segments_updated_at ON public.customer_segments;

-- desktop
DROP TRIGGER IF EXISTS desktop_app_catalog_updated_at ON public.desktop_app_catalog;
DROP TRIGGER IF EXISTS desktop_configs_updated_at ON public.desktop_configs;
DROP TRIGGER IF EXISTS desktop_items_updated_at ON public.desktop_items;

-- doc_collaboration, elite_*, financial_models
DROP TRIGGER IF EXISTS tr_doc_collaboration_invites_updated_at ON public.doc_collaboration_invites;
DROP TRIGGER IF EXISTS trigger_update_elite_chat_config_updated_at ON public.elite_chat_config;
DROP TRIGGER IF EXISTS trigger_update_template_timestamp ON public.elite_document_templates;
DROP TRIGGER IF EXISTS trigger_elite_documents_updated_at ON public.elite_documents;
DROP TRIGGER IF EXISTS financial_models_updated_at ON public.financial_models;

-- floating_widgets, generation_*
DROP TRIGGER IF EXISTS trigger_update_floating_widget_templates_timestamp ON public.floating_widget_templates;
DROP TRIGGER IF EXISTS trigger_update_floating_widgets_timestamp ON public.floating_widgets;
DROP TRIGGER IF EXISTS trigger_generation_cache_updated_at ON public.generation_cache;
DROP TRIGGER IF EXISTS trigger_generation_queue_updated_at ON public.generation_queue;
DROP TRIGGER IF EXISTS trigger_generation_requests_updated_at ON public.generation_requests;
DROP TRIGGER IF EXISTS trigger_generation_templates_updated_at ON public.generation_templates;
DROP TRIGGER IF EXISTS trigger_generation_types_updated_at ON public.generation_types;

-- medical_*, offer_ab_tests, presentation_*, presentations, project_*, scraping_schedules
DROP TRIGGER IF EXISTS trigger_update_chat_session_stats ON public.medical_chat_messages;
DROP TRIGGER IF EXISTS trigger_update_medical_record_timestamp ON public.medical_records;
DROP TRIGGER IF EXISTS update_offer_ab_tests_updated_at ON public.offer_ab_tests;
DROP TRIGGER IF EXISTS trigger_update_presentation_comments_updated_at ON public.presentation_comments;
DROP TRIGGER IF EXISTS presentations_updated ON public.presentations;
DROP TRIGGER IF EXISTS update_project_members_updated_at ON public.project_members;
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS update_scraping_schedules_updated_at ON public.scraping_schedules;

-- swot_*, system_settings, tags
DROP TRIGGER IF EXISTS swot_analyses_updated_at ON public.swot_analyses;
DROP TRIGGER IF EXISTS swot_factors_updated_at ON public.swot_factors;
DROP TRIGGER IF EXISTS trigger_system_settings_updated_at ON public.system_settings;
DROP TRIGGER IF EXISTS update_tags_updated_at ON public.tags;

-- talkmate_*, telegram_*, transcriptions
DROP TRIGGER IF EXISTS talkmate_avatars_updated_at ON public.talkmate_avatars;
DROP TRIGGER IF EXISTS talkmate_interactions_insert ON public.talkmate_interactions;
DROP TRIGGER IF EXISTS talkmate_sessions_updated_at ON public.talkmate_sessions;
DROP TRIGGER IF EXISTS telegram_chats_updated_at ON public.telegram_chats;
DROP TRIGGER IF EXISTS telegram_notifications_updated_at ON public.telegram_notifications;
DROP TRIGGER IF EXISTS telegram_users_updated_at ON public.telegram_users;
DROP TRIGGER IF EXISTS trigger_update_transcriptions_updated_at ON public.transcriptions;

-- user_avatar_history, user_* (кроме users), value_propositions, voice_*
DROP TRIGGER IF EXISTS trg_ensure_single_active_avatar ON public.user_avatar_history;
DROP TRIGGER IF EXISTS update_live_voice_settings_updated_at ON public.user_live_voice_settings;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
DROP TRIGGER IF EXISTS update_user_themes_updated_at ON public.user_themes;
DROP TRIGGER IF EXISTS trigger_2fa_updated_at ON public.user_two_factor_auth;
DROP TRIGGER IF EXISTS trigger_voice_preferences_updated_at ON public.user_voice_preferences;
DROP TRIGGER IF EXISTS trigger_update_value_proposition_timestamp ON public.value_propositions;
DROP TRIGGER IF EXISTS trigger_voice_cache_updated_at ON public.voice_cache;
DROP TRIGGER IF EXISTS trigger_voice_stats_updated_at ON public.voice_usage_stats;

COMMIT;
