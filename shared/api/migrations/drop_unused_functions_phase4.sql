-- Phase 4: drop remaining unused DB functions (full audit 2026-03-15).
-- See docs/DB_FUNCTIONS_FULL_AUDIT_REMAINING.md.
-- Run: psql -U ai_user -d ai_services -f drop_unused_functions_phase4.sql

BEGIN;

DROP FUNCTION IF EXISTS public.check_encryption_coverage();
DROP FUNCTION IF EXISTS public.cleanup_old_generation_history(integer);
DROP FUNCTION IF EXISTS public.cleanup_old_ugs_metrics();
DROP FUNCTION IF EXISTS public.cleanup_soft_deleted_requests(integer);
DROP FUNCTION IF EXISTS public.complete_generation_attempt(uuid, boolean, integer, text, character varying, jsonb, integer);
DROP FUNCTION IF EXISTS public.generate_secure_token(integer);
DROP FUNCTION IF EXISTS public.get_cluster_statistics(uuid);
-- mask_email(text) НЕ удалять: от неё зависит view users_masked_by_role
DROP FUNCTION IF EXISTS public.mask_phone(text);
DROP FUNCTION IF EXISTS public.record_credit_usage(uuid, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.record_generation_attempt(uuid, integer, character varying, text);
DROP FUNCTION IF EXISTS public.refund_generation_credits(uuid);
DROP FUNCTION IF EXISTS public.restore_generation_request(uuid);
DROP FUNCTION IF EXISTS public.soft_delete_generation_request(uuid);
DROP FUNCTION IF EXISTS public.soft_delete_generation_request(uuid, uuid);
DROP FUNCTION IF EXISTS public.sync_cluster_job_stories();
DROP FUNCTION IF EXISTS public.validate_chat_attachment_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.validate_credit_transaction_balance();

COMMIT;
