-- ИМК RAG: вернуть пошаговую оркестрацию (sections + merge) для активных cabinet-типов.
-- imc_prompt_version 3 — orchestrate с явными step/merge num_predict (не prod IMC_RAG_NUM_PREDICT на каждый шаг).
-- Playbook: documentation/product/marketing/IMC-RESEARCH-TYPES-PLAYBOOK.md

BEGIN;

UPDATE generation_types
SET
    type_metadata = type_metadata || jsonb_build_object(
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', LEAST(
            GREATEST(
                jsonb_array_length(COALESCE(type_metadata->'imc_output_sections', '[]'::jsonb)),
                2
            ),
            10
        ),
        'imc_rag_step_num_predict', 8192,
        'imc_rag_merge_num_predict', 12288,
        'imc_prompt_version', 3
    ),
    updated_at = NOW()
WHERE provider = 'imc_rag_research_provider'
  AND is_active = TRUE
  AND type_key LIKE 'imc_rag_%'
  AND COALESCE((type_metadata->>'imc_cabinet')::boolean, FALSE) = TRUE
  AND jsonb_array_length(COALESCE(type_metadata->'imc_output_sections', '[]'::jsonb)) >= 2;

COMMIT;
