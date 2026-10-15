/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for segment editor helpers (P-605).
 */

import { describe, expect, it } from 'vitest';
import {
	buildPoemmaSegmentsForSave,
	createEmptyPoemmaSegmentDrafts,
	poemmaSegmentDraftsFromStored,
	poemmaSegmentShareTotalFromDrafts,
	validatePoemmaSegmentsDraft,
} from '../poemmaSegmentsForm';

describe('poemmaSegmentsForm', () => {
	it('defaults to four onboarding segments', () => {
		const drafts = createEmptyPoemmaSegmentDrafts();
		expect(drafts).toHaveLength(4);
		expect(drafts[0].name).toBe('Локальные');
		expect(drafts[3].sharePercent).toBe(10);
		expect(poemmaSegmentShareTotalFromDrafts(drafts)).toBe(100);
	});

	it('pads stored segments to four slots', () => {
		const drafts = poemmaSegmentDraftsFromStored([
			{
				id: 's1',
				orgId: 'org-1',
				name: 'Опт',
				sharePercent: 100,
				note: 'тест',
			},
		]);
		expect(drafts).toHaveLength(4);
		expect(drafts[0].name).toBe('Опт');
		expect(drafts[0].note).toBe('тест');
	});

	it('rejects empty segment names', () => {
		const drafts = createEmptyPoemmaSegmentDrafts();
		drafts[2].name = '   ';
		expect(validatePoemmaSegmentsDraft(drafts)).toBe(
			'Укажите название каждого сегмента'
		);
	});

	it('builds save payload with trimmed note', () => {
		const drafts = createEmptyPoemmaSegmentDrafts();
		drafts[0].note = '  Лэтуаль  ';
		const saved = buildPoemmaSegmentsForSave('org-1', drafts);
		expect(saved[0].note).toBe('Лэтуаль');
		expect(saved[0].orgId).toBe('org-1');
	});
});
