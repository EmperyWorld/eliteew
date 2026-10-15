-- V4 SFT: стоимость генерации 2500 энергии (мастер «Основной» → Версия 4).
BEGIN;

UPDATE generation_types
SET cost_credits = 2500.0
WHERE type_key = 'music_generator_generate_ace_v4'
  AND cost_credits IS DISTINCT FROM 2500.0;

COMMIT;
