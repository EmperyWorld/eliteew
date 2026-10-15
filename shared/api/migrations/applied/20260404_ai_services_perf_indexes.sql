-- Perf: partial/composite indexes for UGS queue + hot listings (see plan ai_services perf).
-- Uses CREATE INDEX CONCURRENTLY (each statement auto-commits in psql; not inside explicit BEGIN).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_requests_user_created_active
    ON public.generation_requests (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_requests_status_active
    ON public.generation_requests (status)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_queue_pending_priority
    ON public.generation_queue (status, priority DESC, created_at)
    WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_queue_request_id
    ON public.generation_queue (request_id)
    WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unified_content_user_created_not_deleted
    ON public.unified_content (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_generation_requests_user_created_active IS
    'UGS/listings: filter by user + sort by created_at, active rows only';
COMMENT ON INDEX idx_generation_queue_pending_priority IS
    'UGS get_next_requests: pending queue order by priority desc, created_at';
