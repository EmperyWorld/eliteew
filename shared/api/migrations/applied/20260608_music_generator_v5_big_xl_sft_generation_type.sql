-- Генератор песен: мастер «Основной» — Версия 5 (chained BIG XL SFT, BIG_XL_SFT.json).
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_v5',
    'audio',
    'Music Generator — ACE V5 BIG XL SFT',
    'Chained ACE Step 1.5 XL SFT: 4× AceStepSFTGenerate (BIG_XL_SFT.json).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    1200,
    3,
    5,
    10000.0,
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'creative_studio',
        'billing_mode', 'v5',
        'ugs_workflow', 'v5',
        'music_generator_version', 'v5',
        'workflow_file', 'BIG_XL_SFT.json'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_v5');

COMMIT;
