-- ИМК: анализ результатов клиентской диагностики с опорой на vault/RAG проекта (как imc_rag_trends_signals).
-- После применения: apply_migrations.sh; при необходимости restart stack0-eliteew-api-worker-prod.

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
SELECT
    'imc_rag_customer_diagnostic',
    'document',
    'Анализ клиентской диагностики',
    'Синтез профиля заказчика по ответам диагностики и материалам проекта (PG+RAG); рекомендации руководителю без веб-поиска.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object(
        'research_type', 'imc_rag_customer_diagnostic',
        'prompt_instructions',
        'См. type_metadata.imc_prompt_instructions'
    ),
    'high',
    300,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_answer_depth', 'deep',
        'category', 'marketing_cabinet',
        'imc_prompt_version', 1,
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 9,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 900,
        'imc_output_sections', jsonb_build_array(
            'Executive summary для руководителя проекта',
            'Интерпретация профиля по данным диагностики (архетип, ценности, бизнес, сервис, эмоции)',
            'Согласованность выводов с материалами проекта (цитаты из vault)',
            'Риски и гипотезы для работы с заказчиком',
            'Рекомендации: стратегия и коммуникация',
            'Рекомендации: операции, сервис, следующие шаги',
            'Пробелы данных и что уточнить у команды',
            'Таблица: факт — цитата — источник (метка фрагмента из контекста проекта)'
        ),
        'imc_prompt_instructions',
        $PROMPT$ИНВАРИАНТЫ: (1) Блок «Данные диагностики» во входном контексте запроса (context.document_text / context) — единственный источник чисел, ответов представителя и агрегированных метрик диагностики; не подменяй и не «додумывай» профиль. (2) Факты о продукте, рынке и проекте вне диагностики — только из переданных фрагментов vault/RAG; запрещены веб-поиск и вымышленные URL. (3) Язык ответа — русский. (4) Если фрагментов мало — явно укажи пробелы; не заполняй общими фразами.

ЗАДАЧА: подготовить отчёт для руководителя маркетингового проекта: как интерпретировать результаты клиентской диагностики заказчика в связке с материалами проекта (стратегия, позиционирование, ожидания по сервису, эмоциональный контур).

СТРУКТУРА: следуй imc_output_sections; в разделах с опорой на vault каждый существенный тезис сопровождай цитатой; в колонке «Источник» для строк из vault — читаемый вид метки фрагмента (как в методологии «Тренды и сигналы»), не сырая простыня полей. Разделы, основанные только на диагностике, помечай как «по данным диагностики» без выдуманных внешних фактов.

ЗАПРЕЩЕНО заканчивать отчёт шаблонными выводами без новой информации («данный отчёт представляет…»).$PROMPT$
    )
WHERE NOT EXISTS (
    SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_customer_diagnostic'
);
