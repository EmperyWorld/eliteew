-- Генератор песен: независимая Версия 3 (текстовые шаги + ACE Step 1.5 split 4B workflow).
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_v3_lyrics',
    'text',
    'Music Generator V3 — текст песни',
    'Генерация текста песни для независимого пайплайна V3 (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    90,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'music_generator_version', 'v3')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_v3_lyrics');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_v3_style',
    'text',
    'Music Generator V3 — стиль (теги)',
    'Генерация V3-тегов звучания на английском (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    60,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'music_generator_version', 'v3')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_v3_style');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_v3_suggest_params',
    'text',
    'Music Generator V3 — параметры трека',
    'Подбор BPM, длительности, тональности и вокала для V3 (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    45,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'music_generator_version', 'v3')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_v3_suggest_params');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_v3',
    'audio',
    'Music Generator — ACE V3',
    'Генерация музыки через независимый ACE Step 1.5 split 4B workflow V3 (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    750.0,
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'creative_studio',
        'billing_mode', 'v3',
        'ugs_workflow', 'v3',
        'music_generator_version', 'v3',
        'workflow_file', 'audio_ace_step_1_5_split_4b_v3.json'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_v3');

COMMIT;
