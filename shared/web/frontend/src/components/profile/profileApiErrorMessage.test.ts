/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock profileApiErrorMessage message extraction contract.
 */

import { describe, expect, it } from 'vitest';

import { profileApiErrorMessage } from './profileApiErrorMessage';

describe('profileApiErrorMessage', () => {
	it('returns nested response message when present', () => {
		expect(
			profileApiErrorMessage(
				{ response: { data: { message: 'Server said no' } } },
				'fallback'
			)
		).toBe('Server said no');
	});

	it('returns fallback when message is missing', () => {
		expect(profileApiErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
	});
});
