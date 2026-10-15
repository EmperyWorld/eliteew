-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Замена в БД идентификатора чат-модели GGUF: legacy QuantFactory `Qwen3-4B.Q4_K_M.gguf` →
-- `gemma-4-26B.gguf` (long-context instruct, см. env stack2/stack0). У older ревизий была опечатка — см. 20260511_*.sql.
-- Invariants:
-- - Меняются только строки, совпадающие с legacy именем; идемпотентность при повторном запуске.
-- Related:
-- - docker/env_file/.env.stack2 (LLAMA_CHAT_FILE), docker/env_file/.env.stack0.backend (OLLAMA_*).
-- ---

BEGIN;

-- UGS providers: default_model + models[]
UPDATE generation_providers
SET
    config_json = jsonb_set(
        config_json,
        '{default_model}',
        to_jsonb('gemma-4-26B.gguf'::text),
        TRUE
    ),
    updated_at = NOW()
WHERE config_json->>'default_model' = 'Qwen3-4B.Q4_K_M.gguf';

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
                            AND elem #>> '{}' = 'Qwen3-4B.Q4_K_M.gguf'
                        THEN to_jsonb('gemma-4-26B.gguf'::text)
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
        WHERE jsonb_typeof(e) = 'string' AND e #>> '{}' = 'Qwen3-4B.Q4_K_M.gguf'
    );

-- UGS model_routes и прочие JSON-настройки с той же строкой в value
UPDATE ugs_settings
SET
    value = replace(
        value::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE value::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

-- Legacy колонка generation_types (если ещё что-то переопределяли)
UPDATE generation_types
SET
    model_name = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE model_name = 'Qwen3-4B.Q4_K_M.gguf';

UPDATE generation_types
SET
    parameters = replace(
        parameters::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE parameters IS NOT NULL
  AND parameters::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

UPDATE generation_types
SET
    type_metadata = replace(
        type_metadata::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE type_metadata IS NOT NULL
  AND type_metadata::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

-- Глобальный default модели ассистента (продуктовый FAQ и т.п.), если задан
UPDATE assistant_settings
SET
    ollama_model = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE ollama_model = 'Qwen3-4B.Q4_K_M.gguf';

-- Desktop AI: глобальные defaults и привязанные к чатам модели
UPDATE desktop_ai_chat_config
SET
    defaults = replace(
        defaults::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE defaults::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

UPDATE desktop_ai_chats
SET
    ollama_model = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE ollama_model = 'Qwen3-4B.Q4_K_M.gguf';

UPDATE desktop_ai_chats
SET
    settings = replace(
        settings::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE settings::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

-- ComfyUI workflow-каталог (если в JSON попало имя текстовой модели)
UPDATE comfyui_workflows
SET
    json_body = replace(
        json_body::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE json_body::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

UPDATE comfyui_workflows
SET
    model_dependencies = replace(
        model_dependencies::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE model_dependencies IS NOT NULL
  AND model_dependencies::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

UPDATE comfyui_workflows
SET
    metadata = replace(
        metadata::text,
        'Qwen3-4B.Q4_K_M.gguf',
        'gemma-4-26B.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE metadata IS NOT NULL
  AND metadata::text LIKE '%Qwen3-4B.Q4_K_M.gguf%';

COMMIT;
