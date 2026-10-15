-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Согласовать UGS `generation_providers` с вынесенным на LAN **llama-remote**: `base_url` эмбеда/реранка
-- вместо `stack2-llama-embed` / `stack2-llama-rerank`, плюс **Qwen3-Embedding-8B-Q4_K_M.gguf** в non-TEI
-- text_embeddings (обратно к 8B после локального 4B в `20260512_embed_qwen3_4b_q4_k_m_2560_llama_gpu.sql`).
-- Invariants:
-- - Провайдеры с `base_url` / конфигом **TEI** (`tei-embed`, HF id) **не** трогаем.
-- - `imc_rag_research_provider` и прочие **text** LLM не меняем — только роли `text_embeddings` / `text_rerank`.
-- - Идемпотентно: повторный запуск не ломает уже обновлённые строки.
-- Related:
-- - `docker/env_file/.env.stack0.backend` (`OLLAMA_EMBEDDING_URL`, `RAG_RERANK_BASE_URL`, порты с удалённого `.env.llama-remote`)
-- - `docker/stack/stack2-llama-remote-embed-rerank.yml`; `documentation/platform/STACK2-LLM-CONTRACT.md`
-- - `applied/20260512_embed_qwen3_4b_q4_k_m_2560_llama_gpu.sql` (4B локально)
-- ---

BEGIN;

-- Embeddings: Docker stack2 → LAN llama-remote (порты как в `.env.stack0.backend` / удалённом compose)
UPDATE generation_providers
SET
    base_url = 'http://192.168.1.141:18080',
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_embeddings'
  AND COALESCE(base_url, '') NOT ILIKE '%tei-embed%'
  AND COALESCE(base_url, '') ILIKE '%stack2-llama-embed%';

-- Rerank: Docker stack2 → LAN llama-remote
UPDATE generation_providers
SET
    base_url = 'http://192.168.1.141:18081',
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_rerank'
  AND COALESCE(base_url, '') ILIKE '%stack2-llama-rerank%';

-- Non-TEI embeddings: 4B GGUF id → 8B GGUF (см. OLLAMA_EMBEDDING_MODEL на stack0)
UPDATE generation_providers
SET
    config_json = replace(
        replace(
            COALESCE(config_json, '{}'::jsonb)::text,
            'Qwen3-Embedding-4B-Q4_K_M.gguf',
            'Qwen3-Embedding-8B-Q4_K_M.gguf'
        ),
        'Qwen/Qwen3-Embedding-8B',
        'Qwen3-Embedding-8B-Q4_K_M.gguf'
    )::jsonb,
    updated_at = NOW()
WHERE LOWER(COALESCE(config_json->>'provider_role', '')) = 'text_embeddings'
  AND COALESCE(base_url, '') NOT ILIKE '%tei-embed%'
  AND config_json::text ILIKE '%Qwen3-Embedding-4B-Q4_K_M.gguf%';

UPDATE ugs_settings
SET
    value = replace(value::text, 'Qwen3-Embedding-4B-Q4_K_M.gguf', 'Qwen3-Embedding-8B-Q4_K_M.gguf')::jsonb,
    updated_at = NOW()
WHERE value::text ILIKE '%Qwen3-Embedding-4B-Q4_K_M.gguf%';

COMMIT;
