/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for EWRP status polling UI: progress clamping and poll terminal outcomes.
 *
 * Invariants:
 * - Terminal poll outcomes match `ewrpShouldStopStatusPolling` statuses.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `ewrpClientJobPolicy.ts`
 */

/** Clamp backend progress to 0–100 for progressbar display. */
export function clampEwrpStatusProgress(
	progress: number | null | undefined
): number {
	if (typeof progress !== 'number' || Number.isNaN(progress)) {
		return 0;
	}
	return Math.round(Math.min(100, Math.max(0, progress)));
}

export type EwrpPollStatusOutcome = 'continue' | 'completed' | 'failed';

/** Map GET /status payload to polling loop action. */
export function ewrpPollStatusOutcome(status: string): EwrpPollStatusOutcome {
	const s = (status || '').toLowerCase();
	if (s === 'completed') return 'completed';
	if (s === 'failed') return 'failed';
	return 'continue';
}
