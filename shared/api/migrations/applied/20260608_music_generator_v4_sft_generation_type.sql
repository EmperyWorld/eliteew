-- Генератор песен: мастер «Основной» — Версия 4 (ACE Step 1.5 native SFT, ace_sft_new.json).
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_generate_ace_v4',
    'audio',
    'Music Generator — ACE V4 SFT',
    'Генерация музыки через ACE Step 1.5 native SFT (AceStepSFTGenerate, ace_sft_new.json).',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    2500.0,
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'creative_studio',
        'billing_mode', 'v4',
        'ugs_workflow', 'v4',
        'music_generator_version', 'v4',
        'workflow_file', 'ace_sft_new.json'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_generate_ace_v4');

COMMIT;
