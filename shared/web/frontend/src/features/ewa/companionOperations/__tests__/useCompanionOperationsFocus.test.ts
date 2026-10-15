/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionOperationsFocus (U8.1 extract).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCompanionOperationsFocus } from '@/features/ewa/companionOperations/useCompanionOperationsFocus';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

function run(status: string, id = 'run-1'): EwaCompanionTaskRun {
	return {
		id,
		principal_id: 'p1',
		status,
		intent_kind: 'action_workflow',
		user_message: 'test',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: null,
		updated_at: null,
		completed_at: null,
	};
}

describe('useCompanionOperationsFocus', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('focuses run and opens mobile sheet on embedded layout', () => {
		const { result } = renderHook(() =>
			useCompanionOperationsFocus({
				mobileEmbeddedComposerLayout: true,
				composerVisible: true,
			})
		);

		act(() => result.current.focusOperationRun('run-abc'));

		expect(result.current.operationsExpanded).toBe(true);
		expect(result.current.highlightedOperationRunId).toBe('run-abc');
		expect(result.current.mobileOperationsOpen).toBe(true);
	});

	it('auto-opens mobile sheet for awaiting_confirmation on new active run', () => {
		const { result } = renderHook(() =>
			useCompanionOperationsFocus({
				mobileEmbeddedComposerLayout: true,
				composerVisible: true,
			})
		);

		act(() =>
			result.current.handleNewActiveOperationRun(
				run('awaiting_confirmation', 'confirm-1')
			)
		);

		expect(result.current.highlightedOperationRunId).toBe('confirm-1');
		expect(result.current.mobileOperationsOpen).toBe(true);
	});

	it('clears highlight after timeout', () => {
		vi.useFakeTimers();
		const { result } = renderHook(() =>
			useCompanionOperationsFocus({
				mobileEmbeddedComposerLayout: false,
				composerVisible: true,
				highlightClearMs: 1000,
			})
		);

		act(() => result.current.focusOperationRun('run-clear'));
		expect(result.current.highlightedOperationRunId).toBe('run-clear');

		act(() => vi.advanceTimersByTime(1000));
		expect(result.current.highlightedOperationRunId).toBeNull();
	});
});
