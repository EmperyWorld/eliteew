/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy helpers for KBSEW Barrels admin tab (force-reindex gate, poll).
 *
 * Invariants:
 * - Force-reindex requires a selected barrel with at least one asset.
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewBarrelsTab.tsx`
 * - `documentation/product/KBSEW.md`
 */

import type {
	KbsewBarrelStatus,
	KbsewForceReindexBarrelResult,
} from '../kbsewAdminApi';

/** Status poll while a barrel is selected (matches Barrels tab). */
export const KBSEW_BARREL_STATUS_POLL_MS = 4000;

export function canForceReindexBarrel(
	status: KbsewBarrelStatus | null | undefined
): boolean {
	if (!status) return false;
	return Number(status.asset_count) >= 1;
}

export function summarizeForceReindexBarrel(
	result: KbsewForceReindexBarrelResult
): { queued: number; skipped: number; failed: number } {
	return {
		queued: Number(result.queued) || 0,
		skipped: Number(result.skipped_active) || 0,
		failed: Number(result.failed) || 0,
	};
}
