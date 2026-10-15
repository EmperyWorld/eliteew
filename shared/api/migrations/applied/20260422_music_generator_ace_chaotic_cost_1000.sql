-- Стоимость chaotic transitions: 1000 кредитов (ранее могло быть 250).
BEGIN;

UPDATE generation_types
SET cost_credits = 1000.0
WHERE type_key = 'music_generator_generate_ace_chaotic';

COMMIT;
