-- Idempotent repair: IMC RAG uses embeddings for retrieval only, not as the text LLM.
--
-- The retrieval path reads OLLAMA_EMBEDDING_URL / OLLAMA_EMBEDDING_MODEL directly from env.
-- UGS provider/model routes for imc_rag_* must point to the chat/text LLM server and model.

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
WHERE provider_name = 'imc_rag_research_provider';

UPDATE ugs_settings
SET
    value = jsonb_set(
        jsonb_set(
            jsonb_set(
                value::jsonb,
                '{provider_defaults,imc_rag_research_provider}',
                to_jsonb('qwen3-14b-q4_k_m.gguf'::text),
                true
            ),
            '{type_overrides}',
            COALESCE(
                (
                    SELECT jsonb_object_agg(
                        route_key,
                        CASE
                            WHEN route_key LIKE 'imc_rag_%' THEN to_jsonb('qwen3-14b-q4_k_m.gguf'::text)
                            ELSE route_value
                        END
                    )
                    FROM jsonb_each(COALESCE(value::jsonb->'type_overrides', '{}'::jsonb)) AS routes(route_key, route_value)
                ),
                '{}'::jsonb
            ),
            true
        ),
        '{domain_defaults,imc}',
        to_jsonb('qwen3-14b-q4_k_m.gguf'::text),
        true
    ),
    updated_at = NOW()
WHERE key = 'model_routes';

COMMIT;
