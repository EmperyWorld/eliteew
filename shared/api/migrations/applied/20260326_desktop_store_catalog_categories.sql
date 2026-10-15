-- Магазин приложений: выровнять category у существующих строк и добавить общение в каталог.
-- communication — чаты, друзья, звонки; home — музыка («Дом и голос»); developer — Site Studio.

BEGIN;

UPDATE desktop_app_catalog SET category = 'communication', updated_at = NOW() WHERE app_id = 'app-gaf-chat';
UPDATE desktop_app_catalog SET category = 'home', updated_at = NOW() WHERE app_id IN ('app-music-player', 'app-music-generator');
UPDATE desktop_app_catalog SET category = 'developer', updated_at = NOW() WHERE app_id = 'app-site-studio';

-- AI-чат и видеозвонки: в «Коммуникации» вместе с GAF и Друзьями (если записей ещё не было — вставляем).
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
    'app-arlyqueen-chat',
    'ArlyQueen',
    'Дерзкий и честный AI-чат с историей',
    'ArlyQueenChat',
    'communication',
    'from-fuchsia-500 to-purple-600',
    'text-fuchsia-400',
    138,
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
    'app-meet-advanced',
    'Meet Advanced',
    'Видеоконференции',
    'MeetAdvanced',
    'communication',
    'from-blue-500 to-indigo-600',
    'text-blue-400',
    139,
    false
) ON CONFLICT (app_id) DO NOTHING;

UPDATE desktop_app_catalog SET category = 'communication', updated_at = NOW() WHERE app_id IN ('app-arlyqueen-chat', 'app-meet-advanced');

COMMIT;
