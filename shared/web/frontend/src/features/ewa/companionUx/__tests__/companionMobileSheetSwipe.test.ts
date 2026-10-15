/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for mobile sheet swipe-dismiss thresholds (U5.7).
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_MOBILE_SHEET_DISMISS_THRESHOLD_PX,
	companionMobileSheetDismissOffset,
	shouldDismissCompanionMobileSheet,
} from '@/features/ewa/companionUx/companionMobileSheetSwipe';

describe('companionMobileSheetDismissOffset', () => {
	it('returns zero for upward drags', () => {
		expect(companionMobileSheetDismissOffset(-40, true)).toBe(0);
		expect(companionMobileSheetDismissOffset(40, false)).toBe(0);
	});

	it('tracks downward drag with cap', () => {
		expect(companionMobileSheetDismissOffset(100, true)).toBe(85);
		expect(companionMobileSheetDismissOffset(400, true)).toBe(220);
	});
});

describe('shouldDismissCompanionMobileSheet', () => {
	it('fires at threshold', () => {
		expect(
			shouldDismissCompanionMobileSheet(
				COMPANION_MOBILE_SHEET_DISMISS_THRESHOLD_PX - 1
			)
		).toBe(false);
		expect(
			shouldDismissCompanionMobileSheet(
				COMPANION_MOBILE_SHEET_DISMISS_THRESHOLD_PX
			)
		).toBe(true);
	});
});
