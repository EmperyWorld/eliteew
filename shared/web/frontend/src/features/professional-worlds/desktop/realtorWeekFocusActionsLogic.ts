/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps Overview «My week» focus line ids to workspace navigation actions for one-click follow-up.
 *
 * Invariants:
 * - Pure helper; disabled modules yield no action button.
 *
 * Related:
 * - realtorWeekFocusLogic.ts
 * - OverviewWorkspacePanel.tsx
 */

import type { RealtorWeekFocusLineId } from './realtorWeekFocusLogic';

export type RealtorWeekFocusActionId =
	| 'openProfile'
	| 'openListings'
	| 'openClients'
	| 'openPipeline'
	| 'openTasks'
	| 'openLearning'
	| 'openArtifacts';

export function resolveRealtorWeekFocusAction(
	lineId: RealtorWeekFocusLineId,
	options: {
		pipelineModuleEnabled: boolean;
		tasksModuleEnabled: boolean;
		listingWorkspaceEnabled: boolean;
		leadsModuleEnabled: boolean;
	}
): RealtorWeekFocusActionId | null {
	switch (lineId) {
		case 'profileIncomplete':
			return 'openProfile';
		case 'noListingsYet':
			return options.listingWorkspaceEnabled ? 'openListings' : null;
		case 'noClientsYet':
			return 'openClients';
		case 'dealsInProgress':
		case 'listingLinksMissing':
			return options.pipelineModuleEnabled ? 'openPipeline' : null;
		case 'followUpsDue':
			return options.tasksModuleEnabled ? 'openTasks' : null;
		case 'learningRemaining':
			return 'openLearning';
		case 'contentReady':
			return 'openArtifacts';
		case 'steadyWeek':
			return null;
		default:
			return null;
	}
}

export function realtorWeekFocusActionI18nKey(
	actionId: RealtorWeekFocusActionId
): string {
	return `overview.weekFocus.actions.${actionId}`;
}
