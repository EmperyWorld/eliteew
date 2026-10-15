-- UGS: allow provider_type llama; align text LLM URLs with stack2-llama-chat / OLLAMA_URL.
-- Idempotent: safe to re-run (ON CONFLICT / IF EXISTS).

BEGIN;

ALTER TABLE generation_providers DROP CONSTRAINT IF EXISTS generation_providers_provider_type_check;

ALTER TABLE generation_providers ADD CONSTRAINT generation_providers_provider_type_check CHECK (
    (provider_type)::text = ANY (
        ARRAY[
            ('ollama'::character varying)::text,
            ('llama'::character varying)::text,
            ('comfyui'::character varying)::text,
            ('stable_diffusion'::character varying)::text,
            ('localai'::character varying)::text,
            ('sadtalker'::character varying)::text,
            ('supir'::character varying)::text,
            ('real_esrgan'::character varying)::text,
            ('openwebui'::character varying)::text,
            ('mlflow'::character varying)::text,
            ('localagi'::character varying)::text,
            ('faster_whisper'::character varying)::text,
            ('miso'::character varying)::text,
            ('silero'::character varying)::text
        ]
    )
);

-- Stop persisting legacy stack2-ollama default so env OLLAMA_URL / unified_config wins.
UPDATE generation_providers
SET
    base_url = NULL,
    updated_at = NOW()
WHERE base_url IS NOT NULL
  AND TRIM(TRAILING '/' FROM TRIM(base_url)) = 'http://stack2-ollama:11434';

-- Prefer /health for llama.cpp server health checks in admin.
UPDATE generation_providers
SET
    health_endpoint = '/health',
    updated_at = NOW()
WHERE provider_name = 'ollama'
  AND TRIM(COALESCE(health_endpoint, '')) IN ('', '/api/tags');

UPDATE generation_providers
SET
    health_endpoint = '/health',
    updated_at = NOW()
WHERE provider_name IN ('miso_provider', 'imc_cabinet_filler_provider', 'imc_rag_research_provider')
  AND TRIM(COALESCE(health_endpoint, '')) = '/api/tags';

INSERT INTO generation_providers (
    provider_name,
    provider_type,
    base_url,
    api_key_required,
    health_endpoint,
    timeout_seconds,
    max_concurrent,
    enabled,
    cost_per_request,
    fallback_priority,
    fallback_for,
    config_json
)
VALUES (
    'llama',
    'llama',
    NULL,
    FALSE,
    '/health',
    120,
    5,
    TRUE,
    0.0,
    0,
    ARRAY[]::varchar[],
    '{}'::jsonb
)
ON CONFLICT (provider_name) DO NOTHING;

COMMIT;
