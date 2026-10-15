-- Idempotent repair: satisfy `generation_type_provider_invariant` (startup ERR log).
--
-- Canonical policy (see applied/20260329 + 20260415): legacy bundle imc_audience_deep_dive,
-- imc_brand_positioning, … must stay inactive — cabinet flows use `imc_rag_*` rows on
-- `imc_rag_research_provider`. If those legacy rows were re-activated or left on miso_provider,
-- move cabinet filler off MISO first, deactivate the legacy six, then remap any remaining
-- active `imc_*` on miso to RAG except `marketing_research_creator`.

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
