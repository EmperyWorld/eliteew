-- ИМК: deep_market_showcase — склейка без LLM-merge (анти-сжатие), больший num_predict на шаг.
-- apply_migrations.sh; restart stack0-eliteew-api-worker-prod (и при необходимости API).

BEGIN;

UPDATE generation_types
SET
    type_metadata = jsonb_set(
        jsonb_set(
            COALESCE(type_metadata, '{}'::jsonb),
            '{imc_rag_merge_mode}',
            '"concat"',
            true
        ),
        '{imc_rag_step_num_predict}',
        '24576'::jsonb,
        true
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
