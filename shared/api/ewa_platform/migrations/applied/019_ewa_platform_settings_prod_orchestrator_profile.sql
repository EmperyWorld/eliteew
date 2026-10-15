-- Prod orchestrator profile: FastAPI async + Celery/Beat + Postgres task runs + Qdrant HCM.
-- Idempotent: updates value_text only when different; audit rows for each change.
-- See documentation/product/ewa/EWA-PLATFORM-SETTINGS-DB.md and migration README §019.

-- New catalog key (reembed backlog drain rounds; runtime reads via settings cache).
INSERT INTO ewa_platform_setting (
    setting_key,
    value_text,
    value_type,
    category,
    description_ru,
    description_en,
    default_value,
    allowed_values,
    affects_ru,
    affects_en,
    is_secret,
    sort_order,
    updated_by,
    updated_at
) VALUES (
    'EWA_COMPANION_EPISODES_REEMBED_DRAIN_MAX_ROUNDS',
    '48',
    'int',
    'companion',
    'Макс. раундов drain backlog episodic reembed (Celery one-shot / operator). Каждый раунд — до EPISODES_REEMBED_BATCH pending строк.',
    'Max rounds for episodic reembed backlog drain (Celery one-shot / operator). Each round processes up to EPISODES_REEMBED_BATCH pending rows.',
    '48',
    'positive int',
    'episodic_reembed_task.run_companion_episodic_drain_backlog, reembed.drain_pending_backlog.',
    'episodic_reembed_task.run_companion_episodic_drain_backlog, reembed.drain_pending_backlog.',
    false,
    725,
    'migration_019_prod_orchestrator_profile',
    now()
)
ON CONFLICT (setting_key) DO UPDATE SET
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description_ru = EXCLUDED.description_ru,
    description_en = EXCLUDED.description_en,
    default_value = EXCLUDED.default_value,
    allowed_values = EXCLUDED.allowed_values,
    affects_ru = EXCLUDED.affects_ru,
    affects_en = EXCLUDED.affects_en,
    is_secret = EXCLUDED.is_secret,
    sort_order = EXCLUDED.sort_order,
    updated_by = 'migration_019_prod_orchestrator_profile',
    updated_at = now();

WITH prod_profile (setting_key, value_text) AS (
    VALUES
        -- MUST ENABLE: orchestration / Celery / server-first
        ('EWA_COMPANION_ASYNC_JOBS_ENABLED', '1'),
        ('EWA_COMPANION_ASYNC_MUSIC_ENABLED', '1'),
        ('EWA_COMPANION_BACKEND_MUSIC_GENERATION', '1'),
        ('EWA_COMPANION_CHAT_USE_HTTP_LLM', '1'),
        ('EWA_COMPANION_SERVER_FIRST_V2', '1'),
        ('EWA_COMPANION_ACTION_VALIDATION_ENABLED', '1'),
        ('EWA_COMPANION_TOOL_ROUTER_ENABLED', '1'),
        ('EWA_COMPANION_TOOL_ROUTER_MODE', 'full'),
        -- HCM / RAG
        ('EWA_COMPANION_HCM_EPISODIC_ENABLED', '1'),
        ('EWA_COMPANION_HCM_RETRIEVAL_ENABLED', '1'),
        ('EWA_COMPANION_EPISODIC_RERANK_ENABLED', '1'),
        ('EWA_COMPANION_RETRIEVAL_ROUTER_ENABLED', '1'),
        -- Context / condense
        ('EWA_COMPANION_CONTEXT_CONTROLLER_ENABLED', '1'),
        ('EWA_COMPANION_CONTEXT_ANCHOR_ENABLED', '1'),
        ('EWA_COMPANION_CHAT_CONDENSE_ENABLED', '1'),
        -- Catalog / file tools
        ('EWA_COMPANION_CATALOG_FIND', '1'),
        ('EWA_COMPANION_CATALOG_DISCUSS_ENABLED', '1'),
        ('EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH', '1'),
        ('EWA_COMPANION_DOC_BODY_EDIT', '1'),
        ('EWA_COMPANION_DOC_BODY_TRANSLATE', '1'),
        -- Action workflows + admin
        ('EWA_COMPANION_WF_ENGINE_ENABLED', '1'),
        ('EWA_COMPANION_WF_MUSIC_FULL_V1', '1'),
        ('EWA_COMPANION_WF_PG_CATALOG', '1'),
        ('EWA_COMPANION_ADMIN_ENABLED', '1'),
        ('EWA_COMPANION_USER_WORKFLOWS_ENABLED', '1'),
        -- Product options (UGS image, inference helpers)
        ('EWA_COMPANION_IMAGE_GENERATION_ENABLED', '1'),
        ('EWA_COMPANION_INFER_OPEN_FROM_USER', '1'),
        ('EWA_COMPANION_INFER_DESKTOP_THEME_PATCH', '1'),
        ('EWA_COMPANION_EPISODIC_INTENT_PRIORITIZE', '1'),
        ('EWA_COMPANION_EPISODIC_SESSION_TOPIC_PRIORITIZE', '1'),
        ('EWA_COMPANION_LISTING_ORDINALS', '1'),
        -- Desktop orchestration
        ('EWA_ORCH_USE_HTTP_LLM', '1'),
        ('EWA_ORCH_USE_ELITEEW_HTTP', '1'),
        ('EWA_ORCH_ATTACH_UGS_HTTP', '1'),
        ('EWA_ORCH_ATTACH_CONTENT_SHELL_HINT', '1'),
        ('EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT', '1'),
        ('EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8', '1'),
        ('EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS', '1'),
        ('EWA_HEALTH_PG_PROBE', '1'),
        -- MUST DISABLE
        ('EWA_COMPANION_INTENT_PLANNER', '0'),
        ('EWA_COMPANION_INTENT_PLANNER_FORCE', '0'),
        ('EWA_COMPANION_PLAN_LLM_ENABLED', '0'),
        ('EWA_COMPANION_SEMANTIC_CATALOG_ENABLED', '0'),
        ('EWA_COMPANION_AMBIENT_ACTIONS_ENABLED', '0'),
        ('EWA_COMPANION_AUTO_AMBIENT_FROM_AFFECTIVE', '0'),
        ('EWA_COMPANION_SELF_CORRECTION_ENABLED', '0'),
        ('EWA_COMPANION_SELF_CORRECTION_EPISODES_ENABLED', '0'),
        ('EWA_COMPANION_META_EVOLUTION_ENABLED', '0'),
        ('EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED', '0'),
        ('EWA_COMPANION_EVOLUTION_USE_LLM', '0'),
        ('EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT', '0'),
        ('EWA_COMPANION_VOICE_ENABLED', '0'),
        ('EWA_COMPANION_WORKFLOW_FILE_FOCUS_ENABLED', '0'),
        ('EWA_COMPANION_WORKFLOW_PLAN_MONTH_ENABLED', '0'),
        ('EWA_ORCH_LLM_CONTEXT_LOG', '0'),
        ('EWA_ATOM_LAYER_ENABLED', '0'),
        ('EWA_COMPANION_CONTEXT_ANCHOR_LLM', '0'),
        ('EWA_COMPANION_ADMIN_WRITE', '0'),
        ('EWA_COMPANION_WF_DOC_PACKAGE_V1', '0'),
        ('EWA_COMPANION_PLAN_ENABLED', '0'),
        -- TUNING: RAG backlog + retrieval
        ('EWA_COMPANION_EPISODES_REEMBED_BATCH', '128'),
        ('EWA_COMPANION_EPISODES_REEMBED_ROW_DELAY_MS', '40'),
        ('EWA_COMPANION_EPISODES_REEMBED_DRAIN_MAX_ROUNDS', '48'),
        ('EWA_COMPANION_OBSERVATION_RATE_LIMIT_PER_MIN', '10'),
        ('EWA_COMPANION_RETRIEVAL_BUDGET_MS', '4500'),
        ('EWA_QDRANT_URL', 'http://stack1-qdrant:6333'),
        ('EWA_QDRANT_API_KEY', ''),
        -- TUNING: chat LLM
        ('EWA_COMPANION_CHAT_TIMEOUT_SEC', '150'),
        ('EWA_COMPANION_CHAT_NUM_CTX', '16384'),
        ('EWA_COMPANION_CHAT_NUM_PREDICT', '1536'),
        ('EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET', '7000'),
        ('EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET', '3072'),
        -- TUNING: tool router
        ('EWA_COMPANION_TOOL_ROUTER_TIMEOUT_SEC', '10'),
        ('EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS', '384'),
        ('EWA_COMPANION_TOOL_ROUTER_MIN_CONFIDENCE', '0.60'),
        -- TUNING: context controller / anchor / condense
        ('EWA_COMPANION_CONTEXT_PRUNE_HISTORY_MAX_MESSAGES', '50'),
        ('EWA_COMPANION_CONTEXT_PRUNE_LATENCY_THRESHOLD_MS', '3000'),
        ('EWA_COMPANION_CONTEXT_PRUNE_PROMPT_BUDGET_THRESHOLD', '14000'),
        ('EWA_COMPANION_CONTEXT_ANCHOR_MAX_CHARS', '2500'),
        ('EWA_COMPANION_CONTEXT_ANCHOR_REFRESH_EVERY_N_TURNS', '5'),
        ('EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES', '30'),
        ('EWA_COMPANION_CHAT_CONDENSE_MAX_CHARS', '4000'),
        ('EWA_COMPANION_CHAT_CONDENSE_TIMEOUT_SEC', '25'),
        -- TUNING: doc / catalog caps
        ('EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES', '4194304'),
        ('EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS', '49152'),
        ('EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS', '10000'),
        ('EWA_COMPANION_CATALOG_DISCUSS_MAX_CHARS', '16000'),
        -- TUNING: desktop orch SSE + wire logging
        ('EWA_ORCH_SSE_KEEPALIVE_SEC', '2'),
        ('EWA_COMPANION_LLM_WIRE_ACTION_LOG_MAX', '50'),
        ('EWA_COMPANION_LLM_WIRE_ROLLUP_SNIPPET_MAX', '240'),
        ('EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE', '85'),
        ('EWA_COMPANION_TRUST_CLASSIFY_TIMEOUT_SEC', '6'),
        ('EWA_COMPANION_WRATH_CLASSIFY_TIMEOUT_SEC', '6')
),
pending_change AS (
    SELECT
        s.setting_key,
        COALESCE(s.value_text, '') AS old_value,
        p.value_text AS new_value
    FROM ewa_platform_setting s
    INNER JOIN prod_profile p ON p.setting_key = s.setting_key
    WHERE COALESCE(s.value_text, '') IS DISTINCT FROM p.value_text
),
audit_insert AS (
    INSERT INTO ewa_platform_setting_audit (setting_key, old_value, new_value, actor_sub)
    SELECT setting_key, old_value, new_value, 'migration_019_prod_orchestrator_profile'
    FROM pending_change
    RETURNING setting_key
)
UPDATE ewa_platform_setting s
SET
    value_text = p.value_text,
    updated_by = 'migration_019_prod_orchestrator_profile',
    updated_at = now()
FROM prod_profile p
WHERE s.setting_key = p.setting_key
  AND COALESCE(s.value_text, '') IS DISTINCT FROM p.value_text;

-- Guardrails (same invariants as migration 017).
UPDATE ewa_platform_setting
SET value_text = '0',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key IN ('EWA_COMPANION_USER_WORKFLOWS_ENABLED', 'EWA_COMPANION_WF_MUSIC_FULL_V1', 'EWA_COMPANION_WF_DOC_PACKAGE_V1')
  AND COALESCE(NULLIF(value_text, ''), '0') <> '0'
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting master
      WHERE master.setting_key = 'EWA_COMPANION_WF_ENGINE_ENABLED'
        AND COALESCE(NULLIF(master.value_text, ''), '0') = '0'
  );

UPDATE ewa_platform_setting
SET value_text = '1',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_ASYNC_JOBS_ENABLED'
  AND COALESCE(NULLIF(value_text, ''), '0') <> '1'
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting master
      WHERE master.setting_key = 'EWA_COMPANION_WF_ENGINE_ENABLED'
        AND COALESCE(NULLIF(master.value_text, ''), '0') = '1'
  )
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting dep
      WHERE dep.setting_key IN ('EWA_COMPANION_USER_WORKFLOWS_ENABLED', 'EWA_COMPANION_WF_MUSIC_FULL_V1', 'EWA_COMPANION_WF_DOC_PACKAGE_V1')
        AND COALESCE(NULLIF(dep.value_text, ''), '0') = '1'
  );

UPDATE ewa_platform_setting
SET value_text = '0',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_ASYNC_MUSIC_ENABLED'
  AND COALESCE(NULLIF(value_text, ''), '0') <> '0'
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting master
      WHERE master.setting_key = 'EWA_COMPANION_ASYNC_JOBS_ENABLED'
        AND COALESCE(NULLIF(master.value_text, ''), '0') = '0'
  );

UPDATE ewa_platform_setting
SET value_text = '0',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_ADMIN_WRITE'
  AND COALESCE(NULLIF(value_text, ''), '0') <> '0'
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting pgcat
      WHERE pgcat.setting_key = 'EWA_COMPANION_WF_PG_CATALOG'
        AND COALESCE(NULLIF(pgcat.value_text, ''), '0') = '0'
  );

UPDATE ewa_platform_setting
SET value_text = 'shadow',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_TOOL_ROUTER_MODE'
  AND COALESCE(NULLIF(value_text, ''), 'shadow') <> 'shadow'
  AND EXISTS (
      SELECT 1 FROM ewa_platform_setting router
      WHERE router.setting_key = 'EWA_COMPANION_TOOL_ROUTER_ENABLED'
        AND COALESCE(NULLIF(router.value_text, ''), '0') = '0'
  );

UPDATE ewa_platform_setting
SET value_text = 'partial',
    updated_by = 'migration_019_guardrail',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_TOOL_ROUTER_MODE'
  AND COALESCE(NULLIF(value_text, ''), 'partial') NOT IN ('shadow', 'partial', 'full');

DO $$
DECLARE
    v_total integer;
    v_mode text;
    v_qdrant text;
BEGIN
    SELECT COUNT(*) INTO v_total FROM ewa_platform_setting;
    IF v_total < 186 THEN
        RAISE EXCEPTION 'ewa_platform_setting count % is below expected catalog size 186', v_total;
    END IF;
    SELECT COALESCE(value_text, '') INTO v_mode
    FROM ewa_platform_setting WHERE setting_key = 'EWA_COMPANION_TOOL_ROUTER_MODE';
    IF v_mode <> 'full' THEN
        RAISE EXCEPTION 'EWA_COMPANION_TOOL_ROUTER_MODE expected full after profile, got %', v_mode;
    END IF;
    SELECT COALESCE(value_text, '') INTO v_qdrant
    FROM ewa_platform_setting WHERE setting_key = 'EWA_QDRANT_URL';
    IF v_qdrant = '' THEN
        RAISE EXCEPTION 'EWA_QDRANT_URL must be non-empty after migration 019';
    END IF;
END $$;
