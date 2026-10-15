/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for «Мои фразы» JSON export builder (U2.8).
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_MY_PHRASES_EXPORT_FORMAT,
	COMPANION_MY_PHRASES_EXPORT_VERSION,
	buildCompanionMyPhrasesExportPayload,
	companionMyPhrasesExportFilename,
	stringifyCompanionMyPhrasesExport,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesExport';
import type { CompanionQuickPresetVisual } from '@/features/ewa/companionQuickPresetIcons';
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';

describe('buildCompanionMyPhrasesExportPayload', () => {
	it('exports only user presets with icons and sort order', () => {
		const presets: CompanionQuickPresetChip[] = [
			{
				id: 'builtin-1',
				label: 'Built-in',
				promptText: 'skip',
				builtin: true,
				sortOrder: 1,
			},
			{
				id: 'user-b',
				label: 'Вторая',
				promptText: 'prompt b',
				builtin: false,
				sortOrder: 20,
			},
			{
				id: 'user-a',
				label: 'Первая',
				promptText: 'prompt a',
				builtin: false,
				sortOrder: 10,
			},
		];
		const icons = new Map<string, CompanionQuickPresetVisual>([
			['user-a', { icon: 'icon-pulse', tone: 'aura' }],
		]);
		const exportedAt = new Date('2026-06-22T10:15:00.000Z');
		const payload = buildCompanionMyPhrasesExportPayload(
			presets,
			icons,
			exportedAt
		);
		expect(payload.format).toBe(COMPANION_MY_PHRASES_EXPORT_FORMAT);
		expect(payload.version).toBe(COMPANION_MY_PHRASES_EXPORT_VERSION);
		expect(payload.exported_at).toBe('2026-06-22T10:15:00.000Z');
		expect(payload.phrases).toEqual([
			{
				label: 'Первая',
				prompt_text: 'prompt a',
				sort_order: 10,
				icon: { icon: 'icon-pulse', tone: 'aura' },
			},
			{
				label: 'Вторая',
				prompt_text: 'prompt b',
				sort_order: 20,
			},
		]);
	});
});

describe('companionMyPhrasesExportFilename', () => {
	it('uses ISO date prefix', () => {
		expect(
			companionMyPhrasesExportFilename(new Date('2026-06-22T12:00:00.000Z'))
		).toBe('ewa-my-phrases-2026-06-22.json');
	});
});

describe('stringifyCompanionMyPhrasesExport', () => {
	it('pretty-prints JSON with trailing newline', () => {
		const text = stringifyCompanionMyPhrasesExport({
			format: COMPANION_MY_PHRASES_EXPORT_FORMAT,
			version: COMPANION_MY_PHRASES_EXPORT_VERSION,
			exported_at: '2026-06-22T10:15:00.000Z',
			phrases: [],
		});
		expect(text.endsWith('\n')).toBe(true);
		expect(text).toContain('"phrases": []');
	});
});
