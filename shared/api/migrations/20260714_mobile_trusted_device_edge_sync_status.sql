-- ---
-- EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
-- ---
-- Purpose: Track edge wg-mobile peer sync state for trusted-device tunnel honesty (edge_sync_status).
-- Related: mobile_private_tunnel_edge_sync.py, MOBILE-SECURE-CONNECTION-OPERATIONS.md
-- ---

ALTER TABLE public.mobile_trusted_devices
    ADD COLUMN IF NOT EXISTS wg_edge_sync_status TEXT NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS wg_edge_synced_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.mobile_trusted_devices.wg_edge_sync_status IS
    'Edge peer sync: unknown | pending | synced | failed | manual_required';
COMMENT ON COLUMN public.mobile_trusted_devices.wg_edge_synced_at IS
    'Last successful Celery/manual edge peer reconcile timestamp for this active device.';

CREATE INDEX IF NOT EXISTS idx_mobile_trusted_devices_edge_sync_status
    ON public.mobile_trusted_devices (status, wg_edge_sync_status)
    WHERE status = 'active';
