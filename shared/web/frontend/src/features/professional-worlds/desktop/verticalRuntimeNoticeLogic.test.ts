/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for non-realtor vertical runtime notice gating.
 */

import { describe, expect, it } from 'vitest';

import { shouldShowNonRealtorVerticalNotice } from './verticalRuntimeNoticeLogic';

describe('shouldShowNonRealtorVerticalNotice', () => {
	it('shows notice for non-realtor vertical with runtime config', () => {
		expect(
			shouldShowNonRealtorVerticalNotice({
				activeVerticalSlug: 'lawyer',
				hasRuntimeConfig: true,
			})
		).toBe(true);
	});

	it('hides notice for realtor vertical', () => {
		expect(
			shouldShowNonRealtorVerticalNotice({
				activeVerticalSlug: 'realtor',
				hasRuntimeConfig: true,
			})
		).toBe(false);
	});
});
