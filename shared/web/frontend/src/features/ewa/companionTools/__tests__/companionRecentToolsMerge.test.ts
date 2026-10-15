/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for U1.6 merge of server recent actions with local recent tool chip ids.
 */

import { describe, expect, it } from 'vitest';

import { EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX } from '@/services/ewa/ewaCompanionProfileApi';
import { companionChipIdForEwaToolName } from '@/features/ewa/companionTools/companionEwaToolsRegistry';
import { mergeCompanionRecentToolChipIds } from '@/features/ewa/companionTools/companionRecentToolsMerge';

describe('companionChipIdForEwaToolName', () => {
	it('maps registry tool names to builtin chip ids', () => {
		expect(companionChipIdForEwaToolName('music_generation')).toBe(
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}musicGenerate`
		);
		expect(companionChipIdForEwaToolName('file_create')).toBe(
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}documentCreate`
		);
	});

	it('resolves orchestrator branch aliases', () => {
		expect(companionChipIdForEwaToolName('doc_create')).toBe(
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}documentCreate`
		);
	});
});

describe('mergeCompanionRecentToolChipIds', () => {
	it('prefers newest server actions over local-only ids', () => {
		const localRecent = [
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}themeSet`,
		];
		const learned = {
			companion_recent_server_actions: [
				{
					tool: 'theme_set',
					branch: 'theme_set',
					status: 'ok',
					summary: '',
					ts: '2026-06-20T10:00:00.000Z',
				},
				{
					tool: 'music_generation',
					branch: 'music_generation',
					status: 'ok',
					summary: '',
					ts: '2026-06-20T11:00:00.000Z',
				},
			],
		};
		expect(
			mergeCompanionRecentToolChipIds({
				localRecent,
				learnedPreferences: learned,
			})
		).toEqual([
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}musicGenerate`,
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}themeSet`,
		]);
	});

	it('skips server rows with non-display statuses and dedupes', () => {
		const learned = {
			companion_recent_server_actions: [
				{
					tool: 'file_delete',
					branch: 'file_delete',
					status: 'error',
					summary: 'fail',
					ts: '2026-06-20T12:00:00.000Z',
				},
				{
					tool: 'catalog_list',
					branch: 'catalog_list',
					status: 'ok',
					summary: '',
					ts: '2026-06-20T12:01:00.000Z',
				},
			],
		};
		expect(
			mergeCompanionRecentToolChipIds({
				localRecent: [],
				learnedPreferences: learned,
			})
		).toEqual([`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}documentList`]);
	});

	it('caps merged list at five', () => {
		const localRecent = Array.from({ length: 5 }, (_, i) => `local.${i}`);
		const learned = {
			companion_recent_server_actions: [
				{ tool: 'plan_v1', status: 'ok', summary: '', ts: '1' },
				{ tool: 'theme_set', status: 'ok', summary: '', ts: '2' },
				{ tool: 'music_generation', status: 'ok', summary: '', ts: '3' },
			],
		};
		const merged = mergeCompanionRecentToolChipIds({
			localRecent,
			learnedPreferences: learned,
			max: 5,
		});
		expect(merged).toHaveLength(5);
		expect(merged[0]).toBe(
			`${EWA_COMPANION_BUILTIN_QUICK_PRESET_PREFIX}musicGenerate`
		);
	});
});
