-- Friends — добавить в каталог магазина приложений (desktop_app_catalog).
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
    'app-friends',
    'Друзья',
    'Social hub: друзья, заявки и сценарии взаимодействия между пользователями',
    'FriendsApp',
    'communication',
    'from-emerald-500 to-cyan-600',
    'text-emerald-400',
    137,
    false
) ON CONFLICT (app_id) DO NOTHING;
