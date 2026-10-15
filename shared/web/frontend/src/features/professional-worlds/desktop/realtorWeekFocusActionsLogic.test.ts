/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Overview week focus action resolution.
 */

import { describe, expect, it } from 'vitest';

import {
	realtorWeekFocusActionI18nKey,
	resolveRealtorWeekFocusAction,
} from './realtorWeekFocusActionsLogic';

describe('realtorWeekFocusActionsLogic', () => {
	it('maps focus lines to actions when modules are enabled', () => {
		const enabled = {
			pipelineModuleEnabled: true,
			tasksModuleEnabled: true,
			listingWorkspaceEnabled: true,
			leadsModuleEnabled: true,
		};
		expect(resolveRealtorWeekFocusAction('profileIncomplete', enabled)).toBe(
			'openProfile'
		);
		expect(resolveRealtorWeekFocusAction('followUpsDue', enabled)).toBe(
			'openTasks'
		);
		expect(resolveRealtorWeekFocusAction('steadyWeek', enabled)).toBeNull();
	});

	it('suppresses pipeline/tasks actions when modules are off', () => {
		expect(
			resolveRealtorWeekFocusAction('dealsInProgress', {
				pipelineModuleEnabled: false,
				tasksModuleEnabled: true,
				listingWorkspaceEnabled: true,
				leadsModuleEnabled: false,
			})
		).toBeNull();
	});

	it('exposes i18n keys for actions', () => {
		expect(realtorWeekFocusActionI18nKey('openArtifacts')).toBe(
			'overview.weekFocus.actions.openArtifacts'
		);
	});
});
