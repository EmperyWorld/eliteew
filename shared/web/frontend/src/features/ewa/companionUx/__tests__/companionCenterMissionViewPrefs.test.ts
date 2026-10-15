/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for center-mission dismiss prefs (shared UOS localStorage lifecycle).
 *
 * Related:
 * - src/features/ewa/companionUx/companionCenterMissionViewPrefs.ts
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
	dismissCenterMissionRunId,
	isCenterMissionChromeCollapsed,
	loadDismissedCenterMissionRunIds,
	setCenterMissionChromeCollapsed,
} from '@/features/ewa/companionUx/companionCenterMissionViewPrefs';
import { loadCompanionSurfaceLifecycleState } from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';

describe('companionCenterMissionViewPrefs', () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});

	it('persists dismissals in surface lifecycle localStorage', () => {
		const next = dismissCenterMissionRunId('p1', 'run-a', []);
		expect(next).toEqual(['run-a']);
		expect(loadDismissedCenterMissionRunIds('p1')).toEqual(['run-a']);
		expect(loadCompanionSurfaceLifecycleState('p1').dismissedIds).toContain(
			'run:run-a'
		);
		expect(loadDismissedCenterMissionRunIds('p2')).toEqual([]);
	});

	it('shares dismissals with operations close ids', () => {
		dismissCenterMissionRunId('p1', 'run-new', []);
		dismissCenterMissionRunId('p1', 'run-old', ['run-new']);
		expect(loadDismissedCenterMissionRunIds('p1')).toEqual([
			'run-new',
			'run-old',
		]);
	});

	it('routes mission collapse through Shell Lifecycle Manager', () => {
		expect(isCenterMissionChromeCollapsed('p1', 'run-x', false)).toBe(true);
		setCenterMissionChromeCollapsed('p1', 'run-x', false);
		expect(isCenterMissionChromeCollapsed('p1', 'run-x', false)).toBe(false);
		expect(
			loadCompanionSurfaceLifecycleState('p1').expandedMissionIds
		).toContain('run-x');
	});
});
