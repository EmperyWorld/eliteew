-- Drop triggers (second wave) — дубликаты updated_at и лишние доменные триггеры.
-- См. docs/TRIGGERS_KEEP_VS_REMOVE.md. Применять после бэкапа БД.
-- Запуск: psql -U ai_user -d ai_services -f drop_triggers_second_wave.sql

BEGIN;

-- 2.1 Дубликаты updated_at (на таблице два триггера с одной целью — оставляем один)
DROP TRIGGER IF EXISTS update_competitors_updated_at ON public.competitors;
DROP TRIGGER IF EXISTS update_financial_models_updated_at ON public.financial_models;
DROP TRIGGER IF EXISTS update_swot_analyses_updated_at ON public.swot_analyses;
DROP TRIGGER IF EXISTS update_swot_factors_updated_at ON public.swot_factors;

COMMIT;
