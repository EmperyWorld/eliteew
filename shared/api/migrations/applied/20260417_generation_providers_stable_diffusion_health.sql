-- Wave 12: A1111 WebUI health path (see documentation/trash/2026-05-13/BACKEND-AUDIT-SNAPSHOT-2026-04-17-followup.md).
-- Only rows that still point at the incorrect path are updated.

UPDATE generation_providers
SET
    health_endpoint = '/sdapi/v1/system-info',
    updated_at = NOW()
WHERE
    provider_name = 'stable_diffusion'
    AND health_endpoint = '/api/v1/system-info';
