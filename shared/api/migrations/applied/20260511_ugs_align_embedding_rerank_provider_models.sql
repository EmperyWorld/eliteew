-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Выровнять в БД идентификаторы моделей для UGS-провайдеров с ролью embeddings / rerank под stack2
-- (llama-server): см. docker/env_file/.env.stack2 — LLAMA_EMBED_FILE, LLAMA_RERANK_FILE.
-- Invariants:
-- - Провайдеры с base_url на TEI (tei-embed) не меняем — там остаётся HF model id (например Qwen/Qwen3-Embedding-8B).
-- - Идемпотентно: повторный replace тот же результат.
-- Related:
-- - 20260510_replace_qwen3_4b_gguf_instruct_2507.sql (чат); documentation/platform/STACK2-LLM-CONTRACT.md
-- ---

BEGIN;

-- Embeddings (llama-embed / OpenAI-совместимый id = basename .gguf)
UPDATE generation_providers
SET
    config_json = replace(
        replace(
            replace(
                COALESCE(config_json, '{}'::jsonb)::text,
                'qwen-embed-16k:latest',
                'Qwen3-Embedding-8B-Q4_K_M.gguf'
            ),
            'Qwen3-Embedding-4B-Q4_K_M.gguf',
            'Qwen3-Embedding-8B-Q4_K_M.gguf'
        ),
        'Qwen/Qwen3-Embedding-8B',
        'Qwen3-Embedding-8B-Q4_K_M.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_embeddings'
  AND COALESCE(base_url, '') NOT ILIKE '%tei-embed%'
  AND (
        config_json::text ILIKE '%Qwen/Qwen3-Embedding-8B%'
        OR config_json::text ILIKE '%Qwen3-Embedding-4B%'
        OR config_json::text ILIKE '%qwen-embed-16k%'
    );

-- Rerank (llama-server --reranking; basename как у файла на диске, точка перед Q4)
UPDATE generation_providers
SET
    config_json = replace(
        replace(
            COALESCE(config_json, '{}'::jsonb)::text,
            'bge-reranker-v2-m3-Q4_K_M.gguf',
            'Qwen3-Reranker-8B.Q4_K_M.gguf'
        ),
        'Qwen3-Reranker-8B-Q4_K_M.gguf',
        'Qwen3-Reranker-8B.Q4_K_M.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_rerank'
  AND (
        config_json::text ILIKE '%bge-reranker-v2-m3%'
        OR config_json::text ILIKE '%Qwen3-Reranker-8B-Q4_%'
    );

COMMIT;
