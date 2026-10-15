-- Music Player — добавить в каталог магазина приложений (если ещё нет).
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
    'app-music-player',
    'Музыкальный плеер',
    'Ваша музыка из библиотеки: в первую очередь папка «Музыка», плюс всё остальное аудио под рукой. Запуск, пауза и перемотка — без долгого поиска «где это лежало».',
    'MusicPlayer',
    'home',
    'from-violet-500 to-purple-600',
    'text-violet-400',
    135,
    false
) ON CONFLICT (app_id) DO NOTHING;
