-- Пресет all_widgets_showcase: плитка competitors (волна 18).
-- Идемпотентно: добавляется только если widget_key competitors ещё нет в template_config.widgets.

BEGIN;

UPDATE marketing_dashboard_presets
SET
    template_config = jsonb_set(
        template_config,
        '{widgets}',
        COALESCE(template_config->'widgets', '[]'::jsonb)
        || jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'competitors',
                'widget_title', 'Конкуренты',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 0, 'y', 30, 'w', 6, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 15
            )
        )
    ),
    updated_at = NOW()
WHERE name = 'all_widgets_showcase'
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            COALESCE(template_config->'widgets', '[]'::jsonb)
        ) AS elem
        WHERE elem->>'widget_key' = 'competitors'
    );

COMMIT;
