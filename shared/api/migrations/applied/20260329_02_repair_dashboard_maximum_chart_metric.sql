-- Repair: preset `maximum` — виджет chart_metric (20260328 использовала version+1 при VARCHAR semver в БД).
-- Идемпотентно: только если chart_metric ещё не в template_config.
UPDATE marketing_dashboard_presets
SET
    template_config = jsonb_set(
        template_config,
        '{widgets}',
        COALESCE(template_config->'widgets', '[]'::jsonb)
        || jsonb_build_array(
            jsonb_build_object(
                'widget_key', 'chart_metric',
                'widget_title', 'Динамика',
                'widget_config',
                jsonb_build_object(
                    'chartKind', 'line',
                    'metric', 'tasks_completed_daily',
                    'windowDays', 30
                ),
                'grid_position',
                jsonb_build_object(
                    'x', 0, 'y', 7, 'w', 12, 'h', 4, 'minW', 4, 'minH', 3
                ),
                'is_visible', TRUE,
                'is_locked', FALSE,
                'display_order', 5
            )
        )
    ),
    updated_at = NOW()
WHERE name = 'maximum'
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            COALESCE(template_config->'widgets', '[]'::jsonb)
        ) AS elem
        WHERE elem->>'widget_key' = 'chart_metric'
    );
