/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Hub IA includes host network panel id (pre-license journey).
 */

import { describe, expect, it } from 'vitest';
import { MORE_PANELS } from './hubIa';

describe('hubIa host network', () => {
	it('MORE_PANELS includes network distinct from connection', () => {
		expect(MORE_PANELS).toContain('network');
		expect(MORE_PANELS).toContain('connection');
		expect(MORE_PANELS.indexOf('network')).not.toBe(
			MORE_PANELS.indexOf('connection')
		);
	});
});
