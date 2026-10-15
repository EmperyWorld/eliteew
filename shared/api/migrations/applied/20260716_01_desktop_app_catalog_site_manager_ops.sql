-- Site Manager Ops: admin-only desktop catalog entry (platform Site Studio control).
-- is_system — только роли admin / emperyworld_admin (см. api/routers/desktop.py _user_can_see_app).
-- is_factory — авто-установка для админов, которым приложение видно.
-- Sync with frontend: app_id app-site-manager-ops, app_component SiteManagerOps.
-- Canon: documentation/product/SITE-STUDIO.md §Site Manager Ops

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
    'app-site-manager-ops',
    'Контроль сайтов',
    'Операторская панель Site Studio: инстансы, подтверждение доменов, DNS/TLS, проверка публикации и журнал событий.',
    'SiteManagerOps',
    'developer',
    'from-cyan-500 to-violet-700',
    'text-cyan-300',
    508,
    true,
    true,
    0,
    0,
    false,
    1,
    false
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

COMMIT;
