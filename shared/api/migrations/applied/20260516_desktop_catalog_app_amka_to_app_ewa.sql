-- Перенос каталога «окно платформы» с legacy ``app-amka`` на ``app-ewa`` + текст «EWA».
-- Идемпотентно: ничего не делает, если ``app-amka`` уже отсутствует.

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
)
SELECT
    'app-ewa',
    'EWA',
    'Отдельное окно EWA: платформенная оркестрация рабочего стола',
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
FROM desktop_app_catalog
WHERE app_id = 'app-amka'
ON CONFLICT (app_id) DO NOTHING;

UPDATE desktop_app_catalog_access_groups AS g
SET catalog_id = c_new.id
FROM desktop_app_catalog AS c_old
JOIN desktop_app_catalog AS c_new ON c_new.app_id = 'app-ewa'
WHERE c_old.app_id = 'app-amka'
  AND g.catalog_id = c_old.id;

UPDATE user_installed_apps SET app_id = 'app-ewa' WHERE app_id = 'app-amka';

UPDATE user_desktop_app_entitlements SET app_id = 'app-ewa' WHERE app_id = 'app-amka';

DELETE FROM desktop_app_catalog WHERE app_id = 'app-amka';

COMMIT;
