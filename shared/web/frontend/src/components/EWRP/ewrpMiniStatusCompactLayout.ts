/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact viewport breakpoint and action order for EWRP presentations mini status bar.
 *
 * Invariants:
 * - On compact widths, primary editor actions (save/cancel) precede scroll navigation.
 *
 * Related:
 * - `EwrpPresentationsMiniStatusBar.tsx`
 */

/** Match Tailwind `max-sm` — presentations toolbar + mini bar use icon-only scroll CTAs. */
export const EWRP_MINI_STATUS_COMPACT_MQ = '(max-width: 639px)';

export type EwrpMiniStatusBarAction =
	| 'save'
	| 'cancel'
	| 'scrollEditor'
	| 'scrollStatus';

/** Ordered mini-bar actions; compact puts save/cancel before scroll CTAs. */
export function ewrpMiniStatusBarActionOrder(args: {
	showSave: boolean;
	showCancel: boolean;
	showScrollEditor: boolean;
	compact: boolean;
}): EwrpMiniStatusBarAction[] {
	const nav: EwrpMiniStatusBarAction[] = [];
	if (args.showScrollEditor) nav.push('scrollEditor');
	nav.push('scrollStatus');

	const primary: EwrpMiniStatusBarAction[] = [];
	if (args.showCancel) primary.push('cancel');
	if (args.showSave) primary.push('save');

	if (args.compact) {
		return [...primary].reverse().concat(nav);
	}
	return [...primary, ...nav];
}
