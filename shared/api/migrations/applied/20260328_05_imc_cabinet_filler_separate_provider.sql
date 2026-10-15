-- ИМК «Заполнитель»: отдельный провайдер UGS (не miso_provider).
BEGIN;

UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE type_key = 'imc_cabinet_filler';

COMMIT;
