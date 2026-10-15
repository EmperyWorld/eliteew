/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock O4 denylist shell gate.
 */

import { describe, expect, it } from 'vitest';
import { shouldBlockShellForDenylist } from './denylistGate';

describe('shouldBlockShellForDenylist', () => {
	it('blocks only when revoked true', () => {
		expect(shouldBlockShellForDenylist(true)).toBe(true);
		expect(shouldBlockShellForDenylist(false)).toBe(false);
		expect(shouldBlockShellForDenylist(null)).toBe(false);
	});
});
