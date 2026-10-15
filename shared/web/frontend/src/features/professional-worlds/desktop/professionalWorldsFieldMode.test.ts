/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for mobile field-mode action registry.
 */

import { describe, expect, it } from 'vitest';

import {
	isProfessionalWorldsFieldMode,
	resolveFieldModeModuleKey,
} from './professionalWorldsFieldMode';

describe('professionalWorldsFieldMode', () => {
	it('enables field mode only on embedded mobile layout', () => {
		expect(isProfessionalWorldsFieldMode(true)).toBe(true);
		expect(isProfessionalWorldsFieldMode(false)).toBe(false);
	});

	it('maps field actions to profession tool module keys', () => {
		expect(resolveFieldModeModuleKey('contact')).toBe('realtor_communications');
		expect(resolveFieldModeModuleKey('showing')).toBe('realtor_showings');
		expect(resolveFieldModeModuleKey('listingPhoto')).toBeNull();
	});
});
