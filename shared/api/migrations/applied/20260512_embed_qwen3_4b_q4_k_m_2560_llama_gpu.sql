-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Согласовать UGS/настройки БД с эмбеддингами **Qwen3-Embedding-4B-Q4_K_M.gguf** (llama-embed, MRL **2560** в stack0).
-- Invariants:
-- - Провайдеры с base_url на TEI (tei-embed) не трогаем — там HF id (например Qwen/Qwen3-Embedding-8B).
-- - Идемпотентно: повторный запуск безопасен.
-- Related:
-- - docker/stack/stack2.yml (llama-embed CUDA), docker/env_file/.env.stack2, .env.stack0.backend (AI_EMBEDDINGS_DIMENSION=2560).
-- - 20260511_ugs_align_embedding_rerank_provider_models.sql (обратное направление с 8B → 4B для non-TEI).
-- ---

BEGIN;

-- Embeddings: non-TEI llama-embed — 8B Q4 GGUF → 4B Q4 GGUF (OpenAI model id = basename .gguf)
UPDATE generation_providers
SET
    config_json = replace(
        replace(
            COALESCE(config_json, '{}'::jsonb)::text,
            'Qwen3-Embedding-8B-Q4_K_M.gguf',
            'Qwen3-Embedding-4B-Q4_K_M.gguf'
        ),
        'Qwen/Qwen3-Embedding-8B',
        'Qwen3-Embedding-4B-Q4_K_M.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_embeddings'
  AND COALESCE(base_url, '') NOT ILIKE '%tei-embed%'
  AND (
        config_json::text ILIKE '%Qwen3-Embedding-8B-Q4_K_M.gguf%'
        OR (
            config_json::text ILIKE '%Qwen/Qwen3-Embedding-8B%'
            AND config_json::text NOT ILIKE '%tei-embed%'
        )
    );

-- JSONB-настройки UGS: только замена basename 8B → 4B (не трогаем HF id для TEI-конфигов).
UPDATE ugs_settings
SET
    value = replace(value::text, 'Qwen3-Embedding-8B-Q4_K_M.gguf', 'Qwen3-Embedding-4B-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE value::text ILIKE '%Qwen3-Embedding-8B-Q4_K_M.gguf%';

COMMIT;
