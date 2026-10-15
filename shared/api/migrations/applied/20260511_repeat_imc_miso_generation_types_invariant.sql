-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Повторное применение политики UGS/IMC (см. applied/20260509_imc_generation_types_miso_invariant_repeat.sql),
-- если вручную снова включили legacy `imc_*` на `miso_provider`.
-- Invariants:
-- Идемпотентно; не трогает `marketing_research_creator` на MISO.
-- Related:
-- - api/services/imc/generation_type_provider_invariant.py
-- ---

BEGIN;

UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE is_active = true
  AND provider = 'miso_provider'
  AND type_key = 'imc_cabinet_filler';

UPDATE generation_types
SET
    is_active = false,
    updated_at = NOW()
WHERE type_key IN (
    'imc_competitive_landscape',
    'imc_audience_deep_dive',
    'imc_gtm_channels',
    'imc_pricing_packaging',
    'imc_content_messaging',
    'imc_brand_positioning'
);

UPDATE generation_types
SET
    provider = 'imc_rag_research_provider',
    updated_at = NOW()
WHERE is_active = true
  AND provider = 'miso_provider'
  AND type_key LIKE 'imc_%'
  AND type_key NOT IN ('marketing_research_creator', 'imc_cabinet_filler');

UPDATE generation_types
SET
    provider = 'imc_rag_research_provider',
    updated_at = NOW()
WHERE is_active = true
  AND type_key LIKE 'imc_rag_%'
  AND provider IS DISTINCT FROM 'imc_rag_research_provider';

COMMIT;
