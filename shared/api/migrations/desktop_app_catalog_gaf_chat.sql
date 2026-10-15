-- GAF Chat — добавить в каталог магазина приложений (desktop_app_catalog).
-- Применять к той же БД, где остальные desktop-миграции (основная БД приложения).
INSERT INTO desktop_app_catalog (
    app_id,
    name,
    description,
    app_component,
    category,
    gradient,
    color,
    sort_order,
    is_system
) VALUES (
    'app-gaf-chat',
    'GAF Chat',
    'Личные переписки с друзьями один на один — спокойный чат без лент, групп и лишнего шума от остального.',
    'GAFChatApp',
    'communication',
    'from-teal-500 to-cyan-600',
    'text-teal-400',
    140,
    false
) ON CONFLICT (app_id) DO NOTHING;
