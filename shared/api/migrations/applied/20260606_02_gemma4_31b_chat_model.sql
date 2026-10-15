-- ---
-- EliteEW · Empery World
-- https://empery.world
-- Author: po&T && TZBrand
-- ---
-- Purpose:
-- Переключение stack2/UGS чат-модели GGUF: `gemma-4-E4B-it-Q4_K_M.gguf` → `gemma-4-31B-it-Q4_K_M.gguf`.
-- Invariants:
-- - Меняются только строки с legacy именем E4B; идемпотентно при повторном запуске.
-- Related:
-- - docker/env_file/.env.stack2 (LLAMA_CHAT_FILE), docker/env_file/.env.stack0.backend (OLLAMA_*).
-- ---

BEGIN;

UPDATE generation_providers
SET
    config_json = jsonb_set(
        config_json,
        '{default_model}',
        to_jsonb('gemma-4-31B-it-Q4_K_M.gguf'::text),
        TRUE
    ),
    updated_at = NOW()
WHERE config_json->>'default_model' = 'gemma-4-E4B-it-Q4_K_M.gguf';

UPDATE generation_providers gp
SET
    config_json = jsonb_set(
        gp.config_json,
        '{models}',
        COALESCE(
            (
                SELECT jsonb_agg(
                    CASE
                        WHEN jsonb_typeof(elem) = 'string'
                            AND elem #>> '{}' = 'gemma-4-E4B-it-Q4_K_M.gguf'
                        THEN to_jsonb('gemma-4-31B-it-Q4_K_M.gguf'::text)
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(
                    COALESCE(gp.config_json->'models', '[]'::jsonb)
                ) AS elem
            ),
            '[]'::jsonb
        ),
        TRUE
    ),
    updated_at = NOW()
WHERE jsonb_typeof(gp.config_json->'models') = 'array'
  AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(gp.config_json->'models') AS e
        WHERE jsonb_typeof(e) = 'string' AND e #>> '{}' = 'gemma-4-E4B-it-Q4_K_M.gguf'
    );

UPDATE ugs_settings
SET
    value = replace(value::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE value::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE generation_types
SET
    model_name = 'gemma-4-31B-it-Q4_K_M.gguf',
    updated_at = NOW()
WHERE model_name = 'gemma-4-E4B-it-Q4_K_M.gguf';

UPDATE generation_types
SET
    parameters = replace(parameters::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE parameters IS NOT NULL
  AND parameters::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE generation_types
SET
    type_metadata = replace(type_metadata::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE type_metadata IS NOT NULL
  AND type_metadata::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE assistant_settings
SET
    ollama_model = 'gemma-4-31B-it-Q4_K_M.gguf',
    updated_at = NOW()
WHERE ollama_model = 'gemma-4-E4B-it-Q4_K_M.gguf';

UPDATE desktop_ai_chat_config
SET
    defaults = replace(defaults::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE defaults::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE desktop_ai_chats
SET
    ollama_model = 'gemma-4-31B-it-Q4_K_M.gguf',
    updated_at = NOW()
WHERE ollama_model = 'gemma-4-E4B-it-Q4_K_M.gguf';

UPDATE desktop_ai_chats
SET
    settings = replace(settings::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE settings::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE comfyui_workflows
SET
    json_body = replace(json_body::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE json_body::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE comfyui_workflows
SET
    model_dependencies = replace(
        model_dependencies::text,
        'gemma-4-E4B-it-Q4_K_M.gguf',
        'gemma-4-31B-it-Q4_K_M.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE model_dependencies IS NOT NULL
  AND model_dependencies::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

UPDATE comfyui_workflows
SET
    metadata = replace(metadata::text, 'gemma-4-E4B-it-Q4_K_M.gguf', 'gemma-4-31B-it-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE metadata IS NOT NULL
  AND metadata::text LIKE '%gemma-4-E4B-it-Q4_K_M.gguf%';

COMMIT;
