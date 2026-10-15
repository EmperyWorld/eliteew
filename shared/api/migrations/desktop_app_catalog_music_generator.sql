-- Music Generator — добавить в каталог магазина приложений (если ещё нет).
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
    'app-music-generator',
    'Генератор песен',
    'Напишите строки песни и получите музыкальное сопровождение под настроение — от черновика текста до прослушивания трека в одном рабочем пространстве.',
    'MusicGenerator',
    'home',
    'from-violet-500 to-fuchsia-600',
    'text-violet-400',
    130,
    false
) ON CONFLICT (app_id) DO NOTHING;
