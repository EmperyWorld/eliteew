-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Remove irrelevant text-LLM model fields from non-text UGS providers. This prevents UI confusion and
-- enforces that provider-level model inventory/default is only stored for text-LLM compatible providers.
-- Invariants:
-- - Only provider_type in ('ollama','llama','miso') may carry config_json.default_model and config_json.models.
-- - Migration is idempotent and safe to re-run.
-- Related:
-- - shared/api/services/ugs/admin_v2_service.py (v2 guardrails)
-- - shared/api/migrations/applied/20260506_02_ugs_model_routes_db_source.sql
-- ---

BEGIN;

UPDATE generation_providers
SET
  config_json = (COALESCE(config_json, '{}'::jsonb) - 'default_model' - 'models'),
  updated_at = NOW()
WHERE provider_type NOT IN ('ollama','llama','miso')
  AND (config_json ? 'default_model' OR config_json ? 'models');

COMMIT;

