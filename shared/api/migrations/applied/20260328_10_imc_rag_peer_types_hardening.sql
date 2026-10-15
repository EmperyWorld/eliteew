-- ИМК RAG: те же классы ошибок, что ловили на deep_market_showcase — для остальных типов.
-- 1) imc_rag_trends_signals: оркестрация уже есть; LLM-merge сжимал отчёт — concat_polish + порог короткой главы + правка формулировки про «Источник» в методологии.
-- 2) imc_rag_swot / jtbd / cabinet_analysis / competitive: доп. абзац в imc_prompt_instructions (читаемый источник, таблицы без fenced).
-- После apply: ./apply_migrations.sh; рестарт stack0-eliteew-api-worker-prod.

BEGIN;

-- Тренды: anti-сжатие при склейке разделов + выравнивание таблицы с глобальными правилами промпта.
UPDATE generation_types
SET
    type_metadata = jsonb_set(
        COALESCE(type_metadata, '{}'::jsonb)
        || jsonb_build_object(
            'imc_rag_merge_mode',
            'concat_polish',
            'imc_rag_polish_num_predict',
            32768,
            'imc_rag_min_section_chars',
            1200,
            'imc_prompt_version',
            CASE
                WHEN (type_metadata->>'imc_prompt_version') ~ '^[0-9]+$'
                    THEN (type_metadata->>'imc_prompt_version')::int + 1
                ELSE 1
            END
        ),
        '{imc_prompt_instructions}',
        to_jsonb(
            replace(
                replace(
                    type_metadata->>'imc_prompt_instructions',
                    'в колонке «Источник» у каждой строки — полная метка из контекста.',
                    'в колонке «Источник» — читаемый вид «**{label}** (фр. N)» из метки фрагмента (поля label= и fragment=); не копируй целиком сырую строку fragment=… content_id=… chunk_index=….'
                ),
                'полная метка из контекста.',
                'читаемый вид «**{label}** (фр. N)»; не сырая строка fragment=/content_id.'
            )
        )
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_trends_signals';

-- Одиночный проход (без оркестрации): явная стыковка с build_rag_research_prompt по таблицам.
UPDATE generation_types
SET
    type_metadata =
        jsonb_set(
            COALESCE(type_metadata, '{}'::jsonb),
            '{imc_prompt_instructions}',
            to_jsonb(
                trim(
                    both
                    FROM
                        concat(
                            coalesce(type_metadata->>'imc_prompt_instructions', ''),
                            E'\n\n',
                            'ДОПОЛНЕНИЕ (оформление для заказчика): в финальной таблице «факт — цитата — источник» колонка «Источник» — только вид «**{label}** (фр. N)», как в общих правилах генератора; не вставляй в ячейки сырой набор fragment=… content_id=…. Таблицы markdown — строки с | … |; не оборачивай таблицу fenced-блоком markdown.'
                        )
                )
            )
        )
        || jsonb_build_object(
            'imc_prompt_version',
            CASE
                WHEN (type_metadata->>'imc_prompt_version') ~ '^[0-9]+$'
                    THEN (type_metadata->>'imc_prompt_version')::int + 1
                ELSE 1
            END
        ),
    updated_at = NOW()
WHERE type_key IN (
    'imc_rag_swot',
    'imc_rag_jtbd',
    'imc_rag_cabinet_analysis',
    'imc_rag_competitive'
);

COMMIT;
