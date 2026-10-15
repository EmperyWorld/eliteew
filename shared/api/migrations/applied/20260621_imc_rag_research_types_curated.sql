-- ИМК RAG: кураторский набор типов исследований — понятные названия, анти-«вода» промпты,
-- отключение orchestrate (меньше зацикливаний 8B), снятие дублей и операторского мусора.
-- Playbook: documentation/product/marketing/IMC-RESEARCH-TYPES-PLAYBOOK.md
-- apply_migrations.sh; при необходимости restart stack0-eliteew-api-worker-prod.

BEGIN;

-- 1) Снять с кабинета дубли и узкие ops-типы (successor — imc_legacy_type_successors.py).
UPDATE generation_types
SET is_active = FALSE, updated_at = NOW()
WHERE type_key IN (
    'imc_rag_stakeholder_decision_raci',
    'imc_rag_cx_service_ops_recovery',
    'imc_rag_customer_diagnostic_answers',
    'imc_rag_rf_operating_context',
    'imc_rag_brand_identity_compliance',
    'imc_rag_content_comms_strategy'
);

-- 2) Общий каркас метаданных: single-pass RAG, без multi-step orchestrate.
-- imc_prompt_version 2 — маркер переписанных инструкций.

UPDATE generation_types SET
    display_name = 'SWOT-анализ',
    description = 'Сильные и слабые стороны, возможности и угрозы — только по загруженным материалам проекта.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Сильные стороны (с цитатами)',
            'Слабые стороны (с цитатами)',
            'Возможности (с цитатами)',
            'Угрозы (с цитатами)',
            'Пробелы: чего не хватает в материалах',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только переданный контекст проекта; без веба; русский; без выдуманных фактов.
Если для квадранта нет цитат — напиши «Недостаточно материалов» и что загрузить.
Не пиши общие советы и шаблонные вступления.

ЗАДАЧА: SWOT-матрица по материалам проекта. Каждый пункт — с цитатой до 400 символов.
При противоречиях во фрагментах — покажи обе версии и пометь конфликт.
Финал: таблица факт — цитата — источник (метка фрагмента из контекста).$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_swot';

UPDATE generation_types SET
    display_name = 'Задачи клиентов (JTBD)',
    description = 'Какие «работы» решает продукт для клиента, барьеры и критерии успеха — по интервью, опросам и брифам в проекте.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Формулировки работ (When / Want / So that)',
            'Критерии успеха и ожидаемый результат',
            'Барьеры и возражения',
            'Альтернативы и конкурирующие решения (если есть в тексте)',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст проекта; без веба; русский; не выдумывай сегменты и метрики.
Сегментируй по работам, а не только по демографии.

ЗАДАЧА: JTBD-разбор по материалам. Каждая работа — с цитатой. Без «воды» и повторов между разделами.
Если данных мало — перечисли, какие материалы нужны (интервью, опрос, транскрипты).$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_jtbd';

UPDATE generation_types SET
    display_name = 'Конкурентный анализ',
    description = 'Кто конкурирует с продуктом, чем отличаются предложения и где есть пробелы — по вашим материалам.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Список конкурентов и заменителей (из контекста)',
            'Сравнение по осям, которые явно есть в материалах',
            'Сильные и слабые стороны конкурентов (с цитатами)',
            'Возможности для отстройки',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только фрагменты проекта; запрещены выдуманные карточки конкурентов и веб-поиск; русский.
Каждый тезис — с цитатой. Юридические утверждения без опоры — «требует проверки».

ЗАДАЧА: конкурентный ландшафт по внутренним материалам. Не добавляй игроков, которых нет в контексте.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_competitive';

UPDATE generation_types SET
    display_name = 'Тренды и риски рынка',
    description = 'Какие изменения рынка, регуляторики и спроса видны в ваших документах — без «прогнозов с потолка».',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме (3–5 выводов из контекста)',
            'Тренды и драйверы (с цитатами)',
            'Риски и ограничения (с цитатами)',
            'Слабые сигналы — только если есть во фрагментах',
            'Что проверить дополнительно',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба и вымышленных URL; русский.
Не называй «трендом» общие фразы без цитаты. Если локального (РФ) контура нет во фрагментах — не выдумывай его.

ЗАДАЧА: собрать из материалов проекта наблюдаемые тренды и риски. Приоритизируй качественно (влияние × неопределённость) только для пунктов с цитатами.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_trends_signals';

UPDATE generation_types SET
    display_name = 'Сводка по материалам',
    description = 'Короткий связный отчёт для команды: что уже известно о продукте и рынке по загруженным файлам.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 32,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме для команды',
            'Продукт и предложение (факты из контекста)',
            'Рынок и клиенты (факты из контекста)',
            'Конкуренты и альтернативы (если есть в материалах)',
            'Противоречия между документами',
            'Что уточнить у команды',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский; не подменяй отсутствие данных списком общих рекомендаций.

ЗАДАЧА: честная сводка «что мы знаем из материалов». Не дублируй полноценный SWOT — только синтез фактов.
Каждый абзац с новой информацией; конфликты между фрагментами показывай явно.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_cabinet_analysis';

UPDATE generation_types SET
    display_name = 'Путь клиента',
    description = 'Этапы, касания и проблемные места на пути клиента — по воронке, скриптам и обращениям в проекте.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Этапы пути и цель на этапе',
            'Касания и каналы (с цитатами)',
            'Трения и разрывы ожиданий',
            'Приоритетные улучшения (только если следуют из цитат)',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Фокус на опыте и касаниях, не на JTBD-формулировках работ.
Не выдумывай SLA и регламенты без цитаты.

ЗАДАЧА: карта пути клиента по материалам. Каждый этап — с опорой на текст. Без шаблонных CX-рекомендаций.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_cx_journey';

UPDATE generation_types SET
    display_name = 'Отзывы и опросы клиентов',
    description = 'Темы, цитаты и противоречия из отзывов, NPS/CSAT и расшифровок — без выдуманных процентов.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Темы и примеры цитат',
            'Противоречия в формулировках',
            'Оценки и метрики — только если явно в тексте',
            'Пробелы выборки',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только тексты опросов, отзывов и саммари из контекста; без веба; русский.
Не выдумывай проценты и размер выборки. Не пиши «рынок считает» без цитаты.

ЗАДАЧА: тематический разбор голоса клиента. Минимум одна цитата на тему.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_voice_of_customer';

UPDATE generation_types SET
    display_name = 'Позиционирование и сообщения',
    description = 'Как продукт позиционируется, ключевые сообщения и доказательства — по брендбуку, креативам и брифам.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Позиционирование и аудитория (из контекста)',
            'Иерархия сообщений / УТП',
            'Доказательства (reasons to believe) с цитатами',
            'Противоречия между материалами',
            'Таблица: обещание — доказательство — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Это не аудит гайдлайнов — фокус на смысле сообщений и УТП.
Каждое обещание — с доказательством из цитаты или пометка «нет опоры в материалах».$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_positioning_messaging';

UPDATE generation_types SET
    display_name = 'Цены и пакеты',
    description = 'Тарифы, скидки и логика упаковки оффера — по прайсам и коммерческим предложениям в проекте.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Пакеты и условия (из контекста)',
            'Напряжения и неоднозначности в ценообразовании',
            'Что согласовать с юристом/финансами (без выводов «с потолка»)',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не придумывай тарифы и скидки.
Юридические и налоговые выводы без цитаты — «требует проверки специалистом».$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_pricing_packaging_rf';

UPDATE generation_types SET
    display_name = 'Каналы продвижения',
    description = 'Какие каналы, партнёры и медиапланы описаны в материалах — без «идеальных» каналов не из проекта.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Карта каналов и ролей',
            'Барьеры и риски (из текста)',
            'Пробелы в канальной стратегии',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не предлагай каналы, которых нет в материалах.
Каждый канал — с цитатой или пометка «не описан в проекте».$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_channel_partner_rf';

UPDATE generation_types SET
    display_name = 'План запуска на рынок',
    description = 'Этапы вывода продукта, зависимости и риски — по внутренним GTM-брифам и дорожным картам.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 30,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Этапы запуска и зависимости',
            'Риски и допущения (с цитатами)',
            'Критерии готовности — если есть в тексте',
            'Расхождения между документами',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не генерируй «типовой GTM» без опоры.
Этапы — только те, что следуют из материалов.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_marketing_gtm_plan';

UPDATE generation_types SET
    display_name = 'Разбор кампании',
    description = 'Что планировали, что получилось и какие выводы — по отчётам и постмортемам кампании в проекте.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Цели кампании (из контекста)',
            'Факты и метрики — как в тексте, без додумывания',
            'Выводы и расхождения',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не улучшай цифры и KPI — цитируй как в документе.
Ретроспектива, а не план новой кампании.$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_campaign_retrospective';

UPDATE generation_types SET
    display_name = 'Профиль заказчика',
    description = 'Интерпретация клиентской диагностики в связке с материалами проекта — для руководителя проекта.',
    type_metadata = jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме для руководителя',
            'Выводы по данным диагностики',
            'Согласованность с материалами проекта (цитаты)',
            'Риски и гипотезы для работы с заказчиком',
            'Рекомендации по коммуникации (только из контекста)',
            'Пробелы данных',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: блок «Данные диагностики» во входе — источник ответов и метрик диагностики; не подменяй профиль.
Факты о продукте вне диагностики — только из фрагментов vault; без веба; русский.

ЗАДАЧА: связать диагностику заказчика с материалами проекта. Разделы по vault — с цитатами; по диагностике — пометка «по данным диагностики».$P$
    ),
    updated_at = NOW()
WHERE type_key = 'imc_rag_customer_diagnostic';

-- 3) Два новых полезных типа
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_target_audience',
    'document',
    'Целевая аудитория',
    'Кто ваш клиент: сегменты, персоны и ICP — только по интервью, опросам и брифам в проекте.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 'rscr/vikhr_llama3.1_8b:Q4_K_M'),
    jsonb_build_object('research_type', 'imc_rag_target_audience', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
    'high',
    240,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Сегменты и персоны (из контекста)',
            'Потребности, контекст покупки, триггеры',
            'Критерии выбора и возражения',
            'Пробелы: чего не хватает для ICP',
            'Таблица: факт — цитата — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не выдумывай демографию и «типовую ЦА».
Каждый сегмент — с цитатой. Отличай гипотезу от подтверждённого факта.$P$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_target_audience');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_value_proposition',
    'document',
    'Ценностное предложение',
    'Какую ценность продукт даёт клиенту и чем это подтверждено — по брифам, лендингам и исследованиям в проекте.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 'rscr/vikhr_llama3.1_8b:Q4_K_M'),
    jsonb_build_object('research_type', 'imc_rag_value_proposition', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
    'high',
    240,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'imc_rag_swot' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'imc_cabinet', TRUE,
        'imc_vector_only', TRUE,
        'imc_use_merged_context', TRUE,
        'imc_rag_project_only', TRUE,
        'imc_rag_limit', 28,
        'imc_rag_orchestrate', FALSE,
        'imc_prompt_version', 2,
        'category', 'marketing_cabinet',
        'imc_output_sections', jsonb_build_array(
            'Краткое резюме',
            'Формулировка ценности для клиента',
            'Выгоды и доказательства (с цитатами)',
            'Отличия от альтернатив (если есть в материалах)',
            'Слабые места и пробелы в аргументации',
            'Таблица: обещание — доказательство — источник'
        ),
        'imc_prompt_instructions',
        $P$ИНВАРИАНТЫ: только контекст; без веба; русский. Не смешивай с полным позиционированием бренда — фокус на ценности для клиента.
Каждая выгода — с доказательством из цитаты или явная пометка «нет опоры».$P$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_value_proposition');

COMMIT;
