-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Восстановить строки `generation_providers`, если таблица пуста или не хватает провайдеров,
-- на которых висят активные `generation_types` (runtime seeds согласованы с ProviderManagerServiceV2).
-- Invariants:
-- - Идемпотентно: ON CONFLICT (provider_name) поднимает enabled и не затирает непустой base_url / health_endpoint.
-- - `provider_type` для имён imc_* / miso_provider остаётся `miso` (CHECK в БД).
-- Related:
-- - api/services/ugs/provider_manager_service_v2.py (`get_runtime_provider_seed`)
-- ---

BEGIN;

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
VALUES
    (
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
        '{}'::jsonb,
        'Текст'
    ),
    (
        'miso_provider',
        'miso',
        NULL,
        FALSE,
        '/health',
        180,
        2,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        '{}'::jsonb,
        'Текст'
    ),
    (
        'imc_cabinet_filler_provider',
        'miso',
        NULL,
        FALSE,
        '/health',
        180,
        2,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        '{}'::jsonb,
        'Текст'
    ),
    (
        'imc_rag_research_provider',
        'miso',
        NULL,
        FALSE,
        '/health',
        180,
        2,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        '{}'::jsonb,
        'Текст'
    ),
    (
        'comfyui',
        'comfyui',
        'http://stack2-comfyui:3000',
        FALSE,
        '/system_stats',
        300,
        2,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        '{}'::jsonb,
        'Медиа'
    ),
    (
        'faster_whisper',
        'faster_whisper',
        'http://stack9-whisper-fast:8000',
        FALSE,
        '/health',
        120,
        2,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        '{}'::jsonb,
        'Аудио'
    ),
    (
        'silero',
        'silero',
        'http://stack9-silero:8000',
        FALSE,
        '/health',
        90,
        3,
        TRUE,
        0.0,
        0,
        ARRAY[]::varchar[],
        jsonb_build_object(
            'defaults',
            jsonb_build_object('voice', 'xenia', 'speed', 1.0, 'language', 'ru'),
            'response_format',
            'wav'
        ),
        'Аудио'
    )
ON CONFLICT (provider_name) DO UPDATE SET
    provider_type = EXCLUDED.provider_type,
    base_url = COALESCE(generation_providers.base_url, EXCLUDED.base_url),
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

COMMIT;
