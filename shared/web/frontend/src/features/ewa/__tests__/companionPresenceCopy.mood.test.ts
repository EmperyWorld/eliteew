/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edge-case tests for companion presence copy — header role/micro-copy plus mood chip tension/warm bands,
 * steady band uses short personaMood labels (not long ambient lines).
 *
 * Related:
 * - src/features/ewa/companionPresenceCopy.ts
 */
import {
	pickCompanionHeaderCopy,
	pickCompanionMoodChipLabel,
} from '../companionPresenceCopy';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';

function makeT(): TFunction {
	const dict: Record<string, string> = {
		'ewaCompanion.personaMood.mela.tensionHigh': 'Tense',
		'ewaCompanion.personaMood.mela.warm': 'Warm',
		'ewaCompanion.personaMood.mela.quiet': 'Quiet',
		'ewaCompanion.personaMood.mela.steady': 'Steady',
		'ewaCompanion.personaMood.fallback.tensionHigh': 'FB-T',
		'ewaCompanion.personaMood.fallback.warm': 'FB-W',
		'ewaCompanion.personaMood.fallback.quiet': 'FB-Q',
		'ewaCompanion.personaMood.fallback.steady': 'FB-S',
	};
	return ((key: string, opts?: { returnObjects?: boolean }) => {
		if (
			opts?.returnObjects &&
			key === 'ewaCompanion.personaHeader.mela.ambient'
		) {
			return ['Amb1', 'Amb2'];
		}
		if (
			opts?.returnObjects &&
			key === 'ewaCompanion.personaHeader.mela.roles'
		) {
			return ['Mela sees the draft', 'Mela holds the tone'];
		}
		if (opts?.returnObjects && key === 'ewaCompanion.personaHeader.mela.here') {
			return ['listening', 'near the line'];
		}
		if (
			opts?.returnObjects &&
			key === 'ewaCompanion.personaHeader.mela.thinking'
		) {
			return ['choosing words…', 'warming the phrase…'];
		}
		return dict[key] ?? key;
	}) as TFunction;
}

describe('pickCompanionHeaderCopy', () => {
	const t = makeT();

	it('uses persona-specific role and presence pools instead of legacy fallback copy', () => {
		const out = pickCompanionHeaderCopy(
			t,
			'mela',
			null,
			'online',
			0,
			'Fallback role'
		);
		expect(['Mela sees the draft', 'Mela holds the tone']).toContain(
			out.roleLine
		);
		expect(['listening', 'near the line']).toContain(out.presenceMicro);
		expect(out.roleLine).not.toBe('Fallback role');
	});
});

describe('pickCompanionMoodChipLabel', () => {
	const t = makeT();

	it('returns null when no mood and no ambient array', () => {
		expect(pickCompanionMoodChipLabel(t, 'mela', null, 1)).toBe('Steady');
	});

	it('uses display mood tension band', () => {
		expect(pickCompanionMoodChipLabel(t, 'mela', { tension: 0.9 }, 0)).toBe(
			'Tense'
		);
	});

	it('uses display mood valence warm', () => {
		expect(
			pickCompanionMoodChipLabel(t, 'mela', { tension: 0.1, valence: 0.5 }, 0)
		).toBe('Warm');
	});

	it('steady band uses short personaMood steady label', () => {
		expect(
			pickCompanionMoodChipLabel(
				t,
				'mela',
				{ tension: 0.1, valence: 0.1, energy: 0.51 },
				0
			)
		).toBe('Steady');
	});

	it('without mood uses persona steady label', () => {
		expect(pickCompanionMoodChipLabel(t, 'mela', null, 0)).toBe('Steady');
		expect(pickCompanionMoodChipLabel(t, 'mela', null, 99)).toBe('Steady');
	});

	it('continuity tint warm wins over display mood tension', () => {
		expect(
			pickCompanionMoodChipLabel(t, 'mela', { tension: 0.9 }, 0, 'warm')
		).toBe('Warm');
	});
});
