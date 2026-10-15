-- UGS model routing: DB as source of truth for text model defaults.
-- Idempotent corrective migration; it does not rewrite historical migrations.

BEGIN;

INSERT INTO ugs_settings (
    id,
    scope,
    key,
    value,
    description,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'global',
    'model_routes',
    jsonb_build_object(
        'global_default_model', NULL,
        'provider_defaults', COALESCE(provider_defaults.value, '{}'::jsonb),
        'category_defaults', '{}'::jsonb,
        'domain_defaults', '{}'::jsonb,
        'type_overrides', COALESCE(type_overrides.value, '{}'::jsonb),
        'request_model_override_allowlist', '[]'::jsonb
    ),
    'UGS DB-backed model routing defaults and legacy type model overrides.',
    NOW(),
    NOW()
FROM (
    SELECT jsonb_object_agg(provider_name, config_json->>'default_model') AS value
    FROM generation_providers
    WHERE COALESCE(config_json->>'default_model', '') <> ''
) AS provider_defaults
CROSS JOIN (
    SELECT jsonb_object_agg(type_key, model_name) AS value
    FROM generation_types
    WHERE COALESCE(model_name, '') <> ''
) AS type_overrides
WHERE NOT EXISTS (
    SELECT 1 FROM ugs_settings WHERE scope = 'global' AND key = 'model_routes'
);

UPDATE generation_providers
SET
    config_json = jsonb_set(
        config_json,
        '{models}',
        CASE
            WHEN jsonb_typeof(config_json->'models') = 'array'
                THEN (
                    SELECT jsonb_agg(DISTINCT model_value)
                    FROM (
                        SELECT jsonb_array_elements_text(config_json->'models') AS model_value
                        UNION
                        SELECT config_json->>'default_model'
                        WHERE COALESCE(config_json->>'default_model', '') <> ''
                    ) AS models
                )
            WHEN COALESCE(config_json->>'default_model', '') <> ''
                THEN jsonb_build_array(config_json->>'default_model')
            ELSE '[]'::jsonb
        END,
        TRUE
    ),
    updated_at = NOW()
WHERE config_json IS NOT NULL
  AND (
      COALESCE(config_json->>'default_model', '') <> ''
      OR jsonb_typeof(config_json->'models') = 'array'
  );

COMMIT;
