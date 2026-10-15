-- Image Studio: генерация 50 энергии, редактирование 100 (cost_credits в generation_types).
BEGIN;

UPDATE generation_types
SET cost_credits = 50
WHERE type_key = 'image_studio_text_to_image';

UPDATE generation_types
SET cost_credits = 100
WHERE type_key = 'image_studio_image_edit';

COMMIT;
