-- ИМК RAG: пакет типов CX, РФ-контур, позиционирование, коммерция (6 ключей).
-- Playbook: documentation/product/marketing/IMC-RESEARCH-TYPES-PLAYBOOK.md
-- apply_migrations.sh; при необходимости restart stack0-eliteew-api-worker-prod.

BEGIN;

-- 1) CX journey
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_cx_journey',
    'document',
    'Путь клиента и опыт (CX)',
    'Карта journey, касания, трения и моменты истины строго по материалам vault/RAG; без веб-поиска.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_cx_journey', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_orchestrate_max_steps', 8,
        'imc_rag_step_num_predict', 10240,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 32768,
        'imc_rag_min_section_chars', 800,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Этапы пути клиента и цели на этапе (только по контексту)',
            'Touchpoints и доказательства (цитаты из фрагментов)',
            'Трения, разрывы ожиданий, моменты истины',
            'Приоритетные улучшения CX (только если вытекают из цитат)',
            'Пробелы данных и что собрать дополнительно',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $CXJ$ИНВАРИАНТЫ: только фрагменты контекста проекта; без веба и внешних фактов; русский язык; не путать «работу продукта» (JTBD) с «опытом и касаниями» — фокус на journey, сервисе, коммуникациях и эмоциональном контуре по тексту.

РОЛЬ: аналитик CX — customer journey / touchpoint analysis по внутренним материалам.

СТРУКТУРА: следуй imc_output_sections; каждый существенный тезис — с цитатой; если данных нет — явно «пробел», не заполняй общими рекомендациями. Юридические обязательства и SLA трактуй только по явному тексту; иначе «требует проверки».

ЗАПРЕЩЕНО заканчивать отчёт водой без новой опоры на цитаты.$CXJ$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_cx_journey');

-- 2) Voice of customer
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_voice_of_customer',
    'document',
    'Голос клиента (VoC)',
    'Тематический разбор отзывов, опросов и текстов VoC по vault; без веб-поиска.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_voice_of_customer', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_min_section_chars', 800,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Тематические кластеры (с цитатами-примерами)',
            'Противоречия и расхождения формулировок',
            'Настроение/оценки — только если явно в тексте ответов',
            'Пробелы выборки и что усилить (кач/колич)',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $VOC$ИНВАРИАНТЫ: только тексты и таблицы из контекста (опросы, отзывы, саммари встреч в vault); без веба; русский; не выдумывать проценты и объёмы выборки, если их нет во фрагментах.

РОЛЬ: qualitative / VoC analyst — thematic coding по переданным материалам.

СТРУКТУРА: imc_output_sections; группируй темы по смыслу; для каждой темы минимум одна цитата; при слабых данных укажи ограничения.

ЗАПРЕЩЕНО подменять отсутствие данных обобщёнными выводами «рынок считает…» без цитаты.$VOC$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_voice_of_customer');

-- 3) RF operating context
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_rf_operating_context',
    'document',
    'Операционная среда РФ',
    'PESTLE-образный срез среды РФ и операционных рисков только по внутренним документам; без цитирования норм «с потолка».',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_rf_operating_context', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_rag_limit', 32,
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
        'imc_rag_min_section_chars', 850,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Political / Economic — только по фрагментам',
            'Social / Technological — только по фрагментам',
            'Legal / Environmental — только по фрагментам; юридические тезисы без статьи в контексте помечай «требует проверки юриста»',
            'Сводка неопределённости и пробелов',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $RFO$ИНВАРИАНТЫ: только внутренние документы проекта; без веб-поиска; русский; не приводи номера статей НПА и судебную практику, если их нет дословно во фрагменте.

РОЛЬ: внутренний strategic desk research по РФ — структура PESTLE как удобная рамка, не как юридическое заключение.

СТРУКТУРА: imc_output_sections; укажи уровень уверенности (сколько независимых фрагментов подтверждает тезис).

ЗАПРЕЩЕНО выдавать обязательные требования регулятора без цитаты из текста.$RFO$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_rf_operating_context');

-- 4) Channels & partners RF
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_channel_partner_rf',
    'document',
    'Каналы и партнёры (РФ)',
    'Карта каналов, партнёров и барьеров по материалам проекта; без выдуманных охватов и ставок.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_channel_partner_rf', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
        'imc_answer_depth', 'deep',
        'category', 'marketing_cabinet',
        'imc_prompt_version', 1,
        'imc_rag_orchestrate', TRUE,
        'imc_rag_orchestrate_mode', 'sections',
        'imc_rag_orchestrate_max_steps', 7,
        'imc_rag_step_num_predict', 9216,
        'imc_rag_merge_num_predict', 24576,
        'imc_rag_merge_mode', 'concat_polish',
        'imc_rag_polish_num_predict', 28672,
        'imc_rag_min_section_chars', 750,
        'imc_output_sections', jsonb_build_array(
            'Executive summary',
            'Каналы: роль, доказательства из контекста',
            'Партнёры и условия (только цитируемое)',
            'Барьеры, риски, зависимости',
            'Пробелы и что уточнить у коммерции',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $CHN$ИНВАРИАНТЫ: только vault/RAG; русский; не придумывай охваты, CPR, доли рынка и ставки без чисел во фрагментах.

РОЛЬ: GTM / channel analyst по внутренним материалам (включая специфику РФ, если она описана в тексте).

СТРУКТУРА: imc_output_sections; матрица «канал / роль / цитата» где возможно.

ЗАПРЕЩЕНО копировать шаблонные медиапланы без фактов из контекста.$CHN$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_channel_partner_rf');

-- 5) Positioning & messaging
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_positioning_messaging',
    'document',
    'Позиционирование и сообщения',
    'Иерархия сообщений, RTB и противоречия строго по бренд-материалам и исследованиям в vault.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_positioning_messaging', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
            'Текущее позиционирование (по цитатам)',
            'Ключевые сообщения и сегменты',
            'Reasons to believe / доказательства',
            'Конфликтующие формулировки и риски',
            'Таблица: обещание — доказательство — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $POS$ИНВАРИАНТЫ: только материалы проекта; русский; не создавай новый бренд и слоганы «с нуля» — синтезируй и выявляй пробелы.

РОЛЬ: brand / messaging analyst для согласованности обещаний и доказательств.

СТРУКТУРА: imc_output_sections; явно отмечай, где в материалах противоречие.

ЗАПРЕЩЕНО выдавать финальный брендбук без опоры на фрагменты.$POS$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_positioning_messaging');

-- 6) Pricing & packaging RF
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name, parameters,
    complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'imc_rag_pricing_packaging_rf',
    'document',
    'Цены и упаковка оффера (РФ)',
    'Сводка тарифов, пакетов и правил скидок по документам; напоминание про комплаенс без юридических выводов без цитаты.',
    'imc_rag_research_provider',
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'marketing_research_creator' LIMIT 1), 'ollama'),
    jsonb_build_object('research_type', 'imc_rag_pricing_packaging_rf', 'prompt_instructions', 'См. type_metadata.imc_prompt_instructions'),
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
            'Пакеты, тарифы и условия (по цитатам)',
            'Скидки, акции, ограничения',
            'Напряжения, риски, вопросы к юристу/финансам',
            'Пробелы (нет прайса в vault и т.д.)',
            'Таблица: факт — цитата — источник-фрагмент'
        ),
        'imc_prompt_instructions',
        $PRC$ИНВАРИАНТЫ: только документы проекта; русский; не выдумывай цены и условия; вопросы антимонопольного и регуляторного комплаенса формулируй как гипотезы «согласовать с юристом», без ссылок на статьи без текста во фрагменте.

РОЛЬ: commercial analyst — упаковка и ценообразование по внутренним материалам (контекст РФ, если он есть в тексте).

СТРУКТУРА: imc_output_sections; сравнивай формулировки из разных файлов и отмечай расхождения.

ЗАПРЕЩЕНО давать юридически значимые заключения.$PRC$
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'imc_rag_pricing_packaging_rf');

-- Провайдер RAG-only (идемпотентно, как в 20260415_imc_generation_types_provider_repair.sql)
UPDATE generation_types
SET provider = 'imc_rag_research_provider', updated_at = NOW()
WHERE is_active = true
  AND type_key IN (
    'imc_rag_cx_journey',
    'imc_rag_voice_of_customer',
    'imc_rag_rf_operating_context',
    'imc_rag_channel_partner_rf',
    'imc_rag_positioning_messaging',
    'imc_rag_pricing_packaging_rf'
  )
  AND provider IS DISTINCT FROM 'imc_rag_research_provider';

COMMIT;
