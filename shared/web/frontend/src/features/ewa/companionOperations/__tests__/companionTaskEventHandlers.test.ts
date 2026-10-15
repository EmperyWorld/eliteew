/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion chat SSE task handler merge helpers.
 */

import { describe, expect, it, vi } from 'vitest';

import { createCompanionChatStreamTaskHandlers } from '@/features/ewa/companionOperations/companionTaskEventHandlers';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

describe('createCompanionChatStreamTaskHandlers', () => {
	it('merges task_step into operation runs', () => {
		const runs: EwaCompanionTaskRun[] = [
			makeCompanionTaskRun({
				id: 'run-1',
				status: 'running',
				user_message: 'song',
				steps: [],
			}),
		];
		let current = runs;
		const onRunsChange = vi.fn(
			(updater: (prev: EwaCompanionTaskRun[]) => EwaCompanionTaskRun[]) => {
				current = updater(current);
			}
		);
		const onRefreshRuns = vi.fn();
		const handlers = createCompanionChatStreamTaskHandlers({
			onRunsChange,
			onRefreshRuns,
		});

		handlers.onTaskStep?.({
			run_id: 'run-1',
			step_index: 1,
			step_kind: 'lyrics',
			status: 'in_progress',
			title: 'Текст',
			progress: { current: 1, total: 4 },
		});

		expect(onRunsChange).toHaveBeenCalledTimes(1);
		expect(current[0]?.steps?.length).toBeGreaterThan(0);
		expect(current[0]?.steps?.[0]?.step_kind).toBe('lyrics');
		expect(onRefreshRuns).not.toHaveBeenCalled();
	});

	it('refreshes runs on terminal chat stream events', () => {
		const onRunsChange = vi.fn();
		const onRefreshRuns = vi.fn();
		const handlers = createCompanionChatStreamTaskHandlers({
			onRunsChange,
			onRefreshRuns,
		});

		handlers.onTaskAccepted?.({ run_id: 'run-1' });
		handlers.onTaskCompleted?.({ run_id: 'run-1' });
		handlers.onTaskFailed?.({ run_id: 'run-1' });
		handlers.onTaskAwaitingConfirmation?.({ run_id: 'run-1' });

		expect(onRefreshRuns).toHaveBeenCalledTimes(4);
		expect(onRefreshRuns).toHaveBeenCalledWith({ silent: true });
	});
});
