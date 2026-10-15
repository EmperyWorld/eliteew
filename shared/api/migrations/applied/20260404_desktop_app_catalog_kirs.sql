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
    'app-kirs',
    'КИРС',
    'Курирование и разработка сайта: выбор шаблона, запуск окружения по проекту маркетинга, выдача клиенту доступа к витрине и админке.',
    'KirsCuration',
    'productivity',
    'from-violet-600 to-indigo-700',
    'text-violet-200',
    147,
    false
) ON CONFLICT (app_id) DO NOTHING;

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
    'app-kirs-client-site',
    'Сайт заказчика',
    'Просмотр сайта проекта в рамках доступа, выданного в КИРС: витрина и при необходимости админка.',
    'KirsClientSite',
    'productivity',
    'from-slate-600 to-zinc-700',
    'text-slate-200',
    148,
    false
) ON CONFLICT (app_id) DO NOTHING;
