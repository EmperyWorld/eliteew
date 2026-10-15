-- Marketing Cabinet — добавить в каталог магазина приложений (если ещё нет).
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
    'app-marketing-cabinet',
    'Marketing Cabinet',
    'Маркетинговый контур: компания, проекты, исследования и отчёты в одной цепочке. Сверьте гипотезы с ассистентом и оформите выводы так, чтобы команде было с чем идти в планирование — без разрозненных таблиц и потерянных заметок.',
    'MarketingCabinet',
    'productivity',
    'from-amber-500 to-orange-600',
    'text-amber-300',
    145,
    false
) ON CONFLICT (app_id) DO NOTHING;
