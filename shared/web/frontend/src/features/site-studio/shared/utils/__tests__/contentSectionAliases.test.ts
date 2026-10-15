/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for CMS section alias normalization in Site Studio admin.
 *
 * Invariants:
 * - Legacy `aromatherapy` rows must resolve when editing canonical `value_block`.
 *
 * Related:
 * - features/site-studio/shared/utils/contentSectionAliases.ts
 */

import { describe, expect, it } from 'vitest';
import { contentSectionCandidates } from '../contentSectionAliases';

describe('contentSectionCandidates', () => {
	it('includes legacy aromatherapy when canonical section is value_block', () => {
		expect(contentSectionCandidates('value_block')).toEqual([
			'value_block',
			'aromatherapy',
		]);
	});

	it('returns singleton list for unknown sections', () => {
		expect(contentSectionCandidates('hero')).toEqual(['hero']);
	});
});
