-- ИМК RAG: тип полного маркетингового исследования (12 разделов + оркестрация + deep).
-- apply_migrations.sh; при необходимости restart stack0-eliteew-api-worker-prod.

BEGIN;

INSERT INTO generation_types (
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
SELECT * FROM (VALUES
    (
        'imc_rag_deep_market_showcase',
        'document',
        'Глубокое маркетинговое исследование',
        '12 разделов: рынок, сегменты, JTBD-крючки, конкуренты, 4P, каналы, PESTEL, тренды, риски, опции, пробелы + таблица трассировки. Оркестрация по разделам для максимального объёма вывода.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_deep_market_showcase',
            'prompt_instructions',
            'См. type_metadata.imc_prompt_instructions'
        ),
        'high',
        960,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0) * 1.5,
        TRUE,
        jsonb_build_object(
            'imc_cabinet', TRUE,
            'imc_vector_only', TRUE,
            'imc_use_merged_context', TRUE,
            'imc_rag_project_only', TRUE,
            'imc_rag_limit', 40,
            'imc_answer_depth', 'deep',
            'imc_prompt_version', 1,
            'category', 'marketing_cabinet',
            'imc_rag_orchestrate', TRUE,
            'imc_rag_orchestrate_mode', 'sections',
            'imc_rag_orchestrate_max_steps', 12,
            'imc_rag_step_num_predict', 12288,
            'imc_rag_merge_num_predict', 32768,
            'imc_output_sections', jsonb_build_array(
                'Executive summary: стратегия, рынок, ключевые инсайты (только из контекста)',
                'Рынок и категория: границы, драйверы спроса, ориентиры TAM/SAM/SOM — если явно есть во фрагментах',
                'Сегментация и ICP / B2B-B2C-профили, критерии отбора и анти-персоны',
                'JTBD и мотивации: формулировки работ и барьеры (без выдуманных сегментов)',
                'Конкурентный ландшафт, позиционирование и белые пятна из материалов',
                'Маркетинг-микс 4P и ценностное предложение (факты из документов)',
                'Каналы, воронка и точки касания — только подтверждённое контекстом',
                'PESTEL / внешняя среда и регуляторика — строго по цитатам',
                'Тренды, слабые сигналы и ранние индикаторы (с метками фрагментов)',
                'Риски, допущения и качественные сценарии «если — то»',
                'Стратегические опции и приоритизация (impact × feasibility, без чисел «из головы»)',
                'Пробелы данных, следующие исследовательские вопросы; таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: единственный источник фактов — переданные фрагменты vault. Веб, выдуманные бренды, цифры рынка, ссылки и «типовые» кейсы без цитаты запрещены. Каждый существенный тезис сопровождай цитатой или пересказом с меткой фрагмента (`fragment=`, `content_id=`). Язык — русский.

РОЛЬ: ведущий маркетинговый исследователь (full-scope desktop research): от картины рынка до опций и плана углубления.

ГЛУБИНА (полнота отчёта): в каждом разделе минимум **2–4 содержательных абзаца**, плюс по необходимости списки или подзаголовки ###. Запрещены «стабы»: один заголовок без текста, чек bullets без фактов, фразы «см. выше» вместо содержания. Если данных для подпункта нет — одно честное предложение «В контексте нет опоры для …» и переход к тому, что есть.

**Запрещено** сводить отчёт к одной таблице или к общим рекомендациям без цитат. В разделах **4P**, **каналы**, **PESTEL**, **тренды** явно пиши «что следует из текста» → «интерпретация для маркетинга» → «оговорка/пробел».

СВЯЗКА РАЗДЕЛОВ: в executive summary отрази только то, что раскрыто глубже в других блоках; не дублируй дословно весь текст, но и не обобщай до потери фактов.

ФИНАЛ: последний раздел обязан содержать **таблицу** «факт — цитата (кратко) — источник-фрагмент»; строки только из реальных различимых фактов, без повторения одной метки для несвязанных тезисов.

Оркестрация: ты пишешь **один** раздел за проход по фокусу; не оглавление и не весь отчёт сразу.$PROMPT$
        )
    )
) AS v(
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
ON CONFLICT (type_key) DO UPDATE SET
    category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    parameters = EXCLUDED.parameters,
    complexity = EXCLUDED.complexity,
    estimated_time = EXCLUDED.estimated_time,
    max_retries = EXCLUDED.max_retries,
    priority = EXCLUDED.priority,
    cost_credits = EXCLUDED.cost_credits,
    is_active = EXCLUDED.is_active,
    type_metadata = EXCLUDED.type_metadata,
    updated_at = NOW();

UPDATE generation_types
SET
    model_name = 'rscr/vikhr_llama3.1_8b:Q4_K_M',
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
