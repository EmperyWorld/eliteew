/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derive workflow write capability for EWA companion admin UI from ``GET /status`` flags.
 *
 * Invariants:
 * - Workflow mutations require **both** ``admin_write_enabled`` and ``pg_catalog_enabled``.
 * - Platform settings PUT is **not** gated here (bootstrap; see companion_admin settings routes).
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-ADMIN-WRITE-GATING.md
 */
import type { EwaCompanionAdminStatus } from './ewaCompanionAdminApi';

export function isEwaCompanionWorkflowWriteEnabled(
	status: EwaCompanionAdminStatus | undefined
): boolean {
	if (!status) {
		return false;
	}
	return status.admin_write_enabled && status.pg_catalog_enabled;
}
