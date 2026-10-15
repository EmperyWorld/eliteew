-- Rollout: companion Tool Router shadow → partial (execute side effects for allowlisted tools).
-- Runtime reads ewa_platform_setting via os.getenv shim (overrides compose env).

UPDATE ewa_platform_setting
SET value_text = 'partial',
    updated_at = now()
WHERE setting_key = 'EWA_COMPANION_TOOL_ROUTER_MODE'
  AND value_text = 'shadow';
