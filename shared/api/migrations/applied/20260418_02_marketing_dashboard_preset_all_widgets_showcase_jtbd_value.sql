-- Дополнение пресета all_widgets_showcase: плитки jtbd_stories и value_props (после расширения каталога).
-- Идемпотентно: каждая плитка добавляется только если такого widget_key ещё нет в template_config.widgets.

BEGIN;

UPDATE marketing_dashboard_presets
SET
    template_config = jsonb_set(
        template_config,
        '{widgets}',
        COALESCE(template_config->'widgets', '[]'::jsonb)
        || jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'jtbd_stories',
                'widget_title', 'JTBD / job stories',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 0, 'y', 25, 'w', 6, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 13
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
        WHERE elem->>'widget_key' = 'jtbd_stories'
    );

UPDATE marketing_dashboard_presets
SET
    template_config = jsonb_set(
        template_config,
        '{widgets}',
        COALESCE(template_config->'widgets', '[]'::jsonb)
        || jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'value_props',
                'widget_title', 'Ценностные предложения',
                'widget_config', jsonb_build_object('maxItems', 4),
                'grid_position', jsonb_build_object('x', 6, 'y', 25, 'w', 6, 'h', 5, 'minW', 3, 'minH', 3),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 14
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
        WHERE elem->>'widget_key' = 'value_props'
    );

COMMIT;
