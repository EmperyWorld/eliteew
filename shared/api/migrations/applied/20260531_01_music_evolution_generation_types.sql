-- Music Evolution: isolated UGS type keys for backend-first XL Base generation.
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_evolution_brief',
    'text',
    'Music Evolution — creative brief',
    'Structured creative brief for the backend-first XL Base song app.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    60,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_evolution')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_evolution_brief');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_evolution_lyrics',
    'text',
    'Music Evolution — XL Base lyrics',
    'Lyrics for the backend-first XL Base song app, grounded in normalized user intent and recipe corpus.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    90,
    3,
    5,
    10.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_evolution', 'ugs_workflow', 'v2_base')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_evolution_lyrics');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_evolution_style',
    'text',
    'Music Evolution — XL Base arrangement tags',
    'English ACE Step 1.5 arrangement tags for the backend-first XL Base song app.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    90,
    3,
    5,
    10.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_evolution', 'ugs_workflow', 'v2_base')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_evolution_style');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_evolution_xl_base',
    'audio',
    'Music Evolution — XL Base audio',
    'Final XL Base audio render for the backend-first Music Evolution app (Musicv2_base.json).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    COALESCE(
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2_base_companion' LIMIT 1),
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2' LIMIT 1),
        250.0
    ),
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'music_evolution',
        'billing_mode', 'evolution_xl_base',
        'ugs_workflow', 'v2_base',
        'source', 'music_evolution_app'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_evolution_xl_base');

COMMIT;
