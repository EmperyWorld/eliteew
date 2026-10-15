/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derives user-facing «My week» focus lines for the Overview pulse tab from snapshot CRM signals.
 *
 * Invariants:
 * - Pure helper; i18n keys are resolved in the Overview panel.
 * - Returns at most four lines, prioritising blockers then active work.
 *
 * Related:
 * - realtorLogic.ts (`buildRealtorDashboardMetrics`)
 * - OverviewWorkspacePanel.tsx
 */

import type { RealtorDashboardMetrics } from './realtorLogic';

export type RealtorWeekFocusLineId =
	| 'profileIncomplete'
	| 'noListingsYet'
	| 'noClientsYet'
	| 'dealsInProgress'
	| 'followUpsDue'
	| 'listingLinksMissing'
	| 'learningRemaining'
	| 'contentReady'
	| 'steadyWeek';

export interface RealtorWeekFocusLine {
	id: RealtorWeekFocusLineId;
	count?: number;
}

export function buildRealtorWeekFocusLines(input: {
	metrics: RealtorDashboardMetrics;
	followUps: number;
	listingLinkGaps: number;
	maxLines?: number;
}): RealtorWeekFocusLine[] {
	const maxLines = input.maxLines ?? 4;
	const lines: RealtorWeekFocusLine[] = [];

	if (!input.metrics.profileReady) {
		return [{ id: 'profileIncomplete' }];
	}

	if (input.metrics.propertiesTotal === 0) {
		lines.push({ id: 'noListingsYet' });
	}
	if (input.metrics.activeClients === 0) {
		lines.push({ id: 'noClientsYet' });
	}
	if (input.metrics.openDeals > 0) {
		lines.push({ id: 'dealsInProgress', count: input.metrics.openDeals });
	}
	if (input.followUps > 0) {
		lines.push({ id: 'followUpsDue', count: input.followUps });
	}
	if (input.listingLinkGaps > 0) {
		lines.push({
			id: 'listingLinksMissing',
			count: input.listingLinkGaps,
		});
	}
	const learningRemaining =
		input.metrics.learningTotal - input.metrics.learningCompleted;
	if (learningRemaining > 0) {
		lines.push({ id: 'learningRemaining', count: learningRemaining });
	}
	if (input.metrics.artifactsTotal > 0) {
		lines.push({ id: 'contentReady', count: input.metrics.artifactsTotal });
	}

	if (lines.length === 0) {
		return [{ id: 'steadyWeek' }];
	}

	return lines.slice(0, maxLines);
}
