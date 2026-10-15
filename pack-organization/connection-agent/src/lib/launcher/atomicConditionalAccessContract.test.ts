/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Launcher contract tests for Desktop Atomic Conditional Access (Wave 0).
 *
 * Related:
 * - atomicConditionalAccessContract.ts
 */

import { describe, expect, it } from 'vitest';
import {
	buildCompliantProductStartUrl,
	startUrlHasForbiddenBindIds,
} from './atomicConditionalAccessContract';

describe('launcher atomicConditionalAccessContract', () => {
	it('rejects legacy bind query params', () => {
		expect(
			startUrlHasForbiddenBindIds(
				'https://app.eliteew.ru/?eliteewLicenseId=a&eliteewDeviceId=b',
			),
		).toBe(true);
	});

	it('buildCompliantProductStartUrl has no forbidden params', () => {
		const url = buildCompliantProductStartUrl('https://app.eliteew.ru/');
		expect(startUrlHasForbiddenBindIds(url)).toBe(false);
		expect(url).toMatch(/eliteewDesktopClient=1/);
	});
});
