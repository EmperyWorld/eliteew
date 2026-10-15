/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Error-tone wrapper around `EwrpExpandableClampedText` for failed EWRP history rows.
 *
 * Invariants:
 * - Delegates clamp/expand rules to shared clamped-text helpers.
 *
 * Related:
 * - `EwrpExpandableClampedText.tsx`, `EwrpHistoryRow`
 */

export {
	EWRP_EXPANDABLE_CLAMP_CHARS,
	EWRP_EXPANDABLE_ERROR_COLLAPSE_CHARS,
	ewrpClampedTextNeedsExpand,
	ewrpErrorTextNeedsExpand,
} from './ewrpExpandableClampedText';

import { EwrpExpandableClampedText } from './EwrpExpandableClampedText';

export type EwrpExpandableErrorTextProps = {
	message: string;
	className?: string;
};

export function EwrpExpandableErrorText({
	message,
	className,
}: EwrpExpandableErrorTextProps) {
	return (
		<EwrpExpandableClampedText
			text={message}
			tone="error"
			className={className}
		/>
	);
}
