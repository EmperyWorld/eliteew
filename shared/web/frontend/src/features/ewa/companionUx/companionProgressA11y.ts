/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for companion progress bar screen-reader labels (U7.3).
 *
 * Invariants:
 * - Percent scale uses 0–100; step scale uses current/total with min total 1.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionActivityCenterStrip.tsx
 * - src/features/ewa/companionOperations/InTranscriptProgressBanner.tsx
 */

export type CompanionProgressBarA11y = {
	valueNow: number;
	valueMin: number;
	valueMax: number;
	mode: 'percent' | 'step';
	current: number;
	total: number;
	percent: number;
};

export function companionProgressPercent(
	current: number,
	total: number,
	options?: { completed?: boolean }
): number {
	if (options?.completed) return 100;
	if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((current / total) * 100));
}

export function companionProgressBarA11y(
	current: number,
	total: number,
	options?: { completed?: boolean; percentScale?: boolean }
): CompanionProgressBarA11y {
	const percent = companionProgressPercent(current, total, options);
	const safeTotal = Math.max(1, Math.round(total));
	const safeCurrent = Math.max(0, Math.round(current));

	if (options?.percentScale) {
		return {
			valueNow: percent,
			valueMin: 0,
			valueMax: 100,
			mode: 'percent',
			current: safeCurrent,
			total: safeTotal,
			percent,
		};
	}

	const valueNow = options?.completed
		? safeTotal
		: Math.min(safeTotal, safeCurrent);

	return {
		valueNow,
		valueMin: 0,
		valueMax: safeTotal,
		mode: 'step',
		current: safeCurrent,
		total: safeTotal,
		percent,
	};
}

export function companionProgressBarValueTextKey(
	mode: CompanionProgressBarA11y['mode']
): 'ewaCompanion.progressBarPercentAria' | 'ewaCompanion.progressBarStepAria' {
	return mode === 'percent'
		? 'ewaCompanion.progressBarPercentAria'
		: 'ewaCompanion.progressBarStepAria';
}
