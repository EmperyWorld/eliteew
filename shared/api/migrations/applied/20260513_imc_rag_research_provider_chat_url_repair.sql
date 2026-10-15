-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Починить `imc_rag_research_provider.base_url`, если он указывает на stack2-embed/rerank/TEI:
-- там n_ctx порядка 4k–8k, ИМК RAG с длинным merged context получает HTTP 400 exceed_context_size.
-- Invariants:
-- - Трогаем только строки с заведомо не-текстовыми хостами; кастомные chat URL не перезаписываем.
-- - Идемпотентно.
-- Related:
-- - `shared/api/migrations/applied/20260506_06_imc_rag_text_llm_route_repair.sql`
-- - `docker/stack/stack2.yml` (llama-chat vs llama-embed ctx)
-- ---

BEGIN;

UPDATE generation_providers
SET
    base_url = 'http://stack2-llama-chat:8080',
    config_json = jsonb_build_object(
        'models',
        jsonb_build_array('qwen3-14b-q4_k_m.gguf'),
        'default_model',
        'qwen3-14b-q4_k_m.gguf',
        'provider_role',
        'text'
    ),
    updated_at = NOW()
WHERE provider_name = 'imc_rag_research_provider'
  AND (
    base_url ILIKE '%llama-embed%'
    OR base_url ILIKE '%llama-rerank%'
    OR base_url ILIKE '%tei-embed%'
  );

COMMIT;
