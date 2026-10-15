-- UGS model routing: one shared DB-backed text model for all text-generation domains.
-- Corrective/idempotent migration; keeps embedding and rerank as separate stack2 service models.

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
        'global_default_model', 'qwen3-14b-q4_k_m.gguf',
        'provider_defaults', jsonb_build_object(
            'ollama', 'qwen3-14b-q4_k_m.gguf',
            'llama', 'qwen3-14b-q4_k_m.gguf'
        ),
        'category_defaults', jsonb_build_object('text', 'qwen3-14b-q4_k_m.gguf'),
        'domain_defaults', jsonb_build_object(
            'imc', 'qwen3-14b-q4_k_m.gguf',
            'professional_worlds', 'qwen3-14b-q4_k_m.gguf',
            'music', 'qwen3-14b-q4_k_m.gguf',
            'image_studio', 'qwen3-14b-q4_k_m.gguf'
        ),
        'type_overrides', '{}'::jsonb,
        'request_model_override_allowlist', '[]'::jsonb
    ),
    'UGS DB-backed model routing: one shared text-generation model.',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ugs_settings WHERE scope = 'global' AND key = 'model_routes'
);

UPDATE ugs_settings
SET
    value = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        value,
                        '{global_default_model}',
                        to_jsonb('qwen3-14b-q4_k_m.gguf'::text),
                        TRUE
                    ),
                    '{provider_defaults}',
                    COALESCE(value->'provider_defaults', '{}'::jsonb)
                        || jsonb_build_object(
                            'ollama', 'qwen3-14b-q4_k_m.gguf',
                            'llama', 'qwen3-14b-q4_k_m.gguf'
                        ),
                    TRUE
                ),
                '{category_defaults}',
                COALESCE(value->'category_defaults', '{}'::jsonb)
                    || jsonb_build_object('text', 'qwen3-14b-q4_k_m.gguf'),
                TRUE
            ),
            '{domain_defaults}',
            COALESCE(value->'domain_defaults', '{}'::jsonb)
                || jsonb_build_object(
                    'imc', 'qwen3-14b-q4_k_m.gguf',
                    'professional_worlds', 'qwen3-14b-q4_k_m.gguf',
                    'music', 'qwen3-14b-q4_k_m.gguf',
                    'image_studio', 'qwen3-14b-q4_k_m.gguf'
                ),
            TRUE
        ),
        '{type_overrides}',
        '{}'::jsonb,
        TRUE
    ),
    description = 'UGS DB-backed model routing: one shared text-generation model.',
    updated_at = NOW()
WHERE scope = 'global'
  AND key = 'model_routes';

UPDATE generation_types
SET
    model_name = '',
    updated_at = NOW()
WHERE COALESCE(model_name, '') <> '';

COMMIT;
