-- Video Studio — добавить в каталог магазина приложений (если ещё нет).
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
    'app-video-studio',
    'Студия видео',
    'Возьмите один сильный кадр и разверните из него короткий ролик: покадровая смена картинки, чтобы задумка ожила в движении, оставаясь в одной студии.',
    'VideoStudio',
    'productivity',
    'from-violet-500 to-fuchsia-600',
    'text-violet-400',
    136,
    false
) ON CONFLICT (app_id) DO NOTHING;
