/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Regression coverage for proactive EWA companion observation activity-key extraction
 * and hidden-tab skip before observation POST.
 *
 * Invariants:
 * - Tests use the live EwaCompanionShellContextV1 shape emitted by Desktop shell.
 *
 * Related:
 * - src/features/ewa/useEwaCompanionAnticipationTick.ts
 * - src/pages/Desktop/utils/buildEwaCompanionShellContext.ts
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observationTriggerAllowed } from '@/features/ewa/companionObservationTriggerPrefs';
import {
	pickActivityKey,
	useEwaCompanionAnticipationTick,
} from '@/features/ewa/useEwaCompanionAnticipationTick';
import type { EwaCompanionShellContextV1 } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';

const getSnapshot = vi.fn();
const postEwaCompanionObservation = vi.fn();

vi.mock('@/pages/Desktop/context/EwaCompanionShellBridgeContext', () => ({
	useEwaCompanionShellBridge: () => ({ getSnapshot }),
}));

vi.mock('@/services/ewa/ewaCompanionChatApi', () => ({
	postEwaCompanionObservation: (...args: unknown[]) =>
		postEwaCompanionObservation(...args),
}));

vi.mock(
	'@/features/ewa/companionObservationTriggerPrefs',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('@/features/ewa/companionObservationTriggerPrefs')
			>();
		return {
			...actual,
			readLocalObservationTriggerPrefs: () => ({
				idle: true,
				focus: true,
				app_switch: true,
			}),
		};
	}
);

vi.mock('@/features/ewa/companionUx/companionProactiveSnoozeStorage', () => ({
	isProactiveSnoozedToday: () => false,
}));

describe('useEwaCompanionAnticipationTick activity key', () => {
	it('reads the current shell_context v1 shape', () => {
		const snap: EwaCompanionShellContextV1 = {
			schema_version: 1,
			active_desktop_id: 'desk-writing',
			active_window_id: 'doc-1',
			windows: [
				{
					window_id: 'music-1',
					app_component: 'MusicPlayer',
					title: 'Focus playlist',
					z_index: 3,
					minimized: false,
					desktop_id: 'desk-writing',
				},
				{
					window_id: 'doc-1',
					app_component: 'DocEditor',
					title: 'business_plan.md',
					z_index: 9,
					minimized: false,
					desktop_id: 'desk-writing',
				},
			],
		};

		expect(pickActivityKey(snap)).toEqual({
			activeApp: 'DocEditor',
			activeWindow: 'doc-1',
			activeTitle: 'business_plan.md',
			openCount: 2,
			workspaceLabel: 'desk-writing',
		});
	});

	it('keeps legacy synthetic snapshots readable for tests', () => {
		expect(
			pickActivityKey({
				focused_window: {
					app_component: 'EwaApp',
					window_id: 'ewa-1',
					title: 'EWA',
				},
				open_windows: [{ id: 'ewa-1' }],
				active_workspace: { id: 'desk-main' },
			} as never)
		).toEqual({
			activeApp: 'EwaApp',
			activeWindow: 'ewa-1',
			activeTitle: 'EWA',
			openCount: 1,
			workspaceLabel: 'desk-main',
		});
	});
});

describe('useEwaCompanionAnticipationTick hidden tab', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		postEwaCompanionObservation.mockReset();
		getSnapshot.mockReset();
		getSnapshot.mockReturnValue({
			schema_version: 1,
			active_desktop_id: 'desk-a',
			active_window_id: 'w1',
			windows: [
				{
					window_id: 'w1',
					app_component: 'DocEditor',
					title: 'note.md',
					z_index: 1,
					minimized: false,
					desktop_id: 'desk-a',
				},
			],
		});
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			get: () => true,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			value: false,
		});
	});

	it('does not POST observation while document.hidden', async () => {
		renderHook(() =>
			useEwaCompanionAnticipationTick('user-1', {
				enabled: true,
				tickIntervalMs: 1_000,
				minGapBetweenPostsMs: 0,
				idleAfterMs: 0,
			})
		);

		await act(async () => {
			vi.advanceTimersByTime(3_000);
			await Promise.resolve();
		});

		expect(postEwaCompanionObservation).not.toHaveBeenCalled();
	});
});

describe('observationTriggerAllowed', () => {
	it('gates idle separately from focus triggers', () => {
		const prefs = { idleEnabled: false, focusAppEnabled: true };
		expect(observationTriggerAllowed('idle', prefs)).toBe(false);
		expect(observationTriggerAllowed('active_app_changed', prefs)).toBe(true);
		expect(observationTriggerAllowed('focus_change', prefs)).toBe(true);
	});

	it('can disable focus-app triggers while idle stays on', () => {
		const prefs = { idleEnabled: true, focusAppEnabled: false };
		expect(observationTriggerAllowed('idle', prefs)).toBe(true);
		expect(observationTriggerAllowed('window_opened', prefs)).toBe(false);
	});
});
