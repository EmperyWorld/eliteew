-- Align EWA companion context/retrieval tuning with prod topology (2026-07-07):
-- - stack2 llama-chat: gemma-4-26B.gguf, n_ctx_train=262144 (no forced -c)
-- - embed :8081, rerank :8082, tool-router :8083 on gpu141 (.141)
-- Runtime embed/rerank URLs stay in stack0 env (LLAMA_EMBEDDING_URL, RAG_RERANK_BASE_URL);
-- this migration tunes Postgres-backed companion flags that override compose for chat ctx budgets.
-- See documentation/platform/STACK2-LLM-CONTRACT.md §Typical prod contour.

WITH gpu141_262k_profile (setting_key, value_text) AS (
    VALUES
        -- Chat window: match stack2 effective n_ctx (26B profile)
        ('EWA_COMPANION_CHAT_NUM_CTX', '262144'),
        ('EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET', '48000'),
        ('EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET', '8192'),
        -- Context controller thresholds scaled for 256k-class window
        ('EWA_COMPANION_CONTEXT_PRUNE_PROMPT_BUDGET_THRESHOLD', '56000'),
        ('EWA_COMPANION_CONTEXT_PRUNE_HISTORY_MAX_MESSAGES', '80'),
        ('EWA_COMPANION_CONTEXT_PRUNE_LATENCY_THRESHOLD_MS', '4000'),
        -- HCM retrieval: gpu141 rerank is LAN-dedicated — slightly wider budget
        ('EWA_COMPANION_RETRIEVAL_BUDGET_MS', '6000'),
        -- Tool router on gpu141 (canon URL; idempotent if already set)
        ('EWA_COMPANION_TOOL_ROUTER_URL', 'http://192.168.1.141:8083'),
        ('EWA_COMPANION_TOOL_ROUTER_TIMEOUT_SEC', '15'),
        ('EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS', '512')
),
pending_change AS (
    SELECT
        s.setting_key,
        COALESCE(s.value_text, '') AS old_value,
        p.value_text AS new_value
    FROM ewa_platform_setting s
    INNER JOIN gpu141_262k_profile p ON p.setting_key = s.setting_key
    WHERE COALESCE(s.value_text, '') IS DISTINCT FROM p.value_text
),
audit_insert AS (
    INSERT INTO ewa_platform_setting_audit (setting_key, old_value, new_value, actor_sub)
    SELECT setting_key, old_value, new_value, 'migration_029_262k_gpu141_profile'
    FROM pending_change
    RETURNING setting_key
)
UPDATE ewa_platform_setting s
SET
    value_text = p.value_text,
    updated_by = 'migration_029_262k_gpu141_profile',
    updated_at = now()
FROM gpu141_262k_profile p
WHERE s.setting_key = p.setting_key
  AND COALESCE(s.value_text, '') IS DISTINCT FROM p.value_text;

DO $$
DECLARE
    v_ctx text;
    v_router_url text;
BEGIN
    SELECT COALESCE(value_text, '') INTO v_ctx
    FROM ewa_platform_setting WHERE setting_key = 'EWA_COMPANION_CHAT_NUM_CTX';
    IF v_ctx <> '262144' THEN
        RAISE EXCEPTION 'EWA_COMPANION_CHAT_NUM_CTX expected 262144 after migration 029, got %', v_ctx;
    END IF;
    SELECT COALESCE(value_text, '') INTO v_router_url
    FROM ewa_platform_setting WHERE setting_key = 'EWA_COMPANION_TOOL_ROUTER_URL';
    IF v_router_url NOT ILIKE '%192.168.1.141:8083%' THEN
        RAISE EXCEPTION 'EWA_COMPANION_TOOL_ROUTER_URL expected gpu141 :8083, got %', v_router_url;
    END IF;
END $$;
