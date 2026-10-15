/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure swipe-down dismiss math for companion mobile bottom sheets (U5.7).
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionMobileSheetSwipeDismiss.tsx
 */

export const COMPANION_MOBILE_SHEET_DISMISS_THRESHOLD_PX = 88;
export const COMPANION_MOBILE_SHEET_DISMISS_MAX_DRAG_PX = 220;

export function companionMobileSheetDismissOffset(
	rawDeltaY: number,
	enabled: boolean
): number {
	if (!enabled || rawDeltaY <= 0) return 0;
	return Math.min(
		COMPANION_MOBILE_SHEET_DISMISS_MAX_DRAG_PX,
		Math.round(rawDeltaY * 0.85)
	);
}

export function shouldDismissCompanionMobileSheet(
	dragPx: number,
	threshold = COMPANION_MOBILE_SHEET_DISMISS_THRESHOLD_PX
): boolean {
	return dragPx >= threshold;
}
