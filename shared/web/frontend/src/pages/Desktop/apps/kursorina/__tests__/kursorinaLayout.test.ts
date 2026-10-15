/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock ultrawide content shell tokens — no regression to max-w-4xl.
 */

import { describe, expect, it } from 'vitest';
import {
	KURSORINA_CONTENT_MAX,
	KURSORINA_CONTENT_PAD,
	KURSORINA_CONTENT_SHELL,
	KURSORINA_FINDINGS_GRID,
} from '../kursorinaLayout';

describe('kursorinaLayout', () => {
	it('uses 88rem cap instead of max-w-4xl', () => {
		expect(KURSORINA_CONTENT_MAX).toContain('88rem');
		expect(KURSORINA_CONTENT_MAX).not.toContain('max-w-4xl');
		expect(KURSORINA_CONTENT_SHELL).toContain(KURSORINA_CONTENT_MAX);
	});

	it('pads and finds two columns on xl', () => {
		expect(KURSORINA_CONTENT_PAD).toMatch(/p-4/);
		expect(KURSORINA_FINDINGS_GRID).toContain('xl:grid-cols-2');
	});
});
