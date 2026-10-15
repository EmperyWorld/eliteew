/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Universal Output Surface V2 client lifecycle reducer.
 *
 * Invariants:
 * - View lifecycle actions must not imply task cancellation.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionSurfaceLifecycle.ts
 */

import { describe, expect, it } from 'vitest';

import {
	EMPTY_COMPANION_SURFACE_LIFECYCLE,
	companionSurfaceLifecycleReducer,
	deriveCompanionSurfaceCardRefs,
	dismissCompanionRunInSurfaceLifecycle,
	getCompanionViewPrefs,
	isMissionChromeCollapsed,
	loadCompanionSurfaceLifecycleState,
	setMissionCollapsed,
} from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

function run(id: string, status: string): EwaCompanionTaskRun {
	return {
		id,
		principal_id: 'p1',
		status,
		intent_kind: 'action_workflow',
		user_message: 'do it',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: null,
		updated_at: null,
		completed_at: null,
		surface_blocks: [
			{
				id: `task_run:${id}:result`,
				kind: 'result',
				title: 'Run',
				payload: {},
				actions: [],
			},
		],
	};
}

describe('companionSurfaceLifecycleReducer', () => {
	it('keeps terminal runs in active zone until dismissed', () => {
		const refs = deriveCompanionSurfaceCardRefs(
			[run('r1', 'completed'), run('r2', 'running')],
			EMPTY_COMPANION_SURFACE_LIFECYCLE
		);

		expect(refs.map((row) => row.zone)).toEqual(['active', 'active']);
	});

	it('supports close, pin and restore as view-only state', () => {
		const base = EMPTY_COMPANION_SURFACE_LIFECYCLE;
		const pinned = companionSurfaceLifecycleReducer(base, {
			type: 'pin',
			id: 'run:r1',
		});
		expect(pinned.pinnedIds).toEqual(['run:r1']);

		const closed = companionSurfaceLifecycleReducer(pinned, {
			type: 'close',
			id: 'run:r1',
		});
		expect(closed.dismissedIds).toEqual(['run:r1']);
		expect(closed.pinnedIds).toEqual([]);

		const restored = companionSurfaceLifecycleReducer(closed, {
			type: 'restore',
			id: 'run:r1',
		});
		expect(restored.restoredIds).toEqual(['run:r1']);
		expect(restored.dismissedIds).toEqual([]);
		expect(restored.historyExpanded).toBe(true);
	});

	it('matches legacy dismissed ids after card id migration', () => {
		const refs = deriveCompanionSurfaceCardRefs([run('r1', 'running')], {
			...EMPTY_COMPANION_SURFACE_LIFECYCLE,
			dismissedIds: ['task_run:r1:result'],
		});
		expect(refs[0]?.dismissed).toBe(true);
	});

	it('persists dismissed ids in localStorage without legacy prefix drift', () => {
		const key = 'eliteew.ewa.surfaceLifecycle.v1.p1';
		localStorage.setItem(
			key,
			JSON.stringify({
				dismissedIds: ['task_run:r9:result'],
				pinnedIds: [],
				restoredIds: [],
				historyExpanded: false,
			})
		);
		const loaded = loadCompanionSurfaceLifecycleState('p1');
		expect(loaded.dismissedIds).toEqual(['run:r9']);
		localStorage.removeItem(key);
	});

	it('dismissCompanionRunInSurfaceLifecycle writes durable localStorage immediately', () => {
		localStorage.clear();
		dismissCompanionRunInSurfaceLifecycle('p1', 'mission-1');
		expect(loadCompanionSurfaceLifecycleState('p1').dismissedIds).toContain(
			'run:mission-1'
		);
	});

	it('setMissionCollapsed persists expand override across reload', () => {
		localStorage.clear();
		expect(isMissionChromeCollapsed('p1', 'm1', false)).toBe(true);
		expect(isMissionChromeCollapsed('p1', 'm1', true)).toBe(false);
		setMissionCollapsed('p1', 'm1', false);
		expect(isMissionChromeCollapsed('p1', 'm1', false)).toBe(false);
		expect(getCompanionViewPrefs('p1').collapsedMissionIds).not.toContain('m1');
		expect(
			loadCompanionSurfaceLifecycleState('p1').expandedMissionIds
		).toContain('m1');
		setMissionCollapsed('p1', 'm1', true);
		expect(isMissionChromeCollapsed('p1', 'm1', false)).toBe(true);
		expect(getCompanionViewPrefs('p1').collapsedMissionIds).toContain('m1');
	});
});
