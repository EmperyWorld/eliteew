/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for ideas form helpers and domain verdict invariants.
 */

import { describe, expect, it } from 'vitest';
import type { PoemmaInitiative } from '../../poemmaDomain';
import {
	buildPoemmaInitiativeWithVerdict,
	canSavePoemmaInitiative,
	filterPoemmaInitiativesByTab,
	formatPoemmaInitiativeListStatusLine,
	truncatePoemmaIdeaListTitle,
	validatePoemmaVerdictDraft,
} from '../poemmaIdeasForm';

const sampleInitiative = (
	overrides: Partial<PoemmaInitiative> = {}
): PoemmaInitiative => ({
	id: 'i1',
	periodId: 'p1',
	title: 'Коллаб Приморье на форуме ВЭФ',
	story: 'Полный текст',
	source: 'Форум ВЭФ',
	status: 'testing',
	...overrides,
});

describe('truncatePoemmaIdeaListTitle', () => {
	it('truncates titles longer than five words', () => {
		expect(truncatePoemmaIdeaListTitle('один два три четыре пять шесть')).toBe(
			'один два три четыре пять…'
		);
	});

	it('keeps short titles intact', () => {
		expect(truncatePoemmaIdeaListTitle('Коллаб Приморье')).toBe(
			'Коллаб Приморье'
		);
	});
});

describe('filterPoemmaInitiativesByTab', () => {
	const items: PoemmaInitiative[] = [
		sampleInitiative({ id: 'a', status: 'backlog' }),
		sampleInitiative({ id: 'b', status: 'testing' }),
		sampleInitiative({
			id: 'c',
			status: 'decided',
			verdict: 'go',
			verdictNote: 'ok',
		}),
	];

	it('returns all initiatives for all tab', () => {
		expect(filterPoemmaInitiativesByTab(items, 'all')).toHaveLength(3);
	});

	it('filters testing and decided', () => {
		expect(filterPoemmaInitiativesByTab(items, 'testing')).toHaveLength(1);
		expect(filterPoemmaInitiativesByTab(items, 'decided')).toHaveLength(1);
	});
});

describe('formatPoemmaInitiativeListStatusLine', () => {
	it('shows verdict for decided ideas', () => {
		expect(
			formatPoemmaInitiativeListStatusLine(
				sampleInitiative({
					status: 'decided',
					verdict: 'go',
					verdictNote: 'Да',
				})
			)
		).toBe('decided ✓ Идём');
	});
});

describe('verdict validation', () => {
	it('requires comment when saving verdict', () => {
		expect(
			validatePoemmaVerdictDraft({ verdict: 'go', verdictNote: '   ' })
		).toBe('Комментарий к решению обязателен');
	});

	it('builds decided initiative with note', () => {
		const next = buildPoemmaInitiativeWithVerdict(
			sampleInitiative(),
			'stop',
			' Не сейчас '
		);
		expect(next.status).toBe('decided');
		expect(next.verdict).toBe('stop');
		expect(next.verdictNote).toBe('Не сейчас');
		expect(canSavePoemmaInitiative(next)).toBe(true);
	});

	it('rejects verdict without note at repository level', () => {
		const invalid = buildPoemmaInitiativeWithVerdict(
			sampleInitiative(),
			'go',
			''
		);
		expect(canSavePoemmaInitiative(invalid)).toBe(false);
	});
});
