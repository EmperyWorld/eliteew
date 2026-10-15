/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock normalizeCallTarget for Связи → Телефон call routing preference.
 *
 * Related:
 * - ../callTargetPreference.ts
 */

import { describe, expect, it } from 'vitest';
import { normalizeCallTarget } from '../callTargetPreference';

describe('normalizeCallTarget', () => {
	it('keeps known targets', () => {
		expect(normalizeCallTarget('both')).toBe('both');
		expect(normalizeCallTarget('desktop_only')).toBe('desktop_only');
		expect(normalizeCallTarget('mobile_only')).toBe('mobile_only');
		expect(normalizeCallTarget('MOBILE_ONLY')).toBe('mobile_only');
	});

	it('defaults unknown values to both', () => {
		expect(normalizeCallTarget(undefined)).toBe('both');
		expect(normalizeCallTarget('')).toBe('both');
		expect(normalizeCallTarget('legacy')).toBe('both');
	});
});
