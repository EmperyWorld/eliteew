-- Desktop: Local Service iframe — добавить в каталог магазина приложений (если ещё нет).
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
    'app-local-service',
    'Local Service',
    'Хостовой UI локального сервиса (порт 8080), открывается во встроенном окне рабочего стола через iframe.',
    'LocalServiceIframeApp',
    'developer',
    'from-sky-600 to-slate-700',
    'text-sky-300',
    147,
    true
) ON CONFLICT (app_id) DO NOTHING;

