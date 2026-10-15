-- Строка провайдера для «Заполнителя». provider_type = miso из-за CHECK в generation_providers;
-- вызов ImcCabinetFiller идёт по provider_name в provider_manager_service_v2._call_provider.
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
    config_json
)
SELECT
    'imc_cabinet_filler_provider',
    'miso',
    COALESCE(NULLIF(TRIM(base_url), ''), 'http://stack2-ollama:11434'),
    FALSE,
    COALESCE(NULLIF(TRIM(health_endpoint), ''), '/api/tags'),
    COALESCE(timeout_seconds, 180),
    COALESCE(max_concurrent, 2),
    TRUE,
    COALESCE(cost_per_request, 0),
    COALESCE(fallback_priority, 0),
    COALESCE(config_json, '{}'::jsonb)
FROM generation_providers
WHERE provider_name = 'miso_provider'
LIMIT 1;

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
    config_json
)
SELECT
    'imc_cabinet_filler_provider',
    'miso',
    'http://stack2-ollama:11434',
    FALSE,
    '/api/tags',
    180,
    2,
    TRUE,
    0,
    0,
    '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM generation_providers WHERE provider_name = 'imc_cabinet_filler_provider');

UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE type_key = 'imc_cabinet_filler';

COMMIT;
