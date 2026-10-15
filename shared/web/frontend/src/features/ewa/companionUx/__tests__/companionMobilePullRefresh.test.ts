/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for mobile companion pull-to-refresh thresholds (U5.5).
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_MOBILE_PULL_REFRESH_THRESHOLD_PX,
	companionMobilePullRefreshHint,
	companionMobilePullRefreshOffset,
	isCompanionMobilePullScrollAtTop,
	shouldTriggerCompanionMobilePullRefresh,
} from '@/features/ewa/companionUx/companionMobilePullRefresh';

describe('companionMobilePullRefreshOffset', () => {
	it('returns zero when scrolled or pulling up', () => {
		expect(companionMobilePullRefreshOffset(80, 12, true)).toBe(0);
		expect(companionMobilePullRefreshOffset(80, 0, true)).toBe(36);
		expect(companionMobilePullRefreshOffset(-20, 0, true)).toBe(0);
		expect(companionMobilePullRefreshOffset(80, 0, false)).toBe(0);
	});

	it('isCompanionMobilePullScrollAtTop respects dead-zone', () => {
		expect(isCompanionMobilePullScrollAtTop(0)).toBe(true);
		expect(isCompanionMobilePullScrollAtTop(2)).toBe(true);
		expect(isCompanionMobilePullScrollAtTop(3)).toBe(false);
	});

	it('applies resistance and caps max pull', () => {
		expect(companionMobilePullRefreshOffset(100, 0, true)).toBe(45);
		expect(companionMobilePullRefreshOffset(400, 0, true)).toBe(120);
	});
});

describe('shouldTriggerCompanionMobilePullRefresh', () => {
	it('fires at threshold', () => {
		expect(
			shouldTriggerCompanionMobilePullRefresh(
				COMPANION_MOBILE_PULL_REFRESH_THRESHOLD_PX - 1
			)
		).toBe(false);
		expect(
			shouldTriggerCompanionMobilePullRefresh(
				COMPANION_MOBILE_PULL_REFRESH_THRESHOLD_PX
			)
		).toBe(true);
	});
});

describe('companionMobilePullRefreshHint', () => {
	it('maps pull distance to user hints', () => {
		expect(companionMobilePullRefreshHint(0, false)).toBe('idle');
		expect(companionMobilePullRefreshHint(24, false)).toBe('pull');
		expect(companionMobilePullRefreshHint(80, false)).toBe('release');
		expect(companionMobilePullRefreshHint(0, true)).toBe('refreshing');
	});
});
