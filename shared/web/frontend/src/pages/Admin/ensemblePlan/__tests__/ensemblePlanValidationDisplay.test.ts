/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	formatEnsemblePlanValidationDisplay,
	hasEnsemblePlanValidationHint,
} from '../ensemblePlanValidationDisplay';

describe('ensemblePlanValidationDisplay', () => {
	it('formats string and structured API detail', () => {
		expect(formatEnsemblePlanValidationDisplay('bad step')).toBe('bad step');
		expect(formatEnsemblePlanValidationDisplay(['a', 'b'])).toContain('"a"');
		expect(formatEnsemblePlanValidationDisplay({ field: 'x' })).toContain(
			'"field"'
		);
		expect(formatEnsemblePlanValidationDisplay(null)).toBe('');
	});

	it('detects non-empty validation hints', () => {
		expect(hasEnsemblePlanValidationHint('err')).toBe(true);
		expect(hasEnsemblePlanValidationHint('  ')).toBe(false);
		expect(hasEnsemblePlanValidationHint(null)).toBe(false);
	});
});
