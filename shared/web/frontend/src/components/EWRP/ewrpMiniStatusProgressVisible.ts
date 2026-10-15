/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure gate for progress chip in EWRP presentations mini status bar during slide/PDF rebuild.
 *
 * Invariants:
 * - Matches `ewrpSlideRebuildInProgress` client policy.
 *
 * Related:
 * - `EwrpPresentationsMiniStatusBar.tsx`, `ewrpClientJobPolicy.ts`
 */

import { ewrpSlideRebuildInProgress } from './ewrpClientJobPolicy';

/** Whether mini status bar should show rebuild progress percent. */
export function ewrpMiniStatusProgressVisible(
	status: string | null | undefined
): boolean {
	return ewrpSlideRebuildInProgress(status);
}
