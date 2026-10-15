-- Perf: idempotent UGS generate — _find_latest_idempotent_request(user_id, type_id, idempotency_key).
-- CREATE INDEX CONCURRENTLY runs outside a transaction block in session autocommit mode.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_requests_idempotency_lookup
    ON public.generation_requests (
        user_id,
        type_id,
        ((request_metadata ->> 'idempotency_key')),
        created_at DESC
    )
    WHERE deleted_at IS NULL
      AND request_metadata ? 'idempotency_key'
      AND coalesce(request_metadata ->> 'idempotency_key', '') <> '';

COMMENT ON INDEX idx_generation_requests_idempotency_lookup IS
    'UGS HTTP idempotency: match user+type+idempotency_key with newest created_at, active rows';
