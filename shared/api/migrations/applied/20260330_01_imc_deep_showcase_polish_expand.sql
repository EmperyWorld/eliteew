-- ИМК deep_market_showcase: concat + полировка оформления; доп. вызовы для коротких глав.
-- apply_migrations.sh; restart stack0-eliteew-api-worker-prod.

BEGIN;

UPDATE generation_types
SET
    type_metadata =
        COALESCE(type_metadata, '{}'::jsonb)
        || jsonb_build_object(
            'imc_rag_merge_mode',
            'concat_polish',
            'imc_rag_polish_num_predict',
            65536,
            'imc_rag_min_section_chars',
            2200
        ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
