-- Строка в generation_providers обязательна: иначе get_provider_config падает, если сид в коде не совпал с деплоем.
-- Также восстанавливаем provider у типа, если в админке очистили поле.
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
VALUES (
    'imc_cabinet_filler_provider',
    'imc_cabinet_filler',
    'http://stack2-ollama:11434',
    FALSE,
    '/api/tags',
    180,
    2,
    TRUE,
    0,
    0,
    '{}'::jsonb
)
ON CONFLICT (provider_name) DO UPDATE SET
    provider_type = EXCLUDED.provider_type,
    enabled = TRUE,
    updated_at = NOW();

-- Подтянуть base_url с miso_provider, если он уже настроен в БД
UPDATE generation_providers AS g
SET
    base_url = COALESCE(NULLIF(TRIM(m.base_url), ''), g.base_url),
    health_endpoint = COALESCE(NULLIF(TRIM(m.health_endpoint), ''), g.health_endpoint),
    timeout_seconds = COALESCE(m.timeout_seconds, g.timeout_seconds),
    max_concurrent = COALESCE(m.max_concurrent, g.max_concurrent),
    config_json = COALESCE(m.config_json, g.config_json),
    updated_at = NOW()
FROM generation_providers AS m
WHERE g.provider_name = 'imc_cabinet_filler_provider'
  AND m.provider_name = 'miso_provider';

UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE type_key = 'imc_cabinet_filler'
  AND (provider IS NULL OR TRIM(provider) = '');

COMMIT;
