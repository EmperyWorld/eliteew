-- Системные шаблоны пресетов AMKA (глобальные, не привязаны к проекту). Чтение: GET /marketing-cabinet/amka/preset-templates

CREATE TABLE IF NOT EXISTS marketing_amka_preset_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(128) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_marketing_amka_preset_templates_slug UNIQUE (slug)
);

INSERT INTO marketing_amka_preset_templates (slug, display_name, description, config, sort_order)
VALUES
(
    'empty',
    'Пустой сценарий',
    'Только базовый план AMKA, без дополнительных задач.',
    '{"schema_version": 1, "extra_plan_tasks": []}'::jsonb,
    0
),
(
    'imc_after_evidence',
    'ИМК после evidence',
    'Вставка шага ИМК (раздел imc) сразу после блока evidence.',
    '{"schema_version": 1, "extra_plan_tasks": [{"insert_after_section_key": "evidence", "task": {"section_key": "imc", "execution_mode": "imc_research", "title": "Исследование ИМК после evidence"}}]}'::jsonb,
    10
),
(
    'generate_jtbd',
    'Автозаполнение JTBD',
    'Дополнительный шаг project_generate_async для раздела jtbd в конец плана.',
    '{"schema_version": 1, "extra_plan_tasks": [{"insert_after_section_key": null, "task": {"section_key": "jtbd", "execution_mode": "project_generate_async", "title": "Автогенерация JTBD"}}]}'::jsonb,
    20
),
(
    'generate_segments_after_jtbd',
    'Сегменты после JTBD',
    'Шаг project_generate_async для segments после jtbd.',
    '{"schema_version": 1, "extra_plan_tasks": [{"insert_after_section_key": "jtbd", "task": {"section_key": "segments", "execution_mode": "project_generate_async", "title": "Автогенерация сегментов"}}]}'::jsonb,
    30
),
(
    'tool_agent_segments',
    'Свод по сегментам (агент)',
    'Шаг marketing_tool_agent для segments — сводка через инструменты (без записи, если нет operations).',
    '{"schema_version": 1, "extra_plan_tasks": [{"insert_after_section_key": null, "task": {"section_key": "segments", "execution_mode": "marketing_tool_agent", "title": "Свод по сегментам через инструменты"}}]}'::jsonb,
    40
)
ON CONFLICT (slug) DO NOTHING;
