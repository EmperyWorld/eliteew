-- Drop functions that became orphan after final wave of trigger drops (only the 16 keep triggers remain).
-- См. docs/TRIGGERS_KEEP_VS_REMOVE.md §1. Применять после drop_triggers_final_wave.sql.

BEGIN;

DROP FUNCTION IF EXISTS public.doc_collaboration_invites_updated_at();
DROP FUNCTION IF EXISTS public.ensure_single_active_avatar();
DROP FUNCTION IF EXISTS public.increment_session_messages();
DROP FUNCTION IF EXISTS public.update_brotherhood_updated_at();
DROP FUNCTION IF EXISTS public.update_chat_session_stats(session_uuid uuid);
DROP FUNCTION IF EXISTS public.update_chat_session_stats();
DROP FUNCTION IF EXISTS public.update_credit_packages_updated_at();
DROP FUNCTION IF EXISTS public.update_desktop_updated_at();
DROP FUNCTION IF EXISTS public.update_elite_chat_config_updated_at();
DROP FUNCTION IF EXISTS public.update_elite_documents_updated_at();
DROP FUNCTION IF EXISTS public.update_floating_widget_templates_timestamp();
DROP FUNCTION IF EXISTS public.update_floating_widgets_timestamp();
DROP FUNCTION IF EXISTS public.update_generation_cache_updated_at();
DROP FUNCTION IF EXISTS public.update_generation_providers_updated_at();
DROP FUNCTION IF EXISTS public.update_generation_queue_updated_at();
DROP FUNCTION IF EXISTS public.update_generation_requests_updated_at();
DROP FUNCTION IF EXISTS public.update_generation_templates_updated_at();
DROP FUNCTION IF EXISTS public.update_generation_types_updated_at();
DROP FUNCTION IF EXISTS public.update_live_voice_settings_updated_at();
DROP FUNCTION IF EXISTS public.update_medical_record_timestamp();
DROP FUNCTION IF EXISTS public.update_presentation_comments_updated_at();
DROP FUNCTION IF EXISTS public.update_presentations_timestamp();
DROP FUNCTION IF EXISTS public.update_research_updated_at();
DROP FUNCTION IF EXISTS public.update_talkmate_avatars_updated_at();
DROP FUNCTION IF EXISTS public.update_talkmate_sessions_updated_at();
DROP FUNCTION IF EXISTS public.update_telegram_updated_at();
DROP FUNCTION IF EXISTS public.update_template_timestamp();
DROP FUNCTION IF EXISTS public.update_timestamp();
DROP FUNCTION IF EXISTS public.update_transcriptions_updated_at();
DROP FUNCTION IF EXISTS public.update_user_themes_updated_at();
DROP FUNCTION IF EXISTS public.update_value_proposition_timestamp();

COMMIT;
