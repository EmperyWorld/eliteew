-- Режим «Неожиданные переходы»: отдельный type_key и стоимость (1000 кредитов).
-- Идемпотентно.

BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_chaotic',
    'audio',
    'Music Generator — Ace Step (переходы)',
    'Генерация с контрастными переходами жанров (ComfyUI Ace Step).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    1000.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio', 'billing_mode', 'chaotic')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_chaotic');

COMMIT;
