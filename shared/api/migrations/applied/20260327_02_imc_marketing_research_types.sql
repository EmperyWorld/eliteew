-- Дополнительные маркетинговые типы ИМК (imc_*): тот же провайдер MISO, разные фокусы через parameters.
-- UGS: provider_manager_service_v2._call_miso принимает marketing_research_creator и все ключи imc_*.
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
        'imc_competitive_landscape',
        'document',
        'Конкурентный ландшафт',
        'Сравнение игроков, барьеры входа, белые пятна рынка. / Competitive landscape and market structure.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'competitive_landscape',
            'prompt_instructions',
            'Дай структурированный обзор конкурентов и косвенных заменителей: сегменты, сильные стороны, ценовые уровни, каналы, риски. Выдели возможности для дифференциации.'
        ),
        'high',
        180,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
    ),
    (
        'imc_audience_deep_dive',
        'document',
        'Портрет аудитории',
        'Jobs, боли, триггеры покупки, медиапотребление. / Audience jobs, pains, triggers, media habits.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'audience_deep_dive',
            'prompt_instructions',
            'Построй глубокий портрет ЦА: сегменты, JTBD, барьеры и мотивация, типичный customer journey, каналы доверия и форматы контента.'
        ),
        'high',
        180,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
    ),
    (
        'imc_gtm_channels',
        'document',
        'GTM и каналы',
        'Каналы привлечения, активация, экономика касания. / GTM motion, channels, activation.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'gtm_channels',
            'prompt_instructions',
            'Предложи GTM-гипотезу: приоритетные каналы, последовательность запуска, метрики этапов, типичные бюджеты/CPM/CPL как ориентиры, риски каналов.'
        ),
        'high',
        180,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
    ),
    (
        'imc_pricing_packaging',
        'document',
        'Цена и упаковка оффера',
        'Тарифы, монетизация, сравнение с рынком. / Pricing, packaging, monetization.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'pricing_packaging',
            'prompt_instructions',
            'Разбери ценообразование и упаковку: модели монетизации, сравнение с конкурентами, психология цены, апсейл/кросс-сейл, типичные ошибки.'
        ),
        'medium',
        150,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
    ),
    (
        'imc_content_messaging',
        'document',
        'Сообщения и тон',
        'Ключевые месседжи, доказательства, tone of voice. / Messaging matrix, proof points, ToV.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'content_messaging',
            'prompt_instructions',
            'Сформируй матрицу сообщений: для каждого сегмента — главный месседж, доказательства, возражения и ответы, рекомендуемый тон (ToV), примеры формулировок.'
        ),
        'medium',
        150,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
    ),
    (
        'imc_brand_positioning',
        'document',
        'Позиционирование бренда',
        'Дифференциация, обещание, доказательства. / Brand positioning, promise, proof.',
        COALESCE((SELECT provider FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'miso_provider'),
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'brand_positioning',
            'prompt_instructions',
            'Опиши позиционирование: категория, для кого продукт, отличие от альтернатив, обещание бренду, доказательства, риски размытия позиции.'
        ),
        'high',
        180,
        COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 3),
        COALESCE((SELECT priority FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 5),
        COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 1.0),
        TRUE,
        jsonb_build_object('imc_cabinet', TRUE, 'category', 'marketing_cabinet')
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

COMMIT;
