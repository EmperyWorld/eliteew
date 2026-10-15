-- Video Studio: raise I2V cost to 1000 credits; add AI motion-prompt helper UGS type.
BEGIN;

UPDATE generation_types
SET cost_credits = 1000.0
WHERE type_key = 'video_studio_image_to_video';

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
    'video_studio_image_prompt',
    'text',
    'Студия видео — AI промпт движения',
    'Помощь в формулировке motion prompt для Wan 2.2 I2V (Llama stack2).',
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'image_studio_image_prompt' LIMIT 1), 'llama'),
    '',
    '{}'::jsonb,
    'low',
    60,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'creative_studio')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'video_studio_image_prompt');

COMMIT;
