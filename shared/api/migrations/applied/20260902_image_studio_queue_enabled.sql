-- Image Studio: route Comfy/Llama work through UGS queue worker (not API direct_inline).
-- apply_migrations.sh; queue worker must be running on prod-core.

BEGIN;

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) - 'skip_queue'
WHERE type_key IN (
    'image_studio_text_to_image',
    'image_studio_image_edit',
    'image_studio_image_rotate',
    'image_studio_image_prompt'
);

COMMIT;
