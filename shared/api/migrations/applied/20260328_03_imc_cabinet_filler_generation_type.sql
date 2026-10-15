-- ИМК «Заполнитель»: вывод структуры для разделов маркетингового кабинета только из векторной базы документов проекта (MISO, без веб-поиска).
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
VALUES (
    'imc_cabinet_filler',
    'document',
    'Заполнитель',
    'Извлекает из документов проекта (векторный поиск) краткие сведения для разделов кабинета. Без подходящих фрагментов — пустые поля в JSON.',
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object(
        'research_type', 'cabinet_filler',
        'prompt_instructions',
        'Только факты из фрагментов документов проекта; без выдумки и без внешних источников.'
    ),
    'high',
    120,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'imc_cabinet', TRUE,
        'category', 'marketing_cabinet',
        'imc_cabinet_filler', TRUE,
        'imc_vector_only', TRUE,
        'imc_rag_limit', 32
    )
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

COMMIT;
