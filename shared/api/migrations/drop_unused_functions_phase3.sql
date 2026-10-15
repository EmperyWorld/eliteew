-- Phase 3: ещё неиспользуемые функции (проверено: нет вызовов в API)
-- archive_old_* — не вызываются; приложение не использует
-- cleanup_* (DB) — приложение делает свою очистку (session_service, medical_service), DB-функции не дергает
-- остальные — нет вызовов в коде

DROP FUNCTION IF EXISTS public.archive_old_audit_logs(int4);
DROP FUNCTION IF EXISTS public.archive_old_chat_sessions(int4);
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP FUNCTION IF EXISTS public.cleanup_expired_upload_sessions();
DROP FUNCTION IF EXISTS public.cleanup_inactive_collab_sessions();
DROP FUNCTION IF EXISTS public.detect_suspicious_activity(uuid, int4);
DROP FUNCTION IF EXISTS public.get_storage_usage_by_classification(varchar);
-- get_user_storage_used(uuid) НЕ удаляем: от неё зависит view user_statistics
DROP FUNCTION IF EXISTS public.is_valid_email(text);
DROP FUNCTION IF EXISTS public.search_chat_messages(uuid, text, int4);
DROP FUNCTION IF EXISTS public.set_user_context(uuid, uuid, varchar);
DROP FUNCTION IF EXISTS public.update_prompt_usage();
