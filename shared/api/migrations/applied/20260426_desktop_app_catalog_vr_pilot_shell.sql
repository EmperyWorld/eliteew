-- VR (пилот): запись в каталоге магазина рабочего стола.
-- Синхронизация с фронтом: app_id app-vr-pilot-shell, app_component VrPilotShellNav (constants/index.ts).
-- is_system = false — видят все пользователи с дефолтной группой доступа (не только admin).
-- is_factory = true — автоустановка в user_installed_apps при загрузке каталога (/desktop/store).

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
    trial_duration_days
) VALUES (
    'app-vr-pilot-shell',
    'VR (пилот)',
    'WebXR в браузере Meta Quest (HTTPS). Окно рабочего стола и вход в immersive.',
    'VrPilotShellNav',
    'productivity',
    'from-sky-600 to-indigo-700',
    'text-sky-400',
    498,
    false,
    true,
    0,
    0
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
    updated_at = NOW();

COMMIT;
