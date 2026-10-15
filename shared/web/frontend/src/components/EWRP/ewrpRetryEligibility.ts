/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side mirror of `api/services/ewrp_retry_policy.py` for EWRP retry button visibility.
 *
 * Invariants:
 * - Stale threshold must match `EWRP_HISTORY_STALE_AFTER_MS` in `EwrpGeneratorChunks.tsx`.
 *
 * Related:
 * - `ewrpApi.retry`, `EwrpHistoryRow`
 */

import { isEwrpHistoryRowStale } from './EwrpGeneratorChunks';

/** Same job id retry: failed (re-bill) or stale in-progress (re-queue, 0 ⚡). */
export function ewrpJobCanRetry(
	status: string,
	updatedAt?: string | null,
	nowMs: number = Date.now()
): boolean {
	const s = (status || '').toLowerCase();
	if (s === 'failed') return true;
	return isEwrpHistoryRowStale(status, updatedAt, nowMs);
}

/** Failed retries consume credits; stale in-progress retries do not. */
export function ewrpJobRetryRequiresBilling(status: string): boolean {
	return (status || '').toLowerCase() === 'failed';
}
