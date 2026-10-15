-- EWRP: cost_credits = «за один слайд» (100). Фактическое списание: num_slides × 100 в POST /ewrp и duplicate.
BEGIN;

UPDATE generation_types
SET
    cost_credits = 100.0,
    description = 'Полный пайплайн EWRP: списание при запуске = число слайдов × 100 ⚡ (3–20 слайдов). Пересборка PDF после правок — без списания.'
WHERE type_key = 'ewrp_presentation';

COMMIT;
