-- Idempotent repair: keep IMC RAG-only generation types out of generic chat providers.
--
-- Legacy `imc_*` bundle rows must stay inactive. Current cabinet flows use `imc_rag_*`
-- generation types on `imc_rag_research_provider`; `imc_cabinet_filler` uses its own
-- provider. This prevents RAG requests from falling into MISO/chat-style matching.

BEGIN;

UPDATE generation_types
SET
    provider = 'imc_cabinet_filler_provider',
    updated_at = NOW()
WHERE is_active = true
  AND type_key = 'imc_cabinet_filler'
  AND provider IS DISTINCT FROM 'imc_cabinet_filler_provider';

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
