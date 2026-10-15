/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fallback monogram letter for GAF sidebar avatars when no image URL is available.
 *
 * Invariants:
 * - Uses first character of username (without leading @), uppercased.
 *
 * Related:
 * - GAFChatSidebarRow.tsx
 */

export function gafChatSidebarMonogram(username?: string | null): string {
	const normalized = (username ?? '').trim().replace(/^@/, '');
	if (!normalized) return '?';
	const first = [...normalized][0];
	return first ? first.toUpperCase() : '?';
}
