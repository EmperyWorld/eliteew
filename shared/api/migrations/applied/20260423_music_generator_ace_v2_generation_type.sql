-- Генератор песен: вторая версия пайплайна UGS (Musicv2.json), стоимость как у professional.
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_v2',
    'audio',
    'Music Generator — UGS v2',
    'Ручная генерация музыки (второй пайплайн UGS).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    COALESCE(
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_professional' LIMIT 1),
        250.0
    ),
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'ugs_v2', 'ugs_workflow', 'v2')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2');

COMMIT;
