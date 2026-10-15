-- ИМК RAG: пилот оркестрации для imc_rag_trends_signals (разделы + merge в одном generation_request).
-- После применения: apply_migrations.sh + при необходимости restart stack0-eliteew-api-worker-prod.

UPDATE generation_types
SET type_metadata = type_metadata
    || jsonb_build_object(
        'imc_prompt_version',
        CASE
            WHEN (type_metadata->>'imc_prompt_version') ~ '^[0-9]+$'
                THEN (type_metadata->>'imc_prompt_version')::int + 1
            ELSE 1
        END,
        'imc_rag_orchestrate', true,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 10,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 20480
    )
WHERE type_key = 'imc_rag_trends_signals';
