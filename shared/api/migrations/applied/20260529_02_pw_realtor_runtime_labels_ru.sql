-- EliteEW / Professional Worlds
-- Realtor runtime catalog copy:
-- - Russian user-facing module labels and descriptions for the runtime API fallback
-- - Frontend i18n remains the primary UI source; DB copy is the safe backend fallback

UPDATE professional_modules AS module
SET
    name = labels.name,
    description = labels.description,
    updated_at = now()
FROM (
    VALUES
        ('realtor_leads', 'Обращения', 'Новые обращения, первичная проверка и перевод в клиента.'),
        ('realtor_buyers', 'Покупатели', 'Потребности покупателей, бюджет, районы и подбор подходящих объектов.'),
        ('realtor_sellers', 'Продавцы', 'Контекст собственников, ожидания по цене и подготовка объекта к продаже.'),
        ('realtor_pipeline', 'Сделки', 'Воронка сделок, события, следующие шаги и контроль связки клиент-объект.'),
        ('realtor_documents', 'Документы', 'Чеклист документов, статусы загрузки и быстрый переход к сделке или объекту.'),
        ('realtor_marketing', 'Продвижение', 'Публикации, статус и готовность материалов для объекта.'),
        ('realtor_insights', 'Аналитика', 'Снимки цены, качество объявления и подсказки для улучшения объекта.'),
        ('realtor_playbooks', 'Сценарии', 'Многошаговые сценарии для подготовки материалов и коммуникаций.'),
        ('realtor_showings', 'Показы', 'Календарь показов, результаты встреч и следующие действия.'),
        ('realtor_tasks', 'Задачи', 'Следующие действия по клиентам, объектам, показам и сделкам.'),
        ('realtor_communications', 'Контакты', 'Звонки, сообщения и заметки по клиентам, обращениям, объектам и сделкам.'),
        ('realtor_objections', 'Ответы на возражения', 'Библиотека спокойных ответов на типовые вопросы и сомнения клиентов.')
) AS labels(module_key, name, description)
WHERE module.module_key = labels.module_key;

UPDATE professional_ai_actions AS action
SET
    display_name = labels.display_name,
    description = labels.description,
    updated_at = now()
FROM (
    VALUES
        ('realtor', 'lead_qualification', 'Проверка обращения', 'Кратко разбирает намерение, риски и следующий шаг по новому обращению.'),
        ('realtor', 'buyer_match_explain', 'Объяснение подбора', 'Показывает, почему объект подходит или не подходит под запрос покупателя.'),
        ('realtor', 'seller_valuation_narrative', 'Контекст оценки продавца', 'Помогает спокойно объяснить ожидания по цене и недостающие данные.'),
        ('realtor', 'showing_followup_message', 'Сообщение после показа', 'Готовит короткий контакт после показа без давления.'),
        ('realtor', 'negotiation_prep', 'Подготовка к переговорам', 'Собирает позиции, риски и вопросы перед обсуждением условий.'),
        ('realtor', 'document_checklist_explain', 'Пояснение по документам', 'Объясняет строки чеклиста простым языком без юридических обещаний.'),
        ('realtor', 'listing_quality_audit', 'Проверка качества объявления', 'Проверяет полноту фактов, текст и готовность фото к публикации.'),
        ('realtor', 'weekly_sales_plan', 'План недели', 'Собирает реалистичный план работы по сделкам, объектам и контактам.'),
        ('realtor', 'objection_handling_variants', 'Ответы на возражение', 'Готовит спокойные варианты ответа на вопрос или сомнение клиента.')
) AS labels(vertical_slug, action_key, display_name, description)
WHERE action.vertical_slug = labels.vertical_slug
  AND action.action_key = labels.action_key;

UPDATE professional_ai_playbooks AS playbook
SET
    display_name = labels.display_name,
    description = labels.description,
    updated_at = now()
FROM (
    VALUES
        ('realtor', 'object_to_sales_package', 'Объект в пакет материалов', 'Подготовка описания и материалов для выбранного объекта.'),
        ('realtor', 'lead_to_first_contact', 'Обращение в первый контакт', 'Проверка обращения и черновик первого ответа.'),
        ('realtor', 'weekly_pipeline_review', 'Еженедельный обзор сделок', 'Сводка сделок, задач и следующих действий на неделю.'),
        ('realtor', 'seller_onboarding_to_campaign', 'Продавец в план продвижения', 'Контекст продавца, оценка и черновик запуска продвижения.'),
        ('realtor', 'buyer_match_to_showing_plan', 'Подбор в план показа', 'Объяснение подбора и следующий контакт после показа.')
) AS labels(vertical_slug, playbook_key, display_name, description)
WHERE playbook.vertical_slug = labels.vertical_slug
  AND playbook.playbook_key = labels.playbook_key;

UPDATE professional_vertical_schemas AS schema
SET
    title = labels.title,
    ui_schema = schema.ui_schema || labels.ui_patch,
    updated_at = now()
FROM (
    VALUES
        ('realtor', 'realtor_lead', 1, 'Обращение риэлтора', '{"sections":["intake","qualification"],"section_labels":{"intake":"Входящие данные","qualification":"Проверка обращения"}}'::jsonb),
        ('realtor', 'realtor_buyer_requirement', 1, 'Запрос покупателя', '{"sections":["needs","constraints"],"section_labels":{"needs":"Потребности","constraints":"Ограничения"}}'::jsonb),
        ('realtor', 'realtor_seller_profile', 1, 'Профиль продавца', '{"sections":["context","pricing","go_to_market"],"section_labels":{"context":"Контекст","pricing":"Цена","go_to_market":"Подготовка к продвижению"}}'::jsonb)
) AS labels(vertical_slug, schema_key, version, title, ui_patch)
WHERE schema.vertical_slug = labels.vertical_slug
  AND schema.schema_key = labels.schema_key
  AND schema.version = labels.version;

UPDATE professional_photo_presets AS preset
SET
    display_name = labels.display_name,
    description = labels.description,
    updated_at = now()
FROM (
    VALUES
        ('realtor_hero_cover', 'Обложка объекта', 'Широкая обложка для витрины объекта с акцентом на фасад и окружение.'),
        ('marketplace_crop', 'Кадрирование для площадок', 'Единая безопасная зона кадра для сеток объявлений.'),
        ('document_safe_cleanup', 'Нейтральная чистка документов', 'Аккуратная экспозиция и снижение шума для приложений и брошюр.'),
        ('premium_gallery', 'Премиальная галерея', 'Тёплая дневная обработка для основной галереи объекта.')
) AS labels(preset_key, display_name, description)
WHERE preset.vertical_slug = 'realtor'
  AND preset.preset_key = labels.preset_key;

INSERT INTO professional_vertical_runtime_epoch (vertical_slug, epoch)
VALUES ('realtor', 1)
ON CONFLICT (vertical_slug) DO UPDATE SET
    epoch = professional_vertical_runtime_epoch.epoch + 1,
    updated_at = now();
