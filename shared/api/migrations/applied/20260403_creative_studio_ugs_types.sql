-- Creative studios (Image / Video / Music): UGS type_key + cost_credits + skip_queue (sync HTTP).
-- apply_migrations.sh; restart API if needed.

BEGIN;

INSERT INTO generation_types (
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
SELECT
    'image_studio_text_to_image',
    'image',
    'Студия изображений — текст в картинку',
    'Image Studio: T2I (z-image-turbo через ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'medium',
    180,
    3,
    5,
    18.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'image_studio_text_to_image');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'image_studio_image_edit',
    'image',
    'Студия изображений — редактирование',
    'Image Studio: редактирование по инструкции (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'medium',
    200,
    3,
    5,
    20.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'image_studio_image_edit');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'image_studio_image_rotate',
    'image',
    'Студия изображений — ракурс / камера',
    'Image Studio: смена ракурса (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'medium',
    200,
    3,
    5,
    16.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'image_studio_image_rotate');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'video_studio_image_to_video',
    'video',
    'Студия видео — изображение в видео',
    'Video Studio: Wan 2.2 I2V (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    48.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'video_studio_image_to_video');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_lyrics',
    'text',
    'Music Generator — текст песни',
    'Генерация текста песни (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    90,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_lyrics');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_style',
    'text',
    'Music Generator — стиль (теги)',
    'Генерация описания стиля трека на английском (Ollama).',
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
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_style');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_improve_lyrics',
    'text',
    'Music Generator — улучшение текста',
    'Улучшение текста песни по направлению (Ollama).',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    90,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_improve_lyrics');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace',
    'audio',
    'Music Generator — Ace Step',
    'Генерация музыки Ace Step 1.5 (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    22.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_diffrhythm',
    'audio',
    'Music Generator — DiffRhythm',
    'Генерация музыки DiffRhythm (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    22.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_diffrhythm');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_edit',
    'audio',
    'Music Generator — M2M правка',
    'Правка трека M2M (ComfyUI Ace Step).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    24.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_edit');

COMMIT;
