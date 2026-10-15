-- Add indexes on FK child columns to avoid full table scans on parent DELETE/UPDATE and improve JOINs.
-- See docs/DB_PITFALLS_AND_QUIRKS.md §7. All CREATE INDEX IF NOT EXISTS — idempotent.

BEGIN;

-- ai_generations
CREATE INDEX IF NOT EXISTS idx_ai_generations_parent_generation_id ON public.ai_generations (parent_generation_id);

-- analysis_type_templates
CREATE INDEX IF NOT EXISTS idx_analysis_type_templates_created_by ON public.analysis_type_templates (created_by);

-- user_avatar_history
CREATE INDEX IF NOT EXISTS idx_user_avatar_history_content_id ON public.user_avatar_history (content_id);

-- project_members
CREATE INDEX IF NOT EXISTS idx_project_members_invited_by ON public.project_members (invited_by);

-- job_stories
CREATE INDEX IF NOT EXISTS idx_job_stories_company_id ON public.job_stories (company_id);
CREATE INDEX IF NOT EXISTS idx_job_stories_validated_by ON public.job_stories (validated_by);

-- value_propositions
CREATE INDEX IF NOT EXISTS idx_value_propositions_approved_by ON public.value_propositions (approved_by);

-- porters_analyses
CREATE INDEX IF NOT EXISTS idx_porters_analyses_company_id ON public.porters_analyses (company_id);

-- swot_ai_sessions
CREATE INDEX IF NOT EXISTS idx_swot_ai_sessions_document_id ON public.swot_ai_sessions (document_id);

-- competitor_alerts
CREATE INDEX IF NOT EXISTS idx_competitor_alerts_scraping_log_id ON public.competitor_alerts (scraping_log_id);

-- workflow_templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON public.workflow_templates (created_by);

-- workflow_connections
CREATE INDEX IF NOT EXISTS idx_workflow_connections_source_node_id ON public.workflow_connections (source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_connections_target_node_id ON public.workflow_connections (target_node_id);

-- comfyui_workflows
CREATE INDEX IF NOT EXISTS idx_comfyui_workflows_created_by ON public.comfyui_workflows (created_by);

-- telegram_bot_permissions
CREATE INDEX IF NOT EXISTS idx_telegram_bot_permissions_granted_by ON public.telegram_bot_permissions (granted_by);

-- telegram_chat_syncs
CREATE INDEX IF NOT EXISTS idx_telegram_chat_syncs_bot_id ON public.telegram_chat_syncs (bot_id);

-- research_templates
CREATE INDEX IF NOT EXISTS idx_research_templates_created_by ON public.research_templates (created_by);

-- research_comments
CREATE INDEX IF NOT EXISTS idx_research_comments_resolved_by ON public.research_comments (resolved_by);

-- jtbd_jobs
CREATE INDEX IF NOT EXISTS idx_jtbd_jobs_source_document_id ON public.jtbd_jobs (source_document_id);

-- jtbd_ab_tests
CREATE INDEX IF NOT EXISTS idx_jtbd_ab_tests_variant_a_id ON public.jtbd_ab_tests (variant_a_id);
CREATE INDEX IF NOT EXISTS idx_jtbd_ab_tests_variant_b_id ON public.jtbd_ab_tests (variant_b_id);

-- porter_analyses
CREATE INDEX IF NOT EXISTS idx_porter_analyses_created_by ON public.porter_analyses (created_by);
CREATE INDEX IF NOT EXISTS idx_porter_analyses_research_id ON public.porter_analyses (research_id);

-- competitive_analyses
CREATE INDEX IF NOT EXISTS idx_competitive_analyses_company_id ON public.competitive_analyses (company_id);
CREATE INDEX IF NOT EXISTS idx_competitive_analyses_created_by ON public.competitive_analyses (created_by);

-- content_comparisons
CREATE INDEX IF NOT EXISTS idx_content_comparisons_created_by ON public.content_comparisons (created_by);
CREATE INDEX IF NOT EXISTS idx_content_comparisons_winner_id ON public.content_comparisons (winner_id);

-- swot_factors (таблица в API: marketing_cabinet/analysis.py и др.)
CREATE INDEX IF NOT EXISTS idx_swot_factors_source_document_id ON public.swot_factors (source_document_id);
CREATE INDEX IF NOT EXISTS idx_swot_factors_swot_analysis_id ON public.swot_factors (swot_analysis_id);
CREATE INDEX IF NOT EXISTS idx_swot_factors_validated_by ON public.swot_factors (validated_by);

-- system_settings
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings (updated_by);

-- presentation_comments
CREATE INDEX IF NOT EXISTS idx_presentation_comments_resolved_by ON public.presentation_comments (resolved_by);

-- presentation_permissions
CREATE INDEX IF NOT EXISTS idx_presentation_permissions_granted_by ON public.presentation_permissions (granted_by);

-- user_installed_apps
CREATE INDEX IF NOT EXISTS idx_user_installed_apps_app_id ON public.user_installed_apps (app_id);

-- user_credit_transactions
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_admin_user_id ON public.user_credit_transactions (admin_user_id);

-- alerts
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_by ON public.alerts (acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_alerts_escalated_to ON public.alerts (escalated_to);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_by ON public.alerts (resolved_by);

-- unified_content_comment_threads
CREATE INDEX IF NOT EXISTS idx_unified_content_comment_threads_created_by ON public.unified_content_comment_threads (created_by);

-- unified_content_comments
CREATE INDEX IF NOT EXISTS idx_unified_content_comments_author_id ON public.unified_content_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_unified_content_comments_parent_comment_id ON public.unified_content_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_unified_content_comments_resolved_by ON public.unified_content_comments (resolved_by);

-- ewrp_jobs
CREATE INDEX IF NOT EXISTS idx_ewrp_jobs_user_id ON public.ewrp_jobs (user_id);

-- friend_requests
CREATE INDEX IF NOT EXISTS idx_friend_requests_responded_by ON public.friend_requests (responded_by);

-- friend_request_history
CREATE INDEX IF NOT EXISTS idx_friend_request_history_actor_user_id ON public.friend_request_history (actor_user_id);

-- gaf_chats
CREATE INDEX IF NOT EXISTS idx_gaf_chats_last_read_message_id_user_1 ON public.gaf_chats (last_read_message_id_user_1);
CREATE INDEX IF NOT EXISTS idx_gaf_chats_last_read_message_id_user_2 ON public.gaf_chats (last_read_message_id_user_2);

-- gaf_message_keys
CREATE INDEX IF NOT EXISTS idx_gaf_message_keys_message_id ON public.gaf_message_keys (message_id);
CREATE INDEX IF NOT EXISTS idx_gaf_message_keys_user_id ON public.gaf_message_keys (user_id);

COMMIT;
