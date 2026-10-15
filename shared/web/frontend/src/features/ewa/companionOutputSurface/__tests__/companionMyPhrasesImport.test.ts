/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for «Мои фразы» JSON import parser (U2.9).
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_MY_PHRASES_EXPORT_FORMAT,
	COMPANION_MY_PHRASES_EXPORT_VERSION,
	stringifyCompanionMyPhrasesExport,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesExport';
import {
	companionMyPhraseImportFingerprint,
	filterCompanionMyPhrasesImportCreates,
	parseCompanionMyPhrasesImportJson,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesImport';

describe('parseCompanionMyPhrasesImportJson', () => {
	it('accepts export-shaped v1 payload', () => {
		const text = stringifyCompanionMyPhrasesExport({
			format: COMPANION_MY_PHRASES_EXPORT_FORMAT,
			version: COMPANION_MY_PHRASES_EXPORT_VERSION,
			exported_at: '2026-06-22T10:00:00.000Z',
			phrases: [
				{
					label: 'Привет',
					prompt_text: 'Скажи привет',
					sort_order: 20,
					icon: { icon: 'icon-ewa-brain', tone: 'aura' },
				},
				{
					label: 'Вторая',
					prompt_text: 'Текст',
					sort_order: 10,
				},
			],
		});
		const result = parseCompanionMyPhrasesImportJson(text);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.phrases).toHaveLength(2);
		expect(result.phrases[0]?.label).toBe('Вторая');
		expect(result.phrases[1]?.icon).toEqual({
			icon: 'icon-ewa-brain',
			tone: 'aura',
		});
	});

	it('rejects invalid JSON and wrong format', () => {
		expect(parseCompanionMyPhrasesImportJson('{')).toEqual({
			ok: false,
			error: 'invalid_json',
		});
		expect(
			parseCompanionMyPhrasesImportJson(
				JSON.stringify({ format: 'other', version: 1, phrases: [] })
			)
		).toEqual({ ok: false, error: 'invalid_format' });
	});

	it('rejects empty and oversized phrase lists', () => {
		const empty = JSON.stringify({
			format: COMPANION_MY_PHRASES_EXPORT_FORMAT,
			version: COMPANION_MY_PHRASES_EXPORT_VERSION,
			phrases: [],
		});
		expect(parseCompanionMyPhrasesImportJson(empty)).toEqual({
			ok: false,
			error: 'empty',
		});
		const tooMany = JSON.stringify({
			format: COMPANION_MY_PHRASES_EXPORT_FORMAT,
			version: COMPANION_MY_PHRASES_EXPORT_VERSION,
			phrases: Array.from({ length: 51 }, (_, i) => ({
				label: `L${i}`,
				prompt_text: `P${i}`,
				sort_order: i,
			})),
		});
		expect(parseCompanionMyPhrasesImportJson(tooMany)).toEqual({
			ok: false,
			error: 'too_many',
		});
	});
});

describe('filterCompanionMyPhrasesImportCreates', () => {
	it('skips duplicates against existing and within batch', () => {
		const existing = new Set([
			companionMyPhraseImportFingerprint('Есть', 'уже'),
		]);
		const { toCreate, skipped } = filterCompanionMyPhrasesImportCreates(
			[
				{ label: 'Есть', prompt_text: 'уже', sort_order: 10 },
				{ label: 'Новая', prompt_text: 'фраза', sort_order: 20 },
				{ label: 'Новая', prompt_text: 'фраза', sort_order: 30 },
			],
			existing
		);
		expect(skipped).toBe(2);
		expect(toCreate).toEqual([
			{ label: 'Новая', prompt_text: 'фраза', sort_order: 20 },
		]);
	});
});
