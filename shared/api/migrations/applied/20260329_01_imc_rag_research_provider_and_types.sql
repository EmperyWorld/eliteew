-- ИМК RAG-only: провайдер imc_rag_research_provider + 5 типов imc_rag_*; деактивация legacy imc_* (MISO-набор 20260327).
-- provider_type = miso из-за CHECK в generation_providers; вызов идёт по provider_name в provider_manager_service_v2.
--
-- marketing_research_creator: вариант 1 плана — НЕ переводим на imc_rag_research_provider без отдельного ТЗ.
-- Запись остаётся на текущем провайдере (обычно miso_provider); скрытие из списка кабинета — логика ImcService (пакет B).
BEGIN;

-- 1) Провайдер UGS для markdown-исследований ИМК только по контексту проекта (без MISO-цепочки для этих type_key).
INSERT INTO generation_providers (
    provider_name,
    provider_type,
    base_url,
    api_key_required,
    health_endpoint,
    timeout_seconds,
    max_concurrent,
    enabled,
    cost_per_request,
    fallback_priority,
    config_json
)
SELECT
    'imc_rag_research_provider',
    'miso',
    COALESCE(NULLIF(TRIM(base_url), ''), 'http://stack2-ollama:11434'),
    FALSE,
    COALESCE(NULLIF(TRIM(health_endpoint), ''), '/api/tags'),
    GREATEST(COALESCE(timeout_seconds, 180), 180),
    COALESCE(max_concurrent, 2),
    TRUE,
    COALESCE(cost_per_request, 0),
    COALESCE(fallback_priority, 0),
    COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('default_model', 'rscr/vikhr_llama3.1_8b:Q4_K_M')
FROM generation_providers
WHERE provider_name = 'miso_provider'
  AND NOT EXISTS (SELECT 1 FROM generation_providers WHERE provider_name = 'imc_rag_research_provider')
LIMIT 1;

INSERT INTO generation_providers (
    provider_name,
    provider_type,
    base_url,
    api_key_required,
    health_endpoint,
    timeout_seconds,
    max_concurrent,
    enabled,
    cost_per_request,
    fallback_priority,
    config_json
)
SELECT
    'imc_rag_research_provider',
    'miso',
    'http://stack2-ollama:11434',
    FALSE,
    '/api/tags',
    180,
    2,
    TRUE,
    0,
    0,
    jsonb_build_object('default_model', 'rscr/vikhr_llama3.1_8b:Q4_K_M')
WHERE NOT EXISTS (SELECT 1 FROM generation_providers WHERE provider_name = 'imc_rag_research_provider');

-- 2) Снять с кабинета старые imc_* (шесть типов из 20260327_02_imc_marketing_research_types.sql).
UPDATE generation_types
SET
    is_active = false,
    updated_at = NOW()
WHERE type_key IN (
    'imc_competitive_landscape',
    'imc_audience_deep_dive',
    'imc_gtm_channels',
    'imc_pricing_packaging',
    'imc_content_messaging',
    'imc_brand_positioning'
);

-- 3) Пять новых типов: методология сжато из temp_mk/METHODOLOGY_5_ANALYSES_WORLD_AND_RU.md и YES_TrendsSignals_*.md;
-- промпты переписаны под RAG-only (нет требований URL/веба; опора на переданные фрагменты).

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
        'imc_rag_swot',
        'document',
        'SWOT-анализ (контекст проекта)',
        'Стратегический SWOT, связка факторов с TOWS при наличии оснований в материалах, оценка полноты матрицы. Только фрагменты vault.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_swot',
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
            'imc_use_merged_context', TRUE,
            'imc_rag_project_only', TRUE,
            'imc_rag_limit', 28,
            'category', 'marketing_cabinet',
            'imc_output_sections', jsonb_build_array(
                'Краткое резюме (Executive summary)',
                'S / W / O / T с трассировкой к фактам из контекста',
                'Связка с TOWS (если в фрагментах есть стратегические выводы)',
                'Оценка полноты и рисков матрицы',
                'Выводы и ограничения',
                'Таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: Используй ТОЛЬКО переданный блок контекста проекта (фрагменты документов below). Веб-поиск, выдуманные URL и факты вне фрагментов запрещены. Каждый существенный тезис подкрепляй цитатой до 500 символов из контекста; в таблице в конце укажи источник как ссылку на фрагмент/файл из контекста. Язык — русский. Если фрагментов мало — явно перечисли недостающие области, не придумывай данные.

РОЛЬ: стратегический аналитик по методологии SWOT (мировая практика + РФ-контекст, если он есть во фрагментах).

СТРУКТУРА: Executive summary; матрица S/W/O/T с пометкой силы доказательности (есть цитата / слабо / пробел); при наличии материалов — связь факторов с квадрантами TOWS; оценка здоровья матрицы (противоречия, дубли); выводы; таблица факт — цитата — фрагмент-источник.

Методические опоры: внутренние/внешние факторы; приоритизация; трассировка каждого пункта к цитате из контекста.$PROMPT$
        )
    ),
    (
        'imc_rag_jtbd',
        'document',
        'JTBD (контекст проекта)',
        'Jobs-to-be-Done: сегменты по работам, outcome-метрики, барьеры и мотивация — строго по фрагментам vault.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_jtbd',
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
            'imc_use_merged_context', TRUE,
            'imc_rag_project_only', TRUE,
            'imc_rag_limit', 28,
            'category', 'marketing_cabinet',
            'imc_output_sections', jsonb_build_array(
                'Executive summary',
                'Сегменты и формулировки работ (JTBD)',
                'Критерии успеха и ожидаемые outcomes',
                'Барьеры, возражения, конкурирующие «работы»/альтернативы (если есть во фрагментах)',
                'Customer journey — только подтверждённое контекстом',
                'Выводы и пробелы',
                'Таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: только переданный контекст; без веба и внешних источников; каждый вывод — с цитатой из фрагмента; русский язык; не выдумывай сегменты и метрики.

РОЛЬ: аналитик JTBD (theory + outcome-driven интеллект по материалам проекта).

СТРУКТУРА: резюме; перечень работ по сегментам; outcome-метрики и «успех» для пользователя; барьеры/мотивация; связь с альтернативами, если они описаны во фрагментах; пробелы данных; таблица факт—цитата—фрагмент.

Опора на методологию: сегментация по работам, а не только по демографии; проверка гипотез оплатой/готовностью — только если это следует из контекста.$PROMPT$
        )
    ),
    (
        'imc_rag_trends_signals',
        'document',
        'Тренды и сигналы (мир + РФ, один отчёт)',
        'Горизонт сканирования: слабые сигналы, кластеризация, приоритет impact×uncertainty; подразделы глобальный горизонт и РФ/локальный контур.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_trends_signals',
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
            'category', 'marketing_cabinet',
            'imc_output_sections', jsonb_build_array(
                'Executive summary (3–5 инсайтов, только из контекста)',
                'Глобальный горизонт: сигналы и трендовые гипотезы',
                'Россия / локальный контур: сигналы, регуляторика и макро — если отражено во фрагментах',
                'Weak signals vs шум — с обоснованием по цитатам',
                'Связь с возможностями/угрозами SWOT и JTBD (если есть связующие факты в контексте)',
                'Приоритетный грид impact × uncertainty (качественно)',
                'Рекомендации следующих шагов (только при наличии оснований)',
                'Таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: единственный источник фактов — переданные фрагменты; запрещены веб-поиск, вымышленные URL и обобщения без цитаты. Каждый сигнал/тренд должен иметь цитату; если данных не хватает — помечай «пробел» и не заполняй выдуманным контентом. Язык ответа — русский.

ЗАДАЧА: единый отчёт «Тренды и сигналы», объединяющий мировой и РФ-подразделы (как в методологии horizon scanning + sense-making), но строго по материалам vault.

СТРУКТУРА:
1) Executive summary
2) Подраздел «Глобальный горизонт» — ранние индикаторы, драйверы и сдерживающие факторы по тексту фрагментов
3) Подраздел «Россия / РФ» — только если во фрагментах есть локальные факторы (НПА, Росстат, отрасль и т.д.); отметь уровень уверенности по числу независимых фрагментов
4) Weak signals, постмортемы «шума» при наличии данных
5) Таблица факт — цитата — фрагмент

Не требуй от пользователя внешних ссылок; «источник» = идентификация фрагмента из контекста.$PROMPT$
        )
    ),
    (
        'imc_rag_cabinet_analysis',
        'document',
        'Кабинетный анализ (сводный)',
        'Единый операционный контур: синтез фактов кабинета/SWOT/конкурентов из фрагментов, версия для стейкхолдеров.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_cabinet_analysis',
            'prompt_instructions',
            'См. type_metadata.imc_prompt_instructions'
        ),
        'high',
        270,
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
            'category', 'marketing_cabinet',
            'imc_output_sections', jsonb_build_array(
                'Executive summary для руководства',
                'Картина рынка и проекта по фрагментам',
                'Связка SWOT-элементов и конкурентных тезисов без противоречий (яви конфликты, если контекст противоречив)',
                'Ключевые риски и возможности',
                'Что нужно уточнить у команды (пробелы)',
                'Таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: только переданный контекст; без веба; все утверждения с цитатами; русский; не подменяй отсутствие данных общими рекомендациями.

РОЛЬ: ведущий «кабинетного» среза — единый текст для стейкхолдеров по методологии кабинетного анализа (связка SWOT + конкурентный контур + операционные поля, если они есть во фрагментах).

СТРУКТУРА: краткое резюме; целостная картина; явная трассировка тезисов к фрагментам; раздел о конфликтующих сигналах; приоритетные действия только если вытекают из цитат; финальная таблица факт—цитата—фрагмент.$PROMPT$
        )
    ),
    (
        'imc_rag_competitive',
        'document',
        'Конкурентный анализ (контекст проекта)',
        'CI-профили, ландшафт и альтернативы, бенчмарк — только по загруженным материалам.',
        'imc_rag_research_provider',
        COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
        jsonb_build_object(
            'research_type', 'imc_rag_competitive',
            'prompt_instructions',
            'См. type_metadata.imc_prompt_instructions'
        ),
        'high',
        270,
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
            'category', 'marketing_cabinet',
            'imc_output_sections', jsonb_build_array(
                'Executive summary',
                'Карта конкурентов и косвенных заменителей (из контекста)',
                'Сравнение по осям, которые явно есть в фрагментах (цена, канал, продукт и т.д.)',
                'Барьеры входа и белые пятна — если подтверждено',
                'Угрозы/возможности для дифференциации',
                'Таблица: факт — цитата — источник-фрагмент'
            ),
            'imc_prompt_instructions',
            $PROMPT$ИНВАРИАНТЫ: только фрагменты проекта; внешний веб и выдуманные карточки конкурентов запрещены; каждый тезис — с цитатой; русский; юридические утверждения помечай как требующие внешней проверки, если в тексте нет однозначной опоры.

РОЛЬ: исследователь конкурентной среды (CI) по внутренним материалам.

СТРУКТУРА: резюме; ландшафт игроков; сравнительная матрица по доступным осям; барьеры/риски; выводы для позиционирования только из цитат; таблица факт—цитата—фрагмент.

Методология: профили, бенчмарк, белые пятна — но без фактов «из головы».$PROMPT$
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

-- Явная модель Vikhr для пяти типов (колонка model_name; ImcService подставляет в input_data для UGS).
UPDATE generation_types
SET
    model_name = 'rscr/vikhr_llama3.1_8b:Q4_K_M',
    updated_at = NOW()
WHERE type_key IN (
    'imc_rag_swot',
    'imc_rag_jtbd',
    'imc_rag_trends_signals',
    'imc_rag_cabinet_analysis',
    'imc_rag_competitive'
);

COMMIT;
