-- ИМК: гарантированно снять `imc_rag_deep_market_showcase` с выдачи (repair, если 20260418 не применялась).
-- AMKA catalog и ImcService.list_types — только is_active=true; rerun старого ключа → successor imc_rag_cabinet_analysis.

BEGIN;

UPDATE generation_types
SET
    is_active = FALSE,
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
