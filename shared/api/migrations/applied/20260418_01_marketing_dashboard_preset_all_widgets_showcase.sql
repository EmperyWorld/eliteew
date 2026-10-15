-- Preset «все виджеты»: по одной плитке на каждый ключ каталога на момент волны (13 типов).
-- Идемпотентно: повторный прогон обновляет шаблон (ON CONFLICT DO UPDATE).
-- Apply: shared/api/migrations/apply_migrations.sh — see shared/api/migrations/README.md

BEGIN;

INSERT INTO marketing_dashboard_presets (
    name,
    display_name,
    description,
    category,
    template_config,
    is_public,
    is_active,
    version
)
VALUES (
    'all_widgets_showcase',
    'Витрина: все виджеты',
    'Демонстрационный макет: по одному экземпляру каждого типа плитки каталога для ручной проверки и регрессии.',
    'general',
    jsonb_build_object(
        'layout', jsonb_build_object(
            'name', 'Витрина: все виджеты',
            'type', 'preset',
            'description', 'Сетка 12 колонок, без пересечений; см. пресет all_widgets_showcase',
            'layout_config', '{}'::JSONB,
            'settings', '{}'::JSONB
        ),
        'widgets', jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'overview_kpi',
                'widget_title', 'KPI и готовность',
                'widget_config', '{}'::JSONB,
                'grid_position', jsonb_build_object('x', 0, 'y', 0, 'w', 6, 'h', 4, 'minW', 4, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 0
            ),
            jsonb_build_object(
                'widget_key', 'ai_activity',
                'widget_title', 'AI-активность',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 6, 'y', 0, 'w', 3, 'h', 4, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 1
            ),
            jsonb_build_object(
                'widget_key', 'tasks',
                'widget_title', 'Задачи',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 9, 'y', 0, 'w', 3, 'h', 4, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 2
            ),
            jsonb_build_object(
                'widget_key', 'funnel',
                'widget_title', 'Воронки',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 0, 'y', 4, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 3
            ),
            jsonb_build_object(
                'widget_key', 'campaigns',
                'widget_title', 'Кампании',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 4, 'y', 4, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 4
            ),
            jsonb_build_object(
                'widget_key', 'alerts',
                'widget_title', 'Алерты',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 8, 'y', 4, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 5
            ),
            jsonb_build_object(
                'widget_key', 'segments',
                'widget_title', 'Сегменты',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 0, 'y', 9, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 6
            ),
            jsonb_build_object(
                'widget_key', 'researches',
                'widget_title', 'Исследования',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 4, 'y', 9, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 7
            ),
            jsonb_build_object(
                'widget_key', 'imc_recent',
                'widget_title', 'Запуски ИМК',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 8, 'y', 9, 'w', 4, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 8
            ),
            jsonb_build_object(
                'widget_key', 'swot',
                'widget_title', 'SWOT',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 0, 'y', 14, 'w', 4, 'h', 6, 'minW', 3, 'minH', 4),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 9
            ),
            jsonb_build_object(
                'widget_key', 'chart_metric',
                'widget_title', 'Динамика (линейный график)',
                'widget_config', jsonb_build_object(
                    'chartKind', 'line',
                    'metric', 'tasks_completed_daily',
                    'windowDays', 30
                ),
                'grid_position', jsonb_build_object('x', 4, 'y', 14, 'w', 8, 'h', 5, 'minW', 5, 'minH', 4),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 10
            ),
            jsonb_build_object(
                'widget_key', 'chart_metrics_bar',
                'widget_title', 'Столбцы показателей',
                'widget_config', jsonb_build_object(
                    'windowDays', 30,
                    'aggregation', 'sum',
                    'metricKeys', jsonb_build_array(
                        'tasks_completed_daily',
                        'alerts_opened_daily',
                        'ai_runs_started_daily'
                    ),
                    'chartFormat', 'bar_horizontal'
                ),
                'grid_position', jsonb_build_object('x', 0, 'y', 20, 'w', 8, 'h', 5, 'minW', 4, 'minH', 4),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 11
            ),
            jsonb_build_object(
                'widget_key', 'marketing_canvas',
                'widget_title', 'Заметки (canvas)',
                'widget_config', jsonb_build_object(
                    'canvasMode', 'markdown',
                    'canvasMarkdown', 'Демо-пресет **все виджеты**: краткая заметка на доске.'
                ),
                'grid_position', jsonb_build_object('x', 8, 'y', 20, 'w', 4, 'h', 4, 'minW', 4, 'minH', 4),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 12
            )
        )
    ),
    TRUE,
    TRUE,
    1
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    template_config = EXCLUDED.template_config,
    is_public = EXCLUDED.is_public,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;
