-- Unified Admin (окно десктопа): запись в каталог.
-- is_system — только роли admin / emperyworld_admin (см. api/routers/desktop.py _user_can_see_app).
-- is_factory — авто-установка в user_installed_apps для пользователей, которым приложение видно.

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
    is_factory
) VALUES (
    'app-unified-admin',
    'Админ-панель',
    'Единая админ-панель EliteEW: управление и обзор для операторов с ролью администратора.',
    'UnifiedAdminApp',
    'productivity',
    'from-violet-600 to-purple-900',
    'text-violet-400',
    149,
    true,
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
    updated_at = NOW();

COMMIT;
