/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for «Мои фразы» reorder and duplicate (U2.2–U2.3).
 *
 * Invariants:
 * - ``sort_order`` step stays within API max 10_000.
 * - Duplicate labels respect quick-actions max length 80.
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 */

export const COMPANION_QUICK_PRESET_LABEL_MAX = 80;

export function buildQuickPresetReorderUpdates(
	orderedIds: readonly string[],
	step = 10
): Array<{ id: string; sort_order: number }> {
	return orderedIds.map((id, index) => ({
		id,
		sort_order: (index + 1) * step,
	}));
}

export function buildDuplicateQuickPresetLabel(
	sourceLabel: string,
	suffix: string,
	maxLength = COMPANION_QUICK_PRESET_LABEL_MAX
): string {
	const base = sourceLabel.trim() || 'Phrase';
	if (!suffix) return base.slice(0, maxLength);
	const maxBase = Math.max(1, maxLength - suffix.length);
	return `${base.slice(0, maxBase)}${suffix}`;
}
