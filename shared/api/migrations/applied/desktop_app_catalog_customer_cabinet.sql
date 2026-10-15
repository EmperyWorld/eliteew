-- Customer Cabinet (stub) — каталог магазина приложений; доступ по representative_user_id позже.
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
    'app-customer-cabinet',
    'Customer Cabinet',
    'Когда вы представляете заказчика, важна одна цельная картина: какие компании и проекты за вами, что на согласовании и где договорённости. Здесь это собрано вместе — меньше писем в духе «напомни, где мы остановились».',
    'CustomerCabinet',
    'productivity',
    'from-teal-600 to-cyan-600',
    'text-teal-300',
    146,
    false
) ON CONFLICT (app_id) DO NOTHING;
