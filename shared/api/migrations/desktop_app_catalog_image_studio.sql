-- Image Studio — добавить в каталог магазина приложений (если ещё нет).
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
    'app-image-studio',
    'Студия изображений',
    'Сформулируйте образ словами или уточните уже готовый кадр по заметке — студия ведёт от запроса к результату, чтобы вы не собирали референсы по кускам в разных местах.',
    'ImageStudio',
    'productivity',
    'from-violet-500 to-fuchsia-600',
    'text-violet-400',
    135,
    false
) ON CONFLICT (app_id) DO NOTHING;
