-- ---
-- EliteEW · Empery World
-- https://empery.world
-- Author: po&T && TZBrand
-- ---
-- Purpose:
-- Add UGS generation_providers row for stack9 Piper TTS (CPU Irina) without replacing Silero.
-- Invariants:
-- - Idempotent CHECK recreate + ON CONFLICT upsert.
-- - Silero row / audio_generation_tts unchanged.
-- Related:
-- - docker/builders/stack9-piper/
-- - api/services/ugs/provider_runtime_seeds.py
-- ---

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
            ('silero'::character varying)::text,
            ('piper'::character varying)::text
        ]
    )
);

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
    config_json,
    display_label
)
VALUES (
    'piper',
    'piper',
    'http://stack9-piper:8000',
    FALSE,
    '/health',
    90,
    4,
    TRUE,
    0.0,
    0,
    ARRAY[]::varchar[],
    jsonb_build_object(
        'defaults',
        jsonb_build_object('voice', 'irina', 'speed', 1.0, 'language', 'ru'),
        'response_format',
        'wav',
        'device',
        'cpu',
        'voice_model',
        'ru_RU-irina-medium'
    ),
    'Аудио · Piper'
)
ON CONFLICT (provider_name) DO UPDATE SET
    provider_type = EXCLUDED.provider_type,
    base_url = COALESCE(NULLIF(TRIM(generation_providers.base_url), ''), EXCLUDED.base_url),
    health_endpoint = CASE
        WHEN generation_providers.health_endpoint IS NULL
            OR TRIM(generation_providers.health_endpoint::text) IN ('', '/')
        THEN EXCLUDED.health_endpoint
        ELSE generation_providers.health_endpoint
    END,
    timeout_seconds = GREATEST(COALESCE(generation_providers.timeout_seconds, 0), EXCLUDED.timeout_seconds),
    max_concurrent = GREATEST(COALESCE(generation_providers.max_concurrent, 0), EXCLUDED.max_concurrent),
    enabled = TRUE,
    display_label = COALESCE(generation_providers.display_label, EXCLUDED.display_label),
    config_json = CASE
        WHEN generation_providers.config_json IS NULL
            OR generation_providers.config_json = '{}'::jsonb
        THEN EXCLUDED.config_json
        ELSE generation_providers.config_json
    END,
    updated_at = NOW();

INSERT INTO generation_types (
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
VALUES (
    'audio_generation_piper',
    'audio',
    'Piper TTS (Irina)',
    'Generate Russian speech via stack9 Piper CPU (ru_RU-irina-medium). Does not replace Silero.',
    'piper',
    'ru_RU-irina-medium',
    jsonb_build_object('speed', 1.0, 'voice', 'irina', 'format', 'wav'),
    'low',
    10,
    3,
    4,
    10.00,
    TRUE,
    jsonb_build_object(
        'stack', 'stack9',
        'canonical_provider', 'piper',
        'device', 'cpu'
    )
)
ON CONFLICT (type_key) DO UPDATE SET
    category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    parameters = CASE
        WHEN generation_types.parameters IS NULL OR generation_types.parameters = '{}'::jsonb
        THEN EXCLUDED.parameters
        ELSE generation_types.parameters
    END,
    is_active = TRUE,
    type_metadata = CASE
        WHEN generation_types.type_metadata IS NULL OR generation_types.type_metadata = '{}'::jsonb
        THEN EXCLUDED.type_metadata
        ELSE generation_types.type_metadata
    END,
    updated_at = NOW();

COMMIT;
