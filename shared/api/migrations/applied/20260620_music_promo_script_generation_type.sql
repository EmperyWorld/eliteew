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
    'music_generator_promo_script',
    COALESCE((SELECT category FROM generation_types WHERE type_key = 'music_generator_lyrics'), 'text'),
    'Music Generator — promo script JSON',
    'Structured promo voiceover script: JSON object with lyrics + tags for promo_voiceover flow.',
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'music_generator_lyrics'), 'ollama'),
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'music_generator_lyrics'), 'ollama'),
    COALESCE((SELECT parameters FROM generation_types WHERE type_key = 'music_generator_lyrics'), '{}'::jsonb),
    COALESCE((SELECT complexity FROM generation_types WHERE type_key = 'music_generator_lyrics'), 'low'),
    COALESCE((SELECT estimated_time FROM generation_types WHERE type_key = 'music_generator_lyrics'), 90),
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'music_generator_lyrics'), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'music_generator_lyrics'), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_lyrics'), 5.0),
    TRUE,
    COALESCE((SELECT type_metadata FROM generation_types WHERE type_key = 'music_generator_lyrics'), '{}'::jsonb)
        || jsonb_build_object('structured_output', TRUE)
ON CONFLICT (type_key) DO UPDATE
SET category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    parameters = EXCLUDED.parameters,
    complexity = EXCLUDED.complexity,
    estimated_time = EXCLUDED.estimated_time,
    max_retries = EXCLUDED.max_retries,
    priority = EXCLUDED.priority,
    cost_credits = EXCLUDED.cost_credits,
    is_active = TRUE,
    type_metadata = EXCLUDED.type_metadata,
    updated_at = NOW();

COMMIT;
