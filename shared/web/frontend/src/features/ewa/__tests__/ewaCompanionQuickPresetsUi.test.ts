/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion quick preset merge helpers.
 *
 * Related:
 * - src/features/ewa/ewaCompanionQuickPresetsUi.ts
 */
import ruMarketing from '../../../i18n/locales/ru/marketing.json';
import { describe, expect, it } from 'vitest';
import {
	buildBuiltinCompanionQuickPresets,
	buildPlanCompleteQuickPresets,
	isCompanionQuickPresetDeletable,
	mergeCompanionQuickPresets,
	partitionCompanionQuickPresets,
	prependPlanCompleteQuickPresets,
	type CompanionQuickPresetChip,
} from '../ewaCompanionQuickPresetsUi';
import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';

const t = ((key: string, opts?: { title?: string }) => {
	if (key.endsWith('.label')) return `label:${key}`;
	if (key.endsWith('.prompt')) return `prompt:${key}`;
	if (key === 'ewaCompanion.planQuickCompleteLabel') {
		return `label:${opts?.title ?? ''}`;
	}
	if (key === 'ewaCompanion.planQuickCompletePrompt') {
		return `prompt:${opts?.title ?? ''}`;
	}
	return key;
}) as never;

describe('ewaCompanionQuickPresetsUi', () => {
	it('builds builtin presets with stable prefix ids', () => {
		const rows = buildBuiltinCompanionQuickPresets(t);
		expect(rows.length).toBeGreaterThan(5);
		expect(
			rows.every((r) =>
				r.id.startsWith(EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX)
			)
		).toBe(true);
		expect(rows.some((r) => r.id.endsWith('xlBaseInteractive'))).toBe(true);
	});

	it('covers all ru quickPresetDefaults keys (sync with quick_intents.py)', () => {
		const defaults = ruMarketing.ewaCompanion.quickPresetDefaults;
		const rows = buildBuiltinCompanionQuickPresets(t);
		const defaultKeys = Object.keys(defaults).sort();
		const builtKeys = rows
			.map((row) =>
				row.id.slice(EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX.length)
			)
			.sort();
		expect(builtKeys).toEqual(defaultKeys);
	});

	it('dedupes server presets by prompt text', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const firstBuiltin = builtins[0];
		expect(firstBuiltin).toBeDefined();
		const merged = mergeCompanionQuickPresets(
			[
				{
					id: 'user-1',
					principal_id: 'p',
					label: 'Custom',
					prompt_text: firstBuiltin?.promptText ?? '',
					sort_order: 0,
				},
			],
			builtins
		);
		expect(merged).toHaveLength(builtins.length);
		expect(merged[0]?.id).toBe('user-1');
	});

	it('builds plan-complete chips from open tasks', () => {
		const rows = buildPlanCompleteQuickPresets(t, [
			{
				id: 'task-1',
				plan_id: 'plan-1',
				title: 'Настроить CI',
				status: 'pending',
				priority: 'medium',
				sort_order: 0,
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toContain('planComplete:task-1');
		expect(rows[0]?.promptText).toContain('Настроить CI');
	});

	it('prepends plan-complete chips and dedupes matching prompts', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const planComplete = buildPlanCompleteQuickPresets(t, [
			{
				id: 'task-1',
				plan_id: 'plan-1',
				title: 'Smoke-тест',
				status: 'pending',
				priority: 'medium',
				sort_order: 0,
			},
		]);
		const merged = prependPlanCompleteQuickPresets(builtins, planComplete);
		expect(merged[0]?.id).toBe(planComplete[0]?.id);
		expect(merged).toHaveLength(builtins.length + planComplete.length);
	});

	it('keeps all server rows even when prompt text repeats', () => {
		const merged = mergeCompanionQuickPresets(
			[
				{
					id: 'a',
					principal_id: 'p',
					label: 'One',
					prompt_text: 'same',
					sort_order: 0,
				},
				{
					id: 'b',
					principal_id: 'p',
					label: 'Two',
					prompt_text: 'same',
					sort_order: 1,
				},
			],
			buildBuiltinCompanionQuickPresets(t)
		);
		expect(merged.filter((row) => !row.builtin)).toHaveLength(2);
	});

	it('partitions user vs builtin presets', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const userPreset: CompanionQuickPresetChip = {
			id: 'user-1',
			label: 'Mine',
			promptText: 'custom prompt',
			builtin: false,
			sortOrder: 0,
		};
		const parts = partitionCompanionQuickPresets([userPreset, ...builtins]);
		expect(parts.user).toHaveLength(1);
		expect(parts.builtin.length).toBe(builtins.length);
	});

	it('marks only user-saved presets as deletable', () => {
		const builtins = buildBuiltinCompanionQuickPresets(t);
		const planComplete = buildPlanCompleteQuickPresets(t, [
			{
				id: 'task-1',
				plan_id: 'plan-1',
				title: 'Smoke',
				status: 'pending',
				priority: 'medium',
				sort_order: 0,
			},
		]);
		const userPreset: CompanionQuickPresetChip = {
			id: 'user-1',
			label: 'Mine',
			promptText: 'custom prompt',
			builtin: false,
			sortOrder: 0,
		};
		expect(isCompanionQuickPresetDeletable(userPreset)).toBe(true);
		const builtin = builtins[0];
		const planChip = planComplete[0];
		expect(builtin).toBeDefined();
		expect(planChip).toBeDefined();
		if (!builtin || !planChip) return;
		expect(isCompanionQuickPresetDeletable(builtin)).toBe(false);
		expect(isCompanionQuickPresetDeletable(planChip)).toBe(false);
	});
});
