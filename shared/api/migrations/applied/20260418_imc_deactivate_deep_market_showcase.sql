-- ИМК: снять с выдачи кабинета `imc_rag_deep_market_showcase`.
-- Обоснование: монолитный 12-раздельный отчёт в одном RAG-прогоне не соответствует
-- распространённой практике поэтапных decision-grade исследований; вместо него —
-- сфокусированные типы (SWOT, JTBD, competitive, trends, диагностика) и при необходимости
-- сводный `imc_rag_cabinet_analysis`. Наследник для устаревшего ключа: см. LEGACY_IMC_TYPE_SUCCESSORS.
-- apply_migrations.sh; при необходимости restart API.

BEGIN;

UPDATE generation_types
SET
    is_active = false,
    updated_at = NOW()
WHERE type_key = 'imc_rag_deep_market_showcase';

COMMIT;
