/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Redis-dependent filter hints in Users catalog.
 */

import { describe, expect, it } from 'vitest';
import { buildAdminUsersRedisFilterHintKeys } from '../adminUsersRedisFilterHints';

describe('adminUsersRedisFilterHints', () => {
	it('returns hints when redis down and redis filters on', () => {
		const hints = buildAdminUsersRedisFilterHintKeys({
			redisAvailable: false,
			onlineOnly: true,
			anomalyOnly: false,
			mismatchOnly: true,
		});
		expect(hints.length).toBe(2);
	});

	it('returns empty when redis ok', () => {
		expect(
			buildAdminUsersRedisFilterHintKeys({
				redisAvailable: true,
				onlineOnly: true,
				anomalyOnly: true,
				mismatchOnly: true,
			})
		).toEqual([]);
	});
});
