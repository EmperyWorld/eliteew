-- Document Editor V2: visible desktop app catalog row.
-- Sync with frontend: app_id app-doc-editor-v2, app_component DocEditorV2.

BEGIN;

INSERT INTO desktop_app_catalog (
    app_id,
    name,
    description,
    app_component,
    category,
    gradient,
    color,
    sort_order,
    is_system,
    is_factory,
    ew_monthly_price,
    trial_duration_days,
    allow_multiple_windows,
    max_window_instances,
    is_featured_new
) VALUES (
    'app-doc-editor-v2',
    'Редактор документов V2',
    'Новый редактор документов: совместная работа, ЕВА рядом, импорт и экспорт.',
    'DocEditorV2',
    'productivity',
    'from-amber-400 via-orange-500 to-yellow-600',
    'text-amber-200',
    134,
    false,
    true,
    0,
    0,
    true,
    4,
    true
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_system = EXCLUDED.is_system,
    is_factory = EXCLUDED.is_factory,
    ew_monthly_price = EXCLUDED.ew_monthly_price,
    trial_duration_days = EXCLUDED.trial_duration_days,
    allow_multiple_windows = EXCLUDED.allow_multiple_windows,
    max_window_instances = EXCLUDED.max_window_instances,
    is_featured_new = EXCLUDED.is_featured_new,
    updated_at = NOW();

-- UUID matches api/routers/desktop.py DEFAULT_ACCESS_GROUP_ID.
INSERT INTO app_access_groups (id, name, description, created_at, updated_at)
VALUES (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Default',
    'Базовая группа доступа к каталогу приложений рабочего стола',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-doc-editor-v2'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

COMMIT;
