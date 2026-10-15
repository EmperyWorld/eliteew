-- «Заполнитель»: не кешировать результат UGS (иначе после смены промпта отдаётся старый markdown вместо JSON).
BEGIN;

UPDATE generation_types
SET
    type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"enable_cache": false}'::jsonb,
    updated_at = NOW()
WHERE type_key = 'imc_cabinet_filler';

COMMIT;
