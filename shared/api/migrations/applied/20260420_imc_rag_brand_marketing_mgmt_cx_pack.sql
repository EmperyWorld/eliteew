-- ИМК RAG: бренд-система, GTM, кампания, контент/комms, RACI, CX ops/recovery (6 ключей).
-- Playbook: documentation/product/marketing/IMC-RESEARCH-TYPES-PLAYBOOK.md
-- apply_migrations.sh; при необходимости restart stack0-eliteew-api-prod / api-worker.

BEGIN;

-- 1) Brand identity compliance
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_brand_identity_compliance',
    'document',
    'Бренд-система и соблюдение гайдов',
    'Аудит соответствия материалов правилам бренда (тон, нейминг, айдентика) только по vault/RAG; не архитектура сообщений.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_brand_identity_compliance', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 750,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Правила бренд-системы из документов (с цитатами)',
            'Примеры материалов и зазоры с правилами',
            'Запреты, исключения, чувствительные зоны',
            'Пробелы (нет гайда в vault)',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $BRD$ИНВАРИАНТЫ: только фрагменты проекта; без веба; русский. Это не позиционирование и не иерархия месседжей — фокус на соблюдении бренд-системы, нейминга, тона, визуальных/вербальных правил из гайдов и примеров в контексте.

РОЛЬ: brand ops / identity reviewer по внутренним материалам.

СТРУКТУРА: imc_output_sections; каждый вывод с цитатой; без выдуманных «best practice» вне текста.

ЗАПРЕЩЕНО смешивать с JTBD и конкурентным сравнением.$BRD$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_brand_identity_compliance');

-- 2) Marketing GTM plan
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_marketing_gtm_plan',
    'document',
    'GTM и план вывода',
    'Сводка этапов вывода на рынок, зависимостей и рисков только из внутренних планов и брифов в vault.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_marketing_gtm_plan', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_limit', 30,
        'imc_answer_depth', 'deep',
        'category', 'marketing_cabinet',
        'imc_prompt_version', 1,
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 800,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Этапы GTM и зависимости (только по тексту)',
            'Гипотезы, допущения, риски с опорой на фрагменты',
            'Критерии готовности / вехи, если описаны',
            'Расхождения между документами',
            'Пробелы данных',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $GTM$ИНВАРИАНТЫ: только внутренние планы, брифы, слайды проекта; без веба; русский. Не придумывай даты, бюджеты и каналы без явного упоминания во фрагментах. Не подменяй GTM анализом «работы продукта» (JTBD).

РОЛЬ: program / GTM analyst по загруженным материалам.

СТРУКТУРА: imc_output_sections; если в тексте нет этапов — зафиксируй пробел, не заполняй шаблоном.

ЗАПРЕЩЕНО выдавать внешние рыночные доли и охваты без цитаты.$GTM$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_marketing_gtm_plan');

-- 3) Campaign retrospective
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_campaign_retrospective',
    'document',
    'Ретроспектива кампании',
    'Разбор целей, формулировок и выводов из отчётов по кампании/инициативе; не конкурентный анализ.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_campaign_retrospective', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 750,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Цели и формулировки из документов',
            'Факты и результаты как в тексте (без выдуманных метрик)',
            'Learnings, уроки, противоречия между источниками',
            'Что уточнить или дособрать',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $CMP$ИНВАРИАНТЫ: только отчёты, презентации, постмортемы в vault; без веба; русский. Не смешивать с картой конкурентов и SWOT, если это не следует из фрагментов.

РОЛЬ: marketing retrospective facilitator по внутренним материалам.

СТРУКТУРА: imc_output_sections; метрики и охваты — только если есть во фрагменте.

ЗАПРЕЩЕНО приписывать кампании внешние индустриальные бенчмарки без цитаты.$CMP$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_campaign_retrospective');

-- 4) Content & communications strategy
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_content_comms_strategy',
    'document',
    'Контент и коммуникации',
    'Темы, каналы, форматы и календарь коммуникаций по стратегиям в проекте; не макро-тренды рынка.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_content_comms_strategy', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_orchestrate_max_steps', 6,
        'imc_rag_step_num_predict', 9216,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 28672,
        'imc_rag_min_section_chars', 750,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Темы и линии контента (по фрагментам)',
            'Каналы и форматы',
            'Частота / календарь / ритм, если описаны',
            'Пробелы и несогласованности',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $CCS$ИНВАРИАНТЫ: только планы контента, коммуникационные стратегии, редакционные материалы в vault; без веба; русский. Отличай от imc_rag_trends_signals: здесь план коммуникаций проекта, а не макро-сигналы рынка.

РОЛЬ: content / comms strategist по внутренним документам.

СТРУКТУРА: imc_output_sections; не выдумывай рубрикатор и частоту без опоры на текст.

ЗАПРЕЩЕНО подменять отсутствие календаря общими советами «постить 3 раза в неделю».$CCS$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_content_comms_strategy');

-- 5) Stakeholder / RACI / decisions
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_stakeholder_decision_raci',
    'document',
    'Стейкхолдеры и RACI',
    'Роли, решения, эскалации по мемо и протоколам в vault; без выдуманных ФИО и оргструктур.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_stakeholder_decision_raci', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_orchestrate_max_steps', 6,
        'imc_rag_step_num_predict', 9216,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 28672,
        'imc_rag_min_section_chars', 750,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Стейкхолдеры и роли (только из текста)',
            'Типовые решения и эскалации',
            'RACI / матрица ответственности, если явно в фрагментах',
            'Пробелы и неоднозначности',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $RAC$ИНВАРИАНТЫ: только протоколы, мемо, орг-описания в контексте; без веба; русский. Не добавляй людей и роли, которых нет во фрагментах. Юридические последствия решений — «требует проверки», если нет явного текста.

РОЛЬ: governance / stakeholder analyst по внутренним материалам.

СТРУКТУРА: imc_output_sections; при отсутствии RACI в данных не рисуй таблицу с выдуманными ячейками.

ЗАПРЕЩЕНО строить оргструктуру компании целиком без фрагментов.$RAC$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_stakeholder_decision_raci');

-- 6) CX service ops & recovery
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_cx_service_ops_recovery',
    'document',
    'CX: сервис, SLA, recovery',
    'Регламенты обслуживания, эскалации, компенсации и recovery по материалам vault; дополняет journey/VoC.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_cx_service_ops_recovery', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_limit', 30,
        'imc_answer_depth', 'deep',
        'category', 'marketing_cabinet',
        'imc_prompt_version', 1,
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 800,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'SLA и сервисные регламенты (цитаты)',
            'Эскалации и ответственность',
            'Recovery, компенсации, работа с инцидентами',
            'Пробелы и риски по тексту',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $CXO$ИНВАРИАНТЫ: только регламенты, инструкции, кейсы в vault; без веба; русский. Это не карта journey и не тематический VoC — фокус на операционке сервиса, SLA, восстановлении доверия. Не выдумывай юридические обязательства компенсаций без текста.

РОЛЬ: service operations / CX recovery analyst по внутренним материалам.

СТРУКТУРА: imc_output_sections; каждый шаг процесса с цитатой или пометкой «пробел».

ЗАПРЕЩЕНО смешивать с конкурентным разбором и JTBD.$CXO$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_cx_service_ops_recovery');

UPDATE generation_types
SET provider = 'imc_rag_research_provider', updated_at = NOW()
WHERE is_active = true
  AND type_key IN (
    'imc_rag_brand_identity_compliance',
    'imc_rag_marketing_gtm_plan',
    'imc_rag_campaign_retrospective',
    'imc_rag_content_comms_strategy',
    'imc_rag_stakeholder_decision_raci',
    'imc_rag_cx_service_ops_recovery'
  )
  AND provider IS DISTINCT FROM 'imc_rag_research_provider';

COMMIT;
