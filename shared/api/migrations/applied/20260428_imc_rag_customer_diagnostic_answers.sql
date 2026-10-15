-- ИМК: качественный разбор ответов представителя в клиентской диагностике (только переданный снимок сессии, без обогащения документами проекта).
-- Контекст для модели — только context.document_text из запроса (см. imc_diagnostic_answers_only в imc_service).
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
    'imc_rag_customer_diagnostic_answers',
    'document',
    'Анализ ответов клиентской диагностики',
    'Разбор формулировок и смысла ответов представителя по данным диагностики; без подмешивания материалов маркетингового проекта из поиска по документам.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object(
        'research_type', 'imc_rag_customer_diagnostic_answers',
        'prompt_instructions',
        'См. type_metadata.imc_prompt_instructions'
    ),
    'high',
    240,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', FALSE,
        'imc_diagnostic_answers_only', TRUE,
        'imc_answer_depth', 'deep',
        'category', 'marketing_cabinet',
        'imc_prompt_version', 1,
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 8192,
        'imc_rag_merge_num_predict', 16384,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 24576,
        'imc_rag_min_section_chars', 500,
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме для руководителя: что важного в ответах представителя',
            'По модулям диагностики: смысл ответов и ключевые формулировки',
            'Ясность, полнота и внутренняя согласованность ответов',
            'Риски и неоднозначности в том, как сформулированы ответы',
            'Что уточнить у представителя заказчика (вопросы для следующего контакта)',
            'Таблица: тема или вопрос — что ответил представитель — интерпретация для команды проекта',
            'Пробелы: какие блоки диагностики пусты или поверхностны'
        ),
        'imc_prompt_instructions',
        $PROMPT$ИНВАРИАНТЫ: (1) Единственный источник содержания ответов — блок «Данные клиентской диагностики» в контексте запроса (JSON/текст сессии и ответов); не подменяй формулировки и не приписывай ответы, которых нет. (2) Меток fragment=N из документов проекта в этом типе может не быть — не выдумывай цитаты из внешних материалов; для ссылок на источник используй «по данным диагностики», «в ответе по полю …», «модуль …». (3) Язык ответа — русский. (4) Если ответов мало — явно перечисли пробелы; не заполняй общими штампами.

ЗАДАЧА: помочь руководителю проекта понять, **что именно** сказал представитель заказчика словами и выборами в анкете: тон, акценты, возможные ожидания и зоны неясности — без синтеза «профиля бренда» из внешних знаний.

СТРУКТУРА: следуй imc_output_sections; избегай дублирования дословного JSON целиком — пересказывай смысл и при необходимости короткие цитаты в кавычках.

Не заканчивай отчёт шаблонными выводами без новой информации («данный отчёт представляет…»).$PROMPT$
    )
WHERE NOT EXISTS (
    SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_customer_diagnostic_answers'
);
