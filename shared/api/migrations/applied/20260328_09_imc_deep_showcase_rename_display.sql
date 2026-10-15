-- ИМК: `imc_rag_deep_market_showcase` — убрать слово «демо» из отображаемого названия и из текста методологии.
-- apply: ./shared/api/migrations/apply_migrations.sh (или psql вручную).
-- После применения перезапуск API не обязателен; типы читаются из БД при запросе `/imc/types`.

BEGIN;

UPDATE generation_types
SET
    display_name = 'Глубокое маркетинговое исследование',
    type_metadata = CASE
        WHEN type_metadata ? 'imc_prompt_instructions'
            AND type_metadata->>'imc_prompt_instructions' IS NOT NULL
        THEN jsonb_set(
            type_metadata,
            '{imc_prompt_instructions}',
            to_jsonb(
                replace(
                    type_metadata->>'imc_prompt_instructions',
                    'ГЛУБИНА (демо полноты):',
                    'ГЛУБИНА (полнота отчёта):'
                )
            )
        )
        ELSE type_metadata
    END,
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
