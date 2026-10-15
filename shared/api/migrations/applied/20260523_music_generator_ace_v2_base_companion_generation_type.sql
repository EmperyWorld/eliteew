-- EWA companion XL Base autonomous music — отдельный UGS type_key (не ломает wizard v2 / v2_base UI).
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_v2_base_companion',
    'audio',
    'Music Generator — EWA companion XL Base',
    'EWA companion autonomous XL Base (v2_base): lyrics/tags from dialog + Musicv2_base.json Comfy workflow.',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    COALESCE(
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2' LIMIT 1),
        250.0
    ),
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'ewa_companion',
        'billing_mode', 'companion_xl_base',
        'ugs_workflow', 'v2_base',
        'source', 'ewa_companion_xl_base_autonomous'
    )
WHERE NOT EXISTS (
    SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2_base_companion'
);

COMMIT;
