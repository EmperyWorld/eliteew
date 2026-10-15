/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize list-row excerpt text from API `body_excerpt` for compact display.
 *
 * Related:
 * - EwDeskNewsListRow.tsx
 */

const DEFAULT_MAX_LEN = 140;

export function formatEwDeskListExcerpt(
	excerpt: string | null | undefined,
	maxLen = DEFAULT_MAX_LEN
): string {
	if (!excerpt) return '';
	const collapsed = excerpt.replace(/\s+/g, ' ').trim();
	if (!collapsed) return '';
	if (collapsed.length <= maxLen) return collapsed;
	return `${collapsed.slice(0, maxLen).trimEnd()}…`;
}
