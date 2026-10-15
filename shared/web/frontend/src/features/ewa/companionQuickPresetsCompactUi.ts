/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout helpers for the compact companion quick-phrases strip (priority row; legacy suggested popover when catalog is unavailable).
 *
 * Invariants:
 * - Pure functions only; no network I/O.
 * - Plan-complete dynamic chips stay in the priority row with user presets.
 *
 * Related:
 * - src/features/ewa/ewaCompanionQuickPresetsUi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { isCompanionQuickPresetDeletable } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

export type CompanionQuickPresetCompactPartition = {
	priority: CompanionQuickPresetChip[];
	suggested: CompanionQuickPresetChip[];
};

export function isCompanionPlanCompleteQuickPreset(
	preset: CompanionQuickPresetChip
): boolean {
	return preset.id.startsWith(
		`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}planComplete:`
	);
}

/** Priority row = user saved + plan-complete; suggested = other built-in i18n chips. */
export function partitionQuickPresetsForCompactUi(
	presets: CompanionQuickPresetChip[]
): CompanionQuickPresetCompactPartition {
	const priority: CompanionQuickPresetChip[] = [];
	const suggested: CompanionQuickPresetChip[] = [];
	for (const row of presets) {
		if (
			isCompanionQuickPresetDeletable(row) ||
			isCompanionPlanCompleteQuickPreset(row)
		) {
			priority.push(row);
			continue;
		}
		suggested.push(row);
	}
	return { priority, suggested };
}

/** Tailwind classes for a single-line horizontal chip scroller. */
export const COMPANION_QUICK_PRESET_SCROLL_ROW_CLASS =
	'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain flex-nowrap [scrollbar-width:thin]';

const QUICK_PRESETS_PRIORITY_EXPANDED_KEY_PREFIX =
	'eliteew.companion.quickPresetsPriorityExpanded.v1:';

export function countPriorityQuickPresets(
	priority: CompanionQuickPresetChip[]
): { user: number; planComplete: number; total: number } {
	let user = 0;
	let planComplete = 0;
	for (const row of priority) {
		if (isCompanionQuickPresetDeletable(row)) user += 1;
		else if (isCompanionPlanCompleteQuickPreset(row)) planComplete += 1;
	}
	return { user, planComplete, total: priority.length };
}

export function readQuickPresetsPriorityExpanded(principalId: string): boolean {
	if (typeof window === 'undefined' || !principalId.trim()) return false;
	try {
		const raw = window.sessionStorage.getItem(
			`${QUICK_PRESETS_PRIORITY_EXPANDED_KEY_PREFIX}${principalId}`
		);
		if (raw === '1') return true;
		if (raw === '0') return false;
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_quick_presets_priority_read',
			'sessionStorage priority expanded read failed',
			err
		);
	}
	return false;
}

export function writeQuickPresetsPriorityExpanded(
	principalId: string,
	expanded: boolean
): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.sessionStorage.setItem(
			`${QUICK_PRESETS_PRIORITY_EXPANDED_KEY_PREFIX}${principalId}`,
			expanded ? '1' : '0'
		);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_quick_presets_priority_write',
			'sessionStorage priority expanded write failed',
			err
		);
	}
}
