/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Overview «My week» focus line derivation.
 *
 * Related:
 * - realtorWeekFocusLogic.ts
 */

import { describe, expect, it } from 'vitest';

import { buildRealtorWeekFocusLines } from './realtorWeekFocusLogic';
import type { RealtorDashboardMetrics } from './realtorLogic';

const baseMetrics: RealtorDashboardMetrics = {
	propertiesTotal: 2,
	activeClients: 3,
	openDeals: 1,
	artifactsTotal: 4,
	learningCompleted: 1,
	learningTotal: 3,
	profileReady: true,
};

describe('buildRealtorWeekFocusLines', () => {
	it('prioritises profile completion before other signals', () => {
		expect(
			buildRealtorWeekFocusLines({
				metrics: { ...baseMetrics, profileReady: false },
				followUps: 2,
				listingLinkGaps: 1,
			})
		).toEqual([{ id: 'profileIncomplete' }]);
	});

	it('builds actionable week lines from CRM snapshot signals', () => {
		expect(
			buildRealtorWeekFocusLines({
				metrics: baseMetrics,
				followUps: 2,
				listingLinkGaps: 1,
			}).map((line) => line.id)
		).toEqual([
			'dealsInProgress',
			'followUpsDue',
			'listingLinksMissing',
			'learningRemaining',
		]);
	});

	it('returns steady week when nothing needs attention', () => {
		expect(
			buildRealtorWeekFocusLines({
				metrics: {
					...baseMetrics,
					openDeals: 0,
					learningCompleted: 3,
					learningTotal: 3,
					artifactsTotal: 0,
					activeClients: 2,
					propertiesTotal: 1,
				},
				followUps: 0,
				listingLinkGaps: 0,
			})
		).toEqual([{ id: 'steadyWeek' }]);
	});
});
