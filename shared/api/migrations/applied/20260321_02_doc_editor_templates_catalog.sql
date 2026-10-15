-- UltimateDocEditor Q2 / Sprint 3
-- Server-backed template catalog

CREATE TABLE IF NOT EXISTS doc_editor_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'business',
    content TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_time TEXT NOT NULL DEFAULT '15-20 мин',
    difficulty TEXT NOT NULL DEFAULT 'easy',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO doc_editor_templates (id, name, description, category, content, tags, estimated_time, difficulty, is_enabled, sort_order)
VALUES
    (
        'business-project-brief',
        'Project Brief',
        'Короткий шаблон постановки проекта: цель, scope, метрики, риски.',
        'business',
        '# Project Brief\n\n## Цель\n\n## Scope\n\n## KPI\n\n## Риски\n',
        '["brief","project","kpi"]'::jsonb,
        '10-15 мин',
        'easy',
        TRUE,
        10
    ),
    (
        'academic-research-note',
        'Research Note',
        'Шаблон исследовательской заметки с гипотезами и результатами.',
        'academic',
        '# Research Note\n\n## Гипотеза\n\n## Метод\n\n## Наблюдения\n\n## Вывод\n',
        '["research","analysis"]'::jsonb,
        '20-30 мин',
        'medium',
        TRUE,
        20
    ),
    (
        'legal-service-agreement',
        'Service Agreement (Draft)',
        'Черновик структуры договора об оказании услуг.',
        'legal',
        '# Service Agreement\n\n## Стороны\n\n## Предмет\n\n## Оплата\n\n## Ответственность\n',
        '["legal","agreement"]'::jsonb,
        '30-45 мин',
        'hard',
        TRUE,
        30
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    tags = EXCLUDED.tags,
    estimated_time = EXCLUDED.estimated_time,
    difficulty = EXCLUDED.difficulty,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
