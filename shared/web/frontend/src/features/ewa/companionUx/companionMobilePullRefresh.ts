/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure pull-to-refresh math for mobile companion transcript (U5.5).
 *
 * Invariants:
 * - Pull only applies when scrollTop is 0 and the user drags downward.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionMobilePullRefresh.ts
 */

export const COMPANION_MOBILE_PULL_REFRESH_THRESHOLD_PX = 72;
export const COMPANION_MOBILE_PULL_REFRESH_MAX_PX = 120;
/** Pull-to-refresh only when scrollTop is within this dead-zone (plan 15 R12). */
export const COMPANION_MOBILE_PULL_SCROLL_TOP_DEADZONE_PX = 2;
const PULL_RESISTANCE = 0.45;

export function isCompanionMobilePullScrollAtTop(
	scrollTop: number,
	deadZone = COMPANION_MOBILE_PULL_SCROLL_TOP_DEADZONE_PX
): boolean {
	return scrollTop <= deadZone;
}

export function companionMobilePullRefreshOffset(
	rawDeltaY: number,
	scrollTop: number,
	enabled: boolean
): number {
	if (
		!enabled ||
		!isCompanionMobilePullScrollAtTop(scrollTop) ||
		rawDeltaY <= 0
	) {
		return 0;
	}
	return Math.min(
		COMPANION_MOBILE_PULL_REFRESH_MAX_PX,
		Math.round(rawDeltaY * PULL_RESISTANCE)
	);
}

export function shouldTriggerCompanionMobilePullRefresh(
	pullPx: number,
	threshold = COMPANION_MOBILE_PULL_REFRESH_THRESHOLD_PX
): boolean {
	return pullPx >= threshold;
}

export type CompanionMobilePullRefreshHint =
	| 'idle'
	| 'pull'
	| 'release'
	| 'refreshing';

export function companionMobilePullRefreshHint(
	pullPx: number,
	refreshing: boolean
): CompanionMobilePullRefreshHint {
	if (refreshing) return 'refreshing';
	if (pullPx <= 0) return 'idle';
	return shouldTriggerCompanionMobilePullRefresh(pullPx) ? 'release' : 'pull';
}
