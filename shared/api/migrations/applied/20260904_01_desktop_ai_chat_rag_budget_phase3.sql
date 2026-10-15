-- Phase 3 LLM redesign: tighten Desktop AI Chat RAG inject defaults when still at Phase-0 seeds.
-- Precedence: each key is updated only while it still holds the legacy seed; mixed admin overrides stay.
-- Related: documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md §6.2 / Phase 3

UPDATE desktop_ai_chat_config
SET defaults = jsonb_set(COALESCE(defaults, '{}'::jsonb), '{rag_top_k}', '8'::jsonb, true)
WHERE id = 1
  AND COALESCE((defaults->>'rag_top_k')::int, 12) = 12;

UPDATE desktop_ai_chat_config
SET defaults = jsonb_set(COALESCE(defaults, '{}'::jsonb), '{rag_max_chunks_chars}', '8000'::jsonb, true)
WHERE id = 1
  AND COALESCE((defaults->>'rag_max_chunks_chars')::int, 24000) = 24000;

UPDATE desktop_ai_chat_config
SET defaults = jsonb_set(COALESCE(defaults, '{}'::jsonb), '{rag_chat_max_chunks}', '8'::jsonb, true)
WHERE id = 1
  AND COALESCE((defaults->>'rag_chat_max_chunks')::int, 12) = 12;
