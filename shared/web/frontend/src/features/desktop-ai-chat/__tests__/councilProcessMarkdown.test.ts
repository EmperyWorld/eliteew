/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';

import { stripCouncilProcessTurnMarkdown } from '../utils/councilProcessMarkdown';

describe('stripCouncilProcessTurnMarkdown', () => {
	it('strips leading ATX heading line', () => {
		expect(stripCouncilProcessTurnMarkdown('## Zone\n\nBrief body')).toBe(
			'Brief body'
		);
	});

	it('keeps body when no heading prefix', () => {
		expect(stripCouncilProcessTurnMarkdown('Plain brief')).toBe('Plain brief');
	});
});
