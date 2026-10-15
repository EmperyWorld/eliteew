/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for EWRP clamped text that can expand (history topic/errors, status alerts).
 *
 * Invariants:
 * - Threshold is shared across error and secondary tones for predictable layout.
 *
 * Related:
 * - `EwrpExpandableClampedText.tsx`, `EwrpExpandableErrorText.tsx`
 */

/** Collapse toggle appears when text exceeds this length or contains a newline. */
export const EWRP_EXPANDABLE_CLAMP_CHARS = 96;

/** @deprecated Use `EWRP_EXPANDABLE_CLAMP_CHARS`. */
export const EWRP_EXPANDABLE_ERROR_COLLAPSE_CHARS = EWRP_EXPANDABLE_CLAMP_CHARS;

export function ewrpClampedTextNeedsExpand(text: string): boolean {
	return text.length > EWRP_EXPANDABLE_CLAMP_CHARS || text.includes('\n');
}

/** @deprecated Use `ewrpClampedTextNeedsExpand`. */
export function ewrpErrorTextNeedsExpand(message: string): boolean {
	return ewrpClampedTextNeedsExpand(message);
}
