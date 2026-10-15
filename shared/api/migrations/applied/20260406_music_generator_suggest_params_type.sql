-- Music Generator: подсказка параметров продакшена (вокал, BPM, длительность) для мастера «Основной».
INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_suggest_params',
    'text',
    'Music Generator — подсказка параметров продакшена',
    'JSON: вокал, BPM, длительность (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    60,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_suggest_params');
