/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact ensemble roster text for the Desktop AI Chat header title line
 * (avatars already show faces — avoid UPPERCASE name dump).
 *
 * Invariants:
 * - Display-only; does not mutate chat settings.
 *
 * Related:
 * - components/DesktopAiChatMainHeader.tsx
 */

/** Max hero names shown inline before "+N" in the header title. */
export const DESKTOP_AI_HEADER_ROSTER_NAMES_MAX = 2;

export function compactDesktopAiHeaderRosterLabel(input: {
	heroShortLabels: readonly string[];
	fallbackSubtitle?: string;
	maxVisible?: number;
}): string {
	const max = input.maxVisible ?? DESKTOP_AI_HEADER_ROSTER_NAMES_MAX;
	const fromHeroes = input.heroShortLabels.map((s) => s.trim()).filter(Boolean);
	const labels =
		fromHeroes.length > 0
			? fromHeroes
			: (input.fallbackSubtitle ?? '')
					.split('·')
					.map((s) => s.trim())
					.filter(Boolean);
	if (labels.length === 0) return '';
	if (labels.length <= max) return labels.join(' · ');
	return `${labels.slice(0, max).join(' · ')} · +${labels.length - max}`;
}
