-- Repair IMC / UGS: legacy marketing types off; imc_rag_* aligned to imc_rag_research_provider;
-- active imc_* must not use miso_provider except marketing_research_creator (MISO-only research).
-- Idempotent: safe to re-run.

BEGIN;

-- 1) Legacy MISO-era IMC keys (20260327): must stay inactive for cabinet RAG pipeline.
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

-- 2) All active imc_rag_* rows must call imc_rag_research_provider (not miso_provider).
UPDATE generation_types
SET
    provider = 'imc_rag_research_provider',
    updated_at = NOW()
WHERE is_active = true
  AND type_key LIKE 'imc_rag_%'
  AND provider IS DISTINCT FROM 'imc_rag_research_provider';

-- 3a) Cabinet filler must never stay on miso_provider.
UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE is_active = true
  AND provider = 'miso_provider'
  AND type_key = 'imc_cabinet_filler';

-- 3b) Any remaining active imc_* on miso_provider except marketing_research_creator (MISO-only).
UPDATE generation_types
SET
    provider = 'imc_rag_research_provider',
    updated_at = NOW()
WHERE is_active = true
  AND provider = 'miso_provider'
  AND type_key LIKE 'imc_%'
  AND type_key NOT IN ('marketing_research_creator', 'imc_cabinet_filler');

COMMIT;
