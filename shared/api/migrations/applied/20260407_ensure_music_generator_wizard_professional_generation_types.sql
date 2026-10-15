-- Раздельная стоимость генерации музыки: мастер «Основной» (wizard) и «Профессиональный».
-- Старые type_key оставляются неактивными; API использует суффиксы _wizard / _professional.
-- Идемпотентно: повторный запуск безопасен (INSERT ... WHERE NOT EXISTS).

BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_professional',
    'audio',
    'Music Generator — Ace Step (профессиональный)',
    'Ручная генерация музыки Ace Step (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    250.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'professional')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_professional');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_wizard',
    'audio',
    'Music Generator — Ace Step (авто)',
    'Автогенерация из мастера «Основной» (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    500.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'wizard')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_wizard');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_diffrhythm_professional',
    'audio',
    'Music Generator — DiffRhythm (профессиональный)',
    'Ручная генерация DiffRhythm (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    250.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'professional')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_diffrhythm_professional');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_diffrhythm_wizard',
    'audio',
    'Music Generator — DiffRhythm (авто)',
    'Автогенерация DiffRhythm из мастера (ComfyUI).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    500.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'wizard')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_diffrhythm_wizard');

UPDATE generation_types
SET is_active = FALSE
WHERE type_key IN ('music_generator_generate_ace', 'music_generator_generate_diffrhythm');

COMMIT;
