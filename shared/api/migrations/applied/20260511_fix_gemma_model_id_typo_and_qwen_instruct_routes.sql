-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Исправление опечатки идентификатора GGUF `gemma-4-26B.gguf26B.gguf` → `gemma-4-26B.gguf` и выравнивание
-- `model_routes` с единственной загруженной на stack2 моделью (см. LLAMA_CHAT_FILE / OLLAMA_MODEL).
-- Invariants:
-- Заменяются только известные строки имён файлов; идемпотентно при повторном запуске.
-- Related:
-- - migrations/applied/20260510_replace_qwen3_4b_gguf_instruct_2507.sql (исходная подмена с опечаткой)
-- - docker/env_file/.env.stack2, docker/env_file/.env.stack0.backend
-- ---

BEGIN;

-- Единственный ключ с подключёнными маршрутами: убираем опечатку и Qwen3-Instruct из прошлой редакции.
UPDATE ugs_settings
SET
    value = regexp_replace(
        regexp_replace(value::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g'),
        'Qwen3-4B-Instruct-2507-Q4_K_M\.gguf',
        'gemma-4-26B.gguf',
        'g'
    )::jsonb,
    updated_at = NOW()
WHERE key = 'model_routes';

-- Прочие JSON-настройки, если опечатка попала в value (идемпотентно).
UPDATE ugs_settings
SET
    value = regexp_replace(value::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE key != 'model_routes'
  AND value::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE generation_providers
SET
    config_json = regexp_replace(config_json::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE config_json::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE generation_types
SET
    model_name = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE model_name = 'gemma-4-26B.gguf26B.gguf';

UPDATE generation_types
SET
    parameters = regexp_replace(parameters::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE parameters IS NOT NULL
  AND parameters::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE generation_types
SET
    type_metadata = regexp_replace(type_metadata::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE type_metadata IS NOT NULL
  AND type_metadata::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE assistant_settings
SET
    ollama_model = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE ollama_model = 'gemma-4-26B.gguf26B.gguf';

UPDATE desktop_ai_chat_config
SET
    defaults = regexp_replace(defaults::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE defaults::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE desktop_ai_chats
SET
    ollama_model = 'gemma-4-26B.gguf',
    updated_at = NOW()
WHERE ollama_model = 'gemma-4-26B.gguf26B.gguf';

UPDATE desktop_ai_chats
SET
    settings = regexp_replace(settings::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE settings::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE comfyui_workflows
SET
    json_body = regexp_replace(json_body::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE json_body::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE comfyui_workflows
SET
    model_dependencies = regexp_replace(model_dependencies::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE model_dependencies IS NOT NULL
  AND model_dependencies::text LIKE '%gemma-4-26B.gguf26B.gguf%';

UPDATE comfyui_workflows
SET
    metadata = regexp_replace(metadata::text, 'gemma-4-26B\.gguf26B\.gguf', 'gemma-4-26B.gguf', 'g')::jsonb,
    updated_at = NOW()
WHERE metadata IS NOT NULL
  AND metadata::text LIKE '%gemma-4-26B.gguf26B.gguf%';

COMMIT;
