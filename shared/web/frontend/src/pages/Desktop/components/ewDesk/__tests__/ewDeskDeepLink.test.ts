/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk deep link URL builder.
 */

import { describe, expect, it } from 'vitest';
import { buildEwDeskNewsDeepLink } from '../ewDeskDeepLink';

describe('buildEwDeskNewsDeepLink', () => {
	it('builds desktop url with ewdesk_news query', () => {
		expect(
			buildEwDeskNewsDeepLink('abc-123', {
				origin: 'https://app.empery.world',
				pathname: '/',
			})
		).toBe('https://app.empery.world/?ewdesk_news=abc-123');
	});

	it('returns pathname only when post id is empty', () => {
		expect(
			buildEwDeskNewsDeepLink('  ', {
				origin: 'https://app.empery.world',
				pathname: '/desktop',
			})
		).toBe('https://app.empery.world/desktop');
	});
});
