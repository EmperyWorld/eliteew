-- MusicForge Phase 2: dedicated audio generation type_key (not shared Evolution key).
BEGIN;

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_forge_audio',
    'audio',
    'MusicForge — XL audio render',
    'Dedicated MusicForge audio render (AceStep SFT/BASE/TURBO via ugs_workflow). Separate billing from Music Evolution.',
    'comfyui',
    COALESCE(
        (SELECT model_name FROM generation_types WHERE type_key = 'music_generator_evolution_xl_base' LIMIT 1),
        (SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1),
        'comfyui'
    ),
    COALESCE(
        (SELECT parameters FROM generation_types WHERE type_key = 'music_generator_evolution_xl_base' LIMIT 1),
        '{}'::jsonb
    ),
    'high',
    600,
    3,
    5,
    COALESCE(
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_evolution_xl_base' LIMIT 1),
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_forge_ace15_mvp' LIMIT 1),
        250.0
    ),
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'music_forge',
        'billing_mode', 'music_forge_audio',
        'ugs_workflow', 'v4',
        'source', 'music_forge_app'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_forge_audio');

-- Point product settings at dedicated key (active + drafts/seeds).
UPDATE music_forge_product_settings
SET audio_type_key = 'music_generator_forge_audio'
WHERE audio_type_key = 'music_generator_evolution_xl_base'
   OR audio_type_key IS NULL
   OR btrim(audio_type_key) = '';

ALTER TABLE music_forge_product_settings
    ALTER COLUMN audio_type_key SET DEFAULT 'music_generator_forge_audio';

COMMIT;
