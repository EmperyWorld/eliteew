/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for compact quick preset partitioning.
 *
 * Related:
 * - src/features/ewa/companionQuickPresetsCompactUi.ts
 */
import { describe, expect, it } from 'vitest';
import {
	countPriorityQuickPresets,
	isCompanionPlanCompleteQuickPreset,
	partitionQuickPresetsForCompactUi,
	readQuickPresetsPriorityExpanded,
	writeQuickPresetsPriorityExpanded,
} from '../companionQuickPresetsCompactUi';
import type { CompanionQuickPresetChip } from '../ewaCompanionQuickPresetsUi';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';

describe('companionQuickPresetsCompactUi', () => {
	it('keeps user and plan-complete chips in the priority row', () => {
		const user: CompanionQuickPresetChip = {
			id: 'user-1',
			label: 'Mine',
			promptText: 'custom',
			builtin: false,
			sortOrder: 0,
		};
		const planComplete: CompanionQuickPresetChip = {
			id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}planComplete:t1`,
			label: 'Done: step',
			promptText: 'Mark done',
			builtin: true,
			sortOrder: -1,
		};
		const suggested: CompanionQuickPresetChip = {
			id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}musicAutonomous`,
			label: 'Plan',
			promptText: 'Plan text',
			builtin: true,
			sortOrder: 1,
		};
		const parts = partitionQuickPresetsForCompactUi([
			suggested,
			user,
			planComplete,
		]);
		expect(parts.priority).toHaveLength(2);
		expect(parts.suggested).toHaveLength(1);
		expect(isCompanionPlanCompleteQuickPreset(planComplete)).toBe(true);
	});

	it('counts user vs plan-complete priority chips', () => {
		const counts = countPriorityQuickPresets([
			{
				id: 'u1',
				label: 'Mine',
				promptText: 'x',
				builtin: false,
				sortOrder: 0,
			},
			{
				id: `${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}planComplete:t1`,
				label: 'Done',
				promptText: 'y',
				builtin: true,
				sortOrder: -1,
			},
		]);
		expect(counts.user).toBe(1);
		expect(counts.planComplete).toBe(1);
		expect(counts.total).toBe(2);
	});

	it('persists priority expanded flag in sessionStorage', () => {
		window.sessionStorage.clear();
		expect(readQuickPresetsPriorityExpanded('pid-1')).toBe(false);
		writeQuickPresetsPriorityExpanded('pid-1', true);
		expect(readQuickPresetsPriorityExpanded('pid-1')).toBe(true);
	});
});
