-- Site Studio — добавить в каталог магазина приложений (если ещё нет).
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
    'app-site-studio',
    'Site Studio',
    'Опубликуйте свой сайт, настройте админку и откройте гостям отдельный режим просмотра: они видят витрину и контент, не заходя в ваш личный рабочий стол и приватные приложения.',
    'UserSiteStudio',
    'developer',
    'from-sky-500 to-indigo-600',
    'text-sky-300',
    146,
    false
) ON CONFLICT (app_id) DO NOTHING;
