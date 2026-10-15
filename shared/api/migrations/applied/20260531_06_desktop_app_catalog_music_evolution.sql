-- Music Evolution: separate desktop app catalog entry, distinct from the existing MusicGenerator studio.
BEGIN;

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
    'app-music-evolution',
    'Эволюционная студия песен',
    'Простая форма, backend-пайплайн XL Base и красивый прогресс до готового трека на основе накопленного опыта удачных песен.',
    'MusicEvolutionApp',
    'home',
    'from-fuchsia-500 to-amber-400',
    'text-fuchsia-300',
    132,
    false
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

COMMIT;
